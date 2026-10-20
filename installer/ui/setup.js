const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const appWindow = window.__TAURI__.window.getCurrentWindow();

class SetupScreens {
	#info = null;
	#installedDir = null;

	async start() {
		this.#info = await invoke("info");
		for (const option of document.querySelectorAll("input[name=scope]")) {
			option.addEventListener("change", () => this.#showScope());
		}
		this.#showScope();

		document.getElementById("install").addEventListener("click", () => this.#install());
		document.getElementById("retry").addEventListener("click", () => this.#show("choose"));
		document.getElementById("open").addEventListener("click", () => this.#openApp());
		document.getElementById("finish").addEventListener("click", () => appWindow.close());
		document.getElementById("close").addEventListener("click", () => appWindow.close());
		document.getElementById("minimize").addEventListener("click", () => appWindow.minimize());
		await listen("progress", (event) => this.#progress(event.payload.fraction));
		this.#show("choose");
	}

	#scope() {
		return document.querySelector("input[name=scope]:checked").value;
	}

	#showScope() {
		const forUser = this.#scope() === "user";
		const dir = forUser ? this.#info.userDir : this.#info.machineDir;
		const installedVersion = forUser ? this.#info.userInstalledVersion : this.#info.machineInstalledVersion;
		document.getElementById("location").textContent = `Installs to ${dir}`;
		document.getElementById("install").textContent = SetupScreens.#installLabel(installedVersion, this.#info.version);
	}

	static #installLabel(installedVersion, version) {
		if (!installedVersion) {
			return "Install";
		}
		return installedVersion === version ? "Reinstall" : `Update to ${version}`;
	}

	async #install() {
		this.#progress(0);
		this.#show("installing");
		try {
			this.#installedDir = await invoke("install", { scope: this.#scope() });
			this.#show("done");
		} catch (error) {
			document.getElementById("error").textContent = String(error);
			this.#show("failed");
		}
	}

	async #openApp() {
		try {
			await invoke("launch", { dir: this.#installedDir });
			await appWindow.close();
		} catch (error) {
			document.getElementById("error").textContent = String(error);
			this.#show("failed");
		}
	}

	#progress(fraction) {
		const percent = Math.round(fraction * 100);
		document.getElementById("progress-fill").style.width = `${percent}%`;
		document.querySelector(".progress").setAttribute("aria-valuenow", String(percent));
		document.getElementById("progress-text").textContent = percent < 100 ? `${percent}%` : "Finishing up";
	}

	#show(name) {
		document.body.dataset.screen = name;
		for (const screen of document.querySelectorAll(".screen")) {
			screen.hidden = screen.id !== name;
		}
		document.querySelector(`#${name} button`)?.focus();
	}
}

new SetupScreens().start();
