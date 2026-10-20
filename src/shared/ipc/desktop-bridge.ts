import type { AiKind } from "../types/ai.ts";
import type { ApplicationRequest, ApplicationStatus } from "./apply.ts";

export interface DesktopSettingsView {
	ai: { kind: AiKind; configured: boolean; hasApiKey: boolean };
	openAtLogin: boolean;
	dataPath: string;
}

export type AiCheck = { ok: true; detail: string } | { ok: false; error: string };

export interface DesktopBridge {
	endpoint: string;
	platform: string;
	getSettings(): Promise<DesktopSettingsView>;
	useClaudeCode(): Promise<AiCheck>;
	useApiKey(apiKey: string): Promise<AiCheck>;
	setOpenAtLogin(enabled: boolean): Promise<DesktopSettingsView>;
	focusWindow(): void;
	openDataFolder(): void;
	resetEverything(): Promise<void>;
	setTitleBarTheme(dark: boolean): void;
	startApplication(request: ApplicationRequest): void;
	watchProfile(seekerKey: string): void;
	onApplicationStatus(listener: (status: ApplicationStatus) => void): () => void;
}

export const IPC = {
	getSettings: "settings:get",
	useClaudeCode: "ai:use-claude-code",
	useApiKey: "ai:use-api-key",
	setOpenAtLogin: "settings:open-at-login",
	focusWindow: "window:focus",
	openDataFolder: "data:open-folder",
	resetEverything: "data:reset",
	setTitleBarTheme: "window:title-bar-theme",
	startApplication: "application:start",
	watchProfile: "application:watch-profile",
	applicationStatus: "application:status",
} as const;

export const ENDPOINT_ARGUMENT = "--job-radar-endpoint=";
