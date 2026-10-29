// Sessões: cookie sid (HttpOnly) guardado em memória. Reiniciar o servidor desloga todo mundo.
const crypto = require('crypto');
const { db } = require('./banco');

const sess = new Map(); // token -> id do usuário

const lerSessao = req => {
  const tok = (req.headers.cookie || '').match(/sid=(\w+)/)?.[1];
  const me = sess.has(tok) ? db.users.find(u => u.id === sess.get(tok)) : null;
  return { tok, me };
};
const entrar = (res, u) => { const t = crypto.randomBytes(24).toString('hex'); sess.set(t, u.id); res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; Path=/; SameSite=Lax`); };
const sair = (res, tok) => { sess.delete(tok); res.setHeader('Set-Cookie', 'sid=; Max-Age=0; Path=/'); };
// Desloga a conta nos outros aparelhos (ao trocar a senha) ou em todos (ao excluir a conta).
const sairDosOutros = (userId, manter) => { for (const [t, id] of sess) if (id === userId && t !== manter) sess.delete(t); };

module.exports = { lerSessao, entrar, sair, sairDosOutros };
