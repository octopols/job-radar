import { BrowserWindow, shell } from "electron";
import { APPLY_IPC, type ApplicationRequest, type ApplicationStatus, type ApplyBannerState, type FieldOutcome, type Point } from "../../../shared/ipc/apply.ts";
import type { ApplicationAnswer, FormField, SavedAnswerInput } from "../../../shared/types/application.ts";
import { APPLY_PRELOAD_PATH } from "../app/config.ts";
import { AppIcon } from "../windows/app-icon.ts";
import { ApplicationUrl } from "./application-url.ts";
import { DROPDOWN_CLOSE_MS, DropdownFiller } from "./dropdown-filler.ts";
import { FormNavigator } from "./form-navigator.ts";
import { PageChannel } from "./page-channel.ts";
import { PageInput } from "./page-input.ts";
import { ResumeAttacher } from "./resume-attacher.ts";
import { type Assistant, type AutoApplyResult, Pause, type SeekerHandle, type SessionMode, type StatusListener } from "./types.ts";

const CONFIRMATION_TIMEOUT_MS = 45_000;
const CONFIRMATION_POLL_MS = 1_000;

const REJECTION_CHECK_AFTER_MS = 6_000;

const SUBMITTED_WINDOW_LINGER_MS = 2_000;
const READINESS_LABELS_SHOWN = 3;

export class ApplicationSession {
	readonly #request: ApplicationRequest;
	readonly #seeker: SeekerHandle;
	readonly #onStatus: StatusListener;
	readonly #mode: SessionMode;
	readonly #window: BrowserWindow;
	readonly #input: PageInput;
	readonly #page: PageChannel;
	readonly #navigator: FormNavigator;
	readonly #dropdowns: DropdownFiller;
	readonly #resume: ResumeAttacher;
	readonly autoResult: Promise<AutoApplyResult>;
	#settleAuto: (result: AutoApplyResult) => void = () => undefined;
	#running = false;
	#filled = false;
	#submitted = false;
	#banner: ApplyBannerState | null = null;

