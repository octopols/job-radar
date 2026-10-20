import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import type { BoardRef, BoardStatus } from "../../../shared/types/board.ts";
import type { Match } from "../../../shared/types/match.ts";
import type { Posting } from "../../../shared/types/posting.ts";
import type { Profile } from "../../../shared/types/profile.ts";
import { BoardMatches } from "./board-matches.ts";
import { BoardPoller } from "./board-poller.ts";
import { FollowerStore } from "./follower-store.ts";
import { PostingStore } from "./posting-store.ts";
import { BoardSchema } from "./schema.ts";
import { type BoardState, BoardStates } from "./state.ts";

const MAX_MATCHES_PER_FOLLOW = 300;

const STALE_ALARM_TOLERANCE_MS = 5_000;

export const board = actor({
	createState: (_c, input: BoardRef): BoardState => BoardStates.initial(input),

	createVars: (): { polling: Promise<void> | null } => ({ polling: null }),

	options: {
		actionTimeout: 300_000,
	},

	db: db({ onMigrate: BoardSchema.migrate }),

	onWake: async (c) => {
		await new BoardPoller(c).reschedulePollIfMissed();
	},

	actions: {
		status: (c): BoardStatus => BoardStates.status(c.state),

		follow: async (c, seekerId: string, profile: Profile): Promise<Match[]> => {
			const poller = new BoardPoller(c);
			await new FollowerStore(c.db).add(seekerId, profile);
			await poller.refreshFollowerCount();

			if (c.state.polls === 0) {
				await poller.pollOnce();
			}
			if (c.state.polls === 0) {
				await poller.removeFollower(seekerId);
				throw new UserError(`Could not load ${c.state.company}: ${c.state.lastError ?? "unknown error"}`, { code: "board_unavailable" });
			}
			await poller.schedulePollIfIdle();

			return BoardMatches.best(c.state, await new PostingStore(c.db).open(), profile, MAX_MATCHES_PER_FOLLOW);
		},

		unfollow: async (c, seekerId: string) => {
			await new BoardPoller(c).removeFollower(seekerId);
		},

		retire: async (c) => {
			await new BoardPoller(c).retire();
			c.destroy();
		},

		posting: (c, postingId: string): Promise<Posting | null> => new PostingStore(c.db).find(postingId),

		pollNow: async (c): Promise<BoardStatus> => {
			await new BoardPoller(c).pollOnce();
			return BoardStates.status(c.state);
		},

		poll: async (c) => {
			const staleAlarm = c.state.nextPollAt === null || Date.now() < c.state.nextPollAt - STALE_ALARM_TOLERANCE_MS;
			if (!staleAlarm) {
				await new BoardPoller(c).pollOnce();
			}
		},
	},
});
