let modo = 'entrar';
const $ = id => document.getElementById(id), msg = (t, c='erro') => { $('msg').textContent = t; $('msg').className = 'msg ' + c; };
function trocar(m) {
  modo = m; const c = m === 'criar';
  $('aba-entrar').setAttribute('aria-selected', !c); $('aba-criar').setAttribute('aria-selected', c);
  document.querySelectorAll('.cad').forEach(e => e.classList.toggle('hidden', !c));
  $('h').textContent = c ? 'Criar conta' : 'Bem-vindo de volta';
  $('sub').textContent = c ? 'Preencha os dados abaixo ou use sua conta Google.' : 'Entre com seu e-mail e senha para continuar.';
  $('ou').textContent = c ? 'ou cadastre com e-mail' : 'ou entre com e-mail';
  $('google-txt').textContent = c ? 'Cadastrar com Google' : 'Continuar com Google';
  $('ok').textContent = c ? 'Criar minha conta' : 'Entrar';
  $('senha').autocomplete = c ? 'new-password' : 'current-password'; msg('');
}
$('aba-entrar').onclick = () => trocar('entrar'); $('aba-criar').onclick = () => trocar('criar');
if (location.hash === '#criar') trocar('criar');
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ ok: r.ok, ...(await r.json()) }));
$('google').onclick = async () => msg((await post('/api/auth/google', {})).erro);
$('f').onsubmit = async e => {
  e.preventDefault(); msg(''); $('ok').disabled = true;
  const body = { email: $('email').value, senha: $('senha').value };
  if (modo === 'criar') Object.assign(body, { nome: $('nome').value, confirmar: $('conf').value, perfil: document.querySelector('[name=perfil]:checked').value });
  const r = await post(modo === 'criar' ? '/api/cadastro' : '/api/login', body);
  $('ok').disabled = false;
  if (!r.ok) return msg(r.erro);
  if (r.aviso) { msg(r.aviso, 'ok'); return trocar('entrar'), msg(r.aviso, 'ok'); }
  location.href = '/';
};
fetch('/api/me').then(r => r.ok && (location.href = '/')).catch(() => localStorage.getItem('vm_user') && (location.href = '/'));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
