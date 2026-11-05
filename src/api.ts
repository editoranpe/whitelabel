export type Role = 'admin' | 'finance' | 'member';
export type User = {id:string;email:string;role:Role;member_id:string|null};
export type Member = {id:string;name:string;email:string;phone:string;company:string;segment:string;city:string;notes:string;status:'active'|'inactive'|'pending';monthly_fee_cents:number|null;portal_active:number;joined_at:string};
export type Charge = {id:string;member_id:string;member_name:string;company:string;period:string;due_date:string;amount_cents:number;status:'pending'|'paid'|'canceled';paid_at:string|null;payment_method:string|null;payment_reference:string|null};
export type Transaction = {id:string;kind:'income'|'expense';amount_cents:number;category:string;description:string;party:string;occurred_on:string;payment_method:string;reference:string};
export type Application = {id:string;name:string;email:string;phone:string;company:string;message:string;status:'new'|'approved'|'rejected';created_at:string};
export type PaymentReport = {id:string;charge_id:string;member_name:string;period:string;amount_cents:number;charge_status:string;reported_paid_on:string;reference:string;note:string;status:string;created_at:string};
export type Settings = Record<'group_name'|'monthly_amount_cents'|'due_day'|'pix_key'|'pix_receiver'|'pix_city'|'contact_email'|'contact_whatsapp'|'meeting_place',string> & Partial<Record<'pix_bank_name'|'pix_bank_code'|'pix_branch'|'pix_account'|'pix_account_type'|'pix_tax_id'|'pix_description'|'pix_display_bank_details'|'billing_auto_notices'|'portal_primary_color'|'portal_accent_color',string>>;
export const brl = (cents: number | null | undefined) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100);
export const humanDate = (date?:string|null) => date ? new Date(date.length===10?`${date}T12:00:00Z`:date).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : '—';
export const monthNow = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
export const todayBR = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const statusCharge = (charge:Charge,today:string) => charge.status==='paid' ? 'Pago' : charge.status==='canceled' ? 'Cancelado' : charge.due_date<today?'Em atraso':'Em aberto';

export async function api<T = any>(route:string,method:'GET'|'POST'|'PATCH'='GET',data?:unknown):Promise<T>{
  const response = await fetch(`/api/${route}`,{method,credentials:'same-origin',headers:{...(method!=='GET'?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
  let payload:any;
  try{payload=await response.json();}catch{throw new Error('Resposta inesperada do servidor. Verifique a publicação do site.');}
  if(!response.ok)throw new Error(payload?.error||`Erro ${response.status}`);
  return payload as T;
}
