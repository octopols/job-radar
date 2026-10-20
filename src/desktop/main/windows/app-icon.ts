import { join } from "node:path";
import { app, type BrowserWindow, type NativeImage, nativeImage } from "electron";
import { APP_ID, ASSETS_DIR } from "../app/config.ts";

export class AppIcon {
	static appUserModelId(): string {
		return app.isPackaged ? APP_ID : `${APP_ID}.dev`;
	}

	static window(): NativeImage {
		return nativeImage.createFromPath(join(ASSETS_DIR, process.platform === "win32" ? "icon.ico" : "icon.png"));
	}

	static applyTaskbarIdentity(window: BrowserWindow): void {
		if (process.platform !== "win32") {
			return;
		}
		window.setAppDetails({
			appId: AppIcon.appUserModelId(),
			appIconPath: app.isPackaged ? process.execPath : join(ASSETS_DIR, "icon.ico"),
			appIconIndex: 0,
			relaunchCommand: `"${process.execPath}"${app.isPackaged ? "" : ` "${app.getAppPath()}"`}`,
			relaunchDisplayName: "Job Radar",
		});
	}

	static tray(): NativeImage {
		return nativeImage.createFromPath(join(ASSETS_DIR, "tray.png"));
	}
}
