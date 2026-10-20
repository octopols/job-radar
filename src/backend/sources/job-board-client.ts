import type { Ats, BoardRef } from "../../shared/types/board.ts";
import { BackendConfig } from "../config.ts";
import { PersonioSource, RecruiteeSource, SmartRecruitersSource, WorkableSource } from "./detail-sources.ts";
import { HackerNewsSource, RemoteOkSource } from "./feed-sources.ts";
import { HttpFetcher } from "./http-fetcher.ts";
import type { BoardProbe, BoardSnapshot, FetchContext, JobSource, StoredTexts } from "./job-source.ts";
import { AshbySource, GreenhouseSource, LeverSource } from "./list-sources.ts";

export { BoardNotFoundError } from "./http-fetcher.ts";

const MAX_CONCURRENT_FETCHES = 6;
const NOTHING_STORED: StoredTexts = async () => new Map();

class JobBoardClient {
	readonly #http = new HttpFetcher(MAX_CONCURRENT_FETCHES);
	readonly #mirrorBaseUrl: string | null;
	readonly #sources: Record<Ats, JobSource> = {
		greenhouse: new GreenhouseSource(),
		lever: new LeverSource(),
		ashby: new AshbySource(),
		smartrecruiters: new SmartRecruitersSource(),
		recruitee: new RecruiteeSource(),
		workable: new WorkableSource(),
		personio: new PersonioSource(),
		remoteok: new RemoteOkSource(),
		hackernews: new HackerNewsSource(),
	};

	constructor(mirrorBaseUrl: string | null) {
		this.#mirrorBaseUrl = mirrorBaseUrl;
	}

	get sources(): JobSource[] {
		return Object.values(this.#sources);
	}

	source(ats: Ats): JobSource {
		return this.#sources[ats];
	}

	fetchBoard(board: BoardRef, storedTexts: StoredTexts): Promise<BoardSnapshot> {
		return this.#sources[board.ats].fetch(board.slug, this.#context(storedTexts));
	}

	probe(board: BoardRef): Promise<BoardProbe> {
		return this.#sources[board.ats].probe(board.slug, this.#context(NOTHING_STORED));
	}

	fetchPage(url: string): Promise<string> {
		return this.#http.text(url);
	}

	#context(storedTexts: StoredTexts): FetchContext {
		return { http: this.#http, storedTexts, mirrorBaseUrl: this.#mirrorBaseUrl };
	}
}

export const jobBoards = new JobBoardClient(BackendConfig.boardMirrorBaseUrl);
