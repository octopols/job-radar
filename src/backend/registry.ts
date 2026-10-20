import { setup } from "rivetkit";
import { RESUME_MAX_BYTES } from "../shared/constants.ts";
import { board } from "./actors/board/index.ts";
import { directory } from "./actors/directory/index.ts";
import { seeker } from "./actors/seeker/index.ts";

const MESSAGE_ENVELOPE_BYTES = 64 * 1024;

export const registry = setup({
	use: { board, seeker, directory },
	maxIncomingMessageSize: RESUME_MAX_BYTES + MESSAGE_ENVELOPE_BYTES,
});

export type Registry = typeof registry;
