import type { AiSettings } from "../../shared/types/ai.ts";
import type { ApplicationDraft } from "../../shared/types/application.ts";
import type { Posting } from "../../shared/types/posting.ts";
import type { Profile, ResumeReading } from "../../shared/types/profile.ts";
import { BackendConfig } from "../config.ts";
import { AnthropicApiBackend } from "./anthropic-backend.ts";
import { type AiBackend, ResumeFormats } from "./backend.ts";
import { ClaudeCodeBackend } from "./claude-code-backend.ts";
import type { ApplicationInput } from "./prompts/application-prompt.ts";
import type { ApplyTarget, ApplyTargetInput } from "./prompts/apply-target-prompt.ts";
import type { CareersLead } from "./prompts/careers-prompt.ts";

export class CareerAssistant {
	#backend: AiBackend;
	#queueTail: Promise<unknown> = Promise.resolve();

	constructor(settings: AiSettings) {
		this.#backend = CareerAssistant.createBackend(settings);
	}

	configure(settings: AiSettings): void {
		this.#backend = CareerAssistant.createBackend(settings);
	}

	profileFromText(resumeText: string): Promise<ResumeReading> {
		return this.#exclusively(() => this.#backend.resumeProfile({ kind: "text", text: resumeText }));
	}

	profileFromFile(fileName: string, bytes: Uint8Array): Promise<ResumeReading> {
		if (!ResumeFormats.isReadable(fileName)) {
			return Promise.reject(new Error("Unsupported resume format. Upload a PDF, TXT or MD file, or paste the text."));
		}
		return this.#exclusively(() => this.#backend.resumeProfile({ kind: "file", fileName, bytes }));
	}

	findCareersPage(company: string): Promise<CareersLead> {
		return this.#exclusively(() => this.#backend.careersLead(company));
	}

	explainFit(profile: Profile, company: string, posting: Posting): Promise<string> {
		return this.#exclusively(() => this.#backend.fitBrief(profile, company, posting));
	}

	draftApplication(input: ApplicationInput): Promise<ApplicationDraft> {
		return this.#exclusively(() => this.#backend.applicationDraft(input));
	}

	findApplyTarget(input: ApplyTargetInput): Promise<ApplyTarget> {
		return this.#exclusively(() => this.#backend.applyTarget(input));
	}

	private static createBackend(settings: AiSettings): AiBackend {
		if (settings.kind === "anthropic-api") {
			if (!settings.apiKey) {
				throw new Error("An Anthropic API key is required for the API option.");
			}
			return new AnthropicApiBackend(settings.apiKey);
		}
		return new ClaudeCodeBackend();
	}

	#exclusively<T>(work: () => Promise<T>): Promise<T> {
		const run = this.#queueTail.then(work);
		this.#queueTail = run.catch(() => undefined);
		return run;
	}
}

export const careerAssistant = new CareerAssistant(BackendConfig.aiSettings);
