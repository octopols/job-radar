import type { Ats, BoardRef } from "../../shared/types/board.ts";

const BOARD_URL_PATTERNS: { ats: Ats; pattern: RegExp }[] = [
	{ ats: "greenhouse", pattern: /(?:boards|job-boards)(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/|embed\/job_board\?for=)?([A-Za-z0-9_-]+)/i },
	{ ats: "lever", pattern: /jobs\.lever\.co\/([A-Za-z0-9_.-]+)/i },
	{ ats: "ashby", pattern: /jobs\.ashbyhq\.com\/([A-Za-z0-9_.%-]+)/i },
	{ ats: "smartrecruiters", pattern: /(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/i },
	{ ats: "recruitee", pattern: /([A-Za-z0-9-]+)\.recruitee\.com/i },
	{ ats: "workable", pattern: /(?:apply\.workable\.com\/|([A-Za-z0-9-]+)\.workable\.com)([A-Za-z0-9_-]+)?/i },
	{ ats: "personio", pattern: /([A-Za-z0-9-]+)\.jobs\.personio\.(?:de|com)/i },
];

const UNSUPPORTED_PROVIDERS: { name: string; pattern: RegExp }[] = [
	{ name: "Workday", pattern: /myworkdayjobs\.com|\.wd\d+\./i },
	{ name: "iCIMS", pattern: /icims\.com/i },
	{ name: "Taleo", pattern: /taleo\.net/i },
	{ name: "SuccessFactors", pattern: /successfactors\.(?:com|eu)|jobs\.sap\.com/i },
	{ name: "Jobvite", pattern: /jobvite\.com/i },
	{ name: "BambooHR", pattern: /bamboohr\.com/i },
	{ name: "Eightfold", pattern: /eightfold\.ai/i },
];

const IGNORED_SLUGS = new Set(["embed", "api", "jobs", "www", "careers", "apply", "j"]);

export class BoardUrlParser {
	static find(text: string): BoardRef | null {
		for (const { ats, pattern } of BOARD_URL_PATTERNS) {
			const match = new RegExp(pattern.source, `${pattern.flags}g`).exec(text);
			const slug = match ? (ats === "workable" ? (match[2] ?? match[1]) : match[1]) : undefined;
			if (slug && !IGNORED_SLUGS.has(slug.toLowerCase())) {
				return { ats, slug: decodeURIComponent(slug) };
			}
		}
		return null;
	}

	static unsupportedProvider(text: string): string | null {
		return UNSUPPORTED_PROVIDERS.find(({ pattern }) => pattern.test(text))?.name ?? null;
	}
}