	constructor(request: ApplicationRequest, seeker: SeekerHandle, assistant: Assistant, onStatus: StatusListener, mode: SessionMode, onClosed: () => void) {
		this.#request = request;
		this.#seeker = seeker;
		this.#onStatus = onStatus;
		this.#mode = mode;
		this.autoResult = new Promise((resolve) => {
			this.#settleAuto = resolve;
		});
		this.#window = new BrowserWindow({
			width: 1120,
			height: 900,
			title: `Apply: ${request.title} at ${request.company}`,
			icon: AppIcon.window(),
			autoHideMenuBar: true,
			show: !mode.auto,
			webPreferences: { preload: APPLY_PRELOAD_PATH, partition: "persist:applications", contextIsolation: true, sandbox: true, backgroundThrottling: false },
		});
		AppIcon.applyTaskbarIdentity(this.#window);
		const contents = this.#window.webContents;
		this.#input = new PageInput(contents);
		this.#page = new PageChannel(contents);
		this.#navigator = new FormNavigator(this.#page, this.#input, assistant, request, () => contents.getURL());
		this.#dropdowns = new DropdownFiller(this.#page, this.#input);
		this.#resume = new ResumeAttacher(this.#page, this.#input, seeker);

		contents.setWindowOpenHandler(({ url }) => {
			if (/^https?:/.test(url)) {
				void this.#window.loadURL(url);
			} else {
				void shell.openExternal(url);
			}
			return { action: "deny" };
		});

		this.#window.on("page-title-updated", (event) => event.preventDefault());
		contents.on("did-finish-load", () => this.#onPageLoaded());
		this.#window.on("closed", () => {
			this.#input.stop();
			onClosed();
		});
		this.#status("opening");
		void this.#window.loadURL(ApplicationUrl.for(request.url));
	}

	owns(webContentsId: number): boolean {
		return !this.#window.isDestroyed() && this.#window.webContents.id === webContentsId;
	}

	focus(): void {
		this.#window.show();
		this.#window.focus();
	}

	resolve(requestId: number, payload: unknown): void {
		this.#page.resolve(requestId, payload);
	}

	noteSubmitClicked(answers: SavedAnswerInput[]): void {
		void this.#seeker.rememberAnswers(this.#request.company, answers).catch((error: unknown) => console.error("could not save submitted answers", error));
		this.#showBanner({ ...(this.#banner ?? ApplicationSession.#emptyBanner()), title: "Sending your application", detail: "Waiting for the company's confirmation.", busy: true, action: null });
	}

	async run(): Promise<void> {
		if (this.#running || this.#submitted) {
			return;
		}
		this.#running = true;
		try {
			this.#status("reading");
			this.#showBanner({ ...ApplicationSession.#emptyBanner(), title: "Reading the application form", busy: true });
			const found = await this.#navigator.waitForForm();
			const fields =
				found.length > 0
					? found
					: await this.#navigator.navigateToForm(() => this.#showBanner({ ...ApplicationSession.#emptyBanner(), title: "Finding the application form", busy: true }));
			if (fields.length === 0) {
				this.#settleAuto({ outcome: "needs-you", note: "Couldn't find the application form. Open it to apply." });
				this.#status("no-form");
				this.#showBanner({
					...ApplicationSession.#emptyBanner(),
					title: "No application form on this page yet",
					detail: "Open the company's application form, then press Fill this page.",
					action: "Fill this page",
				});
				return;
			}

			this.#status("drafting");
			this.#showBanner({ ...ApplicationSession.#emptyBanner(), title: "Claude is writing your answers", detail: `${fields.length} questions on this form. This takes about a minute.`, busy: true });
			await this.#input.start();
			const readyFields = await this.#dropdowns.readOptions(fields);
			const draft = await this.#seeker.draftApplication(this.#request.boardKey, this.#request.postingId, readyFields);
			const outcomes = await this.#page.request<FieldOutcome[]>(APPLY_IPC.fill, readyFields, draft.answers satisfies ApplicationAnswer[]);
			outcomes.push(...(await this.#dropdowns.fill(readyFields, draft.answers)));
			outcomes.push(...(await this.#resume.attach(readyFields)));

			this.#filled = true;
			this.#showFilled(outcomes);
			const readiness = ApplicationSession.#readiness(readyFields, outcomes);
			const submittable = this.#mode.autoSubmit && readiness.outcome === "ready" && outcomes.every((outcome) => !outcome.note);
			this.#settleAuto(submittable ? await this.#submit() : readiness);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.#settleAuto({ outcome: "failed", note: message });
			this.#status("failed", { error: message });
			this.#showBanner({ ...ApplicationSession.#emptyBanner(), title: "Could not fill this form", detail: message, action: "Try again" });
		} finally {
			this.#running = false;
		}
	}

	async markSubmitted(): Promise<void> {
		if (this.#submitted) {
			return;
		}
		this.#submitted = true;
		await this.#seeker.setStatus(this.#request.boardKey, this.#request.postingId, "applied");
		this.#status("submitted");
		this.#showBanner({
			...ApplicationSession.#emptyBanner(),
			title: "Application sent",
			detail: "Marked as applied in Job Radar. You'll get a reminder to follow up.",
		});
	}

	async finishAuto(result: AutoApplyResult): Promise<void> {
		await this.#seeker
			.recordAutoApply(this.#request.boardKey, this.#request.postingId, result.outcome, result.note)
			.catch((error: unknown) => console.error("could not record auto-apply outcome", error));
		if (result.outcome === "submitted") {
			setTimeout(() => !this.#window.isDestroyed() && this.#window.destroy(), SUBMITTED_WINDOW_LINGER_MS);
			return;
		}
		this.#showBanner({
			...(this.#banner ?? ApplicationSession.#emptyBanner()),
			title: result.outcome === "ready" ? "Ready to submit" : "Finish this application",
			detail: result.outcome === "ready" && !result.note ? "Job Radar filled everything. Check the answers, then press Submit on the form." : (result.note ?? "Job Radar stopped part way."),
			busy: false,
			action: "Fill again",
		});
	}

	#showFilled(outcomes: FieldOutcome[]): void {
		const needsYou = outcomes
			.filter((outcome) => outcome.note)
			.map((outcome) => ({ fieldId: outcome.fieldId, label: outcome.label, note: outcome.note ?? "", kind: outcome.filled ? ("glance" as const) : ("answer" as const) }))
			.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "answer" ? -1 : 1));
		const toAnswer = needsYou.filter((item) => item.kind === "answer").length;
		const toGlance = needsYou.length - toAnswer;
		const filledCount = outcomes.filter((outcome) => outcome.filled).length;
		this.#status("ready", { filled: filledCount, needsYou: toAnswer });
		const summary = [toAnswer > 0 ? `${toAnswer} need your answer` : "", toGlance > 0 ? `${toGlance} worth a glance` : ""].filter(Boolean).join(", ");
		this.#showBanner({
			title: `Filled ${filledCount} of ${outcomes.length} questions`,
			detail: `${summary ? `${summary}. ` : ""}Check the answers, then press Submit on the form.`,
			busy: false,
			action: "Fill again",
			needsYou,
		});
	}

	static #readiness(fields: FormField[], outcomes: FieldOutcome[]): AutoApplyResult {
		const required = new Set(fields.filter((field) => field.required).map((field) => field.id));
		const missing = outcomes.filter((outcome) => required.has(outcome.fieldId) && !outcome.filled);
		if (missing.length === 0) {
			return { outcome: "ready", note: null };
		}
		const labels = missing.map((outcome) => outcome.label || "an unlabelled question").slice(0, READINESS_LABELS_SHOWN);
		const more = missing.length - READINESS_LABELS_SHOWN;
		const list = `${labels.join("; ")}${more > 0 ? `, and ${more} more` : ""}`;

		return { outcome: "needs-you", note: `Needs your answer: ${list}${/[.?!]$/.test(list) ? "" : "."}` };
	}

	async #submit(): Promise<AutoApplyResult> {
		this.#showBanner({ ...ApplicationSession.#emptyBanner(), title: "Submitting your application", busy: true });
		await Pause.for(DROPDOWN_CLOSE_MS);
		const button = await this.#page.probe<Point | null>(APPLY_IPC.locateSubmit, null);
		if (!button) {
			return { outcome: "ready", note: "Couldn't find the Submit button. Open it to send the application." };
		}
		await this.#input.click(button);
		const clickedAt = Date.now();
		while (!this.#submitted && Date.now() - clickedAt < CONFIRMATION_TIMEOUT_MS) {
			await Pause.for(CONFIRMATION_POLL_MS);
			const challenge = await this.#page.probe<string | null>(APPLY_IPC.challenge, null);
			if (challenge) {
				return { outcome: "needs-you", note: `${challenge} Open it to finish.` };
			}
			if (Date.now() - clickedAt > REJECTION_CHECK_AFTER_MS) {
				const rejected = await this.#page.probe<string[]>(APPLY_IPC.rejected, []);
				if (rejected.length > 0) {
					return { outcome: "needs-you", note: `The site didn't accept: ${rejected.slice(0, READINESS_LABELS_SHOWN).join("; ")}.` };
				}
			}
		}
		return this.#submitted
			? { outcome: "submitted", note: null }
			: { outcome: "needs-you", note: "Couldn't confirm the application went through. Open it to check." };
	}

	#onPageLoaded(): void {
		if (!this.#filled && !this.#submitted) {
			void this.run();
			return;
		}
		if (this.#banner) {
			this.#showBanner(this.#banner);
		}
	}

	#showBanner(state: ApplyBannerState): void {
		this.#banner = state;
		if (!this.#window.isDestroyed()) {
			this.#page.send(APPLY_IPC.banner, state);
		}
	}

	#status(phase: ApplicationStatus["phase"], extra: Partial<Pick<ApplicationStatus, "filled" | "needsYou" | "error">> = {}): void {
		this.#onStatus({ boardKey: this.#request.boardKey, postingId: this.#request.postingId, phase, filled: 0, needsYou: 0, error: null, ...extra });
	}

	static #emptyBanner(): ApplyBannerState {
		return { title: "", detail: "", busy: false, action: null, needsYou: [] };
	}
}
