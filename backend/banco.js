// Banco em arquivo: lê e grava banco-de-dados/db.json. Na primeira execução cria os dados de demonstração.
const fs = require('fs'), path = require('path');
const { hash } = require('./seguranca');

const DB = path.join(__dirname, '..', 'banco-de-dados', 'db.json');
fs.mkdirSync(path.dirname(DB), { recursive: true }); // garante a pasta, caso ela não exista nesta cópia do projeto
let db;
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));

try { db = JSON.parse(fs.readFileSync(DB)); } catch {
  db = { users: [], passeios: [], favoritos: [], seq: 1 };
  db.users.push(
    { id: db.seq++, nome: 'Administrador', email: 'admin@viajemais.com', senha: hash('admin1234'), perfil: 'admin', status: 'ativo' },
    { id: db.seq++, nome: 'Operador Demo', email: 'operador@viajemais.com', senha: hash('operador1234'), perfil: 'operador', status: 'ativo' });
  db.passeios.push({ id: db.seq++, operadorId: 2, titulo: 'Rota dos fósseis', cidade: 'São João do Polêsine', preco: 80, descricao: 'Passeio guiado pelos sítios paleontológicos da Quarta Colônia.', status: 'aprovado' });
  save();
}
db.ofertas ||= []; db.reservas ||= [];

// Os outros arquivos usam sempre este mesmo objeto db (nunca troque o db inteiro, só as listas dentro dele).
module.exports = { db, save };
