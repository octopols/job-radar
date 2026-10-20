import type { ApplicationPhase, ApplicationStatus } from "@shared/ipc/apply.ts";
import type { SeekerMatch } from "@shared/types/match.ts";
import { Check, WandSparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type AutoApplyResult = NonNullable<SeekerMatch["autoApply"]>;

const BUSY_PHASES: readonly ApplicationPhase[] = ["opening", "reading", "drafting"];

const PHASE_MESSAGES: Record<ApplicationPhase, (status: ApplicationStatus) => string> = {
	opening: () => "Opening the application form",
	reading: () => "Reading the application form",
	drafting: () => "Claude is writing your answers",
	ready: (status) =>
		status.needsYou > 0
			? `Filled ${status.filled} answers. ${status.needsYou} need you in the application window, then press Submit there.`
			: `Filled ${status.filled} answers. Review them and press Submit in the application window.`,
	"no-form": () => "Open the form in the application window, then press Fill this page.",
	submitted: () => "Application sent and marked as applied.",
	failed: (status) => `Could not fill the form: ${status.error ?? "unknown error"}`,
};

const AUTO_APPLY_MESSAGES: Record<AutoApplyResult["outcome"], string> = {
	ready: "Auto-apply filled this application. Review it and press Submit.",
	submitted: "Auto-apply submitted this application for you.",
	"needs-you": "Auto-apply filled what it could.",
	failed: "Auto-apply couldn't fill this one.",
};

export function ApplicationProgress({ status }: { status: ApplicationStatus }) {
	const icon = BUSY_PHASES.includes(status.phase) ? (
		<Spinner className="size-4" />
	) : status.phase === "submitted" ? (
		<Check className="size-4 text-success" />
	) : (
		<WandSparkles className="size-4" />
	);
	return (
		<p className={`flex w-full items-center gap-2 text-sm ${status.phase === "failed" ? "text-destructive" : "text-muted-foreground"}`} role="status">
			{icon}
			{PHASE_MESSAGES[status.phase](status)}
		</p>
	);
}

export function AutoApplyNote({ autoApply }: { autoApply: AutoApplyResult }) {
	return (
		<p className={`flex w-full items-start gap-2 text-sm ${autoApply.outcome === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
			<WandSparkles className="mt-0.5 size-4 shrink-0" />
			<span>
				{AUTO_APPLY_MESSAGES[autoApply.outcome]} {autoApply.outcome !== "ready" && autoApply.note}
			</span>
		</p>
	);
}
