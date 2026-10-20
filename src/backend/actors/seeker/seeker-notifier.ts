import type { AutoApplyOutcome } from "../../../shared/types/application.ts";
import type { SeekerMatch } from "../../../shared/types/match.ts";
import type { PushMessage } from "../../../shared/types/push.ts";
import { pushSender } from "../../services/push-sender.ts";
import { type SeekerContext, SeekerStates } from "./state.ts";

const APP_URL = "/";

type NotifiedOutcome = Exclude<AutoApplyOutcome, "failed">;

const AUTO_APPLY_MESSAGES: Record<NotifiedOutcome, (match: SeekerMatch, note: string | null) => { title: string; body: string }> = {
	submitted: (match) => ({ title: `Applied to ${match.company}`, body: match.title }),
	ready: (match) => ({ title: `${match.company} application is ready`, body: `${match.title}. Review it and press Submit.` }),
	"needs-you": (match, note) => ({ title: `${match.company} application needs you`, body: note ?? `Finish your application for ${match.title}.` }),
};

export class SeekerNotifier {
	readonly #c: SeekerContext;

	constructor(c: SeekerContext) {
		this.#c = c;
	}

	async newMatches(added: SeekerMatch[]): Promise<void> {
		const worthNotifying = added.filter((match) => match.score >= this.#c.state.notifications.minScore).sort((a, b) => b.score - a.score);
		const [best, ...others] = worthNotifying;
		if (!best) {
			return;
		}
		const andMore = others.length > 0 ? ` and ${others.length} more` : "";
		await this.send({ title: `New match at ${best.company}: fit ${best.score}`, body: `${best.title}${andMore}`, url: APP_URL, tag: `match:${best.boardKey}` });
	}

	async followUpDue(match: SeekerMatch): Promise<void> {
		await this.send({
			title: `Time to follow up with ${match.company}`,
			body: `You applied for ${match.title}. No news yet? A short check-in often helps.`,
			url: APP_URL,
			tag: `follow-up:${match.boardKey}:${match.postingId}`,
		});
	}

	async autoApplied(match: SeekerMatch, outcome: AutoApplyOutcome, note: string | null): Promise<void> {
		if (outcome === "failed") {
			return;
		}
		const { title, body } = AUTO_APPLY_MESSAGES[outcome](match, note);
		await this.send({ title, body, url: APP_URL, tag: `auto-apply:${match.boardKey}:${match.postingId}` });
	}

	test(): Promise<number> {
		return this.send({ title: "Job Radar notifications are on", body: "New matches and follow-up reminders will appear here.", url: APP_URL, tag: "test" });
	}

	async send(message: PushMessage): Promise<number> {
		if (!this.#c.state.notifications.enabled) {
			return 0;
		}
		this.#c.broadcast("notification", message);
		return this.#pushToBrowsers(message);
	}

	async #pushToBrowsers(message: PushMessage): Promise<number> {
		const c = this.#c;
		const subscriptions = c.state.pushSubscriptions;
		if (subscriptions.length === 0) {
			return 0;
		}
		const deliveries = await Promise.all(subscriptions.map(async (subscription) => ({ subscription, result: await pushSender.send(subscription, message) })));
		const endpointsOf = (result: string): string[] => deliveries.filter((delivery) => delivery.result === result).map((delivery) => delivery.subscription.endpoint);

		const expiredEndpoints = new Set(endpointsOf("expired"));
		if (expiredEndpoints.size > 0) {
			c.state.pushSubscriptions = subscriptions.filter((subscription) => !expiredEndpoints.has(subscription.endpoint));
			SeekerStates.publish(c);
		}
		const failedCount = endpointsOf("failed").length;
		if (failedCount > 0) {
			c.log.warn({ msg: "push delivery failed for some devices, check network access to the browser push service", failed: failedCount });
		}
		return endpointsOf("sent").length;
	}
}
