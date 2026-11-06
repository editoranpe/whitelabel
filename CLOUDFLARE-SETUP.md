# Instalação da plataforma NPE no Cloudflare Workers

Este projeto **não** usa os recursos do Conectando Ideias Brasil. Acesse o repositório
[editoranpe/whitelabel](https://github.com/editoranpe/whitelabel), branch `main`.

## 1. Criar um banco Cloudflare D1 exclusivo

No Cloudflare Dashboard, acesse **Storage & databases → D1 SQL database → Create database**.
Crie um banco com nome `npe-white-label-demo` (ou outro nome exclusivo), sem importar tabelas de outros sistemas.

Copie o **Database ID**, um UUID no formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
Esse ID não é uma senha; ele identifica o banco, mas não deve pertencer a outra instalação.

O sistema cria automaticamente as tabelas iniciais quando recebe a primeira solicitação
à API (com banco vazio e binding válido). O banco é usado para usuários, sessões,
cadastros, imagens e financeiro. Não é preciso importar a migração SQL à mão para uma
instalação completamente nova.

## 2. Conferir Worker e conexão do GitHub

Acesse **Workers & Pages → seu Worker → Settings → Build**.
Confirme o repositório `editoranpe/whitelabel` e a branch de produção `main`.

A configuração recomendada é:

| Campo | Valor |
|---|---|
| Root directory | `/` (raiz do repositório) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Production branch | `main` |
| Node.js | 22 ou mais recente |

**O nome real do Worker é `whitelabel`, e já corresponde ao `wrangler.jsonc` deste repositório.**
O passo abaixo insere o ID do banco D1 durante o build, sem precisar alterar o GitHub.

## 3. Definir variáveis de BUILD no Cloudflare

Ainda em **Settings → Build → Build variables and secrets**, adicione:

| Variável | Valor |
|---|---|
| `NPE_D1_DATABASE_ID` | **Obrigatória:** UUID do banco D1 exclusivo criado no passo 1 |
| `NPE_D1_DATABASE_NAME` | Opcional: use apenas se o banco não se chama `npe-white-label-demo` |
| `NPE_WORKER_NAME` | Opcional: o nome `whitelabel` já está configurado para esta implantação |
| `NPE_SITE_ORIGIN` | Opcional: `https://whitelabel.jeferson-samagaia.workers.dev` já está configurado |

O script `scripts/prepare-cloudflare.mjs` é executado automaticamente antes de
`npm run build` dentro de Workers Builds, usando `WORKERS_CI=1`.
Ele preenche o `wrangler.jsonc` **apenas no ambiente temporário do build**,
sem gravar IDs de clientes no GitHub.

O arquivo versionado já identifica o Worker `whitelabel` e a URL `https://whitelabel.jeferson-samagaia.workers.dev`. Ele conserva apenas o identificador do banco D1 como exemplo propositalmente inválido.
Se o build indicar `NPE_CLOUDFLARE_CONFIG`, confira estas variáveis.

Não coloque `SETUP_TOKEN` em Build variables: é segredo de execução, não de compilação.

## 4. Primeiro administrador: segredo SETUP_TOKEN

Em **Worker → Settings → Variables and Secrets → Production**, adicione:

| Campo | Valor |
|---|---|
| Type | **Secret** |
| Name | `SETUP_TOKEN` |
| Value | Uma sequência aleatória exclusiva com pelo menos 24 caracteres |

Gere o valor no seu gerenciador de senhas ou com `openssl rand -hex 32` em
um computador confiável. **Não coloque o segredo no código, em prints ou nesta conversa.**
Depois de criar o administrador, exclua este Secret para reduzir riscos.

## 5. Publicar

Salve as configurações e execute **Retry deployment** ou faça um novo push na branch `main`.
O fluxo GitHub → Workers Builds deve:

1. Executar `npm run build` (o `prebuild` valida Worker e D1 e configura o Wrangler).
2. Publicar com `npx wrangler deploy`.
3. Disponibilizar o site na URL informada pelo painel do Cloudflare.

**Observação:** conectar o GitHub é apenas a integração; uma execução concluída
com sucesso no GitHub Actions não equivale a um deploy no Cloudflare. Confira
o histórico de implantação em **Workers & Pages → Worker → Deployments**.

## 6. Testar no endereço real do novo Worker

Substitua `https://SEU-WORKER.workers.dev` pelo endereço mostrado no Cloudflare:

| URL | Resultado esperado |
|---|---|
| `/` | Página pública Editora NPE com conteúdo de demonstração |
| `/api/version` | JSON com `editor_release: "npe-white-label-v1"` e `deployment.d1_bound: true` |
| `/api/health` | JSON com `ok: true` |
| `/api/setup-status` | `setup_required: true` e `setup_token_ready: true` antes do cadastro |
| `/entrar` | Formulário para criar o primeiro administrador |
| `/painel` | Painel após login como administrador |
| `/editar-site` | Editor visual após login como administrador |

Se `/api/version` mostra `d1_bound:false`, o Worker não recebeu o binding.
Verifique `NPE_D1_DATABASE_ID` e a última implantação no Cloudflare.

Se `/api/setup-status` indicar `setup_token_ready:false`, verifique se
`SETUP_TOKEN` está cadastrado como **Secret** na versão de produção do Worker.

No primeiro cadastro, use **nome, e-mail, senha exclusiva com pelo menos 12 caracteres**
e o `SETUP_TOKEN` que foi definido. Guarde a senha em gerenciador seguro.
Não use senhas de demonstração ou senhas já mostradas em capturas de tela.

## 7. Segurança e operação

- **D1 exclusivo:** não selecione o banco do Conectando Ideias Brasil.
- **Pix:** não cadastre dados reais de terceiros para apresentações; use dados fictícios.
- **Cobranças:** depois de criar o administrador, confira a configuração do Cron
  `0 6 * * *` na aba Triggers antes de utilizar assinaturas reais.
- **Avisos:** Resend e WhatsApp exigem chaves de provedores próprios, e envio automático
  vem desativado por padrão.
- **Privacidade:** substitua os textos legais exemplificativos antes de cadastrar pessoas reais.
- **Biblioteca WebP:** usa o mesmo D1 exclusivo, sem R2 obrigatório no protótipo.

## Verificação automatizada de produção

Depois de publicar e configurar `SETUP_TOKEN`, acesse
[GitHub Actions → Verify Cloudflare NPE deployment](https://github.com/editoranpe/whitelabel/actions/workflows/verify-cloudflare.yml)
e clique em **Run workflow**. Preencha `worker_url` com o endereço
HTTPS público do novo Worker (exatamente como aparece no Cloudflare).

O teste consulta `/`, `/api/version`, `/api/health`, `/api/setup-status`
e `/entrar`. Não precisa de credenciais e nunca acessa os dados pessoais
da instalação. O resultado **verde** comprova que o site público e o
primeiro acesso estão disponíveis. A autenticação propriamente dita deve
ser testada no navegador pelo administrador.

Também é possível testar localmente com:
```bash
npm run smoke:cloudflare -- https://SEU-WORKER.SUBDOMINIO.workers.dev
```

## Solução de problemas

- **Build falhou antes de publicar**: abra os logs de Workers Builds; as mensagens
  `NPE_CLOUDFLARE_CONFIG` explicam quais variáveis de build precisam de correção.
- **Build reclama que o nome do Worker é diferente**: revise `NPE_WORKER_NAME`,
  que deve coincidir com o nome exibido no Cloudflare.
- **Página pública abre, mas /api/health retorna 503**: falta o D1 correto no Worker.
- **Página de login abre, mas o primeiro admin não pode ser criado**: confira
  `/api/setup-status`, SETUP_TOKEN e o estado da base D1.
- **O GitHub Actions está verde, mas não há site no ar**: confirme o deploy no
  **histórico do Cloudflare**, separado do GitHub Actions.

**Última observação:** esta instalação demonstra uma plataforma independente. Para cada
cliente futuro, use um Worker, banco D1, token e URL exclusivos.
