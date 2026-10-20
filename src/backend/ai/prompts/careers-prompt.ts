import { z } from "zod";

const careersLeadSchema = z.object({
	careersUrl: z.string().nullable(),
	boardUrl: z.string().nullable(),
	provider: z.string().nullable(),
});

export type CareersLead = z.infer<typeof careersLeadSchema>;

export class CareersPrompt {
	static readonly schema = careersLeadSchema;

	static readonly instructions = [
		"Find where this company publishes its open jobs.",
		"careersUrl is the official careers page. boardUrl is the hosted job board it links to, for example on greenhouse.io, lever.co, ashbyhq.com, smartrecruiters.com, recruitee.com, workable.com, personio.de or myworkdayjobs.com.",
		"Open the careers page to find the boardUrl when search results do not show it.",
		"provider is the name of the hiring system, like Greenhouse or Workday.",
		"Use null for anything you cannot confirm. Never invent URLs.",
	].join(" ");

	static render(company: string): string {
		return `Company: ${company}`;
	}
}
