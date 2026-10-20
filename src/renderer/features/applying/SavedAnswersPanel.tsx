import { MessageSquareText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SavedAnswer } from "@shared/types/application.ts";
import { TimeFormat } from "@/lib/format.ts";
import { errorMessage, type SeekerConnection } from "@/lib/rivet.ts";

const SHORT_ANSWER_LENGTH = 80;

export function SavedAnswersPanel({ connection }: { connection: SeekerConnection | null }) {
	const [answers, setAnswers] = useState<SavedAnswer[] | null>(null);

	useEffect(() => {
		if (!connection) {
			return;
		}
		void connection
			.savedAnswers()
			.then(setAnswers)
			.catch((error: unknown) => {
				setAnswers([]);
				toast.error("Could not load saved answers", { description: errorMessage(error) });
			});
	}, [connection]);

	if (answers === null) {
		return (
			<div className="flex flex-col gap-3">
				<Skeleton className="h-20" />
				<Skeleton className="h-20" />
			</div>
		);
	}

	if (answers.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
				<MessageSquareText className="size-5 text-muted-foreground" />
				<p className="font-medium">No saved answers yet</p>
				<p className="max-w-sm text-sm text-muted-foreground">
					When you submit an application, Job Radar keeps your answers here and reuses them the next time a form asks the same question.
				</p>
			</div>
		);
	}

	const forget = async (key: string) => {
		try {
			await connection?.forgetSavedAnswer(key);
			setAnswers((current) => current?.filter((answer) => answer.key !== key) ?? null);
		} catch (error) {
			toast.error("Could not delete that answer", { description: errorMessage(error) });
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm text-muted-foreground">
				{answers.length} {answers.length === 1 ? "answer" : "answers"} from forms you submitted. Edits apply to your next applications.
			</p>
			{answers.map((answer) => (
				<SavedAnswerItem key={answer.key} answer={answer} connection={connection} onForget={() => void forget(answer.key)} />
			))}
		</div>
	);
}

function SavedAnswerItem({ answer, connection, onForget }: { answer: SavedAnswer; connection: SeekerConnection | null; onForget: () => void }) {
	const [text, setText] = useState(answer.answer);
	const [saved, setSaved] = useState(answer.answer);

	const save = async () => {
		if (text.trim() === saved.trim()) {
			return;
		}
		try {
			await connection?.updateSavedAnswer(answer.key, text);
			setSaved(text);
			toast.success("Answer updated");
		} catch (error) {
			setText(saved);
			toast.error("Could not update that answer", { description: errorMessage(error) });
		}
	};

	return (
		<div className="flex flex-col gap-2 rounded-xl border p-3">
			<div className="flex items-start gap-2">
				<p className="flex-1 text-sm font-medium">{answer.question}</p>
				<Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground" aria-label={`Delete saved answer to ${answer.question}`} onClick={onForget}>
					<Trash2 className="size-4" />
				</Button>
			</div>
			{saved.length <= SHORT_ANSWER_LENGTH && !saved.includes("\n") ? (
				<Input value={text} onChange={(event) => setText(event.target.value)} onBlur={() => void save()} aria-label={`Answer to ${answer.question}`} />
			) : (
				<Textarea
					rows={Math.min(8, Math.ceil(text.length / 70))}
					value={text}
					onChange={(event) => setText(event.target.value)}
					onBlur={() => void save()}
					aria-label={`Answer to ${answer.question}`}
				/>
			)}
			<p className="text-xs text-muted-foreground">
				Last used with {answer.company}, {TimeFormat.relative(answer.updatedAt)}
			</p>
		</div>
	);
}
