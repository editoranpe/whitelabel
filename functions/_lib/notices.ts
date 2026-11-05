import type {D1Like} from './extensions';
import {currentMonthBR} from './recurring';

export type NoticeEnv = {
  DB: D1Like; RESEND_API_KEY?:string; RESEND_FROM?:string;
  WHATSAPP_ACCESS_TOKEN?:string; WHATSAPP_PHONE_NUMBER_ID?:string;
};
type NoticeRow = {id:string;period:string;due_date:string;amount_cents:number;name:string;email:string;phone:string|null;channels:string};
function template(row:NoticeRow,origin:string,brand:string){
 const amount=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(row.amount_cents/100);
 return {amount,text:`Olá, ${row.name}! Sua cobrança de ${brand} referente a ${row.period}, no valor de ${amount}, vence em ${row.due_date}. Consulte o QR Code Pix no portal: ${origin}/entrar`};
}
/** Explicit opt-in for automatic reminders. Does not affect invoice issuance.
 * Provider credentials are secrets on Cloudflare, never committed to Git.
 * Idempotency is preserved through notice_logs per charge/channel.
 */
export async function deliverScheduledNotices(env:NoticeEnv,origin:string):Promise<{sent:number;failed:number;skipped:number}>{
 const db=env.DB, brandRow=await db.prepare("SELECT value FROM settings WHERE key='group_name'").first<{value:string}>(), brand=brandRow?.value||'Sua organização', pref=await db.prepare("SELECT value FROM settings WHERE key='billing_auto_notices'").first<{value:string}>();
 if(pref?.value!=='true')return {sent:0,failed:0,skipped:0};
 const canEmail=!!(env.RESEND_API_KEY&&env.RESEND_FROM);
 const canWhatsApp=!!(env.WHATSAPP_ACCESS_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID);
 const eligible:string[]=[];
 if(canEmail)eligible.push("(p.channels IN ('email','both') AND m.email<>'' AND NOT EXISTS (SELECT 1 FROM notice_logs e WHERE e.charge_id=c.id AND e.channel='email' AND e.status IN ('queued','sent')))");
 if(canWhatsApp)eligible.push("(p.channels IN ('whatsapp','both') AND m.phone IS NOT NULL AND TRIM(m.phone)<>'' AND NOT EXISTS (SELECT 1 FROM notice_logs w WHERE w.charge_id=c.id AND w.channel='whatsapp' AND w.status IN ('queued','sent')))");
 if(!eligible.length)return {sent:0,failed:0,skipped:0};
 const rows=(await db.prepare(`SELECT c.id,c.period,c.due_date,c.amount_cents,m.name,m.email,m.phone,p.channels
  FROM recurring_charge_links r JOIN charges c ON c.id=r.charge_id
  JOIN recurring_plans p ON p.id=r.plan_id JOIN members m ON m.id=c.member_id
  WHERE c.status='pending' AND m.status='active' AND c.period<=?
    AND (${eligible.join(' OR ')})
  ORDER BY c.due_date,c.id LIMIT 400`).bind(currentMonthBR()).all<NoticeRow>()).results;
 let sent=0,failed=0,skipped=0;
 const checked=new Set<string>();
 for(const row of rows){
  const channels:('email'|'whatsapp')[] = row.channels==='both'?['email','whatsapp']:row.channels==='email'?['email']:row.channels==='whatsapp'?['whatsapp']:[];
  for(const channel of channels){
   const key=row.id+':'+channel;
   if(checked.has(key)){skipped++;continue}checked.add(key);
   if(channel==='email'&&(!env.RESEND_API_KEY||!env.RESEND_FROM)){skipped++;continue}
   if(channel==='whatsapp'&&(!env.WHATSAPP_ACCESS_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID||!row.phone)){skipped++;continue}
   const previous=await db.prepare("SELECT id FROM notice_logs WHERE charge_id=? AND channel=? AND status IN ('sent','queued')").bind(row.id,channel).first<{id:string}>();
   if(previous){skipped++;continue}
   const id=crypto.randomUUID();
   const lock=await db.prepare("INSERT OR IGNORE INTO notice_logs(id,charge_id,channel,status,created_at) VALUES(?,?,?,'queued',?)")
    .bind(id,row.id,channel,new Date().toISOString()).run();
   if(!Number(lock?.meta?.changes||0)){skipped++;continue}
   try{
    const msg=template(row,origin,brand);let response:Response;
    if(channel==='email'){
     response=await fetch('https://api.resend.com/emails',{method:'POST',
      headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.RESEND_FROM,to:[row.email],subject:'Cobrança '+brand,text:msg.text})});
    }else{
     const digits=String(row.phone).replace(/\D/g,'');
     const phone=digits.startsWith('55')?digits:'55'+digits;
     response=await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',
      headers:{Authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'template',
       template:{name:'mensalidade_cliente',language:{code:'pt_BR'},components:[{type:'body',parameters:[
        {type:'text',text:row.name},{type:'text',text:row.period},
        {type:'text',text:msg.amount},{type:'text',text:row.due_date}
       ]}]}})});
    }
    if(!response.ok)throw Error('Provider response '+response.status);
    await db.prepare("UPDATE notice_logs SET status='sent' WHERE id=?").bind(id).run();
    sent++;
   }catch(e){
    // Do not log banking information, tokens, phone numbers or provider payloads.
    console.warn('NPE_NOTICE_FAILED',channel,String((e as Error)?.message).slice(0,70));
    await db.prepare("DELETE FROM notice_logs WHERE id=? AND status='queued'").bind(id).run();
    failed++;
   }
  }
 }
 return {sent,failed,skipped};
}
