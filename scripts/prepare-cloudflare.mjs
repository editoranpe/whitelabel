import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

/**
 * Runs before Vite in Cloudflare Workers Builds (WORKERS_CI=1).
 * Build variables belong in Cloudflare > Worker > Settings > Build.
 * Runtime secrets such as SETUP_TOKEN must NEVER be passed here.
 * Avoids committing each customer's Worker name or D1 identifier to Git.
 */
const force=process.argv.includes('--force');
if(process.env.WORKERS_CI!=='1'&&!force)process.exit(0);

function die(message){
  console.error('\nNPE_CLOUDFLARE_CONFIG: '+message+'\n');
  process.exit(1);
}
const file=resolve(process.env.NPE_WRANGLER_CONFIG_FILE||'wrangler.jsonc');
let config;
try{config=JSON.parse(readFileSync(file,'utf8'))}
catch{die('Não foi possível ler o wrangler.jsonc do projeto.')}

const worker=(process.env.NPE_WORKER_NAME||'').trim();
const databaseId=(process.env.NPE_D1_DATABASE_ID||'').trim();
const databaseName=(process.env.NPE_D1_DATABASE_NAME||'npe-white-label-demo').trim();
const origin=(process.env.NPE_SITE_ORIGIN||'').trim().replace(/\/$/,'');
const validName=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!worker||!validName.test(worker))
 die('Defina a variável de BUILD NPE_WORKER_NAME com o nome EXATO do Worker já criado no Cloudflare (sem .workers.dev).');
if(worker==='conectando-ideias-brasil'||worker.includes('conectando-ideias'))
 die('O Worker original do Conectando Ideias Brasil não pode ser usado nesta versão.');
if(!uuid.test(databaseId))
 die('Crie um banco D1 EXCLUSIVO e defina NPE_D1_DATABASE_ID com o UUID do banco no ambiente de BUILD do Cloudflare.');
if(!validName.test(databaseName)||databaseName.includes('conectando-ideias'))
 die('NPE_D1_DATABASE_NAME precisa conter um nome seguro e exclusivo, sem referência ao banco do grupo.');
if(origin){
 let url;
 try{url=new URL(origin)}catch{die('NPE_SITE_ORIGIN precisa ser um endereço HTTPS válido.')}
 if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash || /conectando-ideias-brasil/i.test(url.hostname))
  die('NPE_SITE_ORIGIN deve ser a URL HTTPS exclusiva do novo Worker, sem caminhos ou parâmetros.');
}
config.name=worker;
config.d1_databases=[{binding:'DB',database_name:databaseName,database_id:databaseId}];
if(origin)config.vars={...(config.vars||{}),SITE_ORIGIN:origin};
else if(config.vars){
  delete config.vars.SITE_ORIGIN;
  if(!Object.keys(config.vars).length)delete config.vars;
}
writeFileSync(file,JSON.stringify(config,null,2)+'\n',{encoding:'utf8'});
console.log('NPE_CLOUDFLARE_CONFIG OK: Worker '+worker+' / D1 '+databaseName+'.');
console.log('Cloudflare build preparado; SETUP_TOKEN deve ser cadastrado separadamente como segredo de execução.');
