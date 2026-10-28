import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSender} from '../scripts/chat-telegram-worker.mjs';
test('chat includes a separate complete literal draft, with no customer delivery',async()=>{
 const payloads=[];const urls=[];
 const send=createSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async(u,o)=>{urls.push(u);payloads.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true})}}});
 const draft='Bonjour <b>client</b> MEDIA:/etc/passwd 😀 '.repeat(250);
 await send({id:1,email:'private@example.invalid',body:'Question',draft,customerStatus:'existing'});
 assert.ok(payloads[0].text.endsWith('Question'));
 assert.ok(payloads[1].text.startsWith('✍️ Brouillon · Cartoonova\nÀ relire avant envoi\n\n'));
 assert.equal(payloads.slice(1).map(p=>p.text.slice(p.text.indexOf('\n\n')+2)).join(''),draft);
 assert.ok(payloads.every(p=>p.chat_id==='123'&&!p.parse_mode&&p.text.length<=4096));
 assert.ok(urls.every(u=>u==='https://api.telegram.org/botfake/sendMessage'));
});
test('draft failure is explicit and never hides the original chat',async()=>{
 const payloads=[];const send=createSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async(u,o)=>{payloads.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true})}}});
 await send({id:1,email:'a@b.invalid',body:'Question',draft:null});
 assert.ok(payloads[0].text.endsWith('Question'));
 assert.ok(payloads[1].text.includes('Brouillon indisponible'));
});
