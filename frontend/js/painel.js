const $ = id => document.getElementById(id), app = $('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quando = i => new Date(i).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
// 90 -> "1 h 30 min", 60 -> "1 h", 45 -> "45 min"
const duracao = m => !m ? '' : m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
const PAPEL = { cliente: 'Viajante', operador: 'Operador de turismo', admin: 'Administrador' };
const ST = { reservada: 'Reservada', usada: 'Usada', no_show: 'Não compareceu', cancelada: 'Cancelada' };
// Operador e admin usam os painéis do Dashboard, entregues pelo mesmo servidor (o login vale lá).
const PAINEL = { operador: '/operador/', admin: '/admin/' };
// Telas que só existem com login. As ofertas (#/ e #/oferta/ID) abrem sem conta: o login é pedido só para reservar.
const PRIVADAS = ['reservas', 'voucher', 'perfil'];
let U = null, OFFLINE = false, F = { cidade: '', cat: '', q: '' };
// Endereço do login guardando esta tela, para voltar a ela depois de entrar.
const loginUrl = () => '/entrar.html?ir=' + encodeURIComponent(location.pathname + location.hash);
const paraLogin = () => location.href = loginUrl();
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const api = async (u, m = 'GET', b) => {
  const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b && JSON.stringify(b) });
  if (r.status === 401) { localStorage.removeItem('vm_user'); paraLogin(); }
  const j = await r.json(); if (!r.ok) { const e = new Error(j.erro); e.status = r.status; throw e; } return j;
};
const erro = (el, e) => { el.textContent = e.message; el.className = 'msg erro'; };
const msgOk = (el, t) => { el.textContent = t; el.className = 'msg ok'; };
// Todo formulário do painel envia por aqui: o botão fica travado até a resposta chegar.
// Sem isso, um clique duplo reservava ou publicava duas vezes, ou trocava a senha e mostrava erro.
const aoEnviar = (form, acao) => form.onsubmit = async e => {
  e.preventDefault(); const botao = form.querySelector('button');
  if (botao.disabled) return; botao.disabled = true; botao.classList.add('carregando');
  try { await acao(); } finally { botao.disabled = false; botao.classList.remove('carregando'); }
};
const CARREGANDO = '<p class="carregando-tela" role="status"><span class="spinner" aria-hidden="true"></span>Carregando…</p>';
$('sair').onclick = async () => { try { await api('/api/logout', 'POST'); } catch {} localStorage.removeItem('vm_user'); localStorage.removeItem('vm_reservas'); location.href = '/'; };

const ICONE = {
  relogio: '<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M16 9v7l5 3"/></svg>',
  voltar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  logo: '<img src="/img/icone-branco.png" alt="">',
};

