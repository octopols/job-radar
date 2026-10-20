import type { RawAccess } from "rivetkit/db";
import type { Profile } from "../../../shared/types/profile.ts";
import { ProfileMigration } from "../../matching/profile-migration.ts";

interface FollowerRow extends Record<string, unknown> {
	seeker_id: string;
	profile: string;
}

interface Follower {
	seekerId: string;
	profile: Profile;
}

export class FollowerStore {
	readonly #db: RawAccess;

	constructor(db: RawAccess) {
		this.#db = db;
	}

	async add(seekerId: string, profile: Profile): Promise<void> {
		await this.#db.execute(
			`INSERT INTO followers (seeker_id, profile, followed_at) VALUES (?, ?, ?)
			ON CONFLICT (seeker_id) DO UPDATE SET profile = excluded.profile`,
			seekerId,
			JSON.stringify(profile),
			Date.now(),
		);
	}

	async remove(seekerId: string): Promise<void> {
		await this.#db.execute("DELETE FROM followers WHERE seeker_id = ?", seekerId);
	}

	async clear(): Promise<void> {
		await this.#db.execute("DELETE FROM followers");
	}

	async count(): Promise<number> {
		const [row] = await this.#db.execute<{ count: number }>("SELECT COUNT(*) AS count FROM followers");
		return row?.count ?? 0;
	}

	async all(): Promise<Follower[]> {
		const rows = await this.#db.execute<FollowerRow>("SELECT seeker_id, profile FROM followers");
		return rows.map((row) => ({ seekerId: row.seeker_id, profile: ProfileMigration.upgrade(JSON.parse(row.profile)) }));
	}
}
