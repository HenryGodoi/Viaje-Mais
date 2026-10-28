# CLAUDE.md — Viaje Mais

Leia este arquivo inteiro antes de mexer em qualquer coisa. Ele resume o projeto, as decisões já tomadas e as regras de trabalho.

## 1. O que é o projeto

**Viaje Mais** é um PWA de turismo para a **Quarta Colônia (RS)**, criado no Ideathon 2026 (a equipe foi campeã). Equipe: Henry Azambuja Godoi (quem desenvolve), Enzo Ueno e Samuel Fritz. A próxima etapa é o Startcup.

**Inspiração:** o app Primeira Mesa (até 50% de desconto em restaurantes nos horários vazios). O Viaje Mais leva a mesma ideia para passeios, museus, vinícolas e trilhas.

**Problema:** passeios saem com vagas sobrando (o dono gasta igual e ganha menos), e muitos turistas deixam de passear por achar caro.

**Ideia:** mostrar as vagas que sobraram com desconto. Quanto mais vazio o horário, maior o desconto (como passagem de avião). O turista reserva pelo celular e recebe um código (voucher) para usar no local, mesmo sem internet.

**Região:** Agudo, Dona Francisca, Faxinal do Soturno, Ivorá, Nova Palma, Pinhal Grande, Restinga Sêca, São João do Polêsine e Silveira Martins. Hoje cada cidade divulga suas atrações sozinha; o app junta tudo e permite roteiros de um dia por várias cidades.

**Versão inicial (escopo):** uma região, de 5 a 10 parceiros, 3 telas (lista de ofertas, detalhes, reserva com código).

**Receita prevista:** comissão por reserva, destaque pago para parceiros e plano opcional para o turista.

**Diferenciais:** desconto que muda conforme o movimento; avisos de última hora (ex.: "faltam 2h, 5 vagas, 50% off"); pacotes de passeio + jantar.

## 2. Decisões já tomadas (não reverter sem perguntar)

- **Formato: PWA**, não app nativo. Motivos: voucher offline mais simples, painéis de operador e admin funcionam melhor no desktop, reaproveita o código web, valida mais rápido com 5 a 10 parceiros e evita a loja de aplicativos.
- **Paleta: "Viaje Mais — Verde"** (a primeira versão). As outras paletas testadas (azul, amarelo com marrom, oliva, menta, sálvia, esmeralda) foram descartadas.
- **Site em formato desktop** na home, com versão responsiva para celular.
- **Login por e-mail e senha.** Entrar com Google está só indicado na tela e a rota devolve 501 (não implementado).
- **Sem dependências:** o servidor é Node.js puro (só módulos nativos). Não adicionar npm, framework ou banco externo sem o Henry pedir.

## 3. Stack e arquivos

- **Node.js 22 LTS** instalado pelo instalador oficial (.msi) no Windows. Não usar o Node instalado via Chocolatey: ele quebrou e foi removido.
- Servidor: `server.js` (HTTP nativo, uma porta, padrão `3000`, ou a variável `PORT`). Desde a v4 ele só liga as peças; o código fica em `src/`.
- Banco: arquivo `db.json` criado na primeira execução, com dados de demonstração. Para zerar tudo, feche o servidor e apague o `db.json`.
- Senhas: `scrypt` com sal aleatório. Sessão: cookie `sid` (HttpOnly) guardado em memória, então reiniciar o servidor desloga todo mundo.

```
viaje-mais/
├── server.js              liga tudo: arquivos estáticos + procura a rota da API
├── CLAUDE.md              este arquivo
├── LEIA-ME.md             guia de uso para o Henry
├── INICIAR.bat            atalho para iniciar no Windows
├── src/
│   ├── config.js          constantes (porta, categorias, HORAS_ULTIMA, HORAS_CANCELAR)
│   ├── banco.js           db.json: carregar, salvar (save) e dados de demonstração
│   ├── seguranca.js       senha (hash/check) e código do voucher (cod)
│   ├── sessoes.js         cookie sid: lerSessao, entrar, sair
│   ├── regras.js          desconto (falta, pct) e formato de oferta/reserva/usuário (vis, rvis, pub)
│   ├── http.js            send (responde JSON), lerCorpo, arquivo (entrega public/)
│   └── rotas/
│       ├── conta.js       cadastro, login, logout, me, Google
│       ├── passeios.js    passeios do operador, admin, favoritos
│       └── ofertas.js     ofertas, reservas, cancelar, validar código
└── public/
    ├── index.html         HOME verde (página inicial)
    ├── entrar.html        login e cadastro
    ├── painel.html        área logada (cliente, operador, admin)
    ├── css/
    │   ├── base.css       cores e fontes (variáveis) usadas por todas as páginas
    │   ├── home.css       estilos da home
    │   └── app.css        estilos do login e do painel
    ├── js/
    │   ├── home.js        botões da home e "Meu painel" quando logado
    │   ├── entrar.js      login e cadastro
    │   └── painel.js      telas do painel (viajante, operador, admin)
    ├── sw.js              service worker (cache offline; precisa ficar na raiz de public/)
    ├── manifest.webmanifest
    └── icon-192.png / icon-512.png
```

