import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { ApplicationDraft } from "../../shared/types/application.ts";
import type { Posting } from "../../shared/types/posting.ts";
import type { Profile, ResumeReading } from "../../shared/types/profile.ts";
import { type AiBackend, ResumeFormats, type ResumeInput } from "./backend.ts";
import { type ApplicationInput, ApplicationPrompt } from "./prompts/application-prompt.ts";
import { type ApplyTarget, type ApplyTargetInput, ApplyTargetPrompt } from "./prompts/apply-target-prompt.ts";
import { type CareersLead, CareersPrompt } from "./prompts/careers-prompt.ts";
import { FitPrompt } from "./prompts/fit-prompt.ts";
import { ProfilePrompt } from "./prompts/profile-prompt.ts";

const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16_000;
const MAX_PAUSED_TURNS = 4;

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

type Effort = "low" | "medium" | "high";

export class AnthropicApiBackend implements AiBackend {
	readonly #client: Anthropic;

	constructor(apiKey: string) {
		this.#client = new Anthropic({ apiKey });
	}

	async resumeProfile(input: ResumeInput): Promise<ResumeReading> {
		const content: Anthropic.Beta.BetaContentBlockParam[] =
			input.kind === "text"
				? [{ type: "text", text: ProfilePrompt.fromText(input.text) }]
				: ResumeFormats.isPdf(input.fileName)
					? [
							{ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(input.bytes).toString("base64") } },
							{ type: "text", text: "Build the profile from this resume." },
						]
					: [{ type: "text", text: ProfilePrompt.fromText(Buffer.from(input.bytes).toString("utf8")) }];
		return this.#structured(ProfilePrompt.instructions, content, ProfilePrompt.schema, "low");
	}

	careersLead(company: string): Promise<CareersLead> {
		return this.#structured(CareersPrompt.instructions, [{ type: "text", text: CareersPrompt.render(company) }], CareersPrompt.schema, "medium", [
			{ type: "web_search_20260209", name: "web_search", max_uses: 5 },
			{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
		]);
	}

	async fitBrief(profile: Profile, company: string, posting: Posting): Promise<string> {
		const response = await this.#client.beta.messages.create({
			model: MODEL,
			max_tokens: MAX_TOKENS,
			betas: [FALLBACK_BETA],
			fallbacks: "default",
			system: FitPrompt.instructions,
			output_config: { effort: "medium" },
			messages: [{ role: "user", content: FitPrompt.render(profile, company, posting) }],
		});
		AnthropicApiBackend.assertAnswered(response);
		return response.content
			.flatMap((block) => (block.type === "text" ? [block.text] : []))
			.join("\n")
			.trim();
	}

	applicationDraft(input: ApplicationInput): Promise<ApplicationDraft> {
		return this.#structured(ApplicationPrompt.instructions, [{ type: "text", text: ApplicationPrompt.render(input) }], ApplicationPrompt.schema, "medium");
	}

	applyTarget(input: ApplyTargetInput): Promise<ApplyTarget> {
		return this.#structured(ApplyTargetPrompt.instructions, [{ type: "text", text: ApplyTargetPrompt.render(input) }], ApplyTargetPrompt.schema, "low");
	}

	async #structured<Output>(
		system: string,
		content: Anthropic.Beta.BetaContentBlockParam[],
		schema: z.ZodType<Output>,
		effort: Effort,
		tools: Anthropic.Beta.BetaToolUnion[] = [],
	): Promise<Output> {
		const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
		for (let turn = 0; turn < MAX_PAUSED_TURNS; turn++) {
			const response = await this.#client.beta.messages.parse({
				model: MODEL,
				max_tokens: MAX_TOKENS,
				betas: [FALLBACK_BETA],
				fallbacks: "default",
				system,
				messages,
				...(tools.length > 0 ? { tools } : {}),
				output_config: { effort, format: betaZodOutputFormat(schema) },
			});
			if (response.stop_reason === "pause_turn") {
				messages.push({ role: "assistant", content: response.content });
				continue;
			}
			AnthropicApiBackend.assertAnswered(response);
			if (response.parsed_output === null || response.parsed_output === undefined) {
				throw new Error("Claude did not return the expected structured answer.");
			}
			return response.parsed_output as Output;
		}
		throw new Error("Claude kept searching without finishing. Try again in a moment.");
	}

	private static assertAnswered(response: { stop_reason: string | null }): void {
		if (response.stop_reason === "refusal") {
			throw new Error("Claude declined this request.");
		}
		if (response.stop_reason === "max_tokens") {
			throw new Error("Claude's answer was cut off before it finished.");
		}
	}
}
