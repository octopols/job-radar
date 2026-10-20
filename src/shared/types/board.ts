export type Ats = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "recruitee" | "workable" | "personio" | "remoteok" | "hackernews";

export const ATS_LIST: readonly Ats[] = ["greenhouse", "lever", "ashby", "smartrecruiters", "recruitee", "workable", "personio", "remoteok", "hackernews"];

export interface BoardRef {
	ats: Ats;
	slug: string;
}

export interface BoardStatus {
	key: string;
	ats: Ats;
	slug: string;
	company: string;
	openJobs: number;
	followers: number;
	polls: number;
	lastPolledAt: number | null;
	nextPollAt: number | null;
	lastNewJobs: number;
	lastError: string | null;
}

export interface Overview {
	boards: BoardStatus[];
	seekers: number;
	jobsIndexed: number;
	pollsTotal: number;
}

export interface CatalogBoard {
	ats: Ats;
	slug: string;
	company: string;
}

export interface CatalogFeed {
	ats: Ats;
	slug: string;
	name: string;
	description: string;
}

export interface DiscoveredBoard {
	key: string;
	ats: Ats;
	slug: string;
	company: string;
	openJobs: number;
}

export type DiscoveryResult =
	| { status: "found"; board: DiscoveredBoard; method: "link" | "lookup" | "ai" }
	| { status: "unsupported"; company: string; provider: string; careersUrl: string | null }
	| { status: "not_found"; company: string };
