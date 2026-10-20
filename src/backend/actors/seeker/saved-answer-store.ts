import type { RawAccess } from "rivetkit/db";
import type { Applicant, SavedAnswer, SavedAnswerInput } from "../../../shared/types/application.ts";

interface SavedAnswerRow extends Record<string, unknown> {
	question_key: string;
	question: string;
	answer: string;
	company: string;
	updated_at: number;
}

export class SavedAnswerStore {
	readonly #db: RawAccess;

	constructor(db: RawAccess) {
		this.#db = db;
	}

	async list(limit: number): Promise<SavedAnswer[]> {
		const rows = await this.#db.execute<SavedAnswerRow>("SELECT * FROM saved_answers ORDER BY updated_at DESC LIMIT ?", limit);
		return rows.map((row) => ({ key: row.question_key, question: row.question, answer: row.answer, company: row.company, updatedAt: row.updated_at }));
	}

	async remember(company: string, answers: SavedAnswerInput[], applicant: Applicant | null): Promise<void> {
		const now = Date.now();
		const known = SavedAnswerStore.#knownValues(applicant);
		for (const answer of answers.filter((candidate) => !known.has(candidate.answer.toLowerCase()))) {
			await this.#db.execute(
				"INSERT INTO saved_answers (question_key, question, answer, company, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (question_key) DO UPDATE SET question = excluded.question, answer = excluded.answer, company = excluded.company, updated_at = excluded.updated_at",
				SavedAnswerStore.questionKey(answer.question),
				answer.question,
				answer.answer,
				company,
				now,
			);
		}
	}

	async update(key: string, answer: string): Promise<void> {
		await this.#db.execute("UPDATE saved_answers SET answer = ?, updated_at = ? WHERE question_key = ?", answer, Date.now(), key);
	}

	async forget(key: string): Promise<void> {
		await this.#db.execute("DELETE FROM saved_answers WHERE question_key = ?", key);
	}

	static questionKey(question: string): string {
		return question
			.toLowerCase()
			.replace(/[*’']/g, "")
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim();
	}

	static #knownValues(applicant: Applicant | null): Set<string> {
		if (!applicant) {
			return new Set();
		}
		const names = applicant.fullName.split(/\s+/);
		const text = Object.values(applicant).filter((value): value is string => typeof value === "string");
		const values = [...text, ...names, names.slice(1).join(" ")];
		return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
	}
}
