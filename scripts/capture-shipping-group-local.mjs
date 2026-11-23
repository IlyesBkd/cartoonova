import {mkdirSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from 'playwright';
import {loadDeep} from '../tests/order-delivery-harness.mjs';
const out=path.resolve('ops/optimalprint-multi/evidence');mkdirSync(out,{recursive:true});
const Panel=loadDeep('app/[locale]/admin/ShippingGroupPanel.tsx').default;
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const details={supplierRef:'12345678',orderIds:ids,scope:'supplier_group_no_parcel_product_mapping',tracking:[{number:'FICTIF12345678',carrier:'Transporteur fictif',url:'https://example.invalid/colis-1'},{number:'FICTIF87654321',carrier:'Transporteur fictif',url:'https://example.invalid/colis-2'}]};
const order={id:ids[0],fournisseur_ref:'12345678',shipping_details:details,expedition_email_envoye_le:'2026-11-24T10:00:00Z'};
const cssDir='.next-ten-local/static/chunks';const css=readdirSync(cssDir).filter(n=>n.endsWith('.css')).map(n=>readFileSync(path.join(cssDir,n),'utf8')).join('\n');
const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>'+css+'</style></head><body style="background:#f8fafc;padding:16px;font-family:Arial"><h1 style="font-size:18px;margin-bottom:8px">Admin Cartoonova · aperçu local</h1><p style="font-size:12px;color:#b45309;margin-bottom:16px">FIXTURES FICTIVES · Aucun client réel · Aucun email envoyé</p>'+renderToStaticMarkup(React.createElement(Panel,{order,orders:[order],request:()=>{throw Error('No transport in capture');},onSaved:()=>{}}))+'</body></html>';
writeFileSync(out+'/admin-fictif.html',html);
const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:430,height:1000},deviceScaleFactor:1});await page.route('**/*',route=>route.abort());await page.setContent(html);await page.getByRole('heading',{name:'Expédition multi-suivis'}).waitFor();await page.screenshot({path:out+'/admin-fictif.png',fullPage:true});console.log(out+'/admin-fictif.png');}finally{await browser.close();}
