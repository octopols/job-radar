import { rmSync } from "node:fs";
import { join } from "node:path";
import { app, Notification, session } from "electron";
import { createClient } from "rivetkit/client";
import type { Registry } from "../../../backend/registry.ts";
import { IPC } from "../../../shared/ipc/desktop-bridge.ts";
import { ApplicationAssistant } from "../applications/application-assistant.ts";
import { AutoApplier } from "../applications/auto-applier.ts";
import { EngineLifecycle } from "../engine/engine-lifecycle.ts";
import { RendererServer } from "../engine/renderer-server.ts";
import { DesktopIpc } from "../ipc/desktop-ipc.ts";
import { AppIcon } from "../windows/app-icon.ts";
import { AppTray } from "../windows/app-tray.ts";
import { MainWindow } from "../windows/main-window.ts";
import { SplashWindow } from "../windows/splash-window.ts";
import { EngineAddress, HIDDEN_LAUNCH_ARGUMENT, RENDERER_DIR, SHUTDOWN_GRACE_MS } from "./config.ts";
import { DesktopSettings } from "./desktop-settings.ts";
import { DesktopRuntime } from "./runtime.ts";

const APP_DATA_ENTRIES = [".rivetkit", "data", "settings.json"];

export class JobRadarApp {
	readonly #window = new MainWindow();
	readonly #splash = new SplashWindow();
	readonly #tray = new AppTray();
	#settings!: DesktopSettings;
	#renderer: RendererServer | null = null;
	#registry: { start(): void; shutdown(): Promise<unknown> } | null = null;
	#quitting = false;
	#autoApplier: AutoApplier | null = null;

	async start(): Promise<void> {
		if (!app.isPackaged && process.env.JOB_RADAR_USER_DATA) {
			app.setPath("userData", process.env.JOB_RADAR_USER_DATA);
		}
		if (!app.requestSingleInstanceLock()) {
			app.quit();
			return;
		}
		app.on("second-instance", () => this.#window.show());
		app.setAppUserModelId(AppIcon.appUserModelId());
		await app.whenReady();

		const launchedHidden = process.argv.includes(HIDDEN_LAUNCH_ARGUMENT);
		if (!launchedHidden) {
			await this.#splash.show();
		}

		DesktopRuntime.configure();
		await EngineLifecycle.stopIfMoved();
		this.#settings = new DesktopSettings(app.getPath("userData"));
		this.#setOpenAtLogin(this.#settings.openAtLogin);

		this.#splash.setStatus("Starting the job engine");
		const { careerAssistant } = await import("../../../backend/ai/career-assistant.ts");
		const ai = this.#settings.aiSettings();
		if (ai) {
			careerAssistant.configure(ai);
		}
		const { registry } = await import("../../../backend/registry.ts");
		this.#registry = registry;
		registry.start();
		await EngineLifecycle.waitUntilHealthy();

		const client = createClient<Registry>({ endpoint: EngineAddress.endpoint(), devtools: false });
		const applications = new ApplicationAssistant(client, careerAssistant, (status) => this.#window.send(IPC.applicationStatus, status));
		this.#autoApplier = new AutoApplier(client, applications);
		DesktopIpc.register({
			settings: this.#settings,
			assistant: careerAssistant,
			focusWindow: () => this.#window.show(),
			setTheme: (dark) => this.#window.setTheme(dark),
			setOpenAtLogin: (enabled) => this.#setOpenAtLogin(enabled),
			resetEverything: () => this.#resetEverything(),
			startApplication: (request) => applications.open(request),
			watchProfile: (seekerKey) => this.#autoApplier?.watch(seekerKey),
		});

		this.#splash.setStatus("Loading your matches");
		this.#renderer = new RendererServer(RENDERER_DIR);
		const url = process.env.JOB_RADAR_RENDERER_URL ?? (await this.#renderer.start());
		await this.#window.open(url, () => {
			if (!launchedHidden) {
				this.#window.show();
			}
			this.#splash.close();
		});
		this.#window.onHide(() => this.#explainTrayOnce());
		this.#tray.create({ open: () => this.#window.show(), quit: () => app.quit() });

		app.on("before-quit", (event) => {
			if (this.#quitting) {
				return;
			}
			event.preventDefault();
			void this.#shutdown().then(() => app.exit(0));
		});
		app.on("window-all-closed", () => {
		});
	}

	abandon(): void {
		this.#splash.close();
		EngineLifecycle.stop();
	}

	async #shutdown(): Promise<void> {
		this.#quitting = true;
		this.#autoApplier?.stop();
		this.#tray.destroy();
		this.#window.allowClose();
		const drained = this.#registry?.shutdown().catch((error: unknown) => console.error(error));
		await Promise.race([drained, new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS))]);
		await EngineLifecycle.stopAndWait();
		this.#renderer?.stop();
	}

	async #resetEverything(): Promise<void> {
		await this.#shutdown();
		await session.defaultSession.clearStorageData();
		const userData = app.getPath("userData");
		for (const entry of APP_DATA_ENTRIES) {
			rmSync(join(userData, entry), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		}
		this.#setOpenAtLogin(false);
		app.relaunch();
		app.exit(0);
	}

	#explainTrayOnce(): void {
		if (this.#quitting || this.#settings.trayHintShown) {
			return;
		}
		this.#settings.markTrayHintShown();
		new Notification({
			title: "Job Radar is still watching",
			body: "It keeps checking for new jobs from the system tray. Right-click the tray icon to quit.",
			icon: AppIcon.window(),
		}).show();
	}

	#setOpenAtLogin(enabled: boolean): void {
		app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_LAUNCH_ARGUMENT] });
	}
}
