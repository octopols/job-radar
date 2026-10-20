import { BrowserWindow, nativeTheme, shell } from "electron";
import { ENDPOINT_ARGUMENT } from "../../../shared/ipc/desktop-bridge.ts";
import { EngineAddress, PRELOAD_PATH, SURFACE, TITLE_BAR_HEIGHT } from "../app/config.ts";
import { AppIcon } from "./app-icon.ts";

export class MainWindow {
	#window: BrowserWindow | null = null;
	#canClose = false;

	async open(url: string, onReady: () => void): Promise<void> {
		const dark = nativeTheme.shouldUseDarkColors;
		this.#window = new BrowserWindow({
			width: 1280,
			height: 860,
			minWidth: 420,
			minHeight: 520,
			title: "Job Radar",
			show: false,
			icon: AppIcon.window(),
			backgroundColor: dark ? SURFACE.dark.background : SURFACE.light.background,
			titleBarStyle: "hidden",
			...(process.platform === "darwin"
				? { trafficLightPosition: { x: 16, y: (TITLE_BAR_HEIGHT - 16) / 2 } }
				: { titleBarOverlay: MainWindow.#overlay(dark) }),
			webPreferences: {
				preload: PRELOAD_PATH,
				additionalArguments: [`${ENDPOINT_ARGUMENT}${EngineAddress.endpoint()}`],
				contextIsolation: true,
				sandbox: true,
			},
		});
		AppIcon.applyTaskbarIdentity(this.#window);

		this.#window.on("close", (event) => {
			if (!this.#canClose) {
				event.preventDefault();
				this.#window?.hide();
			}
		});
		this.#window.webContents.setWindowOpenHandler(({ url: target }) => {
			if (/^https?:\/\//.test(target)) {
				void shell.openExternal(target);
			}
			return { action: "deny" };
		});
		this.#window.once("ready-to-show", onReady);
		await this.#window.loadURL(url);
	}

	onHide(listener: () => void): void {
		this.#window?.on("hide", listener);
	}

	show(): void {
		if (!this.#window) {
			return;
		}
		if (this.#window.isMinimized()) {
			this.#window.restore();
		}
		this.#window.show();
		this.#window.focus();
	}

	setTheme(dark: boolean): void {
		if (process.platform !== "darwin") {
			this.#window?.setTitleBarOverlay(MainWindow.#overlay(dark));
		}
		this.#window?.setBackgroundColor(dark ? SURFACE.dark.background : SURFACE.light.background);
	}

	send(channel: string, payload: unknown): void {
		if (this.#window && !this.#window.isDestroyed()) {
			this.#window.webContents.send(channel, payload);
		}
	}

	allowClose(): void {
		this.#canClose = true;
	}

	static #overlay(dark: boolean) {
		const surface = dark ? SURFACE.dark : SURFACE.light;
		return { color: surface.background, symbolColor: surface.foreground, height: TITLE_BAR_HEIGHT };
	}
}
