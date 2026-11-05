import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,Download,Upload,Check,Play,Pause,CalendarDays,Users,Mail,MessageCircle,FileSpreadsheet} from 'lucide-react';
import {api,type Member,brl,monthNow} from './api';
import {membersFromCsv,chargesFromCsv,transactionsFromCsv,type ImportedMember,type ImportedCharge,type ImportedTransaction} from './csvImport';

type Plan={id:string;title:string;start_period:string;next_period:string;repetitions:number;processed:number;due_day:number;status:string;member_count:number;amount_cents:number|null;channels:string};
export default function FinanceTools({mode}:{mode:'recurrences'|'import'}){
 const [members,setMembers]=useState<Member[]>([]),[plans,setPlans]=useState<Plan[]>([]),[selected,setSelected]=useState<string[]>([]);
 const [title,setTitle]=useState('Cobranças recorrentes'),[repetitions,setRepetitions]=useState(6);
 const [start,setStart]=useState(monthNow()),[day,setDay]=useState(10),[amount,setAmount]=useState('');
 const [channels,setChannels]=useState('portal'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [importKind,setImportKind]=useState<'members'|'charges'|'transactions'>('members'),[historicalPaid,setHistoricalPaid]=useState(false);
 const [preview,setPreview]=useState<Array<ImportedMember|ImportedCharge|ImportedTransaction>>([]),[errors,setErrors]=useState<string[]>([]),[filename,setFilename]=useState('');
 const reload=async()=>{const m=await api<{members:Member[]}>('members');setMembers(m.members);if(mode==='recurrences'){const p=await api<{plans:Plan[]}>('recurrences');setPlans(p.plans)}};
 useEffect(()=>{void reload().catch(e=>setMessage((e as Error).message));},[mode]);
 const active=members.filter(m=>m.status==='active');
 const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
 const run=async(fn:()=>Promise<unknown>,success:string)=>{setBusy(true);setMessage('');try{await fn();setMessage(success);await reload()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};
 const create=async()=>{if(!selected.length){setMessage('Selecione pelo menos um associado.');return}const val=amount.trim()?Math.round(Number(amount.replace(',','.'))*100):null;
  if(amount.trim()&&(!Number.isSafeInteger(val)||Number(val)<=0)){setMessage('Valor inválido.');return}
  await run(async()=>{await api('recurrences','POST',{title,repetitions,start_period:start,due_day:day,member_ids:selected,amount_cents:val,channels});setSelected([])},'Assinatura criada. A rotina diária do Cloudflare emitirá uma mensalidade por mês até completar o total.');
 };
 const changePlan=async(id:string,patch:Record<string,unknown>)=>{await run(()=>api(`recurrences/${id}`,'PATCH',patch),'Assinatura atualizada. As cobranças já emitidas não foram alteradas.')};
 const readFile=async(file?:File)=>{if(!file)return;setMessage('');setFilename(file.name);try{const raw=await file.text();const data=importKind==='members'?membersFromCsv(raw):importKind==='charges'?chargesFromCsv(raw):transactionsFromCsv(raw);setPreview(data.rows);setErrors(data.errors);}catch(e){setMessage((e as Error).message);setPreview([]);setErrors([])}};
 const submitImport=async()=>{if(!preview.length)return;if(importKind==='charges'&&preview.some(x=>(x as ImportedCharge).status==='paid')&&!historicalPaid){setMessage('Marque a confirmação explícita antes de importar mensalidades pagas.');return}
   setBusy(true);setMessage('');try{let created=0,skipped=0;const endpoint=importKind==='members'?'members/import':importKind==='charges'?'imports/charges':'imports/transactions';
    for(let i=0;i<preview.length;i+=100){const result=await api<{created:number;skipped:number}>(endpoint,'POST',{rows:preview.slice(i,i+100),confirm_historical_paid:historicalPaid});created+=result.created;skipped+=result.skipped}
    setPreview([]);setErrors([]);setFilename('');setHistoricalPaid(false);setMessage(`Importação concluída: ${created} registros novos, ${skipped} duplicados ignorados.`);await reload();
   }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  };

 return <div className="cib-finance-tools"><header className="cib-tools-header"><Link to="/painel"><ArrowLeft size={16}/> Voltar ao painel</Link><h1>{mode==='recurrences'?'Assinaturas e mensalidades recorrentes':'Importar e exportar planilhas'}</h1><p>{mode==='recurrences'?'Selecione os participantes e configure a emissão mensal de cobranças no Cloudflare.':'Migre clientes, mensalidades anteriores e lançamentos de caixa por CSV exportado do Excel ou Google Sheets.'}</p></header>
 {message&&<div className="cib-tools-alert" role="status">{message}</div>}
 {mode==='recurrences'?<div className="cib-tools-layout">
  <section className="cib-tools-card"><h2><CalendarDays size={20}/> Nova assinatura</h2>
   <label>Descrição / nome do plano<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <div className="cib-tools-cols"><label>Número de parcelas<input type="number" min="1" max="36" value={repetitions} onChange={e=>setRepetitions(Number(e.target.value))}/></label><label>Primeira competência<input type="month" value={start} onChange={e=>setStart(e.target.value)}/></label></div>
   <div className="cib-tools-cols"><label>Dia de vencimento<input type="number" min="1" max="28" value={day} onChange={e=>setDay(Number(e.target.value))}/></label><label>Valor por mês (R$, opcional)<input type="number" min="0.01" step="0.01" placeholder="Usar valor do associado" value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>
   <p className="cib-tools-help">Exemplo: 6 parcelas com início em novembro de 2026 criam uma cobrança em novembro, dezembro, janeiro, fevereiro, março e abril, sempre no dia {day}. Parcelas futuras são geradas no mês correspondente.</p>
   <label>Canal de aviso preferencial<select value={channels} onChange={e=>setChannels(e.target.value)}><option value="portal">Portal somente</option><option value="email">Portal e e-mail</option><option value="whatsapp">Portal e WhatsApp</option><option value="both">Portal, e-mail e WhatsApp</option></select></label>
   <div className="cib-tools-choose"><div><strong><Users size={16}/> Pessoas</strong><button onClick={()=>setSelected(selected.length===active.length?[]:active.map(m=>m.id))}>{selected.length===active.length?'Desmarcar todos':'Selecionar todos'}</button></div><span>{selected.length} selecionados</span><div className="cib-tools-member-list">{active.map(m=><label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggle(m.id)}/><span>{m.name}<small>{m.company||m.email}</small></span><em>{brl(m.monthly_fee_cents??4000)}</em></label>)}</div></div>
   <button className="button button-primary cib-tools-primary" disabled={busy||!selected.length} onClick={()=>void create()}><Check size={17}/> Criar assinatura para {selected.length} cliente(s)</button>
   <p className="cib-tools-help">Um plano gera cobranças Pix no portal. O recebimento continua sujeito à conciliação bancária. Avisos automáticos dependem de credenciais de provedor configuradas.</p>
  </section>
  <section className="cib-tools-card"><div className="cib-tools-card-header"><h2>Assinaturas cadastradas</h2><button onClick={()=>void run(()=>api('recurrences/run','POST',{}),'Rotina de cobranças executada.')} disabled={busy}><Play size={15}/> Processar agora</button></div>
   {plans.map(p=><article className="cib-tools-plan" key={p.id}><header><strong>{p.title}</strong><span className={p.status==='active'?'cib-state-active':''}>{p.status==='active'?'Ativa':p.status==='paused'?'Pausada':'Concluída'}</span></header><p>{p.member_count} clientes · {p.processed}/{p.repetitions} competências processadas · Dia {p.due_day}</p><p>Próximo mês: {p.status==='completed'?'Concluído':p.next_period} · {p.amount_cents?brl(p.amount_cents):'Valor por associado'}</p><div>{p.status!=='completed'&&<button onClick={()=>void changePlan(p.id,{status:p.status==='active'?'paused':'active'})}>{p.status==='active'?<Pause size={14}/>:<Play size={14}/>} {p.status==='active'?'Pausar':'Retomar'}</button>}{p.status!=='completed'&&<button onClick={()=>{const val=prompt('Novo dia de vencimento (1 a 28):',String(p.due_day));if(val!==null)void changePlan(p.id,{due_day:Number(val)})}}>Alterar vencimento futuro</button>}</div></article>)}
   {!plans.length&&<p className="cib-tools-help">Nenhuma assinatura criada. Selecione os clientes no formulário ao lado.</p>}
   <div className="cib-tools-card-sub"><h3>Avisos de pagamento</h3><p><Mail size={16}/> E-mail: integração via Resend, opcional.</p><p><MessageCircle size={16}/> WhatsApp: integração oficial Meta Business, opcional.</p><p>Na tela de mensalidades você também pode abrir mensagens prontas para envio manual, sem conexão com provedor.</p></div>
  </section>
 </div>:<div className="cib-tools-layout">
  <section className="cib-tools-card"><h2><Upload size={20}/> Importar sua planilha</h2><p>Exporte seu arquivo do Excel ou Google Sheets como <strong>CSV UTF-8</strong> e selecione o tipo de dados. Importe clientes antes de mensalidades históricas.</p>
   <label>O que você deseja importar?<select value={importKind} onChange={e=>{setImportKind(e.target.value as typeof importKind);setPreview([]);setErrors([]);setFilename('');setMessage('')}}><option value="members">Pessoas</option><option value="charges">Mensalidades históricas</option><option value="transactions">Receitas adicionais e despesas</option></select></label>
   <label className="cib-tools-file"><FileSpreadsheet size={25}/> Selecionar arquivo .csv<input type="file" accept=".csv,text/csv" onChange={e=>void readFile(e.target.files?.[0])}/></label>
   <p className="cib-tools-help">{importKind==='members'?'Colunas: Nome, E-mail, Telefone, Empresa, Segmento, Cidade, Status, Mensalidade, Observações.':'Colunas: '+(importKind==='charges'?'E-mail, Competência, Vencimento, Valor (centavos), Situação, Pago em, Referência.':'Data, Tipo, Categoria, Descrição, Favorecido, Valor (centavos), Forma, Referência.')+' Os registros já importados são ignorados quando identificados como duplicados.'}</p>
   {filename&&<p><strong>Arquivo:</strong> {filename}</p>}
   {!!errors.length&&<div className="cib-tools-warnings"><strong>{errors.length} linha(s) com problema:</strong>{errors.slice(0,10).map((x,i)=><p key={i}>{x}</p>)}</div>}
   {!!preview.length&&<><h3>Pré-visualização: {preview.length} registros válidos</h3><div className="cib-tools-preview"><table><thead><tr>{importKind==='members'?<><th>Nome</th><th>E-mail</th><th>Empresa</th><th>Mensalidade</th></>:importKind==='charges'?<><th>Associado</th><th>Competência</th><th>Vencimento</th><th>Status</th><th>Valor</th></>:<><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></>}</tr></thead><tbody>{preview.slice(0,12).map((m,i)=>{if(importKind==='members'){const x=m as ImportedMember;return <tr key={i}><td>{x.name}</td><td>{x.email}</td><td>{x.company}</td><td>{x.monthly_fee_cents==null?'Padrão':brl(x.monthly_fee_cents)}</td></tr>}if(importKind==='charges'){const x=m as ImportedCharge;return <tr key={i}><td>{x.member_email}</td><td>{x.period}</td><td>{x.due_date}</td><td>{x.status}</td><td>{brl(x.amount_cents)}</td></tr>}const x=m as ImportedTransaction;return <tr key={i}><td>{x.occurred_on}</td><td>{x.description}</td><td>{x.category}</td><td>{brl(x.amount_cents)}</td></tr>})}</tbody></table></div>
   {importKind==='charges'&&preview.some(x=>(x as ImportedCharge).status==='paid')&&<label style={{display:'flex',flexDirection:'row',alignItems:'center'}}><input type="checkbox" checked={historicalPaid} onChange={e=>setHistoricalPaid(e.target.checked)}/> Confirmo que verifiquei os registros antigos marcados como pagos e autorizo sua importação como histórico.</label>}
   {importKind==='transactions'&&<p className="cib-tools-warnings">Importe aqui apenas receitas adicionais e despesas. Não importe mensalidades já registradas como pagas, para não duplicar o saldo financeiro.</p>}
   <button disabled={busy} className="button button-primary cib-tools-primary" onClick={()=>void submitImport()}><Check size={17}/> Confirmar importação</button></>}
  </section>
  <section className="cib-tools-card"><h2><Download size={20}/> Exportar e fazer backup</h2><p>Baixe os dados para Excel, Google Sheets ou migração futura. Os relatórios são gerados diretamente a partir do D1.</p>
   <div className="cib-tools-exports"><a href="/api/reports/members.csv"><Download size={17}/> Pessoas (.csv)</a><a href="/api/reports/charges.csv"><Download size={17}/> Cobranças (.csv)</a><a href="/api/reports/transactions.csv"><Download size={17}/> Receitas e despesas (.csv)</a></div>
   <h3>Modelo de importação</h3><p>Baixe um modelo vazio com o cabeçalho correto para preencher sua planilha atual.</p>
   <a className="cib-tools-template" download={`modelo-${importKind}-plataforma.csv`} href={"data:text/csv;charset=utf-8,"+encodeURIComponent(importKind==='members'?"Nome;E-mail;Telefone;Empresa;Segmento;Cidade;Status;Mensalidade;Observações\n":importKind==='charges'?"E-mail;Competência;Vencimento;Valor (centavos);Situação;Pago em;Referência\n":"Data;Tipo;Categoria;Descrição;Favorecido;Valor (centavos);Forma;Referência\n")}>Baixar modelo CSV</a>
   <div className="cib-tools-card-sub"><h3>Importação segura</h3><p>Nenhum arquivo é publicado no site. A importação exige o acesso do administrador e registra a operação no histórico de auditoria.</p><p>Antes de importar os dados reais, confira a finalidade e a base legal de tratamento dos dados dos clientes conforme a LGPD.</p></div>
  </section>
 </div>}
 </div>;
}
