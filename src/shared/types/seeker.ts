import type { Applicant, AutoApplySettings } from "./application.ts";
import type { Profile, ResumeContact } from "./profile.ts";

export interface NotificationSettings {
	enabled: boolean;
	minScore: number;
}

export interface SeekerSnapshot {
	id: string;
	profile: Profile | null;
	resumeName: string | null;
	parsing: boolean;
	parseError: string | null;
	follows: string[];
	syncing: string[];
	boardErrors: Record<string, string>;
	notifications: NotificationSettings;
	pushDevices: number;
	preferencesSet: boolean;
	applicant: Applicant | null;
	autoApply: AutoApplySettings;
	resumeContact: ResumeContact | null;
	applicantSkipped: boolean;
	resumeFileName: string | null;
}

export interface ResumeFile {
	name: string;
	bytes: Uint8Array;
}
