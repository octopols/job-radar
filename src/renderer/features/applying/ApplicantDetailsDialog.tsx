import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { ApplicantDetailsForm } from "@/features/applying/ApplicantDetailsForm.tsx";
import type { SeekerConnection } from "@/lib/rivet.ts";
import { SavedAnswersPanel } from "@/features/applying/SavedAnswersPanel.tsx";

interface ApplicantDetailsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	snapshot: SeekerSnapshot;
	connection: SeekerConnection | null;
	submitLabel?: string;
	onSaved?: () => void;
}

export function ApplicantDetailsDialog({ open, onOpenChange, snapshot, connection, submitLabel = "Save details", onSaved }: ApplicantDetailsDialogProps) {
	const [tab, setTab] = useState<"details" | "answers">("details");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Application details</DialogTitle>
					<DialogDescription>
						Job Radar copies these into application forms exactly as written. Claude never makes them up, so anything you leave blank is left for you to answer
						on the form.
					</DialogDescription>
				</DialogHeader>

				<Tabs value={tab} onValueChange={(value) => setTab(value as "details" | "answers")} className="gap-4">
					<TabsList>
						<TabsTrigger value="details">Your details</TabsTrigger>
						<TabsTrigger value="answers">Saved answers</TabsTrigger>
					</TabsList>
					<TabsContent value="details">
						<ApplicantDetailsForm
							snapshot={snapshot}
							connection={connection}
							submitLabel={submitLabel}
							onSaved={() => {
								onOpenChange(false);
								onSaved?.();
							}}
							secondary={
								<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
									Cancel
								</Button>
							}
						/>
					</TabsContent>
					<TabsContent value="answers">
						<SavedAnswersPanel connection={connection} />
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
