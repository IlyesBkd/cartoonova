import {runInference} from '../ops/support-context-v1/inference.mjs';
export async function bilingualDraft(input,{infer=runInference,signal}={}) {
 const result=await infer(input,{signal});
 return parseBilingual(result);
}
export function parseBilingual(raw) {
 const r=typeof raw==='string'?JSON.parse(raw):raw;
 if(!r||typeof r.language!=='string'||! /^[a-z]{2,3}$/.test(r.language)||typeof r.draftClient!=='string'||!r.draftClient.trim()||typeof r.draftFR!=='string'||!r.draftFR.trim()||(r.language!=='fr'&&(typeof r.messageFR!=='string'||!r.messageFR.trim())))throw Error('Incomplete bilingual inference');
 return {language:r.language,draft:r.draftClient,draftFR:r.draftFR,translation:r.language==='fr'?{status:'french'}:{status:'ready',text:r.messageFR}};
}
