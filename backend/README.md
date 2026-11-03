# backend

O servidor do Viaje Mais, em Node.js puro: só usa módulos que já vêm com o Node, sem `npm install`. Ele entrega os arquivos de `frontend/`, os painéis do Dashboard (`/admin/` e `/operador/`) e responde aos pedidos `/api/...`. Para ligar, rode `node server.js` na raiz do projeto.

## Caminho de um pedido

1. `servidor.js` recebe o pedido. Se o endereço começa com `/admin/` ou `/operador/`, entrega o arquivo do painel (pasta do Dashboard). Se não começa com `/api/`, entrega o arquivo de `frontend/`.
2. Se começa com `/api/`, procura a rota nos arquivos de `rotas/` e confere o login (`sessoes.js`) e se o perfil pode usar aquela rota.
3. Lê o corpo do pedido (até 400 KB) e chama a função `fazer` da rota, que responde em JSON (a foto de perfil é a exceção: volta como imagem).
4. Erro de regra de negócio (`falha('mensagem')`) vira `{ erro: 'mensagem' }` com o status certo (400, 403, 404). Um erro inesperado vira 500. O servidor não cai por causa de um pedido.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `servidor.js` | Liga tudo: entrega o frontend e os painéis, ou chama a rota da API |
| `config.js` | Constantes: porta, pasta do Dashboard, categorias, cidades, comissão padrão (15%), destaque (R$ 80), 2h de "última hora", 3h para cancelar |
| `http.js` | Responde JSON, lê o corpo do pedido, entrega arquivos e põe os cabeçalhos de segurança |
| `sessoes.js` | Login por cookie. As sessões ficam no `db.json` (só o hash do cookie): reiniciar não desloga, e o painel mostra os aparelhos conectados |
| `seguranca.js` | Hash das senhas (scrypt) e código do voucher |
| `voucher.js` | Assina o QR do voucher e confere a assinatura (ECDSA P-256) |
| `banco.js` | Lê e grava `banco-de-dados/db.json`; converte o formato antigo na primeira vez |
| `modelo.js` | Formato de cada registro (parceiro, passeio, reserva, solicitação) e as máscaras de dados pessoais |
| `migracao.js` | Converte o banco antigo (versão 1) para o formato do Dashboard (versão 2) |
| `dados-demonstracao.js` | Contas de teste, parceiro, passeios e saídas criados no primeiro uso (senhas sorteadas, mostradas no terminal) |
| `trocar-senha.js` | Troca a senha de uma conta: `node backend/trocar-senha.js <e-mail> <nova senha>`, com o servidor desligado |
| `regras.js` | Desconto dinâmico, vagas livres, cancelamento, repasse semanal e o formato dos dados que vão para o site |
| `rotas/conta.js` | Cadastro, login, logout e quem está logado |
| `rotas/perfil.js` | Perfil do viajante: dados, foto, senha e excluir conta |
| `rotas/ofertas.js` | Site do turista: vitrine, ofertas, reservas, cancelamento e avaliação |
| `rotas/operador.js` | Painel do operador (Dashboard): painel, ações, validação, lista do dia e sincronização |
| `rotas/admin.js` | Painel do admin (Dashboard): painel, ações e dados pessoais |

## Variáveis de ambiente (todas opcionais)

| Variável | Para quê | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `DASHBOARD_DIR` | Pasta do repositório do Dashboard | a pasta `Dashboard` ao lado da pasta do site |
| `VOUCHER_CHAVE_PRIVADA` | Chave privada do voucher (JWK em JSON) | criada sozinha em `banco-de-dados/chave-voucher.json` |

## Como criar uma rota

Coloque um objeto na lista do arquivo certo em `rotas/`:

```js
{ metodo: 'POST', caminho: '/api/algo/:id', quem: 'operador', fazer: ({ res, me, b, id }) => send(res, 200, { ok: true }) }
```

- `quem`: vazio = rota pública; `'logado'` = qualquer conta; `'cliente'` (viajante), `'operador'` ou `'admin'` = só esse perfil. O servidor já responde 401 ou 403.
- `b` é o corpo do pedido em JSON (sempre um objeto), `me` é quem está logado, `id` é o número do `:id` e `nome` é o texto do `:nome` (só letras).
- Valide tudo aqui no servidor: o que vem do navegador não é confiável. Para recusar, `falha('Mensagem para a tela')` (400) ou `falha('...', 404)`.

## Rotas

Toda resposta de erro é `{ erro: 'mensagem' }`. Sem login: 401. Perfil errado: 403 ("Você não tem permissão para isso").

### Conta e perfil

