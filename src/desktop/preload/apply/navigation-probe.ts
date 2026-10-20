import type { NavigationCandidate, Point } from "../../../shared/ipc/apply.ts";
import { PageDom } from "./page-dom.ts";

const CANDIDATE_ATTRIBUTE = "data-job-radar-nav";
const APPLY_TEXT = /\bapply\b|start (your )?application|i'?m interested/i;
const APPLY_HREF = /apply|application|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|recruitee\.com|myworkdayjobs\.com/i;
const APPLY_TEXT_SCORE = 3;
const APPLY_HREF_SCORE = 2;
const MAX_CANDIDATES = 25;
const MAX_CANDIDATE_TEXT = 80;

export class NavigationProbe {
	static candidates(): NavigationCandidate[] {
		document.querySelectorAll(`[${CANDIDATE_ATTRIBUTE}]`).forEach((element) => element.removeAttribute(CANDIDATE_ATTRIBUTE));
		const elements = [...document.querySelectorAll<HTMLElement>("a[href], button, [role='button'], input[type='button'], input[type='submit']")].filter((element) => {
			const text = NavigationProbe.#text(element);
			return element.offsetParent !== null && text.length > 0 && text.length <= MAX_CANDIDATE_TEXT;
		});
		const scored = elements.map((element) => {
			const text = NavigationProbe.#text(element);
			const href = element instanceof HTMLAnchorElement ? element.href : null;
			const score = (APPLY_TEXT.test(text) ? APPLY_TEXT_SCORE : 0) + (href && APPLY_HREF.test(href) ? APPLY_HREF_SCORE : 0);
			return { element, text, href, score };
		});
		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, MAX_CANDIDATES).map(({ element, text, href, score }, index) => {
			element.setAttribute(CANDIDATE_ATTRIBUTE, String(index));
			return { index, text, href, score };
		});
	}

	static locate(index: number): Point | null {
		const element = document.querySelector(`[${CANDIDATE_ATTRIBUTE}="${index}"]`);
		return element ? PageDom.center(element) : null;
	}

	static #text(element: HTMLElement): string {
		return PageDom.clean(element.innerText || (element as HTMLInputElement).value || element.getAttribute("aria-label"));
	}
}
