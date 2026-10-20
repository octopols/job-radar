import { type Applicant, applicationDraftSchema, type FormField, type ReferencedPage, type SavedAnswer } from "../../../shared/types/application.ts";
import type { Posting } from "../../../shared/types/posting.ts";
import type { Profile } from "../../../shared/types/profile.ts";

export interface ApplicationInput {
	applicant: Applicant;
	savedAnswers: SavedAnswer[];
	profile: Profile;
	company: string;
	posting: Posting;
	fields: FormField[];
	referencedPages: ReferencedPage[];
}

const POSTING_TEXT_LIMIT = 12_000;

export class ApplicationPrompt {
	static readonly schema = applicationDraftSchema;

	static readonly instructions = [
		"You fill in a job application form on behalf of the candidate, who reviews it before submitting. Your goal is answers that get them shortlisted while needing as little of their time as possible: answer every field you can, including optional ones where a good answer helps.",
		"Use only the applicant details, candidate profile and job posting you are given. Ignore anything else in your context about the user.",
		"Saved answers are the candidate's own answers from earlier applications. When a field asks the same thing, even in different words, reuse the saved answer (adapting it to the field's options or length) and leave reviewNote null. Saved answers to company-specific questions such as 'why do you want to work here' are a source of facts and tone only; never copy them to another company.",
		"Answer every field in the list exactly once, by fieldId. Skip file fields; the app attaches the resume itself.",
		"Contact and identity fields (name, email, phone, location, LinkedIn, website) copy the applicant details exactly. Split the full name for first and last name fields.",
		"Work authorization, visa sponsorship, notice period, start date and salary questions come only from the applicant details. If the details do not answer the question, set value to null and say what is missing in reviewNote.",
		"Infer factual answers the profile supports instead of leaving them empty. For 'years of experience with X' where X is one of the candidate's skills, give a conservative estimate that never exceeds yearsExperience, and set reviewNote to say it was estimated from their experience. Do the same for other answers the profile clearly implies, such as their current title or seniority.",
		"Never invent facts the profile does not support: no made-up dates, numbers, references, employers, degrees, addresses or identity numbers, and no claimed experience with skills the candidate does not list. When there is no evidence for an answer, set value to null and explain in reviewNote.",
		"Common questions come from the applicant details. veteran 'no' means choose the option saying they are not a protected veteran, 'yes' the one saying they are, and 'decline' the one declining to answer; disability works the same way. gender and ethnicity name their answer, and an empty string means choose the option declining to answer. Sexual orientation and any other demographic question get the declining option. over18, nonCompete (bound by a non-compete or post-employment restriction) and heardFrom answer those questions directly.",
		"For 'have you worked at or for this company before' questions, answer yes only if the company appears in pastEmployers, and no otherwise.",
		"Leave consent, privacy-policy and 'I certify this is accurate' checkboxes as null with reviewNote 'Confirm this yourself'. Only the candidate can agree to those.",
		"For written questions (why this company, why this role, describe a project, cover letter), write a specific, persuasive answer in the first person that a hiring manager would want to shortlist: connect the candidate's real skills and experience to what the posting asks for, name concrete things from the posting or the company, and sound like a person, not a template. No cliches, no flattery, no em dashes. Keep answers to 60-150 words unless the field allows less, and respect maxLength.",
		"Soft and opinion questions are yours to write well: how they keep learning, what they would like to ask the team, their view of a page the form links to (use the referenced page text), how they prefer to be addressed (their first name unless the details say otherwise). Write answers consistent with their profile and set reviewNote to null for these, since they need no fact check.",
		"Location, city, country and 'where are you eligible to work' questions come from the applicant's location and work authorization.",
		"For select, combobox and radio fields, value must be one of the listed options, copied exactly. When options are not listed, give the shortest natural answer. For multiple-choice checkbox groups, put every chosen option in choices and leave value null. For a single checkbox, value is 'yes' to tick it or null to leave it.",
		"reviewNote is null when the answer needs no attention. Set it only when the answer states a fact you estimated, or when you left the field empty; keep it to one short sentence.",
	].join(" ");

	static render({ applicant, savedAnswers, profile, company, posting, fields, referencedPages }: ApplicationInput): string {
		const saved = savedAnswers.map(({ question, answer, company: askedBy }) => ({ question, answer, askedBy }));
		return [
			`Applicant details:\n${JSON.stringify(applicant, null, 2)}`,
			`Saved answers:\n${saved.length > 0 ? JSON.stringify(saved, null, 2) : "none yet"}`,
			`Candidate profile:\n${JSON.stringify(profile, null, 2)}`,
			`Job: ${posting.title} at ${company} (${posting.location || "location not listed"})`,
			`Posting:\n${posting.text.slice(0, POSTING_TEXT_LIMIT)}`,
			...referencedPages.map((page) => `Referenced page ${page.url}:\n${page.text}`),
			`Form fields:\n${JSON.stringify(fields, null, 2)}`,
		].join("\n\n");
	}
}
