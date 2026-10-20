import { BrowserWindow, nativeTheme } from "electron";
import { SPLASH_PATH, SURFACE } from "../app/config.ts";
import { AppIcon } from "./app-icon.ts";

export class SplashWindow {
	#window: BrowserWindow | null = null;

	async show(): Promise<void> {
		this.#window = new BrowserWindow({
			width: 300,
			height: 340,
			frame: false,
			resizable: false,
			maximizable: false,
			fullscreenable: false,
			show: false,
			center: true,
			title: "Job Radar",
			icon: AppIcon.window(),
			backgroundColor: nativeTheme.shouldUseDarkColors ? SURFACE.dark.background : SURFACE.light.background,
			webPreferences: { sandbox: true, contextIsolation: true },
		});
		AppIcon.applyTaskbarIdentity(this.#window);
		this.#window.once("ready-to-show", () => this.#window?.show());
		await this.#window.loadFile(SPLASH_PATH);
	}

	setStatus(status: string): void {
		void this.#window?.webContents.executeJavaScript(`window.setStatus(${JSON.stringify(status)})`).catch(() => undefined);
	}

	close(): void {
		this.#window?.destroy();
		this.#window = null;
	}
}
