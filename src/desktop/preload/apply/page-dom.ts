import type { Point } from "../../../shared/ipc/apply.ts";

export const FIELD_ATTRIBUTE = "data-job-radar-field";
export const PLACEHOLDER_OPTION = /^(select|choose|please select|--|—)/i;
const SUBMIT_TEXT = /submit|send application|apply now|complete application/i;
export const BRAND = "#c2410c";

export type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const MAX_TEXT_LENGTH = 300;

export class PageDom {
	static clean(text: string | null | undefined): string {
		return (text ?? "")
			.replace(/\s+/g, " ")
			.replace(/\s*\*\s*$/, "")
			.trim()
			.slice(0, MAX_TEXT_LENGTH);
	}

	static center(element: Element): Point {
		element.scrollIntoView({ block: "center", behavior: "instant" });
		const box = element.getBoundingClientRect();
		return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
	}

	static isSubmitButton(element: Element | null | undefined): boolean {
		if (!element) {
			return false;
		}
		const text = `${element.textContent ?? ""} ${(element as HTMLInputElement).value ?? ""}`;
		return element.getAttribute("type") === "submit" || SUBMIT_TEXT.test(text);
	}
}
