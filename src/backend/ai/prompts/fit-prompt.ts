import type { Posting } from "../../../shared/types/posting.ts";
import type { Profile } from "../../../shared/types/profile.ts";

export class FitPrompt {
	static readonly instructions =
		"You are a blunt career coach. Judge only from the candidate profile and posting you are given, not from anything else you know about the user. In at most 5 short bullet points, say why this job does or does not fit this person, what in their background to lead with, and any gap to address. Plain text, no preamble, no em dashes.";

	static render(profile: Profile, company: string, posting: Posting): string {
		return [
			`Candidate profile:\n${JSON.stringify(profile, null, 2)}`,
			`Job: ${posting.title} at ${company} (${posting.location || "location not listed"}${posting.remote ? ", remote" : ""})`,
			`Posting:\n${posting.text}`,
		].join("\n\n");
	}
}
