import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		dedupe: ["react", "react-dom"],
		alias: {
			"@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
			"@": fileURLToPath(new URL("./src/renderer", import.meta.url)),
		},
	},
	build: {
		outDir: "dist/renderer",
		emptyOutDir: true,
	},
	server: {
		host: "127.0.0.1",
		port: 5173,
		strictPort: true,
	},
});
