import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { safeStorage } from "electron";
import { z } from "zod";
import type { AiSettings } from "../../../shared/types/ai.ts";
import type { DesktopSettingsView } from "../../../shared/ipc/desktop-bridge.ts";

const storedSchema = z.object({
	ai: z.object({
		kind: z.enum(["claude-code", "anthropic-api"]),
		configured: z.boolean(),
		encryptedApiKey: z.string().nullable(),
	}),
	openAtLogin: z.boolean(),
	trayHintShown: z.boolean().default(false),
});

type StoredSettings = z.infer<typeof storedSchema>;

const DEFAULTS: StoredSettings = { ai: { kind: "claude-code", configured: false, encryptedApiKey: null }, openAtLogin: false, trayHintShown: false };

export class DesktopSettings {
	readonly #path: string;
	readonly #userDataDir: string;
	#data: StoredSettings;

	constructor(userDataDir: string) {
		this.#userDataDir = userDataDir;
		this.#path = join(userDataDir, "settings.json");
		this.#data = existsSync(this.#path) ? (storedSchema.safeParse(JSON.parse(readFileSync(this.#path, "utf8"))).data ?? DEFAULTS) : DEFAULTS;
	}

	get openAtLogin(): boolean {
		return this.#data.openAtLogin;
	}

	get trayHintShown(): boolean {
		return this.#data.trayHintShown;
	}

	markTrayHintShown(): void {
		this.#data = { ...this.#data, trayHintShown: true };
		this.#save();
	}

	view(): DesktopSettingsView {
		return {
			ai: { kind: this.#data.ai.kind, configured: this.#data.ai.configured, hasApiKey: this.#data.ai.encryptedApiKey !== null },
			openAtLogin: this.#data.openAtLogin,
			dataPath: this.#userDataDir,
		};
	}

	aiSettings(): AiSettings | null {
		if (!this.#data.ai.configured) {
			return null;
		}
		const encrypted = this.#data.ai.encryptedApiKey;
		return {
			kind: this.#data.ai.kind,
			apiKey: encrypted ? safeStorage.decryptString(Buffer.from(encrypted, "base64")) : null,
		};
	}

	useClaudeCode(): void {
		this.#data = { ...this.#data, ai: { ...this.#data.ai, kind: "claude-code", configured: true } };
		this.#save();
	}

	useApiKey(apiKey: string): void {
		if (!safeStorage.isEncryptionAvailable()) {
			throw new Error("This computer has no secure credential store, so the API key cannot be saved safely.");
		}
		const encryptedApiKey = safeStorage.encryptString(apiKey).toString("base64");
		this.#data = { ...this.#data, ai: { kind: "anthropic-api", configured: true, encryptedApiKey } };
		this.#save();
	}

	setOpenAtLogin(enabled: boolean): void {
		this.#data = { ...this.#data, openAtLogin: enabled };
		this.#save();
	}

	#save(): void {
		writeFileSync(this.#path, JSON.stringify(this.#data, null, 2));
	}
}
