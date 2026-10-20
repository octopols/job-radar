import type { PostingWorkMode } from "../../shared/types/posting.ts";

const MAX_TEXT_LENGTH = 6_000;
const REMOTE = /\bremote\b/i;
const HYBRID = /\bhybrid\b/i;
const ON_SITE = /\b(on-?site|in office|in-office)\b/i;
const DECLARED_WORK_MODES = new Map<string, PostingWorkMode>([
	["remote", "remote"],
	["hybrid", "hybrid"],
	["onsite", "onsite"],
	["inoffice", "onsite"],
]);

export class PostingText {
	static workMode(declared: string | null, location: string): { workMode: PostingWorkMode; remote: boolean } {
		const normalized = declared?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
		const declaredMode = DECLARED_WORK_MODES.get(normalized);
		const workMode: PostingWorkMode =
			declaredMode ?? (REMOTE.test(location) ? "remote" : HYBRID.test(location) ? "hybrid" : ON_SITE.test(location) ? "onsite" : "unknown");
		return { workMode, remote: workMode === "remote" };
	}

	static fromHtml(html: string): string {
		return PostingText.truncate(
			PostingText.decodeEntities(PostingText.decodeEntities(html).replace(/<[^>]+>/g, " "))
				.replace(/[ \t ]+/g, " ")
				.replace(/\s*\n\s*/g, "\n")
				.trim(),
		);
	}

	static truncate(text: string): string {
		return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
	}

	static parseTime(value: string | number | null | undefined): number | null {
		if (value === null || value === undefined || value === "") {
			return null;
		}
		const time = typeof value === "number" ? value : Date.parse(value);
		return Number.isNaN(time) ? null : time;
	}

	static joinLocation(parts: readonly (string | null | undefined)[]): string {
		return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part)).join(", ");
	}

	private static decodeEntities(text: string): string {
		return text
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;|&apos;/g, "'")
			.replace(/&nbsp;/g, " ")
			.replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
			.replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
			.replace(/&amp;/g, "&");
	}
}
