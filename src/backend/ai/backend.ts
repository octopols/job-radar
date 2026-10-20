import { extname } from "node:path";
import type { ApplicationDraft } from "../../shared/types/application.ts";
import type { Posting } from "../../shared/types/posting.ts";
import type { Profile, ResumeReading } from "../../shared/types/profile.ts";
import type { ApplicationInput } from "./prompts/application-prompt.ts";
import type { ApplyTarget, ApplyTargetInput } from "./prompts/apply-target-prompt.ts";
import type { CareersLead } from "./prompts/careers-prompt.ts";

export type ResumeInput = { kind: "text"; text: string } | { kind: "file"; fileName: string; bytes: Uint8Array };

export interface AiBackend {
	resumeProfile(input: ResumeInput): Promise<ResumeReading>;
	careersLead(company: string): Promise<CareersLead>;
	fitBrief(profile: Profile, company: string, posting: Posting): Promise<string>;
	applicationDraft(input: ApplicationInput): Promise<ApplicationDraft>;
	applyTarget(input: ApplyTargetInput): Promise<ApplyTarget>;
}

const READABLE_RESUME_EXTENSIONS = new Set([".pdf", ".txt", ".md"]);

export class ResumeFormats {
	static isReadable(fileName: string): boolean {
		return READABLE_RESUME_EXTENSIONS.has(ResumeFormats.extension(fileName));
	}

	static isPdf(fileName: string): boolean {
		return ResumeFormats.extension(fileName) === ".pdf";
	}

	static extension(fileName: string): string {
		return extname(fileName).toLowerCase();
	}
}
