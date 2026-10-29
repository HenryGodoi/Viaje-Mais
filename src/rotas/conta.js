// Rotas de conta: cadastro, login, logout, quem está logado e Google (ainda não feito).
const { db, save } = require('../banco');
const { hash, check } = require('../seguranca');
const { entrar, sair } = require('../sessoes');
const { pub } = require('../regras');
const { send } = require('../http');

module.exports = [
  { metodo: 'POST', caminho: '/api/cadastro', fazer: ({ res, b }) => {
    const email = String(b.email || '').trim().toLowerCase();
    if (!b.nome || String(b.nome).trim().length < 2) return send(res, 400, { erro: 'Informe seu nome completo.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { erro: 'E-mail inválido.' });
    if (String(b.senha || '').length < 8) return send(res, 400, { erro: 'A senha precisa ter ao menos 8 caracteres.' });
    if (b.senha !== b.confirmar) return send(res, 400, { erro: 'As senhas não são iguais.' });
    if (db.users.some(u => u.email === email)) return send(res, 409, { erro: 'Este e-mail já está cadastrado.' });
    const perfil = b.perfil === 'operador' ? 'operador' : 'cliente';
    const u = { id: db.seq++, nome: String(b.nome).trim(), email, senha: hash(b.senha), perfil, status: perfil === 'operador' ? 'pendente' : 'ativo' };
    db.users.push(u); save();
    if (u.status === 'ativo') { entrar(res, u); return send(res, 201, { ok: true, usuario: pub(u) }); }
    send(res, 201, { ok: true, aviso: 'Cadastro enviado. O administrador precisa aprovar seu perfil antes do primeiro acesso.' });
  } },

  { metodo: 'POST', caminho: '/api/login', fazer: ({ res, b }) => {
    const u = db.users.find(x => x.email === String(b.email || '').trim().toLowerCase());
    if (!u || !check(String(b.senha || ''), u.senha)) return send(res, 401, { erro: 'E-mail ou senha incorretos.' });
    if (u.status !== 'ativo') return send(res, 403, { erro: 'Seu cadastro ainda aguarda aprovação do administrador.' });
    entrar(res, u); send(res, 200, { ok: true, usuario: pub(u) });
  } },

  { metodo: 'POST', caminho: '/api/logout', fazer: ({ res, tok }) => { sair(res, tok); send(res, 200, { ok: true }); } },

  { metodo: 'GET', caminho: '/api/me', quem: 'logado', fazer: ({ res, me }) => send(res, 200, { ...pub(me), telefone: me.telefone || '', temFoto: !!me.foto }) },

  { metodo: '*', caminho: '/api/auth/google', fazer: ({ res }) => send(res, 501, { erro: 'Login com Google ainda não está configurado: falta criar o Client ID no Google Cloud.' }) },
];
