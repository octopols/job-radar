import type { FormField, SavedAnswerInput } from "../../../shared/types/application.ts";
import { ComboboxProbe } from "./combobox-probe.ts";
import { FieldLabels } from "./field-labels.ts";
import { FieldLocator } from "./field-locator.ts";
import { FormScanner } from "./form-scanner.ts";
import { type Control, PageDom, PLACEHOLDER_OPTION } from "./page-dom.ts";

const MAX_QUESTION_LENGTH = 500;
const MAX_ANSWER_LENGTH = 5_000;

export class AnswerCollector {
	static collect(): SavedAnswerInput[] {
		const answers: SavedAnswerInput[] = [];
		for (const field of FormScanner.lastScan) {
			const answer = field.label ? AnswerCollector.#valueOf(field, FieldLocator.find(field.id)) : "";
			if (answer) {
				answers.push({ question: field.label.slice(0, MAX_QUESTION_LENGTH), answer: answer.slice(0, MAX_ANSWER_LENGTH) });
			}
		}
		return answers;
	}

	static #valueOf(field: FormField, elements: Control[]): string {
		const [element] = elements;
		if (!element) {
			return "";
		}
		switch (field.kind) {
			case "text":
			case "email":
			case "tel":
			case "url":
			case "number":
			case "date":
			case "textarea":
				return element.value.trim();
			case "select": {
				const chosen = PageDom.clean((element as HTMLSelectElement).selectedOptions[0]?.textContent);
				return PLACEHOLDER_OPTION.test(chosen) ? "" : chosen;
			}
			case "combobox": {
				const shown = ComboboxProbe.shown(field.id);
				return PLACEHOLDER_OPTION.test(shown) ? "" : shown;
			}
			case "radio":
				return AnswerCollector.#checkedLabels(elements);
			case "checkbox":
				if (elements.length === 1) {
					return (element as HTMLInputElement).checked ? "Yes" : "";
				}
				return AnswerCollector.#checkedLabels(elements);
			case "file":
				return "";
		}
	}

	static #checkedLabels(elements: Control[]): string {
		return elements
			.filter((member) => (member as HTMLInputElement).checked)
			.map((member) => FieldLabels.ofOption(member as HTMLInputElement))
			.join(", ");
	}
}
