import { UserError } from "rivetkit";
import { BoardKey } from "../../../shared/board-key.ts";
import { DEFAULT_PREFERENCES } from "../../../shared/constants.ts";
import { CountryResolver } from "../../../shared/geo.ts";
import type { Match } from "../../../shared/types/match.ts";
import type { Preferences, Profile, ResumeReading } from "../../../shared/types/profile.ts";
import { SCORER_VERSION } from "../../matching/scorer.ts";
import type { Registry } from "../../registry.ts";
import { MatchStore } from "./match-store.ts";
import { type SeekerContext, SeekerStates } from "./state.ts";

const PARALLEL_BOARD_SYNCS = 4;
const FOLLOW_ATTEMPTS = 3;
const FOLLOW_RETRY_DELAY_MS = 2_000;

export class ProfileSync {
	readonly #c: SeekerContext;
	readonly #matches: MatchStore;

	constructor(c: SeekerContext) {
		this.#c = c;
		this.#matches = new MatchStore(c.db);
	}

	startReadingResume(resumeName: string, readResume: () => Promise<ResumeReading>): void {
		const c = this.#c;
		if (c.state.parsing) {
			throw new UserError("A resume is already being read.", { code: "parse_in_progress" });
		}
		c.state.parsing = true;
		c.state.parseError = null;
		c.state.resumeName = resumeName;
		SeekerStates.publish(c);

		const reading = readResume()
			.then((resume) => this.#applyResume(resume))
			.catch((error: unknown) => {
				c.state.parseError = error instanceof Error ? error.message : String(error);
			})
			.finally(() => {
				c.state.parsing = false;
				SeekerStates.publish(c);
			});
		void c.keepAwake(reading);
	}

	async apply(profile: Profile): Promise<void> {
		const c = this.#c;
		c.state.profile = profile;
		c.state.scorerVersion = SCORER_VERSION;
		await this.#matches.clearUntouched();
		c.broadcast("matchesReset", null);
		await this.syncBoards(c.state.follows);
	}

	async syncBoards(boardKeys: string[]): Promise<void> {
		const c = this.#c;
		const profile = c.state.profile;
		if (!profile || boardKeys.length === 0) {
			SeekerStates.publish(c);
			return;
		}

		const pending = [...boardKeys];
		c.state.syncing = [...new Set([...c.state.syncing, ...boardKeys])];
		SeekerStates.publish(c);

		const syncPendingBoards = async () => {
			for (let boardKey = pending.shift(); boardKey !== undefined; boardKey = pending.shift()) {
				await this.#syncBoard(boardKey, profile);
			}
		};
		await Promise.all(Array.from({ length: PARALLEL_BOARD_SYNCS }, syncPendingBoards));
	}

	#applyResume({ contact, ...resumeProfile }: ResumeReading): Promise<void> {
		this.#c.state.resumeContact = contact;
		const preferences = ProfileSync.#preferencesOf(this.#c.state.profile);
		const workCountries = preferences.workCountries.length > 0 ? preferences.workCountries : CountryResolver.fromLocations(resumeProfile.locations);
		return this.apply({ ...preferences, ...resumeProfile, workCountries });
	}

	async #syncBoard(boardKey: string, profile: Profile): Promise<void> {
		const c = this.#c;
		try {
			const added = await this.#matches.upsert(await this.#followWithRetries(boardKey, profile), false);
			delete c.state.boardErrors[boardKey];
			if (added.length > 0) {
				c.broadcast("matchesAdded", { matches: added, live: false });
			}
		} catch (error) {
			c.state.boardErrors[boardKey] = error instanceof Error ? error.message : String(error);
		} finally {
			c.state.syncing = c.state.syncing.filter((syncing) => syncing !== boardKey);
			SeekerStates.publish(c);
		}
	}

	async #followWithRetries(boardKey: string, profile: Profile): Promise<Match[]> {
		const boards = this.#c.client<Registry>().board;
		for (let attempt = 1; ; attempt++) {
			try {
				return await boards.getOrCreate([boardKey], { createWithInput: BoardKey.parse(boardKey) }).follow(this.#c.state.id, profile);
			} catch (error) {
				const boardIsUnavailable = (error as { code?: string }).code === "board_unavailable";
				if (boardIsUnavailable || attempt >= FOLLOW_ATTEMPTS) {
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, FOLLOW_RETRY_DELAY_MS * attempt));
			}
		}
	}

	static #preferencesOf(profile: Profile | null): Preferences {
		if (!profile) {
			return DEFAULT_PREFERENCES;
		}
		const { workModes, openToRelocation, workCountries, excludeKeywords } = profile;
		return { workModes, openToRelocation, workCountries, excludeKeywords };
	}
}
