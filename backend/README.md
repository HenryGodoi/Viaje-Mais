# backend

O servidor do Viaje Mais, em Node.js puro: só usa módulos que já vêm com o Node, sem `npm install`. Ele entrega os arquivos de `frontend/` e responde aos pedidos `/api/...`. Para ligar, rode `node server.js` na raiz do projeto.

## Caminho de um pedido

1. `servidor.js` recebe o pedido. Se o endereço não começa com `/api/`, entrega o arquivo de `frontend/`.
2. Se começa com `/api/`, procura a rota nos arquivos de `rotas/` e confere o login (`sessoes.js`) e se o perfil pode usar aquela rota.
3. Lê o corpo do pedido (até 400 KB) e chama a função `fazer` da rota, que responde em JSON (a foto de perfil é a exceção: volta como imagem).
4. Um erro inesperado vira resposta 500. O servidor não cai por causa de um pedido.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `servidor.js` | Liga tudo: entrega o frontend ou chama a rota da API |
| `config.js` | Constantes: porta, categorias, 2h de "última hora", 3h para cancelar |
| `http.js` | Responde JSON, lê o corpo do pedido e entrega os arquivos do frontend |
| `sessoes.js` | Login por cookie, guardado em memória (reiniciar o servidor desloga todos) |
| `seguranca.js` | Hash das senhas (scrypt) e código do voucher |
| `banco.js` | Lê e grava `banco-de-dados/db.json` |
| `dados-demonstracao.js` | Contas de teste e passeio criados no primeiro uso (senhas sorteadas, mostradas no terminal) |
| `trocar-senha.js` | Troca a senha de uma conta: `node backend/trocar-senha.js <e-mail> <nova senha>`, com o servidor desligado |
| `regras.js` | Desconto dinâmico e formato dos dados que vão para a tela |
| `rotas/conta.js` | Cadastro, login, logout e quem está logado |
| `rotas/perfil.js` | Perfil do viajante: dados, foto, senha e excluir conta |
| `rotas/passeios.js` | Passeios do operador; do administrador: aprovar passeios e listar, aprovar e remover usuários; favoritos da primeira versão |
| `rotas/ofertas.js` | Ofertas, quadro da página inicial, reservas, cancelamento e validação de código |

## Como criar uma rota

Coloque um objeto na lista do arquivo certo em `rotas/`:

```js
{ metodo: 'POST', caminho: '/api/algo/:id', quem: 'operador', fazer: ({ res, me, b, id }) => send(res, 200, { ok: true }) }
```

- `quem`: vazio = rota pública; `'logado'` = qualquer conta; `'cliente'` (viajante), `'operador'` ou `'admin'` = só esse perfil. O servidor já responde 401 ou 403.
- `b` é o corpo do pedido em JSON (sempre um objeto), `me` é quem está logado e `id` é o número do `:id`.
- Valide tudo aqui no servidor: o que vem do navegador não é confiável.

## Segurança

- **Cabeçalhos em toda resposta** (`http.js`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e uma Content-Security-Policy que só deixa carregar o que é do próprio site e as fontes do Google. Se o frontend passar a usar outro site (CDN, mapa, Pix), ele precisa entrar na CSP, senão o navegador bloqueia.
- **Pelo HTTPS** (ngrok): o cookie de login ganha `Secure` e a resposta leva `Strict-Transport-Security`.
- **Limite de tentativas no login** (`rotas/conta.js`): 5 senhas erradas para o mesmo e-mail travam o login dele por 15 minutos (resposta 429). A contagem fica na memória.
- **Senhas** com scrypt; as contas de demonstração nascem com senha sorteada.
