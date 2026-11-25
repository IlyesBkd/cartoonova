export const A='11111111-1111-4111-8111-111111111111';
export const B='22222222-2222-4222-8222-222222222222';
export const NOW='2026-11-24T10:00:00.000Z';
export const order=(id=A)=>({id,customer_name:id===A?'Tiffany fictive':'Tanguy fictif',status:'paid',photo_urls:['photo-groupe'],poster_confirmation_status:'pending'});
export const event=(overrides={})=>({id:'delivery:one',orderIds:[A],source:'order_delivery_effects',at:'2026-11-23T09:00:00Z',kind:'delivery.final_image',title:'Portrait retouché envoyé',status:'sent',body:null,subject:null,...overrides});
export const draft=(overrides={})=>({id:7,client:'Tiffany fictive',commande:A,langue:'fr',canal:'email',objet:'Photos de la commande',texte:'Merci de nous envoyer les photos.',cree_le:'2026-11-20T09:00:00Z',statut:'en_attente',...overrides});
export const empty=()=>({alerts:[],pending:[],readyPrint:[],supportUnread:0,supportMessages:[],trello:[],finance:null});
