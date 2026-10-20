import type { WebContents } from "electron";

const PAGE_REQUEST_TIMEOUT_MS = 60_000;

const PROBE_TIMEOUT_MS = 3_000;

export class PageChannel {
	readonly #contents: WebContents;
	readonly #pending = new Map<number, (payload: unknown) => void>();
	#nextRequest = 0;

	constructor(contents: WebContents) {
		this.#contents = contents;
	}

	request<T>(channel: string, ...args: unknown[]): Promise<T> {
		const requestId = this.#nextRequest++;
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.#pending.delete(requestId);
				reject(new Error("The application page stopped responding."));
			}, PAGE_REQUEST_TIMEOUT_MS);
			this.#pending.set(requestId, (payload) => {
				clearTimeout(timer);
				resolve(payload as T);
			});
			this.#contents.send(channel, requestId, ...args);
		});
	}

	probe<T>(channel: string, fallback: T): Promise<T> {
		return Promise.race([this.request<T>(channel).catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), PROBE_TIMEOUT_MS))]);
	}

	resolve(requestId: number, payload: unknown): void {
		this.#pending.get(requestId)?.(payload);
		this.#pending.delete(requestId);
	}

	send(channel: string, payload: unknown): void {
		if (!this.#contents.isDestroyed()) {
			this.#contents.send(channel, payload);
		}
	}
}
