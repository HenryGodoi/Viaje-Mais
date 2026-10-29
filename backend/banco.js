// Banco em arquivo: lê e grava banco-de-dados/db.json. Na primeira execução cria os dados de demonstração.
const fs = require('fs'), path = require('path');
const criarDemonstracao = require('./dados-demonstracao');

const DB = path.join(__dirname, '..', 'banco-de-dados', 'db.json');
fs.mkdirSync(path.dirname(DB), { recursive: true }); // garante a pasta, caso ela não exista nesta cópia do projeto
let db;
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));

try { db = JSON.parse(fs.readFileSync(DB)); } catch { db = criarDemonstracao(); save(); }
db.ofertas ||= []; db.reservas ||= [];

// Os outros arquivos usam sempre este mesmo objeto db (nunca troque o db inteiro, só as listas dentro dele).
module.exports = { db, save };
