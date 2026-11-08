/** Client-safe presentation only: keep the canonical reference in order state. */
export function isPrivateStorageReference(ref: string): boolean {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const match = new RegExp(`^vps://private/(orders|retouches|final|extras)/${uuid}/${uuid}\\.(jpg|jpeg|png|webp|heic|heif|pdf)$`).exec(ref);
  return !!match && (match[1] === "extras" ? match[2] === "pdf" : match[2] !== "pdf");
}

export function storageDisplayUrl(
  ref: string,
  capability: { token?: string; posterToken?: string } = {},
): string {
  // Even a malformed private reference must never reach an img/href verbatim.
  // The read route performs canonical validation and authorization.
  if (!ref.startsWith("vps://")) return ref;
  const query = new URLSearchParams({ ref });
  if (capability.token) query.set("token", capability.token);
  if (capability.posterToken) query.set("posterToken", capability.posterToken);
  return `/api/storage/read?${query}`;
}
