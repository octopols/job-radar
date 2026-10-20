import { Menu, Tray } from "electron";
import { AppIcon } from "./app-icon.ts";

interface TrayActions {
	open: () => void;
	quit: () => void;
}

export class AppTray {
	#tray: Tray | null = null;

	create(actions: TrayActions): void {
		this.#tray = new Tray(AppIcon.tray());
		this.#tray.setToolTip("Job Radar");
		this.#tray.on("click", actions.open);
		this.#tray.setContextMenu(
			Menu.buildFromTemplate([
				{ label: "Open Job Radar", click: actions.open },
				{ type: "separator" },
				{ label: "Quit Job Radar", click: actions.quit },
			]),
		);
	}

	destroy(): void {
		this.#tray?.destroy();
		this.#tray = null;
	}
}