const NAV = [['/', 'Ofertas'], ['/reservas', 'Minhas reservas']];
const nav = h => `<nav class="nav" aria-label="Seções do painel">${NAV.map(([r, t]) => `<a href="#${r}" ${h === r || (r === '/reservas' && h.startsWith('/voucher')) || (r === '/' && h.startsWith('/oferta')) ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
// Monta a tela: faixa escura (título, explicação e abas) + conteúdo. Textos já devem vir escapados.
const tela = (h, titulo, lead, html) => {
  const n = h === null ? '' : nav(h);
  $('faixa-w').innerHTML = `<h1>${titulo}</h1>${lead ? `<p>${lead}</p>` : ''}${n}`;
  $('faixa').classList.toggle('sem-abas', !n);
  app.innerHTML = html; document.title = 'Viaje Mais Experiências - ' + titulo.replace(/<[^>]*>/g, '');
};
const vazio = (t, d = '') => `<div class="vazio"><strong>${t}</strong>${d ? `<p>${d}</p>` : ''}</div>`;
// Primeira letra do nome. Array.from conta emoji e acento como uma letra só (o [0] pegava meio emoji e virava "�").
const inicial = n => esc((Array.from(String(n || '').trim())[0] || '?').toUpperCase());
// Foto de perfil ou a inicial do nome. "v" muda a cada troca para o navegador não mostrar a foto antiga.
let fotoV = Date.now();
const avatar = cls => `<span class="${cls}">${U.temFoto ? `<img src="/api/perfil/foto?v=${fotoV}" alt="">` : inicial(U.nome)}</span>`;
const topo = () => {
  $('entrar').hidden = !!U; $('sair').hidden = !U; $('papel').hidden = !U; $('eu').hidden = true;
  if (!U) { $('entrar').href = loginUrl(); $('nome').textContent = ''; $('papel').textContent = ''; return; }
  $('nome').textContent = U.nome; $('papel').textContent = PAPEL[U.perfil];
  if (U.perfil === 'cliente') { $('eu').innerHTML = avatar('avatar'); $('eu').hidden = false; }
};

/* ---------- OFERTAS (abrem sem login) ---------- */
const vagasTxt = o => `${o.livres === 1 ? 'Resta 1 vaga' : `Restam ${o.livres} vagas`} de ${o.vagas}`;
// A barra mostra quanto do horário ainda está vazio: é isso que define o desconto.
const ocupacao = o => `<div class="ocupacao"><div class="barra" aria-hidden="true"><i style="width:${Math.round(100 * o.livres / o.vagas)}%"></i></div><span>${vagasTxt(o)}</span></div>`;
const selo = o => `<div class="selo"><div>${o.desconto ? `<b>${o.desconto}%</b><span>de desconto</span>` : '<span>Preço normal</span>'}</div>${o.ultimaHora ? `<em>${ICONE.relogio}Última hora</em>` : ''}</div>`;
const preco = o => `<p class="preco">${o.desconto ? `<s>${brl(o.precoNormal)}</s>` : ''}<strong>${brl(o.precoFinal)}</strong><small>por pessoa</small></p>`;
const foto = o => o.fotos?.length ? `<img class="foto" src="${esc(o.fotos[0])}" alt="${esc(o.titulo)}" loading="lazy">` : '';
const estrela = o => o.nota != null ? `<p class="estrela" aria-label="Nota ${o.nota} de 5, ${o.avaliacoes} avaliação(ões)">★ ${Number(o.nota).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} <small>(${o.avaliacoes})</small></p>` : '';
// O destaque é pago pelo parceiro: o selo diz que é anúncio.
const tags = o => `<div class="tags"><span class="tag">${esc(o.categoria)}</span>${o.destaque ? '<span class="tag anuncio">Destaque · anúncio</span>' : ''}${o.acessivel ? '<span class="tag acesso">Acessível</span>' : ''}</div>`;
const card = o => `<a class="oferta" href="#/oferta/${o.id}">${foto(o)}${selo(o)}<div class="corpo">${tags(o)}<h3>${esc(o.titulo)}</h3><p class="meta">${esc(o.cidade)}<br>${quando(o.inicio)}${o.duracaoMin ? ` · ${duracao(o.duracaoMin)}` : ''}</p>${estrela(o)}${preco(o)}${ocupacao(o)}</div></a>`;

async function vOfertas() {
  let l; try { l = await api('/api/ofertas'); } catch (e) { if (e instanceof TypeError && U) { location.hash = '#/reservas'; return; } throw e; }
  const opt = (arr, sel) => arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  tela('/', 'Vagas de hoje em diante', 'Quanto mais vazio o horário, maior o desconto. Ao reservar, o preço fica travado.',
    `<div class="filtros"><input id="fq" type="search" aria-label="Buscar passeio ou cidade" placeholder="Buscar passeio ou cidade" value="${esc(F.q)}"><select id="fc" aria-label="Cidade"><option value="">Todas as cidades</option>${opt([...new Set(l.map(o => o.cidade))].sort(), F.cidade)}</select>
    <select id="fk" aria-label="Categoria"><option value="">Todas as categorias</option>${opt([...new Set(l.map(o => o.categoria))].sort(), F.cat)}</select></div><div class="grade" id="g"></div>`);
  const show = () => { const v = l.filter(o => (!F.cidade || o.cidade === F.cidade) && (!F.cat || o.categoria === F.cat) && norm(o.titulo + ' ' + o.cidade + ' ' + o.categoria).includes(norm(F.q.trim()))); $('g').innerHTML = v.length ? v.map(card).join('') : (l.length ? vazio('Nenhuma vaga com esses filtros.', 'Troque a busca, a cidade ou a categoria para ver outras vagas.') : vazio('Ainda não há vagas publicadas.', 'Os passeios avisam as vagas que sobram. Volte em breve.')); };
  $('fq').oninput = e => { F.q = e.target.value; show(); };
  $('fc').onchange = e => { F.cidade = e.target.value; show(); }; $('fk').onchange = e => { F.cat = e.target.value; show(); }; show();
}

const mapaUrl = o => o.lat != null && o.lng != null ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}` : '';
const linkMapa = o => mapaUrl(o) ? `<a href="${mapaUrl(o)}" target="_blank" rel="noopener">Abrir no mapa</a>` : '';
const lista = a => a?.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
// "O que saber": os detalhes que o operador preenche no painel. Campo vazio vem null e a linha some.
const saber = o => {
  const li = (rot, val) => val ? `<div><dt>${rot}</dt><dd>${val}</dd></div>` : '';
  const local = o.pontoEncontro || mapaUrl(o) ? `${esc(o.pontoEncontro || 'Local do passeio')} ${linkMapa(o)}` : '';
  const itens = li('Duração', duracao(o.duracaoMin)) + li('Ponto de encontro', local) + li('O que inclui', lista(o.inclui)) + li('O que levar', lista(o.levar))
    + li('Idiomas', o.idiomas?.length ? esc(o.idiomas.join(', ')) : '') + li('Acessibilidade', esc(o.acessibilidade)) + li('Responsável', esc(o.responsavel));
  return itens ? `<div class="saber"><h2>O que saber</h2><dl>${itens}</dl></div>` : '';
};
const sobreParceiro = p => p ? `<div class="sobre"><h2>Sobre o parceiro</h2><div class="sobre-parceiro">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : `<span class="avatar">${inicial(p.nome)}</span>`}<div><strong>${esc(p.nome)}</strong><p class="meta">${esc(p.categoria)}${p.cidade ? ` · ${esc(p.cidade)}` : ''}</p></div></div></div>` : '';
// O prazo de cancelar é escolhido pelo parceiro (3, 12, 24 ou 48 h) e o servidor segue o mesmo número.
const regraCancelar = (h, obs) => h ? `<p class="regra"><strong>Cancelamento grátis até ${h} h antes.</strong>${obs ? `<span class="nota">${esc(obs)}</span>` : ''}</p>` : '';
const PAGAMENTO = '<p class="aviso">Você paga no local, direto ao parceiro. A reserva garante a vaga e o preço.</p>';
const fechado = (msg, link, txt) => `<div class="caixa"><h2>Reservar</h2><p class="aviso">${msg}</p><a class="btn sec" href="${link}">${txt}</a></div>`;

// A caixa ao lado da oferta muda conforme o caso: saiu do ar, esgotada, já começou, sem login ou o formulário de reserva.
const caixaReserva = o => {
  if (o.fechada) {
    const minha = JSON.parse(localStorage.getItem('vm_reservas') || '[]').find(r => r.ofertaId === o.id);
    if (minha?.status === 'cancelada') return fechado('Este passeio saiu do ar e a sua reserva foi cancelada. Não há nada a pagar.', '#/', 'Ver outras vagas');
    return fechado('Fechado para novas reservas. A sua continua valendo.', minha ? `#/voucher/${minha.id}` : '#/reservas', 'Ver minha reserva');
  }
  if (new Date(o.inicio) < Date.now()) return fechado('Este passeio já começou.', '#/', 'Ver outras vagas');
  if (o.livres <= 0) return fechado('Esgotado: as vagas acabaram.', '#/', 'Ver outras vagas');
  const regra = regraCancelar(o.horasCancelar, o.obsCancelamento);
  if (!U) return `<div class="caixa"><h2>Reservar</h2><div class="total">${brl(o.precoFinal)} por pessoa</div>${regra}${PAGAMENTO}
    <a class="btn" href="${loginUrl()}">Entrar para reservar</a><p class="nota">Ainda não tem conta? <a href="${loginUrl().replace('?ir=', '?ir=').replace('/entrar.html', '/entrar.html') + '#criar'}">Criar conta</a> leva um minuto.</p></div>`;
  return `<form class="caixa" id="r"><h2>Reservar</h2>
    <div><label for="n">Seu nome</label><input id="n" value="${esc(U.nome)}" autocomplete="name" maxlength="80" required></div>
    <div><label for="t">Telefone com DDD</label><input id="t" type="tel" autocomplete="tel" placeholder="(55) 99999-9999" value="${esc(U.telefone || '')}" required></div>
    <div><label for="q">Pessoas</label><select id="q">${Array.from({ length: Math.min(o.livres, 10) }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></div>
    <div><label for="ob">Observações (opcional)</label><textarea id="ob" rows="2" maxlength="300" placeholder="Ex.: vou com criança de colo"></textarea></div>
    <div class="total" id="tot"></div>${regra}${PAGAMENTO}
    <p class="nota">O parceiro vê seu nome e telefone no dia do passeio, para receber você.</p>
    <div class="msg" id="m" role="alert"></div><button class="btn">Confirmar reserva</button></form>`;
};

