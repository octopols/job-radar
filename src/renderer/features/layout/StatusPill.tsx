import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { BoardStatus } from "@shared/types/board.ts";
import { TimeFormat } from "@/lib/format.ts";

interface StatusPillProps {
	connected: boolean;
	boards: BoardStatus[];
	onClick: () => void;
}

export function StatusPill({ connected, boards, onClick }: StatusPillProps) {
	const [, setTick] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => setTick((tick) => tick + 1), 15_000);
		return () => clearInterval(timer);
	}, []);

	const lastChecked = Math.max(0, ...boards.map((board) => board.lastPolledAt ?? 0));
	const failing = boards.filter((board) => board.lastError).length;
	const label = !connected
		? "Reconnecting"
		: boards.length === 0
			? "Live"
			: failing > 0
				? `${failing} ${failing === 1 ? "source needs" : "sources need"} attention`
				: `Watching ${boards.length} sources${lastChecked > 0 ? ` · checked ${TimeFormat.relative(lastChecked)}` : ""}`;

	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		>
			<span className={cn("size-1.5 rounded-full", !connected ? "animate-pulse bg-warning" : failing > 0 ? "bg-warning" : "bg-success")} />
			<span className="max-w-[40vw] truncate">{label}</span>
		</button>
	);
}
