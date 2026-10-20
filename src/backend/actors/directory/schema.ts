import type { RawAccess } from "rivetkit/db";

export class DirectorySchema {
	static async migrate(database: RawAccess): Promise<void> {
		await database.execute("CREATE TABLE IF NOT EXISTS boards (key TEXT PRIMARY KEY, status TEXT NOT NULL)");
		await database.execute("CREATE TABLE IF NOT EXISTS seekers (id TEXT PRIMARY KEY, joined_at INTEGER NOT NULL)");
	}
}
