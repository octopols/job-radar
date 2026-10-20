import type { ActorContextOf } from "rivetkit";
import { DEFAULT_AUTO_APPLY } from "../../../shared/constants.ts";
import { applicantSchema, autoApplySettingsSchema } from "../../../shared/types/application.ts";
import type { StoredPushSubscription } from "../../../shared/types/push.ts";
import type { NotificationSettings, SeekerSnapshot } from "../../../shared/types/seeker.ts";
import { ProfileMigration } from "../../matching/profile-migration.ts";
import { SCORER_VERSION } from "../../matching/scorer.ts";
import type { seeker } from "./index.ts";

export type SeekerContext = ActorContextOf<typeof seeker>;

export interface SeekerState extends Omit<SeekerSnapshot, "pushDevices"> {
	pushSubscriptions: StoredPushSubscription[];
	scorerVersion: number;
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = { enabled: false, minScore: 75 };

export class SeekerStates {
	static initial(id: string): SeekerState {
		return {
			id,
			profile: null,
			resumeName: null,
			parsing: false,
			parseError: null,
			follows: [],
			syncing: [],
			boardErrors: {},
			notifications: { ...DEFAULT_NOTIFICATIONS },
			pushSubscriptions: [],
			scorerVersion: SCORER_VERSION,
			preferencesSet: false,
			applicant: null,
			autoApply: { ...DEFAULT_AUTO_APPLY },
			resumeContact: null,
			applicantSkipped: false,
			resumeFileName: null,
		};
	}

	static fillFieldsAddedLater(state: SeekerState): void {
		state.notifications ??= { ...DEFAULT_NOTIFICATIONS };
		state.pushSubscriptions ??= [];
		state.preferencesSet ??= false;
		state.applicant = state.applicant ? applicantSchema.parse(state.applicant) : null;
		state.resumeContact ??= null;
		state.autoApply = autoApplySettingsSchema.parse(state.autoApply ?? DEFAULT_AUTO_APPLY);
		state.applicantSkipped ??= false;
		state.resumeFileName ??= null;
		if (state.profile) {
			state.profile = ProfileMigration.upgrade(state.profile);
		}
	}

	static scoredWithOlderScorer(state: SeekerState): boolean {
		return state.profile !== null && state.scorerVersion !== SCORER_VERSION;
	}

	static snapshot(state: SeekerState): SeekerSnapshot {
		const { pushSubscriptions, scorerVersion: _scorerVersion, ...snapshot } = state;
		return { ...snapshot, pushDevices: pushSubscriptions.length };
	}

	static publish(c: SeekerContext): void {
		c.broadcast("snapshot", SeekerStates.snapshot(c.state));
	}
}
