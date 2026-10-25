"use client";

import { PHOTO_PRIVACY } from "@/lib/i18n/photoPrivacy";
import type { Lang } from "@/lib/email-i18n";

/** Information only: ordering/uploading never records promotional permission. */
export default function PhotoPrivacyNotice({ locale }: { locale: string }) {
  const lang = Object.hasOwn(PHOTO_PRIVACY, locale) ? locale as Lang : "fr";
  const copy = PHOTO_PRIVACY[lang];
  return (
    <p data-photo-privacy className="my-3 text-xs leading-relaxed text-black/70">
      {copy.notice}{" "}
      <a className="underline underline-offset-2" href={`/${lang}/politique-de-confidentialite`}>
        {copy.details}
      </a>
    </p>
  );
}
