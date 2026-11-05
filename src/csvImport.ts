/** RFC4180-compatible lightweight CSV parser for Excel/Google Sheets exports. */
export function parseCsv(input:string):string[][]{
 const text=input.replace(/^\uFEFF/,'');
 const headerLine=text.split(/\r?\n/,1)[0]||'';
 const comma=(headerLine.match(/,/g)||[]).length,semicolon=(headerLine.match(/;/g)||[]).length;
 const delimiter=semicolon>comma?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;}
  else if(ch===delimiter&&!quoted){row.push(cell.trim());cell='';}
  else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());cell='';if(row.some(x=>x.length))rows.push(row);row=[];}
  else cell+=ch;
 }
 if(quoted)throw Error('CSV com aspas não fechadas');
 row.push(cell.trim());if(row.some(x=>x.length))rows.push(row);
 return rows;
}
const normalize=(x:string)=>x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>={
 name:['nome','nomecompleto','associado','name'], email:['email','e-mail','correioeletronico'],
 phone:['telefone','celular','whatsapp','fone','phone'], company:['empresa','company','negocio'],
 segment:['segmento','ramo','setor'],city:['cidade','city','municipio'],
 status:['status','situacao'], monthly_fee_cents:['mensalidadecentavos','mensalidadeemcentavos','mensalidade','valor','valormensal'],
 notes:['observacoes','observacao','anotacoes','notas']
};
export type ImportedMember={name:string;email:string;phone:string;company:string;segment:string;city:string;status:string;monthly_fee_cents:number|null;notes:string};
function money(value:string,centsColumn:boolean):number|null{
 if(!value.trim())return null;
 if(centsColumn){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null}
 const cleaned=value.replace(/R\$/gi,'').replace(/\s/g,'').replace(/[^\d,.]/g,'');
 if(!cleaned)return null;
 const normalized=cleaned.includes(',')?cleaned.replace(/\./g,'').replace(',','.'):cleaned;
 const num=Number(normalized);
 return Number.isFinite(num)&&num>0?Math.round(num*100):null;
}
export function membersFromCsv(input:string):{rows:ImportedMember[];errors:string[]}{
 const parsed=parseCsv(input);if(parsed.length<2)throw Error('A planilha precisa de cabeçalho e pelo menos um associado');
 const headers=parsed[0].map(normalize);
 const indexes:Record<string,number>={};
 for(const [key,variants] of Object.entries(aliases))indexes[key]=headers.findIndex(x=>variants.map(normalize).includes(x));
 if(indexes.name<0||indexes.email<0)throw Error('A planilha deve conter as colunas Nome e E-mail');
 const errors:string[]=[],rows:ImportedMember[]=[];
 for(let i=1;i<parsed.length;i++){
  const cols=parsed[i];const get=(key:string)=>indexes[key]>=0?(cols[indexes[key]]||'').trim():'';
  const name=get('name'),email=get('email').toLowerCase();
  if(!name&&!email)continue;
  if(!name||!/^\S+@\S+\.\S+$/.test(email)){errors.push(`Linha ${i+1}: Nome ou E-mail inválido`);continue}
  const feeHeader=indexes.monthly_fee_cents>=0?headers[indexes.monthly_fee_cents]:'';
  const rawFee=get('monthly_fee_cents'),fee=money(rawFee,feeHeader.includes('centav'));
  if(rawFee&&fee===null){errors.push(`Linha ${i+1}: mensalidade inválida`);continue}
  const statusRaw=normalize(get('status'));
  const status=statusRaw==='inativo'||statusRaw==='inactive'?'inactive':statusRaw==='pendente'||statusRaw==='pending'?'pending':'active';
  rows.push({name,email,phone:get('phone'),company:get('company'),segment:get('segment'),city:get('city'),status,monthly_fee_cents:fee,notes:get('notes')});
 }
 return {rows,errors};
}

