import type { FormField, FormFieldKind } from "../../../shared/types/application.ts";
import { FieldLabels } from "./field-labels.ts";
import { FieldLocator } from "./field-locator.ts";
import { type Control, PageDom, PLACEHOLDER_OPTION } from "./page-dom.ts";

const IGNORED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "search", "password"]);
const INPUT_KINDS: Record<string, FormFieldKind> = { email: "email", tel: "tel", url: "url", number: "number", date: "date", file: "file" };
const OPTIONS_SEARCH_DEPTH = 6;

export class FormScanner {
	static lastScan: FormField[] = [];

	count(): number {
		return [...document.querySelectorAll<Control>("input, textarea, select")].filter(
			(element) => !element.disabled && !(element instanceof HTMLInputElement && IGNORED_INPUT_TYPES.has(element.type.toLowerCase())) && FormScanner.#visible(element),
		).length;
	}

	scan(): FormField[] {
		FieldLocator.clear();
		const fields: FormField[] = [];
		const groups = new Map<string, HTMLInputElement[]>();
		let next = 0;
		const tag = (element: Element) => {
			const id = `f${next++}`;
			FieldLocator.remember(id, [element]);
			return id;
		};

		for (const element of document.querySelectorAll<Control>("input, textarea, select")) {
			if (element.disabled || FormScanner.#isHoneypot(element) || FormScanner.#isValidationProxy(element)) {
				continue;
			}
			if (element instanceof HTMLInputElement) {
				const type = element.type.toLowerCase();
				if (IGNORED_INPUT_TYPES.has(type)) {
					continue;
				}
				if ((type === "radio" || type === "checkbox") && element.name) {
					groups.set(element.name, [...(groups.get(element.name) ?? []), element]);
					continue;
				}
				if (type !== "file" && !FormScanner.#visible(element)) {
					continue;
				}
				if (element.getAttribute("role") === "combobox") {
					if (element.closest(".iti")) {
						continue;
					}
					fields.push(FormScanner.#base(element, tag(element), "combobox"));
					continue;
				}
				fields.push(FormScanner.#base(element, tag(element), INPUT_KINDS[type] ?? "text"));
				continue;
			}
			if (!FormScanner.#visible(element)) {
				continue;
			}
			if (element instanceof HTMLSelectElement) {
				const options = [...element.options].map((option) => PageDom.clean(option.textContent)).filter((text) => text && !PLACEHOLDER_OPTION.test(text));
				fields.push({ ...FormScanner.#base(element, tag(element), "select"), options, multiple: element.multiple });
				continue;
			}
			fields.push(FormScanner.#base(element, tag(element), "textarea"));
		}

		for (const members of groups.values()) {
			const field = FormScanner.#group(members, `f${next}`);
			if (field) {
				next++;
				fields.push(field);
			}
		}
		FormScanner.lastScan = fields;
		return fields;
	}

	static optionsFor(input: Element): HTMLElement[] {
		const id = input.getAttribute("aria-controls") || input.getAttribute("aria-owns");
		const pointedAt = id ? document.getElementById(id) : null;
		if (pointedAt) {
			return [...pointedAt.querySelectorAll<HTMLElement>('[role="option"]')];
		}
		let node: Element | null = input.parentElement;
		for (let depth = 0; node && depth < OPTIONS_SEARCH_DEPTH; depth++, node = node.parentElement) {
			const options = [...node.querySelectorAll<HTMLElement>('[role="option"]')];
			if (options.length > 0) {
				return options;
			}
		}
		return [];
	}

	static #group(members: HTMLInputElement[], id: string): FormField | null {
		const visible = members.filter((member) => FormScanner.#visible(member) || FormScanner.#visible(member.parentElement));
		if (visible.length === 0) {
			return null;
		}
		FieldLocator.remember(id, visible);
		const kind = visible[0]?.type === "radio" ? "radio" : "checkbox";
		const single = kind === "checkbox" && visible.length === 1;
		return {
			id,
			kind,
			label: single ? FieldLabels.ofOption(visible[0] as HTMLInputElement) || FieldLabels.ofGroup(visible) : FieldLabels.ofGroup(visible),
			required: visible.some((member) => member.required || member.getAttribute("aria-required") === "true"),
			options: single ? [] : visible.map((member) => FieldLabels.ofOption(member)),
			multiple: kind === "checkbox" && !single,
			maxLength: null,
		};
	}

	static #base(element: Control, id: string, kind: FormFieldKind): FormField {
		const label = FieldLabels.of(element);
		const maxLength = "maxLength" in element && element.maxLength > 0 ? element.maxLength : null;
		const required = element.required || element.getAttribute("aria-required") === "true" || /\*\s*$/.test(element.labels?.[0]?.textContent ?? "");
		return { id, kind, label, required, options: [], multiple: false, maxLength };
	}

	static #visible(element: Element | null): boolean {
		if (!(element instanceof HTMLElement)) {
			return false;
		}
		const style = getComputedStyle(element);
		return element.offsetParent !== null && style.visibility !== "hidden" && style.display !== "none";
	}

	static #isValidationProxy(element: Control): boolean {
		if (element instanceof HTMLInputElement && element.type === "file") {
			return false;
		}
		const box = element.getBoundingClientRect();
		return element.getAttribute("aria-hidden") === "true" || (element.tabIndex < 0 && (box.width < 4 || box.height < 4));
	}

	static #isHoneypot(element: Element): boolean {
		const name = `${element.getAttribute("name") ?? ""} ${element.id}`.toLowerCase();
		return /honeypot|hp_|bot_field|leave.?blank/.test(name);
	}
}
