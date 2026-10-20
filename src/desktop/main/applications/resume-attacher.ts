import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APPLY_IPC, type FieldOutcome } from "../../../shared/ipc/apply.ts";
import type { FormField } from "../../../shared/types/application.ts";
import type { PageChannel } from "./page-channel.ts";
import type { PageInput } from "./page-input.ts";
import type { SeekerHandle } from "./types.ts";

const RESUME_FIELD = /resume|cv\b|curriculum/i;

const TEMP_FILE_LIFETIME_MS = 60_000;

export class ResumeAttacher {
	readonly #page: PageChannel;
	readonly #input: PageInput;
	readonly #seeker: SeekerHandle;

	constructor(page: PageChannel, input: PageInput, seeker: SeekerHandle) {
		this.#page = page;
		this.#input = input;
		this.#seeker = seeker;
	}

	async attach(fields: FormField[]): Promise<FieldOutcome[]> {
		const fileFields = fields.filter((field) => field.kind === "file");
		const targets = fileFields.filter((field) => RESUME_FIELD.test(field.label));
		const resumeFields = targets.length > 0 ? targets.slice(0, 1) : fileFields.filter((field) => field.required).slice(0, 1);
		if (resumeFields.length === 0) {
			return [];
		}
		const resume = await this.#seeker.resumeFile();
		await this.#page.request<string[]>(APPLY_IPC.mark, resumeFields.map((field) => field.id));
		if (!resume) {
			return resumeFields.map((field) => ({ fieldId: field.id, label: field.label, filled: false, note: "Attach your resume. Add a resume file in Application details to do this for you." }));
		}
		const directory = join(tmpdir(), "job-radar-apply", crypto.randomUUID());
		await mkdir(directory, { recursive: true });
		const path = join(directory, resume.name);
		await writeFile(path, resume.bytes);
		try {
			const outcomes: FieldOutcome[] = [];
			for (const field of resumeFields) {
				const attached = await this.#input.setFiles(`[data-job-radar-field="${field.id}"]`, [path]);
				outcomes.push({ fieldId: field.id, label: field.label, filled: attached, note: attached ? null : "Attach your resume" });
			}
			return outcomes;
		} finally {
			setTimeout(() => void rm(directory, { recursive: true, force: true }), TEMP_FILE_LIFETIME_MS);
		}
	}
}
