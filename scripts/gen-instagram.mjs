// Kalbix Agenda — Instagram post generator (30 posts, 1080x1350)
// Usage: node scripts/gen-instagram.mjs
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'instagram', 'posts');
mkdirSync(outDir, { recursive: true });

const BLUE = '#1e6ff0';
const BLUE_D = '#0b3d91';
const DARK = '#0a0c12';
const GRAY = '#5b6472';

const CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1080px; height:1350px; overflow:hidden; }
body {
  font-family:'Segoe UI Black','Segoe UI',Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.post { width:1080px; height:1350px; position:relative; display:flex; flex-direction:column; padding:70px 80px 60px; }
.post.dark { background:radial-gradient(1200px 800px at 85% -10%, #16304f 0%, ${DARK} 55%); color:#fff; }
.post.light { background:#f4f7fb; color:${DARK}; }
.post.blue { background:linear-gradient(160deg, ${BLUE} 0%, ${BLUE_D} 100%); color:#fff; }

.top { display:flex; align-items:center; justify-content:space-between; height:110px; flex:none; }
.logo-card { background:#fff; border-radius:28px; padding:14px 26px; box-shadow:0 12px 40px rgba(0,0,0,.18); display:flex; align-items:center; }
.logo-card img { height:82px; display:block; }
.tag { font-family:'Segoe UI',Arial; font-weight:700; font-size:26px; letter-spacing:3px; text-transform:uppercase; padding:14px 28px; border-radius:999px; }
.dark .tag { color:${BLUE}; border:3px solid rgba(30,111,240,.55); }
.light .tag { color:${BLUE_D}; background:#e5eeff; }
.blue .tag { color:#fff; border:3px solid rgba(255,255,255,.6); }

.mid { flex:1; display:flex; flex-direction:column; justify-content:center; position:relative; min-height:0; }
.kicker { font-family:'Segoe UI',Arial; font-weight:700; font-size:34px; letter-spacing:5px; text-transform:uppercase; color:${BLUE}; margin-bottom:28px; }
.blue .kicker, .dark .kicker.bluek { color:#7db2ff; }
h1 { font-size:104px; font-weight:900; line-height:1.0; letter-spacing:-2px; }
h1 .hl { color:${BLUE}; }
.blue h1 .hl, .dark h1 .hl.bluehl { color:#7db2ff; }
.sub { font-family:'Segoe UI',Arial; font-weight:400; font-size:38px; line-height:1.35; margin-top:34px; }
.dark .sub, .blue .sub { color:rgba(255,255,255,.78); }
.light .sub { color:${GRAY}; }

.bot { flex:none; display:flex; align-items:center; justify-content:space-between; border-top:2px solid rgba(120,140,170,.35); padding-top:34px; }
.handle { font-family:'Segoe UI',Arial; font-weight:700; font-size:32px; letter-spacing:1px; }
.cta { font-family:'Segoe UI',Arial; font-weight:700; font-size:30px; background:${BLUE}; color:#fff; padding:20px 42px; border-radius:999px; }
.light .cta { background:${BLUE}; }
.blue .cta { background:#fff; color:${BLUE_D}; }
.dark .cta { background:${BLUE}; }

.swoosh { position:absolute; pointer-events:none; }

/* phone mockup */
.phone { width:430px; border-radius:54px; background:#10131b; padding:20px; box-shadow:0 40px 90px rgba(10,20,60,.45); flex:none; }
.phone-screen { border-radius:38px; overflow:hidden; background:#f6f8fc; height:840px; display:flex; flex-direction:column; }
.p-head { background:${DARK}; color:#fff; padding:26px 28px 30px; }
.p-head .ph-name { font-size:26px; font-weight:900; }
.p-head .ph-sub { font-family:'Segoe UI'; font-size:17px; color:#8ea6c8; margin-top:4px; }
.p-body { padding:20px; display:flex; flex-direction:column; gap:14px; flex:1; }
.p-card { background:#fff; border-radius:22px; padding:18px 20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 14px rgba(15,30,60,.07); }
.p-time { font-size:22px; font-weight:900; color:${BLUE}; }
.p-name { font-family:'Segoe UI'; font-size:19px; font-weight:700; color:${DARK}; }
.p-svc { font-family:'Segoe UI'; font-size:15px; color:${GRAY}; }
.p-ok { font-family:'Segoe UI'; font-weight:700; font-size:14px; color:#0e9f6e; background:#e2f7ee; padding:6px 12px; border-radius:999px; }
.p-toast { background:${BLUE}; color:#fff; border-radius:22px; padding:18px 20px; font-family:'Segoe UI'; font-weight:700; font-size:18px; box-shadow:0 10px 30px rgba(30,111,240,.4); }

.split { display:flex; align-items:center; gap:60px; }
.split .txt { flex:1; min-width:0; }

.bigstat { font-size:300px; font-weight:900; line-height:.9; color:${BLUE}; letter-spacing:-8px; }
.bigstat small { font-size:130px; letter-spacing:-2px; }

.check-row { display:flex; align-items:flex-start; gap:24px; margin-top:30px; }
.check-ic { width:64px; height:64px; border-radius:20px; background:${BLUE}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:36px; flex:none; }
.check-tx { font-size:44px; font-weight:900; line-height:1.15; padding-top:6px; }
.check-tx span { display:block; font-family:'Segoe UI'; font-weight:400; font-size:28px; color:${GRAY}; margin-top:6px; }
.dark .check-tx span { color:rgba(255,255,255,.65); }

.step-row { display:flex; gap:36px; margin-top:60px; }
.step { flex:1; background:#fff; border-radius:32px; padding:40px 34px; box-shadow:0 14px 40px rgba(15,30,60,.08); }
.step .n { width:70px; height:70px; border-radius:999px; background:${BLUE}; color:#fff; font-size:38px; display:flex; align-items:center; justify-content:center; }
.step .t { font-size:34px; font-weight:900; margin-top:26px; line-height:1.1; }
.step .d { font-family:'Segoe UI'; font-size:24px; color:${GRAY}; margin-top:12px; line-height:1.3; }

.aud-emoji { font-size:190px; line-height:1; margin-bottom:40px; }
.q { font-size:96px; font-weight:900; line-height:1.03; letter-spacing:-2px; }
`;

const swooshSVG = (color = BLUE, w = 900, o = 0.28) => `
<svg class="swoosh" width="${w}" height="${w * 0.5}" viewBox="0 0 900 450" style="right:-340px; bottom:-220px; opacity:${o}; transform:rotate(-14deg);">
  <ellipse cx="450" cy="225" rx="420" ry="150" fill="none" stroke="${color}" stroke-width="52" stroke-linecap="round" stroke-dasharray="2350 900" transform="rotate(-8 450 225)"/>
</svg>`;

const phoneHTML = `
<div class="phone"><div class="phone-screen">
  <div class="p-head">
    <div class="ph-name">KALBIX AGENDA</div>
    <div class="ph-sub">Hoje · 8 atendimentos · R$ 420</div>
  </div>
  <div class="p-body">
    <div class="p-toast">🔔 Novo agendamento confirmado!</div>
    <div class="p-card"><div><div class="p-time">09:00</div><div class="p-name">Carlos M.</div><div class="p-svc">Corte + Barba</div></div><div class="p-ok">Confirmado</div></div>
    <div class="p-card"><div><div class="p-time">10:30</div><div class="p-name">Rafael S.</div><div class="p-svc">Corte Masculino</div></div><div class="p-ok">Confirmado</div></div>
    <div class="p-card"><div><div class="p-time">14:00</div><div class="p-name">Lucas A.</div><div class="p-svc">Barba Terapia</div></div><div class="p-ok">Confirmado</div></div>
    <div class="p-card"><div><div class="p-time">15:30</div><div class="p-name">Bruno C.</div><div class="p-svc">Corte Infantil</div></div><div class="p-ok">Confirmado</div></div>
  </div>
</div></div>`;

const check = (t, d = '') => `<div class="check-row"><div class="check-ic">✓</div><div class="check-tx">${t}${d ? `<span>${d}</span>` : ''}</div></div>`;

function page(post, body, { tag = '', cta = '' } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><div class="post ${post}">
  <div class="top">
    <div class="logo-card"><img src="../assets/logo.png"></div>
    ${tag ? `<div class="tag">${tag}</div>` : ''}
  </div>
  <div class="mid">${body}</div>
  <div class="bot">
    <span class="handle">@kalbixagenda</span>
    ${cta ? `<span class="cta">${cta}</span>` : `<span class="tag">Agenda inteligente</span>`}
  </div>
</div></body></html>`;
}

const posts = [
  {
    file: 'post-01', post: 'dark', tag: 'Lançamento', cta: 'Conheça agora',
    body: `${swooshSVG(BLUE, 1100)}
      <p class="kicker">Chegou</p>
      <h1>Seu negócio na <span class="hl">agenda certa</span>.</h1>
      <p class="sub">Agendamento online para barbearias, salões, clínicas e qualquer serviço com horário marcado.</p>`,
  },
  {
    file: 'post-02', post: 'light', tag: 'O problema', cta: 'Existe solução',
    body: `<h1>Agenda no caderno?<br><span class="hl">Horário esquecido no WhatsApp?</span></h1>
      <p class="sub">Todo dia você perde clientes por buraco na agenda, esquecimento e falta de organização.</p>`,
  },
  {
    file: 'post-03', post: 'dark', tag: 'A solução', cta: 'Quero conhecer',
    body: `${swooshSVG('#2a5fc4', 1000, 0.22)}
      <h1>Seu estabelecimento inteiro em <span class="hl">um só sistema</span>.</h1>
      <p class="sub">Agenda, equipe, clientes, financeiro e app próprio — com a sua marca.</p>`,
  },
  {
    file: 'post-04', post: 'light', tag: '24 horas', cta: 'Ativar minha agenda',
    body: `<div class="split"><div class="txt">
      <h1 style="font-size:84px;">Seus clientes agendam <span class="hl">enquanto você dorme</span>.</h1>
      <p class="sub" style="font-size:32px;">Sua página de agendamento funciona 24h, sem você responder uma mensagem.</p>
    </div>${phoneHTML}</div>`,
  },
  {
    file: 'post-05', post: 'dark', tag: 'Sua marca', cta: 'Ver demonstração',
    body: `<h1>Com a <span class="hl">cara do seu negócio</span>.</h1>
      <p class="sub">Seu logo, suas cores, seu link de agendamento. Seus clientes vêem a SUA marca — não a nossa.</p>
      ${check('Logo e cores personalizados')}${check('Link exclusivo do seu estabelecimento')}${check('App com o nome do seu negócio')}`,
  },
  {
    file: 'post-06', post: 'light', tag: 'App próprio', cta: 'Ter meu app',
    body: `<div class="aud-emoji">📲</div>
      <h1>Seu próprio app <span class="hl">na tela do cliente</span>.</h1>
      <p class="sub">Instalável no Android e no iPhone. Sem loja de aplicativos, sem custo extra.</p>`,
  },
  {
    file: 'post-07', post: 'blue', tag: 'Faltas', cta: 'Reduzir faltas',
    body: `<h1>Chega de furo na agenda.</h1>
      <p class="sub">Confirmação e lembrete automático para o cliente — muito menos gente que marca e não aparece.</p>`,
  },
  {
    file: 'post-08', post: 'dark', tag: 'Realidade', cta: 'Encher a agenda',
    body: `${swooshSVG('#2a5fc4', 1000, 0.22)}
      <div class="bigstat">1<small> horário vago</small></div>
      <h1 style="font-size:80px; margin-top:30px;">é dinheiro que <span class="hl bluehl">ficou na mesa</span>.</h1>
      <p class="sub">Agenda cheia e organizada = mais faturamento no mesmo espaço.</p>`,
  },
  {
    file: 'post-09', post: 'light', tag: 'Equipe', cta: 'Organizar equipe',
    body: `<h1>Cada profissional com sua <span class="hl">agenda e especialidade</span>.</h1>
      ${check('Serviços que cada um executa', 'O cliente escolhe o profissional certo')}${check('Horários individuais', 'Cada um com seu expediente')}${check('Agenda separada por pessoa', 'Nada de confusão')}`,
  },
  {
    file: 'post-10', post: 'dark', tag: 'Comissões', cta: 'Automatizar',
    body: `<div class="aud-emoji" style="font-size:150px;">💰</div>
      <h1>Comissão calculada <span class="hl">sozinha</span>.</h1>
      <p class="sub">Percentual por profissional, por serviço. Fechamento do dia sem planilha e sem discussão.</p>`,
  },
  {
    file: 'post-11', post: 'light', tag: 'Financeiro', cta: 'Ver no painel',
    body: `<div class="bigstat" style="font-size:220px;">R$</div>
      <h1 style="font-size:84px; margin-top:20px;">Saiba <span class="hl">quanto entrou hoje</span> — em tempo real.</h1>
      <p class="sub">Faturamento, ticket médio e previsão de próximos dias no seu painel.</p>`,
  },
  {
    file: 'post-12', post: 'dark', tag: 'Clientes', cta: 'Conhecer meus clientes',
    body: `<h1>Receba seu cliente <span class="hl">pelo nome</span>.</h1>
      <p class="sub">Histórico completo: o que já fez, quando voltou, o que gosta. Atendimento de gente grande.</p>`,
  },
  {
    file: 'post-13', post: 'light', tag: 'Recorrência', cta: 'Criar meu clube',
    body: `<div class="aud-emoji">🔁</div>
      <h1>Renda todo mês com o <span class="hl">clube de assinatura</span>.</h1>
      <p class="sub">Cliente assina um plano, volta todos os meses e você tem dinheiro recorrente garantido.</p>`,
  },
  {
    file: 'post-14', post: 'blue', tag: 'Novos clientes', cta: 'Aparecer mais',
    body: `<h1>Seja encontrado por clientes novos.</h1>
      <p class="sub">Seu estabelecimento no diretório Kalbix — quem procura agendamento na sua região encontra VOCÊ.</p>`,
  },
  {
    file: 'post-15', post: 'light', tag: 'Como funciona', cta: 'Começar agora',
    body: `<h1 style="font-size:88px;">Começar é <span class="hl">simples assim</span>:</h1>
      <div class="step-row">
        <div class="step"><div class="n">1</div><div class="t">Envie seu logo</div><div class="d">E escolha suas cores</div></div>
        <div class="step"><div class="n">2</div><div class="t">Configuramos tudo</div><div class="d">Serviços, equipe e horários</div></div>
        <div class="step"><div class="n">3</div><div class="t">Receba agendamentos</div><div class="d">No app com a sua marca</div></div>
      </div>`,
  },
  {
    file: 'post-16', post: 'dark', tag: 'Demonstração', cta: 'Quero a demo',
    body: `${swooshSVG(BLUE, 1100)}
      <h1>Quer ver <span class="hl">funcionando</span>?</h1>
      <p class="sub">Demonstração gratuita e sem compromisso: você vê a agenda, o app e o painel funcionando com o SEU logo.</p>`,
  },
  { file: 'post-17', post: 'light', tag: 'Barbearias', cta: 'Minha barbearia', body: `<div class="aud-emoji">💈</div><h1>Feito para <span class="hl">barbearias</span>.</h1><p class="sub">Cortes, combos, pezinho — agenda por barbeiro, comissão no fechamento e cliente voltando sempre.</p>` },
  { file: 'post-18', post: 'light', tag: 'Salões', cta: 'Meu salão', body: `<div class="aud-emoji">💇‍♀️</div><h1>Feito para <span class="hl">salões de beleza</span>.</h1><p class="sub">Coloração, corte, unhas — cada profissional com sua especialidade e sua agenda.</p>` },
  { file: 'post-19', post: 'light', tag: 'Estética', cta: 'Minha clínica', body: `<div class="aud-emoji">🧖‍♀️</div><h1>Feito para <span class="hl">clínicas de estética</span>.</h1><p class="sub">Sessões com duração certa, sala reservada e cliente lembrada da próxima visita.</p>` },
  { file: 'post-20', post: 'dark', tag: 'Tatuagem', cta: 'Meu estúdio', body: `<div class="aud-emoji">🖤</div><h1>Feito para <span class="hl">estúdios de tatuagem</span>.</h1><p class="sub">Sessões longas, sinal agendado e agenda do artista separada por especialidade.</p>` },
  { file: 'post-21', post: 'light', tag: 'Pet', cta: 'Meu pet shop', body: `<div class="aud-emoji">🐶</div><h1>Feito para <span class="hl">pet shops e banho & tosa</span>.</h1><p class="sub">Tutor agenda pelo celular, você controla banho, tosa e vacina sem caderninho.</p>` },
  { file: 'post-22', post: 'dark', tag: 'Fitness', cta: 'Meus horários', body: `<div class="aud-emoji">🏋️</div><h1>Feito para <span class="hl">personal trainers</span>.</h1><p class="sub">Alunos agendam seus horários, você acompanha presença e recebe lembretes automáticos.</p>` },
  { file: 'post-23', post: 'light', tag: 'Consultórios', cta: 'Minha consulta', body: `<div class="aud-emoji">🩺</div><h1>Feito para <span class="hl">consultórios e terapias</span>.</h1><p class="sub">Consulta com tempo certo, retorno programado e histórico do paciente.</p>` },
  {
    file: 'post-24', post: 'blue', tag: 'Universal', cta: 'Meu serviço',
    body: `<h1>E qualquer serviço com <span class="hl">horário marcado</span>.</h1>
      <p class="sub">Mecânica, espaço de beleza, aulas particulares, tatame, coworking… se tem agenda, é Kalbix.</p>`,
  },
  {
    file: 'post-25', post: 'light', tag: 'Pergunta honesta', cta: 'Atualizar meu negócio',
    body: `<h1>Ainda usa caderno?<br><span class="hl">Seu concorrente, não.</span></h1>
      <p class="sub">Enquanto você confere o caderno, ele recebe agendamento no app — com a marca dele.</p>`,
  },
  {
    file: 'post-26', post: 'dark', tag: 'Provocação', cta: 'Ter meu app',
    body: `${swooshSVG('#2a5fc4', 1000, 0.22)}
      <h1>Seu concorrente já tem app. <span class="hl bluehl">E você?</span></h1>
      <p class="sub">A diferença entre cheio e vazio está na facilidade de marcar um horário.</p>`,
  },
  {
    file: 'post-27', post: 'light', tag: 'Rotina', cta: 'Recuperar meu tempo',
    body: `<div class="aud-emoji">⏰</div>
      <h1>Pare de responder <span class="hl">"tem horário?"</span> o dia inteiro.</h1>
      <p class="sub">O sistema responde, agenda e confirma por você. Seu tempo no acabamento, não no celular.</p>`,
  },
  {
    file: 'post-28', post: 'dark', tag: 'Ocupação', cta: 'Encher minha agenda',
    body: `<div class="bigstat" style="font-size:200px;">0<small> buracos</small></div>
      <h1 style="font-size:82px; margin-top:30px;">A cadeira vazia <span class="hl bluehl">custa caro</span>.</h1>
      <p class="sub">Visualize os horários vagos, reforce o que rende e mantenha a agenda cheia.</p>`,
  },
  {
    file: 'post-29', post: 'light', tag: 'Facilidade', cta: 'Testar agora',
    body: `<h1>Seu cliente agenda em <span class="hl">3 toques</span>.</h1>
      ${check('Escolhe o serviço')}${check('Escolhe o profissional e o horário')}${check('Confirma — e já está na sua agenda')}`,
  },
  {
    file: 'post-30', post: 'dark', tag: 'Kalbix Agenda', cta: 'Falar agora',
    body: `${swooshSVG(BLUE, 1200)}
      <div class="logo-card" style="align-self:flex-start; margin-bottom:50px;"><img src="../assets/logo.png" style="height:120px;"></div>
      <h1>Seu negócio na <span class="hl">agenda certa</span>.</h1>
      <p class="sub">Chame no Instagram ou peça sua demonstração gratuita. Vagas de lançamento limitadas.</p>`,
  },
];

for (const p of posts) {
  const html = page(p.post, p.body, { tag: p.tag, cta: p.cta });
  writeFileSync(join(outDir, `${p.file}.html`), html, 'utf8');
}
console.log(`OK: ${posts.length} HTML posts written to ${outDir}`);

