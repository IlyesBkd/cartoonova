// Compatibility entry point: old chat_followups rows are historical only.
// Progressive updates require saved Telegram ids; never replay legacy originals.
export {openProgressive as openFollowups} from './telegram-progressive.mjs';
export const DEFAULT_STATE='/home/hermes/.hermes/profiles/cartoonova/state/chat-translation-followups/queue.sqlite';
