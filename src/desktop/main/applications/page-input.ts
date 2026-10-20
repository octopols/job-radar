import type { WebContents } from "electron";
import type { Point } from "../../../shared/ipc/apply.ts";

const KEYS = { Enter: 13, Escape: 27 } as const;

export class PageInput {
	readonly #contents: WebContents;

	constructor(contents: WebContents) {
		this.#contents = contents;
	}

	async start(): Promise<void> {
		if (!this.#contents.debugger.isAttached()) {
			this.#contents.debugger.attach("1.3");
		}

		await this.#send("Emulation.setFocusEmulationEnabled", { enabled: true });
		await this.#send("Page.bringToFront");
	}

	stop(): void {
		if (!this.#contents.isDestroyed() && this.#contents.debugger.isAttached()) {
			this.#contents.debugger.detach();
		}
	}

	async click({ x, y }: Point): Promise<void> {
		await this.#send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
		await this.#send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
		await this.#send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
	}

	async type(text: string): Promise<void> {
		await this.#send("Input.insertText", { text });
	}

	async press(key: keyof typeof KEYS): Promise<void> {
		for (const type of ["keyDown", "keyUp"]) {
			await this.#send("Input.dispatchKeyEvent", { type, key, code: key, windowsVirtualKeyCode: KEYS[key] });
		}
	}

	async setFiles(selector: string, files: string[]): Promise<boolean> {
		const { root } = (await this.#send("DOM.getDocument", { depth: 0 })) as { root: { nodeId: number } };
		const { nodeId } = (await this.#send("DOM.querySelector", { nodeId: root.nodeId, selector })) as { nodeId: number };
		if (!nodeId) {
			return false;
		}
		await this.#send("DOM.setFileInputFiles", { files, nodeId });
		return true;
	}

	#send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
		return this.#contents.debugger.sendCommand(method, params);
	}
}
