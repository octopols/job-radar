import { APPLY_IPC, type FieldOutcome, type OptionMatch, type Point } from "../../../shared/ipc/apply.ts";
import type { ApplicationAnswer, FormField } from "../../../shared/types/application.ts";
import type { PageChannel } from "./page-channel.ts";
import type { PageInput } from "./page-input.ts";
import { Pause } from "./types.ts";

const DROPDOWN_OPEN_MS = 350;
const DROPDOWN_FILTER_MS = 450;
export const DROPDOWN_CLOSE_MS = 200;
const UNCHOSEN_DROPDOWN = /^(select|choose|pick|--)|^$/i;

export class DropdownFiller {
	readonly #page: PageChannel;
	readonly #input: PageInput;

	constructor(page: PageChannel, input: PageInput) {
		this.#page = page;
		this.#input = input;
	}

	async readOptions(fields: FormField[]): Promise<FormField[]> {
		const ready: FormField[] = [];
		for (const field of fields) {
			ready.push(field.kind === "combobox" ? { ...field, options: await this.#openAndRead(field) } : field);
		}
		return ready;
	}

	async fill(fields: FormField[], answers: ApplicationAnswer[]): Promise<FieldOutcome[]> {
		const byId = new Map(answers.map((answer) => [answer.fieldId, answer]));
		const outcomes: FieldOutcome[] = [];
		for (const field of fields.filter((candidate) => candidate.kind === "combobox")) {
			const answer = byId.get(field.id);
			const filled = answer?.value ? await this.#chooseOption(field, answer.value) : false;
			const alreadySet = !filled && !UNCHOSEN_DROPDOWN.test(await this.#page.request<string>(APPLY_IPC.shown, field.id));
			const note = alreadySet ? null : (answer?.reviewNote ?? (filled ? null : answer?.value ? `Pick "${answer.value}" yourself` : field.required ? "Needs your answer" : null));
			outcomes.push({ fieldId: field.id, label: field.label, filled: filled || alreadySet, note });
		}
		await this.#page.request(APPLY_IPC.markOutcomes, outcomes);
		return outcomes;
	}

	async #openAndRead(field: FormField): Promise<string[]> {
		for (let attempt = 0; attempt < 2; attempt++) {
			const point = await this.#page.request<Point | null>(APPLY_IPC.locate, field.id);
			if (!point) {
				return [];
			}
			await this.#input.click(point);
			await Pause.for(DROPDOWN_OPEN_MS * (attempt + 1));
			const options = await this.#page.request<string[]>(APPLY_IPC.options, field.id);
			await this.#input.press("Escape");
			await Pause.for(DROPDOWN_CLOSE_MS);
			if (options.length > 0) {
				return options;
			}
		}
		return [];
	}

	async #chooseOption(field: FormField, value: string): Promise<boolean> {
		const control = await this.#page.request<Point | null>(APPLY_IPC.locate, field.id);
		if (!control) {
			return false;
		}
		await this.#input.click(control);
		await Pause.for(DROPDOWN_OPEN_MS);
		await this.#input.type(value);
		await Pause.for(DROPDOWN_FILTER_MS);
		const option = await this.#page.request<OptionMatch | null>(APPLY_IPC.locateOption, field.id, value);
		if (!option) {
			await this.#input.press("Escape");
			await Pause.for(DROPDOWN_CLOSE_MS);
			return false;
		}
		if (option.isTopOption) {
			await this.#input.press("Enter");
		} else {
			await this.#input.click(option.point);
		}
		await Pause.for(DROPDOWN_CLOSE_MS);
		const shown = await this.#page.request<string>(APPLY_IPC.shown, field.id);
		return shown.toLowerCase().includes(option.text.toLowerCase());
	}
}
