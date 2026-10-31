// Dados de demonstração: o banco que o servidor cria na primeira vez que liga (quando banco-de-dados/db.json não existe).
// São as contas de teste e um passeio já aprovado, para dar para testar o fluxo do pitch.
// As senhas são sorteadas a cada banco novo e aparecem só no terminal: senha fixa publicada no README
// deixaria qualquer pessoa entrar como administrador quando o site estiver na internet.
const crypto = require('crypto');
const { hash } = require('./seguranca');

module.exports = () => {
  const senha = () => crypto.randomBytes(6).toString('hex'); // 12 caracteres
  // Na hospedagem (Render) o banco é recriado a cada reinício; ADMIN_SENHA e OPERADOR_SENHA mantêm as senhas de teste iguais.
  const admin = process.env.ADMIN_SENHA || senha(), operador = process.env.OPERADOR_SENHA || senha();
  const db = { users: [], passeios: [], favoritos: [], seq: 1 };
  db.users.push(
    { id: db.seq++, nome: 'Administrador', email: 'admin@viajemais.com', senha: hash(admin), perfil: 'admin', status: 'ativo' },
    { id: db.seq++, nome: 'Operador Demo', email: 'operador@viajemais.com', senha: hash(operador), perfil: 'operador', status: 'ativo' });
  db.passeios.push({ id: db.seq++, operadorId: 2, titulo: 'Rota dos fósseis', cidade: 'São João do Polêsine', preco: 80, descricao: 'Passeio guiado pelos sítios paleontológicos da Quarta Colônia.', status: 'aprovado' });
  // Passeios de exemplo com fotos (frontend/img/passeios/<pasta>/<n>.<ext>) e uma saída futura cada.
  const exemplos = [
    ['AMF - Antonio Meneghetti Faculdade', 'Cultura', 40, 'amf', ['jpg', 'jpeg', 'jpeg', 'jpeg', 'jpeg'], 'Visita guiada à faculdade e ao seu entorno, no Recanto Maestro.', 12, 30],
    ['Domus Mea Vinícola', 'Gastronomia', 90, 'domus-mea', ['webp', 'jpg', 'jpg', 'jpg', 'jpeg'], 'Visita à vinícola com degustação de vinhos e azeites.', 10, 40],
    ['Ontoarte', 'Cultura', 50, 'ontoarte', ['jpg', 'jpg', 'jpg', 'jpg', 'jpg', 'webp'], 'Visita à galeria de arte La Ontoarte, do Maestro Antonio Meneghetti.', 8, 25],
    ['Termas do Recanto Maestro', 'Natureza', 120, 'termas', ['jpg', 'jpg', 'jpg', 'jpg', 'jpg', 'jpg', 'jpg'], 'Dia de piscinas termais, toboáguas e área verde.', 20, 50],
  ];
  exemplos.forEach(([titulo, categoria, preco, pasta, exts, descricao, vagas, descontoMax], i) => {
    const p = { id: db.seq++, operadorId: 2, titulo, cidade: 'Restinga Sêca', preco, descricao, categoria, status: 'aprovado',
      fotos: exts.map((e, n) => `/img/passeios/${pasta}/${n + 1}.${e}`) };
    db.passeios.push(p);
    db.ofertas ||= [];
    const inicio = new Date(Date.now() + (i + 2) * 864e5); inicio.setHours(10, 0, 0, 0);
    db.ofertas.push({ id: db.seq++, passeioId: p.id, operadorId: 2, inicio: inicio.toISOString(), vagas, livres: vagas, descontoMax });
  });
  console.log(`Banco novo criado com as contas de demonstração (anote, as senhas não aparecem de novo):
  admin@viajemais.com / ${admin}
  operador@viajemais.com / ${operador}
Para trocar uma senha: node backend/trocar-senha.js <e-mail> <nova senha>`);
  return db;
};
