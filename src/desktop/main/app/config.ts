import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

export const APP_ID = "dev.jobradar.desktop";
const ENGINE_PORT_BASE = 46420;
const ENGINE_PORT_RANGE = 500;

export class EngineAddress {
	static port(): number {
		let hash = 0x811c9dc5;
		for (const character of app.getPath("userData").toLowerCase()) {
			hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
		}
		return ENGINE_PORT_BASE + (hash % ENGINE_PORT_RANGE);
	}

	static endpoint(): string {
		return `http://127.0.0.1:${EngineAddress.port()}`;
	}
}
export const ENGINE_START_TIMEOUT_MS = 90_000;
export const ENGINE_STOP_TIMEOUT_MS = 10_000;
export const SHUTDOWN_GRACE_MS = 4_000;
export const API_CHECK_MODEL = "claude-opus-5-5";
export const TITLE_BAR_HEIGHT = 48;
export const HIDDEN_LAUNCH_ARGUMENT = "--hidden";

const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(BUNDLE_DIR, "..");
export const PRELOAD_PATH = join(BUNDLE_DIR, "preload.cjs");
export const APPLY_PRELOAD_PATH = join(BUNDLE_DIR, "apply-preload.cjs");
export const RENDERER_DIR = join(APP_ROOT, "dist", "renderer");
export const SPLASH_PATH = join(BUNDLE_DIR, "splash.html");
export const ASSETS_DIR = join(APP_ROOT, "assets");

export const SURFACE = {
	light: { background: "#ffffff", foreground: "#09090b" },
	dark: { background: "#09090b", foreground: "#fafafa" },
} as const;
