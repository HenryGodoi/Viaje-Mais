const $ = id => document.getElementById(id), app = $('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quando = i => new Date(i).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const PAPEL = { cliente: 'Viajante', operador: 'Operador de turismo', admin: 'Administrador' };
const CATS = ['Natureza', 'Cultura', 'Vinícola', 'Trilha', 'Gastronomia'];
const ST = { reservada: 'Reservada', usada: 'Usada', cancelada: 'Cancelada', aprovado: 'Publicado', pendente: 'Em análise', ativo: 'Ativo' };
let U, OFFLINE = false, F = { cidade: '', cat: '', q: '' };
// Manda para o login guardando esta tela, para voltar a ela depois de entrar.
const paraLogin = () => location.href = '/entrar.html?ir=' + encodeURIComponent(location.pathname + location.hash);
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const api = async (u, m = 'GET', b) => {
  const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b && JSON.stringify(b) });
  if (r.status === 401) { localStorage.removeItem('vm_user'); paraLogin(); }
  const j = await r.json(); if (!r.ok) throw new Error(j.erro); return j;
};
const erro = (el, e) => { el.textContent = e.message; el.className = 'msg erro'; };
// Todo formulário do painel envia por aqui: o botão fica travado até a resposta chegar.
// Sem isso, um clique duplo reservava ou publicava duas vezes, ou trocava a senha e mostrava erro.
const aoEnviar = (form, acao) => form.onsubmit = async e => {
  e.preventDefault(); const botao = form.querySelector('button');
  if (botao.disabled) return; botao.disabled = true;
  try { await acao(); } finally { botao.disabled = false; }
};
$('sair').onclick = async () => { try { await api('/api/logout', 'POST'); } catch {} localStorage.removeItem('vm_user'); localStorage.removeItem('vm_reservas'); location.href = '/'; };

const ICONE = {
  relogio: '<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M16 9v7l5 3"/></svg>',
  voltar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  ok: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M10 16.5l4 4 8-9"/></svg>',
};

