import { describe, expect, test } from "vitest";
import { ProfileMigration } from "../../src/backend/matching/profile-migration.ts";
import { MatchScorer } from "../../src/backend/matching/scorer.ts";
import { GOOD_FIT_SCORE } from "../../src/shared/constants.ts";
import { CountryResolver } from "../../src/shared/geo.ts";
import type { Posting } from "../../src/shared/types/posting.ts";
import type { Profile } from "../../src/shared/types/profile.ts";

const profile: Profile = {
	headline: "Backend engineer",
	seniority: "mid",
	yearsExperience: 4,
	targetTitles: ["Backend Engineer", "Software Engineer, Infrastructure"],
	skills: ["Go", "Kafka", "PostgreSQL", "Kubernetes", "TypeScript", "C++"],
	locations: ["Bangalore", "India"],
	workModes: ["remote", "hybrid", "onsite"],
	openToRelocation: false,
	workCountries: ["India"],
	excludeKeywords: ["manager"],
};

function posting(overrides: Partial<Posting>): Posting {
	return {
		id: "1",
		title: "Backend Engineer",
		location: "Bangalore, India",
		remote: false,
		workMode: "unknown",
		department: "Engineering",
		url: "https://example.com/1",
		postedAt: null,
		text: "We use Go, Kafka and PostgreSQL on Kubernetes.",
		...overrides,
	};
}

function remote(location: string): Partial<Posting> {
	return { location, remote: true, workMode: "remote" };
}

describe("MatchScorer", () => {
	const scorer = new MatchScorer(profile);
	const score = (job: Posting) => scorer.score(job);

	test("scores a strong fit highly and explains why without cautions", () => {
		const result = score(posting({}));
		expect(result.score).toBeGreaterThanOrEqual(80);
		expect(result.reasons).toContain('Matches your target role "Backend Engineer"');
		expect(result.reasons[0]).toBe("Uses Go, Kafka, PostgreSQL +1");
		expect(result.cautions).toEqual([]);
	});

	test("drops excluded titles to zero", () => {
		const result = score(posting({ title: "Engineering Manager, Backend" }));
		expect(result.score).toBe(0);
		expect(result.cautions[0]).toContain("manager");
	});

	test("penalizes a seniority gap of two levels", () => {
		const strong = score(posting({})).score;
		const staff = score(posting({ title: "Staff Backend Engineer" }));
		expect(staff.score).toBeLessThan(strong - 30);
		expect(staff.cautions).toContain("Looks staff-level or above");
	});

	test("penalizes titles from a different job family", () => {
		const backend = score(posting({ title: "Senior Software Engineer" }));
		const tester = score(posting({ title: "Senior Software Engineer in Test (SET)" }));
		expect(tester.cautions).toContain("Different kind of role (testing)");
		expect(tester.score).toBeLessThan(backend.score - 25);
	});

	test("does not penalize a job family the seeker targets", () => {
		const qaScorer = new MatchScorer({ ...profile, targetTitles: ["QA Engineer", "Software Engineer in Test"] });
		expect(qaScorer.score(posting({ title: "Senior QA Engineer" })).cautions.join(" ")).not.toContain("Different kind of role");
	});

	test("does not penalize team suffixes but does penalize extra core words", () => {
		const plain = score(posting({ title: "Backend Engineer" })).score;
		expect(score(posting({ title: "Backend Engineer, Payments" })).score).toBe(plain);
		expect(score(posting({ title: "Backend Firmware Engineer" })).score).toBeLessThan(plain);
	});

	test("treats region-restricted remote roles as a weaker fit", () => {
		const global = score(posting(remote("Remote, Global")));
		const emea = score(posting(remote("Remote - EMEA")));
		const india = score(posting(remote("Remote - India")));
		expect(emea.cautions).toContain("Remote, but only in EMEA");
		expect(emea.score).toBeLessThan(global.score);
		expect(india.score).toBe(global.score);
	});

	test("treats country-bound remote roles as needing authorization in that country", () => {
		const usRemote = score(posting(remote("Remote - United States")));
		expect(usRemote.score).toBeLessThan(GOOD_FIT_SCORE);
		expect(usRemote.cautions.join(" ")).toContain("Needs a work visa for United States");
		const usCitizen = new MatchScorer({ ...profile, workCountries: ["USA"] }).score(posting(remote("Remote - United States")));
		expect(usCitizen.cautions).toEqual([]);
	});

	test("flags work modes the seeker did not choose", () => {
		const remoteOnly = new MatchScorer({ ...profile, workModes: ["remote"] });
		const office = remoteOnly.score(posting({ workMode: "onsite" }));
		expect(office.cautions).toContain("On-site, which you did not choose");
		expect(office.score).toBeLessThan(remoteOnly.score(posting(remote("Remote"))).score);
	});

	test("softens the location penalty for people open to relocating", () => {
		const elsewhere = posting({ location: "Dublin" });
		const relocating = new MatchScorer({ ...profile, openToRelocation: true }).score(elsewhere);
		expect(relocating.cautions).toContain("Means relocating to Dublin");
		expect(relocating.score).toBeGreaterThan(score(elsewhere).score);
	});

	test("never calls a job in another country a good fit unless sponsorship is confirmed", () => {
		const relocating = new MatchScorer({ ...profile, openToRelocation: true });
		const sanFrancisco = { location: "San Francisco, CA", text: "Go, Kafka, PostgreSQL, Kubernetes, TypeScript and C++." };
		const silent = relocating.score(posting(sanFrancisco));
		expect(silent.score).toBeLessThan(GOOD_FIT_SCORE);
		expect(silent.cautions).toContain("Needs a work visa for United States, and sponsorship isn't mentioned");

		const sponsored = relocating.score(posting({ ...sanFrancisco, text: `${sanFrancisco.text} Visa sponsorship is available.` }));
		expect(sponsored.score).toBeGreaterThanOrEqual(GOOD_FIT_SCORE);
		expect(sponsored.reasons).toContain("Offers visa sponsorship");

		const refused = relocating.score(posting({ ...sanFrancisco, text: `${sanFrancisco.text} We are unable to sponsor work visas.` }));
		expect(refused.cautions[0]).toContain("can't sponsor");
		expect(refused.score).toBeLessThan(silent.score);
	});

	test("does not judge work authorization when the location is unrecognised", () => {
		expect(score(posting({ location: "Atlantis" })).cautions.join(" ")).not.toContain("visa");
	});

	test("matches short skills case-sensitively and symbol skills literally", () => {
		expect(score(posting({ text: "we go to market fast" })).reasons.join(" ")).not.toContain("Go");
		expect(score(posting({ text: "Modern C++ services" })).reasons.join(" ")).toContain("C++");
	});
});

