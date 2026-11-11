const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Buscar: leva para as ofertas já filtradas (o painel pede login antes, se ainda não houver sessão)
$('busca').onsubmit = e => { e.preventDefault(); const q = $('d').value.trim(); location.href = '/painel.html' + (q ? '#/?busca=' + encodeURIComponent(q) : ''); };
// Newsletter ainda não tem back-end: avisa com honestidade em vez de fingir que cadastrou
$('news').onsubmit = e => { e.preventDefault(); $('nmsg').textContent = 'Em breve! Ainda estamos montando essa parte.'; };
// Se já estiver logado: "Meu painel" abre o perfil (viajante) ou o painel do Dashboard (operador e admin)
const logado = u => { $('entrar').textContent = 'Meu painel'; $('entrar').href = { operador: '/operador/', admin: '/admin/' }[u?.perfil] || '/painel.html#/perfil'; $('cta').textContent = 'Ver ofertas'; };
fetch('/api/me').then(r => r.ok ? r.json().then(logado) : localStorage.removeItem('vm_user'))
  .catch(() => { const u = JSON.parse(localStorage.getItem('vm_user') || 'null'); if (u) logado(u); });

// Quadro "Próximas saídas": relógio de agora + as próximas vagas reais
const relogio = () => $('hora').textContent = hhmm(new Date());
relogio(); setInterval(relogio, 30000);
const dia = d => { const hoje = new Date(); hoje.setHours(0, 0, 0, 0); const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - hoje) / 864e5);
  return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }); };
const saida = o => `<li><a href="/painel.html#/oferta/${o.id}">
  <span class="saida-hora">${hhmm(new Date(o.inicio))}<small>${dia(o.inicio)}</small></span>
  <span class="saida-nome"><strong>${esc(o.titulo)}</strong><span>${esc(o.cidade)}</span>${o.ultimaHora ? '<br><span class="ultima">Última hora</span>' : ''}</span>
  <span class="saida-desc">${o.desconto ? `<b>${o.desconto}% off</b>` : '<b class="normal">Preço normal</b>'}<span>${o.livres === 1 ? '1 vaga' : `${o.livres} vagas`}</span></span></a></li>`;
fetch('/api/vitrine').then(r => r.json()).then(l => {
  $('saidas').innerHTML = l.length ? l.map(saida).join('') : '<li class="quadro-msg">Nenhuma saída com vaga agora. Os passeios avisam aqui quando sobra lugar.</li>';
}).catch(() => { $('saidas').innerHTML = '<li class="quadro-msg">Sem conexão para mostrar as saídas agora.</li>'; });

// Destaque pago no hero (decisão do Henry, 03/11/2026): um cartão com o selo de anúncio. Com mais de um parceiro
// pagando, cada visita sorteia um, para todos aparecerem. O quadro "Próximas saídas" continua só por horário.
fetch('/api/destaques').then(r => r.ok ? r.json() : []).then(l => {
  if (!l.length) return; const d = l[Math.floor(Math.random() * l.length)];
  $('destaque').innerHTML = `<a class="dest-hero" href="/painel.html#/oferta/${d.id}">${d.foto ? `<img src="${esc(d.foto)}" alt="">` : ''}
    <span class="dest-tx"><span class="anuncio">Em destaque · anúncio</span><strong>${esc(d.titulo)}</strong><span>${esc(d.cidade)} · ${dia(d.inicio)}, ${hhmm(new Date(d.inicio))}</span></span>
    <span class="dest-preco">${d.desconto ? `<s>${brl(d.precoNormal)}</s>` : ''}<b>${brl(d.precoFinal)}</b></span></a>`;
  $('destaque').hidden = false;
}).catch(() => {});

// Hero: as fotos dos passeios se alternam ao fundo (parado para quem pede menos movimento)
const fotos = document.querySelectorAll('.hero-fotos img');
if (fotos.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let n = 0; setInterval(() => { fotos[n].classList.remove('on'); n = (n + 1) % fotos.length; fotos[n].classList.add('on'); }, 5000);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
