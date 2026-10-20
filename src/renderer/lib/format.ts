import { BoardKey } from "@shared/board-key.ts";
import { Catalog, PROVIDER_LABELS } from "@shared/catalog.ts";
import { GOOD_FIT_SCORE } from "@shared/constants.ts";
import type { Match } from "@shared/types/match.ts";
import type { PostingWorkMode } from "@shared/types/posting.ts";
import type { Seniority } from "@shared/types/profile.ts";

export type FitLevel = "strong" | "good" | "stretch";

export const FIT_LEVELS: Record<FitLevel, { label: string; minScore: number; dot: string; text: string }> = {
	strong: { label: "Strong fit", minScore: 85, dot: "bg-success", text: "text-success" },
	good: { label: "Good fit", minScore: GOOD_FIT_SCORE, dot: "bg-primary", text: "text-primary" },
	stretch: { label: "Stretch", minScore: 0, dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
	intern: "Intern",
	junior: "Junior",
	mid: "Mid-level",
	senior: "Senior",
	staff: "Staff+",
};

const WORK_MODE_LABELS: Record<PostingWorkMode, string | null> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unknown: null };

export class TimeFormat {
	static relative(timestamp: number): string {
		const seconds = Math.round((timestamp - Date.now()) / 1000);
		const absolute = Math.abs(seconds);
		const text =
			absolute < 60
				? `${absolute}s`
				: absolute < 3600
					? `${Math.round(absolute / 60)}m`
					: absolute < 172_800
						? `${Math.round(absolute / 3600)}h`
						: absolute < 5_184_000
							? `${Math.round(absolute / 86_400)}d`
							: `${Math.round(absolute / 2_592_000)}mo`;
		return seconds >= 0 ? `in ${text}` : `${text} ago`;
	}
}

export class JobFormat {
	static fitLevel(score: number): FitLevel {
		if (score >= FIT_LEVELS.strong.minScore) {
			return "strong";
		}
		return score >= FIT_LEVELS.good.minScore ? "good" : "stretch";
	}

	static workMode(mode: PostingWorkMode): string | null {
		return WORK_MODE_LABELS[mode];
	}

	static summary(match: Pick<Match, "reasons" | "cautions">): { text: string; caution: boolean } | null {
		const caution = match.cautions[0];
		if (caution) {
			return { text: caution, caution: true };
		}
		const reason = match.reasons[0];
		return reason ? { text: reason, caution: false } : null;
	}

	static place(match: Pick<Match, "location" | "workMode">): string {
		const mode = JobFormat.workMode(match.workMode);
		const location = match.location
			.replace(/\bremote\b[\s,-]*/gi, "")
			.replace(/^\((.*)\)$/, "$1")
			.replace(/\(\s*\)/g, "")
			.trim();
		return [location, mode].filter(Boolean).join(" · ") || "Location not listed";
	}

	static sourceCredit(boardKey: string): string | null {
		const ats = BoardKey.ats(boardKey);
		return Catalog.isFeed(ats) ? `via ${PROVIDER_LABELS[ats]}` : null;
	}
}
