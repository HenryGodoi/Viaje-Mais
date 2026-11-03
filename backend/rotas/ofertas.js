// Rotas do site do turista: vitrine da home, ofertas, reservas, cancelamento e avaliação.
// Respondem no formato de sempre do site (camelCase); os painéis do Dashboard usam rotas/operador.js e rotas/admin.js.
const { db, save } = require('../banco');
const { HORAS_CANCELAR } = require('../config');
const { cod } = require('../seguranca');
const { iso, r2, texto, novaReserva } = require('../modelo');
const { falta, livres, pct, visivel, vis, rvis, cancelar, parceiroDe } = require('../regras');
const { send } = require('../http');

// Ofertas que o viajante pode reservar: visíveis, horário futuro e vaga livre. Mais cedo primeiro.
const abertas = () => db.ofertas.filter(o => visivel(o) && falta(o) > 0 && livres(o) > 0).map(vis).sort((a, c) => a.inicio.localeCompare(c.inicio));

module.exports = [
  // Pública: próximas saídas para o quadro da home. Só o necessário, sem operador nem descrição.
  { metodo: 'GET', caminho: '/api/vitrine', fazer: ({ res }) =>
    send(res, 200, abertas().slice(0, 4).map(o => ({ id: o.id, inicio: o.inicio, titulo: o.titulo, cidade: o.cidade, livres: o.livres, vagas: o.vagas, desconto: o.desconto, ultimaHora: o.ultimaHora }))) },

  // Viajante
  { metodo: 'GET', caminho: '/api/ofertas', quem: 'logado', fazer: ({ res }) => send(res, 200, abertas()) },
  { metodo: 'GET', caminho: '/api/ofertas/:id', quem: 'logado', fazer: ({ res, id }) => {
    const o = db.ofertas.find(x => x.id === id);
    if (!o || !visivel(o)) return send(res, 404, { erro: 'Oferta não encontrada.' });
    send(res, 200, vis(o));
  } },
  { metodo: 'POST', caminho: '/api/reservas', quem: 'cliente', fazer: ({ res, me, b }) => {
    const o = db.ofertas.find(x => x.id === +b.ofertaId), q = +b.pessoas;
    if (!o || !visivel(o) || falta(o) <= 0) return send(res, 404, { erro: 'Esta oferta não está mais disponível.' });
    if (!Number.isInteger(q) || q < 1 || q > 10) return send(res, 400, { erro: 'Escolha de 1 a 10 pessoas.' });
    if (String(b.nome || '').trim().length < 2 || String(b.telefone || '').replace(/\D/g, '').length < 10) return send(res, 400, { erro: 'Informe seu nome e um telefone com DDD.' });
    const l = livres(o);
    if (l < q) return send(res, 409, { erro: l ? `Restam só ${l} vaga(s) nesta oferta.` : 'As vagas acabaram enquanto você reservava. Veja outras ofertas.' });
    // Preço e comissão travados no momento da reserva: mudanças depois não alteram esta reserva.
    const d = pct(o), unit = r2(o.preco * (1 - d / 100)), valor_pago = r2(unit * q), comissao_pct = parceiroDe(o.parceiro_id).comissao_pct, comissao = r2(valor_pago * comissao_pct);
    let codigo; do codigo = cod(); while (db.reservas.some(x => x.codigo === codigo));
    const agora = iso();
    const r = novaReserva({ id: db.seq++, codigo, oferta_id: o.id, passeio_id: o.passeio_id, parceiro_id: o.parceiro_id, turista_id: me.id,
      nome: texto(b.nome, 80), telefone: texto(b.telefone, 30), pessoas: q, preco_unit: o.preco, valor_cheio: r2(o.preco * q), desconto_pct: d, valor_pago,
      comissao_pct, comissao, valor_parceiro: r2(valor_pago - comissao), criado_em: agora, voucher_emitido_em: agora });
    db.reservas.push(r); save(); send(res, 201, rvis(r));
  } },
  { metodo: 'GET', caminho: '/api/reservas', quem: 'cliente', fazer: ({ res, me }) => send(res, 200, db.reservas.filter(r => r.turista_id === me.id).map(rvis).reverse()) },
  { metodo: 'POST', caminho: '/api/reservas/:id/cancelar', quem: 'cliente', fazer: ({ res, me, id }) => {
    const r = db.reservas.find(x => x.id === id && x.turista_id === me.id), o = db.ofertas.find(x => x.id === r?.oferta_id);
    if (!r) return send(res, 404, { erro: 'Reserva não encontrada.' });
    if (r.status !== 'confirmada') return send(res, 409, { erro: 'Esta reserva não pode mais ser cancelada.' });
    if (falta(o) < HORAS_CANCELAR) return send(res, 409, { erro: `O cancelamento é possível até ${HORAS_CANCELAR} horas antes do passeio.` });
    cancelar(r, 'cancelada_turista', 'Cancelada pelo viajante', true); save(); send(res, 200, rvis(r));
  } },
  // Avaliação: depois de o voucher ser validado no local, uma vez por reserva. Aparece no painel do parceiro.
  { metodo: 'POST', caminho: '/api/reservas/:id/avaliar', quem: 'cliente', fazer: ({ res, me, id, b }) => {
    const r = db.reservas.find(x => x.id === id && x.turista_id === me.id), nota = +b.nota, comentario = texto(b.comentario, 600);
    if (!r) return send(res, 404, { erro: 'Reserva não encontrada.' });
    if (r.status !== 'validada') return send(res, 409, { erro: 'Dá para avaliar depois de fazer o passeio.' });
    if (db.avaliacoes.some(a => a.reserva_id === r.id)) return send(res, 409, { erro: 'Você já avaliou este passeio.' });
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) return send(res, 400, { erro: 'Dê uma nota de 1 a 5.' });
    db.avaliacoes.push({ id: db.seq++, parceiro_id: r.parceiro_id, passeio_id: r.passeio_id, reserva_id: r.id, turista_id: me.id, turista_nome: String(me.nome).split(' ')[0],
      nota, comentario, com_desconto: r.desconto_pct > 0, desconto_pct: r.desconto_pct, resposta: null, denuncia: null, criado_em: iso() });
    save(); send(res, 201, { ok: true });
  } },
];
