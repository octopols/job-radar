import type { AutoApplySettings } from "./types/application.ts";
import type { Preferences } from "./types/profile.ts";

export const RESUME_MAX_BYTES = 4 * 1024 * 1024;

export const GOOD_FIT_SCORE = 70;

export const DEFAULT_PREFERENCES: Preferences = {
	workModes: ["remote", "hybrid", "onsite"],
	openToRelocation: false,
	workCountries: [],
	excludeKeywords: [],
};

export const DEFAULT_AUTO_APPLY: AutoApplySettings = { enabled: false, minScore: 85, dailyLimit: 10, autoSubmit: false };
