import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { build } from "esbuild";

export const ADDON_MODULES_DIR = "dist-desktop/node_modules";

class NapiAddonStager {
	stage() {
		const rivetkitDir = realpathSync("node_modules/rivetkit");
		const addonDir = dirname(createRequire(join(rivetkitDir, "package.json")).resolve("@rivetkit/rivetkit-napi"));
		const binaries = readdirSync(addonDir).filter((file) => file.endsWith(".node") && file.includes(`${process.platform}-${process.arch}`));
		if (binaries.length === 0) {
			throw new Error(`No rivetkit NAPI binary for ${process.platform}-${process.arch} in ${addonDir}. Build it with pnpm build:force in rivetkit-napi.`);
		}
		const target = join(ADDON_MODULES_DIR, "@rivetkit", "rivetkit-napi");
		const files = ["package.json", "index.js", ...binaries];

		mkdirSync(target, { recursive: true });
		for (const file of files.filter((name) => !NapiAddonStager.#same(join(addonDir, name), join(target, name)))) {
			cpSync(join(addonDir, file), join(target, file), { preserveTimestamps: true });
		}
	}

	static #same(source, copy) {
		if (!existsSync(copy)) {
			return false;
		}
		const [a, b] = [statSync(source), statSync(copy)];
		return a.size === b.size && a.mtimeMs === b.mtimeMs;
	}
}

await build({
	entryPoints: ["src/desktop/main/index.ts"],
	outfile: "dist-desktop/main.mjs",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	external: ["electron"],

	banner: {
		js: [
			'import { createRequire as __createRequire } from "node:module";',
			'import { fileURLToPath as __fileURLToPath } from "node:url";',
			'import { dirname as __pathDirname } from "node:path";',
			"const require = __createRequire(import.meta.url);",
			"const __filename = __fileURLToPath(import.meta.url);",
			"const __dirname = __pathDirname(__filename);",
		].join("\n"),
	},
	sourcemap: true,
	logLevel: "info",
});

for (const [entry, name] of [
	["src/desktop/preload/app.ts", "preload"],
	["src/desktop/preload/apply/index.ts", "apply-preload"],
]) {
	await build({
		entryPoints: [entry],
		outfile: `dist-desktop/${name}.cjs`,
		bundle: true,
		platform: "node",
		format: "cjs",
		target: "node22",
		external: ["electron"],
		logLevel: "info",
	});
}

copyFileSync("src/desktop/splash/splash.html", "dist-desktop/splash.html");

new NapiAddonStager().stage();
