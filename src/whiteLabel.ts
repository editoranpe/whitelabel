import type {CibPage} from './VisualSite';

/**
 * Tema comercial de demonstração, nunca contém cadastros de clientes.
 * Um cliente recebe uma implantação Cloudflare + banco D1 próprios.
 * Depois do primeiro acesso, o administrador edita todo o site em /editar-site.
 */
export const NPE_THEME = {
  companyName: 'Editora NPE',
  productName: 'NPE Plataforma',
  subtitle: 'Nossa História é Criar Legados!',
  accent: '#f00483',
  primary: '#393c86',
  yellow: '#ffd100',
  ink: '#242542',
  background: '#f8f7fc',
  logo: '/assets/npe-brand.svg',
} as const;

export const whiteLabelDemoPage:CibPage = {
  title:'NPE Plataforma | Um sistema com a identidade da sua empresa',
  font:'modern',
  headerColor:'#393c86',
  accentColor:'#ffd100',
  brandName:'Editora NPE',
  brandSubtitle:'PLATAFORMAS PERSONALIZÁVEIS',
  logoImage:'/assets/npe-brand.svg',
  footerText:'Editora NPE · Plataforma demonstrativa para personalização de clientes',
  privacyTitle:'Privacidade e tratamento de dados',
  privacyText:'MODELO DEMONSTRATIVO: substitua este texto pela política de privacidade da empresa antes de coletar dados reais.\n\nInforme razão social, identidade do controlador, finalidade, base legal, prazo de retenção, compartilhamentos, direitos dos titulares e canal de contato.\n\nEste exemplo não constitui orientação jurídica e não deve ser publicado como política definitiva.',
  menuItems:[
    {id:'nav_inicio',label:'Início',href:'#inicio'},
    {id:'nav_solucoes',label:'Recursos',href:'#solucoes'},
    {id:'nav_marca',label:'Sua marca',href:'#identidade'},
    {id:'nav_examples',label:'Exemplos',href:'#depoimentos'},
    {id:'nav_contato',label:'Contato',href:'#contato'},
  ],
  sections:[
    {id:'inicio',label:'Página inicial',columns:2,background:'#f8f7fc',color:'#222443',padding:84,widgets:[
      {id:'hero_titulo',type:'heading',title:'Uma plataforma. Infinitas identidades.',text:'Esta é uma demonstração editável. Troque textos, fotografias, ícones, cores e menus para apresentar o sistema com a marca de cada cliente.',fontSize:53},
      {id:'hero_image',type:'image',image:'/assets/demo-hero.svg',label:'Imagem de exemplo. Substitua pela foto da sua empresa.'}
    ]},
    {id:'apresentacao',label:'Apresentação',columns:1,background:'#ffffff',color:'#393c86',padding:48,widgets:[
      {id:'intro_cta',type:'button',label:'Conhecer funcionalidades',url:'#solucoes',align:'center'},
      {id:'intro_texto',type:'text',text:'CONTEÚDO DEMONSTRATIVO · 100% PERSONALIZÁVEL',align:'center',fontSize:13}
    ]},
    {id:'solucoes',label:'Recursos',columns:1,background:'#ffffff',color:'#222443',padding:88,widgets:[
      {id:'features_principais',type:'iconGrid',title:'Uma base pronta para o seu negócio',text:'Escolha o que faz sentido para o cliente. Ative somente os módulos necessários.',columns:3,items:[
        {title:'Editor visual',text:'Monte páginas, banners, imagens, menus e depoimentos sem modificar o código.',icon:'lightbulb'},
        {title:'Pessoas e cadastros',text:'Organize associados, clientes, parceiros e usuários em um painel protegido.',icon:'users'},
        {title:'Assinaturas',text:'Planeje mensalidades e cobranças recorrentes por período e vencimento.',icon:'calendar'},
        {title:'Financeiro e Pix',text:'Registre entradas, saídas, pagamentos e gere QR Codes Pix.',icon:'briefcase'},
        {title:'Comunicação',text:'Prepare notificações para e-mail e WhatsApp com integrações opcionais.',icon:'message'},
        {title:'Relatórios e exportação',text:'Faça importações CSV, consultas e exportação de dados.',icon:'target'},
      ]}
    ]},
    {id:'identidade',label:'Identidade visual',columns:1,background:'#f4f2fa',color:'#222443',padding:88,widgets:[
      {id:'photo_texto',type:'imageText',title:'Seu sistema, com a sua personalidade.',text:'Esta imagem é ilustrativa. Use a biblioteca de mídia para enviar fotos reais, o logotipo e os elementos visuais de cada empresa. O editor permite mudar a ordem dos blocos e escolher os ícones.',image:'/assets/demo-team.svg',imagePosition:'right',label:'SUA MARCA AQUI'}
    ]},
    {id:'depoimentos',label:'Exemplos',columns:1,background:'#ffffff',color:'#222443',padding:84,widgets:[
      {id:'reviews_exemplo',type:'testimonials',title:'Aqui entram histórias reais de clientes',text:'Os exemplos abaixo são marcadores e não representam depoimentos verdadeiros.',columns:3,items:[
        {title:'Nome do cliente 01',role:'Cargo · Empresa',text:'Insira aqui um depoimento autorizado sobre a experiência com a empresa.'},
        {title:'Nome do cliente 02',role:'Cargo · Empresa',text:'Substitua este texto por uma avaliação verdadeira, com foto e identificação.'},
        {title:'Nome do cliente 03',role:'Cargo · Empresa',text:'Você pode adicionar e remover depoimentos diretamente no editor.'},
      ]}
    ]},
    {id:'perguntas',label:'Dúvidas',columns:1,background:'#f8f7fc',color:'#222443',padding:72,widgets:[
      {id:'duvidas_demo',type:'faq',title:'Perguntas frequentes',items:[
        {title:'Consigo trocar todo o conteúdo?',text:'Sim. O site permite editar títulos, descrições, seções, ícones, cores, menus, logotipo e imagens.'},
        {title:'Cada empresa tem seus próprios dados?',text:'Sim, desde que seja instalada com um novo Worker, um banco Cloudflare D1 exclusivo e segredos próprios.'},
        {title:'Como as cobranças são confirmadas?',text:'O sistema emite QR Code Pix. A baixa é manual até que uma API bancária seja configurada e implementada.'},
      ]}
    ]},
    {id:'contato',label:'Solicite uma demonstração',columns:1,background:'#393c86',color:'#ffffff',padding:82,widgets:[
      {id:'contato_form',type:'signup',title:'Vamos criar a próxima versão para sua empresa?',text:'Formulário demonstrativo. Personalize os campos, a política de privacidade e os canais de atendimento antes de utilizar com clientes.'}
    ]}
  ]
};
