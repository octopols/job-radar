import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider.tsx";
import { App } from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Root element not found");
}

createRoot(root).render(
	<StrictMode>
		<ThemeProvider>
			<TooltipProvider delayDuration={300}>
				<App />
				<Toaster position="bottom-right" />
			</TooltipProvider>
		</ThemeProvider>
	</StrictMode>,
);
