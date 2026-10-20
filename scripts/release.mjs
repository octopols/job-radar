import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Arch, build as buildApp, Platform } from "electron-builder";
import { build as buildRenderer } from "vite";

const ENGINE_STAGE = "build/engine";
const ICON_ICO = "assets/icon.ico";
const ICON_PNG = "assets/icon.png";
const SETUP_DIR = "installer/src-tauri";
const VERSION = JSON.parse(readFileSync("package.json", "utf8")).version;

class ReleaseBuilder {
	#unpackedOnly;
	#arch;

	constructor(args) {
		this.#unpackedOnly = args.includes("--dir");
		const archIndex = args.indexOf("--arch");
		this.#arch = archIndex >= 0 ? args[archIndex + 1] : process.arch;
	}

	async run() {
		this.#stageEngine();
		execFileSync(process.execPath, ["scripts/build-desktop.mjs"], { stdio: "inherit" });
		await buildRenderer({ logLevel: "warn" });
		await buildApp({ targets: this.#targets(), config: ReleaseBuilder.#config(), publish: "never" });
		if (process.platform === "win32" && !this.#unpackedOnly) {
			this.#buildSetupWindow();
		}
	}

	#stageEngine() {
		const source = process.env.RIVET_ENGINE_BINARY_PATH;
		if (!source || !existsSync(source)) {
			throw new Error("Set RIVET_ENGINE_BINARY_PATH to a release build of rivet-engine (cargo build --release -p rivet-engine).");
		}
		rmSync(ENGINE_STAGE, { recursive: true, force: true });
		mkdirSync(ENGINE_STAGE, { recursive: true });
		cpSync(source, join(ENGINE_STAGE, process.platform === "win32" ? "rivet-engine.exe" : "rivet-engine"));
	}

	#targets() {
		const arch = Arch[this.#arch];
		if (arch === undefined) {
			throw new Error(`Unsupported architecture ${this.#arch}. Use x64 or arm64.`);
		}
		const platform = Platform.current();
		if (this.#unpackedOnly) {
			return platform.createTarget("dir", arch);
		}
		const targets = { win32: ["nsis"], darwin: ["dmg", "zip"], linux: ["AppImage", "tar.gz"] }[process.platform];
		return platform.createTarget(targets, arch);
	}

	#buildSetupWindow() {
		const payload = resolve("release", `JobRadar-${VERSION}-core.exe`);
		const env = {
			...process.env,
			JOB_RADAR_PAYLOAD: payload,
			JOB_RADAR_UNPACKED_BYTES: String(ReleaseBuilder.#size("release/win-unpacked")),
			JOB_RADAR_VERSION: VERSION,
		};
		execFileSync("cargo", ["build", "--release", "--manifest-path", join(SETUP_DIR, "Cargo.toml")], { stdio: "inherit", env });
		cpSync(join(SETUP_DIR, "target", "release", "job-radar-setup.exe"), join("release", `JobRadar-Setup-${VERSION}.exe`));
	}

	static #size(path) {
		const stats = statSync(path);
		return stats.isDirectory() ? readdirSync(path).reduce((total, entry) => total + ReleaseBuilder.#size(join(path, entry)), 0) : stats.size;
	}

	static #config() {
		return {
			appId: "dev.jobradar.desktop",
			productName: "Job Radar",
			copyright: "Copyright © 2026 Job Radar",
			directories: { output: "release" },
			files: [
				"dist-desktop/**/*",
				"!dist-desktop/*.map",
				"!dist-desktop/node_modules/**",
				"dist/renderer/**/*",
				"assets/**/*",
				"!assets/installer/**",
				"package.json",
			],

			extraResources: [
				{ from: ENGINE_STAGE, to: "engine" },
				{ from: "dist-desktop/node_modules", to: "node_modules" },
			],
			npmRebuild: false,
			win: { icon: ICON_ICO, artifactName: "JobRadar-${version}-core.${ext}" },

			nsis: {
				oneClick: false,
				perMachine: false,
				allowElevation: true,
				allowToChangeInstallationDirectory: false,

				guid: "254184f5-585d-5c6c-8882-5b9023794fc8",
				installerSidebar: "assets/installer/installer-sidebar.bmp",
				uninstallerSidebar: "assets/installer/installer-sidebar.bmp",
				installerHeader: "assets/installer/installer-header.bmp",
				shortcutName: "Job Radar",
				uninstallDisplayName: "Job Radar",
				createStartMenuShortcut: true,
				createDesktopShortcut: "always",
				runAfterFinish: true,
				installerIcon: ICON_ICO,
				uninstallerIcon: ICON_ICO,
				deleteAppDataOnUninstall: false,
			},
			mac: { category: "public.app-category.productivity", icon: ICON_PNG, artifactName: "JobRadar-${version}-mac-${arch}.${ext}" },

			dmg: {
				background: "assets/installer/dmg-background.png",
				window: { width: 540, height: 380 },
				contents: [
					{ x: 150, y: 200, type: "file" },
					{ x: 390, y: 200, type: "link", path: "/Applications" },
				],
			},
			linux: { category: "Office", icon: ICON_PNG, artifactName: "JobRadar-${version}-linux-${arch}.${ext}" },
		};
	}
}

await new ReleaseBuilder(process.argv.slice(2)).run();
