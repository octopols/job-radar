import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { FIXTURE_BOARD_PORT, TEST_ENGINE_PORT } from "./tests/support/ports.ts";

export default defineConfig({
	resolve: {
		alias: {
			"@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
		},
	},
	test: {
		include: ["tests/**/*.test.ts"],
		testTimeout: 60_000,
		hookTimeout: 60_000,
		fileParallelism: false,
		env: {
			RIVETKIT_STORAGE_PATH: join(tmpdir(), "job-radar-tests"),
			RIVET_RUN_ENGINE_PORT: String(TEST_ENGINE_PORT),

			RIVET_RUN_SERVICES: "0",
			JOB_RADAR_BOARD_BASE_URL: `http://127.0.0.1:${FIXTURE_BOARD_PORT}`,
			JOB_RADAR_DIRECTORY_KEY: "test",
			JOB_RADAR_FOLLOW_UP_MINUTES: "0.05",

			NODE_TLS_REJECT_UNAUTHORIZED: "0",
		},
	},
});
