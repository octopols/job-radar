import type { RawAccess } from "rivetkit/db";
import type { ResumeFile } from "../../../shared/types/seeker.ts";

export class ResumeStore {
	readonly #db: RawAccess;

	constructor(db: RawAccess) {
		this.#db = db;
	}

	async get(): Promise<ResumeFile | null> {
		const [row] = await this.#db.execute<{ name: string; bytes: Uint8Array }>("SELECT name, bytes FROM resume_file WHERE id = 1");
		return row ? { name: row.name, bytes: new Uint8Array(row.bytes) } : null;
	}

	async put(name: string, bytes: Uint8Array): Promise<void> {
		await this.#db.execute(
			"INSERT INTO resume_file (id, name, bytes, stored_at) VALUES (1, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, bytes = excluded.bytes, stored_at = excluded.stored_at",
			name,
			bytes,
			Date.now(),
		);
	}
}
