import { RESUME_MAX_BYTES } from "@shared/constants.ts";
import { FileText, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ResumeFilePickerProps {
	attachedName: string | null;
	onPick: (file: File) => void;
}

export function ResumeFilePicker({ attachedName, onPick }: ResumeFilePickerProps) {
	const fileInput = useRef<HTMLInputElement>(null);

	const pick = (file: File | undefined) => {
		if (!file) {
			return;
		}
		if (file.size > RESUME_MAX_BYTES) {
			toast.error("That file is too large", { description: `Resumes must be under ${RESUME_MAX_BYTES / 1024 / 1024} MB.` });
			return;
		}
		onPick(file);
	};

	return (
		<div className="flex items-center gap-3 rounded-lg border p-3">
			<FileText className="size-4 shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1 truncate text-sm">{attachedName ?? "No file yet. Forms that ask for a resume will wait for you."}</span>
			<Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
				<Upload className="size-4" />
				{attachedName ? "Replace" : "Choose PDF"}
			</Button>
			<input
				ref={fileInput}
				type="file"
				accept=".pdf,.doc,.docx"
				hidden
				onChange={(event) => {
					pick(event.target.files?.[0]);
					event.target.value = "";
				}}
			/>
		</div>
	);
}