| Rota | Quem | O que faz |
|---|---|---|
| `POST /api/cadastro` | público | `{ nome, email, senha, confirmar, perfil }`. Com `perfil: 'operador'`, cria também o parceiro (empresa), pendente de aprovação; aceita `negocio`, `cidade` (nome) e `categoria` (id), todos opcionais |
| `POST /api/login` | público | `{ email, senha }`. 5 erros travam o e-mail por 15 min (429). Validador convidado vira ativo no primeiro login |
| `POST /api/logout`, `GET /api/me` | logado | `me` devolve `id, nome, email, perfil, status, papel?, telefone, temFoto` |
| `POST /api/perfil`, `GET`/`POST /api/perfil/foto`, `DELETE /api/perfil` | viajante | Dados, foto e excluir conta |
| `POST /api/perfil/senha` | logado | `{ atual, nova, confirmar }`; desloga os outros aparelhos |

### Site do turista (formato de sempre, em camelCase)

| Rota | Quem | O que faz |
|---|---|---|
| `GET /api/vitrine` | público | As 4 próximas saídas com vaga (sem operador nem descrição) |
| `GET /api/ofertas`, `GET /api/ofertas/:id` | logado | Saídas à venda: `id, passeioId, inicio, vagas, livres, descontoMax, titulo, cidade, categoria` (nome: "Vinícola"), `descricao, fotos, operador, precoNormal, desconto, precoFinal, ultimaHora` |
| `POST /api/reservas` | viajante | `{ ofertaId, pessoas, nome, telefone }`. Trava o preço e a comissão do momento |
| `GET /api/reservas` | viajante | As reservas da conta: `id, ofertaId, pessoas, nome, telefone, desconto, precoUnit, total, codigo, status, criada, usadaEm, inicio, titulo, cidade, operador, motivoCancelamento, avaliada, qr` |
| `POST /api/reservas/:id/cancelar` | viajante | Até 3 horas antes |
| `POST /api/reservas/:id/avaliar` | viajante | `{ nota: 1 a 5, comentario? }`. Só depois de validada, uma vez por reserva |

Status da reserva no site: `reservada`, `usada`, `no_show` (não compareceu) e `cancelada`. O `qr` só vem na reservada: é o voucher assinado (`VM1.<dados>.<assinatura>`), e o código de 8 letras continua em `codigo`.

Uma saída aparece no site quando ela está ativa, o passeio está aprovado e visível, o parceiro está ativo, o horário é futuro e ainda há vaga.

### Painel do operador (formato do Dashboard, em snake_case)

Perfil `operador`. A conta tem `parceiro_id` e `papel`: `dono` ou `validador`.

| Rota | O que faz |
|---|---|
| `GET /api/operador/painel` | Tudo do parceiro: `usuario, parceiro` (com `pix_mascarada`), `passeios, ofertas, reservas` (nome curto e telefone mascarado; o completo só no dia do passeio), `tentativas, avaliacoes, repasses, destaques, solicitacoes, equipe, sessoes` |
| `POST /api/operador/acoes/:nome` | Uma das ações abaixo. Responde `{}` ou um resultado (ex.: `{ n: 2 }`) |
| `POST /api/operador/validar` | `{ codigo }` ou `{ qr }`, mais `forcar?`, `aparelho?`. Responde `{ tipo, reserva }`, com `tipo` = `liberada`, `ja_usado`, `cancelada`, `nao_encontrado`, `outro_parceiro`, `outro_horario` ou `qr_invalido`. Toda recusa vai para `tentativas` |
| `GET /api/operador/dia` | Reservas de hoje + `chave_publica` (JWK), para validar sem internet |
| `POST /api/operador/sincronizar` | `{ pendentes: [{ codigo, decisao, tipo?, aparelho, quando, pessoas?, aviso? }] }`. Responde `{ ok, conflitos: [{ codigo, tipo, reserva }] }` |

Ações do operador: `publicarOfertas`, `editarOferta`, `cancelarOferta`, `cancelarReserva`, `noShow`, `ajustarChegada`, `salvarPasseio`, `ocultarPasseio`, `duplicarPasseio`, `destacarPasseio`, `responderAvaliacao`, `denunciarAvaliacao`, `registrarRecusa`, `salvarPerfil`, `salvarPreferencias`, `trocarPix`, `convidar`, `removerMembro`, `encerrarSessao`, `trocarSenha`. As regras e mensagens são as do `operador/dados.js` do Dashboard, com estas diferenças:

- Os ids são números.
- `trocarSenha` pede `{ atual, nova, confirma }`.
- Não há serviço de e-mail ainda. Por isso `convidar` devolve `{ senha_provisoria }` para o dono repassar. `trocarPix` vai direto para o admin aprovar, sem o link de confirmação por e-mail.
- O validador só pode usar `registrarRecusa`, `ajustarChegada`, `trocarSenha` e `encerrarSessao`. Nas outras ações recebe 403.

