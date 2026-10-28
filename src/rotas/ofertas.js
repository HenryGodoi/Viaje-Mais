// Rotas de ofertas, reservas e voucher.
const { db, save } = require('../banco');
const { HORAS_CANCELAR } = require('../config');
const { cod } = require('../seguranca');
const { falta, pct, vis, rvis } = require('../regras');
const { send } = require('../http');

const aprovado = o => db.passeios.find(x => x.id === o?.passeioId)?.status === 'aprovado';

module.exports = [
  // Operador
  { metodo: 'GET', caminho: '/api/operador/ofertas', quem: 'operador', fazer: ({ res, me }) =>
    send(res, 200, db.ofertas.filter(o => o.operadorId === me.id && db.passeios.some(x => x.id === o.passeioId)).map(vis).sort((a, c) => c.inicio.localeCompare(a.inicio))) },
  { metodo: 'POST', caminho: '/api/operador/ofertas', quem: 'operador', fazer: ({ res, me, b }) => {
    const pa = db.passeios.find(x => x.id === +b.passeioId && x.operadorId === me.id && x.status === 'aprovado');
    const inicio = new Date(b.inicio), vagas = +b.vagas, dm = +b.descontoMax;
    if (!pa) return send(res, 400, { erro: 'Escolha um passeio já aprovado pelo administrador.' });
    if (isNaN(inicio) || inicio <= new Date()) return send(res, 400, { erro: 'Escolha um horário no futuro.' });
    if (!Number.isInteger(vagas) || vagas < 1 || vagas > 200) return send(res, 400, { erro: 'O número de vagas deve ser de 1 a 200.' });
    if (!(dm >= 0 && dm <= 90)) return send(res, 400, { erro: 'O desconto máximo deve ficar entre 0% e 90%.' });
    const o = { id: db.seq++, passeioId: pa.id, operadorId: me.id, inicio: inicio.toISOString(), vagas, livres: vagas, descontoMax: dm };
    db.ofertas.push(o); save(); send(res, 201, vis(o));
  } },
  { metodo: 'POST', caminho: '/api/operador/validar', quem: 'operador', fazer: ({ res, me, b }) => {
    const r = db.reservas.find(x => x.codigo === String(b.codigo || '').trim().toUpperCase() && db.ofertas.find(o => o.id === x.ofertaId)?.operadorId === me.id);
    if (!r) return send(res, 404, { erro: 'Código não encontrado entre os seus passeios.' });
    if (r.status === 'usada') return send(res, 409, { erro: 'Este código já foi usado.' });
    if (r.status === 'cancelada') return send(res, 409, { erro: 'Esta reserva foi cancelada.' });
    r.status = 'usada'; r.usadaEm = new Date().toISOString(); save();
    send(res, 200, { ok: true, ...rvis(r) });
  } },

  // Viajante
  { metodo: 'GET', caminho: '/api/ofertas', quem: 'logado', fazer: ({ res }) =>
    send(res, 200, db.ofertas.filter(o => o.livres > 0 && new Date(o.inicio) > new Date() && aprovado(o)).map(vis).sort((a, c) => a.inicio.localeCompare(c.inicio))) },
  { metodo: 'GET', caminho: '/api/ofertas/:id', quem: 'logado', fazer: ({ res, id }) => {
    const o = db.ofertas.find(x => x.id === id);
    if (!o || !aprovado(o)) return send(res, 404, { erro: 'Oferta não encontrada.' });
    send(res, 200, vis(o));
  } },
  { metodo: 'POST', caminho: '/api/reservas', quem: 'cliente', fazer: ({ res, me, b }) => {
    const o = db.ofertas.find(x => x.id === +b.ofertaId), pa = db.passeios.find(x => x.id === o?.passeioId), q = +b.pessoas;
    if (!o || pa?.status !== 'aprovado' || new Date(o.inicio) <= new Date()) return send(res, 404, { erro: 'Esta oferta não está mais disponível.' });
    if (!Number.isInteger(q) || q < 1 || q > 10) return send(res, 400, { erro: 'Escolha de 1 a 10 pessoas.' });
    if (String(b.nome || '').trim().length < 2 || String(b.telefone || '').replace(/\D/g, '').length < 10) return send(res, 400, { erro: 'Informe seu nome e um telefone com DDD.' });
    if (o.livres < q) return send(res, 409, { erro: o.livres ? `Restam só ${o.livres} vaga(s) nesta oferta.` : 'As vagas acabaram enquanto você reservava. Veja outras ofertas.' });
    const d = pct(o), unit = +(pa.preco * (1 - d / 100)).toFixed(2); // preço travado no momento da reserva
    let codigo; do codigo = cod(); while (db.reservas.some(x => x.codigo === codigo));
    const r = { id: db.seq++, ofertaId: o.id, clienteId: me.id, pessoas: q, nome: String(b.nome).trim(), telefone: String(b.telefone).trim(), desconto: d, precoUnit: unit, total: +(unit * q).toFixed(2), codigo, status: 'reservada', criada: new Date().toISOString() };
    o.livres -= q; db.reservas.push(r); save(); send(res, 201, rvis(r));
  } },
  { metodo: 'GET', caminho: '/api/reservas', quem: 'cliente', fazer: ({ res, me }) => send(res, 200, db.reservas.filter(r => r.clienteId === me.id).map(rvis).reverse()) },
  { metodo: 'POST', caminho: '/api/reservas/:id/cancelar', quem: 'cliente', fazer: ({ res, me, id }) => {
    const r = db.reservas.find(x => x.id === id && x.clienteId === me.id), o = db.ofertas.find(x => x.id === r?.ofertaId);
    if (!r) return send(res, 404, { erro: 'Reserva não encontrada.' });
    if (r.status !== 'reservada') return send(res, 409, { erro: 'Esta reserva não pode mais ser cancelada.' });
    if (falta(o) < HORAS_CANCELAR) return send(res, 409, { erro: `O cancelamento é possível até ${HORAS_CANCELAR} horas antes do passeio.` });
    r.status = 'cancelada'; o.livres += r.pessoas; save(); send(res, 200, rvis(r));
  } },
];
