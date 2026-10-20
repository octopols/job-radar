import { type Control, FIELD_ATTRIBUTE } from "./page-dom.ts";

export class FieldLocator {
	static readonly #where = new Map<string, { id: string; name: string | null }[]>();

	static remember(fieldId: string, elements: Element[]): void {
		FieldLocator.#where.set(
			fieldId,
			elements.map((element) => ({ id: element.id, name: element.getAttribute("name") })),
		);
		for (const element of elements) {
			element.setAttribute(FIELD_ATTRIBUTE, fieldId);
		}
	}

	static find(fieldId: string): Control[] {
		const marked = [...document.querySelectorAll<Control>(`[${FIELD_ATTRIBUTE}="${fieldId}"]`)];
		if (marked.length > 0) {
			return marked;
		}
		const found = (FieldLocator.#where.get(fieldId) ?? []).flatMap((spot) => {
			if (spot.id) {
				const byId = document.getElementById(spot.id);
				return byId ? [byId as Control] : [];
			}
			return spot.name ? [...document.querySelectorAll<Control>(`[name="${CSS.escape(spot.name)}"]`)] : [];
		});
		const unique = [...new Set(found)];
		for (const element of unique) {
			element.setAttribute(FIELD_ATTRIBUTE, fieldId);
		}
		return unique;
	}

	static clear(): void {
		FieldLocator.#where.clear();
		document.querySelectorAll(`[${FIELD_ATTRIBUTE}]`).forEach((element) => element.removeAttribute(FIELD_ATTRIBUTE));
	}
}
