import type { MatchesAdded } from "../../../shared/types/match.ts";
import type { SeekerSnapshot } from "../../../shared/types/seeker.ts";
import type { ApplicationAssistant } from "./application-assistant.ts";
import type { SeekerClient, SeekerHandle } from "./types.ts";

type SeekerConnection = ReturnType<SeekerHandle["connect"]>;

export class AutoApplier {
	readonly #client: SeekerClient;
	readonly #applications: ApplicationAssistant;
	#seekerKey: string | null = null;
	#connection: SeekerConnection | null = null;
	#draining = false;
	#drainAgain = false;

	constructor(client: SeekerClient, applications: ApplicationAssistant) {
		this.#client = client;
		this.#applications = applications;
	}

	watch(seekerKey: string): void {
		if (this.#seekerKey === seekerKey) {
			return;
		}
		void this.#connection?.dispose();
		this.#seekerKey = seekerKey;
		const connection = this.#client.seeker.getOrCreate([seekerKey]).connect();
		connection.on("matchesAdded", (payload: MatchesAdded) => payload.live && this.#drain());
		connection.on("snapshot", (snapshot: SeekerSnapshot) => snapshot.autoApply.enabled && this.#drain());
		this.#connection = connection;
		this.#drain();
	}

	stop(): void {
		void this.#connection?.dispose();
		this.#connection = null;
	}

	#drain(): void {
		if (this.#draining) {
			this.#drainAgain = true;
			return;
		}
		this.#draining = true;
		void this.#prepareQueued()
			.catch((error: unknown) => console.error("auto-apply stopped, it will retry on the next new match", error))
			.finally(() => {
				this.#draining = false;
			});
	}

	async #prepareQueued(): Promise<void> {
		const seekerKey = this.#seekerKey;
		if (!seekerKey) {
			return;
		}
		const seeker = this.#client.seeker.getOrCreate([seekerKey]);
		do {
			this.#drainAgain = false;
			for (const match of await seeker.autoApplyQueue()) {
				const { autoApply } = await seeker.snapshot();
				if (!autoApply.enabled) {
					return;
				}
				const request = { seekerKey, boardKey: match.boardKey, postingId: match.postingId, url: match.url, title: match.title, company: match.company };
				await this.#applications.autoApply(request, autoApply.autoSubmit);
			}
		} while (this.#drainAgain);
	}
}
