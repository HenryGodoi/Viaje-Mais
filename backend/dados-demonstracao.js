// Dados de demonstração: o banco que o servidor cria na primeira vez que liga (quando banco-de-dados/db.json não existe).
// São as contas de teste publicadas no README e um passeio já aprovado, para dar para testar o fluxo do pitch.
const { hash } = require('./seguranca');

module.exports = () => {
  const db = { users: [], passeios: [], favoritos: [], seq: 1 };
  db.users.push(
    { id: db.seq++, nome: 'Administrador', email: 'admin@viajemais.com', senha: hash('admin1234'), perfil: 'admin', status: 'ativo' },
    { id: db.seq++, nome: 'Operador Demo', email: 'operador@viajemais.com', senha: hash('operador1234'), perfil: 'operador', status: 'ativo' });
  db.passeios.push({ id: db.seq++, operadorId: 2, titulo: 'Rota dos fósseis', cidade: 'São João do Polêsine', preco: 80, descricao: 'Passeio guiado pelos sítios paleontológicos da Quarta Colônia.', status: 'aprovado' });
  return db;
};