**Como adicionar uma rota na API:** coloque um objeto na lista do arquivo certo em `src/rotas/`:
`{ metodo: 'POST', caminho: '/api/algo/:id', quem: 'operador', fazer: ({ res, me, b, id }) => send(res, 200, {...}) }`.
`quem` vazio = rota pública; `'logado'` = qualquer conta; `'cliente'`, `'operador'` ou `'admin'` = só esse perfil (o `server.js` já devolve 401/403). `b` é o corpo JSON do pedido e `id` é o número do `:id`. Um erro inesperado devolve 500 sem derrubar o servidor.

**Visual do painel (v5):** segue a home. Topo branco com o relógio, faixa verde com o título da tela e as abas encaixadas no conteúdo (função `tela()` em `painel.js`), conteúdo em `main.w`. O cartão de oferta tem o selo verde com o desconto e a barra de vagas livres (`livres/vagas`), que é o que explica o desconto. Listas usam `.lista` com `.principal` à esquerda e `.fim` à direita. O voucher é um ingresso (`.ingresso`). Os estilos do painel ficam em `app.css`, escopados por `body.app`, para não mexer no login.

**Cores e fontes:** ficam só em `public/css/base.css` (`--escuro`, `--medio`, `--lima` etc.). Nos outros CSS use `var(--nome)`, nunca o código da cor direto. As cores dentro dos ícones SVG no HTML ainda estão escritas direto.

Caminho no computador do Henry: `D:\VIAJE MAIS\Site` (o nome da pasta tem espaço; usar aspas em comandos).

## 4. Perfis de usuário

| Perfil | Valor no sistema | O que faz |
|---|---|---|
| Viajante | `cliente` | Vê ofertas, filtra por cidade e categoria, reserva, vê e cancela suas reservas, abre o voucher |
| Operador | `operador` | Cadastra passeios, publica ofertas (vagas por horário), valida códigos no local |
| Administrador | `admin` | Aprova passeios e vê a lista de usuários |

Contas de teste (criadas no `db.json` novo): `admin@viajemais.com` / `admin1234` e `operador@viajemais.com` / `operador1234` (o operador já tem o passeio aprovado "Rota dos fósseis").

## 5. Modelo de dados e regras de negócio

**Passeio** (cadastro do atrativo): título, cidade, preço normal, categoria (`Natureza`, `Cultura`, `Vinícola`, `Trilha`, `Gastronomia`), descrição. Nasce como **pendente** e só aparece depois que o admin aprova. Não pode ser apagado se já houver qualquer reserva ligada às suas ofertas (erro 409).

**Oferta** (vagas de um horário específico de um passeio aprovado): data e hora de início (futura), `vagas` (1 a 200), `descontoMax` (0 a 90%), `livres` (vagas restantes).

**Desconto dinâmico:**
```
pct = livres <= 0            -> 0
      faltam <= 2h           -> descontoMax        (última hora)
      senão                  -> round(descontoMax * livres / vagas)
```
Exemplo: passeio de R$ 80, 10 vagas, desconto máximo de 50%. Com 10 livres, 50% (R$ 40). Com 6 livres, 30% (R$ 56). Faltando 2 horas ou menos e ainda com vaga, volta a 50% e aparece o selo "Última hora".

**Reserva:** de 1 a 10 pessoas; exige nome e telefone com pelo menos 10 dígitos; só passa se `livres >= pessoas` (senão 409 "Restam só N vaga(s)"). Gera um código único de 8 caracteres e **trava o preço** do momento da reserva.

**Cancelamento:** permitido até **3 horas antes** do início (`HORAS_CANCELAR`). Devolve as vagas à oferta.

**Validação do código (operador):** não diferencia maiúsculas de minúsculas, vale **uma única vez**. Recusa código inexistente, já usado ou de reserva cancelada.

Constantes em `src/config.js`: `HORAS_ULTIMA = 2` e `HORAS_CANCELAR = 3`. As regras ficam em `src/regras.js` (desconto) e `src/rotas/ofertas.js` (reserva, cancelamento, validação).

## 6. Rotas principais da API

Públicas e de sessão: `POST /api/cadastro`, `POST /api/login`, `POST /api/logout`, `GET /api/me` (401 sem sessão).
Viajante: `GET /api/ofertas`, `GET /api/ofertas/:id`, `POST /api/reservas`, `GET /api/reservas`, `POST /api/reservas/:id/cancelar`.
Operador: `POST /api/operador/passeios`, `GET /api/operador/passeios`, `POST /api/operador/ofertas`, `POST /api/operador/validar`.
Operador também: `GET /api/operador/ofertas`, `DELETE /api/operador/passeios/:id`.
Admin: `GET /api/admin/usuarios`, `POST /api/admin/usuarios/:id/aprovar`, `DELETE /api/admin/usuarios/:id`, `GET /api/admin/passeios`, `POST /api/admin/passeios/:id/aprovar`.
Sobras da v1 que o painel não usa: `GET /api/passeios` e `POST /api/favoritos/:id`. A lista completa está em `src/rotas/`.

