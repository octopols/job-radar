import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { app, ipcMain, shell } from "electron";
import type { CareerAssistant } from "../../../backend/ai/career-assistant.ts";
import type { ApplicationRequest } from "../../../shared/ipc/apply.ts";
import { type AiCheck, IPC } from "../../../shared/ipc/desktop-bridge.ts";
import type { DesktopSettings } from "../app/desktop-settings.ts";
import { API_CHECK_MODEL } from "../app/config.ts";

const execFileAsync = promisify(execFile);

interface DesktopIpcDeps {
	settings: DesktopSettings;
	assistant: CareerAssistant;
	focusWindow: () => void;
	setTheme: (dark: boolean) => void;
	setOpenAtLogin: (enabled: boolean) => void;
	resetEverything: () => Promise<void>;
	startApplication: (request: ApplicationRequest) => void;
	watchProfile: (seekerKey: string) => void;
}

export class DesktopIpc {
	static register(deps: DesktopIpcDeps): void {
		ipcMain.handle(IPC.getSettings, () => deps.settings.view());
		ipcMain.handle(IPC.useClaudeCode, () => DesktopIpc.#useClaudeCode(deps));
		ipcMain.handle(IPC.useApiKey, (_event, apiKey: string) => DesktopIpc.#useApiKey(deps, apiKey.trim()));
		ipcMain.handle(IPC.setOpenAtLogin, (_event, enabled: boolean) => {
			deps.settings.setOpenAtLogin(enabled);
			deps.setOpenAtLogin(enabled);
			return deps.settings.view();
		});
		ipcMain.handle(IPC.resetEverything, () => deps.resetEverything());
		ipcMain.on(IPC.focusWindow, () => deps.focusWindow());
		ipcMain.on(IPC.openDataFolder, () => void shell.openPath(app.getPath("userData")));
		ipcMain.on(IPC.setTitleBarTheme, (_event, dark: boolean) => deps.setTheme(dark));
		ipcMain.on(IPC.startApplication, (_event, request: ApplicationRequest) => deps.startApplication(request));
		ipcMain.on(IPC.watchProfile, (_event, seekerKey: string) => deps.watchProfile(seekerKey));
	}

	static async #useClaudeCode(deps: DesktopIpcDeps): Promise<AiCheck> {
		try {
			const { stdout } = await execFileAsync(process.env.CLAUDE_CODE_BIN ?? "claude", ["--version"], { timeout: 20_000, windowsHide: true });
			deps.settings.useClaudeCode();
			deps.assistant.configure({ kind: "claude-code", apiKey: null });
			return { ok: true, detail: stdout.trim() };
		} catch {
			return { ok: false, error: "Claude Code is not installed or not on your PATH. Install it, run `claude` once to log in, then try again." };
		}
	}

	static async #useApiKey(deps: DesktopIpcDeps, apiKey: string): Promise<AiCheck> {
		try {
			await new Anthropic({ apiKey }).models.retrieve(API_CHECK_MODEL);
		} catch (error) {
			if (error instanceof Anthropic.AuthenticationError) {
				return { ok: false, error: "That API key was rejected. Check it in the Claude Console and try again." };
			}
			if (error instanceof Anthropic.APIConnectionError) {
				return { ok: false, error: "Could not reach the Anthropic API. Check your internet connection." };
			}
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
		deps.settings.useApiKey(apiKey);
		deps.assistant.configure({ kind: "anthropic-api", apiKey });
		return { ok: true, detail: "API key saved" };
	}
}
