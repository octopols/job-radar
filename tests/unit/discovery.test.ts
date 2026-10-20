import { describe, expect, test } from "vitest";
import { BoardUrlParser } from "../../src/backend/services/board-url-parser.ts";
import { HackerNewsSource } from "../../src/backend/sources/feed-sources.ts";
import { PostingText } from "../../src/backend/sources/posting-text.ts";

describe("BoardUrlParser", () => {
	test.each([
		["https://boards.greenhouse.io/embed/job_board?for=stripe", { ats: "greenhouse", slug: "stripe" }],
		["https://job-boards.greenhouse.io/anthropic/jobs/123", { ats: "greenhouse", slug: "anthropic" }],
		["https://jobs.lever.co/palantir/abc", { ats: "lever", slug: "palantir" }],
		["https://jobs.ashbyhq.com/notion", { ats: "ashby", slug: "notion" }],
		["https://jobs.smartrecruiters.com/BoschGroup/744000156523049", { ats: "smartrecruiters", slug: "BoschGroup" }],
		["https://bunq.recruitee.com/o/head-of-product", { ats: "recruitee", slug: "bunq" }],
		["https://apply.workable.com/huggingface/", { ats: "workable", slug: "huggingface" }],
		["https://personio.jobs.personio.de/job/1834171", { ats: "personio", slug: "personio" }],
	])("finds the board in %s", (url, expected) => {
		expect(BoardUrlParser.find(url)).toEqual(expected);
	});

	test("finds a board link inside a careers page", () => {
		const page = `<html><a href="/about">About</a><iframe src="https://boards.greenhouse.io/embed/job_board?for=razorpay"></iframe></html>`;
		expect(BoardUrlParser.find(page)).toEqual({ ats: "greenhouse", slug: "razorpay" });
	});

	test("names unsupported hiring systems instead of guessing", () => {
		expect(BoardUrlParser.find("https://adobe.wd5.myworkdayjobs.com/external")).toBeNull();
		expect(BoardUrlParser.unsupportedProvider("https://adobe.wd5.myworkdayjobs.com/external")).toBe("Workday");
	});
});

describe("HackerNewsSource.parse", () => {
	test("reads company, role and location from the conventional first line", () => {
		const posting = HackerNewsSource.parse(
			1,
			"Shepherd (Series B) | ONSITE | San Francisco, CA &amp; New York City, NY | Senior Backend Engineer<p>We build insurance.</p>",
			"2026-10-01T15:02:51Z",
		);
		expect(posting).toMatchObject({ company: "Shepherd (Series B)", title: "Senior Backend Engineer", workMode: "onsite" });
		expect(posting?.location).toContain("San Francisco");
	});

	test("takes a bracketed location off the company name", () => {
		const posting = HackerNewsSource.parse(2, "PrairieLearn (Remote US) — Full-Stack Software Engineer — TypeScript &#x2F; Postgres", null);
		expect(posting).toMatchObject({ company: "PrairieLearn", location: "Remote US", workMode: "remote" });
	});

	test("skips replies that are not job posts", () => {
		expect(HackerNewsSource.parse(3, "Is this role still open?", null)).toBeNull();
	});
});

describe("PostingText.workMode", () => {
	test("prefers the provider's declared workplace over location keywords", () => {
		expect(PostingText.workMode("on_site", "Remote friendly office").workMode).toBe("onsite");
		expect(PostingText.workMode(null, "Remote - Canada").workMode).toBe("remote");
		expect(PostingText.workMode("Unspecified", "Berlin (Hybrid)").workMode).toBe("hybrid");
		expect(PostingText.workMode(null, "Berlin").workMode).toBe("unknown");
	});
});
