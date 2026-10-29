// Rotas de passeios: cadastro pelo operador, aprovação pelo admin, lista de usuários e favoritos.
const { db, save } = require('../banco');
const { CATS } = require('../config');
const { pub } = require('../regras');
const { send } = require('../http');

const comOperador = x => ({ ...x, operador: db.users.find(u => u.id === x.operadorId)?.nome });

module.exports = [
  // Favoritos (da versão 1; o painel atual não usa)
  { metodo: 'GET', caminho: '/api/passeios', quem: 'logado', fazer: ({ res, me }) =>
    send(res, 200, db.passeios.filter(x => x.status === 'aprovado').map(x => ({ ...comOperador(x), favorito: db.favoritos.some(f => f.u === me.id && f.p === x.id) }))) },
  { metodo: 'POST', caminho: '/api/favoritos/:id', quem: 'cliente', fazer: ({ res, me, id }) => {
    const i = db.favoritos.findIndex(f => f.u === me.id && f.p === id);
    i >= 0 ? db.favoritos.splice(i, 1) : db.favoritos.push({ u: me.id, p: id }); save();
    send(res, 200, { favorito: i < 0 });
  } },

  // Operador
  { metodo: 'GET', caminho: '/api/operador/passeios', quem: 'operador', fazer: ({ res, me }) => send(res, 200, db.passeios.filter(x => x.operadorId === me.id)) },
  { metodo: 'POST', caminho: '/api/operador/passeios', quem: 'operador', fazer: ({ res, me, b }) => {
    if (!b.titulo || !b.cidade || !(+b.preco >= 0)) return send(res, 400, { erro: 'Preencha título, cidade e preço.' });
    const x = { id: db.seq++, operadorId: me.id, titulo: String(b.titulo).trim(), cidade: String(b.cidade).trim(), preco: +b.preco, descricao: String(b.descricao || '').trim(), categoria: CATS.includes(b.categoria) ? b.categoria : 'Natureza', status: 'pendente' };
    db.passeios.push(x); save(); send(res, 201, x);
  } },
  { metodo: 'DELETE', caminho: '/api/operador/passeios/:id', quem: 'operador', fazer: ({ res, me, id }) => {
    const i = db.passeios.findIndex(x => x.id === id && x.operadorId === me.id);
    if (i < 0) return send(res, 404, { erro: 'Passeio não encontrado.' });
    if (db.reservas.some(r => db.ofertas.find(o => o.id === r.ofertaId)?.passeioId === id)) return send(res, 409, { erro: 'Este passeio já tem reservas e não pode ser excluído.' });
    db.ofertas = db.ofertas.filter(o => o.passeioId !== id);
    db.passeios.splice(i, 1); save(); send(res, 200, { ok: true });
  } },

  // Administrador
  { metodo: 'GET', caminho: '/api/admin/usuarios', quem: 'admin', fazer: ({ res }) => send(res, 200, db.users.map(pub)) },
  { metodo: 'GET', caminho: '/api/admin/passeios', quem: 'admin', fazer: ({ res }) => send(res, 200, db.passeios.map(comOperador)) },
  { metodo: 'POST', caminho: '/api/admin/usuarios/:id/aprovar', quem: 'admin', fazer: ({ res, id }) => {
    const u = db.users.find(x => x.id === id);
    if (!u) return send(res, 404, { erro: 'Usuário não encontrado.' });
    u.status = 'ativo'; save(); send(res, 200, { ok: true });
  } },
  { metodo: 'DELETE', caminho: '/api/admin/usuarios/:id', quem: 'admin', fazer: ({ res, me, id }) => {
    if (!db.users.some(x => x.id === id)) return send(res, 404, { erro: 'Usuário não encontrado.' });
    if (id === me.id) return send(res, 400, { erro: 'Você não pode remover a si mesmo.' });
    db.users = db.users.filter(x => x.id !== id); save(); send(res, 200, { ok: true });
  } },
  { metodo: 'POST', caminho: '/api/admin/passeios/:id/aprovar', quem: 'admin', fazer: ({ res, id }) => {
    const x = db.passeios.find(x => x.id === id);
    if (!x) return send(res, 404, { erro: 'Passeio não encontrado.' });
    x.status = 'aprovado'; save(); send(res, 200, { ok: true });
  } },
];