describe("upgradeProfile", () => {
	test("turns the legacy remoteOk flag into work modes", () => {
		const legacy = {
			headline: profile.headline,
			seniority: profile.seniority,
			yearsExperience: profile.yearsExperience,
			targetTitles: profile.targetTitles,
			skills: profile.skills,
			locations: profile.locations,
			excludeKeywords: profile.excludeKeywords,
		};
		expect(ProfileMigration.upgrade({ ...legacy, remoteOk: false }).workModes).toEqual(["hybrid", "onsite"]);
		expect(ProfileMigration.upgrade({ ...legacy, remoteOk: true }).workModes).toEqual(["remote", "hybrid", "onsite"]);
		expect(ProfileMigration.upgrade(profile)).toEqual(profile);
	});
});

describe("CountryResolver", () => {
	test.each([
		["San Francisco, CA", ["United States"]],
		["Remote - United States", ["United States"]],
		["Bengaluru, India", ["India"]],
		["Toronto, ON", ["Canada"]],
		["Menlo Park, CA; London", ["United States", "United Kingdom"]],
		["Remote, Global", []],
		["Atlantis", []],
	])("%s resolves to %j", (location, expected) => {
		expect([...CountryResolver.countries(location)]).toEqual(expected);
	});

	test("does not read the word 'us' in a sentence as a country", () => {
		expect([...CountryResolver.countries("join us remotely")]).toEqual([]);
	});
});

describe("MatchScorer.detectSeniority", () => {
	test.each([
		["Software Engineering Intern", "intern"],
		["Senior Backend Engineer", "senior"],
		["Principal Engineer", "staff"],
		["New Grad Software Engineer", "junior"],
		["Software Engineer", "mid"],
	])("%s is %s", (title, expected) => {
		expect(MatchScorer.detectSeniority(title)).toBe(expected);
	});
});