async function vOferta(id) {
  let o; try { o = await api('/api/ofertas/' + id); }
  catch (e) { if (e.status !== 404) throw e; return tela('/oferta', 'Passeio indisponível', '', `<a class="voltar" href="#/">${ICONE.voltar}Voltar às ofertas</a>${vazio('Este passeio não está mais disponível.', 'Veja as <a href="#/">outras vagas</a> da região.')}`); }
  tela('/oferta', esc(o.titulo), `${esc(o.cidade)}, ${quando(o.inicio)}${o.duracaoMin ? ` · ${duracao(o.duracaoMin)}` : ''}${o.parceiro ? '' : `. Oferecido por ${esc(o.operador)}.`}`,
    `<a class="voltar" href="#/">${ICONE.voltar}Voltar às ofertas</a><div class="det"><div>
    <div class="resumo">${selo(o)}<div class="corpo">${preco(o)}${estrela(o)}${ocupacao(o)}<p class="nota">Quanto mais vagas sobram, maior o desconto. Reservando agora, você garante este preço.</p></div></div>
    ${o.fotos?.length ? `<div class="galeria">${o.fotos.map(f => `<img src="${esc(f)}" alt="${esc(o.titulo)}" loading="lazy">`).join('')}</div>` : ''}
    <div class="sobre"><h2>Sobre o passeio</h2><p>${tags(o)}</p><p>${esc(o.descricao) || 'O operador ainda não escreveu uma descrição.'}</p></div>
    ${saber(o)}${sobreParceiro(o.parceiro)}</div>${caixaReserva(o)}</div>`);
  const f = $('r'); if (!f) return;
  const tot = () => $('tot').textContent = 'Total: ' + brl(o.precoFinal * $('q').value); $('q').onchange = tot; tot();
  aoEnviar(f, async () => { $('m').textContent = '';
    try { const r = await api('/api/reservas', 'POST', { ofertaId: o.id, pessoas: +$('q').value, nome: $('n').value, telefone: $('t').value, observacoes: $('ob').value }); await carregarReservas(); location.hash = '#/voucher/' + r.id; }
    catch (x) { erro($('m'), x); } });
}

