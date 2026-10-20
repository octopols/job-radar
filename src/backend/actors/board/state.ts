import { BoardKey } from "../../../shared/board-key.ts";
import { Catalog } from "../../../shared/catalog.ts";
import type { Ats, BoardRef, BoardStatus } from "../../../shared/types/board.ts";

export interface BoardState {
	ats: Ats;
	slug: string;
	company: string;
	polls: number;
	openJobs: number;
	followers: number;
	lastPolledAt: number | null;
	nextPollAt: number | null;
	lastNewJobs: number;
	lastError: string | null;
	consecutiveFailures: number;
}

export class BoardStates {
	static initial(input: BoardRef): BoardState {
		return {
			ats: input.ats,
			slug: input.slug,
			company: Catalog.companyName(input.ats, input.slug),
			polls: 0,
			openJobs: 0,
			followers: 0,
			lastPolledAt: null,
			nextPollAt: null,
			lastNewJobs: 0,
			lastError: null,
			consecutiveFailures: 0,
		};
	}

	static key(state: BoardState): string {
		return BoardKey.of(state);
	}

	static status(state: BoardState): BoardStatus {
		return {
			key: BoardStates.key(state),
			ats: state.ats,
			slug: state.slug,
			company: state.company,
			openJobs: state.openJobs,
			followers: state.followers,
			polls: state.polls,
			lastPolledAt: state.lastPolledAt,
			nextPollAt: state.nextPollAt,
			lastNewJobs: state.lastNewJobs,
			lastError: state.lastError,
		};
	}
}
