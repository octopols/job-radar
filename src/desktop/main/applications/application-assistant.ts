import { ipcMain, type IpcMainEvent } from "electron";
import { APPLY_IPC, type ApplicationRequest } from "../../../shared/ipc/apply.ts";
import type { SavedAnswerInput } from "../../../shared/types/application.ts";
import { ApplicationSession } from "./application-session.ts";
import type { Assistant, AutoApplyResult, SeekerClient, SessionMode, StatusListener } from "./types.ts";

const AUTO_APPLY_TIMEOUT_MS = 5 * 60_000;

export class ApplicationAssistant {
	readonly #sessions = new Map<string, ApplicationSession>();
	readonly #client: SeekerClient;
	readonly #assistant: Assistant;
	readonly #onStatus: StatusListener;

	constructor(client: SeekerClient, assistant: Assistant, onStatus: StatusListener) {
		this.#client = client;
		this.#assistant = assistant;
		this.#onStatus = onStatus;
		ipcMain.on(APPLY_IPC.reply, (event, requestId: number, payload: unknown) => this.#session(event)?.resolve(requestId, payload));
		ipcMain.on(APPLY_IPC.fillRequested, (event) => void this.#session(event)?.run());
		ipcMain.on(APPLY_IPC.submitClicked, (event, answers: SavedAnswerInput[]) => this.#session(event)?.noteSubmitClicked(answers));
		ipcMain.on(APPLY_IPC.submitted, (event) => void this.#session(event)?.markSubmitted());
	}

	open(request: ApplicationRequest): void {
		const existing = this.#sessions.get(ApplicationAssistant.#key(request));
		if (existing) {
			existing.focus();
			return;
		}
		this.#start(request, { auto: false, autoSubmit: false });
	}

	async autoApply(request: ApplicationRequest, autoSubmit: boolean): Promise<AutoApplyResult | null> {
		if (this.#sessions.has(ApplicationAssistant.#key(request))) {
			return null;
		}
		const session = this.#start(request, { auto: true, autoSubmit });
		const timeout = new Promise<AutoApplyResult>((resolve) =>
			setTimeout(() => resolve({ outcome: "needs-you", note: "This application took too long to fill. Open it to finish." }), AUTO_APPLY_TIMEOUT_MS),
		);
		const result = await Promise.race([session.autoResult, timeout]);
		await session.finishAuto(result);
		return result;
	}

	#start(request: ApplicationRequest, mode: SessionMode): ApplicationSession {
		const key = ApplicationAssistant.#key(request);
		const seeker = this.#client.seeker.getOrCreate([request.seekerKey]);
		const session = new ApplicationSession(request, seeker, this.#assistant, this.#onStatus, mode, () => this.#sessions.delete(key));
		this.#sessions.set(key, session);
		return session;
	}

	static #key(request: ApplicationRequest): string {
		return `${request.boardKey}/${request.postingId}`;
	}

	#session(event: IpcMainEvent): ApplicationSession | undefined {
		return [...this.#sessions.values()].find((session) => session.owns(event.sender.id));
	}
}
