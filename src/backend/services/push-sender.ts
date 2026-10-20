import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webPush, { type PushSubscription, WebPushError } from "web-push";
import { z } from "zod";
import type { PushMessage, StoredPushSubscription } from "../../shared/types/push.ts";
import { BackendConfig } from "../config.ts";

const EXPIRED_SUBSCRIPTION_STATUSES = new Set([404, 410]);
const MESSAGE_TTL_SECONDS = 60 * 60 * 24;

const keysSchema = z.object({ publicKey: z.string(), privateKey: z.string() });

type VapidKeys = z.infer<typeof keysSchema>;

type DeliveryResult = "sent" | "expired" | "failed";

class PushSender {
	#keys: VapidKeys | null = null;

	get publicKey(): string {
		return this.#ensureKeys().publicKey;
	}

	async send(subscription: StoredPushSubscription, message: PushMessage): Promise<DeliveryResult> {
		this.#ensureKeys();
		try {
			await webPush.sendNotification(subscription as PushSubscription, JSON.stringify(message), { TTL: MESSAGE_TTL_SECONDS });
			return "sent";
		} catch (error) {
			if (error instanceof WebPushError && EXPIRED_SUBSCRIPTION_STATUSES.has(error.statusCode)) {
				return "expired";
			}
			return "failed";
		}
	}

	#ensureKeys(): VapidKeys {
		if (!this.#keys) {
			this.#keys = PushSender.loadOrCreateKeys();
			webPush.setVapidDetails(BackendConfig.pushSubject, this.#keys.publicKey, this.#keys.privateKey);
		}
		return this.#keys;
	}

	private static loadOrCreateKeys(): VapidKeys {
		const dataDir = BackendConfig.dataDir;
		const keysPath = join(dataDir, "vapid.json");
		if (existsSync(keysPath)) {
			return keysSchema.parse(JSON.parse(readFileSync(keysPath, "utf8")));
		}
		const keys = webPush.generateVAPIDKeys();
		mkdirSync(dataDir, { recursive: true });
		writeFileSync(keysPath, JSON.stringify(keys, null, 2));
		return keys;
	}
}

export const pushSender = new PushSender();
