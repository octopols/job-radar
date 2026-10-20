import { actor, event } from "rivetkit";
import { db } from "rivetkit/db";
import { CATALOG } from "../../../shared/catalog.ts";
import type { BoardStatus, CatalogBoard, Overview } from "../../../shared/types/board.ts";
import { DirectorySchema } from "./schema.ts";

interface BoardRow extends Record<string, unknown> {
	status: string;
}

export const directory = actor({
	state: { seekers: 0 },

	db: db({ onMigrate: DirectorySchema.migrate }),

	events: {
		boardUpdated: event<BoardStatus>(),
		boardForgotten: event<string>(),
		seekersChanged: event<number>(),
	},

	actions: {
		catalog: (): readonly CatalogBoard[] => CATALOG,

		overview: async (c): Promise<Overview> => {
			const rows = await c.db.execute<BoardRow>("SELECT status FROM boards ORDER BY key");
			const boards = rows.map((row) => JSON.parse(row.status) as BoardStatus);
			return {
				boards,
				seekers: c.state.seekers,
				jobsIndexed: boards.reduce((sum, board) => sum + board.openJobs, 0),
				pollsTotal: boards.reduce((sum, board) => sum + board.polls, 0),
			};
		},

		reportBoard: async (c, status: BoardStatus) => {
			await c.db.execute(
				"INSERT INTO boards (key, status) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET status = excluded.status",
				status.key,
				JSON.stringify(status),
			);
			c.broadcast("boardUpdated", status);
		},

		forgetBoard: async (c, key: string) => {
			await c.db.execute("DELETE FROM boards WHERE key = ?", key);
			c.broadcast("boardForgotten", key);
		},

		seekerJoined: async (c, id: string) => {
			await c.db.execute("INSERT INTO seekers (id, joined_at) VALUES (?, ?) ON CONFLICT (id) DO NOTHING", id, Date.now());
			const [row] = await c.db.execute<{ count: number }>("SELECT COUNT(*) AS count FROM seekers");
			c.state.seekers = row?.count ?? 0;
			c.broadcast("seekersChanged", c.state.seekers);
		},
	},
});
