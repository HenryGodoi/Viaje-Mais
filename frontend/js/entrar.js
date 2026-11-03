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
if (location.hash === '#criar' || location.hash === '#operador') trocar('criar');
if (location.hash === '#operador') document.querySelector('[name=perfil][value=operador]').checked = true;
// Quem oferece turismo pode adiantar o negócio, a cidade e a categoria (tudo opcional).
const ehParceiro = () => document.querySelector('[name=perfil]:checked').value === 'operador';
const verParceiro = () => $('parceiro').hidden = !ehParceiro();
document.querySelectorAll('[name=perfil]').forEach(r => r.onchange = verParceiro); verParceiro();
// Depois de entrar, vai para onde a pessoa estava indo (?ir=/painel.html#/oferta/7) ou para o painel do perfil dela.
// O endereço é montado do mesmo jeito que o navegador monta e só vale se continuar neste site.
// Conferir o texto não basta: o navegador apaga TAB e quebra de linha, e "/<TAB>/site.com" vira "//site.com".
const destinoSeguro = (ir, origem) => { try { const u = new URL(ir || '/painel.html', origem); return u.origin === origem ? u.pathname + u.search + u.hash : '/painel.html'; } catch { return '/painel.html'; } };
const ir = new URLSearchParams(location.search).get('ir');
const destino = u => ir ? destinoSeguro(ir, location.origin) : ({ operador: '/operador/', admin: '/admin/' }[u?.perfil] || '/painel.html');
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ ok: r.ok, ...(await r.json()) }));
$('google').onclick = async () => msg((await post('/api/auth/google', {})).erro);
$('f').onsubmit = async e => {
  e.preventDefault(); msg(''); const ok = $('ok'); ok.disabled = true; ok.classList.add('carregando');
  const body = { email: $('email').value, senha: $('senha').value };
  if (modo === 'criar') Object.assign(body, { nome: $('nome').value, confirmar: $('conf').value, perfil: document.querySelector('[name=perfil]:checked').value });
  if (modo === 'criar' && ehParceiro()) Object.assign(body, { negocio: $('negocio').value, cidade: $('cidade').value, categoria: $('categoria').value });
  // Sem o catch, com o servidor fora do ar o botão ficava girando para sempre.
  let r; try { r = await post(modo === 'criar' ? '/api/cadastro' : '/api/login', body); }
  catch { r = { erro: 'Sem conexão com o servidor. Confira a internet e tente de novo.' }; }
  finally { ok.disabled = false; ok.classList.remove('carregando'); }
  if (!r.ok) return msg(r.erro);
  if (r.aviso) { msg(r.aviso, 'ok'); return trocar('entrar'), msg(r.aviso, 'ok'); }
  location.href = destino(r.usuario);
};
fetch('/api/me').then(r => r.ok && r.json().then(u => location.href = destino(u)))
  .catch(() => { const u = JSON.parse(localStorage.getItem('vm_user') || 'null'); if (u) location.href = destino(u); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
