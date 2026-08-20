// Enregistre le hook de resolution TypeScript. Voir scripts/hooks-ts.mjs.
import { register } from "node:module";

register("./hooks-ts.mjs", import.meta.url);