/* ---------- RESERVAS E VOUCHER ---------- */
async function carregarReservas() {
  try { const l = await api('/api/reservas'); localStorage.setItem('vm_reservas', JSON.stringify(l)); OFFLINE = false; return l; }
  catch (e) { if (!(e instanceof TypeError)) throw e; OFFLINE = true; return JSON.parse(localStorage.getItem('vm_reservas') || '[]'); }
}
// Avisos da reserva (cancelada, remarcada, voucher novo, mensagem). Os já lidos ficam guardados no aparelho pelo id.
const vistos = () => new Set(JSON.parse(localStorage.getItem('vm_avisos') || '[]'));
const novos = r => (r.avisos || []).filter(a => !vistos().has(a.id));
const marcarVistos = r => { const v = vistos(); (r.avisos || []).forEach(a => v.add(a.id)); localStorage.setItem('vm_avisos', JSON.stringify([...v])); };
const linhaReserva = r => `<a href="#/voucher/${r.id}"><div class="principal"><strong>${esc(r.titulo)}</strong><p class="meta">${esc(r.cidade)}, ${quando(r.inicio)}</p></div><div class="fim">${novos(r).length ? '<span class="tag mudou">Sua reserva mudou</span>' : ''}<span class="tag ${r.status}">${ST[r.status]}</span><div class="valor">${brl(r.total)}<small>${pessoasTxt(r)}</small></div></div></a>`;
// "4 reservadas, 3 foram" quando o parceiro anotou quantas pessoas chegaram.
const pessoasTxt = r => r.status === 'usada' && r.pessoasChegaram != null && r.pessoasChegaram !== r.pessoas ? `${r.pessoas} reservada(s), ${r.pessoasChegaram} foram` : `${r.pessoas} pessoa(s)`;

