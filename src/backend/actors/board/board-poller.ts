import type { ActorContextOf } from "rivetkit";
import { Catalog } from "../../../shared/catalog.ts";
import type { Ats } from "../../../shared/types/board.ts";
import type { Posting } from "../../../shared/types/posting.ts";
import { BackendConfig } from "../../config.ts";
import type { Registry } from "../../registry.ts";
import { BoardNotFoundError, jobBoards } from "../../sources/job-board-client.ts";
import { BoardMatches } from "./board-matches.ts";
import { FollowerStore } from "./follower-store.ts";
import type { board } from "./index.ts";
import { PostingStore } from "./posting-store.ts";
import { BoardStates } from "./state.ts";

const POLL_ALARM_ACTION = "poll";
const MAX_BACKOFF_DOUBLINGS = 4;
const MISSED_POLL_DELAY_MS = 30_000;

type BoardContext = ActorContextOf<typeof board>;

export class BoardPoller {
	readonly #c: BoardContext;
	readonly #postings: PostingStore;
	readonly #followers: FollowerStore;

	constructor(c: BoardContext) {
		this.#c = c;
		this.#postings = new PostingStore(c.db);
		this.#followers = new FollowerStore(c.db);
	}

	async pollOnce(): Promise<void> {
		const c = this.#c;
		if (!c.vars.polling) {
			c.vars.polling = this.#runPoll().finally(() => {
				c.vars.polling = null;
			});
		}
		await c.vars.polling;
	}

	async reschedulePollIfMissed(): Promise<void> {
		const { state } = this.#c;
		const pollIsScheduled = state.nextPollAt !== null && state.nextPollAt > Date.now();
		if (state.polls > 0 && state.followers > 0 && !pollIsScheduled) {
			await this.#scheduleNextPoll(BoardPoller.#jitter(MISSED_POLL_DELAY_MS));
		}
	}

	async schedulePollIfIdle(): Promise<void> {
		if (this.#c.state.nextPollAt === null) {
			await this.#scheduleNextPoll(BoardPoller.#pollInterval(this.#c.state.ats));
		}
	}

	async refreshFollowerCount(): Promise<void> {
		this.#c.state.followers = await this.#followers.count();
		await this.#reportStatus();
	}

	async removeFollower(seekerId: string): Promise<void> {
		await this.#followers.remove(seekerId);
		await this.refreshFollowerCount();
		if (this.#c.state.followers === 0) {
			this.#c.state.nextPollAt = null;
			await this.#reportStatus();
		}
	}

	async retire(): Promise<void> {
		await this.#followers.clear();
		this.#c.state.followers = 0;
		this.#c.state.nextPollAt = null;
		await this.#directory().forgetBoard(BoardStates.key(this.#c.state));
	}

	async #runPoll(): Promise<void> {
		try {
			const newPostings = await this.#fetchAndStorePostings();
			if (newPostings.length > 0) {
				await this.#notifyFollowers(newPostings);
			}
		} catch (error) {
			this.#recordFailure(error);
		} finally {
			await this.#scheduleAfterPoll();
		}
	}

	async #fetchAndStorePostings(): Promise<Posting[]> {
		const { state } = this.#c;
		const { companyName: reportedName, postings } = await jobBoards.fetchBoard({ ats: state.ats, slug: state.slug }, (ids) => this.#postings.storedTexts(ids));
		if (reportedName && !Catalog.isKnownCompany(state.ats, state.slug)) {
			state.company = reportedName;
		}
		const knownIds = await this.#postings.knownIds();
		const isFirstPoll = state.polls === 0;
		const newPostings = isFirstPoll ? [] : postings.filter((posting) => !knownIds.has(posting.id));
		const pollNumber = state.polls + 1;
		await this.#postings.sync(postings, pollNumber);

		state.polls = pollNumber;
		state.openJobs = postings.length;
		state.lastNewJobs = newPostings.length;
		state.lastPolledAt = Date.now();
		state.lastError = null;
		state.consecutiveFailures = 0;
		return newPostings;
	}

	#recordFailure(error: unknown): void {
		const { state } = this.#c;
		state.consecutiveFailures++;
		state.lastError = error instanceof Error ? error.message : String(error);
		this.#c.log.warn({ msg: "job board poll failed, backing off", board: BoardStates.key(state), error: state.lastError, notFound: error instanceof BoardNotFoundError });
	}

	async #scheduleAfterPoll(): Promise<void> {
		const { state } = this.#c;
		if (state.followers === 0) {
			state.nextPollAt = null;
			await this.#reportStatus();
			return;
		}
		const backoff = 2 ** Math.min(state.consecutiveFailures, MAX_BACKOFF_DOUBLINGS);
		await this.#scheduleNextPoll(BoardPoller.#pollInterval(state.ats) * backoff);
	}

	async #notifyFollowers(newPostings: Posting[]): Promise<void> {
		const seekers = this.#c.client<Registry>().seeker;
		const followers = await this.#followers.all();
		await Promise.all(
			followers.map(async (follower) => {
				const matches = BoardMatches.score(this.#c.state, newPostings, follower.profile);
				if (matches.length === 0) {
					return;
				}
				try {
					await seekers.get([follower.seekerId]).receiveNewMatches(matches);
				} catch (error) {
					this.#c.log.warn({ msg: "could not deliver matches to seeker", seeker: follower.seekerId, error: String(error) });
				}
			}),
		);
	}

	async #scheduleNextPoll(delayMs: number): Promise<void> {
		this.#c.state.nextPollAt = Date.now() + delayMs;
		await this.#c.schedule.at(this.#c.state.nextPollAt, POLL_ALARM_ACTION);
		await this.#reportStatus();
	}

	async #reportStatus(): Promise<void> {
		await this.#directory().reportBoard(BoardStates.status(this.#c.state));
	}

	#directory() {
		return this.#c.client<Registry>().directory.getOrCreate([BackendConfig.directoryKey]);
	}

	static #pollInterval(ats: Ats): number {
		return BoardPoller.#jitter(Math.max(BackendConfig.pollIntervalMs, jobBoards.source(ats).minPollIntervalMs));
	}

	static #jitter(baseMs: number): number {
		return Math.round(baseMs * (0.9 + Math.random() * 0.2));
	}
}
