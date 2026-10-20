import { FolderOpen, HardDrive, Send, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { DesktopSettingsView } from "@shared/ipc/desktop-bridge.ts";
import { desktop } from "@/lib/desktop.ts";

interface YourDataDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	settings: DesktopSettingsView;
}

export function YourDataDialog({ open, onOpenChange, settings }: YourDataDialogProps) {
	const [confirming, setConfirming] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const claudeRoute = settings.ai.kind === "anthropic-api" ? "the Anthropic API, using your key" : "Claude Code on this computer";

	const close = (next: boolean) => {
		if (!deleting) {
			setConfirming(false);
			onOpenChange(next);
		}
	};

	const deleteEverything = async () => {
		setDeleting(true);

		await desktop?.resetEverything();
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				{confirming ? (
					<>
						<DialogHeader>
							<DialogTitle>Delete everything?</DialogTitle>
							<DialogDescription>
								This removes your profile, resume details, matches, saved jobs, applications and notes, the companies you watch, and your Claude
								connection. Job Radar then restarts as if newly installed. This can't be undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" disabled={deleting} onClick={() => setConfirming(false)}>
								Keep my data
							</Button>
							<Button variant="destructive" disabled={deleting} onClick={() => void deleteEverything()}>
								{deleting ? <Spinner /> : <Trash2 className="size-4" />}
								{deleting ? "Deleting..." : "Delete everything"}
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Your data</DialogTitle>
							<DialogDescription>Job Radar has no account. It runs on this computer and keeps everything here.</DialogDescription>
						</DialogHeader>
						<div className="flex flex-col gap-4 text-sm">
							<Fact icon={HardDrive} title="Stored on this computer">
								Your profile, matches, applications and notes live in this folder:
								<span className="mt-1 block break-all font-mono text-xs text-foreground">{settings.dataPath}</span>
							</Fact>
							<Fact icon={Send} title="What leaves this computer">
								Your resume and job descriptions are sent to Claude through {claudeRoute}, to read them and explain fits. Job listings are downloaded
								straight from each company's job board.
							</Fact>
						</div>
						<Separator />
						<div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
							<Button variant="outline" onClick={() => desktop?.openDataFolder()}>
								<FolderOpen className="size-4" />
								Show folder
							</Button>
							<Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
								<Trash2 className="size-4" />
								Delete everything and start over
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

function Fact({ icon: Icon, title, children }: { icon: typeof HardDrive; title: string; children: ReactNode }) {
	return (
		<div className="flex gap-3">
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<div className="flex flex-col gap-0.5">
				<p className="font-medium">{title}</p>
				<p className="text-muted-foreground">{children}</p>
			</div>
		</div>
	);
}
