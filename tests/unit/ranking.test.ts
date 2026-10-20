import { describe, expect, test } from "vitest";
import { MatchRanker } from "../../src/shared/ranking.ts";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const DAY = 86_400_000;

function match(company: string, score: number, ageDays: number | null) {
	return { company, score, postedAt: ageDays === null ? null : NOW - ageDays * DAY, title: `${company} ${score}` };
}

describe("MatchRanker", () => {
	const ranker = new MatchRanker(NOW);

	test("ranks a fresh strong match above a stale slightly stronger one", () => {
		const ranked = ranker.rank([match("Okta", 86, 240), match("Stripe", 82, 2)]);
		expect(ranked.map((item) => item.company)).toEqual(["Stripe", "Okta"]);
	});

	test("spreads companies so one board cannot flood the top of the feed", () => {
		const okta = [100, 100, 100, 100, 94].map((score) => match("Okta", score, 30));
		const others = [match("Stripe", 92, 30), match("Notion", 90, 30)];
		const topFive = ranker.rank([...okta, ...others]).slice(0, 5);
		expect(topFive.filter((item) => item.company === "Okta").length).toBeLessThanOrEqual(3);
		expect(topFive.map((item) => item.company)).toContain("Stripe");
		expect(topFive.map((item) => item.company)).toContain("Notion");
	});

	test("keeps every match and never invents new ones", () => {
		const input = [match("A", 70, 1), match("A", 60, null), match("B", 90, 400)];
		expect(ranker.rank(input)).toHaveLength(3);
	});

	test("marks postings from the last three days as fresh", () => {
		expect(ranker.isFresh(match("A", 80, 2))).toBe(true);
		expect(ranker.isFresh(match("A", 80, 5))).toBe(false);
		expect(ranker.isFresh(match("A", 80, null))).toBe(false);
	});
});
