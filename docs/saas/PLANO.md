# Plano SaaS Plug-and-Play — Plataforma White Label NPE

> Documento de trabalho. Define estratégia, arquitetura e fases para transformar a plataforma
> (hoje uma instalação por cliente) em um SaaS de assinatura mensal com ativação automática.

## 1. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Público | Associações, consultorias, escolas, autores e pequenos negócios |
| Teste grátis | 24 horas com acesso ao painel admin (sem cartão), depois mensalidade |
| Gateway | Asaas (assinatura recorrente: Pix, boleto e cartão) |
| Nota fiscal | Conta Azul, emitida após cada pagamento confirmado |
| WhatsApp | Evolution API (EvoAPI) |
| Domínio | Subdomínio nos planos 1 e 2; domínio próprio no plano 3 |
| Suporte | Autoatendimento com videoaulas (sem plano "fazemos para você") |
| Meta | 30 clientes em 6 meses, 100 em 12 meses |
| Marca / domínio | Nascidos para Empreender — `nascidosparaempreender.com.br` |
| E-mail transacional | Resend |
| Anti-fraude no teste | Código de verificação por WhatsApp antes de liberar o teste |
| Preços | R$ 79 / R$ 149 / R$ 297 por mês; anual com 2 meses grátis |
| Arquitetura | **Multi-inquilino** (um sistema, uma empresa por "tenant") |
| Lançamento | Validar com ativação manual enquanto a automação é construída |

## 2. Planos

| | Plano 1 — Essencial | Plano 2 — Profissional | Plano 3 — Completo |
|---|---|---|---|
| Cadastros | até 50 | até 100 | ilimitados |
| Chaves Pix | 1 | 1 | ilimitadas |
| Endereço | `empresa.nascidosparaempreender.com.br` | `empresa.nascidosparaempreender.com.br` | domínio próprio + subdomínio |
| Módulos | todos | todos | todos |
| Mensal | R$ 79 | R$ 149 | R$ 297 |
| Anual (2 meses grátis) | R$ 790 | R$ 1.490 | R$ 2.970 |

Os limites ficam **configuráveis no Super Admin** (nada fixo no código), permitindo criar,
alterar preços, limites e promoções sem programar. Ao atingir o limite, o cliente vê aviso e
botão de upgrade; nenhum dado é apagado.

## 3. Jornada do cliente

```
Anúncio → Landing page → Formulário → Conta de teste (24h) criada na hora
  → e-mail + WhatsApp com link de ativação → Assistente de marca → Painel
  → ao fim das 24h: tela "Escolha seu plano" → Checkout Asaas
  → webhook PAYMENT_CONFIRMED → conta ativa + NF (Conta Azul) + boas-vindas
```

1. **Landing page** com planos, vídeo, FAQ e formulário (nome, e-mail, WhatsApp, empresa,
   segmento, subdomínio desejado, aceite de Termos e Privacidade).
2. **Conta de teste**: tenant criado com status `trial`, expira em 24h. Link de ativação
   de uso único (validade 48h) — **nunca** enviamos senha.
3. **Assistente de primeiro acesso** (5 passos): senha → dados da empresa → logo
   (paleta sugerida a partir do logo) → cores e fontes → modelo de site. Depois, editor visual
   já existente.
4. **Fim do teste**: painel fica em modo leitura com tela de escolha de plano; site público
   mostra "em configuração". Lembretes em 12h, 2h e no vencimento.
5. **Pagamento** pelo checkout Asaas (assinatura). Webhook confirma, ativa o tenant e dispara
   NF e mensagens.
6. **Inadimplência**: D+1 lembrete, D+3 aviso, D+7 painel suspenso (site mantido),
   D+30 site suspenso, D+90 exclusão após exportação oferecida (alinhado aos Termos).
7. **Cancelamento** pelo próprio painel, com exportação CSV dos dados.

## 4. Área Super Admin (sua área)

Rota separada (`admin.nascidosparaempreender.com.br`), com login próprio e autenticação em dois fatores.

- **Visão geral**: MRR, novos clientes, testes ativos, conversão teste→pago, churn,
  inadimplência, receita do mês.
