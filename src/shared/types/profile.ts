import { z } from "zod";

export type Seniority = "intern" | "junior" | "mid" | "senior" | "staff";

export const SENIORITY_ORDER: readonly Seniority[] = ["intern", "junior", "mid", "senior", "staff"];

export const resumeProfileSchema = z.object({
	headline: z.string(),
	seniority: z.enum(["intern", "junior", "mid", "senior", "staff"]),
	yearsExperience: z.number().nullable(),
	targetTitles: z.array(z.string()),
	skills: z.array(z.string()),
	locations: z.array(z.string()),
});

export const resumeContactSchema = z.object({
	fullName: z.string(),
	email: z.string(),
	phone: z.string(),
	linkedinUrl: z.string(),
	websiteUrl: z.string(),
	employers: z.array(z.string()),
});

export const resumeReadingSchema = resumeProfileSchema.extend({ contact: resumeContactSchema });

export const preferencesSchema = z.object({
	workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).min(1),
	openToRelocation: z.boolean(),
	workCountries: z.array(z.string()),
	excludeKeywords: z.array(z.string()),
});

export const profileSchema = resumeProfileSchema.extend(preferencesSchema.shape);

export type ResumeContact = z.infer<typeof resumeContactSchema>;
export type ResumeReading = z.infer<typeof resumeReadingSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Profile = z.infer<typeof profileSchema>;
