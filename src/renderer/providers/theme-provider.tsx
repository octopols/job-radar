import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
	preference: ThemePreference;
	resolved: "light" | "dark";
	setPreference: (preference: ThemePreference) => void;
}

const STORAGE_KEY = "job-radar-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
	const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

	useEffect(() => {
		const query = window.matchMedia(DARK_QUERY);
		const update = () => setSystemDark(query.matches);
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;

	useEffect(() => {
		document.documentElement.classList.toggle("dark", resolved === "dark");
		document.documentElement.style.colorScheme = resolved;
	}, [resolved]);

	const setPreference = (next: ThemePreference) => {
		setPreferenceState(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
		}
	};

	return <ThemeContext.Provider value={{ preference, resolved, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used inside ThemeProvider");
	}
	return context;
}

function readStoredPreference(): ThemePreference {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
	} catch {
		return "system";
	}
}
