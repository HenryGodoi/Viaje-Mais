// Banco em arquivo: lê e grava banco-de-dados/db.json. Na primeira execução cria os dados de demonstração.
const fs = require('fs'), path = require('path');
const criarDemonstracao = require('./dados-demonstracao');
const migrar = require('./migracao');
const { garantir } = require('./modelo');

// BANCO_DIR: outra pasta para o banco (os testes usam uma pasta temporária, para nunca tocar no banco de verdade).
const PASTA = process.env.BANCO_DIR || path.join(__dirname, '..', 'banco-de-dados'), DB = path.join(PASTA, 'db.json');
fs.mkdirSync(PASTA, { recursive: true }); // garante a pasta, caso ela não exista nesta cópia do projeto
let db;
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));

// Só cria o banco de demonstração se o arquivo não existir. Arquivo com erro de formato faz o servidor parar
// com o erro na tela, em vez de apagar os dados por cima.
if (!fs.existsSync(DB)) { db = criarDemonstracao(); save(); }
else try { db = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) {
  console.error(`O arquivo banco-de-dados/db.json está com defeito e o servidor não ligou (nada foi apagado).
Erro: ${e.message}
Para resolver: volte uma cópia boa do arquivo (por exemplo db-antes-da-migracao.json) ou apague o db.json para começar um banco de demonstração novo.`);
  process.exit(1);
}

if ((db.versao || 1) < 2) {
  fs.writeFileSync(path.join(PASTA, 'db-antes-da-migracao.json'), JSON.stringify(db, null, 1));
  migrar(db); save();
  console.log('Banco convertido para o formato do Dashboard. Cópia do antigo: banco-de-dados/db-antes-da-migracao.json');
}
garantir(db);

// Os outros arquivos usam sempre este mesmo objeto db (nunca troque o db inteiro, só as listas dentro dele).
module.exports = { db, save, PASTA };
