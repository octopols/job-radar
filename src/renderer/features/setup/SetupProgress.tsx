import { Check } from "lucide-react";
import type { SetupStep } from "@/features/setup/setup-step.ts";
import { desktop } from "@/lib/desktop.ts";
import { cn } from "@/lib/utils";

const STEPS: { id: SetupStep; label: string }[] = [
	...(desktop ? [{ id: "ai" as const, label: "Connect Claude" }] : []),
	{ id: "resume", label: "Resume" },
	{ id: "preferences", label: "Preferences" },
	...(desktop ? [{ id: "applying" as const, label: "Applying" }] : []),
	{ id: "companies", label: "Companies" },
];

export function SetupProgress({ activeStep }: { activeStep: SetupStep }) {
	const activeIndex = STEPS.findIndex((step) => step.id === activeStep);
	return (
		<ol className="flex items-center gap-2 text-xs" aria-label="Setup progress">
			{STEPS.map((step, index) => {
				const done = index < activeIndex;
				const current = index === activeIndex;
				return (
					<li key={step.id} className="flex flex-1 items-center gap-2">
						<span
							className={cn(
								"flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
								done && "border-primary bg-primary text-primary-foreground",
								current && "border-primary text-primary",
								!done && !current && "text-muted-foreground",
							)}
						>
							{done ? <Check className="size-3" /> : index + 1}
						</span>
						<span className={cn("font-medium", current ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
						{index < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
					</li>
				);
			})}
		</ol>
	);
}
