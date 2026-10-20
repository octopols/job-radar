import type { RawAccess } from "rivetkit/db";

const MATCH_COLUMNS_ADDED_LATER: [string, string][] = [
	["applied_at", "INTEGER"],
	["notes", "TEXT"],
	["follow_up_at", "INTEGER"],
	["follow_up_due", "INTEGER NOT NULL DEFAULT 0"],
	["work_mode", "TEXT NOT NULL DEFAULT 'unknown'"],
	["cautions", "TEXT NOT NULL DEFAULT '[]'"],
	["auto_apply", "TEXT"],
	["auto_apply_note", "TEXT"],
	["auto_apply_at", "INTEGER"],
];

export class SeekerSchema {
	static async migrate(database: RawAccess): Promise<void> {
		await database.execute(`
			CREATE TABLE IF NOT EXISTS matches (
				board_key TEXT NOT NULL,
				posting_id TEXT NOT NULL,
				company TEXT NOT NULL,
				title TEXT NOT NULL,
				location TEXT NOT NULL,
				remote INTEGER NOT NULL,
				url TEXT NOT NULL,
				posted_at INTEGER,
				score INTEGER NOT NULL,
				reasons TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'new',
				found_at INTEGER NOT NULL,
				live INTEGER NOT NULL,
				explanation TEXT,
				PRIMARY KEY (board_key, posting_id)
			)
		`);
		const columns = new Set((await database.execute<{ name: string }>("PRAGMA table_info(matches)")).map((column) => column.name));
		for (const [name, definition] of MATCH_COLUMNS_ADDED_LATER) {
			if (!columns.has(name)) {
				await database.execute(`ALTER TABLE matches ADD COLUMN ${name} ${definition}`);
			}
		}
		await database.execute("CREATE INDEX IF NOT EXISTS matches_by_score ON matches (status, score DESC)");
		await database.execute(
			"CREATE TABLE IF NOT EXISTS resume_file (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, bytes BLOB NOT NULL, stored_at INTEGER NOT NULL)",
		);
		await database.execute(
			"CREATE TABLE IF NOT EXISTS saved_answers (question_key TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, company TEXT NOT NULL, updated_at INTEGER NOT NULL)",
		);
		await database.execute("CREATE INDEX IF NOT EXISTS saved_answers_by_recency ON saved_answers (updated_at DESC)");
	}
}
