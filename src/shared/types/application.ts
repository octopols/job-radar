import { z } from "zod";

export const applicantSchema = z.object({
	fullName: z.string().trim().min(1, "Add your full name."),
	email: z.string().trim().min(3, "Add your email address."),
	phone: z.string().trim(),
	location: z.string().trim(),
	linkedinUrl: z.string().trim(),
	websiteUrl: z.string().trim(),
	workAuthorization: z.string().trim(),
	noticePeriod: z.string().trim(),
	salaryExpectation: z.string().trim(),
	otherFacts: z.string().trim(),
	pastEmployers: z.string().trim().default(""),
	veteran: z.enum(["no", "yes", "decline"]).default("no"),
	disability: z.enum(["no", "yes", "decline"]).default("no"),
	gender: z.string().trim().default(""),
	ethnicity: z.string().trim().default(""),
	over18: z.boolean().default(true),
	nonCompete: z.boolean().default(false),
	heardFrom: z.string().trim().default("Company careers page"),
});

export type Applicant = z.infer<typeof applicantSchema>;

export const autoApplySettingsSchema = z.object({
	enabled: z.boolean(),
	minScore: z.number().int().min(70).max(100),
	dailyLimit: z.number().int().min(1).max(50),
	autoSubmit: z.boolean().default(false),
});

export type AutoApplySettings = z.infer<typeof autoApplySettingsSchema>;

export type AutoApplyOutcome = "ready" | "submitted" | "needs-you" | "failed";

export const formFieldKindSchema = z.enum(["text", "email", "tel", "url", "number", "date", "textarea", "select", "combobox", "radio", "checkbox", "file"]);

export const formFieldSchema = z.object({
	id: z.string(),
	kind: formFieldKindSchema,
	label: z.string(),
	required: z.boolean(),
	options: z.array(z.string()),
	multiple: z.boolean(),
	maxLength: z.number().nullable(),
});

export type FormField = z.infer<typeof formFieldSchema>;
export type FormFieldKind = z.infer<typeof formFieldKindSchema>;

export const applicationDraftSchema = z.object({
	answers: z.array(
		z.object({
			fieldId: z.string(),
			value: z.string().nullable(),
			choices: z.array(z.string()),
			reviewNote: z.string().nullable(),
		}),
	),
});

export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;
export type ApplicationAnswer = ApplicationDraft["answers"][number];

export const savedAnswerSchema = z.object({
	question: z.string().trim().min(1).max(500),
	answer: z.string().trim().min(1).max(5_000),
});

export type SavedAnswerInput = z.infer<typeof savedAnswerSchema>;

export interface SavedAnswer extends SavedAnswerInput {
	key: string;
	company: string;
	updatedAt: number;
}

export interface ReferencedPage {
	url: string;
	text: string;
}
