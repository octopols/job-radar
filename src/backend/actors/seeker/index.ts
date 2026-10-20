import { actor, event, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { BoardKey } from "../../../shared/board-key.ts";
import { RESUME_MAX_BYTES } from "../../../shared/constants.ts";
import {
	type Applicant,
	type ApplicationDraft,
	applicantSchema,
	type AutoApplyOutcome,
	type AutoApplySettings,
	autoApplySettingsSchema,
	type FormField,
	formFieldSchema,
	type SavedAnswer,
	type SavedAnswerInput,
	savedAnswerSchema,
} from "../../../shared/types/application.ts";
import type { DiscoveryResult } from "../../../shared/types/board.ts";
import { type Match, type MatchesAdded, type MatchStatus, PIPELINE_STATUSES, type SeekerMatch } from "../../../shared/types/match.ts";
import type { Posting } from "../../../shared/types/posting.ts";
import { type Profile, profileSchema } from "../../../shared/types/profile.ts";
import { type PushMessage, pushSubscriptionSchema, type StoredPushSubscription } from "../../../shared/types/push.ts";
import type { ResumeFile, SeekerSnapshot } from "../../../shared/types/seeker.ts";
import { careerAssistant } from "../../ai/career-assistant.ts";
import { BackendConfig } from "../../config.ts";
import type { Registry } from "../../registry.ts";
import { companyFinder } from "../../services/company-finder.ts";
import { pushSender } from "../../services/push-sender.ts";
import { ReferencedPages } from "../../services/referenced-pages.ts";
import { MatchStore } from "./match-store.ts";
import { ProfileSync } from "./profile-sync.ts";
import { ResumeStore } from "./resume-store.ts";
import { SavedAnswerStore } from "./saved-answer-store.ts";
import { SeekerSchema } from "./schema.ts";
import { SeekerNotifier } from "./seeker-notifier.ts";
import { type SeekerContext, type SeekerState, SeekerStates } from "./state.ts";

const FOLLOW_UP_ALARM = "followUpDue";
const FOLLOW_UP_ALARM_EARLY_TOLERANCE_MS = 5_000;
const DAY_MS = 86_400_000;
const MAX_UNTOUCHED_MATCHES_LISTED = 500;
const MAX_SAVED_ANSWERS_IN_PROMPT = 120;
const MIN_NOTIFICATION_SCORE = 40;
const MIN_PASTED_RESUME_LENGTH = 50;
const MIN_COMPANY_QUERY_LENGTH = 2;

export const seeker = actor({
	createState: (c): SeekerState => SeekerStates.initial(c.key[0] as string),

	options: {
		actionTimeout: 300_000,
	},

	db: db({ onMigrate: SeekerSchema.migrate }),

	events: {
		snapshot: event<SeekerSnapshot>(),
		matchesAdded: event<MatchesAdded>(),
		matchUpdated: event<SeekerMatch>(),
		matchesReset: event<null>(),
		notification: event<PushMessage>(),
	},

	onCreate: async (c) => {
		await c.client<Registry>().directory.getOrCreate([BackendConfig.directoryKey]).seekerJoined(c.key[0] as string);
	},

	onWake: (c) => {
		SeekerStates.fillFieldsAddedLater(c.state);
		if (c.state.profile && SeekerStates.scoredWithOlderScorer(c.state)) {
			void c.keepAwake(new ProfileSync(c).apply(c.state.profile));
		}
	},

	actions: {
		snapshot: (c): SeekerSnapshot => SeekerStates.snapshot(c.state),

		uploadResume: async (c, fileName: string, bytes: Uint8Array) => {
			SeekerRequirements.assertResumeFits(bytes);
			new ProfileSync(c).startReadingResume(fileName, () => careerAssistant.profileFromFile(fileName, bytes));
			await ResumeUploads.keep(c, fileName, bytes);
		},

		pasteResume: (c, text: string) => {
			if (text.trim().length < MIN_PASTED_RESUME_LENGTH) {
				throw new UserError("Paste the full resume text.", { code: "resume_too_short" });
			}
			new ProfileSync(c).startReadingResume("Pasted resume", () => careerAssistant.profileFromText(text));
		},

		setResumeFile: async (c, fileName: string, bytes: Uint8Array) => {
			SeekerRequirements.assertResumeFits(bytes);
			await ResumeUploads.keep(c, fileName, bytes);
		},

		resumeFile: (c): Promise<ResumeFile | null> => new ResumeStore(c.db).get(),

		updateProfile: async (c, profile: Profile) => {
			c.state.preferencesSet = true;
			await new ProfileSync(c).apply(profileSchema.parse(profile));
		},

		skipApplicantSetup: (c) => {
			c.state.applicantSkipped = true;
			SeekerStates.publish(c);
		},

		setApplicant: (c, applicant: Applicant) => {
			const parsed = applicantSchema.safeParse(applicant);
			if (!parsed.success) {
				throw new UserError(parsed.error.issues[0]?.message ?? "Check your application details.", { code: "applicant_invalid" });
			}
			c.state.applicant = parsed.data;
			SeekerStates.publish(c);
		},

		draftApplication: async (c, boardKey: string, postingId: string, fields: FormField[]): Promise<ApplicationDraft> => {
			const match = await new MatchStore(c.db).require(boardKey, postingId);
			const profile = SeekerRequirements.profile(c.state);
			const applicant = SeekerRequirements.applicant(c.state);
			const posting = await BoardPostings.require(c, boardKey, postingId);
			const formFields = formFieldSchema.array().parse(fields);
			const [savedAnswers, referencedPages] = await Promise.all([
				new SavedAnswerStore(c.db).list(MAX_SAVED_ANSWERS_IN_PROMPT),
				ReferencedPages.forFields(formFields),
			]);
			return careerAssistant.draftApplication({ applicant, savedAnswers, profile, company: match.company, posting, fields: formFields, referencedPages });
		},

		rememberAnswers: async (c, company: string, answers: SavedAnswerInput[]) => {
			await new SavedAnswerStore(c.db).remember(company, savedAnswerSchema.array().parse(answers), c.state.applicant);
		},

		savedAnswers: (c): Promise<SavedAnswer[]> => new SavedAnswerStore(c.db).list(Number.MAX_SAFE_INTEGER),

		updateSavedAnswer: async (c, questionKey: string, answer: string) => {
			const parsed = savedAnswerSchema.shape.answer.safeParse(answer);
			if (!parsed.success) {
				throw new UserError("Write an answer, or delete this one instead.", { code: "answer_empty" });
			}
			await new SavedAnswerStore(c.db).update(questionKey, parsed.data);
		},

		forgetSavedAnswer: async (c, questionKey: string) => {
			await new SavedAnswerStore(c.db).forget(questionKey);
		},

		follow: (c, boardKeys: string[]) => {
			if (!c.state.profile) {
				throw new UserError("Add your resume or profile first so boards know what to match.", { code: "profile_missing" });
			}
			const newBoardKeys = [...new Set(boardKeys)].filter((boardKey) => !c.state.follows.includes(boardKey));
			newBoardKeys.forEach(BoardKey.parse);
			c.state.follows.push(...newBoardKeys);
			void c.keepAwake(new ProfileSync(c).syncBoards(newBoardKeys));
		},

		retryBoards: (c, boardKeys: string[]) => {
			const followedBoardKeys = boardKeys.filter((boardKey) => c.state.follows.includes(boardKey));
			void c.keepAwake(new ProfileSync(c).syncBoards(followedBoardKeys));
		},

		unfollow: async (c, boardKey: string) => {
			c.state.follows = c.state.follows.filter((followed) => followed !== boardKey);
			delete c.state.boardErrors[boardKey];
			await c.client<Registry>().board.get([boardKey]).unfollow(c.state.id);
			await new MatchStore(c.db).clearUntouched(boardKey);
			SeekerStates.publish(c);
			c.broadcast("matchesReset", null);
		},

		findCompany: async (_c, query: string): Promise<DiscoveryResult> => {
			if (query.trim().length < MIN_COMPANY_QUERY_LENGTH) {
				throw new UserError("Type a company name or paste its careers link.", { code: "query_too_short" });
			}
			return companyFinder.find(query);
		},

		matches: (c): Promise<SeekerMatch[]> => new MatchStore(c.db).list(MAX_UNTOUCHED_MATCHES_LISTED),

		posting: async (c, boardKey: string, postingId: string): Promise<Posting | null> => {
			await new MatchStore(c.db).require(boardKey, postingId);
			return c.client<Registry>().board.get([boardKey]).posting(postingId);
		},

		receiveNewMatches: async (c, matches: Match[]) => {
			const added = await new MatchStore(c.db).upsert(matches, true);
			if (added.length === 0) {
				return;
			}
			c.broadcast("matchesAdded", { matches: added, live: true });
			await new SeekerNotifier(c).newMatches(added);
		},

		explainFit: async (c, boardKey: string, postingId: string): Promise<string> => {
			const store = new MatchStore(c.db);
			const match = await store.require(boardKey, postingId);
			if (match.explanation) {
				return match.explanation;
			}
			const profile = SeekerRequirements.profile(c.state);
			const posting = await BoardPostings.require(c, boardKey, postingId);
			const explanation = await careerAssistant.explainFit(profile, match.company, posting);
			await store.setExplanation(boardKey, postingId, explanation);
			return explanation;
		},

		setStatus: async (c, boardKey: string, postingId: string, status: MatchStatus): Promise<SeekerMatch> => {
			const store = new MatchStore(c.db);
			const match = await store.require(boardKey, postingId);
			const now = Date.now();
			const isFirstApplication = status === "applied" && match.appliedAt === null;
			const appliedAt = PIPELINE_STATUSES.includes(status) ? (match.appliedAt ?? now) : null;
			const followUpAt = status === "applied" ? (isFirstApplication ? now + BackendConfig.followUpDelayMs : match.followUpAt) : null;
			await store.setStatus(boardKey, postingId, status, appliedAt, followUpAt);
			if (isFirstApplication && followUpAt !== null) {
				await c.schedule.at(followUpAt, FOLLOW_UP_ALARM, boardKey, postingId);
			}
			return store.require(boardKey, postingId);
		},

		setNotes: async (c, boardKey: string, postingId: string, notes: string): Promise<SeekerMatch> => {
			const store = new MatchStore(c.db);
			await store.require(boardKey, postingId);
			await store.setNotes(boardKey, postingId, notes);
			return store.require(boardKey, postingId);
		},

		snoozeFollowUp: async (c, boardKey: string, postingId: string, days: number): Promise<SeekerMatch> => {
			const store = new MatchStore(c.db);
			await store.require(boardKey, postingId);
			const followUpAt = Date.now() + Math.max(1, Math.round(days)) * DAY_MS;
			await store.setFollowUp(boardKey, postingId, followUpAt);
			await c.schedule.at(followUpAt, FOLLOW_UP_ALARM, boardKey, postingId);
			return store.require(boardKey, postingId);
		},

		followUpDue: async (c, boardKey: string, postingId: string) => {
			const store = new MatchStore(c.db);
			const match = await store.find(boardKey, postingId);
			const alarmIsCurrent = match?.status === "applied" && match.followUpAt !== null && match.followUpAt <= Date.now() + FOLLOW_UP_ALARM_EARLY_TOLERANCE_MS;
			if (!match || !alarmIsCurrent) {
				return;
			}
			await store.markFollowUpDue(boardKey, postingId);
			const dueMatch = { ...match, followUpDue: true };
			c.broadcast("matchUpdated", dueMatch);
			await new SeekerNotifier(c).followUpDue(dueMatch);
		},

		setAutoApply: (c, settings: AutoApplySettings) => {
			c.state.autoApply = autoApplySettingsSchema.parse(settings);
			SeekerStates.publish(c);
		},

		autoApplyQueue: async (c): Promise<SeekerMatch[]> => {
			const settings = c.state.autoApply;
			if (!settings.enabled) {
				return [];
			}
			const store = new MatchStore(c.db);
			const startOfToday = new Date().setHours(0, 0, 0, 0);
			const remainingToday = settings.dailyLimit - (await store.countAutoAppliedSince(startOfToday));
			return remainingToday > 0 ? store.autoApplyCandidates(settings.minScore, remainingToday) : [];
		},

		recordAutoApply: async (c, boardKey: string, postingId: string, outcome: AutoApplyOutcome, note: string | null): Promise<SeekerMatch> => {
			const store = new MatchStore(c.db);
			await store.require(boardKey, postingId);
			await store.recordAutoApply(boardKey, postingId, outcome, note);
			const match = await store.require(boardKey, postingId);
			c.broadcast("matchUpdated", match);
			await new SeekerNotifier(c).autoApplied(match, outcome, note);
			return match;
		},

		pushPublicKey: (): string => pushSender.publicKey,

		subscribePush: (c, subscription: StoredPushSubscription) => {
			const parsed = pushSubscriptionSchema.parse(subscription);
			c.state.pushSubscriptions = [...c.state.pushSubscriptions.filter((existing) => existing.endpoint !== parsed.endpoint), parsed];
			c.state.notifications.enabled = true;
			SeekerStates.publish(c);
		},

		unsubscribePush: (c, endpoint: string) => {
			c.state.pushSubscriptions = c.state.pushSubscriptions.filter((existing) => existing.endpoint !== endpoint);
			c.state.notifications.enabled = c.state.pushSubscriptions.length > 0;
			SeekerStates.publish(c);
		},

		setNotificationsEnabled: (c, enabled: boolean) => {
			c.state.notifications.enabled = enabled;
			SeekerStates.publish(c);
		},

		setNotificationMinScore: (c, minScore: number) => {
			c.state.notifications.minScore = Math.max(MIN_NOTIFICATION_SCORE, Math.min(100, Math.round(minScore)));
			SeekerStates.publish(c);
		},

		sendTestNotification: (c): Promise<number> => new SeekerNotifier(c).test(),
	},
});

class SeekerRequirements {
	static assertResumeFits(bytes: Uint8Array): void {
		if (bytes.byteLength > RESUME_MAX_BYTES) {
			throw new UserError(`Resumes must be under ${RESUME_MAX_BYTES / 1024 / 1024} MB.`, { code: "resume_too_large" });
		}
	}

	static profile(state: SeekerState): Profile {
		if (!state.profile) {
			throw new UserError("Add your profile first.", { code: "profile_missing" });
		}
		return state.profile;
	}

	static applicant(state: SeekerState): Applicant {
		if (!state.applicant) {
			throw new UserError("Add your application details first.", { code: "applicant_missing" });
		}
		return state.applicant;
	}
}

class ResumeUploads {
	static async keep(c: SeekerContext, fileName: string, bytes: Uint8Array): Promise<void> {
		await new ResumeStore(c.db).put(fileName, bytes);
		c.state.resumeFileName = fileName;
		SeekerStates.publish(c);
	}
}

class BoardPostings {
	static async require(c: SeekerContext, boardKey: string, postingId: string): Promise<Posting> {
		const posting = await c.client<Registry>().board.get([boardKey]).posting(postingId);
		if (!posting) {
			throw new UserError("The company removed this posting.", { code: "posting_missing" });
		}
		return posting;
	}
}
