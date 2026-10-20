import { APPLY_IPC, type ApplicationRequest, type NavigationCandidate, type Point } from "../../../shared/ipc/apply.ts";
import type { FormField } from "../../../shared/types/application.ts";
import type { PageChannel } from "./page-channel.ts";
import type { PageInput } from "./page-input.ts";
import { type Assistant, Pause } from "./types.ts";

const FORM_WAIT_ATTEMPTS = 20;
const FORM_WAIT_INTERVAL_MS = 750;

const FORM_STABLE_CHECKS = 3;
const MIN_FORM_CONTROLS = 2;
const NAVIGATION_STEPS = 3;

const OBVIOUS_APPLY_SCORE = 3;

const NAVIGATION_SETTLE_MS = 2_000;

export class FormNavigator {
	readonly #page: PageChannel;
	readonly #input: PageInput;
	readonly #assistant: Assistant;
	readonly #request: ApplicationRequest;
	readonly #currentUrl: () => string;

	constructor(page: PageChannel, input: PageInput, assistant: Assistant, request: ApplicationRequest, currentUrl: () => string) {
		this.#page = page;
		this.#input = input;
		this.#assistant = assistant;
		this.#request = request;
		this.#currentUrl = currentUrl;
	}

	async waitForForm(): Promise<FormField[]> {
		let previous = -1;
		let steady = 0;
		for (let attempt = 0; attempt < FORM_WAIT_ATTEMPTS; attempt++) {
			const count = await this.#page.request<number>(APPLY_IPC.count);
			steady = count === previous ? steady + 1 : 0;
			previous = count;
			if (count >= MIN_FORM_CONTROLS && steady >= FORM_STABLE_CHECKS - 1) {
				return this.#page.request<FormField[]>(APPLY_IPC.scan);
			}
			await Pause.for(FORM_WAIT_INTERVAL_MS);
		}
		return previous >= MIN_FORM_CONTROLS ? this.#page.request<FormField[]>(APPLY_IPC.scan) : [];
	}

	async navigateToForm(onStep: () => void): Promise<FormField[]> {
		for (let step = 0; step < NAVIGATION_STEPS; step++) {
			onStep();
			const candidates = await this.#page.request<NavigationCandidate[]>(APPLY_IPC.navigationCandidates);
			const index = await this.#chooseCandidate(candidates);
			if (index === null) {
				return [];
			}
			const point = await this.#page.request<Point | null>(APPLY_IPC.locateCandidate, index);
			if (!point) {
				return [];
			}
			await this.#input.start();
			await this.#input.click(point);
			await Pause.for(NAVIGATION_SETTLE_MS);
			const fields = await this.waitForForm();
			if (fields.length > 0) {
				return fields;
			}
		}
		return [];
	}

	async #chooseCandidate(candidates: NavigationCandidate[]): Promise<number | null> {
		const [best, second] = candidates;
		if (!best) {
			return null;
		}
		if (best.score >= OBVIOUS_APPLY_SCORE && (!second || best.score > second.score)) {
			return best.index;
		}
		const choice = await this.#assistant
			.findApplyTarget({
				company: this.#request.company,
				title: this.#request.title,
				pageUrl: this.#currentUrl(),
				candidates: candidates.map(({ index, text, href }) => ({ index, text, href })),
			})
			.catch(() => ({ index: null }));
		return candidates.some((candidate) => candidate.index === choice.index) ? choice.index : null;
	}
}
