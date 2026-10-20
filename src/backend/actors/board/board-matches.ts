import type { Match } from "../../../shared/types/match.ts";
import type { Posting } from "../../../shared/types/posting.ts";
import type { Profile } from "../../../shared/types/profile.ts";
import { MATCH_FLOOR, MatchScorer } from "../../matching/scorer.ts";
import { type BoardState, BoardStates } from "./state.ts";

export class BoardMatches {
	static score(state: BoardState, postings: Posting[], profile: Profile): Match[] {
		const scorer = new MatchScorer(profile);
		const boardKey = BoardStates.key(state);
		return postings
			.map((posting): Match => ({
				postingId: posting.id,
				boardKey,
				company: posting.company ?? state.company,
				title: posting.title,
				location: posting.location,
				remote: posting.remote,
				workMode: posting.workMode,
				url: posting.url,
				postedAt: posting.postedAt,
				...scorer.score(posting),
			}))
			.filter((match) => match.score >= MATCH_FLOOR);
	}

	static best(state: BoardState, postings: Posting[], profile: Profile, limit: number): Match[] {
		return BoardMatches.score(state, postings, profile)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);
	}
}
