export function StepHeading({ title, description }: { title: string; description: string }) {
	return (
		<div className="flex flex-col gap-2">
			<h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
			<p className="text-pretty text-muted-foreground">{description}</p>
		</div>
	);
}
