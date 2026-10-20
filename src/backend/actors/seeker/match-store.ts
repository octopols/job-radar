import { UserError } from "rivetkit";
import type { RawAccess } from "rivetkit/db";
import type { AutoApplyOutcome } from "../../../shared/types/application.ts";
import type { Match, MatchStatus, SeekerMatch } from "../../../shared/types/match.ts";
import type { PostingWorkMode } from "../../../shared/types/posting.ts";

interface MatchRow extends Record<string, unknown> {
	board_key: string;
	posting_id: string;
	company: string;
	title: string;
	location: string;
	remote: number;
	url: string;
	posted_at: number | null;
	score: number;
	reasons: string;
	status: MatchStatus;
	found_at: number;
	live: number;
	explanation: string | null;
	applied_at: number | null;
	notes: string | null;
	follow_up_at: number | null;
	follow_up_due: number;
	work_mode: PostingWorkMode;
	cautions: string;
	auto_apply: AutoApplyOutcome | null;
	auto_apply_note: string | null;
}

const NOTES_MAX_LENGTH = 4_000;

export class MatchStore {
	readonly #db: RawAccess;

	constructor(db: RawAccess) {
		this.#db = db;
	}

	async find(boardKey: string, postingId: string): Promise<SeekerMatch | null> {
		const [row] = await this.#db.execute<MatchRow>("SELECT * FROM matches WHERE board_key = ? AND posting_id = ?", boardKey, postingId);
		return row ? MatchStore.#toMatch(row) : null;
	}

	async require(boardKey: string, postingId: string): Promise<SeekerMatch> {
		const match = await this.find(boardKey, postingId);
		if (!match) {
			throw new UserError("That match no longer exists.", { code: "match_missing" });
		}
		return match;
	}

	async list(maxNew: number): Promise<SeekerMatch[]> {
		const tracked = await this.#db.execute<MatchRow>("SELECT * FROM matches WHERE status NOT IN ('new', 'hidden')");
		const fresh = await this.#db.execute<MatchRow>("SELECT * FROM matches WHERE status = 'new' ORDER BY score DESC, found_at DESC LIMIT ?", maxNew);
		return [...tracked, ...fresh].map(MatchStore.#toMatch);
	}

	async clearUntouched(boardKey?: string): Promise<void> {
		if (boardKey === undefined) {
			await this.#db.execute("DELETE FROM matches WHERE status = 'new'");
		} else {
			await this.#db.execute("DELETE FROM matches WHERE board_key = ? AND status = 'new'", boardKey);
		}
	}

	async upsert(matches: Match[], live: boolean): Promise<SeekerMatch[]> {
		const added: SeekerMatch[] = [];
		const foundAt = Date.now();
		await this.#db.transaction(
			async (tx) => {
				for (const match of matches) {
					const existing = await tx.execute<{ status: MatchStatus }>(
						"SELECT status FROM matches WHERE board_key = ? AND posting_id = ?",
						match.boardKey,
						match.postingId,
					);
					await tx.execute(
						`INSERT INTO matches (board_key, posting_id, company, title, location, remote, work_mode, url, posted_at, score, reasons, cautions, found_at, live)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						ON CONFLICT (board_key, posting_id) DO UPDATE SET score = excluded.score, reasons = excluded.reasons, cautions = excluded.cautions,
							title = excluded.title, location = excluded.location, work_mode = excluded.work_mode, url = excluded.url`,
						match.boardKey,
						match.postingId,
						match.company,
						match.title,
						match.location,
						match.remote ? 1 : 0,
						match.workMode,
						match.url,
						match.postedAt,
						match.score,
						JSON.stringify(match.reasons),
						JSON.stringify(match.cautions),
						foundAt,
						live ? 1 : 0,
					);
					if (existing.length === 0) {
						added.push({
							...match,
							status: "new",
							foundAt,
							live,
							explanation: null,
							appliedAt: null,
							notes: "",
							followUpAt: null,
							followUpDue: false,
							autoApply: null,
						});
					}
				}
			},
			{ name: "upsert-matches" },
		);
		return added;
	}

	async setStatus(boardKey: string, postingId: string, status: MatchStatus, appliedAt: number | null, followUpAt: number | null): Promise<void> {
		await this.#db.execute(
			"UPDATE matches SET status = ?, applied_at = ?, follow_up_at = ?, follow_up_due = 0 WHERE board_key = ? AND posting_id = ?",
			status,
			appliedAt,
			followUpAt,
			boardKey,
			postingId,
		);
	}

	async setNotes(boardKey: string, postingId: string, notes: string): Promise<void> {
		await this.#db.execute("UPDATE matches SET notes = ? WHERE board_key = ? AND posting_id = ?", notes.slice(0, NOTES_MAX_LENGTH), boardKey, postingId);
	}

	async setFollowUp(boardKey: string, postingId: string, followUpAt: number): Promise<void> {
		await this.#db.execute("UPDATE matches SET follow_up_at = ?, follow_up_due = 0 WHERE board_key = ? AND posting_id = ?", followUpAt, boardKey, postingId);
	}

	async markFollowUpDue(boardKey: string, postingId: string): Promise<void> {
		await this.#db.execute("UPDATE matches SET follow_up_due = 1 WHERE board_key = ? AND posting_id = ?", boardKey, postingId);
	}

	async setExplanation(boardKey: string, postingId: string, explanation: string): Promise<void> {
		await this.#db.execute("UPDATE matches SET explanation = ? WHERE board_key = ? AND posting_id = ?", explanation, boardKey, postingId);
	}

	async countAutoAppliedSince(since: number): Promise<number> {
		const [row] = await this.#db.execute<{ count: number }>("SELECT COUNT(*) AS count FROM matches WHERE auto_apply IS NOT NULL AND auto_apply_at >= ?", since);
		return row?.count ?? 0;
	}

	async autoApplyCandidates(minScore: number, limit: number): Promise<SeekerMatch[]> {
		const rows = await this.#db.execute<MatchRow>(
			"SELECT * FROM matches WHERE status = 'new' AND auto_apply IS NULL AND score >= ? ORDER BY score DESC LIMIT ?",
			minScore,
			limit,
		);
		return rows.map(MatchStore.#toMatch);
	}

	async recordAutoApply(boardKey: string, postingId: string, outcome: AutoApplyOutcome, note: string | null): Promise<void> {
		await this.#db.execute(
			"UPDATE matches SET auto_apply = ?, auto_apply_note = ?, auto_apply_at = ? WHERE board_key = ? AND posting_id = ?",
			outcome,
			note,
			Date.now(),
			boardKey,
			postingId,
		);
	}

	static #toMatch(row: MatchRow): SeekerMatch {
		return {
			postingId: row.posting_id,
			boardKey: row.board_key,
			company: row.company,
			title: row.title,
			location: row.location,
			remote: row.remote === 1,
			workMode: row.work_mode,
			url: row.url,
			postedAt: row.posted_at,
			score: row.score,
			reasons: JSON.parse(row.reasons) as string[],
			cautions: JSON.parse(row.cautions) as string[],
			status: row.status,
			foundAt: row.found_at,
			live: row.live === 1,
			explanation: row.explanation,
			appliedAt: row.applied_at,
			notes: row.notes ?? "",
			followUpAt: row.follow_up_at,
			followUpDue: row.follow_up_due === 1,
			autoApply: row.auto_apply ? { outcome: row.auto_apply, note: row.auto_apply_note } : null,
		};
	}
}
