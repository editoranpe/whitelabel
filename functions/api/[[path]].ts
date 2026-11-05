import { buildPixCode } from '../_lib/pix';
import { INITIAL_SCHEMA_STATEMENTS } from '../_lib/schema';
import { ensureExtensionSchema } from '../_lib/extensions';
import { runDuePlans, plannedMonths } from '../_lib/recurring';
import { validatePage } from '../_lib/siteBuilder';
import { readImageUpload, inspectWebp, mediaUrl } from '../_lib/media';
import { NOW, uuid, sha256, randomToken, passwordHash, verifyPassword, readSessionCookie, sessionCookie, expireCookie } from '../_lib/auth';

type Role = 'admin' | 'finance' | 'member';
type Query = { bind: (...values: unknown[]) => Query; first: <T = any>() => Promise<T | null>; all: <T = any>() => Promise<{results: T[]}>; run: () => Promise<{meta: {changes?: number}}> };
type DB = { prepare: (sql: string) => Query; batch: (queries: Query[]) => Promise<unknown> };
type Env = { DB: DB; SETUP_TOKEN?: string; RESEND_API_KEY?: string; RESEND_FROM?: string; WHATSAPP_ACCESS_TOKEN?: string; WHATSAPP_PHONE_NUMBER_ID?: string };
type Context = { request: Request; env: Env };
type User = { id: string; email: string; role: Role; member_id: string | null };