### Painel do admin

Perfil `admin`. Toda ação grava uma linha na auditoria.

| Rota | O que faz |
|---|---|
| `GET /api/admin/painel` | O banco no formato do `admin/dados.js`: `admin, config, categorias, cidades, parceiros, comissoes_historico, destaques, passeios, ofertas, turistas, reservas, vouchers, tentativas, sincronizacao, avaliacoes, repasses, solicitacoes, auditoria, emails`. E-mail, telefone e Pix vêm mascarados |
| `POST /api/admin/acoes/:nome` | Uma das ações abaixo |
| `POST /api/admin/dados-pessoais` | `{ alvo_tipo: 'reserva' \| 'parceiro', alvo_id, motivo? }`. Devolve o contato completo do turista ou a chave Pix, e registra o acesso na auditoria (LGPD) |

As ações do admin são estas:

| Ação | Dados |
|---|---|
| `aprovarSolicitacao` | `{ id }` |
| `recusarSolicitacao` | `{ id, motivo }` |
| `pedirAjuste` | `{ id, mensagem }` |
| `salvarParceiro` | `{ id?, campos }`. Sem `id`, cadastra um parceiro novo |
| `suspenderParceiro` | `{ id, motivo }` |
| `reativarParceiro` | `{ id, motivo }` |
| `mudarComissao` | `{ id, pct, motivo }`, com `pct` em porcentagem |
| `destacarPasseio` | `{ id, inicio, fim }` ou `{ id, desligar: true }` |
| `redefinirAcesso` | `{ id }` (o id do parceiro). Devolve `{ email, senha_provisoria }` e cria a conta do dono se ela ainda não existir |
| `enviarMensagem` | `{ para: 'parceiro' \| 'turista', id, assunto?, texto }` |
| `editarPasseio` | `{ id, campos }` |
| `ocultarPasseio` | `{ id, oculto }` |
| `cancelarReserva` | `{ id, motivo, obs? }`, com `motivo` = `cancelada_turista`, `cancelada_parceiro`, `cancelada_clima` ou `no_show` |
| `remarcarReserva` | `{ id, oferta_id }` |
| `reenviarVoucher` | `{ id }` |
| `reemitirVoucher` | `{ id }`. Gera um código novo, e o código e o QR antigos deixam de valer |
| `marcarRepassePago` | `{ parceiro_id, semana, comprovante? }`, com `semana` = a segunda-feira, em AAAA-MM-DD |
| `decidirDenuncia` | `{ id, decisao: 'remover' \| 'manter', motivo? }` |

Aprovar uma solicitação aplica a mudança na hora:

- o parceiro e a conta dele ficam ativos;
- o passeio fica ativo;
- o preço, a descrição e as fotos novos entram no passeio;
- a chave Pix nova passa a valer.

## Dinheiro e e-mail (enquanto não há Pix nem serviço de e-mail)

- O turista paga no local: toda reserva nasce com `status_pagamento: 'pendente'`. Por isso não há estorno: cancelar só zera a comissão e o valor do parceiro.
- O repasse semanal usa a mesma conta do Dashboard. Ele nunca vira "pago" sozinho: só quando o admin usa `marcarRepassePago`.
- Os e-mails ficam gravados em `emails` com `status: 'simulado'`.

## Segurança

- **Cabeçalhos em toda resposta** (`http.js`): `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`, mais uma Content-Security-Policy. A CSP só deixa carregar o que é do próprio site, as fontes do Google e o mapa do OpenStreetMap (iframe). Ela vale também para os painéis. Por isso o navegador bloqueia três coisas: `<script>` escrito dentro do HTML, `onclick="..."` e script de CDN. Se o frontend ou o Dashboard passar a usar outro site, ele precisa entrar na CSP.
- **Pelo HTTPS** (ngrok): o cookie de login ganha `Secure` e a resposta leva `Strict-Transport-Security`.
- **Limite de tentativas no login** (`rotas/conta.js`): 5 senhas erradas para o mesmo e-mail travam o login dele por 15 minutos (resposta 429). A contagem fica na memória.
- **Senhas** com scrypt; as contas de demonstração nascem com senha sorteada.
- **Dados pessoais:** os painéis recebem nome curto, telefone e e-mail mascarados. O dado completo sai por uma rota própria, que registra o acesso.
- **Voucher assinado:** a chave privada nunca vai para o git nem para o navegador. Trocar a chave invalida os QR já emitidos (o código de 8 letras continua valendo).
