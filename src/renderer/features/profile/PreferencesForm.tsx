import { ChevronDown } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WORK_MODES, type WorkMode } from "@shared/types/posting.ts";
import { type Profile, SENIORITY_ORDER, type Seniority } from "@shared/types/profile.ts";
import { SENIORITY_LABELS } from "@/lib/format.ts";
import { TOGGLE_SELECTED } from "@/lib/styles.ts";
import { TagInput } from "@/components/TagInput.tsx";

interface PreferencesFormProps {
	profile: Profile;
	submitLabel: string;
	busy: boolean;
	onSubmit: (profile: Profile) => void;
	advancedOpen?: boolean;
}

const WORK_MODE_OPTIONS: Record<WorkMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

export function PreferencesForm({ profile, submitLabel, busy, onSubmit, advancedOpen = false }: PreferencesFormProps) {
	const [draft, setDraft] = useState(profile);
	const [showAdvanced, setShowAdvanced] = useState(advancedOpen);
	useEffect(() => setDraft(profile), [profile]);

	const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((current) => ({ ...current, [key]: value }));
	const valid = draft.targetTitles.length > 0 && draft.workModes.length > 0;
	const officeWork = draft.workModes.some((mode) => mode !== "remote");

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (valid) {
			onSubmit(draft);
		}
	};

	return (
		<form onSubmit={submit} className="flex flex-col gap-6">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="roles">What roles do you want?</FieldLabel>
					<TagInput id="roles" values={draft.targetTitles} onChange={(values) => update("targetTitles", values)} placeholder="Backend Engineer" />
					<FieldDescription>We read these from your resume. Remove any you do not want.</FieldDescription>
				</Field>

				<Field>
					<FieldLabel>Your level</FieldLabel>
					<ToggleGroup
						type="single"
						variant="outline"
						value={draft.seniority}
						onValueChange={(value) => value && update("seniority", value as Seniority)}
						className="w-full flex-wrap"
					>
						{SENIORITY_ORDER.map((level) => (
							<ToggleGroupItem key={level} value={level} className={`flex-1 ${TOGGLE_SELECTED}`}>
								{SENIORITY_LABELS[level]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</Field>

				<Field>
					<FieldLabel>How do you want to work?</FieldLabel>
					<ToggleGroup
						type="multiple"
						variant="outline"
						value={draft.workModes}
						onValueChange={(values) => values.length > 0 && update("workModes", values as WorkMode[])}
						className="w-full"
					>
						{WORK_MODES.map((mode) => (
							<ToggleGroupItem key={mode} value={mode} className={`flex-1 ${TOGGLE_SELECTED}`}>
								{WORK_MODE_OPTIONS[mode]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</Field>

				{officeWork && (
					<Field>
						<FieldLabel htmlFor="locations">Where can you work from an office?</FieldLabel>
						<TagInput id="locations" values={draft.locations} onChange={(values) => update("locations", values)} placeholder="Bengaluru" />
					</Field>
				)}

				<Field orientation="horizontal">
					<Switch id="relocate" checked={draft.openToRelocation} onCheckedChange={(checked) => update("openToRelocation", checked)} />
					<div className="flex flex-col gap-0.5">
						<FieldLabel htmlFor="relocate">Open to relocating</FieldLabel>
						<FieldDescription>Jobs in other cities still show up, ranked a little lower.</FieldDescription>
					</div>
				</Field>

				<Field>
					<FieldLabel htmlFor="work-countries">Countries where you can work without a visa</FieldLabel>
					<TagInput id="work-countries" values={draft.workCountries} onChange={(values) => update("workCountries", values)} placeholder="India" />
					<FieldDescription>
						Jobs anywhere else only count as a good fit when the posting says it sponsors visas.
					</FieldDescription>
				</Field>
			</FieldGroup>

			<div className="flex flex-col gap-4">
				<button
					type="button"
					className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
					onClick={() => setShowAdvanced(!showAdvanced)}
					aria-expanded={showAdvanced}
				>
					<ChevronDown className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
					More options
				</button>
				{showAdvanced && (
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="skills">Skills to match</FieldLabel>
							<TagInput id="skills" values={draft.skills} onChange={(values) => update("skills", values)} placeholder="Go" />
						</Field>
						<Field>
							<FieldLabel htmlFor="exclude">Never show titles containing</FieldLabel>
							<TagInput id="exclude" values={draft.excludeKeywords} onChange={(values) => update("excludeKeywords", values)} placeholder="manager" />
						</Field>
					</FieldGroup>
				)}
			</div>

			<Button type="submit" disabled={!valid || busy} className="self-start">
				{submitLabel}
			</Button>
		</form>
	);
}
