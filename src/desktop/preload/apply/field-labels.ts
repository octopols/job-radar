import { type Control, PageDom } from "./page-dom.ts";

const GENERIC_LABEL = /^(attach|upload|choose( a)? file|browse|select( a)? file|enter manually)$/i;
const CONTAINER_SEARCH_DEPTH = 4;

export class FieldLabels {
	static of(element: Element): string {
		const control = element as Control;
		const fromLabel = "labels" in control && control.labels?.[0] ? control.labels[0].textContent : null;
		const labelledBy = element.getAttribute("aria-labelledby");
		const fromAria = labelledBy
			? labelledBy
					.split(/\s+/)
					.map((id) => document.getElementById(id)?.textContent ?? "")
					.join(" ")
			: null;
		const candidates = [fromLabel, fromAria, element.getAttribute("aria-label"), FieldLabels.#fromContainer(element), element.getAttribute("placeholder"), element.getAttribute("name"), element.id];
		return PageDom.clean(candidates.map((candidate) => PageDom.clean(candidate)).find((candidate) => candidate && !GENERIC_LABEL.test(candidate)));
	}

	static ofGroup(members: Element[]): string {
		const first = members[0];
		const legend = first?.closest("fieldset")?.querySelector("legend")?.textContent;
		const group = first?.closest('[role="radiogroup"], [role="group"]');
		const groupLabel = group?.getAttribute("aria-label") ?? (group?.getAttribute("aria-labelledby") ? document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent : null);
		return PageDom.clean(legend || groupLabel || (first ? FieldLabels.#fromContainer(first.parentElement ?? first) : ""));
	}

	static ofOption(element: HTMLInputElement): string {
		return PageDom.clean(element.labels?.[0]?.textContent || element.getAttribute("aria-label") || element.value);
	}

	static #fromContainer(element: Element): string {
		let node: Element | null = element.parentElement;
		for (let depth = 0; node && depth < CONTAINER_SEARCH_DEPTH; depth++, node = node.parentElement) {
			const candidate = [...node.querySelectorAll("label, legend, [class*='label'], [class*='question'], [class*='title']")].find(
				(label) => !label.contains(element) && PageDom.clean(label.textContent) && !GENERIC_LABEL.test(PageDom.clean(label.textContent)),
			);
			if (candidate) {
				return candidate.textContent ?? "";
			}
		}
		return "";
	}
}