Perfil errado devolve 403 ("Você não tem permissão para isso").

## 7. Fluxo de telas

1. `/` é a **home verde**. "Entrar" leva a `/entrar.html`; "Começar agora" abre o cadastro direto (`/entrar.html#criar`); "Planejar viagem", "Buscar", cards e roteiros levam a `/painel.html`.
2. Depois de entrar ou criar conta, o usuário volta para a **home** (não para o painel). Logado, a home mostra "Meu painel" e "Ver ofertas".
3. O painel (`/painel.html`) é uma página única com rotas por hash, uma por perfil. O logo do painel volta para a home. Sessão expirada leva a `/entrar.html`; "Sair" volta para a home.
4. Voucher: tela com o código grande, botão de cancelar e cópia em `localStorage` (`vm_reservas`) para abrir sem internet.

## 8. PWA e cache

- O service worker (`sw.js`) usa estratégia "rede primeiro, cache como reserva", nunca guarda `/api/` e tem versão no nome do cache (hoje `vm-v5`).
- **Sempre que mudar um arquivo de `public/`, aumentar a versão do cache** (`vm-v6` etc.) e avisar o Henry para apertar **Ctrl + Shift + R**. Cache antigo foi a causa de telas "que não mudavam".
- **Arquivo novo em `public/`** (CSS, JS, imagem) que a tela precisa sem internet: incluir na lista `SHELL` do `sw.js`.
- Instalar como app exige **HTTPS**. Em `localhost` funciona só no computador. Para testar no celular, usar `ngrok http 3000`.

## 9. Pendências e ideias (nada disso está feito)

- Pix e QR code no voucher (hoje é código em texto).
- Entrar com Google (rota devolve 501).
- Mostrar ofertas reais de última hora na home, no lugar dos roteiros de exemplo.
- Páginas por cidade e por roteiro (hoje todos os cards levam ao painel).
- Newsletter da home (só mostra "Em breve!", não grava nada).
- Avaliações, notificações de última hora, pacotes passeio + jantar, painel de comissão do admin.
- Investigar a lentidão ao criar conta relatada pelo Henry. No servidor o cadastro leva cerca de 0,05 s, então a causa provável é carregamento das fontes do Google, antivírus ou internet; falta a medição no computador dele (F12, aba Network).

## 10. Regras de trabalho

- **Idioma:** português do Brasil, em tudo (conversa, comentários, textos da interface). O Henry está aprendendo; explique de forma simples, com exemplos, e diga o que mudou e por quê.
- **Home verde:** o layout veio do arquivo `Viaje_Mais___Verde-html.zip`. Mudanças visuais na home só com pedido do Henry. Os textos entre colchetes (`[Foto principal da região]`, `[Depoimento do viajante]`, `[X] dias`) são espaços a preencher, não erros.
- **Nada de dados inventados** em páginas que parecem reais (depoimentos, números, parceiros). Se não existe, deixe o espaço marcado ou diga "Em breve".
- **Teste antes de entregar:** `node --check` nos arquivos JS, subir o servidor numa porta livre e testar com `curl` (sucesso e erro de cada regra de negócio). Apagar o `db.json` de teste depois.
- **Testar dois perfis ao mesmo tempo** exige navegadores ou janelas separados (por exemplo, Chrome normal e janela anônima). O cookie é o mesmo em todas as abas do mesmo navegador, e um segundo login derruba o primeiro. Isso já causou o erro "Você não tem permissão para isso".
- **Ofertas só aparecem para o viajante se:** o passeio estiver aprovado, o horário for futuro e houver vagas livres.
- **Segurança:** manter validação no servidor (nunca confiar só no navegador), escapar texto na tela (`esc()`), cookie HttpOnly e senha com scrypt. Não gravar senha em texto.
- **Entregas:** gerar a pasta e o `.zip` da versão (`viaje-mais-v3` e seguintes), atualizar o `LEIA-ME.md` e dizer ao Henry como testar.
- **Windows:** não sugerir Chocolatey para instalar Node. Se `node` não for reconhecido, fechar e reabrir o terminal. Rodar sempre a partir da pasta do projeto.

## 11. Como rodar

```
cd "D:\VIAJE MAIS\Site"
node server.js
```
Abrir `http://localhost:3000`. Parar com Ctrl + C. Antes de iniciar uma versão nova, feche o servidor antigo (um servidor antigo ainda aberto responde pelas rotas velhas).
