import type { ApplicationStatus } from "@shared/ipc/apply.ts";
import type { DesktopBridge } from "@shared/ipc/desktop-bridge.ts";

declare global {
	interface Window {
		jobRadarDesktop?: DesktopBridge;
	}
}

export const desktop: DesktopBridge | null = window.jobRadarDesktop ?? null;

if (desktop) {
	document.documentElement.dataset.titlebar = desktop.platform === "darwin" ? "left" : "right";
}

export class ApplicationStatuses {
	static readonly #statuses = new Map<string, ApplicationStatus>();
	static readonly #listeners = new Set<() => void>();

	static {
		desktop?.onApplicationStatus((status) => {
			ApplicationStatuses.#statuses.set(ApplicationStatuses.key(status.boardKey, status.postingId), status);
			for (const listener of ApplicationStatuses.#listeners) {
				listener();
			}
		});
	}

	static key(boardKey: string, postingId: string): string {
		return `${boardKey}/${postingId}`;
	}

	static get(key: string): ApplicationStatus | null {
		return ApplicationStatuses.#statuses.get(key) ?? null;
	}

	static subscribe(listener: () => void): () => void {
		ApplicationStatuses.#listeners.add(listener);
		return () => {
			ApplicationStatuses.#listeners.delete(listener);
		};
	}
}

export class DesktopNotifications {
	static show(message: { title: string; body: string; tag: string }, force = false): void {
		if (!desktop || (!force && document.visibilityState === "visible" && document.hasFocus())) {
			return;
		}
		const notification = new Notification(message.title, { body: message.body, tag: message.tag, icon: "/icon.svg" });
		notification.onclick = () => desktop?.focusWindow();
	}
}
