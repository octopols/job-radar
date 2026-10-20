import { type MatchStatus, PIPELINE_STATUSES, type SeekerMatch } from "@shared/types/match.ts";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { useState } from "react";
import { FitBadge } from "@/components/FitBadge.tsx";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApplicantDetailsDialog } from "@/features/applying/ApplicantDetailsDialog.tsx";
import { ApplicationProgress, AutoApplyNote } from "@/features/feed/ApplicationProgress.tsx";
import { ApplicationTracker, FOLLOW_UP_SNOOZE_DAYS } from "@/features/feed/ApplicationTracker.tsx";
import { FitBrief } from "@/features/feed/FitBrief.tsx";
import { JobActions } from "@/features/feed/JobActions.tsx";
import { MatchReasons } from "@/features/feed/MatchReasons.tsx";
import { PostingDescription } from "@/features/feed/PostingDescription.tsx";
import { useApplicationStatus } from "@/hooks/use-application-status.ts";
import { desktop } from "@/lib/desktop.ts";
import { JobFormat, TimeFormat } from "@/lib/format.ts";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

interface JobDetailSheetProps {
	match: SeekerMatch | null;
	snapshot: SeekerSnapshot;
	onClose: () => void;
	connection: SeekerConnection | null;
	guard: Guard;
	onMatchChanged: (match: SeekerMatch) => void;
}

type JobDetailProps = Omit<JobDetailSheetProps, "match"> & { match: SeekerMatch };

export function JobDetailSheet({ match, ...props }: JobDetailSheetProps) {
	return (
		<Sheet open={match !== null} onOpenChange={(open) => !open && props.onClose()}>
			<SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
				{match && <JobDetail key={`${match.boardKey}/${match.postingId}`} match={match} {...props} />}
			</SheetContent>
		</Sheet>
	);
}

function JobDetail({ match, snapshot, connection, guard, onMatchChanged, onClose }: JobDetailProps) {
	const [applicantDialogOpen, setApplicantDialogOpen] = useState(false);
	const application = useApplicationStatus(match.boardKey, match.postingId);
	const inPipeline = PIPELINE_STATUSES.includes(match.status);
	const sourceCredit = JobFormat.sourceCredit(match.boardKey);

	const saveChange = (change: () => Promise<SeekerMatch | undefined>) =>
		guard(async () => {
			const changed = await change();
			if (changed) {
				onMatchChanged(changed);
			}
		});
	const setStatus = (status: MatchStatus) => saveChange(async () => connection?.setStatus(match.boardKey, match.postingId, status));

	const applyWithAi = (applicantReady = Boolean(snapshot.applicant)) => {
		if (!applicantReady) {
			setApplicantDialogOpen(true);
			return;
		}
		desktop?.startApplication({ seekerKey: snapshot.id, boardKey: match.boardKey, postingId: match.postingId, url: match.url, title: match.title, company: match.company });
	};

	return (
		<>
			<SheetHeader className="gap-3 border-b p-6">
				<div className="flex flex-col gap-1">
					<SheetTitle className="pr-6 text-xl leading-snug">{match.title}</SheetTitle>
					<SheetDescription>
						<span className="font-medium text-foreground">{match.company}</span> · {JobFormat.place(match)}
						{match.postedAt !== null && <> · posted {TimeFormat.relative(match.postedAt)}</>}
						{sourceCredit && <> · {sourceCredit}</>}
					</SheetDescription>
				</div>
				{!inPipeline && <FitBadge score={match.score} showScore />}
			</SheetHeader>

			<div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
				{inPipeline && (
					<ApplicationTracker
						match={match}
						onStageChange={setStatus}
						onFollowedUp={() => saveChange(async () => connection?.snoozeFollowUp(match.boardKey, match.postingId, FOLLOW_UP_SNOOZE_DAYS))}
						onNotesChange={(notes) => saveChange(async () => connection?.setNotes(match.boardKey, match.postingId, notes))}
					/>
				)}
				<MatchReasons match={match} />
				<FitBrief match={match} connection={connection} guard={guard} />
				<Separator />
				<PostingDescription match={match} connection={connection} />
			</div>

			<SheetFooter className="flex-row flex-wrap items-center gap-2 border-t p-4">
				{application ? <ApplicationProgress status={application} /> : match.autoApply && <AutoApplyNote autoApply={match.autoApply} />}
				<JobActions
					match={match}
					onStatusChange={setStatus}
					onApplyWithAi={() => applyWithAi()}
					onHide={() => {
						void setStatus("hidden");
						onClose();
					}}
				/>
			</SheetFooter>
			{desktop && (
				<ApplicantDetailsDialog
					open={applicantDialogOpen}
					onOpenChange={setApplicantDialogOpen}
					snapshot={snapshot}
					connection={connection}
					submitLabel="Save and apply"
					onSaved={() => applyWithAi(true)}
				/>
			)}
		</>
	);
}
