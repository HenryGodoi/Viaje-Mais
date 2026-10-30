// Rotas de conta: cadastro, login, logout, quem está logado e Google (ainda não feito).
const { db, save } = require('../banco');
const { hash, check } = require('../seguranca');
const { entrar, sair } = require('../sessoes');
const { pub } = require('../regras');
const { send } = require('../http');

// Limite de tentativas: 5 senhas erradas para o mesmo e-mail, vindas do mesmo endereço, travam o login
// desse e-mail por 15 minutos. Fica na memória (reiniciar o servidor zera a contagem).
const MAX_ERROS = 5, JANELA = 15 * 60e3, erros = new Map(); // "endereço e-mail" -> { n, desde }
const tentativas = chave => {
  const e = erros.get(chave);
  if (e && Date.now() - e.desde > JANELA) { erros.delete(chave); return null; }
  return e;
};
const errou = chave => {
  const e = tentativas(chave) || { n: 0, desde: Date.now() }; e.n++; erros.set(chave, e);
  // shortcut: limpeza só quando a lista passa de 10 mil chaves; com muito tráfego, trocar por limpeza periódica
  if (erros.size > 10000) for (const [k, v] of erros) if (Date.now() - v.desde > JANELA) erros.delete(k);
};

module.exports = [
  { metodo: 'POST', caminho: '/api/cadastro', fazer: ({ res, b }) => {
    const email = String(b.email || '').trim().toLowerCase();
    if (!b.nome || String(b.nome).trim().length < 2) return send(res, 400, { erro: 'Informe seu nome completo.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { erro: 'E-mail inválido.' });
    if (String(b.senha || '').length < 8) return send(res, 400, { erro: 'A senha precisa ter ao menos 8 caracteres.' });
    if (b.senha !== b.confirmar) return send(res, 400, { erro: 'As senhas não são iguais.' });
    if (db.users.some(u => u.email === email)) return send(res, 409, { erro: 'Este e-mail já está cadastrado.' });
    const perfil = b.perfil === 'operador' ? 'operador' : 'cliente';
    const u = { id: db.seq++, nome: String(b.nome).trim(), email, senha: hash(String(b.senha)), perfil, status: perfil === 'operador' ? 'pendente' : 'ativo' };
    db.users.push(u); save();
    if (u.status === 'ativo') { entrar(res, u); return send(res, 201, { ok: true, usuario: pub(u) }); }
    send(res, 201, { ok: true, aviso: 'Cadastro enviado. O administrador precisa aprovar seu perfil antes do primeiro acesso.' });
  } },

  { metodo: 'POST', caminho: '/api/login', fazer: ({ req, res, b }) => {
    const email = String(b.email || '').trim().toLowerCase(), chave = req.socket.remoteAddress + ' ' + email;
    const t = tentativas(chave);
    if (t && t.n >= MAX_ERROS) return send(res, 429, { erro: `Muitas tentativas com senha errada. Tente de novo em ${Math.ceil((t.desde + JANELA - Date.now()) / 60e3)} minuto(s).` });
    const u = db.users.find(x => x.email === email);
    if (!u || !check(String(b.senha || ''), u.senha)) { errou(chave); return send(res, 401, { erro: 'E-mail ou senha incorretos.' }); }
    erros.delete(chave);
    if (u.status !== 'ativo') return send(res, 403, { erro: 'Seu cadastro ainda aguarda aprovação do administrador.' });
    entrar(res, u); send(res, 200, { ok: true, usuario: pub(u) });
  } },

  { metodo: 'POST', caminho: '/api/logout', fazer: ({ res, tok }) => { sair(res, tok); send(res, 200, { ok: true }); } },

  { metodo: 'GET', caminho: '/api/me', quem: 'logado', fazer: ({ res, me }) => send(res, 200, { ...pub(me), telefone: me.telefone || '', temFoto: !!me.foto }) },

  { metodo: '*', caminho: '/api/auth/google', fazer: ({ res }) => send(res, 501, { erro: 'Login com Google ainda não está configurado: falta criar o Client ID no Google Cloud.' }) },
];
