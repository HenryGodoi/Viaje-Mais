// Converte um db.json do formato antigo (até 01/11/2026) para o formato do Dashboard (versao 2).
// Roda sozinha, uma vez, quando o servidor liga (banco.js guarda uma cópia do arquivo antes). Nada é apagado:
// cada operador vira dono de um parceiro, os campos ganham os nomes do Dashboard e os status mudam de nome.
const { COMISSAO_PADRAO } = require('./config');
const { garantir, iso, r2, novoParceiro, novoPasseio, novaReserva, novaSolicitacao } = require('./modelo');

const CATEGORIA = { 'Vinícola': 'vinicola', Trilha: 'trilha', Gastronomia: 'restaurante', Cultura: 'museu', Natureza: 'trilha' };
const STATUS = { reservada: 'confirmada', usada: 'validada', cancelada: 'cancelada_turista' };

module.exports = db => {
  garantir(db);
  const agora = iso();
  for (const u of db.users) u.criado_em ||= agora;

  for (const u of db.users.filter(x => x.perfil === 'operador' && !x.parceiro_id)) {
    const primeiro = db.passeios.find(p => p.operadorId === u.id);
    const pa = novoParceiro({ id: db.seq++, nome: u.nome, email: u.email, cidade: primeiro?.cidade || '', categoria: CATEGORIA[primeiro?.categoria] || 'guia',
      status: u.status === 'ativo' ? 'ativo' : 'pendente', criado_em: agora });
    db.parceiros.push(pa);
    Object.assign(u, { parceiro_id: pa.id, papel: 'dono' });
    if (pa.status === 'pendente') db.solicitacoes.push(novaSolicitacao({ id: db.seq++, parceiro_id: pa.id, tipo: 'parceiro', criado_em: agora }));
  }
  const parceiroDo = userId => db.users.find(u => u.id === userId)?.parceiro_id ?? null;

  db.passeios = db.passeios.map(({ operadorId, status, categoria, fotos = [], ...resto }) => {
    const lista = fotos.map((url, i) => ({ id: `f${resto.id}_${i}`, url, tom: i % 6 }));
    const p = novoPasseio({ ...resto, parceiro_id: parceiroDo(operadorId), categoria: CATEGORIA[categoria] || 'guia', fotos: lista,
      capa_id: lista[0]?.id || null, status: status === 'aprovado' ? 'ativo' : 'pendente', criado_em: agora });
    if (p.status === 'pendente') db.solicitacoes.push(novaSolicitacao({ id: db.seq++, parceiro_id: p.parceiro_id, tipo: 'passeio_novo', passeio_id: p.id, criado_em: agora }));
    return p;
  });

  // "livres" deixa de ser guardado: passa a ser calculado pelas reservas (vagas − pessoas das reservas não canceladas).
  db.ofertas = db.ofertas.map(o => {
    const pa = db.passeios.find(p => p.id === o.passeioId);
    return { id: o.id, passeio_id: o.passeioId, parceiro_id: pa?.parceiro_id ?? parceiroDo(o.operadorId), inicio: o.inicio, vagas: o.vagas, preco: pa?.preco ?? 0,
      desconto_max: o.descontoMax, responsavel: '', status: 'ativa', motivo_cancelamento: '', cancelado_em: null, criado_em: agora };
  });

  db.reservas = db.reservas.map(r => {
    const o = db.ofertas.find(x => x.id === r.ofertaId), status = STATUS[r.status] || 'confirmada';
    const cheio = o?.preco ?? r.precoUnit, comissao = status === 'cancelada_turista' ? 0 : r2(r.total * COMISSAO_PADRAO);
    return novaReserva({
      id: r.id, codigo: r.codigo, oferta_id: r.ofertaId, passeio_id: o?.passeio_id ?? null, parceiro_id: o?.parceiro_id ?? null, turista_id: r.clienteId,
      nome: r.nome, telefone: r.telefone, pessoas: r.pessoas, preco_unit: cheio, valor_cheio: r2(cheio * r.pessoas), desconto_pct: r.desconto,
      valor_pago: r.total, comissao_pct: COMISSAO_PADRAO, comissao, valor_parceiro: comissao ? r2(r.total - comissao) : 0, status, criado_em: r.criada,
      voucher_emitido_em: r.criada,
      ...(r.usadaEm ? { validado_em: r.usadaEm, validado_por: 'Equipe do parceiro', modo: 'online', sincronizado_em: r.usadaEm, pessoas_chegaram: r.pessoas } : {})
    });
  });

  delete db.favoritos; // sobra da versão 1, sem uso
  db.versao = 2;
  return db;
};
