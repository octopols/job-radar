import type { RawAccess } from "rivetkit/db";

export class BoardSchema {
	static async migrate(database: RawAccess): Promise<void> {
		await database.execute(`
			CREATE TABLE IF NOT EXISTS postings (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				location TEXT NOT NULL,
				remote INTEGER NOT NULL,
				department TEXT,
				url TEXT NOT NULL,
				posted_at INTEGER,
				text TEXT NOT NULL,
				first_seen_at INTEGER NOT NULL,
				last_seen_poll INTEGER NOT NULL,
				closed_at INTEGER
			)
		`);
		const postingColumns = new Set((await database.execute<{ name: string }>("PRAGMA table_info(postings)")).map((column) => column.name));
		if (!postingColumns.has("work_mode")) {
			await database.execute("ALTER TABLE postings ADD COLUMN work_mode TEXT NOT NULL DEFAULT 'unknown'");
		}
		if (!postingColumns.has("company")) {
			await database.execute("ALTER TABLE postings ADD COLUMN company TEXT");
		}

		await database.execute("UPDATE postings SET work_mode = 'remote' WHERE work_mode = 'unknown' AND (remote = 1 OR location LIKE '%remote%')");
		await database.execute("UPDATE postings SET work_mode = 'hybrid' WHERE work_mode = 'unknown' AND location LIKE '%hybrid%'");
		await database.execute("CREATE INDEX IF NOT EXISTS postings_open ON postings (closed_at)");
		await database.execute(`
			CREATE TABLE IF NOT EXISTS followers (
				seeker_id TEXT PRIMARY KEY,
				profile TEXT NOT NULL,
				followed_at INTEGER NOT NULL
			)
		`);
	}
}
