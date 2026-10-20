import type { ApplicationStatus } from "@shared/ipc/apply.ts";
import { useEffect, useState } from "react";
import { ApplicationStatuses } from "@/lib/desktop.ts";

export function useApplicationStatus(boardKey: string, postingId: string): ApplicationStatus | null {
	const key = ApplicationStatuses.key(boardKey, postingId);
	const [status, setStatus] = useState(() => ApplicationStatuses.get(key));
	useEffect(() => ApplicationStatuses.subscribe(() => setStatus(ApplicationStatuses.get(key))), [key]);
	return status;
}
