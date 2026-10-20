import { z } from "zod";

export const pushSubscriptionSchema = z.object({
	endpoint: z.string().url(),
	expirationTime: z.number().nullable().optional(),
	keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export type StoredPushSubscription = z.infer<typeof pushSubscriptionSchema>;

export interface PushMessage {
	title: string;
	body: string;
	url: string;
	tag: string;
}
