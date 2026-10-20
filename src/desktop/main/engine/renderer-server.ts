import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { EngineAddress } from "../app/config.ts";

function contentSecurityPolicy(): string {
	const port = EngineAddress.port();
	return [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self' data:",
		`connect-src 'self' http://127.0.0.1:${port} ws://127.0.0.1:${port}`,
	].join("; ");
}

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
	".woff2": "font/woff2",
};

export class RendererServer {
	readonly #root: string;
	#server: Server | null = null;

	constructor(root: string) {
		this.#root = root;
	}

	start(): Promise<string> {
		return new Promise((resolve, reject) => {
			const policy = contentSecurityPolicy();
			const server = createServer((request, response) => {
				const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)).replace(/^([/\\])+/, "");
				const candidate = join(this.#root, path);
				const file = candidate.startsWith(this.#root + sep) && existsSync(candidate) && extname(candidate) !== "" ? candidate : join(this.#root, "index.html");
				response.writeHead(200, { "content-type": MIME_TYPES[extname(file)] ?? "application/octet-stream", "content-security-policy": policy });
				response.end(readFileSync(file));
			});
			server.once("error", reject);
			server.listen(0, "127.0.0.1", () => {
				const address = server.address();
				this.#server = server;
				resolve(typeof address === "object" && address ? `http://127.0.0.1:${address.port}/` : "");
			});
		});
	}

	stop(): void {
		this.#server?.close();
	}
}
