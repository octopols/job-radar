import { Catalog } from "@shared/catalog.ts";
import { MatchRanker } from "@shared/ranking.ts";
import { PIPELINE_STATUSES, type SeekerMatch } from "@shared/types/match.ts";
import type { Profile } from "@shared/types/profile.ts";
import { FIT_LEVELS, type FitLevel, SENIORITY_LABELS } from "@/lib/format.ts";

export type FeedTab = "new" | "saved" | "applications";
export type FeedSort = "recommended" | "fit" | "posted";
export type PostedWithin = "any" | "week" | "month";

export interface FeedFilters {
	fit: FitLevel;
	remoteOnly: boolean;
	postedWithin: PostedWithin;
	hideWarnings: boolean;
}

export type FeedLists = Record<FeedTab, SeekerMatch[]>;

const DAY_MS = 86_400_000;
const POSTED_WITHIN_MS: Record<PostedWithin, number> = { any: Number.POSITIVE_INFINITY, week: 7 * DAY_MS, month: 30 * DAY_MS };

export const DEFAULT_FILTERS: FeedFilters = { fit: "good", remoteOnly: false, postedWithin: "any", hideWarnings: false };

export class FeedView {
	static matchKey(match: SeekerMatch): string {
		return `${match.boardKey}/${match.postingId}`;
	}

	static lists(matches: SeekerMatch[], filters: FeedFilters, search: string, isWaiting: (match: SeekerMatch) => boolean): FeedLists {
		const query = search.trim().toLowerCase();
		const now = Date.now();
		const fitsSearch = (match: SeekerMatch) => !query || `${match.title} ${match.company} ${match.location}`.toLowerCase().includes(query);
		return {
			new: matches.filter((match) => match.status === "new" && !isWaiting(match) && FeedView.#passesFilters(match, filters, now) && fitsSearch(match)),
			saved: matches.filter((match) => match.status === "saved" && fitsSearch(match)),
			applications: matches.filter((match) => PIPELINE_STATUSES.includes(match.status) && fitsSearch(match)),
		};
	}

	static ordered(lists: FeedLists, tab: FeedTab, sort: FeedSort, ranker: MatchRanker): SeekerMatch[] {
		if (tab === "applications") {
			return [...lists.applications].sort(FeedView.#byApplicationUrgency);
		}
		if (sort === "recommended") {
			return ranker.rank(lists[tab]);
		}
		return [...lists[tab]].sort((a, b) => (sort === "fit" ? b.score - a.score : (b.postedAt ?? 0) - (a.postedAt ?? 0)));
	}

	static activeFilterCount(filters: FeedFilters): number {
		return (Object.keys(DEFAULT_FILTERS) as (keyof FeedFilters)[]).filter((key) => filters[key] !== DEFAULT_FILTERS[key]).length;
	}

	static postedThisWeek(matches: SeekerMatch[]): number {
		return matches.filter((match) => match.postedAt !== null && Date.now() - match.postedAt <= POSTED_WITHIN_MS.week).length;
	}

	static searchSummary(profile: Profile): string {
		const role = profile.targetTitles[0] ?? "Any role";
		const extraRoles = profile.targetTitles.length > 1 ? ` +${profile.targetTitles.length - 1}` : "";
		const remoteOnly = profile.workModes.length === 1 && profile.workModes[0] === "remote";
		const places = remoteOnly ? "Remote" : [profile.locations.slice(0, 2).join(", "), profile.workModes.includes("remote") ? "remote" : ""].filter(Boolean).join(" or ");
		const level = SENIORITY_LABELS[profile.seniority];
		const roleNamesLevel = role.toLowerCase().includes(level.replace(/[^a-z]/gi, "").toLowerCase());
		return `${roleNamesLevel ? "" : `${level} `}${role}${extraRoles} · ${places || "Anywhere"}`;
	}

	static sourcesSummary(follows: string[]): string {
		const feeds = follows.filter((boardKey) => Catalog.feedKeys().includes(boardKey)).length;
		const companies = follows.length - feeds;
		const companyText = `${companies} ${companies === 1 ? "company" : "companies"}`;
		return feeds > 0 ? `${companyText} + ${feeds} ${feeds === 1 ? "feed" : "feeds"}` : companyText;
	}

	static #passesFilters(match: SeekerMatch, filters: FeedFilters, now: number): boolean {
		const postedRecently = filters.postedWithin === "any" || (match.postedAt !== null && now - match.postedAt <= POSTED_WITHIN_MS[filters.postedWithin]);
		return (
			match.score >= FIT_LEVELS[filters.fit].minScore &&
			(!filters.remoteOnly || match.workMode === "remote") &&
			postedRecently &&
			(!filters.hideWarnings || match.cautions.length === 0)
		);
	}

	static #byApplicationUrgency(a: SeekerMatch, b: SeekerMatch): number {
		return (
			Number(b.followUpDue) - Number(a.followUpDue) ||
			PIPELINE_STATUSES.indexOf(a.status) - PIPELINE_STATUSES.indexOf(b.status) ||
			(b.appliedAt ?? 0) - (a.appliedAt ?? 0)
		);
	}
}
