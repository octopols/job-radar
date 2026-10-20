import type { AutoApplyOutcome } from "./application.ts";
import type { PostingWorkMode } from "./posting.ts";

export interface Score {
	score: number;
	reasons: string[];
	cautions: string[];
}

export interface Match extends Score {
	postingId: string;
	boardKey: string;
	company: string;
	title: string;
	location: string;
	remote: boolean;
	workMode: PostingWorkMode;
	url: string;
	postedAt: number | null;
}

export type MatchStatus = "new" | "saved" | "applied" | "interviewing" | "offer" | "rejected" | "hidden";

export const PIPELINE_STATUSES: readonly MatchStatus[] = ["applied", "interviewing", "offer", "rejected"];

export interface SeekerMatch extends Match {
	autoApply: { outcome: AutoApplyOutcome; note: string | null } | null;
	status: MatchStatus;
	foundAt: number;
	live: boolean;
	explanation: string | null;
	appliedAt: number | null;
	notes: string;
	followUpAt: number | null;
	followUpDue: boolean;
}

export interface MatchesAdded {
	matches: SeekerMatch[];
	live: boolean;
}
