import type { BoardStatus, CatalogBoard, Overview } from "@shared/types/board.ts";
import type { MatchesAdded, SeekerMatch } from "@shared/types/match.ts";
import type { Profile } from "@shared/types/profile.ts";
import type { PushMessage } from "@shared/types/push.ts";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApplicantDetailsDialog } from "@/features/applying/ApplicantDetailsDialog.tsx";
import { AutoApplyDialog } from "@/features/applying/AutoApplyDialog.tsx";
import { CompaniesSheet } from "@/features/companies/CompaniesSheet.tsx";
import { Feed } from "@/features/feed/Feed.tsx";
import { Header } from "@/features/layout/Header.tsx";
import { LoadingState } from "@/features/layout/LoadingState.tsx";
import { PreferencesSheet } from "@/features/profile/PreferencesSheet.tsx";
import { SetupSteps } from "@/features/setup/setup-step.ts";
import { SetupWizard } from "@/features/setup/SetupWizard.tsx";
import { useDesktopSettings } from "@/hooks/use-desktop-settings.ts";
import { DesktopNotifications, desktop } from "@/lib/desktop.ts";
import { errorMessage, profileId, useActor } from "@/lib/rivet.ts";

export function App() {
	const id = useMemo(profileId, []);
	const [openedAt] = useState(Date.now);
	const seeker = useActor({ name: "seeker", key: [id] });
	const directory = useActor({ name: "directory", key: ["global"] });

	const [snapshot, setSnapshot] = useState<SeekerSnapshot | null>(null);
	const [matches, setMatches] = useState<SeekerMatch[]>([]);
	const [catalog, setCatalog] = useState<readonly CatalogBoard[]>([]);
	const [boards, setBoards] = useState<Record<string, BoardStatus>>({});
	const [preferencesOpen, setPreferencesOpen] = useState(false);
	const [companiesOpen, setCompaniesOpen] = useState(false);
	const [applicantOpen, setApplicantOpen] = useState(false);
	const [autoApplyOpen, setAutoApplyOpen] = useState(false);
	const desktopSettings = useDesktopSettings();

	const guard = useCallback(async (work: () => Promise<unknown>) => {
		try {
			await work();
		} catch (caught) {
			toast.error(errorMessage(caught));
		}
	}, []);

	const reloadMatches = useCallback(async () => {
		if (seeker.connection) {
			setMatches(await seeker.connection.matches());
		}
	}, [seeker.connection]);

	const replaceMatch = useCallback((changed: SeekerMatch) => {
		setMatches((current) =>
			current.map((match) => (match.boardKey === changed.boardKey && match.postingId === changed.postingId ? { ...match, ...changed } : match)),
		);
	}, []);

	useEffect(() => {
		const connection = seeker.connection;
		if (!connection) {
			return;
		}
		void guard(async () => {
			const [current, list] = await Promise.all([connection.snapshot(), connection.matches()]);
			setSnapshot(current);
			setMatches(list);
		});
	}, [seeker.connection, guard]);

	useEffect(() => {
		const connection = directory.connection;
		if (!connection) {
			return;
		}
		void guard(async () => {
			const [overview, boardCatalog]: [Overview, readonly CatalogBoard[]] = await Promise.all([connection.overview(), connection.catalog()]);
			setBoards(Object.fromEntries(overview.boards.map((board) => [board.key, board])));
			setCatalog(boardCatalog);
		});
	}, [directory.connection, guard]);

	useEffect(() => {
		if (snapshot?.id) {
			desktop?.watchProfile(snapshot.id);
		}
	}, [snapshot?.id]);

	seeker.useEvent("snapshot", (next: SeekerSnapshot) => {
		setSnapshot((previous) => {
			if (previous?.parsing && !next.parsing && next.parseError) {
				toast.error("We couldn't read that resume", { description: next.parseError });
			}
			return next;
		});
	});
	seeker.useEvent("matchesReset", () => void reloadMatches());
	seeker.useEvent("matchUpdated", (changed: SeekerMatch) => {
		replaceMatch(changed);
		if (changed.followUpDue) {
			toast(`Time to follow up with ${changed.company}`, { description: changed.title });
		}
	});
	seeker.useEvent("matchesAdded", (payload: MatchesAdded) => {
		setMatches((current) => {
			const known = new Set(current.map((match) => `${match.boardKey}/${match.postingId}`));
			return [...payload.matches.filter((match) => !known.has(`${match.boardKey}/${match.postingId}`)), ...current];
		});
	});
	seeker.useEvent("notification", (message: PushMessage) => DesktopNotifications.show(message, message.tag === "test"));
	directory.useEvent("boardUpdated", (status: BoardStatus) => setBoards((current) => ({ ...current, [status.key]: status })));
	directory.useEvent("boardForgotten", (key: string) =>
		setBoards((current) => Object.fromEntries(Object.entries(current).filter(([boardKey]) => boardKey !== key))),
	);

	const followedBoards = snapshot ? snapshot.follows.map((key) => boards[key]).filter((board): board is BoardStatus => board !== undefined) : [];
	const aiReady = !desktop || Boolean(desktopSettings.settings?.ai.configured);
	const step = snapshot && (!desktop || desktopSettings.settings) ? SetupSteps.current(snapshot, aiReady, desktop !== null) : null;
	const ready = snapshot !== null && step === null && snapshot.profile !== null;

	return (
		<div className="min-h-svh">
			<Header
				connected={seeker.connStatus === "connected"}
				boards={followedBoards}
				snapshot={snapshot}
				connection={seeker.connection}
				guard={guard}
				ready={ready}
				onPreferences={() => setPreferencesOpen(true)}
				onCompanies={() => setCompaniesOpen(true)}
				onApplicationDetails={() => setApplicantOpen(true)}
				onAutoApply={() => setAutoApplyOpen(true)}
				desktopSettings={desktopSettings.settings}
				onDesktopSettingsChanged={desktopSettings.refresh}
			/>

			<main className="mx-auto max-w-5xl px-4 py-8">
				{snapshot === null || (desktop && !desktopSettings.settings) ? (
					<LoadingState />
				) : step !== null ? (
					<SetupWizard
						step={step}
						snapshot={snapshot}
						catalog={catalog}
						connection={seeker.connection}
						guard={guard}
						desktopSettings={desktopSettings.settings}
						onDesktopSettingsChanged={desktopSettings.refresh}
					/>
				) : (
					snapshot.profile && (
						<Feed
							matches={matches}
							snapshot={{ ...snapshot, profile: snapshot.profile }}
							onMatchChanged={replaceMatch}
							connection={seeker.connection}
							guard={guard}
							openedAt={openedAt}
							onEditPreferences={() => setPreferencesOpen(true)}
						/>
					)
				)}
			</main>

			{ready && snapshot?.profile && (
				<>
					<PreferencesSheet
						open={preferencesOpen}
						onOpenChange={setPreferencesOpen}
						snapshot={{ ...snapshot, profile: snapshot.profile as Profile }}
						connection={seeker.connection}
						guard={guard}
					/>
					{desktop && (
						<AutoApplyDialog
							open={autoApplyOpen}
							onOpenChange={setAutoApplyOpen}
							snapshot={snapshot}
							connection={seeker.connection}
							onApplicationDetails={() => setApplicantOpen(true)}
						/>
					)}
					{desktop && applicantOpen && (
						<ApplicantDetailsDialog open={applicantOpen} onOpenChange={setApplicantOpen} snapshot={snapshot} connection={seeker.connection} />
					)}
					<CompaniesSheet
						open={companiesOpen}
						onOpenChange={setCompaniesOpen}
						catalog={catalog}
						boards={boards}
						snapshot={snapshot}
						connection={seeker.connection}
						guard={guard}
					/>
				</>
			)}
		</div>
	);
}