export type ImportedCharge={member_email:string;period:string;due_date:string;amount_cents:number;status:'pending'|'paid'|'canceled';paid_on:string|null;reference:string};
export type ImportedTransaction={kind:'income'|'expense';occurred_on:string;amount_cents:number;category:string;description:string;party:string;payment_method:string;reference:string};
function readTable(input:string){const all=parseCsv(input);if(all.length<2)throw Error('Informe um CSV com cabeçalho e pelo menos uma linha');const headers=all[0].map(normalize);return {headers,records:all.slice(1),field:(head:string[],row:string[])=>{const i=headers.findIndex(h=>head.map(normalize).includes(h));return i<0?'':String(row[i]||'').trim();}};}
function dateOnly(input:string){
 const value=input.trim().slice(0,10);
 if(/^20\d{2}-\d{2}-\d{2}$/.test(value))return value;
 const br=value.match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
 return br?`${br[3]}-${br[2]}-${br[1]}`:'';
}
function periodOnly(input:string){const x=input.trim();if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(x))return x;const br=x.match(/^(0[1-9]|1[0-2])\/(20\d{2})$/);return br?`${br[2]}-${br[1]}`:' ';}
export function chargesFromCsv(input:string):{rows:ImportedCharge[];errors:string[]}{
 const t=readTable(input),rows:ImportedCharge[]=[],errors:string[]=[];
 for(const [i,row] of t.records.entries()){
  const get=(h:string[])=>t.field(h,row);
  const member_email=get(['e-mail','email','emaildoassociado']).toLowerCase(),period=periodOnly(get(['competencia','periodo','period']));
  const due_date=dateOnly(get(['vencimento','data de vencimento','due_date']));
  const value=get(['valorcentavos','valor','amount_cents']);
  const idx=t.headers.findIndex(h=>['valorcentavos','valor','amountcents'].includes(h));
  const amount=money(value,idx>=0&&t.headers[idx].includes('centav'));
  const state=normalize(get(['situacao','status']));
  const status:ImportedCharge['status']=['paid','pago','quitado'].includes(state)?'paid':['canceled','cancelado'].includes(state)?'canceled':'pending';
  const paid_on= status==='paid'?dateOnly(get(['pagoem','data do pagamento','paid_on'])||due_date):null;
  if(!/^\S+@\S+\.\S+$/.test(member_email)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)||!due_date||amount===null||(status==='paid'&&!paid_on)){
   errors.push(`Linha ${i+2}: e-mail, competência, vencimento ou valor inválido`);continue
  }
  rows.push({member_email,period,due_date,amount_cents:amount,status,paid_on,reference:get(['referencia','comprovante'])});
 }
 return {rows,errors};
}
export function transactionsFromCsv(input:string):{rows:ImportedTransaction[];errors:string[]}{
 const t=readTable(input),rows:ImportedTransaction[]=[],errors:string[]=[];
 for(const [i,row] of t.records.entries()){
  const get=(h:string[])=>t.field(h,row);
  const kindRaw=normalize(get(['tipo','kind']));
  const kind:ImportedTransaction['kind']=['receita','income','entrada'].includes(kindRaw)?'income':'expense';
  const occurred_on=dateOnly(get(['data','occurred_on']));
  const description=get(['descricao','description']);
  const category=get(['categoria','category']);
  const value=get(['valorcentavos','valor','amount_cents']);
  const idx=t.headers.findIndex(h=>['valorcentavos','valor','amountcents'].includes(h));
  const amount=money(value,idx>=0&&t.headers[idx].includes('centav'));
  if(!['receita','income','entrada','despesa','expense','saida'].includes(kindRaw)||!occurred_on||!description||!category||amount===null){
   errors.push(`Linha ${i+2}: tipo, data, categoria, descrição ou valor inválido`);continue
  }
  rows.push({kind,occurred_on,description,category,amount_cents:amount,party:get(['favorecido','origem','party']),payment_method:get(['forma','payment_method','metodo']),reference:get(['referencia','reference'])});
 }
 return {rows,errors};
}
