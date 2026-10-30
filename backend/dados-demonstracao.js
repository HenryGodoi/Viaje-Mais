// Dados de demonstração: o banco que o servidor cria na primeira vez que liga (quando banco-de-dados/db.json não existe).
// São as contas de teste e um passeio já aprovado, para dar para testar o fluxo do pitch.
// As senhas são sorteadas a cada banco novo e aparecem só no terminal: senha fixa publicada no README
// deixaria qualquer pessoa entrar como administrador quando o site estiver na internet.
const crypto = require('crypto');
const { hash } = require('./seguranca');

module.exports = () => {
  const senha = () => crypto.randomBytes(6).toString('hex'); // 12 caracteres
  const admin = senha(), operador = senha();
  const db = { users: [], passeios: [], favoritos: [], seq: 1 };
  db.users.push(
    { id: db.seq++, nome: 'Administrador', email: 'admin@viajemais.com', senha: hash(admin), perfil: 'admin', status: 'ativo' },
    { id: db.seq++, nome: 'Operador Demo', email: 'operador@viajemais.com', senha: hash(operador), perfil: 'operador', status: 'ativo' });
  db.passeios.push({ id: db.seq++, operadorId: 2, titulo: 'Rota dos fósseis', cidade: 'São João do Polêsine', preco: 80, descricao: 'Passeio guiado pelos sítios paleontológicos da Quarta Colônia.', status: 'aprovado' });
  console.log(`Banco novo criado com as contas de demonstração (anote, as senhas não aparecem de novo):
  admin@viajemais.com / ${admin}
  operador@viajemais.com / ${operador}
Para trocar uma senha: node backend/trocar-senha.js <e-mail> <nova senha>`);
  return db;
};
