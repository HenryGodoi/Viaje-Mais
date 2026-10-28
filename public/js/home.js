// Buscar: leva para a área logada (o painel pede login se ainda não houver sessão)
document.getElementById('busca').onsubmit = e => { e.preventDefault(); location.href = '/painel.html'; };
// Newsletter ainda não tem back-end: avisa com honestidade em vez de fingir que cadastrou
document.getElementById('news').onsubmit = e => { e.preventDefault(); document.getElementById('nmsg').textContent = 'Em breve! Ainda estamos montando essa parte.'; };
// Se já estiver logado, "Entrar" vira "Meu painel" e o botão principal leva direto para as ofertas
const logado = () => { document.getElementById('entrar').textContent = 'Meu painel'; document.getElementById('entrar').href = '/painel.html'; document.getElementById('cta').textContent = 'Ver ofertas'; };
fetch('/api/me').then(r => r.ok ? logado() : localStorage.removeItem('vm_user')).catch(() => localStorage.getItem('vm_user') && logado());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
