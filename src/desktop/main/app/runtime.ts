import { join } from "node:path";
import { app } from "electron";
import { EngineAddress } from "./config.ts";

export class DesktopRuntime {
	static configure(): void {
		const userData = app.getPath("userData");
		process.env.RIVETKIT_STORAGE_PATH = userData;
		process.env.JOB_RADAR_DATA_DIR = join(userData, "data");
		process.env.RIVET_RUN_ENGINE = "1";
		process.env.RIVET_RUN_ENGINE_HOST = "127.0.0.1";
		process.env.RIVET_RUN_ENGINE_PORT = String(EngineAddress.port());
		process.env.RIVET_RUN_SERVICES = "0";
		process.env.NODE_ENV ??= "production";
		if (app.isPackaged) {
			process.env.RIVET_ENGINE_BINARY_PATH = join(process.resourcesPath, "engine", process.platform === "win32" ? "rivet-engine.exe" : "rivet-engine");
		} else if (!process.env.RIVET_ENGINE_BINARY_PATH) {
			throw new Error("Set RIVET_ENGINE_BINARY_PATH to a built rivet-engine binary to run the desktop app from source.");
		}
	}
}
