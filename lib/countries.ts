export interface CountryEntry {
  code: string;
  callingCode: string;
}

// Countries this app already treats as first-class (see proxy.ts, lib/email-i18n.ts)
export const COUNTRIES: CountryEntry[] = [
  { code: "FR", callingCode: "+33" },
  { code: "BE", callingCode: "+32" },
  { code: "LU", callingCode: "+352" },
  { code: "MC", callingCode: "+377" },
  { code: "CH", callingCode: "+41" },
  { code: "DE", callingCode: "+49" },
  { code: "AT", callingCode: "+43" },
  { code: "LI", callingCode: "+423" },
  { code: "ES", callingCode: "+34" },
  { code: "IT", callingCode: "+39" },
  { code: "SM", callingCode: "+378" },
  { code: "VA", callingCode: "+379" },
  { code: "PT", callingCode: "+351" },
  { code: "NL", callingCode: "+31" },
  { code: "IE", callingCode: "+353" },
  { code: "GB", callingCode: "+44" },
  { code: "US", callingCode: "+1" },
  { code: "CA", callingCode: "+1" },
  { code: "AU", callingCode: "+61" },
  { code: "NZ", callingCode: "+64" },
  { code: "ZA", callingCode: "+27" },
  { code: "MX", callingCode: "+52" },
  { code: "AR", callingCode: "+54" },
  { code: "CO", callingCode: "+57" },
  { code: "CL", callingCode: "+56" },
  { code: "PE", callingCode: "+51" },
  { code: "VE", callingCode: "+58" },
  { code: "EC", callingCode: "+593" },
  { code: "GT", callingCode: "+502" },
  { code: "CU", callingCode: "+53" },
  { code: "BO", callingCode: "+591" },
  { code: "DO", callingCode: "+1" },
  { code: "HN", callingCode: "+504" },
  { code: "PY", callingCode: "+595" },
  { code: "SV", callingCode: "+503" },
  { code: "NI", callingCode: "+505" },
  { code: "CR", callingCode: "+506" },
  { code: "PA", callingCode: "+507" },
  { code: "UY", callingCode: "+598" },
  { code: "IN", callingCode: "+91" },
  { code: "SG", callingCode: "+65" },
  { code: "PH", callingCode: "+63" },
  { code: "NG", callingCode: "+234" },
  { code: "KE", callingCode: "+254" },
  { code: "GR", callingCode: "+30" },
  { code: "FI", callingCode: "+358" },
  { code: "SK", callingCode: "+421" },
  { code: "SI", callingCode: "+386" },
  { code: "EE", callingCode: "+372" },
  { code: "LV", callingCode: "+371" },
  { code: "LT", callingCode: "+370" },
  { code: "CY", callingCode: "+357" },
  { code: "MT", callingCode: "+356" },
  { code: "AD", callingCode: "+376" },

  /* ─── Territoires ────────────────────────────────────────────────────
     Leur absence n'affichait pas d'erreur : le selecteur retombait sur la
     PREMIERE entree de cette liste, la France, et le prefixe telephonique
     sur +33. La commande du 25 aout 2026, passee depuis Porto Rico, est donc
     enregistree en base comme francaise.

     Toute entree ajoutee ici doit avoir son nom traduit dans les dix fichiers
     de `messages/` sous `checkout.countries` — le selecteur lit la traduction,
     pas le code. */

  // France d'outre-mer : departements, collectivites, Pacifique.
  { code: "GP", callingCode: "+590" },
  { code: "MQ", callingCode: "+596" },
  { code: "GF", callingCode: "+594" },
  { code: "RE", callingCode: "+262" },
  { code: "YT", callingCode: "+262" },
  { code: "PM", callingCode: "+508" },
  { code: "BL", callingCode: "+590" },
  { code: "MF", callingCode: "+590" },
  { code: "NC", callingCode: "+687" },
  { code: "PF", callingCode: "+689" },
  { code: "WF", callingCode: "+681" },

  // Territoires americains : meme indicatif que les Etats-Unis.
  { code: "PR", callingCode: "+1" },
  { code: "VI", callingCode: "+1" },
  { code: "GU", callingCode: "+1" },
  { code: "MP", callingCode: "+1" },
  { code: "AS", callingCode: "+1" },

  // Dependances de la Couronne et Gibraltar.
  { code: "GG", callingCode: "+44" },
  { code: "JE", callingCode: "+44" },
  { code: "IM", callingCode: "+44" },
  { code: "GI", callingCode: "+350" },

  // Åland : region autonome finlandaise, indicatif propre.
  { code: "AX", callingCode: "+358" },
];

export function getCallingCode(countryCode: string | null | undefined): string {
  return COUNTRIES.find((c) => c.code === countryCode?.toUpperCase())?.callingCode || "+33";
}
