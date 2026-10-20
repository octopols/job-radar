import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FIT_LEVELS, JobFormat } from "@/lib/format.ts";

export function FitBadge({ score, showScore = false, className }: { score: number; showScore?: boolean; className?: string }) {
	const level = FIT_LEVELS[JobFormat.fitLevel(score)];
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", level.text, className)}>
					<span className={cn("size-2 rounded-full", level.dot)} />
					{level.label}
					{showScore && <span className="text-muted-foreground tabular-nums">{score}/100</span>}
				</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-60">Fit {score} out of 100, from the title, your skills, level and where you want to work.</TooltipContent>
		</Tooltip>
	);
}
