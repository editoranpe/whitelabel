import type { D1Like } from './extensions';

export type RecurringPlan = {
  id: string; title: string; start_period: string; next_period: string;
  repetitions: number; processed: number; due_day: number; amount_cents: number | null;
  status: 'active' | 'paused' | 'completed'; channels: string;
};
type PlanMember = { id: string; monthly_fee_cents: number | null; status: string };
export const currentMonthBR = () => new Intl.DateTimeFormat('en-CA', {
  timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit'
}).format(new Date()).slice(0,7);
export function addMonths(period: string, amount: number): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) || !Number.isInteger(amount) || amount < 0 || amount > 120) {
    throw new Error('Competência mensal inválida');
  }
  const [y,m] = period.split('-').map(Number);
  const result = new Date(Date.UTC(y, m - 1 + amount, 1));
  return result.toISOString().slice(0,7);
}
export function monthlyDueDate(period: string, day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error('Dia de vencimento inválido');
  return `${period}-${String(day).padStart(2,'0')}`;
}
export function plannedMonths(start: string, repetitions: number): string[] {
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 36) throw new Error('Número de parcelas deve ser entre 1 e 36');
  return Array.from({length: repetitions}, (_, i) => addMonths(start,i));
}
/** Idempotent monthly issuance. Triggered by Cloudflare daily cron and admin action.
 * Existing unique(member_id,period) prevents duplicate invoices if a manually created
 * monthly fee or another recurrence already issued the same member/period.
 */
export async function runDuePlans(db: D1Like, todayPeriod = currentMonthBR()): Promise<{ plans: number; installments: number }> {
  const {results: plans} = await db.prepare(
    "SELECT * FROM recurring_plans WHERE status='active' AND next_period<=? ORDER BY created_at LIMIT 100"
  ).bind(todayPeriod).all<RecurringPlan>();
  const setting=await db.prepare("SELECT value FROM settings WHERE key='monthly_amount_cents'").first<{value:string}>();
  const configured=Number(setting?.value||4000);
  const monthlyDefault=Number.isSafeInteger(configured)&&configured>0?configured:4000;
  let installments = 0, processedPlans = 0;
  for (const plan of plans) {
    const {results: members} = await db.prepare(
      "SELECT m.id,m.monthly_fee_cents,m.status FROM recurring_plan_members r JOIN members m ON m.id=r.member_id WHERE r.plan_id=?"
    ).bind(plan.id).all<PlanMember>();
    let period = plan.next_period;
    let processed = plan.processed;
    while (processed < plan.repetitions && period <= todayPeriod) {
      const now = new Date().toISOString();
      const chargeQueries = members.filter(m=>m.status==='active').map(m => db.prepare(
        "INSERT OR IGNORE INTO charges(id,member_id,period,due_date,amount_cents,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?)"
      ).bind(
        crypto.randomUUID(),m.id,period,monthlyDueDate(period,plan.due_day),
        plan.amount_cents ?? m.monthly_fee_cents ?? monthlyDefault,
        `Assinatura ${plan.title} (${processed+1}/${plan.repetitions})`,now,now
      ));
      // D1 batch limits vary; split into safe groups and preserve the
      // existing unique constraint as the idempotency key.
      for (let i=0;i<chargeQueries.length;i+=50) {
        const results = await db.batch(chargeQueries.slice(i,i+50)) as Array<{meta?:{changes?:number}}>;
        installments += (results || []).reduce((sum,r)=>sum+Number(r?.meta?.changes || 0),0);
      }
      await db.prepare("INSERT OR IGNORE INTO recurring_charge_links(plan_id,charge_id,created_at) SELECT ?,c.id,? FROM charges c JOIN recurring_plan_members rpm ON rpm.member_id=c.member_id WHERE rpm.plan_id=? AND c.period=?")
        .bind(plan.id,now,plan.id,period).run();
      processed += 1;
      const next = addMonths(plan.start_period,processed);
      await db.prepare('UPDATE recurring_plans SET processed=?,next_period=?,status=?,updated_at=? WHERE id=? AND next_period=?')
        .bind(processed,next,processed>=plan.repetitions?'completed':'active',now,plan.id,period).run();
      period = next;
    }
    processedPlans++;
  }
  return {plans:processedPlans, installments};
}
