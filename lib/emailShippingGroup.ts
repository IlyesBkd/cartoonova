import type { DbOrder } from "./db";
import type { ShippingDetails } from "./orderShippingGroup";
import { shippingEmail, langueCommande } from "./email-i18n";
import { emailLayout, emailParagraph, emailButton, emailNotice } from "./emailTemplate";

const scope: Record<string,string> = {
  fr:"Ces suivis concernent l’ensemble des commandes ci-dessous. Le fournisseur n’a pas précisé le contenu de chaque colis.",
  en:"These tracking links cover all orders below. The supplier has not specified the contents of each parcel.",
  de:"Diese Sendungsverfolgungen betreffen alle unten genannten Bestellungen. Der Lieferant hat den Inhalt der einzelnen Pakete nicht angegeben.",
  es:"Estos seguimientos corresponden a todos los pedidos indicados abajo. El proveedor no ha especificado el contenido de cada paquete.",
  it:"Questi collegamenti riguardano tutti gli ordini sotto indicati. Il fornitore non ha specificato il contenuto di ciascun pacco.",
  nl:"Deze volglinks gelden voor alle onderstaande bestellingen. De leverancier heeft de inhoud van elk pakket niet opgegeven.",
  pl:"Te linki dotyczą wszystkich poniższych zamówień. Dostawca nie określił zawartości poszczególnych paczek.",
  sv:"Dessa spårningslänkar gäller alla beställningar nedan. Leverantören har inte angett innehållet i varje paket.",
  da:"Disse sporingslinks gælder alle nedenstående ordrer. Leverandøren har ikke oplyst indholdet af hver pakke.",
  pt:"Estes links abrangem todas as encomendas abaixo. O fornecedor não especificou o conteúdo de cada volume.",
};
export function groupShippingEmail(orders: DbOrder[], details: ShippingDetails) {
  const order = orders[0], lang = langueCommande(order), t = shippingEmail[lang];
  return {subject:t.subject,html:emailLayout({lang,title:t.title,
    bodyHtml:emailParagraph(t.greeting(order.customer_name)) + emailParagraph(scope[lang])
      + emailParagraph(orders.map(o=>o.id.slice(0,8)).join(' · '))
      + emailParagraph(t.trackingIntro)
      + details.tracking.map(track=>emailParagraph([track.carrier,track.number].filter(Boolean).join(' · '))+emailButton(t.cta,track.url)).join('')
      + emailNotice(t.delay)+emailParagraph(t.help),footerHtml:emailParagraph(t.thanks)+emailParagraph(t.team)})};
}
