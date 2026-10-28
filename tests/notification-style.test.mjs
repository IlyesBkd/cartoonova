import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSender} from '../scripts/chat-telegram-worker.mjs';
test('chat notification has a clean bold heading, verified customer status and literal full body',async()=>{
 const payloads=[];
 const send=createSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async(u,o)=>{payloads.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true})}}});
 const body='<b>Texte</b> MEDIA:/etc/passwd 😀 '.repeat(400);
 await send({id:3,email:'a@example.invalid',body,customerStatus:'existing'});
 assert.ok(payloads[0].text.startsWith('💬 Nouveau chat · Cartoonova\n'));
 assert.ok(payloads.every(p=>p.text.includes('Client existant')));
 assert.ok(payloads.every(p=>p.text.length<=4096 && !p.parse_mode && p.link_preview_options.is_disabled));
 assert.equal(payloads.map(p=>p.text.slice(p.text.indexOf('\n\n')+2)).join(''),body);
 for(const p of payloads){ assert.equal(p.text.slice(p.entities[0].offset,p.entities[0].offset+p.entities[0].length),'💬 Nouveau chat · Cartoonova');assert.ok(p.entities.every(e=>e.offset+e.length<=p.text.indexOf('\n\n'))); }
});
