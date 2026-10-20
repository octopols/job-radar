import { z } from "zod";

export interface ApplyTargetInput {
	company: string;
	title: string;
	pageUrl: string;
	candidates: { index: number; text: string; href: string | null }[];
}

const applyTargetSchema = z.object({ index: z.number().int().nullable() });

export type ApplyTarget = z.infer<typeof applyTargetSchema>;

export class ApplyTargetPrompt {
	static readonly schema = applyTargetSchema;

	static readonly instructions =
		"You are looking at a job page that does not show an application form yet. From the numbered links and buttons, pick the one that most likely opens the application form for this exact job, such as Apply, Apply now or Start application. Never pick sign-in, sign-up with a social account, other jobs, cookie banners or navigation menus. Return its index, or null if none of them leads to the application.";

	static render({ company, title, pageUrl, candidates }: ApplyTargetInput): string {
		const list = candidates.map((candidate) => `${candidate.index}. "${candidate.text}"${candidate.href ? ` -> ${candidate.href}` : ""}`);
		return [`Job: ${title} at ${company}`, `Page: ${pageUrl}`, "", "Candidates:", ...list].join("\n");
	}
}
