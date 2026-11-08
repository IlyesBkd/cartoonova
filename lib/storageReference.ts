const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const grammar = new RegExp(`^vps://private/(orders|retouches|final|extras)/(${uuid})/(${uuid})\\.(jpg|jpeg|png|webp|heic|heif|pdf)$`);
/** Pure grammar only, safe in shared validation. Not proof of ownership. */
export function isVpsReference(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = grammar.exec(value);
  return !!m && (m[1] === "extras" ? m[4] === "pdf" : m[4] !== "pdf");
}
