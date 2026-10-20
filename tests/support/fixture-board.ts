import { createServer, type Server } from "node:http";

interface FixtureJob {
	id: number;
	title: string;
	absolute_url: string;
	location: { name: string };
	content: string;
	first_published?: string;
}

export class FixtureBoard {
	jobs: FixtureJob[] = [];
	readonly #server: Server;

	constructor() {
		this.#server = createServer((request, response) => {
			if (!request.url?.startsWith("/greenhouse/acme-")) {
				response.writeHead(404).end();
				return;
			}
			response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jobs: this.jobs }));
		});
	}

	static job(id: number, title: string, location: string, content: string): FixtureJob {
		return { id, title, absolute_url: `https://acme.example/jobs/${id}`, location: { name: location }, content, first_published: new Date().toISOString() };
	}

	static uniqueKey(): string {
		return `greenhouse:acme-${crypto.randomUUID().slice(0, 8)}`;
	}

	listen(port: number): Promise<void> {
		return new Promise((resolve) => this.#server.listen(port, "127.0.0.1", resolve));
	}

	close(): Promise<void> {
		return new Promise((resolve) => this.#server.close(() => resolve()));
	}
}
