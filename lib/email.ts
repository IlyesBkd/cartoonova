/* Validation des adresses e-mail, commune au navigateur et au serveur.

   La caisse ne verifiait que la presence d'un « @ » : « test@exemple » passait,
   et une faute de frappe (gmail.con) faisait perdre au client sa confirmation,
   son apercu et son portrait final, sans que personne ne le sache. La meme
   expression etait recopiee dans six routes, avec deux variantes. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Longueur maximale d'une adresse (RFC 5321). */
export const EMAIL_MAX = 254;

export function emailValide(brut: unknown): boolean {
  if (typeof brut !== "string") return false;
  const email = brut.trim();
  return email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

/* Fautes de frappe frequentes sur les domaines les plus utilises par la
   clientele (France et Europe). La cle est ce qui a ete tape, la valeur le
   domaine voulu. */
const DOMAINES_CORRIGES: Record<string, string> = {
  "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com",
  "gmail.fr": "gmail.com", "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmaill.com": "gmail.com",
  "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.comm": "gmail.com", "gmai.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmai.com": "hotmail.com",
  "hotmial.fr": "hotmail.fr", "hotmal.fr": "hotmail.fr", "hotmail.fe": "hotmail.fr", "homail.fr": "hotmail.fr",
  "outlok.com": "outlook.com", "outlook.con": "outlook.com", "outllok.com": "outlook.com", "outlook.fe": "outlook.fr",
  "yahoo.con": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.fe": "yahoo.fr", "yaoo.fr": "yahoo.fr",
  "orange.fe": "orange.fr", "oragne.fr": "orange.fr", "ornage.fr": "orange.fr",
  "free.fe": "free.fr", "sfr.fe": "sfr.fr", "wanadoo.fe": "wanadoo.fr", "laposte.fe": "laposte.net",
  "icloud.con": "icloud.com", "iclod.com": "icloud.com", "icoud.com": "icloud.com",
  "live.fe": "live.fr", "live.con": "live.com",
};

/**
 * L'adresse corrigee si le domaine ressemble a une faute de frappe connue,
 * sinon null. On propose, on ne corrige jamais d'office : « gmail.fr » existe
 * pour certains, et c'est au client de trancher.
 */
export function suggestionEmail(brut: string): string | null {
  const email = brut.trim();
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domaine = email.slice(at + 1).toLowerCase();
  const corrige = DOMAINES_CORRIGES[domaine];
  return corrige ? `${email.slice(0, at)}@${corrige}` : null;
}
