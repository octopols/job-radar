import { resumeReadingSchema } from "../../../shared/types/profile.ts";

export class ProfilePrompt {
	static readonly schema = resumeReadingSchema;

	static readonly instructions = [
		"You turn a resume into a job search profile.",
		"Use only the resume you are given. Ignore anything else in your context about the user, their employer or where they live, and leave out whatever the resume does not say.",
		"targetTitles are 3 to 6 job titles this person should search for next, based on their trajectory.",
		"skills are up to 25 concrete technologies, languages, tools and domains they actually used, written the way job postings write them.",
		"seniority is intern, junior (under 2 years), mid (2 to 5), senior (5 to 9) or staff (9 or more, or staff and principal titles).",
		"locations are cities or countries the resume names as where they live or want to work.",
		"Use null for yearsExperience when it cannot be worked out.",
		"contact holds the candidate's full name, email, phone, LinkedIn URL and personal website or GitHub exactly as the resume writes them, with an empty string for any the resume leaves out. contact.employers lists the companies they have worked for, most recent first.",
	].join(" ");

	static fromText(resumeText: string): string {
		return `Resume:\n\n${resumeText}`;
	}
}
