import { useState } from "react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import type { Profile } from "@shared/types/profile.ts";
import { PreferencesForm } from "@/features/profile/PreferencesForm.tsx";
import { ResumeIntake } from "@/features/setup/ResumeIntake.tsx";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

interface PreferencesSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	snapshot: SeekerSnapshot & { profile: Profile };
	connection: SeekerConnection | null;
	guard: Guard;
}

export function PreferencesSheet({ open, onOpenChange, snapshot, connection, guard }: PreferencesSheetProps) {
	const [saving, setSaving] = useState(false);

	const save = (profile: Profile) =>
		guard(async () => {
			setSaving(true);
			try {
				await connection?.updateProfile(profile);
				onOpenChange(false);
				toast.success("Preferences saved", { description: "Your matches are being rescored." });
			} finally {
				setSaving(false);
			}
		});

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
				<SheetHeader className="border-b p-6">
					<SheetTitle>Preferences</SheetTitle>
					<SheetDescription>What you're looking for. Saving rescores every job in a couple of seconds.</SheetDescription>
				</SheetHeader>
				<div className="flex-1 overflow-y-auto p-6">
					<PreferencesForm profile={snapshot.profile} submitLabel="Save and rescore" busy={saving} onSubmit={save} />
					<Separator className="my-8" />
					<div className="flex flex-col gap-3">
						<div>
							<h3 className="text-sm font-medium">Update your resume</h3>
							<p className="text-sm text-muted-foreground">We'll refresh your roles and skills and keep the answers above.</p>
						</div>
						<ResumeIntake connection={connection} guard={guard} parsing={snapshot.parsing} resumeName={snapshot.resumeName} compact />
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
