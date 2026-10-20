export type WorkMode = "remote" | "hybrid" | "onsite";

export const WORK_MODES: readonly WorkMode[] = ["remote", "hybrid", "onsite"];

export type PostingWorkMode = WorkMode | "unknown";

export interface Posting {
	id: string;
	title: string;
	company?: string;
	location: string;
	remote: boolean;
	workMode: PostingWorkMode;
	department: string | null;
	url: string;
	postedAt: number | null;
	text: string;
}
