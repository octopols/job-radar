import type { Match } from "./types/match.ts";

const DAY_MS = 86_400_000;
const REPEAT_COMPANY_PENALTY = 8;

const FRESHNESS_STEPS: { maxAgeDays: number; boost: number }[] = [
	{ maxAgeDays: 3, boost: 10 },
	{ maxAgeDays: 14, boost: 6 },
	{ maxAgeDays: 30, boost: 3 },
	{ maxAgeDays: 120, boost: 0 },
];
const STALE_PENALTY = -10;
const FRESH_DAYS = 3;

export class MatchRanker {
	readonly #now: number;

	constructor(now: number) {
		this.#now = now;
	}

	isFresh(match: Pick<Match, "postedAt">): boolean {
		return match.postedAt !== null && this.#now - match.postedAt <= FRESH_DAYS * DAY_MS;
	}

	freshnessBoost(match: Pick<Match, "postedAt">): number {
		if (match.postedAt === null) {
			return 0;
		}
		const ageDays = (this.#now - match.postedAt) / DAY_MS;
		return FRESHNESS_STEPS.find((step) => ageDays <= step.maxAgeDays)?.boost ?? STALE_PENALTY;
	}

	rank<T extends Pick<Match, "score" | "postedAt" | "company">>(matches: readonly T[]): T[] {
		const remaining = matches.map((match) => ({ match, relevance: match.score + this.freshnessBoost(match) }));
		const picksPerCompany = new Map<string, number>();
		const ranked: T[] = [];

		while (remaining.length > 0) {
			let bestIndex = 0;
			let bestValue = Number.NEGATIVE_INFINITY;
			for (const [index, candidate] of remaining.entries()) {
				const value = candidate.relevance - REPEAT_COMPANY_PENALTY * (picksPerCompany.get(candidate.match.company) ?? 0);
				if (value > bestValue) {
					bestValue = value;
					bestIndex = index;
				}
			}
			const [picked] = remaining.splice(bestIndex, 1);
			if (picked) {
				ranked.push(picked.match);
				picksPerCompany.set(picked.match.company, (picksPerCompany.get(picked.match.company) ?? 0) + 1);
			}
		}
		return ranked;
	}
}
