/** UTF-16 code units: identical to textarea.maxLength and JS string.length.
 * 2000 preserves the existing acknowledgement's capacity, now an explicit bound.
 * No slicing: input beyond this bound is rejected, never silently altered.
 */
export const MAX_RETOUCHE_NOTE = 2000;
export function validRetoucheNote(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= MAX_RETOUCHE_NOTE);
}
