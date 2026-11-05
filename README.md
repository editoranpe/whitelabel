# Editora NPE | Plataforma White Label

> **Edição independente para demonstração comercial e personalização por cliente.**
> Este é o repositório independente `editoranpe/whitelabel`, com código na branch `main`. A edição Conectando Ideias Brasil permanece no repositório `editoranpe/conectando-ideias-brasil`, com seu próprio Cloudflare Worker e banco D1.

## Colocar o site e o painel no Cloudflare

Com o GitHub conectado ao Cloudflare Workers, siga o guia **[CLOUDFLARE-SETUP.md](./CLOUDFLARE-SETUP.md)**. Ele explica as variáveis de build `NPE_WORKER_NAME` e `NPE_D1_DATABASE_ID`, o D1 exclusivo, o segredo `SETUP_TOKEN`, a publicação e os testes das rotas `/entrar`, `/painel` e `/editar-site`.

## O que você recebe

- Site demonstrativo com identidade visual inspirada na Editora NPE (rosa `#f00483`, azul-violeta `#393c86`, amarelo `#ffd100`) e ilustrações de marcação.
- Editor visual em `/editar-site`: seções, widgets, ícones, depoimentos, imagens WebP, textos, menus, fontes, cores e histórico de versões.
- Área protegida em `/painel`, com cadastros, acesso administrativo, financeiro, cobranças Pix, recorrências, importação e exportação em CSV.
- Exemplo sem nomes ou depoimentos reais de clientes. As imagens SVG são ilustrativas, devem ser substituídas na implantação final.
- A identidade Editora NPE é o **tema de apresentação**, não uma marca fixa do produto. O administrador troca logotipo, nome, cores, menus, conteúdo, imagens e dados de cobrança, além das cores e do nome exibidos no próprio painel administrativo.
- Logotipo exibido no código é uma **assinatura SVG demonstrativa**, criada com base na paleta e no conceito da marca. A imagem oficial enviada pelo proprietário deve ser carregada no editor antes da apresentação final.

## Instruções para usar em um novo cliente

**Regra obrigatória: uma implantação independente por cliente. Nunca associe este projeto ao D1 ou Worker do Conectando Ideias Brasil.**

1. Crie um repositório exclusivo do cliente, copiando os arquivos da branch `main` de `editoranpe/whitelabel`. Não reutilize a branch `main` do Conectando Ideias como ambiente de produção.
2. Na Cloudflare, crie um **novo Worker** para este cliente. Escolha nome e domínio de teste próprios, por exemplo `empresa-exemplo-demo.workers.dev`.
3. Crie um **banco D1 novo**. Atualize `wrangler.jsonc` com o nome único do Worker, o `database_name` e o **database_id exclusivo** obtido na Cloudflare. O arquivo inclui um identificador propositalmente inválido até que você o substitua, para evitar associação acidental a bancos reais.
4. Configure `SITE_ORIGIN` com o domínio real desse Worker em `wrangler.jsonc` ou em Variables; não use o domínio do grupo Conectando Ideias.
5. Configure `SETUP_TOKEN` como **Secret** no Worker, com pelo menos 24 caracteres gerados aleatoriamente. Nunca coloque segredos no GitHub. Após criar o administrador, retire o token.
6. Configure o Build Command `npm run build` e a saída `dist` na Cloudflare, mantendo o Worker `src/worker.ts` e a binding D1 denominada `DB`. Se usar Wrangler CLI, execute `npm run deploy` após preencher o arquivo.
7. Acesse `/entrar` e crie o primeiro administrador. No painel, preencha **Configurações** com os dados da empresa e os dados bancários reais somente quando apropriado.
8. Acesse **Editor visual** (`/editar-site`). Em **Menus**, mude logotipo e nome da marca. Em **Aparência**, escolha a fonte, as cores, o rodapé e o texto da página de privacidade. Em **Estrutura/Adicionar**, substitua os textos e as imagens demonstrativas. **Salvar** é rascunho; **Publicar** atualiza o site público.
9. No editor, em **Aparência → Privacidade**, substitua o texto demonstrativo da página `/privacidade` pela política aprovada da empresa antes de utilizar formulários reais. O texto incluído é um marcador, não uma política pronta para uso.
10. Teste as permissões, upload, cadastro, backup, Pix e envio de e-mail com dados de teste. **Nunca** insira CPF, chave Pix, telefone ou dados reais da empresa no Git.
11. Para novo cliente, repita os passos com outro repositório/Worker/D1. A aplicação **não é multi-inquilino compartilhado**: o isolamento é por instalação. Isso reduz risco de vazamento entre clientes.

