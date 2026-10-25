"use client";
/** Cookies remain HttpOnly; a denied request only notifies the local UI. */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) window.dispatchEvent(new Event("admin-session-expired"));
  return response;
}
