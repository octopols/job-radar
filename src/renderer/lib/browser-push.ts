import type { SeekerConnection } from "./rivet.ts";

const SERVICE_WORKER_URL = "/sw.js";

export type PushSupport = "supported" | "unsupported" | "blocked";

export class BrowserPush {
	static support(): PushSupport {
		if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
			return "unsupported";
		}
		return Notification.permission === "denied" ? "blocked" : "supported";
	}

	static async currentEndpoint(): Promise<string | null> {
		if (BrowserPush.support() === "unsupported") {
			return null;
		}
		const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
		const subscription = await registration?.pushManager.getSubscription();
		return subscription?.endpoint ?? null;
	}

	static async enable(connection: SeekerConnection): Promise<void> {
		const permission = await Notification.requestPermission();
		if (permission !== "granted") {
			throw new Error("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
		}
		const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
		await navigator.serviceWorker.ready;
		const publicKey = await connection.pushPublicKey();
		const subscription =
			(await registration.pushManager.getSubscription()) ??
			(await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: BrowserPush.decodeKey(publicKey) }));
		await connection.subscribePush(subscription.toJSON() as Parameters<SeekerConnection["subscribePush"]>[0]);
	}

	static async disable(connection: SeekerConnection): Promise<void> {
		const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
		const subscription = await registration?.pushManager.getSubscription();
		if (subscription) {
			await connection.unsubscribePush(subscription.endpoint);
			await subscription.unsubscribe();
		}
	}

	private static decodeKey(base64Url: string): Uint8Array<ArrayBuffer> {
		const padded = `${base64Url}${"=".repeat((4 - (base64Url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
		const binary = atob(padded);
		const bytes = new Uint8Array(new ArrayBuffer(binary.length));
		for (let index = 0; index < binary.length; index++) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	}
}