## Personalização sem programar

| Área | O que pode editar |
|---|---|
| Identidade | Logotipo, nome, slogan no cabeçalho, cores principais, fonte e rodapé |
| Portal | Nome da empresa e cores próprias do painel em **Configurações** |
| Privacidade | Título e texto da política, editáveis em **Aparência**, publicados junto com o site |
| Navegação | Adicionar, remover e ordenar itens; links internos e externos |
| Conteúdo | Seções inteiras, colunas, espaçamento, títulos, imagens, textos e botões |
| Componentes | Grade de ícones, cards, foto com texto, depoimentos, perguntas e formulário |
| Mídia | Upload WebP, conversão de JPG/PNG e biblioteca para reutilizar imagens |
| Acesso | Administrador principal, tesouraria, membros e convites |
| Financeiro | Mensalidade, dia padrão, cobranças, recorrência, dados bancários e Pix |
| Dados | Importação e exportação de associados, cobranças e lançamentos |

## Marca e exemplos

As cores visuais da demonstração foram extraídas por aproximação da logo enviada da Editora NPE:

- Rosa: `#f00483`
- Azul-violeta: `#393c86`
- Amarelo: `#ffd100`

O arquivo `public/assets/npe-brand.svg` é uma **recriação ilustrativa simplificada** para esta branch, não substitui o arquivo oficial da marca. O editor permite enviar a logo original em WebP e publicá-la no próprio Cloudflare D1.

As imagens `demo-hero.svg` e `demo-team.svg` trazem avisos de substituição e não contêm fotos ou declarações de clientes.

## Segurança e limites

- As senhas são protegidas por PBKDF2 compatível com Cloudflare Workers. Não insira credenciais no código-fonte.
- Configure sempre um **D1 próprio** por cliente; uploads, cadastros, transações e sessões residem nesse banco.
- O QR Code Pix gera instruções de pagamento, mas a confirmação ainda depende de conciliação manual; a API bancária futura exige integração por instituição.
- Avisos automáticos dependem de Resend ou API oficial Meta e ficam desativados por padrão.
- A recorrência é processada pelo Cron Trigger `0 6 * * *`. Confira a trigger no painel após implantar.
- A biblioteca de mídia usa D1 (900 KB por imagem, limite de 400 imagens). Para uma galeria maior, planeje migração para R2.
- Antes de iniciar operações reais, defina a base legal de dados pessoais, política de privacidade, retenção e consentimentos necessários.
- Não use os dados fictícios do painel de demonstração como dados operacionais.

## Execução local

Requisitos: Node 22+, npm e um novo D1 para testes das APIs.

```bash
npm install
npm run check:template
npm run dev
```

O frontend abre em `http://localhost:5173`. Para testar API, use Wrangler conectado ao seu D1 **de desenvolvimento**. Sem API, a página institucional demonstrativa continua disponível com conteúdo estático; autenticação e financeiro requerem D1.

## Repositório oficial desta edição

Código-fonte: https://github.com/editoranpe/whitelabel

Branch principal: `main`

## CI e deploy

Este repositório possui checagem de build/testes independente e **não publica nada no Worker de produção do Conectando Ideias**. O script de isolamento `scripts/check-isolation.mjs` bloqueia o domínio original e impede reaproveitamento do Worker e dos nomes do banco da edição CIB. Não existe deploy automático desta branch em um endereço `workers.dev` até configurar **um novo projeto Cloudflare**.

No GitHub, revise os workflows antes de alterar permissões. Não conecte o repositório do Conectando Ideias Brasil ao Worker de um cliente. O workflow deste repositório executa apenas testes.

---

**Editora NPE · Nossa História é Criar Legados!**  
Projeto derivado da mesma base técnica, mas sem reutilizar a identidade, cadastros, banco ou domínio de produção do Conectando Ideias Brasil.
