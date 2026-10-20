import { fileURLToPath } from "node:url";
import type { AiSettings } from "../shared/types/ai.ts";

const DAY_MS = 86_400_000;
const DEFAULT_POLL_MINUTES = 15;

export class BackendConfig {
	static get directoryKey(): string {
		return process.env.JOB_RADAR_DIRECTORY_KEY ?? "global";
	}

	static get followUpDelayMs(): number {
		return BackendConfig.#positive(process.env.JOB_RADAR_FOLLOW_UP_MINUTES, (minutes) => minutes * 60_000) ?? 7 * DAY_MS;
	}

	static get pollIntervalMs(): number {
		return (BackendConfig.#positive(process.env.JOB_RADAR_POLL_MINUTES, (minutes) => minutes) ?? DEFAULT_POLL_MINUTES) * 60_000;
	}

	static get boardMirrorBaseUrl(): string | null {
		return process.env.JOB_RADAR_BOARD_BASE_URL ?? null;
	}

	static get dataDir(): string {
		return process.env.JOB_RADAR_DATA_DIR ?? fileURLToPath(new URL("../../data", import.meta.url));
	}

	static get pushSubject(): string {
		return process.env.JOB_RADAR_PUSH_SUBJECT ?? "mailto:job-radar@example.com";
	}

	static get aiSettings(): AiSettings {
		return process.env.JOB_RADAR_AI === "anthropic-api" && process.env.ANTHROPIC_API_KEY
			? { kind: "anthropic-api", apiKey: process.env.ANTHROPIC_API_KEY }
			: { kind: "claude-code", apiKey: null };
	}

	static #positive(raw: string | undefined, convert: (value: number) => number): number | null {
		const value = Number(raw);
		return Number.isFinite(value) && value > 0 ? convert(value) : null;
	}
}
