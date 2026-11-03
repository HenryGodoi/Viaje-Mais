// Sessões: cookie sid (HttpOnly). Ficam guardadas no db.json (só o hash do cookie), então reiniciar o servidor
// não desloga ninguém, e o painel do operador mostra os "aparelhos conectados".
const crypto = require('crypto');
const { db, save } = require('./banco');
const { viaHttps } = require('./http');
const { iso } = require('./modelo');

const VALIDADE = 30 * 864e5; // 30 dias sem usar: a sessão vence
const hashDe = t => crypto.createHash('sha256').update(t).digest('hex');
const remover = filtro => { const n = db.sessoes.length; db.sessoes = db.sessoes.filter(s => !filtro(s)); if (db.sessoes.length !== n) save(); };

// "Android · Chrome", para a pessoa reconhecer o aparelho na lista.
const aparelhoDe = req => {
  const ua = req.headers['user-agent'] || '';
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Outro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${so} · ${nav}`;
};

const lerSessao = req => {
  // (?:^|;) evita confundir com cookies de outros sites em localhost, como "connect.sid".
  const tok = (req.headers.cookie || '').match(/(?:^|;\s*)sid=(\w+)/)?.[1];
  const s = tok && db.sessoes.find(x => x.token === hashDe(tok));
  if (!s) return { tok, me: null, sessao: null };
  if (Date.now() - Date.parse(s.ultimo_acesso) > VALIDADE) { remover(x => x === s); return { tok, me: null, sessao: null }; }
  const me = db.users.find(u => u.id === s.usuario_id) || null;
  if (me && Date.now() - Date.parse(s.ultimo_acesso) > 5 * 60e3) { s.ultimo_acesso = iso(); save(); } // grava no máximo a cada 5 min
  return { tok, me, sessao: me ? s : null };
};
// Pelo HTTPS (ngrok), o cookie ganha "Secure": o navegador nunca o manda por uma conexão sem criptografia.
const entrar = (res, u) => {
  const t = crypto.randomBytes(24).toString('hex'), agora = iso();
  db.sessoes.push({ id: db.seq++, token: hashDe(t), usuario_id: u.id, aparelho: aparelhoDe(res.req), criado_em: agora, ultimo_acesso: agora }); save();
  res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; Path=/; SameSite=Lax${viaHttps(res.req) ? '; Secure' : ''}`);
};
const sair = (res, tok) => { if (tok) remover(s => s.token === hashDe(tok)); res.setHeader('Set-Cookie', 'sid=; Max-Age=0; Path=/'); };
// Desloga a conta nos outros aparelhos (ao trocar a senha) ou em todos (ao excluir a conta ou remover da equipe).
const sairDosOutros = (userId, manter) => remover(s => s.usuario_id === userId && (!manter || s.token !== hashDe(manter)));

module.exports = { lerSessao, entrar, sair, sairDosOutros, remover };
