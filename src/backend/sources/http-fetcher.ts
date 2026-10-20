const FETCH_TIMEOUT_MS = 30_000;

export class BoardNotFoundError extends Error {}

export class HttpFetcher {
	#active = 0;
	readonly #waiting: Array<() => void> = [];
	readonly #maxConcurrent: number;

	constructor(maxConcurrent: number) {
		this.#maxConcurrent = maxConcurrent;
	}

	json(url: string, init: RequestInit = {}): Promise<unknown> {
		return this.#withSlot(async () => (await this.#request(url, init, "application/json")).json());
	}

	text(url: string, init: RequestInit = {}): Promise<string> {
		return this.#withSlot(async () => (await this.#request(url, init, "application/xml, text/xml, */*")).text());
	}

	async #request(url: string, init: RequestInit, accept: string): Promise<Response> {
		const response = await fetch(url, {
			...init,
			headers: { accept, "user-agent": "job-radar/0.1", ...init.headers },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (response.status === 404) {
			throw new BoardNotFoundError(`No public job board at ${url}`);
		}
		if (!response.ok) {
			throw new Error(`Job board responded with ${response.status} for ${url}`);
		}
		return response;
	}

	async #withSlot<T>(work: () => Promise<T>): Promise<T> {
		if (this.#active >= this.#maxConcurrent) {
			await new Promise<void>((resolve) => this.#waiting.push(resolve));
		}
		this.#active++;
		try {
			return await work();
		} finally {
			this.#active--;
			this.#waiting.shift()?.();
		}
	}
}
