import { type MatchStatus, PIPELINE_STATUSES, type SeekerMatch } from "@shared/types/match.ts";
import { Bookmark, BookmarkCheck, EyeOff, SquareArrowOutUpRight, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { desktop } from "@/lib/desktop.ts";

interface JobActionsProps {
	match: SeekerMatch;
	onStatusChange: (status: MatchStatus) => void;
	onApplyWithAi: () => void;
	onHide: () => void;
}

export function JobActions({ match, onStatusChange, onApplyWithAi, onHide }: JobActionsProps) {
	const [askingIfApplied, setAskingIfApplied] = useState(false);
	const inPipeline = PIPELINE_STATUSES.includes(match.status);
	const saved = match.status === "saved";
	const autoApplyWaitingForReview = match.autoApply?.outcome === "ready" || match.autoApply?.outcome === "needs-you";
	const siteLabel = `Open on ${match.company}'s site`;

	if (askingIfApplied) {
		return (
			<div className="flex w-full flex-wrap items-center gap-2">
				<span className="text-sm">Did you apply?</span>
				<Button
					size="sm"
					onClick={() => {
						setAskingIfApplied(false);
						onStatusChange("applied");
					}}
				>
					Yes, track it
				</Button>
				<Button size="sm" variant="ghost" onClick={() => setAskingIfApplied(false)}>
					Not yet
				</Button>
			</div>
		);
	}

	return (
		<>
			{desktop && !inPipeline ? (
				<>
					<Button className="flex-1 sm:flex-none" onClick={onApplyWithAi}>
						<WandSparkles className="size-4" />
						{autoApplyWaitingForReview ? "Review application" : "Apply with AI"}
					</Button>
					<Button asChild variant="outline" size="icon" aria-label={siteLabel} title={siteLabel}>
						<a href={match.url} target="_blank" rel="noreferrer">
							<SquareArrowOutUpRight className="size-4" />
						</a>
					</Button>
				</>
			) : (
				<Button asChild className="flex-1 sm:flex-none">
					<a href={match.url} target="_blank" rel="noreferrer" onClick={() => !inPipeline && setAskingIfApplied(true)}>
						Apply on {match.company}'s site
						<SquareArrowOutUpRight className="size-4" />
					</a>
				</Button>
			)}
			{!inPipeline && (
				<>
					<Button variant="outline" onClick={() => onStatusChange(saved ? "new" : "saved")}>
						{saved ? <BookmarkCheck className="size-4 fill-current" /> : <Bookmark className="size-4" />}
						{saved ? "Saved" : "Save"}
					</Button>
					<Button variant="ghost" className="text-muted-foreground" onClick={onHide}>
						<EyeOff className="size-4" />
						Not for me
					</Button>
				</>
			)}
		</>
	);
}
