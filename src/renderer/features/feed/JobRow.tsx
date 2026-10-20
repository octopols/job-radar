import { AlertTriangle, Bookmark, BookmarkCheck, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PIPELINE_STATUSES, type SeekerMatch } from "@shared/types/match.ts";
import { FitBadge } from "@/components/FitBadge.tsx";
import { JobFormat, TimeFormat } from "@/lib/format.ts";

interface JobRowProps {
	match: SeekerMatch;
	recentlyPosted: boolean;
	selected: boolean;
	onOpen: () => void;
	onToggleSave: () => void;
}

const STAGE_LABELS: Partial<Record<SeekerMatch["status"], string>> = {
	applied: "Applied",
	interviewing: "Interviewing",
	offer: "Offer",
	rejected: "Closed",
};

export function JobRow({ match, recentlyPosted, selected, onOpen, onToggleSave }: JobRowProps) {
	const summary = JobFormat.summary(match);
	const inPipeline = PIPELINE_STATUSES.includes(match.status);
	const saved = match.status === "saved";

	return (
		<li className={cn("group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50", selected && "bg-accent/60")}>
			<button type="button" onClick={onOpen} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" aria-label={`Open ${match.title} at ${match.company}`} />

			<div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-baseline gap-2">
					<span className="truncate font-medium">{match.title}</span>
					{recentlyPosted && !inPipeline && <span className="shrink-0 rounded-sm bg-success/12 px-1.5 text-[11px] font-medium text-success">New</span>}
				</div>
				<p className="truncate text-sm text-muted-foreground">
					<span className="text-foreground/80">{match.company}</span> · {JobFormat.place(match)}
					{JobFormat.sourceCredit(match.boardKey) && <span> · {JobFormat.sourceCredit(match.boardKey)}</span>}
				</p>
				{inPipeline ? (
					<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<span className="font-medium text-foreground/80">{STAGE_LABELS[match.status]}</span>
						{match.appliedAt !== null && <span>· {TimeFormat.relative(match.appliedAt)}</span>}
						{match.followUpDue && match.status === "applied" && (
							<span className="flex items-center gap-1 font-medium text-warning">
								<BellRing className="size-3" /> Follow up
							</span>
						)}
					</p>
				) : (
					summary && (
						<p className={cn("flex items-center gap-1.5 truncate text-xs", summary.caution ? "text-warning" : "text-muted-foreground")}>
							{summary.caution && <AlertTriangle className="size-3 shrink-0" />}
							<span className="truncate">{summary.text}</span>
						</p>
					)
				)}
			</div>

			<div className="relative flex shrink-0 flex-col items-end gap-1.5">
				{!inPipeline && <FitBadge score={match.score} />}
				<div className="flex items-center gap-1">
					{match.postedAt !== null && <span className="text-xs text-muted-foreground tabular-nums">{TimeFormat.relative(match.postedAt).replace(" ago", "")}</span>}
					{!inPipeline && (
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={saved ? "Remove from saved" : "Save job"}
							aria-pressed={saved}
							onClick={onToggleSave}
							className={cn("text-muted-foreground", !saved && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100", saved && "text-foreground")}
						>
							{saved ? <BookmarkCheck className="size-4 fill-current" /> : <Bookmark className="size-4" />}
						</Button>
					)}
				</div>
			</div>
		</li>
	);
}
