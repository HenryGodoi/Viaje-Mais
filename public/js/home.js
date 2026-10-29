const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Buscar: leva para as ofertas já filtradas (o painel pede login antes, se ainda não houver sessão)
$('busca').onsubmit = e => { e.preventDefault(); const q = $('d').value.trim(); location.href = '/painel.html' + (q ? '#/?busca=' + encodeURIComponent(q) : ''); };
// Newsletter ainda não tem back-end: avisa com honestidade em vez de fingir que cadastrou
$('news').onsubmit = e => { e.preventDefault(); $('nmsg').textContent = 'Em breve! Ainda estamos montando essa parte.'; };
// Se já estiver logado, "Entrar" vira "Meu painel" e o botão principal leva direto para as ofertas
const logado = () => { $('entrar').textContent = 'Meu painel'; $('entrar').href = '/painel.html'; $('cta').textContent = 'Ver ofertas'; };
fetch('/api/me').then(r => r.ok ? logado() : localStorage.removeItem('vm_user')).catch(() => localStorage.getItem('vm_user') && logado());

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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