type AppError = Error & { status?: number };
function fail(message: string, status = 400): never {
  const error = new Error(message) as AppError;
  error.status = status;
  throw error;
}
function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
async function body(request: Request, limit = 30_000): Promise<Record<string, any>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) fail('Envie os dados em JSON', 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > limit) fail('Requisição muito grande', 413);
  try {
    const value = await request.json();
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('bad');
    if (JSON.stringify(value).length > limit) fail('Requisição muito grande', 413);
    return value;
  } catch (error) {
    if ((error as AppError).status) throw error;
    fail('JSON inválido');
  }
}
function str(value: unknown, max = 250): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function required(value: unknown, title: string, max = 250): string {
  const item = str(value, max);
  if (!item) fail(`Informe ${title}`);
  return item;
}
function email(value: unknown): string {
  const e = required(value, 'o e-mail', 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('E-mail inválido');
  return e;
}
function cents(value: unknown, positive = true): number {
  if (!Number.isSafeInteger(value) || (positive ? Number(value) <= 0 : Number(value) < 0) || Number(value) > 50_000_000) fail('Valor monetário inválido');
  return Number(value);
}
function validPeriod(v: unknown): string {
  const p = str(v, 7);
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(p)) fail('Competência inválida (AAAA-MM)');
  return p;
}
function validDate(v: unknown): string {
  const d = str(v, 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(d) || Number.isNaN(Date.parse(`${d}T12:00:00Z`)) || new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) !== d) fail('Data inválida');
  return d;
}
function currentDateBR(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return /^\d{4}-\d\d-\d\d$/.test(p) ? p : new Date().toISOString().slice(0, 10);
}
function routeSegments(request: Request): string[] {
  return new URL(request.url).pathname.replace(/\/+$/, '').split('/').filter(Boolean).slice(1);
}
function requireOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) fail('Origem não permitida', 403);
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') fail('Origem não permitida', 403);
}
async function account(context: Context, requiredRoles?: Role[]): Promise<User> {
  const token = readSessionCookie(context.request);
  if (!token) fail('Entre na sua conta para continuar', 401);
  const tokenHash = await sha256(token);
  const user = await context.env.DB.prepare(
    'SELECT u.id,u.email,u.role,u.member_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(tokenHash, NOW()).first<User>();
  if (!user) fail('Sessão expirada. Faça login novamente.', 401);
  if (requiredRoles && !requiredRoles.includes(user.role)) fail('Você não tem permissão para esta ação', 403);
  return user;
}
async function audit(db: DB, user: User | null, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  await db.prepare('INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(uuid(), user?.id ?? null, action, entity, entityId, JSON.stringify(details), NOW()).run();
}
const defaults: Record<string, string> = {
  group_name: 'Sua Organização',
  monthly_amount_cents: '4000',
  due_day: '10',
  pix_key: '',
  pix_receiver: '',
  pix_city: '',
  contact_email: '',
  contact_whatsapp: '',
  meeting_place: '',
  pix_bank_name: '', pix_bank_code: '', pix_branch: '', pix_account: '', pix_account_type: 'corrente', pix_tax_id: '', pix_description: 'Cobrança da organização',
  pix_display_bank_details: 'false', billing_auto_notices: 'false',
  portal_primary_color: '#393c86', portal_accent_color: '#f00483',
};
async function getSettings(db: DB): Promise<Record<string, string>> {
  const rows = (await db.prepare('SELECT key,value FROM settings').all<{key: string; value: string}>()).results;
  const values = { ...defaults };
  for (const row of rows) if (row.key in values) values[row.key] = row.value;
  return values;
}
async function setupRequired(db: DB): Promise<boolean> {
  const result = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role='admin'").first<{total: number}>();
  return !result?.total;
}
function csv(rows: any[], columns: [string,string][]): Response {
  const safe = (value: unknown) => {
    let cell = String(value ?? '');
    if (/^[\s]*[=+@\-]/.test(cell)) cell = "'" + cell;
    return `"${cell.replace(/"/g, '""')}"`;
  };
  const content = [columns.map(c => safe(c[1])).join(';'), ...rows.map(row => columns.map(([field]) => safe(row[field])).join(';'))].join('\r\n');
  return new Response('\ufeff' + content, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="relatorio-organizacao.csv"' } });
}

// Bootstrap only a completely empty D1. Never auto-modify a database with app tables.
async function initializeEmptyDatabase(db: DB): Promise<void> {
  const found = await db.prepare(
    "SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name IN ('users','members','sessions','login_attempts','invitations','settings','applications','charges','payment_reports','transactions','audit_logs')"
  ).first<{ total: number }>();
  if (Number(found?.total || 0) === 0) {
    // D1.exec splits SQL on newlines, which breaks multi-line CREATE TABLE statements.
    // D1.batch executes prepared statements transactionally instead.
    await db.batch(INITIAL_SCHEMA_STATEMENTS.map(statement => db.prepare(statement)));
  }
}

async function handle(context: Context): Promise<Response> {
  const { request, env } = context;
  const db = env.DB;
  if (!db?.prepare) return json({ error: 'Banco D1 não conectado. Configure o binding DB no Cloudflare Workers.' }, 503);
  const path = routeSegments(request), method = request.method.toUpperCase();
  if (!['GET','POST','PATCH'].includes(method)) fail('Método não permitido', 405);
  if (method !== 'GET') requireOrigin(request);
  const is = (verb: string, ...parts: string[]) => method === verb && JSON.stringify(path) === JSON.stringify(parts);

  await initializeEmptyDatabase(db);
  await ensureExtensionSchema(db);

  if (is('GET', 'health')) return json({ ok: true, service: 'Plataforma NPE White Label', date: NOW() });
  if (is('GET', 'public')) {
    const s = await getSettings(db);
    return json({ group_name: s.group_name, monthly_amount_cents: Number(s.monthly_amount_cents), due_day: Number(s.due_day), meeting_place: s.meeting_place, contact_email: s.contact_email, contact_whatsapp: s.contact_whatsapp, pix_available: !!(s.pix_key && s.pix_receiver) });
  }
  if(is('GET','media','status')) {
    const mediaTable=await db.prepare("SELECT COUNT(*) AS found FROM sqlite_master WHERE type='table' AND name='site_media_assets'").first<{found:number}>();
    return json({ready:Number(mediaTable?.found||0)===1,storage:'cloudflare-d1',format:'image/webp',max_bytes:921600});
  }
  // Site media files are read-only for visitors; uploads require an admin session.
  // Images are immutable, cached on the edge and served without exposing D1 internals.
  if(method==='GET' && path[0]==='media' && path.length===2 && path[1].endsWith('.webp')){
    const match=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/.exec(path[1]);
    if(!match)fail('Imagem não encontrada',404);
    const row=await db.prepare('SELECT data, mime_type FROM site_media_assets WHERE id=?').bind(match[1]).first<{data:number[];mime_type:string}>();
    if(!row)fail('Imagem não encontrada',404);
    const bytes=Uint8Array.from(row.data);
    return new Response(bytes.buffer as ArrayBuffer,{headers:{
      'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable',
      'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'
    }});
  }
  if (is('GET', 'public-page')) {
    const row = await db.prepare("SELECT published_json,published_version FROM site_pages WHERE slug='home'").first<{published_json:string|null;published_version:number}>();
    return json({ page: row?.published_json ? JSON.parse(row.published_json) : null, version: row?.published_version||0 });
  }
  if (is('GET', 'setup-status')) return json({ setup_required: await setupRequired(db) });
  if (is('POST', 'setup')) {
    if (!(await setupRequired(db))) fail('A conta administrativa já foi criada', 409);
    if (!env.SETUP_TOKEN || env.SETUP_TOKEN.length < 24) fail('Configure o segredo SETUP_TOKEN no Cloudflare antes de continuar', 503);
    const data = await body(request);
    const setupHash = await sha256(str(data.setup_token, 512));
    if (setupHash !== await sha256(env.SETUP_TOKEN)) fail('Código de configuração inválido', 403);
    const loginEmail = email(data.email);
    const name = required(data.name, 'o nome do administrador', 120);
    const newPassword = str(data.password, 128);
    if (newPassword.length < 12) fail('A senha deve conter pelo menos 12 caracteres.', 400);
    let hashed: { salt: string; hash: string };
    try {
      hashed = await passwordHash(newPassword);
    } catch (error) {
      console.error('NPE_SETUP_CRYPTO', error);
      fail('Falha ao proteger a senha. Informe à equipe o código NPE_SETUP_CRYPTO.', 500);
    }
    const userId = uuid(), memberId = uuid(), now = NOW();
    // A restrição UNIQUE do banco impede duas inicializações simultâneas com o mesmo e-mail.
    try {
      await db.batch([
        db.prepare('INSERT INTO members(id,name,email,company,status,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(memberId, name, loginEmail, 'Administração da organização', 'active', currentDateBR(), now, now),
        db.prepare('INSERT INTO users(id,email,password_salt,password_hash,role,member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(userId, loginEmail, hashed.salt, hashed.hash, 'admin', memberId, now, now),
        db.prepare('INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)')
          .bind(uuid(), userId, 'initial_setup', 'user', userId, '{}', now),
      ]);
    } catch (error) {
      const message = String((error as Error)?.message ?? '');
      console.error('NPE_SETUP_D1', error);
      if (/UNIQUE constraint failed/i.test(message)) fail('O administrador já existe. Atualize a página e tente entrar.', 409);
      if (/FOREIGN KEY constraint failed/i.test(message)) fail('Inconsistência no banco de dados. Informe o código NPE_SETUP_D1_FK.', 500);
      fail('Não foi possível gravar o administrador no D1. Informe o código NPE_SETUP_D1.', 500);
    }
    return json({ success: true, message: 'Administração criada. Faça login.' }, 201);
  }
  if (is('POST', 'login')) {
    const data = await body(request), loginEmail = email(data.email), password = str(data.password, 128);
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = await sha256(`${loginEmail}|${clientIp}`);
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    const attempts = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key_hash=? AND attempted_at>?').bind(key, cutoff).first<{n: number}>();
    if ((attempts?.n || 0) >= 6) fail('Muitas tentativas. Tente novamente em 15 minutos.', 429);
    const user = await db.prepare('SELECT id,email,role,member_id,password_salt,password_hash FROM users WHERE email=?').bind(loginEmail).first<User & {password_salt:string; password_hash:string}>();
    let valid = false;
    if (user && password) {
      try { valid = await verifyPassword(password, user.password_salt, user.password_hash); } catch { valid = false; }
    }
    if (!valid || !user) {
      await db.prepare('INSERT INTO login_attempts(key_hash,attempted_at) VALUES(?,?)').bind(key, NOW()).run();
      fail('E-mail ou senha incorretos', 401);
    }
    await db.prepare('DELETE FROM login_attempts WHERE key_hash=?').bind(key).run();
    const token = randomToken(), expiry = new Date(Date.now() + 12 * 3600_000).toISOString();
    await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await sha256(token), user.id, expiry, NOW()).run();
    return json({ user: { id: user.id, email: user.email, role: user.role, member_id: user.member_id } }, 200, { 'Set-Cookie': sessionCookie(token) });
  }
  if (is('POST', 'logout')) {
    const token = readSessionCookie(request);
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
    return json({ success: true }, 200, { 'Set-Cookie': expireCookie() });
  }
  if (is('GET', 'me')) {
    const user = await account(context);
    const member = user.member_id ? await db.prepare('SELECT id,name,email,company,status FROM members WHERE id=?').bind(user.member_id).first() : null;
    return json({ user, member });
  }
  if (is('POST', 'apply')) {
    const data = await body(request);
    if (data.website) return json({ success: true }, 201); // honeypot
    if (data.consent !== true) fail('É necessário aceitar a política de privacidade');
    const e = email(data.email), name = required(data.name, 'o nome', 120), phone = required(data.phone, 'o telefone', 40), company = required(data.company, 'a empresa', 120);
    const cutoff = new Date(Date.now() - 24*3600_000).toISOString();
    const repeated = await db.prepare('SELECT COUNT(*) AS n FROM applications WHERE email=? AND created_at>?').bind(e, cutoff).first<{n: number}>();
    if ((repeated?.n || 0) >= 2) fail('Já recebemos sua solicitação. Aguarde nosso contato.', 429);
    const id = uuid(), now = NOW();
    await db.prepare('INSERT INTO applications(id,name,email,phone,company,message,consented_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,name,e,phone,company,str(data.message,1000),now,now).run();
    return json({ success: true, message: 'Solicitação recebida. Nossa equipe entrará em contato.' }, 201);
  }
  if (is('POST', 'activate')) {
    const data = await body(request), invitationToken = required(data.token, 'o convite', 128);
    const invitation = await db.prepare('SELECT i.id,i.member_id,i.expires_at,i.used_at,m.email FROM invitations i JOIN members m ON m.id=i.member_id WHERE i.token_hash=?').bind(await sha256(invitationToken)).first<{id:string;member_id:string;expires_at:string;used_at:string|null;email:string}>();
    if (!invitation || invitation.used_at || invitation.expires_at < NOW()) fail('Este convite expirou ou já foi utilizado', 410);
    const hashed = await passwordHash(str(data.password,128));
    const existing = await db.prepare('SELECT id FROM users WHERE member_id=? OR email=?').bind(invitation.member_id, invitation.email).first<{id: string}>();
    const now = NOW();
    if (existing) {
      await db.prepare("UPDATE users SET password_salt=?,password_hash=?,updated_at=? WHERE id=? AND role='member'").bind(hashed.salt,hashed.hash,now,existing.id).run();
      const current = await db.prepare('SELECT role FROM users WHERE id=?').bind(existing.id).first<{role:Role}>();
      if (current?.role !== 'member') fail('Convite inválido para esta conta', 403);
      await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(existing.id).run();
    } else {
      await db.prepare('INSERT INTO users(id,email,password_salt,password_hash,role,member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(uuid(),invitation.email,hashed.salt,hashed.hash,'member',invitation.member_id,now,now).run();
    }
    await db.prepare('UPDATE invitations SET used_at=? WHERE id=? AND used_at IS NULL').bind(now,invitation.id).run();
    return json({ success: true, message: 'Conta ativada. Faça login.' });
  }

  // Rotas autenticadas a partir deste ponto.
  const user = await account(context);
  const isManager = user.role === 'admin' || user.role === 'finance';

  // Upload only WebP, restricted to the authenticated principal administrator.
  // A built-in image library avoids depending on third-party image URLs.
  if (is('POST','media','upload')) {
    if(user.role!=='admin')fail('Somente o administrador principal pode enviar imagens',403);
    const count=await db.prepare('SELECT COUNT(*) AS total FROM site_media_assets').first<{total:number}>();
    if((count?.total||0)>=400)fail('Biblioteca atingiu 400 imagens. Solicite migração para R2 antes de novos uploads.',409);
    let image:Uint8Array,dimensions:{width:number;height:number};
    try{image=await readImageUpload(request);dimensions=inspectWebp(image)}
    catch(error){
      const message=String((error as Error)?.message||'Arquivo inválido');
      fail(message,/900 KB/.test(message)?413:400);
    }
    const rawFilename=request.headers.get('X-CIB-Filename')||'imagem.webp';
    let filename='imagem.webp';
    try{filename=decodeURIComponent(rawFilename).replace(/[^\p{L}\p{N}._ -]/gu,'').slice(0,120)||'imagem.webp';}
    catch{filename='imagem.webp'}
    const id=uuid(),now=NOW();
    await db.prepare('INSERT INTO site_media_assets(id,filename,mime_type,width,height,size_bytes,data,created_at,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id,filename,'image/webp',dimensions.width,dimensions.height,image.byteLength,image,now,user.id).run();
    await audit(db,user,'upload_site_media','site_media',id,{size:image.byteLength,width:dimensions.width,height:dimensions.height});
    return json({id,url:mediaUrl(id),mime:'image/webp',width:dimensions.width,height:dimensions.height,bytes:image.byteLength,filename},201);
  }
  if (is('GET','media','library')) {
    if(user.role!=='admin')fail('Biblioteca restrita ao administrador',403);
    const rows=(await db.prepare('SELECT id,filename,width,height,size_bytes,created_at FROM site_media_assets ORDER BY created_at DESC LIMIT 100').all<{id:string;filename:string;width:number;height:number;size_bytes:number;created_at:string}>()).results;
    return json({images:rows.map(x=>({id:x.id,url:mediaUrl(x.id),name:x.filename,width:x.width,height:x.height,bytes:x.size_bytes,created_at:x.created_at}))});
  }

  // Editor visual: apenas o administrador tem autorização para rascunhar e publicar.
  if (is('POST','pix','test')) {
    if(user.role!=='admin')fail('Acesso restrito ao administrador',403);
    const data=await body(request),settings=await getSettings(db);
    if(!settings.pix_key||!settings.pix_receiver||!settings.pix_city)fail('Cadastre e salve a chave Pix, titular e cidade antes do teste',409);
    const amount=data.amount_cents===undefined?100:cents(data.amount_cents);
    const code=buildPixCode({key:settings.pix_key,receiver:settings.pix_receiver,city:settings.pix_city,amountCents:amount,txid:'TESTE'});
    return json({code,receiver:settings.pix_receiver,amount_cents:amount,note:'QR Code de verificação. Não identifica pagamento nem cria cobrança.'});
  }
  if (is('GET','builder','page')) {
    if (user.role!=='admin') fail('Editor restrito ao administrador principal',403);
    const row = await db.prepare("SELECT * FROM site_pages WHERE slug='home'").first<any>();
    return json({draft:row?.draft_json?JSON.parse(row.draft_json):null,published:row?.published_json?JSON.parse(row.published_json):null,version:row?.published_version||0});
  }
  if (is('PATCH','builder','page')) {
    if (user.role!=='admin') fail('Editor restrito ao administrador principal',403);
    const input=(await body(request,150_000)).page;
    if (!validatePage(input)) fail('O layout contém campos inválidos ou excede o limite permitido',400);
    await db.prepare("INSERT INTO site_pages(slug,draft_json,updated_at) VALUES('home',?,?) ON CONFLICT(slug) DO UPDATE SET draft_json=excluded.draft_json,updated_at=excluded.updated_at")
      .bind(JSON.stringify(input),NOW()).run();
    await audit(db,user,'save_page_draft','page','home');
    return json({saved:true});
  }
  if (is('POST','builder','publish')) {
    if (user.role!=='admin') fail('Publicação restrita ao administrador principal',403);
    const row=await db.prepare("SELECT draft_json,published_version FROM site_pages WHERE slug='home'").first<{draft_json:string|null;published_version:number}>();
    if (!row?.draft_json || !validatePage(JSON.parse(row.draft_json))) fail('Salve um rascunho válido antes de publicar',409);
    const version=(row.published_version||0)+1,now=NOW();
    await db.batch([
      db.prepare("UPDATE site_pages SET published_json=draft_json,published_version=?,published_at=?,updated_at=? WHERE slug='home'").bind(version,now,now),
      db.prepare("INSERT INTO site_page_versions(id,slug,version,document_json,published_at,published_by) VALUES(?,'home',?,?,?,?)")
        .bind(uuid(),version,row.draft_json,now,user.id),
    ]);
    await audit(db,user,'publish_page','page','home',{version});
    return json({published:true,version});
  }
  if (is('GET','builder','history')) {
    if (user.role!=='admin') fail('Acesso restrito à administração',403);
    return json({versions:(await db.prepare("SELECT id,version,published_at FROM site_page_versions WHERE slug='home' ORDER BY version DESC LIMIT 30").all()).results});
  }
  if (is('POST','builder','restore')) {
    if (user.role!=='admin') fail('Acesso restrito à administração',403);
    const input=await body(request);
    if (!Number.isInteger(input.version)) fail('Versão inválida');
    const row=await db.prepare("SELECT document_json FROM site_page_versions WHERE slug='home' AND version=?").bind(input.version).first<{document_json:string}>();
    if(!row)fail('Versão não encontrada',404);
    await db.prepare("UPDATE site_pages SET draft_json=?,updated_at=? WHERE slug='home'").bind(row.document_json,NOW()).run();
    await audit(db,user,'restore_page_draft','page','home',{version:input.version});
    return json({restored:true});
  }

  // Assinaturas: uma cobrança mensal, emitida por Cron, até completar as parcelas.
  if (is('GET','recurrences')) {
    if(!isManager)fail('Acesso restrito à tesouraria',403);
    const plans=(await db.prepare("SELECT p.*,COUNT(r.member_id) AS member_count FROM recurring_plans p LEFT JOIN recurring_plan_members r ON r.plan_id=p.id GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100").all()).results;
    return json({plans});
  }
  if (is('POST','recurrences')) {
    if(user.role!=='admin')fail('Somente o administrador pode criar assinaturas',403);
    const input=await body(request,90_000);
    const title=required(input.title,'o nome da assinatura',100),start=validPeriod(input.start_period);
    const repetitions=Number(input.repetitions),dueDay=Number(input.due_day);
    if(!Number.isInteger(repetitions)||repetitions<1||repetitions>36)fail('Informe entre 1 e 36 parcelas');
    if(!Number.isInteger(dueDay)||dueDay<1||dueDay>28)fail('Dia de vencimento entre 1 e 28');
    const members=Array.isArray(input.member_ids)?[...new Set(input.member_ids.filter((x:unknown):x is string=>typeof x==='string' && x.length<100))]:[];
    if(members.length<1||members.length>500)fail('Selecione entre 1 e 500 cadastros');
    const active=(await db.prepare("SELECT id FROM members WHERE status='active'").all<{id:string}>()).results;
    const approved=new Set(active.map(x=>x.id));
    if(members.some(x=>!approved.has(x)))fail('Há usuários inativos ou não encontrados na seleção');
    const amount=input.amount_cents==null||input.amount_cents===''?null:cents(input.amount_cents);
    const channels=['portal','email','whatsapp','both'].includes(input.channels)?input.channels:'portal';
    const id=uuid(),now=NOW();
    await db.prepare("INSERT INTO recurring_plans(id,title,start_period,next_period,repetitions,due_day,amount_cents,channels,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,title,start,start,repetitions,dueDay,amount,channels,user.id,now,now).run();
    for(let i=0;i<members.length;i+=50)await db.batch(members.slice(i,i+50).map(member_id=>db.prepare("INSERT INTO recurring_plan_members(plan_id,member_id) VALUES(?,?)").bind(id,member_id)));
    const issued=await runDuePlans(db);
    await audit(db,user,'create_recurrence','recurring_plan',id,{repetitions,member_count:members.length,channels});
    return json({id,repetitions,members:members.length,periods:plannedMonths(start,repetitions),issued},201);
  }
  if (is('POST','recurrences','run')) {
    if(user.role!=='admin')fail('Acesso restrito à administração',403);
    const result=await runDuePlans(db);
    await audit(db,user,'run_recurrences','recurring_plan','all',result);
    return json(result);
  }
  if (method==='PATCH'&&path[0]==='recurrences'&&path.length===2) {
    if(user.role!=='admin')fail('Acesso restrito à administração',403);
    const input=await body(request),change:Record<string,unknown>={};
    if('status' in input){
      if(!['active','paused','completed'].includes(input.status))fail('Situação inválida');
      change.status=input.status;
    }
    if('due_day' in input){
      if(!Number.isInteger(input.due_day)||input.due_day<1||input.due_day>28)fail('Dia de vencimento inválido');
      change.due_day=input.due_day;
    }
    if(!Object.keys(change).length)fail('Nenhuma alteração informada');
    for(const [key,value] of Object.entries(change))await db.prepare(`UPDATE recurring_plans SET ${key}=?,updated_at=? WHERE id=?`).bind(value,NOW(),path[1]).run();
    await audit(db,user,'update_recurrence','recurring_plan',path[1],{fields:Object.keys(change)});
    return json({success:true});
  }
  if (method==='PATCH'&&path[0]==='charges'&&path.length===2) {
    if(user.role!=='admin')fail('Acesso restrito à administração',403);
    const input=await body(request),due=validDate(input.due_date);
    const result=await db.prepare("UPDATE charges SET due_date=?,updated_at=? WHERE id=? AND status='pending'").bind(due,NOW(),path[1]).run();
    if(!result.meta?.changes)fail('Cobrança não encontrada ou já quitada',409);
    await audit(db,user,'reschedule_charge','charge',path[1],{due_date:due});
    return json({success:true});
  }

  // Importação de mensalidades históricas: não altera cobranças existentes.
  if (is('POST','imports','charges')) {
    if(user.role!=='admin')fail('Acesso restrito à administração',403);
    const input=await body(request,150_000);
    if(!Array.isArray(input.rows)||input.rows.length<1||input.rows.length>100)fail('Envie de 1 a 100 mensalidades por lote');
    let created=0,skipped=0;
    for(const row of input.rows){
      if(!row||typeof row!=='object')fail('Linha inválida');
      const e=email(row.member_email),member=await db.prepare('SELECT id FROM members WHERE email=?').bind(e).first<{id:string}>();
      if(!member)fail(`Associe primeiro o e-mail ${e} antes de importar suas mensalidades`,409);
      const period=validPeriod(row.period),due=validDate(row.due_date),amount=cents(row.amount_cents);
      const status=['pending','paid','canceled'].includes(row.status)?row.status:'pending';
      if(status==='paid'&&input.confirm_historical_paid!==true)fail('Confirme expressamente a importação de mensalidades históricas já pagas',403);
      const now=NOW(),paidAt=status==='paid'?validDate(row.paid_on||due)+'T12:00:00Z':null;
      const result=await db.prepare('INSERT OR IGNORE INTO charges(id,member_id,period,due_date,amount_cents,status,paid_at,paid_by,payment_method,payment_reference,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(uuid(),member.id,period,due,amount,status,paidAt,status==='paid'?user.id:null,status==='paid'?'imported':null,str(row.reference,160),'Importado de planilha histórica, conferir documentos de origem',now,now).run();
      if(result.meta?.changes)created++;else skipped++;
    }
    await audit(db,user,'import_historical_charges','charges','batch',{created,skipped});
    return json({created,skipped});
  }
  // Importação de receitas extras e despesas (separadas das mensalidades).
  if (is('POST','imports','transactions')) {
    if(user.role!=='admin')fail('Acesso restrito à administração',403);
    const input=await body(request,150_000);
    if(!Array.isArray(input.rows)||input.rows.length<1||input.rows.length>100)fail('Envie de 1 a 100 lançamentos por lote');
    let created=0,skipped=0;
    for(const row of input.rows){
      if(!row||typeof row!=='object')fail('Linha inválida');
      if(!['income','expense'].includes(row.kind))fail('Tipo deve ser income ou expense');
      const kind=row.kind as 'income'|'expense',occurred=validDate(row.occurred_on);
      const amount=cents(row.amount_cents),category=required(row.category,'a categoria',80),description=required(row.description,'a descrição',250);
      const reference=str(row.reference,160);
      // Deduplicação conservadora pelo conjunto de campos estáveis da planilha.
      const existing=await db.prepare("SELECT id FROM transactions WHERE kind=? AND occurred_on=? AND amount_cents=? AND category=? AND description=? AND COALESCE(reference,'')=? LIMIT 1")
        .bind(kind,occurred,amount,category,description,reference).first<{id:string}>();
      if(existing){skipped++;continue}
      await db.prepare('INSERT INTO transactions(id,kind,amount_cents,category,description,party,occurred_on,payment_method,reference,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
        .bind(uuid(),kind,amount,category,description,str(row.party,120),occurred,str(row.payment_method,40),reference,NOW(),user.id).run();
      created++;
    }
    await audit(db,user,'import_transactions','transactions','batch',{created,skipped});
    return json({created,skipped});
  }

  // Migração a partir de Excel/Google Sheets: CSV é analisado no cliente,
  // enviado em lotes e aceito somente para o administrador.
  if (is('POST','members','import')) {
    if(user.role!=='admin')fail('Acesso restrito à administração',403);
    const input=await body(request,150_000);
    if(!Array.isArray(input.rows)||input.rows.length<1||input.rows.length>100)fail('Envie lotes de até 100 pessoas');
    const existing=(await db.prepare('SELECT email FROM members').all<{email:string}>()).results;
    const seen=new Set(existing.map(x=>x.email.toLowerCase()));
    const statements:Query[]=[];
    let skipped=0;
    for(const row of input.rows){
      if(!row||typeof row!=='object')fail('Linha de planilha inválida');
      const name=required(row.name,'nome do associado',120),e=email(row.email);
      if(seen.has(e)){skipped++;continue}
      seen.add(e);
      const monthly=(row.monthly_fee_cents==null||row.monthly_fee_cents==='')?null:cents(row.monthly_fee_cents);
      const status=['active','inactive','pending'].includes(row.status)?row.status:'active';
      const now=NOW();
      statements.push(db.prepare("INSERT OR IGNORE INTO members(id,name,email,phone,company,segment,city,notes,status,monthly_fee_cents,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(uuid(),name,e,str(row.phone,40),str(row.company,120),str(row.segment,120),str(row.city,90),str(row.notes,1000),status,monthly,currentDateBR(),now,now));
    }
    let created=0;
    for(let i=0;i<statements.length;i+=50){
      const results=await db.batch(statements.slice(i,i+50)) as Array<{meta?:{changes?:number}}>;
      created+=(results||[]).reduce((n,x)=>n+Number(x.meta?.changes||0),0);
    }
    await audit(db,user,'import_members','members','batch',{created,skipped});
    return json({created,skipped});
  }
  if (is('GET','reports','members.csv')) {
    if(!isManager)fail('Acesso restrito',403);
    const rows=(await db.prepare("SELECT name,email,phone,company,segment,city,status,monthly_fee_cents,notes FROM members ORDER BY name COLLATE NOCASE LIMIT 30000").all()).results;
    return csv(rows,[['name','Nome'],['email','E-mail'],['phone','Telefone'],['company','Empresa'],['segment','Segmento'],['city','Cidade'],['status','Status'],['monthly_fee_cents','Mensalidade (centavos)'],['notes','Observações']]);
  }
  if (method==='POST'&&path[0]==='charges'&&path.length===3&&path[2]==='notify') {
    if(!isManager)fail('Acesso restrito à tesouraria',403);
    const input=await body(request);
    const channel=input.channel;
    if(channel!=='email'&&channel!=='whatsapp')fail('Canal de aviso inválido');
    const charge=await db.prepare("SELECT c.id,c.period,c.due_date,c.amount_cents,c.status,m.name,m.email,m.phone FROM charges c JOIN members m ON m.id=c.member_id WHERE c.id=?").bind(path[1]).first<any>();
    if(!charge||charge.status!=='pending')fail('Cobrança inexistente ou não está aberta',409);
    const amount=(charge.amount_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const brand=(await getSettings(db)).group_name;
    const textMessage=`Olá, ${charge.name}! Sua cobrança de ${brand}, competência ${charge.period}, no valor de ${amount}, vence em ${charge.due_date}. Consulte o Pix em ${new URL(request.url).origin}/entrar`;
    let manualUrl='';
    if(channel==='email'){
      manualUrl=`mailto:${encodeURIComponent(charge.email)}?subject=${encodeURIComponent('Cobrança '+brand)}&body=${encodeURIComponent(textMessage)}`;
      if(env.RESEND_API_KEY&&env.RESEND_FROM){
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.RESEND_FROM,to:[charge.email],subject:'Cobrança de '+brand,text:textMessage})});
        if(!response.ok)fail('O provedor de e-mail recusou o envio. Verifique o domínio e as credenciais no Cloudflare.',502);
        await db.prepare("INSERT OR IGNORE INTO notice_logs(id,charge_id,channel,status,created_at) VALUES(?,?,?,?,?)").bind(uuid(),charge.id,channel,'sent',NOW()).run();
        return json({delivery:'sent',channel});
      }
    }else{
      const number=String(charge.phone||'').replace(/\D/g,'');
      if(!number)fail('Associe um telefone ao cadastro antes de enviar por WhatsApp');
      const phone=number.startsWith('55')?number:'55'+number;
      manualUrl=`https://wa.me/${phone}?text=${encodeURIComponent(textMessage)}`;
      if(env.WHATSAPP_ACCESS_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID){
        // Meta WhatsApp Business requires the approved template named cib_mensalidade.
        const response=await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({
          messaging_product:'whatsapp',to:phone,type:'template',
          template:{name:'mensalidade_cliente',language:{code:'pt_BR'},components:[{type:'body',parameters:[
            {type:'text',text:charge.name},{type:'text',text:charge.period},
            {type:'text',text:amount},{type:'text',text:charge.due_date}
          ]}]}
        })});
        if(!response.ok)fail('A API WhatsApp recusou o envio. Confira o modelo aprovado e as credenciais.',502);
        await db.prepare("INSERT OR IGNORE INTO notice_logs(id,charge_id,channel,status,created_at) VALUES(?,?,?,?,?)").bind(uuid(),charge.id,channel,'sent',NOW()).run();
        return json({delivery:'sent',channel});
      }
    }
    return json({delivery:'manual',channel,url:manualUrl,message:'Abra o aplicativo para revisar e enviar o aviso. O sistema ainda não fez o envio automaticamente.'});
  }

  if (is('GET', 'dashboard')) {
    if (!isManager) {
      const charges = (await db.prepare('SELECT id,period,due_date,amount_cents,status,paid_at FROM charges WHERE member_id=? ORDER BY period DESC LIMIT 24').bind(user.member_id).all()).results;
      return json({ charges, today: currentDateBR() });
    }
    const members = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM members").first();
    const charges = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END) AS collected_cents, SUM(CASE WHEN status='pending' THEN amount_cents ELSE 0 END) AS open_cents, SUM(CASE WHEN status='pending' AND due_date < ? THEN 1 ELSE 0 END) AS overdue FROM charges").bind(currentDateBR()).first();
    const transactions = await db.prepare("SELECT SUM(CASE WHEN kind='income' THEN amount_cents ELSE 0 END) AS other_income_cents, SUM(CASE WHEN kind='expense' THEN amount_cents ELSE 0 END) AS expenses_cents FROM transactions").first();
    const applications = await db.prepare("SELECT COUNT(*) AS total FROM applications WHERE status='new'").first<{total: number}>();
    const reports = await db.prepare("SELECT COUNT(*) AS total FROM payment_reports WHERE status='pending'").first<{total: number}>();
    return json({ members, charges, transactions, applications: applications?.total || 0, reports: reports?.total || 0, today: currentDateBR() });
  }
  if (is('GET', 'settings')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração', 403);
    return json({ settings: await getSettings(db) });
  }
  if (is('PATCH', 'settings')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração', 403);
    const data = await body(request), changes: Record<string,string> = {};
    for (const key of Object.keys(defaults)) {
      if (!(key in data)) continue;
      if (key === 'monthly_amount_cents') changes[key] = String(cents(data[key]));
      else if (key === 'portal_primary_color' || key === 'portal_accent_color') {
        if (typeof data[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(data[key])) fail('Cor inválida: use hexadecimal de 6 dígitos');
        changes[key] = data[key];
      } else if (key === 'due_day') {
        const day = Number(data[key]);
        if (!Number.isInteger(day) || day < 1 || day > 28) fail('O dia de vencimento deve ser de 1 a 28');
        changes[key] = String(day);
      } else changes[key] = str(data[key], key === 'pix_key' ? 77 : 160);
    }
    if ('pix_key' in changes && changes.pix_key && changes.pix_key.length < 3) fail('Chave Pix inválida');
    if (!Object.keys(changes).length) fail('Nenhuma configuração informada');
    await db.batch(Object.entries(changes).map(([key,value]) => db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,value,NOW())));
    await audit(db,user,'update_settings','settings','global',{ keys: Object.keys(changes) }); // Não grava chave Pix no log.
    return json({ settings: await getSettings(db) });
  }
  if (is('GET', 'members')) {
    if (!isManager) fail('Acesso restrito',403);
    const list = (await db.prepare('SELECT m.*, CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END AS portal_active FROM members m LEFT JOIN users u ON u.member_id=m.id ORDER BY m.name COLLATE NOCASE LIMIT 1000').all()).results;
    return json({ members: list });
  }
  if (is('POST', 'members')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const data = await body(request), e = email(data.email), name = required(data.name,'o nome',120);
    const status = ['active','pending','inactive'].includes(data.status) ? data.status : 'active';
    const now=NOW(), id=uuid();
    const fee = data.monthly_fee_cents === null || data.monthly_fee_cents === '' || data.monthly_fee_cents === undefined ? null : cents(data.monthly_fee_cents);
    await db.prepare('INSERT INTO members(id,name,email,phone,company,segment,city,notes,status,monthly_fee_cents,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,name,e,str(data.phone,40),str(data.company,120),str(data.segment,120),str(data.city,80),str(data.notes,600),status,fee,currentDateBR(),now,now).run();
    await audit(db,user,'create_member','member',id,{email:e});
    return json({ id, success:true },201);
  }
  if (method === 'PATCH' && path[0] === 'members' && path.length===2) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const member = await db.prepare('SELECT id FROM members WHERE id=?').bind(path[1]).first();
    if (!member) fail('Membro não encontrado',404);
    const data = await body(request);
    const patches: string[] = [], values: unknown[] = [];
    for (const field of ['name','email','phone','company','segment','city','notes','status','monthly_fee_cents']) {
      if (!(field in data)) continue;
      let value: unknown;
      if (field === 'email') value = email(data.email);
      else if (field === 'name') value = required(data.name,'o nome',120);
      else if (field === 'status') { if (!['active','pending','inactive'].includes(data.status)) fail('Status inválido'); value=data.status; }
      else if (field === 'monthly_fee_cents') value = data[field] === null || data[field] === '' ? null : cents(data[field]);
      else value = str(data[field], field==='notes'?600:120);
      patches.push(`${field}=?`); values.push(value);
    }
    if (!patches.length) fail('Nenhum campo para atualizar');
    patches.push('updated_at=?'); values.push(NOW(),path[1]);
    await db.prepare(`UPDATE members SET ${patches.join(',')} WHERE id=?`).bind(...values).run();
    await audit(db,user,'update_member','member',path[1],{fields:Object.keys(data).filter(k=>k!=='notes')});
    return json({ success:true });
  }
  if (is('POST','invitations')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const data = await body(request), member = await db.prepare('SELECT id,email FROM members WHERE id=?').bind(required(data.member_id,'o membro')).first<{id:string;email:string}>();
    if (!member) fail('Membro não encontrado',404);
    const token = randomToken(), id=uuid(), now=NOW();
    const expires = new Date(Date.now() + 7*24*3600_000).toISOString();
    await db.prepare('INSERT INTO invitations(id,member_id,token_hash,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(id,member.id,await sha256(token),expires,user.id,now).run();
    await audit(db,user,'create_invitation','member',member.id);
    return json({ token, expires_at: expires, email: member.email },201);
  }
  if (is('GET', 'applications')) {
    if (!isManager) fail('Acesso restrito',403);
    return json({ applications:(await db.prepare('SELECT * FROM applications ORDER BY created_at DESC LIMIT 500').all()).results });
  }
  if (method==='POST' && path[0]==='applications' && path.length===3 && ['approve','reject'].includes(path[2])) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const row = await db.prepare("SELECT * FROM applications WHERE id=? AND status='new'").bind(path[1]).first<any>();
    if (!row) fail('Inscrição não encontrada ou já avaliada',404);
    if (path[2] === 'approve') {
      const already = await db.prepare('SELECT id FROM members WHERE email=?').bind(row.email).first();
      if (already) fail('Já existe um membro com esse e-mail. Atualize o cadastro antes de aprovar.',409);
      const now=NOW(), memberId=uuid();
      await db.batch([
        db.prepare('INSERT INTO members(id,name,email,phone,company,status,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(memberId,row.name,row.email,row.phone,row.company,'pending',currentDateBR(),now,now),
        db.prepare("UPDATE applications SET status='approved',reviewed_by=?,reviewed_at=? WHERE id=? AND status='new'").bind(user.id,now,row.id),
      ]);
      await audit(db,user,'approve_application','application',row.id,{member_id:memberId});
    } else {
      await db.prepare("UPDATE applications SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND status='new'").bind(user.id,NOW(),row.id).run();
      await audit(db,user,'reject_application','application',row.id);
    }
    return json({ success:true });
  }
  if (is('GET','charges')) {
    const url = new URL(request.url);
    const period = url.searchParams.get('period'), filter = period ? validPeriod(period) : null;
    const query = isManager
      ? (filter ? db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id WHERE c.period=? ORDER BY m.name LIMIT 2000').bind(filter) : db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id ORDER BY c.period DESC,m.name LIMIT 2000'))
      : (filter ? db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id WHERE c.member_id=? AND c.period=? ORDER BY c.period DESC LIMIT 100').bind(user.member_id,filter) : db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id WHERE c.member_id=? ORDER BY c.period DESC LIMIT 100').bind(user.member_id));
    return json({ charges:(await query.all()).results, today:currentDateBR() });
  }
  if (is('POST','charges','generate')) {
    if (!isManager) fail('Acesso restrito',403);
    const data = await body(request), period=validPeriod(data.period), now=NOW();
    const settings = await getSettings(db), amountDefault=cents(Number(settings.monthly_amount_cents));
    const dueDay = Number(settings.due_day);
    if (!Number.isInteger(dueDay) || dueDay<1 || dueDay>28) fail('Configure o dia de vencimento de 1 a 28');
    const active = (await db.prepare("SELECT id,monthly_fee_cents FROM members WHERE status='active'").all<{id:string;monthly_fee_cents:number|null}>()).results;
    const date = `${period}-${String(dueDay).padStart(2,'0')}`;
    let created=0;
    for (const member of active) {
      const amount = member.monthly_fee_cents ?? amountDefault;
      if (amount <= 0) continue;
      const result = await db.prepare('INSERT OR IGNORE INTO charges(id,member_id,period,due_date,amount_cents,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(uuid(),member.id,period,date,amount,'pending',now,now).run();
      created += Number(result.meta?.changes||0);
    }
    await audit(db,user,'generate_charges','charge',period,{created});
    return json({created, active_members:active.length, period});
  }
  if (method==='GET' && path[0]==='charges' && path.length===3 && path[2]==='pix') {
    const charge = await db.prepare('SELECT c.id,c.member_id,c.amount_cents,c.status,c.period,m.name FROM charges c JOIN members m ON m.id=c.member_id WHERE c.id=?').bind(path[1]).first<any>();
    if (!charge) fail('Cobrança não encontrada',404);
    if (!isManager && charge.member_id!==user.member_id) fail('Acesso negado',403);
    if (charge.status==='canceled') fail('Cobrança cancelada',409);
    const s = await getSettings(db);
    if (!s.pix_key || !s.pix_receiver || !s.pix_city) fail('A conta Pix ainda não foi configurada pelo financeiro',409);
    return json({ code:buildPixCode({key:s.pix_key,receiver:s.pix_receiver,city:s.pix_city,amountCents:charge.amount_cents,txid:charge.id.replace(/-/g,'').slice(0,25)}), amount_cents:charge.amount_cents, receiver:s.pix_receiver, period:charge.period, paid:charge.status==='paid' });
  }
  if (method==='POST' && path[0]==='charges' && path.length===3 && path[2]==='mark-paid') {
    if (!isManager) fail('Acesso restrito',403);
    const data=await body(request), charge = await db.prepare('SELECT id,status,member_id FROM charges WHERE id=?').bind(path[1]).first<any>();
    if (!charge) fail('Cobrança não encontrada',404);
    if (charge.status!=='pending') fail('A cobrança já foi quitada ou cancelada',409);
    const methodValue = ['pix','cash','transfer','other'].includes(data.method) ? data.method : 'pix';
    const reference = str(data.reference,160), now = NOW();
    const updated=await db.prepare("UPDATE charges SET status='paid',paid_at=?,paid_by=?,payment_method=?,payment_reference=?,updated_at=? WHERE id=? AND status='pending'")
      .bind(now,user.id,methodValue,reference,now,path[1]).run();
    if (!updated.meta?.changes) fail('A cobrança já foi alterada',409);
    await db.prepare("UPDATE payment_reports SET status='reviewed',reviewed_at=?,reviewed_by=? WHERE charge_id=? AND status='pending'").bind(now,user.id,path[1]).run();
    await audit(db,user,'mark_paid','charge',path[1],{method:methodValue,reference});
    return json({ success:true });
  }
  if (method==='POST' && path[0]==='charges' && path.length===3 && ['reopen','cancel'].includes(path[2])) {
    if (user.role!=='admin') fail('Acesso restrito à administração',403);
    const next = path[2]==='reopen' ? 'pending':'canceled';
    const result=await db.prepare('UPDATE charges SET status=?,paid_at=NULL,paid_by=NULL,payment_method=NULL,payment_reference=NULL,updated_at=? WHERE id=?').bind(next,NOW(),path[1]).run();
    if (!result.meta?.changes) fail('Cobrança não encontrada',404);
    await audit(db,user,path[2]+'_charge','charge',path[1]);
    return json({ success:true });
  }
  if (method==='POST' && path[0]==='charges' && path.length===3 && path[2]==='report') {
    if (user.role!=='member' || !user.member_id) fail('Apenas o associado pode informar seu pagamento',403);
    const charge = await db.prepare("SELECT id,member_id,status FROM charges WHERE id=?").bind(path[1]).first<any>();
    if (!charge || charge.member_id!==user.member_id) fail('Cobrança não encontrada',404);
    if (charge.status!=='pending') fail('Essa cobrança não está em aberto',409);
    const data=await body(request), paidOn=validDate(data.paid_on), now=NOW();
    await db.prepare("INSERT INTO payment_reports(id,charge_id,member_id,reported_paid_on,reference,note,status,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(charge_id) DO UPDATE SET reported_paid_on=excluded.reported_paid_on,reference=excluded.reference,note=excluded.note,status='pending',created_at=excluded.created_at,reviewed_at=NULL,reviewed_by=NULL")
      .bind(uuid(),charge.id,user.member_id,paidOn,str(data.reference,160),str(data.note,500),'pending',now).run();
    await audit(db,user,'report_payment','charge',charge.id);
    return json({ success:true, message:'Aviso enviado. A tesouraria confirmará no extrato bancário.' });
  }
  if (is('GET','payment-reports')) {
    if (!isManager) fail('Acesso restrito',403);
    return json({reports:(await db.prepare('SELECT p.*,m.name AS member_name,c.period,c.amount_cents,c.status AS charge_status FROM payment_reports p JOIN members m ON m.id=p.member_id JOIN charges c ON c.id=p.charge_id ORDER BY p.created_at DESC LIMIT 500').all()).results});
  }
  if (method==='POST' && path[0]==='payment-reports' && path.length===3 && path[2]==='reject') {
    if (!isManager) fail('Acesso restrito',403);
    const result=await db.prepare("UPDATE payment_reports SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(user.id,NOW(),path[1]).run();
    if (!result.meta?.changes) fail('Aviso não encontrado ou já avaliado',404);
    await audit(db,user,'reject_payment_report','payment_report',path[1]);
    return json({success:true});
  }
  if (is('GET','transactions')) {
    if (!isManager) fail('Acesso restrito',403);
    const list=(await db.prepare('SELECT t.*,u.email AS created_by_email FROM transactions t LEFT JOIN users u ON u.id=t.created_by ORDER BY occurred_on DESC,created_at DESC LIMIT 1000').all()).results;
    return json({transactions:list});
  }
  if (is('POST','transactions')) {
    if (!isManager) fail('Acesso restrito',403);
    const data=await body(request);
    if (!['income','expense'].includes(data.kind)) fail('Tipo de lançamento inválido');
    const id=uuid();
    await db.prepare('INSERT INTO transactions(id,kind,amount_cents,category,description,party,occurred_on,payment_method,reference,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,data.kind,cents(data.amount_cents),required(data.category,'a categoria',80),required(data.description,'a descrição',250),str(data.party,120),validDate(data.occurred_on),str(data.payment_method,40),str(data.reference,160),NOW(),user.id).run();
    await audit(db,user,'create_transaction','transaction',id,{kind:data.kind,amount_cents:data.amount_cents});
    return json({ id, success:true },201);
  }
  if (is('GET','reports','monthly')) {
    if (!isManager) fail('Acesso restrito',403);
    const current = new URL(request.url).searchParams.get('period') || currentDateBR().slice(0,7), p=validPeriod(current);
    const chargeStats=await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END) AS dues_paid_cents,SUM(CASE WHEN status='pending' THEN amount_cents ELSE 0 END) AS dues_pending_cents,SUM(CASE WHEN status='pending' AND due_date<? THEN amount_cents ELSE 0 END) AS dues_overdue_cents FROM charges WHERE period=?").bind(currentDateBR(),p).first<any>();
    const entries=await db.prepare("SELECT kind,SUM(amount_cents) AS amount_cents FROM transactions WHERE substr(occurred_on,1,7)=? GROUP BY kind").bind(p).all<{kind:string;amount_cents:number}>();
    const income=entries.results.find(x=>x.kind==='income')?.amount_cents||0, expense=entries.results.find(x=>x.kind==='expense')?.amount_cents||0;
    return json({period:p,charge_stats:chargeStats,other_income_cents:income,expenses_cents:expense,net_cents:(chargeStats?.dues_paid_cents||0)+income-expense});
  }
  if (is('GET','reports','charges.csv')) {
    if (!isManager) fail('Acesso restrito',403);
    const rows=(await db.prepare('SELECT c.period AS competencia,m.name AS membro,m.email AS email,m.company AS empresa,c.due_date AS vencimento,c.amount_cents AS valor_centavos,c.status AS situacao,c.paid_at AS pago_em,c.payment_reference AS referencia FROM charges c JOIN members m ON m.id=c.member_id ORDER BY c.period DESC,m.name LIMIT 30000').all()).results;
    return csv(rows,[['competencia','Competência'],['membro','Membro'],['email','E-mail'],['empresa','Empresa'],['vencimento','Vencimento'],['valor_centavos','Valor (centavos)'],['situacao','Situação'],['pago_em','Pago em'],['referencia','Referência']]);
  }
  if (is('GET','reports','transactions.csv')) {
    if (!isManager) fail('Acesso restrito',403);
    const rows=(await db.prepare('SELECT occurred_on AS data,kind AS tipo,category AS categoria,description AS descricao,party AS favorecido,amount_cents AS valor_centavos,payment_method AS forma,reference AS referencia FROM transactions ORDER BY occurred_on DESC LIMIT 30000').all()).results;
    return csv(rows,[['data','Data'],['tipo','Tipo'],['categoria','Categoria'],['descricao','Descrição'],['favorecido','Favorecido'],['valor_centavos','Valor (centavos)'],['forma','Forma'],['referencia','Referência']]);
  }
  if (is('GET','audit')) {
    if (user.role!=='admin') fail('Acesso restrito à administração',403);
    return json({logs:(await db.prepare('SELECT a.*,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 250').all()).results});
  }
  fail('Rota não encontrada',404);
}

export async function onRequest(context: Context): Promise<Response> {
  try {
    return await handle(context);
  } catch (caught) {
    const error = caught as AppError;
    if (error.status) return json({error:error.message},error.status);
    const msg = String(error?.message||'');
    if (/UNIQUE constraint failed/i.test(msg)) return json({error:'Já existe um registro com este e-mail ou competência'},409);
    if (/FOREIGN KEY constraint failed/i.test(msg)) return json({error:'Registro relacionado não encontrado'},409);
    console.error('API error', error);
    return json({error:'Não foi possível concluir a operação. Confira as configurações do sistema.'},500);
  }
}
