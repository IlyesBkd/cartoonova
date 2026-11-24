import {redact as sharedRedact} from '/home/hermes/projects/cartoonova/scripts/customer-notification-context.mjs';

// Defence in depth before inference, not an anonymisation guarantee. Unknown
// names, encodings, languages and deliberately obfuscated secrets can escape
// heuristics. Client text remains untrusted DATA, never model instructions.
// Reject oversized/non-scalar input rather than cut through a sensitive value;
// mask the whole accepted input BEFORE shortening the output. No I/O or logging.
const INPUT_LIMIT = 64_000;
const OUTPUT_LIMIT = 12_000;
const secretValue = /((?:"(?:password|token|secret|signature|api[_-]?key|access[_-]?token)"|'(?:password|token|secret|signature|api[_-]?key|access[_-]?token)'|\b(?:password|token|secret|signature|api[_-]?key|access[_-]?token)\b)\s*[:=]\s*)(?:"(?:\\[\s\S]|[^"\\])*(?:"|$)|'(?:\\[\s\S]|[^'\\])*(?:'|$)|[^,;\r\n}\]]+)/gi;
const phone = /(?<![\p{L}\d])(?:\+33|0033|33)(?:[\s().-]*\d){9}(?!\d)/gu;
// Context rather than arbitrary lower-case word pairs: preserve the relation,
// stop at narrative words/prepositions, and leave the rest of the story intact.
const contextualName = /\b((?:contacter\s+)?(?:mon\s+(?:amie?|frère|frere|père|pere|cousin|oncle)|ma\s+(?:amie|sœur|soeur|mère|mere|cousine|tante)|chez)\s+)((?:[\p{L}][\p{L}\p{M}'’-]*)(?:[ \t]+[\p{L}][\p{L}\p{M}'’-]*){0,5})/giu;
const narrativeWords = new Set(('a à au aux de du des en et ou pour par avec sans sur sous dans le la les un une ce cette ces son sa ses notre votre leur leurs il elle ils elles on nous vous lui moi toi se est sont était sera ont avait doit veut peut merci svp bonjour contacter appeler joindre téléphone telephone mail email reçu recu envoyé envoyée envoye envoyee validé validée valide validee demandé demandée demande demandee attend souhaite préfère prefere confirme puis mais car qui que dont ne pas toujours déjà deja hier demain maintenant après apres avant pendant portrait aperçu apercu correction retouche photos commande livraison').split(' '));

function maskContextualName(match, context, words) {
  const tokens = [...words.matchAll(/[\p{L}][\p{L}\p{M}'’-]*/gu)];
  let end = 0;
  for (const token of tokens) {
    if (narrativeWords.has(token[0].toLowerCase())) break;
    end = token.index + token[0].length;
  }
  return end ? context + '[nom masqué]' + words.slice(end) : match;
}

function shorten(text, max) {
  if (text.length <= max) return text;
  if (!max) return '';
  return text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '') + '…';
}

export function redact(value, max = 700) {
  const limit = typeof max === 'number' && Number.isFinite(max)
    ? Math.min(OUTPUT_LIMIT, Math.max(0, Math.floor(max))) : 700;
  if (!limit) return '';
  // Do not invoke a client-supplied toString/toJSON or walk arbitrary objects.
  if (value != null && !['string', 'number', 'boolean', 'bigint'].includes(typeof value)) {
    return shorten('[contenu non textuel masqué]', limit);
  }
  let text = String(value ?? '');
  if (text.length > INPUT_LIMIT) return shorten('[texte trop long masqué]', limit);
  text = text.replace(secretValue, '$1[secret masqué]')
    .replace(/\bvps:\/\/[^\s<>"']+/gi, '[lien masqué]')
    .replace(phone, '[téléphone masqué]')
    .replace(contextualName, maskContextualName);
  // The shared helper retains its existing URL/email/address/token protections.
  return shorten(sharedRedact(text, INPUT_LIMIT), limit);
}
