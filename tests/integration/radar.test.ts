import { setupTest } from "rivetkit/test";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { SeekerMatch } from "../../src/shared/types/match.ts";
import { registry } from "../../src/backend/registry.ts";
import { FIXTURE_BOARD_PORT } from "../support/ports.ts";
import { FixtureBoard } from "../support/fixture-board.ts";
import { BACKEND_PROFILE, nextSnapshot, syncedWith } from "../support/seeker-session.ts";

const board = new FixtureBoard();

beforeAll(() => board.listen(FIXTURE_BOARD_PORT));
afterAll(() => board.close());

test("a board backfills matches on follow and pushes new postings live to followers", async (ctx) => {
	board.jobs = [
		FixtureBoard.job(1, "Backend Engineer", "Bangalore, India", "Go services on Kafka and PostgreSQL."),
		FixtureBoard.job(2, "Account Executive", "London", "Sell to enterprises."),
	];
	const boardKey = FixtureBoard.uniqueKey();
	const { client } = await setupTest(ctx, registry);
	const seeker = client.seeker.getOrCreate([`seeker-${crypto.randomUUID()}`]).connect();
	const synced = nextSnapshot(seeker, syncedWith(boardKey));

	await seeker.updateProfile(BACKEND_PROFILE);
	await seeker.follow([boardKey]);
	const snapshot = await synced;

	expect(snapshot.boardErrors).toEqual({});
	const backfill = await seeker.matches();
	expect(backfill.map((match) => match.title)).toEqual(["Backend Engineer"]);
	expect(backfill[0]?.live).toBe(false);

	const liveMatch = new Promise<{ matches: SeekerMatch[]; live: boolean }>((resolve) => {
		seeker.on("matchesAdded", resolve);
	});
	board.jobs = [...board.jobs, FixtureBoard.job(3, "Senior Backend Engineer", "Remote", "Kafka streams in Go.")];
	const status = await client.board.get([boardKey]).pollNow();

	expect(status.lastNewJobs).toBe(1);
	expect(status.openJobs).toBe(3);
	const pushed = await liveMatch;
	expect(pushed.live).toBe(true);
	expect(pushed.matches.map((match) => match.title)).toEqual(["Senior Backend Engineer"]);

	board.jobs = board.jobs.filter((fixture) => fixture.id !== 2);
	const afterClose = await client.board.get([boardKey]).pollNow();
	expect(afterClose.openJobs).toBe(2);
	expect(afterClose.lastNewJobs).toBe(0);

	await seeker.unfollow(boardKey);
	const dormant = await client.board.get([boardKey]).status();
	expect(dormant.followers).toBe(0);
	expect(dormant.nextPollAt).toBeNull();

	await client.board.get([boardKey]).retire();
	await seeker.dispose();
});

test("following a board that does not exist reports an error instead of hanging", async (ctx) => {
	const missingKey = `greenhouse:nobody-${crypto.randomUUID().slice(0, 8)}`;
	const { client } = await setupTest(ctx, registry);
	const seeker = client.seeker.getOrCreate([`seeker-${crypto.randomUUID()}`]).connect();
	const settled = nextSnapshot(seeker, syncedWith(missingKey));

	await seeker.updateProfile(BACKEND_PROFILE);
	await seeker.follow([missingKey]);
	const snapshot = await settled;

	expect(snapshot.boardErrors[missingKey]).toContain("No public job board");
	const status = await client.board.get([missingKey]).status();
	expect(status.followers).toBe(0);
	expect(status.nextPollAt).toBeNull();

	await client.board.get([missingKey]).retire();
	await seeker.dispose();
});
