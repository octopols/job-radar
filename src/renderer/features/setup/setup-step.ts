import type { SeekerSnapshot } from "@shared/types/seeker.ts";

export type SetupStep = "ai" | "resume" | "preferences" | "applying" | "companies";

export class SetupSteps {
	static current(snapshot: SeekerSnapshot, aiReady: boolean, isDesktop: boolean): SetupStep | null {
		if (!aiReady) {
			return "ai";
		}
		if (!snapshot.profile) {
			return "resume";
		}
		if (!snapshot.preferencesSet) {
			return "preferences";
		}
		if (isDesktop && !snapshot.applicant && !snapshot.applicantSkipped && snapshot.follows.length === 0) {
			return "applying";
		}
		return snapshot.follows.length === 0 ? "companies" : null;
	}
}
