// Local previews only. Never imports the send service, DB or provider SDK.
// Usage: node --import tsx scripts/preview-emails.mjs /absolute/output/directory
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {emailLayout,emailParagraph,emailButton,emailNotice,emailText} from '../lib/emailTemplate.ts';
const output=process.argv[2];
if(!output || !path.isAbsolute(output))throw new Error('Supply an absolute local output directory');
mkdirSync(output,{recursive:true,mode:0o700});
const p=emailParagraph, cta=emailButton, info=emailNotice;
// Fictional scenarios, not real orders/refunds or scheduled messages.
const scenarios=[
 {slug:'01-confirmation',title:'Votre commande est confirmée.',body:p('Bonjour Camille,')+p('Merci pour votre commande ! Retrouvez votre récapitulatif et les prochaines étapes dans votre espace.')+info('EXEMPLE FICTIF · Commande #DEMO0001\nPortrait personnalisé · Format numérique')+cta('Voir ma commande','https://example.invalid/fr/commande/demo')},
 {slug:'02-portrait',title:'Votre portrait est prêt.',body:p('Bonjour Camille,')+p('Votre illustration est disponible dans votre espace. Découvrez-la et dites-nous ce que vous en pensez.')+cta('Voir mon portrait','https://example.invalid/fr/portrait/demo')+info('Un détail à ajuster ? Répondez à cet email pour nous transmettre votre demande.')},
 {slug:'03-retouche',title:'Un détail à ajuster ?',body:p('Bonjour Camille,')+p('Nous avons bien reçu votre demande de retouche. Merci pour vos précisions : elles nous permettront de préparer la suite.')+info('EXEMPLE FICTIF · Votre demande\nAjuster la couleur du vêtement sur le portrait.')+cta('Voir ma commande','https://example.invalid/fr/commande/demo')},
 {slug:'04-expedition',title:'Votre portrait a été expédié.',body:p('Bonjour Camille,')+p('Votre portrait sur toile a été expédié. Retrouvez les informations disponibles sur le site du transporteur.')+info('EXEMPLE FICTIF · Commande #DEMO0001\nTransporteur : transporteur de démonstration')+cta('Suivre mon colis','https://example.invalid/suivi/demo')+p('Merci pour votre patience !')},
 {slug:'05-support',title:'Une réponse à votre message.',body:p('Bonjour Camille,\n\nMerci pour votre message. Nous avons bien reçu vos précisions et vous répondons ici pour garder tous les échanges au même endroit.\n\nL’équipe Cartoonova')},
 {slug:'06-remboursement',title:'Votre remboursement.',body:p('Bonjour Camille,')+p('Dans cet exemple fictif, le remboursement a été confirmé. Les informations utiles sont présentées ci-dessous, sans bouton ni action inutile.')+info('EXEMPLE FICTIF · Commande #DEMO0001\nStatut de démonstration : remboursement confirmé')+p('Pour toute question, répondez directement à cet email.')},
];
const entries=scenarios.map(s=>{
 const html=emailLayout({lang:'fr',title:s.title,preheader:s.title,bodyHtml:s.body});
 const htmlPath=path.join(output,s.slug+'.html');const textPath=path.join(output,s.slug+'.txt');
 writeFileSync(htmlPath,html,{mode:0o600});writeFileSync(textPath,emailText(html),{mode:0o600});
 return {slug:s.slug,title:s.title,html:htmlPath,text:textPath,synthetic:true};
});
writeFileSync(path.join(output,'manifest.json'),JSON.stringify({synthetic:true,sent:false,entries},null,2),{mode:0o600});
console.log(JSON.stringify({output,count:entries.length,sent:false}));
