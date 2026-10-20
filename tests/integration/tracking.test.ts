import { setupTest } from "rivetkit/test";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { SeekerMatch } from "../../src/shared/types/match.ts";
import { registry } from "../../src/backend/registry.ts";
import { FIXTURE_BOARD_PORT, PUSH_ENDPOINT_PORT } from "../support/ports.ts";
import { FixtureBoard } from "../support/fixture-board.ts";
import { PushEndpoint } from "../support/push-endpoint.ts";
import { BACKEND_PROFILE, nextSnapshot, syncedWith } from "../support/seeker-session.ts";

const board = new FixtureBoard();
const pushEndpoint = new PushEndpoint(PUSH_ENDPOINT_PORT);

beforeAll(async () => {
	await board.listen(FIXTURE_BOARD_PORT);
	await pushEndpoint.listen();
});

afterAll(async () => {
	await board.close();
	await pushEndpoint.close();
});

async function followFixtureBoard(ctx: Parameters<typeof setupTest>[0]) {
	board.jobs = [FixtureBoard.job(1, "Backend Engineer", "Bangalore, India", "Go services on Kafka and PostgreSQL.")];
	const boardKey = FixtureBoard.uniqueKey();
	const { client } = await setupTest(ctx, registry);
	const seeker = client.seeker.getOrCreate([`seeker-${crypto.randomUUID()}`]).connect();
	const synced = nextSnapshot(seeker, syncedWith(boardKey));
	await seeker.updateProfile(BACKEND_PROFILE);
	await seeker.follow([boardKey]);
	await synced;
	const [match] = await seeker.matches();
	if (!match) {
		throw new Error("fixture board produced no match");
	}
	return { client, seeker, boardKey, match };
}

test("applying starts a follow-up reminder that fires on its own and can be snoozed", async (ctx) => {
	const { client, seeker, boardKey, match } = await followFixtureBoard(ctx);
	const reminder = new Promise<SeekerMatch>((resolve) => {
		seeker.on("matchUpdated", (changed: SeekerMatch) => {
			if (changed.followUpDue) {
				resolve(changed);
			}
		});
	});

	const applied = await seeker.setStatus(boardKey, match.postingId, "applied");
	expect(applied.appliedAt).not.toBeNull();
	expect(applied.followUpAt).toBeGreaterThan(applied.appliedAt ?? 0);
	expect(applied.followUpDue).toBe(false);

	const due = await reminder;
	expect(due.postingId).toBe(match.postingId);
	expect(due.status).toBe("applied");

	const snoozed = await seeker.snoozeFollowUp(boardKey, match.postingId, 7);
	expect(snoozed.followUpDue).toBe(false);
	expect(snoozed.followUpAt).toBeGreaterThan(Date.now() + 6 * 86_400_000);

	const interviewing = await seeker.setStatus(boardKey, match.postingId, "interviewing");
	expect(interviewing.appliedAt).toBe(applied.appliedAt);
	expect(interviewing.followUpAt).toBeNull();

	await seeker.unfollow(boardKey);
	await client.board.get([boardKey]).retire();
	await seeker.dispose();
});

test("notes are saved with the application", async (ctx) => {
	const { client, seeker, boardKey, match } = await followFixtureBoard(ctx);
	await seeker.setStatus(boardKey, match.postingId, "applied");
	await seeker.setNotes(boardKey, match.postingId, "Spoke to Priya, onsite next week");

	const tracked = (await seeker.matches()).find((item) => item.postingId === match.postingId);
	expect(tracked?.notes).toBe("Spoke to Priya, onsite next week");

	await seeker.unfollow(boardKey);
	await client.board.get([boardKey]).retire();
	await seeker.dispose();
});

test("push notifications reach subscribed devices and drop devices the push service has retired", async (ctx) => {
	const { client, seeker, boardKey } = await followFixtureBoard(ctx);
	const pushBefore = pushEndpoint.received.length;

	await seeker.subscribePush(pushEndpoint.subscription(`/ok/${crypto.randomUUID()}`));
	await seeker.subscribePush(pushEndpoint.subscription(`/gone/${crypto.randomUUID()}`));
	expect((await seeker.snapshot()).pushDevices).toBe(2);

	const pruned = nextSnapshot(seeker, (snapshot) => snapshot.pushDevices === 1);
	expect(await seeker.sendTestNotification()).toBe(1);
	await pruned;
	expect(pushEndpoint.received.slice(pushBefore).every((push) => push.encoding === "aes128gcm" && push.authorization?.startsWith("vapid "))).toBe(true);

	await seeker.setNotificationMinScore(40);
	const pushesBeforeLiveMatch = pushEndpoint.received.length;
	board.jobs = [...board.jobs, FixtureBoard.job(2, "Senior Backend Engineer", "Remote", "Kafka streams in Go.")];
	await client.board.get([boardKey]).pollNow();
	await pushEndpoint.waitForCount(pushesBeforeLiveMatch + 1);
	expect(pushEndpoint.received.at(-1)?.path.startsWith("/ok/")).toBe(true);

	await seeker.unfollow(boardKey);
	await client.board.get([boardKey]).retire();
	await seeker.dispose();
});
