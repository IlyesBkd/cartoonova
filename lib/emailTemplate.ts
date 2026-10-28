import { SITE_URL } from "./site";

/** Pure rendering only: no recipient lookup, network, tracking pixels or send. */
export function escapeEmailHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailUrl(value: string): string {
  if (/[\u0000-\u0020\u007f]/.test(value)) throw new Error("Invalid email URL");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid email URL");
  }
  // Do not normalize signed URLs: preserve the supplied bytes, only HTML-escape.
  return escapeEmailHtml(value);
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#5A5578;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeEmailHtml(text).replace(/\r\n|\r|\n/g, "<br>")}</p>`;
}

export function emailButton(label: string, url: string): string {
  const href = emailUrl(url);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-button" style="margin:22px 0 10px;max-width:100%"><tr><td bgcolor="#E9BA3B" style="border-radius:8px;border:2px solid #2A2552;text-align:center"><a href="${href}" style="display:inline-block;padding:16px 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#2A2552;text-decoration:none;line-height:23px;overflow-wrap:anywhere">${escapeEmailHtml(label)}&nbsp; &rarr;</a></td></tr></table><p style="margin:0 0 22px;font-size:11px;line-height:18px;word-break:break-all;overflow-wrap:anywhere"><a href="${href}" style="color:#5A5578;text-decoration:underline">${href}</a></p>`;
}

export function emailNotice(text: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0"><tr><td bgcolor="#F3F0FA" style="padding:18px 20px;border-left:4px solid #E9BA3B;border-radius:8px">${emailParagraph(text)}</td></tr></table>`;
}

export function emailImage(url: string, alt: string): string {
  return `<p style="margin:22px 0"><img src="${emailUrl(url)}" alt="${escapeEmailHtml(alt)}" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:10px;color:#2A2552"></p>`;
}

const footerCopy: Record<string, { label: string; help: string; signature: string }> = {
  fr: {label: "VOTRE UNIVERS CARTOONOVA", help: "Une question ? Répondez directement à cet email.", signature: "Des portraits qui vous ressemblent."},
  en: {label: "YOUR CARTOONOVA WORLD", help: "Any questions? Simply reply to this email.", signature: "Portraits that look like you."},
  es: {label: "TU MUNDO CARTOONOVA", help: "¿Alguna pregunta? Responde directamente a este email.", signature: "Retratos que se parecen a ti."},
  de: {label: "DEINE CARTOONOVA-WELT", help: "Fragen? Antworte einfach auf diese E-Mail.", signature: "Porträts, die dir ähnlich sehen."},
  it: {label: "IL TUO MONDO CARTOONOVA", help: "Hai domande? Rispondi direttamente a questa email.", signature: "Ritratti che ti somigliano."},
  nl: {label: "JOUW CARTOONOVA-WERELD", help: "Vragen? Beantwoord deze e-mail gerust.", signature: "Portretten die op jou lijken."},
  pl: {label: "TWÓJ ŚWIAT CARTOONOVA", help: "Masz pytania? Odpowiedz na tę wiadomość.", signature: "Portrety podobne do Ciebie."},
  sv: {label: "DIN CARTOONOVA-VÄRLD", help: "Har du frågor? Svara direkt på det här mejlet.", signature: "Porträtt som liknar dig."},
  da: {label: "DIN CARTOONOVA-VERDEN", help: "Spørgsmål? Svar direkte på denne e-mail.", signature: "Portrætter, der ligner dig."},
  pt: {label: "O TEU MUNDO CARTOONOVA", help: "Tens dúvidas? Responde diretamente a este email.", signature: "Retratos que se parecem contigo."},
};

/** bodyHtml/footerHtml are TRUSTED fragments, not raw user/admin text.
 * Build dynamic values with the escaped helpers above. Existing editorial HTML
 * may be supplied explicitly, with all interpolated user values escaped.
 */
export function emailLayout(options: {
  lang?: string;
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerHtml?: string;
}): string {
  const lang = Object.hasOwn(footerCopy, options.lang || "") ? options.lang! : "en";
  const copy = footerCopy[lang];
  const title = escapeEmailHtml(options.title);
  const home = `${SITE_URL}/${lang}`;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><title>${title}</title>
<style>html,body{margin:0!important;padding:0!important;width:100%!important}table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}img{border:0;outline:none;text-decoration:none}@media only screen and (max-width:620px){.email-outer{padding:16px 10px!important}.email-pad{padding-left:24px!important;padding-right:24px!important}.email-headline{font-size:30px!important;line-height:36px!important}.email-button{width:100%!important}.email-button a{display:block!important;padding-left:12px!important;padding-right:12px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#F6F0E4;color:#2A2552;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div data-email-preheader style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeEmailHtml(options.preheader || options.title)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F6F0E4"><tr><td class="email-outer" align="center" style="padding:36px 16px">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;table-layout:fixed">
<tr><td bgcolor="#2A2552" class="email-pad" style="padding:24px 36px;border-radius:18px 18px 0 0;border-top:6px solid #E9BA3B"><a href="${home}" style="text-decoration:none"><img src="${SITE_URL}/logo-detoure.png" width="152" height="77" alt="Cartoonova" style="display:block;width:152px;height:auto;border:0;color:#E9BA3B;font-size:20px;font-weight:bold"></a></td></tr>
<tr><td bgcolor="#FBEFCB" class="email-pad" style="padding:30px 36px"><p style="margin:0 0 15px;font-size:10px;font-weight:bold;letter-spacing:1.5px;color:#875E08">${copy.label}</p><h1 class="email-headline" style="margin:0;font-family:'Trebuchet MS',Arial,Helvetica,sans-serif;font-size:36px;line-height:42px;letter-spacing:-1px;color:#2A2552;overflow-wrap:anywhere;word-break:break-word">${title}</h1></td></tr>
<tr><td bgcolor="#FFFFFF" class="email-pad" style="padding:30px 36px 16px;overflow-wrap:anywhere;word-break:break-word">${options.bodyHtml}</td></tr>
<tr><td bgcolor="#FFF9ED" class="email-pad" style="padding:20px 36px;border-top:1px solid #EDE5D5;border-radius:0 0 18px 18px"><p style="margin:0;font-size:13px;line-height:21px;color:#5A5578">${copy.help}<br><a href="mailto:support@cartoonova.com" style="color:#2A2552;text-decoration:underline">support@cartoonova.com</a></p>${options.footerHtml || ""}</td></tr>
<tr><td align="center" style="padding:20px 10px 0"><p style="margin:0;font-size:11px;line-height:18px;color:#5A5578">Cartoonova · ${copy.signature}<br><a href="${home}" style="color:#5A5578;text-decoration:underline">cartoonova.com</a></p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

/** Readable multipart fallback; not a general HTML sanitizer. No network IO. */
export function emailText(html: string): string {
  const entities: Record<string, string> = {amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",rarr:"→",euro:"€",ndash:"–",mdash:"—",hellip:"…",copy:"©",rsquo:"’",lsquo:"‘",ldquo:"“",rdquo:"”"};
  return html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<div\b[^>]*\bdata-email-preheader[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<a\b[^>]*\bhref="([^\"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, label: string) => `${label} (${href})`)
    .replace(/<img\b[^>]*\balt="([^\"]*)"[^>]*>/gi, "$1")
    .replace(/<br\s*\/?>|<\/(?:p|div|h[1-6]|tr|table|li)>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match;
      const value = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isInteger(value) && value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : match;
    })
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
