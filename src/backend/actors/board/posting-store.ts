import type { RawAccess } from "rivetkit/db";
import type { Posting, PostingWorkMode } from "../../../shared/types/posting.ts";

interface PostingRow extends Record<string, unknown> {
	id: string;
	title: string;
	location: string;
	remote: number;
	work_mode: PostingWorkMode;
	company: string | null;
	department: string | null;
	url: string;
	posted_at: number | null;
	text: string;
}

const SQL_BATCH_SIZE = 200;
const CLOSED_POSTING_RETENTION_MS = 14 * 86_400_000;

export class PostingStore {
	readonly #db: RawAccess;

	constructor(db: RawAccess) {
		this.#db = db;
	}

	async find(postingId: string): Promise<Posting | null> {
		const [row] = await this.#db.execute<PostingRow>("SELECT * FROM postings WHERE id = ?", postingId);
		return row ? PostingStore.#toPosting(row) : null;
	}

	async open(): Promise<Posting[]> {
		const rows = await this.#db.execute<PostingRow>("SELECT * FROM postings WHERE closed_at IS NULL");
		return rows.map(PostingStore.#toPosting);
	}

	async knownIds(): Promise<Set<string>> {
		return new Set((await this.#db.execute<{ id: string }>("SELECT id FROM postings")).map((row) => row.id));
	}

	async storedTexts(ids: string[]): Promise<Map<string, string>> {
		const texts = new Map<string, string>();
		for (let start = 0; start < ids.length; start += SQL_BATCH_SIZE) {
			const batch = ids.slice(start, start + SQL_BATCH_SIZE);
			const rows = await this.#db.execute<{ id: string; text: string }>(
				`SELECT id, text FROM postings WHERE text != '' AND id IN (${batch.map(() => "?").join(", ")})`,
				...batch,
			);
			for (const row of rows) {
				texts.set(row.id, row.text);
			}
		}
		return texts;
	}

	async sync(postings: Posting[], pollNumber: number): Promise<void> {
		await this.#db.transaction(
			async (tx) => {
				for (const posting of postings) {
					await tx.execute(
						`INSERT INTO postings (id, title, company, location, remote, work_mode, department, url, posted_at, text, first_seen_at, last_seen_poll)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						ON CONFLICT (id) DO UPDATE SET title = excluded.title, location = excluded.location, remote = excluded.remote,
							company = excluded.company, work_mode = excluded.work_mode, department = excluded.department, url = excluded.url, text = excluded.text,
							last_seen_poll = excluded.last_seen_poll, closed_at = NULL`,
						posting.id,
						posting.title,
						posting.company ?? null,
						posting.location,
						posting.remote ? 1 : 0,
						posting.workMode,
						posting.department,
						posting.url,
						posting.postedAt,
						posting.text,
						Date.now(),
						pollNumber,
					);
				}
				await tx.execute("UPDATE postings SET closed_at = ? WHERE closed_at IS NULL AND last_seen_poll < ?", Date.now(), pollNumber);
				await tx.execute("DELETE FROM postings WHERE closed_at IS NOT NULL AND closed_at < ?", Date.now() - CLOSED_POSTING_RETENTION_MS);
			},
			{ name: "sync-postings" },
		);
	}

	static #toPosting(row: PostingRow): Posting {
		return {
			id: row.id,
			title: row.title,
			location: row.location,
			...(row.company ? { company: row.company } : {}),
			remote: row.remote === 1,
			workMode: row.work_mode,
			department: row.department,
			url: row.url,
			postedAt: row.posted_at,
			text: row.text,
		};
	}
}
