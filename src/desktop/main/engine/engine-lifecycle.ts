import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { ENGINE_START_TIMEOUT_MS, ENGINE_STOP_TIMEOUT_MS, EngineAddress } from "../app/config.ts";

export class EngineLifecycle {
	static async waitUntilHealthy(): Promise<void> {
		const deadline = Date.now() + ENGINE_START_TIMEOUT_MS;
		while (Date.now() < deadline) {
			const healthy = await fetch(`${EngineAddress.endpoint()}/health`)
				.then((response) => response.ok)
				.catch(() => false);
			if (healthy) {
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		throw new Error("The local Rivet engine did not start in time.");
	}

	static stop(): number | null {
		const stamp = EngineLifecycle.#stamp();
		if (!stamp) {
			return null;
		}
		try {
			process.kill(stamp.pid);
			return stamp.pid;
		} catch {
			return null;
		}
	}

	static async stopIfMoved(): Promise<void> {
		const stamp = EngineLifecycle.#stamp();
		if (stamp && stamp.endpoint !== EngineAddress.endpoint() && EngineLifecycle.#isRunning(stamp.pid)) {
			await EngineLifecycle.stopAndWait();
		}
	}

	static #stamp(): { pid: number; endpoint: string } | null {
		const stampPath = join(app.getPath("userData"), ".rivetkit", "var", "engine", "runtime.json");
		try {
			return existsSync(stampPath) ? (JSON.parse(readFileSync(stampPath, "utf8")) as { pid: number; endpoint: string }) : null;
		} catch {
			return null;
		}
	}

	static async stopAndWait(): Promise<void> {
		const pid = EngineLifecycle.stop();
		const deadline = Date.now() + ENGINE_STOP_TIMEOUT_MS;
		while (pid !== null && Date.now() < deadline && EngineLifecycle.#isRunning(pid)) {
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}

	static #isRunning(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}
}
