import { createECDH, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:https";
import selfsigned from "selfsigned";

interface ReceivedPush {
	path: string;
	encoding: string | undefined;
	authorization: string | undefined;
	bytes: number;
}

export class PushEndpoint {
	readonly received: ReceivedPush[] = [];
	readonly #server: Server;
	readonly #port: number;
	#waiters: Array<() => void> = [];

	constructor(port: number) {
		this.#port = port;
		const certificate = selfsigned.generate([{ name: "commonName", value: "127.0.0.1" }], { days: 1, keySize: 2048 });
		this.#server = createServer({ key: certificate.private, cert: certificate.cert }, (request, response) => {
			const chunks: Buffer[] = [];
			request.on("data", (chunk: Buffer) => chunks.push(chunk));
			request.on("end", () => {
				this.received.push({
					path: request.url ?? "",
					encoding: request.headers["content-encoding"],
					authorization: request.headers.authorization,
					bytes: Buffer.concat(chunks).length,
				});
				response.writeHead(request.url?.startsWith("/gone/") ? 410 : 201).end();
				for (const wake of this.#waiters.splice(0)) {
					wake();
				}
			});
		});
	}

	subscription(path: string) {
		const keys = createECDH("prime256v1");
		keys.generateKeys();
		return {
			endpoint: `https://127.0.0.1:${this.#port}${path}`,
			keys: { p256dh: keys.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
		};
	}

	async waitForCount(count: number): Promise<void> {
		while (this.received.length < count) {
			await new Promise<void>((resolve) => this.#waiters.push(resolve));
		}
	}

	listen(): Promise<void> {
		return new Promise((resolve) => this.#server.listen(this.#port, "127.0.0.1", resolve));
	}

	close(): Promise<void> {
		return new Promise((resolve) => this.#server.close(() => resolve()));
	}
}
