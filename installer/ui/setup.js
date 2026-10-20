const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const appWindow = window.__TAURI__.window.getCurrentWindow();

class SetupScreens {
	#info = null;
	#installedDir = null;

	async start() {
		this.#info = await invoke("info");
		const button = document.getElementById("install");
		if (this.#info.installedVersion) {
			button.textContent = this.#info.installedVersion === this.#info.version ? "Reinstall" : `Update to ${this.#info.version}`;
		}
		for (const option of document.querySelectorAll("input[name=scope]")) {
			option.addEventListener("change", () => this.#showLocation());
		}
		this.#showLocation();

		button.addEventListener("click", () => this.#install());
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

	#showLocation() {
		const dir = this.#scope() === "user" ? this.#info.userDir : this.#info.machineDir;
		document.getElementById("location").textContent = `Installs to ${dir}`;
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
