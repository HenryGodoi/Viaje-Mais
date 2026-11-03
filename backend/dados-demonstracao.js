// Dados de demonstração: o banco que o servidor cria na primeira vez que liga (quando banco-de-dados/db.json não existe).
// São as contas de teste, um parceiro e passeios já aprovados, para dar para testar o fluxo do pitch.
// As senhas são sorteadas a cada banco novo e aparecem só no terminal: senha fixa publicada no README
// deixaria qualquer pessoa entrar como administrador quando o site estiver na internet.
const crypto = require('crypto');
const { hash } = require('./seguranca');
const { garantir, iso, novoParceiro, novoPasseio } = require('./modelo');

module.exports = () => {
  const senha = () => crypto.randomBytes(6).toString('hex'); // 12 caracteres
  const admin = senha(), operador = senha(), agora = iso();
  const db = garantir({ versao: 2, seq: 1 });
  const parceiro = novoParceiro({ id: db.seq++, nome: 'Parceiro Demo', cidade: 'Restinga Sêca', email: 'operador@viajemais.com', criado_em: agora });
  db.parceiros.push(parceiro);
  db.users.push(
    { id: db.seq++, nome: 'Administrador', email: 'admin@viajemais.com', senha: hash(admin), perfil: 'admin', status: 'ativo', criado_em: agora },
    { id: db.seq++, nome: 'Operador Demo', email: 'operador@viajemais.com', senha: hash(operador), perfil: 'operador', status: 'ativo',
      parceiro_id: parceiro.id, papel: 'dono', criado_em: agora });
  const passeio = c => { const p = novoPasseio({ id: db.seq++, parceiro_id: parceiro.id, status: 'ativo', criado_em: agora, ...c }); db.passeios.push(p); return p; };

  passeio({ titulo: 'Rota dos fósseis', cidade: 'São João do Polêsine', categoria: 'guia', preco: 80, descricao: 'Passeio guiado pelos sítios paleontológicos da Quarta Colônia.' });
  // Passeios de exemplo com fotos (frontend/img/passeios/<pasta>/<n>.<ext>) e uma saída futura cada.
  const exemplos = [
    ['AMF - Antonio Meneghetti Faculdade', 'guia', 40, 'amf', ['jpg', 'jpeg', 'jpeg', 'jpeg', 'jpeg'], 'Visita guiada à faculdade e ao seu entorno, no Recanto Maestro.', 12, 30],
    ['Domus Mea Vinícola', 'vinicola', 90, 'domus-mea', ['webp', 'jpg', 'jpg', 'jpg', 'jpeg'], 'Visita à vinícola com degustação de vinhos e azeites.', 10, 40],
    ['Ontoarte', 'museu', 50, 'ontoarte', ['jpg', 'jpg', 'jpg', 'jpg', 'jpg', 'webp'], 'Visita à galeria de arte La Ontoarte, do Maestro Antonio Meneghetti.', 8, 25],
    ['Termas do Recanto Maestro', 'hospedagem', 120, 'termas', ['jpg', 'jpg', 'jpg', 'jpg', 'jpg', 'jpg', 'jpg'], 'Dia de piscinas termais, toboáguas e área verde.', 20, 50],
  ];
  exemplos.forEach(([titulo, categoria, preco, pasta, exts, descricao, vagas, desconto_max], i) => {
    const fotos = exts.map((e, n) => ({ id: `f${pasta}_${n}`, url: `/img/passeios/${pasta}/${n + 1}.${e}`, tom: n % 6 }));
    const p = passeio({ titulo, cidade: 'Restinga Sêca', categoria, preco, descricao, fotos, capa_id: fotos[0].id, capacidade: vagas, desconto_max_padrao: desconto_max });
    const inicio = new Date(Date.now() + (i + 2) * 864e5); inicio.setHours(10, 0, 0, 0);
    db.ofertas.push({ id: db.seq++, passeio_id: p.id, parceiro_id: parceiro.id, inicio: inicio.toISOString(), vagas, preco, desconto_max, responsavel: '',
      status: 'ativa', motivo_cancelamento: '', cancelado_em: null, criado_em: agora });
  });
  console.log(`Banco novo criado com as contas de demonstração (anote, as senhas não aparecem de novo):
  admin@viajemais.com / ${admin}
  operador@viajemais.com / ${operador}
Para trocar uma senha: node backend/trocar-senha.js <e-mail> <nova senha>`);
  return db;
};
