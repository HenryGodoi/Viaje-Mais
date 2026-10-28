// Regras de negócio: desconto dinâmico e como ofertas, reservas e usuários aparecem para a tela.
const { db } = require('./banco');
const { HORAS_ULTIMA } = require('./config');

const falta = o => (new Date(o.inicio) - Date.now()) / 36e5; // horas até o início
// Desconto dinâmico: quanto mais vazio o horário, maior o desconto; na última hora vai ao máximo.
const pct = o => o.livres <= 0 ? 0 : falta(o) <= HORAS_ULTIMA ? o.descontoMax : Math.round(o.descontoMax * o.livres / o.vagas);

const vis = o => {
  const pa = db.passeios.find(x => x.id === o.passeioId), d = pct(o);
  return { ...o, titulo: pa.titulo, cidade: pa.cidade, categoria: pa.categoria || 'Natureza', descricao: pa.descricao,
    operador: db.users.find(u => u.id === o.operadorId)?.nome, precoNormal: pa.preco, desconto: d,
    precoFinal: +(pa.preco * (1 - d / 100)).toFixed(2), ultimaHora: o.livres > 0 && falta(o) <= HORAS_ULTIMA };
};
const rvis = r => {
  const o = db.ofertas.find(x => x.id === r.ofertaId), pa = db.passeios.find(x => x.id === o?.passeioId);
  return { ...r, inicio: o?.inicio, titulo: pa?.titulo, cidade: pa?.cidade, operador: db.users.find(u => u.id === o?.operadorId)?.nome };
};
// Dados do usuário que podem ir para o navegador (nunca a senha).
const pub = u => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, status: u.status });

module.exports = { falta, pct, vis, rvis, pub };
