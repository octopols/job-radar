export const APPLY_IPC = {
	count: "apply:count",
	scan: "apply:scan",
	mark: "apply:mark",
	locate: "apply:locate",
	options: "apply:options",
	locateOption: "apply:locate-option",
	shown: "apply:shown",
	markOutcomes: "apply:mark-outcomes",
	navigationCandidates: "apply:navigation-candidates",
	locateCandidate: "apply:locate-candidate",
	locateSubmit: "apply:locate-submit",
	challenge: "apply:challenge",
	rejected: "apply:rejected",
	fill: "apply:fill",
	reply: "apply:reply",
	banner: "apply:banner",
	fillRequested: "apply:fill-requested",
	submitClicked: "apply:submit-clicked",
	submitted: "apply:submitted",
} as const;

export interface Point {
	x: number;
	y: number;
}

export interface OptionMatch {
	point: Point;
	text: string;
	isTopOption: boolean;
}

export interface NavigationCandidate {
	index: number;
	text: string;
	href: string | null;
	score: number;
}

export interface FieldOutcome {
	fieldId: string;
	label: string;
	filled: boolean;
	note: string | null;
}

export interface NeedsYouItem {
	fieldId: string;
	label: string;
	note: string;
	kind: "answer" | "glance";
}

export interface ApplyBannerState {
	title: string;
	detail: string;
	busy: boolean;
	action: string | null;
	needsYou: NeedsYouItem[];
}

export interface ApplicationRequest {
	seekerKey: string;
	boardKey: string;
	postingId: string;
	url: string;
	title: string;
	company: string;
}

export type ApplicationPhase = "opening" | "reading" | "drafting" | "ready" | "no-form" | "submitted" | "failed";

export interface ApplicationStatus {
	boardKey: string;
	postingId: string;
	phase: ApplicationPhase;
	filled: number;
	needsYou: number;
	error: string | null;
}
