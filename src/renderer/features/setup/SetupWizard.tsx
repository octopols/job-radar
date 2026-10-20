import { DEFAULT_PREFERENCES } from "@shared/constants.ts";
import type { DesktopSettingsView } from "@shared/ipc/desktop-bridge.ts";
import type { CatalogBoard } from "@shared/types/board.ts";
import type { Profile } from "@shared/types/profile.ts";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { PenLine } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiConnect } from "@/features/ai/AiConnect.tsx";
import { ApplicantDetailsForm } from "@/features/applying/ApplicantDetailsForm.tsx";
import { PreferencesForm } from "@/features/profile/PreferencesForm.tsx";
import { CompanyPicker } from "@/features/setup/CompanyPicker.tsx";
import { ResumeIntake } from "@/features/setup/ResumeIntake.tsx";
import { SetupProgress } from "@/features/setup/SetupProgress.tsx";
import type { SetupStep } from "@/features/setup/setup-step.ts";
import { StepHeading } from "@/features/setup/StepHeading.tsx";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

const BLANK_PROFILE: Profile = {
	headline: "",
	seniority: "mid",
	yearsExperience: null,
	targetTitles: [],
	skills: [],
	locations: [],
	...DEFAULT_PREFERENCES,
};

interface SetupWizardProps {
	step: SetupStep;
	snapshot: SeekerSnapshot;
	catalog: readonly CatalogBoard[];
	connection: SeekerConnection | null;
	guard: Guard;
	desktopSettings: DesktopSettingsView | null;
	onDesktopSettingsChanged: () => Promise<void>;
}

export function SetupWizard({ step, snapshot, catalog, connection, guard, desktopSettings, onDesktopSettingsChanged }: SetupWizardProps) {
	const [fillingProfileByHand, setFillingProfileByHand] = useState(false);
	const [saving, setSaving] = useState(false);
	const activeStep = fillingProfileByHand && step === "resume" ? "preferences" : step;

	const saveProfile = (profile: Profile) =>
		guard(async () => {
			setSaving(true);
			try {
				await connection?.updateProfile(profile);
			} finally {
				setSaving(false);
			}
		});

	return (
		<div className="mx-auto flex max-w-xl flex-col gap-8 py-8 sm:py-12">
			<SetupProgress activeStep={activeStep} />

			{activeStep === "ai" && desktopSettings && (
				<section className="flex flex-col gap-6">
					<StepHeading
						title="Connect Claude"
						description="Job Radar uses Claude to read your resume, find companies' job boards and explain why a job fits. Everything else runs on this computer."
					/>
					<AiConnect settings={desktopSettings} onConnected={onDesktopSettingsChanged} />
				</section>
			)}

			{activeStep === "resume" && (
				<section className="flex flex-col gap-6">
					<StepHeading title="Jobs that fit you, the moment they're posted" description="Start with your resume. We'll read it once to learn your roles, skills and level." />
					<Card>
						<CardContent className="flex flex-col gap-3">
							<ResumeIntake connection={connection} guard={guard} parsing={snapshot.parsing} resumeName={snapshot.resumeName} />
							{snapshot.parseError && <p className="text-center text-sm text-destructive">{snapshot.parseError}</p>}
						</CardContent>
					</Card>
					{!snapshot.parsing && (
						<Button variant="link" size="sm" className="self-center text-muted-foreground" onClick={() => setFillingProfileByHand(true)}>
							<PenLine className="size-4" />
							No resume handy? Fill it in yourself
						</Button>
					)}
				</section>
			)}

			{activeStep === "preferences" && (
				<section className="flex flex-col gap-6">
					<StepHeading
						title={snapshot.profile ? "A few things your resume can't tell us" : "Tell us what you're looking for"}
						description="This takes a minute and makes your matches far more relevant. You can change it any time."
					/>
					<PreferencesForm profile={snapshot.profile ?? BLANK_PROFILE} submitLabel="Continue" busy={saving} advancedOpen={!snapshot.profile} onSubmit={saveProfile} />
				</section>
			)}

			{activeStep === "applying" && (
				<section className="flex flex-col gap-6">
					<StepHeading
						title="Get ready to apply"
						description="Job Radar fills application forms with these. We read what we could from your resume and set the common questions to the usual answers."
					/>
					<ApplicantDetailsForm
						snapshot={snapshot}
						connection={connection}
						submitLabel="Continue"
						secondary={
							<Button type="button" variant="ghost" onClick={() => guard(async () => connection?.skipApplicantSetup())}>
								Skip for now
							</Button>
						}
					/>
				</section>
			)}

			{activeStep === "companies" && <CompanyPicker catalog={catalog} connection={connection} guard={guard} />}
		</div>
	);
}
