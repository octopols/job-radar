import type { Applicant } from "@shared/types/application.ts";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApplicantDefaults } from "@/features/applying/applicant-defaults.ts";
import { ChoiceField, type ChoiceOption, FormSection, LabeledField } from "@/features/applying/form-layout.tsx";
import { ResumeFilePicker } from "@/features/applying/ResumeFilePicker.tsx";
import { errorMessage, type SeekerConnection } from "@/lib/rivet.ts";

type SelfIdentification = Applicant["veteran"];
type YesNo = "yes" | "no";
type TextField = { [Key in keyof Applicant]: string extends Applicant[Key] ? Key : never }[keyof Applicant];

const SELF_IDENTIFICATION_OPTIONS: ChoiceOption<SelfIdentification>[] = [
	{ value: "no", label: "No" },
	{ value: "yes", label: "Yes" },
	{ value: "decline", label: "Prefer not to say" },
];
const YES_FIRST: ChoiceOption<YesNo>[] = [
	{ value: "yes", label: "Yes" },
	{ value: "no", label: "No" },
];
const NO_FIRST: ChoiceOption<YesNo>[] = [
	{ value: "no", label: "No" },
	{ value: "yes", label: "Yes" },
];

interface ApplicantDetailsFormProps {
	snapshot: SeekerSnapshot;
	connection: SeekerConnection | null;
	submitLabel: string;
	onSaved?: () => void;
	secondary?: ReactNode;
}

export function ApplicantDetailsForm({ snapshot, connection, submitLabel, onSaved, secondary }: ApplicantDetailsFormProps) {
	const [details, setDetails] = useState<Applicant>(() => ApplicantDefaults.prefilledFrom(snapshot));
	const [resumeFile, setResumeFile] = useState<File | null>(null);
	const [saving, setSaving] = useState(false);

	const set = <Key extends keyof Applicant>(key: Key, value: Applicant[Key]) => setDetails((current) => ({ ...current, [key]: value }));
	const textInput = (key: TextField) => ({
		value: details[key],
		onChange: (event: { target: { value: string } }) => set(key, event.target.value),
	});

	const save = async () => {
		if (!connection) {
			return;
		}
		setSaving(true);
		try {
			await connection.setApplicant(details);
			if (resumeFile) {
				await connection.setResumeFile(resumeFile.name, new Uint8Array(await resumeFile.arrayBuffer()));
			}
			onSaved?.();
		} catch (error) {
			toast.error("Could not save your details", { description: errorMessage(error) });
		} finally {
			setSaving(false);
		}
	};

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<FormSection title="Contact" description={snapshot.resumeContact ? "Read from your resume. Fix anything that's out of date." : undefined}>
				<div className="grid gap-4 sm:grid-cols-2">
					<LabeledField label="Full name" required>
						<Input {...textInput("fullName")} autoComplete="name" required />
					</LabeledField>
					<LabeledField label="Email" required>
						<Input type="email" {...textInput("email")} autoComplete="email" required />
					</LabeledField>
					<LabeledField label="Phone">
						<Input type="tel" {...textInput("phone")} autoComplete="tel" placeholder="+91 98765 43210" />
					</LabeledField>
					<LabeledField label="Where you live">
						<Input {...textInput("location")} placeholder="City, country" />
					</LabeledField>
					<LabeledField label="LinkedIn">
						<Input {...textInput("linkedinUrl")} placeholder="linkedin.com/in/you" />
					</LabeledField>
					<LabeledField label="Portfolio or GitHub">
						<Input {...textInput("websiteUrl")} placeholder="github.com/you" />
					</LabeledField>
				</div>
			</FormSection>

			<FormSection title="Work">
				<LabeledField label="Work authorization" hint="Used for every visa and sponsorship question.">
					<Textarea rows={2} {...textInput("workAuthorization")} />
				</LabeledField>
				<div className="grid gap-4 sm:grid-cols-2">
					<LabeledField label="Notice period">
						<Input {...textInput("noticePeriod")} placeholder="30 days" />
					</LabeledField>
					<LabeledField label="Salary expectation">
						<Input {...textInput("salaryExpectation")} placeholder="Leave blank to answer per job" />
					</LabeledField>
				</div>
				<LabeledField label="Companies you've worked for" hint="Answers 'have you worked here before' questions.">
					<Input {...textInput("pastEmployers")} placeholder="Separate with commas" />
				</LabeledField>
				<LabeledField label="Resume to attach" containsSeveralControls>
					<ResumeFilePicker attachedName={resumeFile?.name ?? snapshot.resumeFileName} onPick={setResumeFile} />
				</LabeledField>
			</FormSection>

			<FormSection title="Common questions" description="Set to the most common answers. Change any that are different for you.">
				<ChoiceField label="Are you a protected veteran?" value={details.veteran} options={SELF_IDENTIFICATION_OPTIONS} onChange={(value) => set("veteran", value)} />
				<ChoiceField label="Do you have a disability?" value={details.disability} options={SELF_IDENTIFICATION_OPTIONS} onChange={(value) => set("disability", value)} />
				<ChoiceField label="Are you 18 or older?" value={details.over18 ? "yes" : "no"} options={YES_FIRST} onChange={(value) => set("over18", value === "yes")} />
				<ChoiceField
					label="Bound by a non-compete or similar agreement?"
					value={details.nonCompete ? "yes" : "no"}
					options={NO_FIRST}
					onChange={(value) => set("nonCompete", value === "yes")}
				/>
				<div className="grid gap-4 sm:grid-cols-2">
					<LabeledField label="Gender" hint="Leave blank to decline.">
						<Input {...textInput("gender")} placeholder="Prefer not to say" />
					</LabeledField>
					<LabeledField label="Race or ethnicity" hint="Leave blank to decline.">
						<Input {...textInput("ethnicity")} placeholder="Prefer not to say" />
					</LabeledField>
				</div>
				<LabeledField label="Where you usually find jobs">
					<Input {...textInput("heardFrom")} />
				</LabeledField>
				<LabeledField label="Anything else forms often ask" hint="Earliest start date, willingness to travel, pronouns, and so on.">
					<Textarea rows={2} {...textInput("otherFacts")} />
				</LabeledField>
			</FormSection>

			<div className="flex flex-wrap justify-end gap-2">
				{secondary}
				<Button type="submit" disabled={saving || !connection}>
					{saving && <Spinner />}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
