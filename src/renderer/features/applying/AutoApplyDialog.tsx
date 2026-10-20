import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import type { AutoApplySettings } from "@shared/types/application.ts";
import { TOGGLE_SELECTED } from "@/lib/styles.ts";
import { errorMessage, type SeekerConnection } from "@/lib/rivet.ts";

const FIT_THRESHOLDS = [
	{ value: 85, label: "Strong fit" },
	{ value: 90, label: "90+" },
	{ value: 95, label: "95+" },
];

const DAILY_LIMITS = [5, 10, 20];

interface AutoApplyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	snapshot: SeekerSnapshot;
	connection: SeekerConnection | null;
	onApplicationDetails: () => void;
}

export function AutoApplyDialog({ open, onOpenChange, snapshot, connection, onApplicationDetails }: AutoApplyDialogProps) {
	const settings = snapshot.autoApply;

	const update = async (next: Partial<AutoApplySettings>) => {
		try {
			await connection?.setAutoApply({ ...settings, ...next });
		} catch (error) {
			toast.error("Could not change auto-apply", { description: errorMessage(error) });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Auto-apply</DialogTitle>
					<DialogDescription>
						As soon as a strong match is posted, Job Radar opens its application, fills every answer and attaches your resume in the background, then
						submits it or leaves it ready for you.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-5">
					<div className="flex flex-col divide-y rounded-xl border">
						<label className="flex items-center justify-between gap-4 p-4">
							<span className="flex flex-col gap-0.5">
								<span className="font-medium">Fill applications automatically</span>
								<span className="text-sm text-muted-foreground">You get a notification when each one is ready.</span>
							</span>
							<Switch
								checked={settings.enabled}
								disabled={!connection || !snapshot.applicant}
								onCheckedChange={(enabled) => void update({ enabled })}
								aria-label="Fill applications automatically"
							/>
						</label>
						<label className="flex items-center justify-between gap-4 p-4">
							<span className="flex flex-col gap-0.5">
								<span className="font-medium">Submit for me</span>
								<span className="text-sm text-muted-foreground">
									Only applications where every answer came from your details or earlier answers, with nothing estimated, no captcha and nothing to
									certify. The rest wait for you to press Submit.
								</span>
							</span>
							<Switch
								checked={settings.autoSubmit}
								disabled={!connection || !settings.enabled}
								onCheckedChange={(autoSubmit) => void update({ autoSubmit })}
								aria-label="Submit applications for me"
							/>
						</label>
					</div>

					{!snapshot.applicant && (
						<div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-4 text-sm">
							<span className="text-muted-foreground">Add your application details first so forms can be filled.</span>
							<Button
								size="sm"
								variant="outline"
								onClick={() => {
									onOpenChange(false);
									onApplicationDetails();
								}}
							>
								Add details
							</Button>
						</div>
					)}

					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium">Which matches</span>
						<ToggleGroup
							type="single"
							variant="outline"
							value={String(settings.minScore)}
							onValueChange={(value) => value && void update({ minScore: Number(value) })}
							className="w-full"
							aria-label="Minimum fit for auto-apply"
						>
							{FIT_THRESHOLDS.map((threshold) => (
								<ToggleGroupItem key={threshold.value} value={String(threshold.value)} className={`flex-1 ${TOGGLE_SELECTED}`}>
									{threshold.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>

					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium">Most applications in a day</span>
						<ToggleGroup
							type="single"
							variant="outline"
							value={String(settings.dailyLimit)}
							onValueChange={(value) => value && void update({ dailyLimit: Number(value) })}
							className="w-full"
							aria-label="Daily limit"
						>
							{DAILY_LIMITS.map((limit) => (
								<ToggleGroupItem key={limit} value={String(limit)} className={`flex-1 ${TOGGLE_SELECTED}`}>
									{limit}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>

					{settings.enabled && !snapshot.notifications.enabled && (
						<p className="text-sm text-muted-foreground">Turn on notifications from the bell to hear when an application is ready.</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