async function vReservas() {
  const l = await carregarReservas();
  tela('/reservas', 'Minhas reservas', 'Toque em uma reserva para ver o código.',
    (OFFLINE ? '<p class="aviso" style="margin-bottom:20px">Sem internet: mostrando as reservas salvas neste aparelho. Seus códigos continuam valendo.</p>' : '') +
    (l.length ? `<div class="lista">${l.map(linhaReserva).join('')}</div>` : vazio('Você ainda não fez reservas.', 'Veja as <a href="#/">ofertas</a> e reserve uma vaga com desconto.')));
}
// QR code desenhado aqui mesmo (js/qrcode.js): funciona sem internet. Leva o voucher assinado (r.qr, ~300 letras);
// correção 'L' deixa o desenho menor e mais fácil de ler na tela do celular.
const qrSvg = t => { const q = qrcode(0, 'L'); q.addData(t); q.make(); return q.createSvgTag({ cellSize: 4, scalable: true }); };
// Cartão que inclina seguindo o mouse ou o dedo, até 10° para cada lado, e cresce 5% (como o TiltCard da Spell UI).
const inclinar = el => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.onpointermove = e => { const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
    el.style.transform = `rotateX(${(-y * 20).toFixed(1)}deg) rotateY(${(x * 20).toFixed(1)}deg) scale(1.05)`; };
  el.onpointerleave = el.onpointercancel = () => el.style.transform = '';
};
const avisoHtml = (a, r, novo) => {
  let extra = '';
  if (a.tipo === 'remarcada' && a.deData && a.paraData) extra = `<br>De ${quando(a.deData)} para <strong>${quando(a.paraData)}</strong>.`;
  if (a.tipo === 'voucher_reemitido') extra = '<br>O QR code antigo não vale mais: use o que está no cartão.';
  if (a.tipo === 'cancelada' || a.tipo === 'saida_cancelada') extra = `<br><a href="#/?busca=${encodeURIComponent(r.titulo)}">Ver outros horários deste passeio</a>`;
  return `<p class="aviso${novo ? ' novo' : ''}">${a.assunto ? `<strong>${esc(a.assunto)}</strong><br>` : ''}${esc(a.texto)}${extra}<time datetime="${esc(a.quando)}">${quando(a.quando)}</time></p>`;
};
async function vVoucher(id) {
  const r = (await carregarReservas()).find(x => x.id === +id);
  if (!r) { location.hash = '#/reservas'; return; }
  const qr = qrSvg(r.qr || r.codigo), ativa = r.status === 'reservada', avaliar = r.status === 'usada' && !r.avaliada && !OFFLINE;
  const avisos = r.avisos || [], naoVistos = new Set(novos(r).map(a => a.id)), horas = r.horasCancelar ?? 3;
  const podeCancelar = ativa && Date.now() < new Date(r.inicio) - horas * 36e5;
  const tel = (r.telefoneParceiro || '').replace(/\D/g, '');
  tela('/voucher', 'Seu voucher', 'Mostre o QR code ou o código no local. Ele fica salvo neste aparelho e funciona sem internet.',
    `<a class="voltar" href="#/reservas">${ICONE.voltar}Minhas reservas</a>
    ${avisos.length ? `<section class="avisos" aria-label="Sua reserva mudou"><h2>Sua reserva mudou</h2>${avisos.map(a => avisoHtml(a, r, naoVistos.has(a.id))).join('')}</section>` : ''}
    <div class="palco"><article class="voucher ${r.status}" id="vc">
      <div class="v-topo"><span class="v-marca">${ICONE.logo}Viaje Mais</span><span class="tag ${r.status}">${ST[r.status]}</span></div>
      <div class="v-info"><h2>${esc(r.titulo)}</h2><p>${esc(r.cidade)}, ${quando(r.inicio)}${r.duracaoMin ? ` · ${duracao(r.duracaoMin)}` : ''}</p></div>
      <div class="v-qr"><button type="button" id="ampliar" aria-label="Ampliar o QR code">${qr}</button><small id="rot">Código da reserva</small><div class="codigo" aria-labelledby="rot">${esc(r.codigo)}</div></div>
      <dl class="v-dados"><div><dt>Em nome de</dt><dd>${esc(r.nome)}</dd></div><div><dt>Pessoas</dt><dd>${pessoasTxt(r)}</dd></div><div><dt>Total</dt><dd>${brl(r.total)}</dd></div>${r.observacoes ? `<div><dt>Observações</dt><dd>${esc(r.observacoes)}</dd></div>` : ''}</dl>
    </article></div>
    <dialog class="qr-grande" id="dq" aria-label="QR code da reserva">${qr}<div class="codigo">${esc(r.codigo)}</div><form method="dialog"><button class="btn">Fechar</button></form></dialog>
    ${r.pontoEncontro || mapaUrl(r) ? `<p class="meta">Ponto de encontro: ${esc(r.pontoEncontro || 'local do passeio')}. ${linkMapa(r)}</p>` : ''}
    ${r.status === 'cancelada' && r.motivoCancelamento && !avisos.some(a => a.tipo === 'cancelada') ? `<p class="aviso">Motivo do cancelamento: ${esc(r.motivoCancelamento)}</p>` : ''}
    <p class="meta">Preço com ${r.desconto}% de desconto, travado no momento da reserva. Toque no QR code para ampliar.</p>
    ${ativa ? regraCancelar(horas, r.obsCancelamento) : ''}${ativa && !podeCancelar ? '<p class="nota">O prazo para cancelar pela internet já passou. Fale com o parceiro.</p>' : ''}
    <div class="msg" id="m" role="alert"></div>
    <div class="acoes-voucher">${podeCancelar && !OFFLINE ? '<button class="btn sec" id="c">Cancelar reserva</button>' : ''}
    ${tel ? `<a class="btn sec" href="tel:${tel}">Falar com o parceiro</a>` : ''}
    ${avaliar ? '<button class="btn" id="av">Avaliar o passeio</button>' : ''}</div>
    ${avaliar ? `<form class="caixa avaliacao" id="fa" hidden><h2>Como foi o passeio?</h2>
      <fieldset class="estrelas"><legend>Sua nota</legend>${[1, 2, 3, 4, 5].map(n => `<label><input class="sr" type="radio" name="nota" value="${n}" required><span aria-hidden="true">★</span><span class="sr">${n} de 5</span></label>`).join('')}</fieldset>
      <div><label for="ac">Comentário (opcional)</label><textarea id="ac" rows="3" maxlength="600"></textarea></div>
      <div class="msg" id="ma" role="alert"></div><button class="btn">Enviar avaliação</button></form>` : ''}`);
  marcarVistos(r);
  // Reserva usada, cancelada ou sem comparecimento fica cinza e parada.
  if (ativa) inclinar($('vc'));
  $('ampliar').onclick = () => $('dq').showModal();
  if (avaliar) {
    $('av').onclick = () => { $('av').hidden = true; $('fa').hidden = false; $('fa').querySelector('input').focus(); };
    aoEnviar($('fa'), async () => {
      try { await api(`/api/reservas/${r.id}/avaliar`, 'POST', { nota: +$('fa').nota.value, comentario: $('ac').value }); await carregarReservas(); await vVoucher(id); msgOk($('m'), 'Obrigado! Sua avaliação foi enviada ao parceiro.'); }
      catch (x) { erro($('ma'), x); } });
  }
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

async function vPerfil() {
  const l = await carregarReservas();
  // Histórico: o que já aconteceu (usadas, canceladas ou com horário passado). As ativas ficam em "Minhas reservas".
  const hist = l.filter(r => r.status !== 'reservada' || new Date(r.inicio) < Date.now());
  const feitos = l.filter(r => r.status === 'usada').length;
  const economia = l.filter(r => !['cancelada', 'no_show'].includes(r.status) && r.desconto > 0 && r.desconto < 100).reduce((s, r) => s + (r.precoUnit / (1 - r.desconto / 100) - r.precoUnit) * r.pessoas, 0);
  // O perfil é uma área à parte: sem as abas de ofertas e reservas. Chega-se a ele pela foto no topo ou pelo "Meu painel" da home.
  tela(null, 'Meu perfil', 'Seus dados, sua senha e os passeios que você já fez.', `<div class="perfil">
  <aside class="cartao-perfil">${avatar('avatar grande')}<h2>${esc(U.nome)}</h2><p class="meta">${esc(U.email)}</p>
    <input id="foto" type="file" accept="image/jpeg,image/png,image/webp" class="sr"><label class="btn sec peq" for="foto">${U.temFoto ? 'Trocar foto' : 'Adicionar foto'}</label>
    ${U.temFoto ? '<button class="link" id="sem-foto" type="button">Remover foto</button>' : ''}<div class="msg" id="mf" role="alert"></div>
    <dl class="numeros"><div><dt>Passeios feitos</dt><dd>${feitos}</dd></div><div><dt>Economia com descontos</dt><dd>${brl(economia)}</dd></div></dl></aside>
  <div class="perfil-secoes">
    <section class="secao"><h2>Histórico</h2>${hist.length ? `<div class="lista">${hist.map(linhaReserva).join('')}</div>` : vazio('Seu histórico aparece aqui depois do primeiro passeio.')}</section>
    <form class="caixa secao" id="fd"><h2>Dados pessoais</h2>
      <div><label for="pn">Nome completo</label><input id="pn" value="${esc(U.nome)}" autocomplete="name" maxlength="80" required></div>
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

/* ---------- ROTAS ---------- */
// Depois de uma queda rápida da internet, o painel ficava preso em "Sem internet" até recarregar. Agora tenta voltar a cada tela.
const reconectar = async () => { if (!OFFLINE) return; try { const r = await fetch('/api/me'); if (r.ok) { U = await r.json(); OFFLINE = false; topo(); } } catch {} };
async function rota() {
  // A home manda filtros no endereço: #/?busca=Nova%20Palma, #/?cidade=Agudo, #/?categoria=Vinícola
  const [h, qs] = (location.hash.slice(1) || '/').split('?'), [, a, id] = h.split('/');
  if (qs) { const p = new URLSearchParams(qs); F = { q: p.get('busca') || '', cidade: p.get('cidade') || '', cat: p.get('categoria') || '' }; }
  if (!U) $('entrar').href = loginUrl();
  if (!U && PRIVADAS.includes(a)) return paraLogin();
  // Só mostra o spinner se a tela demorar: com a internet rápida ele nem chega a piscar.
  const espera = setTimeout(() => app.innerHTML = CARREGANDO, 250);
  try {
    await reconectar();
    if (OFFLINE && !['reservas', 'voucher'].includes(a)) return location.hash = '#/reservas';
    if (a === 'oferta') return await vOferta(id); if (a === 'reservas') return await vReservas(); if (a === 'voucher') return await vVoucher(id);
    if (a === 'perfil') return await vPerfil();
    await vOfertas();
  } catch (e) { tela(null, 'Não foi possível abrir esta tela', '', vazio(e instanceof TypeError ? 'Sem conexão com o servidor.' : esc(e.message), 'Confira a internet e tente de novo.')); }
  finally { clearTimeout(espera); }
}
(async () => {
  // /api/me fora do api(): sem login ele devolve 401, e aqui isso não é erro (as ofertas abrem sem conta).
  try { const r = await fetch('/api/me'); if (r.ok) { U = await r.json(); localStorage.setItem('vm_user', JSON.stringify(U)); } else if (r.status === 401) localStorage.removeItem('vm_user'); }
  catch { U = JSON.parse(localStorage.getItem('vm_user') || 'null'); OFFLINE = !!U; }
  if (U && PAINEL[U.perfil]) { location.replace(PAINEL[U.perfil]); return; }
  topo();
  addEventListener('hashchange', rota); rota();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
})();
