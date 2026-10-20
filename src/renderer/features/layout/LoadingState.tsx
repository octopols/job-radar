import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_ROWS = 6;

export function LoadingState() {
	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-5">
			<Skeleton className="h-8 w-64" />
			<Skeleton className="h-4 w-96 max-w-full" />
			<div className="flex flex-col gap-px overflow-hidden rounded-xl border">
				{Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
					<Skeleton key={index} className="h-[76px] rounded-none" />
				))}
			</div>
		</div>
	);
}