- **Clientes**: lista com filtros (plano, status, segmento), detalhe da empresa, uso de
  limites, histórico de pagamentos, mensagens enviadas, botões: estender teste, trocar plano,
  suspender/reativar, reenviar acesso, "entrar como suporte" (registrado em auditoria).
- **Pagamentos**: cobranças Asaas sincronizadas, status, NF emitida/pendente, reprocessar
  webhook.
- **Planos**: criar/editar planos, preços, limites, módulos, cupons, duração do teste.
- **Site da plataforma**: editar a landing page com o editor visual existente.
- **Mensagens**: modelos de e-mail e WhatsApp com variáveis (`{{nome}}`, `{{link}}`),
  log de envios e falhas.
- **Configurações**: integrações (Asaas, Conta Azul, EvoAPI, e-mail), domínio, textos
  legais, versão vigente dos Termos.
- **Auditoria**: quem fez o quê e quando.

## 5. Arquitetura técnica

- **Cloudflare Workers + D1** (mantém a base atual). Toda tabela de dados de cliente recebe
  `tenant_id`; toda consulta passa por uma camada que injeta o filtro — proibido SQL sem
  tenant. Testes automáticos de isolamento entre tenants são obrigatórios no CI.
- **Resolução do tenant** pelo host: `empresa.dominio` ou domínio próprio (Cloudflare for
  SaaS / Custom Hostnames para o plano 3, com SSL automático).
- **Mídia** em R2 por prefixo `tenants/<id>/`.
- **Filas** (Cloudflare Queues) para webhooks, NF e mensagens, com reprocessamento.
- **Segredos** (Asaas, Conta Azul, EvoAPI, e-mail) apenas como Secrets do Worker.
- **Webhooks Asaas** validados por token e idempotentes (mesmo evento nunca processa 2x).
- **Plataforma central** (planos, assinaturas, tenants, auditoria) separada logicamente dos
  dados de cada empresa.
- Escala prevista (100 clientes × até milhares de cadastros) cabe com folga em D1;
  revisão de particionamento ao passar de ~500 clientes.

## 6. Fases de desenvolvimento

| Fase | Entrega | Você faz | Eu faço |
|---|---|---|---|
| 0 | Deploy atual funcionando + piloto manual | Conta Asaas, páginas de pagamento manuais | Corrigir deploy, LP simples com link de pagamento |
| 1 | Multi-inquilino + isolamento | Domínio da plataforma na Cloudflare | `tenant_id`, resolução por host, testes de isolamento |
| 2 | Teste de 24h + ativação | Conta de e-mail transacional (Resend), EvoAPI | Cadastro, link de ativação, assistente de marca |
| 3 | Assinatura Asaas | Chave API sandbox e produção | Checkout, webhooks, inadimplência, upgrade/downgrade |
| 4 | Super Admin | Validar telas | Painel completo da seção 4 |
| 5 | Nota fiscal Conta Azul | Credenciais API Conta Azul, dados fiscais | Emissão automática e conciliação |
| 6 | Domínio próprio (plano 3) | Ativar Cloudflare for SaaS | Custom hostnames + verificação DNS guiada |
| 7 | LP + rastreamento | Pixels Meta/Google, roteiros dos vídeos | LP, eventos de conversão, UTMs |
| 8 | Piloto e lançamento | 3–5 clientes reais, revisão jurídica | Ajustes, monitoramento, runbook |

## 7. Pendências

1. ~~Nome do encarregado de dados (DPO)~~ — definido: Jeferson Samagaia e Gisele Samagaia.
2. Revisão jurídica dos Termos e da Política.
3. Recomendado: e-mail com domínio próprio (ex.: contato@nascidosparaempreender.com.br) para
   envio pelo Resend e para o DPO.
4. Confirmar se o domínio `nascidosparaempreender.com.br` já está na Cloudflare.

## 8. Documentos legais

Modelos em `docs/saas/TERMOS-DE-USO.md` e `docs/saas/POLITICA-DE-PRIVACIDADE.md`, no padrão
de mercado de SaaS B2B brasileiro (Marco Civil, CDC no que couber, LGPD). **São rascunhos e
precisam de revisão por advogado antes da publicação.**
