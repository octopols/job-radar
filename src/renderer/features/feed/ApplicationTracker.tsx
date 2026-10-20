import type { MatchStatus, SeekerMatch } from "@shared/types/match.ts";
import { BellRing, CalendarCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimeFormat } from "@/lib/format.ts";

const STAGES: { value: MatchStatus; label: string }[] = [
	{ value: "applied", label: "Applied" },
	{ value: "interviewing", label: "Interviewing" },
	{ value: "offer", label: "Offer" },
	{ value: "rejected", label: "Closed" },
];

export const FOLLOW_UP_SNOOZE_DAYS = 7;

interface ApplicationTrackerProps {
	match: SeekerMatch;
	onStageChange: (status: MatchStatus) => void;
	onFollowedUp: () => void;
	onNotesChange: (notes: string) => void;
}

export function ApplicationTracker({ match, onStageChange, onFollowedUp, onNotesChange }: ApplicationTrackerProps) {
	const [notes, setNotes] = useState(match.notes);
	const awaitingReply = match.status === "applied";

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-medium">Your application</h3>
				<Select value={match.status} onValueChange={(value) => onStageChange(value as MatchStatus)}>
					<SelectTrigger size="sm" className="w-40" aria-label="Application stage">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{STAGES.map((stage) => (
							<SelectItem key={stage.value} value={stage.value}>
								{stage.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{match.appliedAt !== null && <p className="text-sm text-muted-foreground">Applied {TimeFormat.relative(match.appliedAt)}</p>}
			{awaitingReply && match.followUpDue && (
				<div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
					<p className="flex items-center gap-2 font-medium">
						<BellRing className="size-4 text-warning" /> Time to follow up
					</p>
					<p className="text-muted-foreground">No news yet. A short, friendly note to the recruiter often gets things moving.</p>
					<Button size="sm" variant="outline" className="self-start" onClick={onFollowedUp}>
						<CalendarCheck className="size-4" />
						Done, remind me in {FOLLOW_UP_SNOOZE_DAYS} days
					</Button>
				</div>
			)}
			{awaitingReply && !match.followUpDue && match.followUpAt !== null && (
				<p className="text-xs text-muted-foreground">We'll remind you to follow up {TimeFormat.relative(match.followUpAt)}.</p>
			)}
			<Textarea
				rows={3}
				placeholder="Notes: who you spoke to, next steps, salary range"
				value={notes}
				onChange={(event) => setNotes(event.target.value)}
				onBlur={() => notes !== match.notes && onNotesChange(notes)}
			/>
		</section>
	);
}
