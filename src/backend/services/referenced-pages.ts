import type { FormField, ReferencedPage } from "../../shared/types/application.ts";
import { PostingText } from "../sources/posting-text.ts";

const URL_PATTERN = /https?:\/\/[^\s)"'<>]+/g;
const MAX_PAGES = 3;
const PAGE_TEXT_LIMIT = 4_000;
const FETCH_TIMEOUT_MS = 8_000;

export class ReferencedPages {
	static async forFields(fields: FormField[]): Promise<ReferencedPage[]> {
		const urls = [...new Set(fields.flatMap((field) => field.label.match(URL_PATTERN) ?? []))].slice(0, MAX_PAGES);
		const pages = await Promise.all(urls.map((url) => ReferencedPages.#read(url.replace(/[.,;]+$/, ""))));
		return pages.filter((page): page is ReferencedPage => page !== null);
	}

	static async #read(url: string): Promise<ReferencedPage | null> {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" });
			if (!response.ok) {
				return null;
			}
			const text = PostingText.fromHtml(await response.text()).slice(0, PAGE_TEXT_LIMIT);
			return text ? { url, text } : null;
		} catch {
			return null;
		}
	}
}
