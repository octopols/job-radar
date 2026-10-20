import { FileText, Upload } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RESUME_MAX_BYTES } from "@shared/constants.ts";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

const ACCEPTED = [".pdf", ".txt", ".md"];
const MIN_PASTE_LENGTH = 50;

interface ResumeIntakeProps {
	connection: SeekerConnection | null;
	guard: Guard;
	parsing: boolean;
	resumeName: string | null;
	compact?: boolean;
}

export function ResumeIntake({ connection, guard, parsing, resumeName, compact = false }: ResumeIntakeProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [pasting, setPasting] = useState(false);
	const [pasted, setPasted] = useState("");
	const disabled = parsing || !connection;

	const upload = (file: File | undefined) => {
		if (!file || !connection) {
			return;
		}
		if (file.size > RESUME_MAX_BYTES) {
			toast.error("That file is too large", { description: `Resumes must be under ${RESUME_MAX_BYTES / 1024 / 1024} MB. Try exporting a lighter PDF or paste the text.` });
			return;
		}
		void guard(async () => connection.uploadResume(file.name, new Uint8Array(await file.arrayBuffer())));
	};

	const onDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setDragging(false);
		if (!disabled) {
			upload(event.dataTransfer.files[0]);
		}
	};

	if (parsing) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/40 p-8 text-center">
				<Spinner className="size-6 text-primary" />
				<div>
					<p className="font-medium">Reading {resumeName ?? "your resume"}</p>
					<p className="text-sm text-muted-foreground">Claude is pulling out your titles, skills and seniority. This takes about 15 seconds.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				disabled={disabled}
				onClick={() => inputRef.current?.click()}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				className={cn(
					"flex flex-col items-center gap-2 rounded-xl border border-dashed text-center transition-colors",
					"hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
					compact ? "p-4" : "p-10",
					dragging && "border-primary bg-primary/10",
				)}
			>
				<div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
					<Upload className="size-5" />
				</div>
				<p className="font-medium">{compact ? "Upload a new resume" : "Drop your resume here, or click to browse"}</p>
				<p className="text-xs text-muted-foreground">PDF, TXT or Markdown, up to {RESUME_MAX_BYTES / 1024 / 1024} MB</p>
			</button>
			<input
				ref={inputRef}
				type="file"
				accept={ACCEPTED.join(",")}
				hidden
				onChange={(event) => {
					upload(event.target.files?.[0]);
					event.target.value = "";
				}}
			/>

			{pasting ? (
				<div className="flex flex-col gap-2">
					<Textarea rows={7} placeholder="Paste the full text of your resume" value={pasted} onChange={(event) => setPasted(event.target.value)} />
					<div className="flex justify-end gap-2">
						<Button variant="ghost" size="sm" onClick={() => setPasting(false)}>
							Cancel
						</Button>
						<Button
							size="sm"
							disabled={disabled || pasted.trim().length < MIN_PASTE_LENGTH}
							onClick={() =>
								guard(async () => {
									await connection?.pasteResume(pasted);
									setPasting(false);
									setPasted("");
								})
							}
						>
							Read resume
						</Button>
					</div>
				</div>
			) : (
				<Button variant="ghost" size="sm" className="self-center text-muted-foreground" disabled={disabled} onClick={() => setPasting(true)}>
					<FileText className="size-4" />
					Paste resume text instead
				</Button>
			)}
		</div>
	);
}
