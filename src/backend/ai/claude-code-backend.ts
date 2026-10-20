import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runClaudeCode } from "@rivet-dev/claude-code";
import type { ApplicationDraft } from "../../shared/types/application.ts";
import type { Posting } from "../../shared/types/posting.ts";
import type { Profile, ResumeReading } from "../../shared/types/profile.ts";
import { type AiBackend, ResumeFormats, type ResumeInput } from "./backend.ts";
import { type ApplicationInput, ApplicationPrompt } from "./prompts/application-prompt.ts";
import { type ApplyTarget, type ApplyTargetInput, ApplyTargetPrompt } from "./prompts/apply-target-prompt.ts";
import { type CareersLead, CareersPrompt } from "./prompts/careers-prompt.ts";
import { FitPrompt } from "./prompts/fit-prompt.ts";
import { ProfilePrompt } from "./prompts/profile-prompt.ts";

export class ClaudeCodeBackend implements AiBackend {
	resumeProfile(input: ResumeInput): Promise<ResumeReading> {
		return ClaudeCodeBackend.#inScratchFolder(async (cwd) => {
			if (input.kind === "text") {
				const run = await runClaudeCode({ systemPrompt: ProfilePrompt.instructions, prompt: ProfilePrompt.fromText(input.text), cwd }, ProfilePrompt.schema);
				return run.output;
			}
			const resumeFile = `resume${ResumeFormats.extension(input.fileName)}`;
			await writeFile(join(cwd, resumeFile), input.bytes);
			const run = await runClaudeCode(
				{
					systemPrompt: ProfilePrompt.instructions,
					prompt: `Read ${resumeFile} in the current directory and build the profile from it.`,
					tools: ["Read"],
					cwd,
				},
				ProfilePrompt.schema,
			);
			return run.output;
		});
	}

	careersLead(company: string): Promise<CareersLead> {
		return ClaudeCodeBackend.#inScratchFolder(async (cwd) => {
			const run = await runClaudeCode(
				{ systemPrompt: CareersPrompt.instructions, prompt: CareersPrompt.render(company), tools: ["WebSearch", "WebFetch"], cwd },
				CareersPrompt.schema,
			);
			return run.output;
		});
	}

	fitBrief(profile: Profile, company: string, posting: Posting): Promise<string> {
		return ClaudeCodeBackend.#inScratchFolder(async (cwd) => {
			const run = await runClaudeCode({ systemPrompt: FitPrompt.instructions, prompt: FitPrompt.render(profile, company, posting), cwd });
			return run.output.trim();
		});
	}

	applicationDraft(input: ApplicationInput): Promise<ApplicationDraft> {
		return ClaudeCodeBackend.#inScratchFolder(async (cwd) => {
			const run = await runClaudeCode({ systemPrompt: ApplicationPrompt.instructions, prompt: ApplicationPrompt.render(input), cwd }, ApplicationPrompt.schema);
			return run.output;
		});
	}

	applyTarget(input: ApplyTargetInput): Promise<ApplyTarget> {
		return ClaudeCodeBackend.#inScratchFolder(async (cwd) => {
			const run = await runClaudeCode({ systemPrompt: ApplyTargetPrompt.instructions, prompt: ApplyTargetPrompt.render(input), cwd }, ApplyTargetPrompt.schema);
			return run.output;
		});
	}

	static async #inScratchFolder<Result>(work: (cwd: string) => Promise<Result>): Promise<Result> {
		const directory = join(tmpdir(), "job-radar", crypto.randomUUID());
		await mkdir(directory, { recursive: true });
		try {
			return await work(directory);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
}
