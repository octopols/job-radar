import type { FieldOutcome } from "../../../shared/ipc/apply.ts";
import type { ApplicationAnswer, FormField } from "../../../shared/types/application.ts";
import { FieldLabels } from "./field-labels.ts";
import { FieldLocator } from "./field-locator.ts";
import { BRAND, type Control, PageDom } from "./page-dom.ts";

type MarkState = "filled" | "glance" | "review" | "none";

const FILLED_COLOR = "#16a34a";

export class FormFiller {
	fill(fields: FormField[], answers: ApplicationAnswer[]): FieldOutcome[] {
		const byId = new Map(answers.map((answer) => [answer.fieldId, answer]));
		const outcomes: FieldOutcome[] = [];
		for (const field of fields) {
			if (field.kind === "file" || field.kind === "combobox") {
				continue;
			}
			const answer = byId.get(field.id);
			const elements = FieldLocator.find(field.id);
			const value = answer?.value ?? null;
			const choices = answer?.choices ?? [];
			const filled = elements.length > 0 && (value !== null || choices.length > 0) && FormFiller.#apply(field, elements, value, choices);
			const note = answer?.reviewNote ?? (filled ? null : field.required ? "Needs your answer" : null);
			outcomes.push({ fieldId: field.id, label: field.label, filled, note });
			FormFiller.mark(elements, FormFiller.markState(filled, note), note);
		}
		return outcomes;
	}

	static markState(filled: boolean, note: string | null): MarkState {
		if (filled) {
			return note ? "glance" : "filled";
		}
		return note ? "review" : "none";
	}

	static mark(elements: Control[], state: MarkState, note: string | null): void {
		for (const element of elements) {
			const target =
				element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox")
					? (element.parentElement ?? element)
					: element.getAttribute("role") === "combobox"
						? (element.closest('[class*="control"]') ?? element)
						: element;
			if (!(target instanceof HTMLElement)) {
				continue;
			}
			target.style.outline = state === "filled" ? `2px solid ${FILLED_COLOR}` : state === "review" ? `2px solid ${BRAND}` : state === "glance" ? `2px dashed ${BRAND}` : "";
			target.style.outlineOffset = state === "none" ? "" : "2px";
			if (note) {
				target.title = `Job Radar: ${note}`;
			}
		}
	}

	static #apply(field: FormField, elements: Control[], value: string | null, choices: string[]): boolean {
		const [element] = elements;
		if (!element) {
			return false;
		}
		switch (field.kind) {
			case "text":
			case "email":
			case "tel":
			case "url":
			case "number":
			case "date":
			case "textarea":
				return value !== null && FormFiller.#setText(element as HTMLInputElement | HTMLTextAreaElement, value);
			case "select":
				return value !== null && FormFiller.#setSelect(element as HTMLSelectElement, value);
			case "radio":
				return value !== null && FormFiller.#check(elements as HTMLInputElement[], [value]);
			case "checkbox":
				if (elements.length === 1) {
					const box = elements[0] as HTMLInputElement;
					if (value?.toLowerCase() === "yes" && !box.checked) {
						box.click();
					}
					return value?.toLowerCase() === "yes";
				}
				return FormFiller.#check(elements as HTMLInputElement[], choices.length > 0 ? choices : value ? [value] : []);
			case "combobox":
			case "file":
				return false;
		}
	}

	static #setText(element: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
		const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
		Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, element.maxLength > 0 ? value.slice(0, element.maxLength) : value);
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
		element.dispatchEvent(new Event("blur", { bubbles: true }));
		return true;
	}

	static #setSelect(element: HTMLSelectElement, value: string): boolean {
		const option = [...element.options].find((candidate) => PageDom.clean(candidate.textContent).toLowerCase() === value.toLowerCase());
		if (!option) {
			return false;
		}
		Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, option.value);
		element.dispatchEvent(new Event("change", { bubbles: true }));
		return true;
	}

	static #check(members: HTMLInputElement[], wanted: string[]): boolean {
		const targets = wanted.map((choice) => members.find((member) => FieldLabels.ofOption(member).toLowerCase() === choice.toLowerCase()));
		if (targets.some((target) => target === undefined)) {
			return false;
		}
		for (const target of targets) {
			if (target && !target.checked) {
				target.click();
			}
		}
		return targets.length > 0;
	}
}