const NAV = { cliente: [['/', 'Ofertas'], ['/reservas', 'Minhas reservas']], operador: [['/', 'Vagas'], ['/passeios', 'Passeios'], ['/validar', 'Validar código']], admin: [] };
const nav = h => { const n = NAV[U.perfil]; return n.length ? `<nav class="nav" aria-label="Seções do painel">${n.map(([r, t]) => `<a href="#${r}" ${h === r || (r === '/reservas' && h.startsWith('/voucher')) || (r === '/' && h.startsWith('/oferta')) ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>` : ''; };
// Monta a tela: faixa verde (título, explicação e abas) + conteúdo branco. Textos já devem vir escapados.
const tela = (h, titulo, lead, html) => {
  const n = h === null ? '' : nav(h);
  $('faixa-w').innerHTML = `<h1>${titulo}</h1>${lead ? `<p>${lead}</p>` : ''}${n}`;
  $('faixa').classList.toggle('sem-abas', !n);
  app.innerHTML = html; document.title = titulo.replace(/<[^>]*>/g, '') + ' · Viaje Mais';
};
const vazio = (t, d = '') => `<div class="vazio"><strong>${t}</strong>${d ? `<p>${d}</p>` : ''}</div>`;
// Foto de perfil ou a inicial do nome. "v" muda a cada troca para o navegador não mostrar a foto antiga.
let fotoV = Date.now();
const avatar = cls => `<span class="${cls}">${U.temFoto ? `<img src="/api/perfil/foto?v=${fotoV}" alt="">` : esc((U.nome || '?').trim()[0].toUpperCase())}</span>`;
const topo = () => { $('nome').textContent = U.nome; $('papel').textContent = PAPEL[U.perfil];
  if (U.perfil === 'cliente') { $('eu').innerHTML = avatar('avatar'); $('eu').hidden = false; } };

/* ---------- VIAJANTE ---------- */
const vagasTxt = o => `${o.livres === 1 ? 'Resta 1 vaga' : `Restam ${o.livres} vagas`} de ${o.vagas}`;
// A barra mostra quanto do horário ainda está vazio: é isso que define o desconto.
const ocupacao = o => `<div class="ocupacao"><div class="barra" aria-hidden="true"><i style="width:${Math.round(100 * o.livres / o.vagas)}%"></i></div><span>${vagasTxt(o)}</span></div>`;
const selo = o => `<div class="selo${o.ultimaHora ? ' ultima' : ''}"><div>${o.desconto ? `<b>${o.desconto}%</b><span>de desconto</span>` : '<span>Preço normal</span>'}</div>${o.ultimaHora ? `<em>${ICONE.relogio}Última hora</em>` : ''}</div>`;
const preco = o => `<p class="preco">${o.desconto ? `<s>${brl(o.precoNormal)}</s>` : ''}<strong>${brl(o.precoFinal)}</strong><small>por pessoa</small></p>`;
const card = o => `<a class="oferta" href="#/oferta/${o.id}">${selo(o)}<div class="corpo"><span class="tag">${esc(o.categoria)}</span><h3>${esc(o.titulo)}</h3><p class="meta">${esc(o.cidade)}<br>${quando(o.inicio)}</p>${preco(o)}${ocupacao(o)}</div></a>`;

async function vOfertas() {
  let l; try { l = await api('/api/ofertas'); } catch (e) { if (e instanceof TypeError) { location.hash = '#/reservas'; return; } throw e; }
  const opt = (arr, sel) => arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  tela('/', 'Vagas de hoje em diante', 'Quanto mais vazio o horário, maior o desconto. Ao reservar, o preço fica travado.',
    `<div class="filtros"><input id="fq" type="search" aria-label="Buscar passeio ou cidade" placeholder="Buscar passeio ou cidade" value="${esc(F.q)}"><select id="fc" aria-label="Cidade"><option value="">Todas as cidades</option>${opt([...new Set(l.map(o => o.cidade))].sort(), F.cidade)}</select>
    <select id="fk" aria-label="Categoria"><option value="">Todas as categorias</option>${opt([...new Set(l.map(o => o.categoria))].sort(), F.cat)}</select></div><div class="grade" id="g"></div>`);
  const show = () => { const v = l.filter(o => (!F.cidade || o.cidade === F.cidade) && (!F.cat || o.categoria === F.cat) && norm(o.titulo + ' ' + o.cidade + ' ' + o.categoria).includes(norm(F.q.trim()))); $('g').innerHTML = v.length ? v.map(card).join('') : (l.length ? vazio('Nenhuma vaga com esses filtros.', 'Troque a busca, a cidade ou a categoria para ver outras vagas.') : vazio('Ainda não há vagas publicadas.', 'Os passeios avisam as vagas que sobram. Volte em breve.')); };
  $('fq').oninput = e => { F.q = e.target.value; show(); };
  $('fc').onchange = e => { F.cidade = e.target.value; show(); }; $('fk').onchange = e => { F.cat = e.target.value; show(); }; show();
}

async function vOferta(id) {
  const o = await api('/api/ofertas/' + id), max = Math.min(o.livres, 10);
  tela('/oferta', esc(o.titulo), `${esc(o.cidade)}, ${quando(o.inicio)}. Oferecido por ${esc(o.operador)}.`,
    `<a class="voltar" href="#/">${ICONE.voltar}Voltar às ofertas</a><div class="det"><div>
    <div class="resumo">${selo(o)}<div class="corpo">${preco(o)}${ocupacao(o)}<p class="nota">Quanto mais vagas sobram, maior o desconto. Reservando agora, você garante este preço.</p></div></div>
    <div class="sobre"><h2>Sobre o passeio</h2><p><span class="tag">${esc(o.categoria)}</span></p><p>${esc(o.descricao) || 'O operador ainda não escreveu uma descrição.'}</p></div></div>
    <form class="caixa" id="r"><h2>Reservar</h2>
    <div><label for="n">Seu nome</label><input id="n" value="${esc(U.nome)}" autocomplete="name" required></div>
    <div><label for="t">Telefone com DDD</label><input id="t" type="tel" autocomplete="tel" placeholder="(55) 99999-9999" value="${esc(U.telefone || '')}" required></div>
    <div><label for="q">Pessoas</label><select id="q">${Array.from({ length: max }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></div>
    <div class="total" id="tot"></div>
    <p class="aviso">O pagamento por Pix entra na próxima etapa. Por enquanto a reserva gera o código para usar no local.</p>
    <div class="msg" id="m" role="alert"></div><button class="btn">Confirmar reserva</button></form></div>`);
  const tot = () => $('tot').textContent = 'Total: ' + brl(o.precoFinal * $('q').value); $('q').onchange = tot; tot();
  aoEnviar($('r'), async () => { $('m').textContent = '';
    try { const r = await api('/api/reservas', 'POST', { ofertaId: o.id, pessoas: +$('q').value, nome: $('n').value, telefone: $('t').value }); await carregarReservas(); location.hash = '#/voucher/' + r.id; }
    catch (x) { erro($('m'), x); } });
}

async function carregarReservas() {
  try { const l = await api('/api/reservas'); localStorage.setItem('vm_reservas', JSON.stringify(l)); return l; }
  catch (e) { if (!(e instanceof TypeError)) throw e; OFFLINE = true; return JSON.parse(localStorage.getItem('vm_reservas') || '[]'); }
}
async function vReservas() {
  const l = await carregarReservas();
  tela('/reservas', 'Minhas reservas', 'Toque em uma reserva para ver o código.',
    (OFFLINE ? '<p class="aviso" style="margin-bottom:20px">Sem internet: mostrando as reservas salvas neste aparelho. Seus códigos continuam valendo.</p>' : '') +
    (l.length ? `<div class="lista">${l.map(r => `<a href="#/voucher/${r.id}"><div class="principal"><strong>${esc(r.titulo)}</strong><p class="meta">${esc(r.cidade)}, ${quando(r.inicio)}</p></div><div class="fim"><span class="tag ${r.status}">${ST[r.status]}</span><div class="valor">${brl(r.total)}<small>${r.pessoas} pessoa(s)</small></div></div></a>`).join('')}</div>`
      : vazio('Você ainda não fez reservas.', 'Veja as <a href="#/">ofertas</a> e reserve uma vaga com desconto.')));
}
async function vVoucher(id) {
  const r = (await carregarReservas()).find(x => x.id === +id);
  if (!r) { location.hash = '#/reservas'; return; }
  tela('/voucher', 'Seu voucher', 'Mostre este código no local. Ele fica salvo neste aparelho e funciona sem internet.',
    `<a class="voltar" href="#/reservas">${ICONE.voltar}Minhas reservas</a>
    <article class="ingresso ${r.status}"><header><span class="tag ${r.status}">${ST[r.status]}</span><h2>${esc(r.titulo)}</h2><p>${esc(r.cidade)}, ${quando(r.inicio)}</p></header>
    <div class="corte" aria-hidden="true"></div>
    <div class="ing-corpo"><p class="rotulo" id="rot">Código da reserva</p><div class="codigo" aria-labelledby="rot">${esc(r.codigo)}</div>
    <dl><div><dt>Pessoas</dt><dd>${r.pessoas}</dd></div><div><dt>Em nome de</dt><dd>${esc(r.nome)}</dd></div><div><dt>Total</dt><dd>${brl(r.total)}</dd></div></dl>
    <p class="meta">Preço com ${r.desconto}% de desconto, travado no momento da reserva.</p>
    <div class="msg" id="m" role="alert"></div>
    ${r.status === 'reservada' && !OFFLINE ? '<button class="btn sec" id="c">Cancelar reserva</button>' : ''}</div></article>`);
  const c = $('c'); if (c) c.onclick = async () => { if (!confirm('Cancelar esta reserva?')) return; try { await api(`/api/reservas/${r.id}/cancelar`, 'POST'); await carregarReservas(); vVoucher(id); } catch (x) { erro($('m'), x); } };
}

/* ---------- PERFIL DO VIAJANTE ---------- */
// Corta a imagem no centro em 320x320 e salva como JPEG: a foto fica pequena (~30 KB) antes de ir para o servidor.
const reduzir = f => new Promise((ok, falha) => {
  const img = new Image();
  img.onload = () => { const t = 320, c = document.createElement('canvas'), s = Math.min(img.width, img.height); c.width = c.height = t;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, t, t); URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', .85)); };
  img.onerror = () => falha(new Error('Não foi possível abrir essa imagem. Use JPG, PNG ou WebP.'));
  img.src = URL.createObjectURL(f);
});
const msgOk = (el, t) => { el.textContent = t; el.className = 'msg ok'; };

async function vPerfil() {
  const l = await carregarReservas();
  // Histórico: o que já aconteceu (usadas, canceladas ou com horário passado). As ativas ficam em "Minhas reservas".
  const hist = l.filter(r => r.status !== 'reservada' || new Date(r.inicio) < Date.now());
  const feitos = l.filter(r => r.status === 'usada').length;
  const economia = l.filter(r => r.status !== 'cancelada' && r.desconto > 0 && r.desconto < 100).reduce((s, r) => s + (r.precoUnit / (1 - r.desconto / 100) - r.precoUnit) * r.pessoas, 0);
  // O perfil é uma área à parte: sem as abas de ofertas e reservas. Chega-se a ele pela foto no topo ou pelo "Meu painel" da home.
  tela(null, 'Meu perfil', 'Seus dados, sua senha e os passeios que você já fez.', `<div class="perfil">
  <aside class="cartao-perfil">${avatar('avatar grande')}<h2>${esc(U.nome)}</h2><p class="meta">${esc(U.email)}</p>
    <input id="foto" type="file" accept="image/jpeg,image/png,image/webp" class="sr"><label class="btn sec peq" for="foto">${U.temFoto ? 'Trocar foto' : 'Adicionar foto'}</label>
    ${U.temFoto ? '<button class="link" id="sem-foto" type="button">Remover foto</button>' : ''}<div class="msg" id="mf" role="alert"></div>
    <dl class="numeros"><div><dt>Passeios feitos</dt><dd>${feitos}</dd></div><div><dt>Economia com descontos</dt><dd>${brl(economia)}</dd></div></dl></aside>
  <div class="perfil-secoes">
    <section class="secao"><h2>Histórico</h2>${hist.length ? `<div class="lista">${hist.map(r => `<a href="#/voucher/${r.id}"><div class="principal"><strong>${esc(r.titulo)}</strong><p class="meta">${esc(r.cidade)}, ${quando(r.inicio)}</p></div><div class="fim"><span class="tag ${r.status}">${ST[r.status]}</span><div class="valor">${brl(r.total)}<small>${r.pessoas} pessoa(s)</small></div></div></a>`).join('')}</div>`
      : vazio('Seu histórico aparece aqui depois do primeiro passeio.')}</section>
    <form class="caixa secao" id="fd"><h2>Dados pessoais</h2>
      <div><label for="pn">Nome completo</label><input id="pn" value="${esc(U.nome)}" autocomplete="name" required></div>
      <div><label for="pe">E-mail</label><input id="pe" value="${esc(U.email)}" disabled><p class="nota">O e-mail é o seu login e não pode ser trocado por aqui.</p></div>
      <div><label for="pt">Telefone com DDD</label><input id="pt" type="tel" value="${esc(U.telefone || '')}" autocomplete="tel" placeholder="(55) 99999-9999"><p class="nota">Já vem preenchido quando você reservar.</p></div>
      <div class="msg" id="md" role="alert"></div><button class="btn">Salvar dados</button></form>
    <form class="caixa secao" id="fs"><h2>Trocar senha</h2>
      <div><label for="sa">Senha atual</label><input id="sa" type="password" autocomplete="current-password" required></div>
      <div><label for="sn">Nova senha</label><input id="sn" type="password" autocomplete="new-password" minlength="8" required><p class="nota">Pelo menos 8 caracteres. Você continua conectado aqui e sai dos outros aparelhos.</p></div>
      <div><label for="sc">Repita a nova senha</label><input id="sc" type="password" autocomplete="new-password" required></div>
      <div class="msg" id="ms" role="alert"></div><button class="btn">Trocar senha</button></form>
    <form class="caixa secao zona-perigo" id="fx"><h2>Excluir conta</h2>
      <p class="nota">Apaga sua conta, seus dados e sua foto. Os passeios que você já fez continuam no registro do operador, sem seu nome e telefone. Reservas ativas precisam ser canceladas antes. Não dá para desfazer.</p>
      <div><label for="xs">Digite sua senha para confirmar</label><input id="xs" type="password" autocomplete="current-password" required></div>
      <div class="msg" id="mx" role="alert"></div><button class="btn perigo">Excluir minha conta</button></form>
  </div></div>`);

  const salvarFoto = async foto => { try { const r = await api('/api/perfil/foto', 'POST', { foto }); U.temFoto = r.temFoto; fotoV = Date.now(); localStorage.setItem('vm_user', JSON.stringify(U)); topo(); vPerfil(); } catch (x) { erro($('mf'), x); } };
  $('foto').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { salvarFoto(await reduzir(f)); } catch (x) { erro($('mf'), x); } };
  const sf = $('sem-foto'); if (sf) sf.onclick = () => salvarFoto(null);
  aoEnviar($('fd'), async () => {
    try { const r = await api('/api/perfil', 'POST', { nome: $('pn').value, telefone: $('pt').value }); Object.assign(U, { nome: r.nome, telefone: r.telefone }); localStorage.setItem('vm_user', JSON.stringify(U)); topo(); msgOk($('md'), 'Dados salvos.'); }
    catch (x) { erro($('md'), x); } });
  aoEnviar($('fs'), async () => {
    try { await api('/api/perfil/senha', 'POST', { atual: $('sa').value, nova: $('sn').value, confirmar: $('sc').value }); $('fs').reset(); msgOk($('ms'), 'Senha trocada.'); }
    catch (x) { erro($('ms'), x); } });
  aoEnviar($('fx'), async () => { if (!confirm('Excluir sua conta para sempre?')) return;
    try { await api('/api/perfil', 'DELETE', { senha: $('xs').value }); localStorage.removeItem('vm_user'); localStorage.removeItem('vm_reservas'); location.href = '/'; }
    catch (x) { erro($('mx'), x); } });
}

/* ---------- OPERADOR ---------- */
async function vVagas() {
  const [of, ps] = await Promise.all([api('/api/operador/ofertas'), api('/api/operador/passeios')]), ok = ps.filter(p => p.status === 'aprovado');
  tela('/', 'Publicar vagas', 'Avise as vagas que sobraram. O desconto sobe sozinho conforme o horário fica mais vazio.', `<div class="duas">
  ${ok.length ? `<form class="caixa" id="f"><h2>Nova oferta</h2><div><label for="p">Passeio</label><select id="p">${ok.map(p => `<option value="${p.id}">${esc(p.titulo)}</option>`).join('')}</select></div>
    <div><label for="i">Data e hora</label><input id="i" type="datetime-local" required></div><div><label for="v">Vagas disponíveis</label><input id="v" type="number" min="1" max="200" value="10" required></div>
    <div><label for="d">Desconto máximo (%)</label><input id="d" type="number" min="0" max="90" value="50" required></div><div class="msg" id="m" role="alert"></div><button class="btn">Publicar vagas</button></form>`
  : vazio('Você ainda não tem passeio aprovado.', 'Cadastre um na aba <a href="#/passeios">Passeios</a> e aguarde o administrador aprovar.')}
  <section><h2>Suas ofertas</h2>${of.length ? `<ul class="lista">${of.map(o => `<li><div class="principal"><strong>${esc(o.titulo)}</strong><p class="meta">${quando(o.inicio)}</p>${new Date(o.inicio) < Date.now() ? '' : ocupacao(o)}</div><div class="fim">${new Date(o.inicio) < Date.now() ? '<span class="tag cancelada">Encerrada</span>' : o.desconto ? `<span class="agora"><b>${o.desconto}%</b> agora</span>` : '<span class="agora">Preço normal</span>'}</div></li>`).join('')}</ul>`
    : vazio('Nenhuma oferta publicada ainda.', ok.length ? 'Preencha o formulário ao lado para avisar as vagas que sobraram.' : '')}</section></div>`);
  const f = $('f'); if (f) aoEnviar(f, async () => { try { await api('/api/operador/ofertas', 'POST', { passeioId: $('p').value, inicio: new Date($('i').value).toISOString(), vagas: +$('v').value, descontoMax: +$('d').value }); vVagas(); } catch (x) { erro($('m'), x); } });
}
async function vPasseios() {
  const l = await api('/api/operador/passeios');
  tela('/passeios', 'Meus passeios', 'Novos passeios aparecem para os viajantes depois que o administrador aprova.', `<div class="duas"><form class="caixa" id="n"><h2>Novo passeio</h2>
    <div><label for="t">Título</label><input id="t" required></div><div><label for="c">Cidade</label><input id="c" required></div>
    <div><label for="k">Categoria</label><select id="k">${CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
    <div><label for="p">Preço normal (R$)</label><input id="p" type="number" min="0" step="0.01" required></div><div><label for="d">Descrição</label><textarea id="d" rows="3"></textarea></div>
    <div class="msg" id="m" role="alert"></div><button class="btn">Enviar para aprovação</button></form>
    <section><h2>Seus passeios</h2>${l.length ? `<ul class="lista">${l.map(p => `<li class="${p.status === 'pendente' ? 'pendente' : ''}"><div class="principal"><strong>${esc(p.titulo)}</strong><p class="meta">${esc(p.cidade)}, ${esc(p.categoria || 'Natureza')}</p></div><div class="fim"><span class="tag ${p.status}">${ST[p.status]}</span><div class="valor">${brl(p.preco)}</div><button class="btn peq perigo" data-del="${p.id}">Excluir</button></div></li>`).join('')}</ul>`
      : vazio('Você ainda não cadastrou passeios.', 'Use o formulário ao lado. O administrador aprova antes de aparecer para os viajantes.')}</section></div>`);
  aoEnviar($('n'), async () => { try { await api('/api/operador/passeios', 'POST', { titulo: $('t').value, cidade: $('c').value, categoria: $('k').value, preco: $('p').value, descricao: $('d').value }); vPasseios(); } catch (x) { erro($('m'), x); } });
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { try { await api('/api/operador/passeios/' + b.dataset.del, 'DELETE'); vPasseios(); } catch (x) { alert(x.message); } });
}
function vValidar() {
  tela('/validar', 'Validar código', 'Digite o código que o turista mostrar no local. Cada código vale uma vez.',
    `<div class="duas"><form class="caixa" id="v"><div><label for="c">Código da reserva</label><input id="c" class="codigo-input" autocomplete="off" autocapitalize="characters" required></div><div class="msg" id="m" role="alert"></div><button class="btn">Validar</button></form><div id="res" aria-live="polite"></div></div>`);
  aoEnviar($('v'), async () => { $('m').textContent = ''; $('res').innerHTML = '';
    try { const r = await api('/api/operador/validar', 'POST', { codigo: $('c').value });
      $('res').innerHTML = `<div class="resultado">${ICONE.ok}<div><strong>Código válido</strong><p>${r.pessoas} pessoa(s) em nome de <b>${esc(r.nome)}</b></p><p class="meta">${esc(r.titulo)}, ${quando(r.inicio)}</p></div></div>`; $('c').value = ''; }
    catch (x) { erro($('m'), x); } });
}

/* ---------- ADMIN ---------- */
async function vAdmin() {
  const [us, ps] = await Promise.all([api('/api/admin/usuarios'), api('/api/admin/passeios')]);
  const nu = us.filter(u => u.status === 'pendente').length, np = ps.filter(p => p.status === 'pendente').length;
  tela(null, 'Painel do administrador', nu || np ? `${nu} operador(es) e ${np} passeio(s) aguardando aprovação.` : 'Nada aguardando aprovação.', `
  <section class="secao"><h2>Usuários</h2><ul class="lista">${us.map(u => `<li class="${u.status === 'pendente' ? 'pendente' : ''}"><div class="principal"><strong>${esc(u.nome)}</strong><p class="meta">${esc(u.email)}, ${PAPEL[u.perfil]}</p></div><div class="fim"><span class="tag ${u.status}">${ST[u.status]}</span><div class="acoes">${u.status === 'pendente' ? `<button class="btn peq" data-u="${u.id}">Aprovar</button>` : ''}${u.perfil !== 'admin' ? `<button class="btn peq perigo" data-ru="${u.id}">Remover</button>` : ''}</div></div></li>`).join('')}</ul></section>
  <section class="secao"><h2>Passeios</h2>${ps.length ? `<ul class="lista">${ps.map(p => `<li class="${p.status === 'pendente' ? 'pendente' : ''}"><div class="principal"><strong>${esc(p.titulo)}</strong><p class="meta">${esc(p.cidade)}, por ${esc(p.operador)}</p></div><div class="fim"><span class="tag ${p.status}">${ST[p.status]}</span><div class="valor">${brl(p.preco)}</div>${p.status === 'pendente' ? `<button class="btn peq" data-p="${p.id}">Aprovar</button>` : ''}</div></li>`).join('')}</ul>` : vazio('Nenhum passeio cadastrado ainda.')}</section>`);
  const go = (sel, url, m) => app.querySelectorAll(sel).forEach(b => b.onclick = async () => { if (m === 'DELETE' && !confirm('Remover este usuário?')) return; await api(url(b), m); vAdmin(); });
  go('[data-u]', b => `/api/admin/usuarios/${b.dataset.u}/aprovar`, 'POST'); go('[data-ru]', b => `/api/admin/usuarios/${b.dataset.ru}`, 'DELETE'); go('[data-p]', b => `/api/admin/passeios/${b.dataset.p}/aprovar`, 'POST');
}

/* ---------- ROTAS ---------- */
async function rota() {
  // A home manda a busca no endereço: #/?busca=Nova%20Palma
  const [h, qs] = (location.hash.slice(1) || '/').split('?'), [, a, id] = h.split('/');
  if (qs) F.q = new URLSearchParams(qs).get('busca') || '';
  try {
    if (U.perfil === 'admin') return await vAdmin();
    if (U.perfil === 'operador') return await ({ '': vVagas, passeios: vPasseios, validar: vValidar }[a || ''] || vVagas)();
    if (OFFLINE && !['reservas', 'voucher'].includes(a)) return location.hash = '#/reservas';
    if (a === 'oferta') return await vOferta(id); if (a === 'reservas') return await vReservas(); if (a === 'voucher') return await vVoucher(id);
    if (a === 'perfil') return await vPerfil();
    await vOfertas();
  } catch (e) { tela(null, 'Não foi possível abrir esta tela', '', vazio(e instanceof TypeError ? 'Sem conexão com o servidor.' : esc(e.message), 'Confira a internet e tente de novo.')); }
}
(async () => {
  try { U = await api('/api/me'); localStorage.setItem('vm_user', JSON.stringify(U)); }
  catch (e) { if (e instanceof TypeError) { U = JSON.parse(localStorage.getItem('vm_user') || 'null'); OFFLINE = !!U; } }
  if (!U) { paraLogin(); return; }
  topo();
  addEventListener('hashchange', rota); rota();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
})();
