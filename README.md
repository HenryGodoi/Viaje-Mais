# Viaje Mais

PWA de turismo para a **Quarta Colônia (RS)**. Mostra as vagas que sobraram em passeios, museus, vinícolas e trilhas, com desconto: quanto mais vazio o horário, maior o desconto. O turista reserva pelo celular e recebe um código para usar no local, mesmo sem internet.

Projeto campeão do **Ideathon 2026**. Próxima etapa: Startcup.
Equipe: Henry Azambuja Godoi (desenvolvimento), Enzo Ueno e Samuel Fritz.

## Onde está cada coisa

| Pasta | O que tem |
|---|---|
| [`frontend/`](frontend/) | O que aparece na tela: páginas, estilos e o JavaScript que roda no navegador |
| [`backend/`](backend/) | O servidor: regras de negócio, login e a API (`/api/...`) |
| [`banco-de-dados/`](banco-de-dados/) | Onde os dados ficam (o arquivo `db.json`, que não vai para o GitHub) e a estrutura deles |

Cada pasta tem o seu README explicando o que é cada arquivo. Na raiz ficam só o `server.js`, que liga o backend, e o atalho `INICIAR.bat`.

## O problema e a ideia

Passeios saem com vagas sobrando: o dono gasta o mesmo e ganha menos. Ao mesmo tempo, muitos turistas deixam de passear por achar caro. O Viaje Mais junta os dois lados, inspirado no app Primeira Mesa (descontos em restaurantes nos horários vazios), e reúne em um só lugar as atrações das nove cidades da região: Agudo, Dona Francisca, Faxinal do Soturno, Ivorá, Nova Palma, Pinhal Grande, Restinga Sêca, São João do Polêsine e Silveira Martins.

## Como rodar

Requisito: [Node.js](https://nodejs.org) 18 ou mais novo (usamos o 22 LTS). Não precisa instalar pacotes.

```bash
node server.js
```

Abra http://localhost:3000. No Windows, também dá para dar dois cliques em `INICIAR.bat`.

Para usar outra porta: `PORT=4000 node server.js` (no PowerShell: `$env:PORT=4000; node server.js`).

Na primeira execução o servidor cria o arquivo `banco-de-dados/db.json` com dados de demonstração. Para começar do zero, feche o servidor e apague esse arquivo.

### Contas de teste

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@viajemais.com` | sorteada no primeiro uso e mostrada no terminal |
| Operador de turismo | `operador@viajemais.com` | sorteada no primeiro uso e mostrada no terminal |
| Viajante | crie pela tela "Criar conta" | |

Anote as senhas quando o servidor criar o banco: elas não aparecem de novo. Para trocar a senha de qualquer conta, com o servidor desligado: `node backend/trocar-senha.js <e-mail> <nova senha>`.

O operador de teste já tem o passeio aprovado "Rota dos fósseis".

### Roteiro para testar (fluxo do pitch)

1. Entre como **operador**, abra a aba Vagas e publique uma oferta (data futura, número de vagas, desconto máximo).
2. Em outra janela anônima, entre como **viajante**: veja a oferta, reserve e receba o código.
3. Volte ao operador, abra **Validar código** e digite o código. Usar o mesmo código de novo é recusado.

Dois perfis ao mesmo tempo precisam de navegadores ou janelas anônimas separadas: o login vale para todas as abas do mesmo navegador.

## O que já funciona

- **Página inicial** com o quadro "Próximas saídas": as próximas vagas reais aparecem mesmo sem login. A busca e cada saída levam ao login e, depois dele, direto para as ofertas filtradas ou para a oferta escolhida.
- **Desconto dinâmico:** `desconto = descontoMax × vagas livres ÷ vagas`. Faltando 2 horas ou menos, vai ao desconto máximo e aparece o selo "Última hora".
- **Reserva** de 1 a 10 pessoas, com nome e telefone. O preço fica travado no momento da reserva. Se as vagas acabarem durante a reserva, o app avisa.
- **Voucher** com código de 8 caracteres, salvo no aparelho para abrir sem internet.
- **Cancelamento** pelo viajante até 3 horas antes, com as vagas devolvidas à oferta.
- **Validação do código** pelo operador no local, uma única vez.
- **Perfil do viajante:** foto, nome e telefone, troca de senha, exclusão da conta, histórico de reservas e quanto já economizou com os descontos.
- **Três perfis:** viajante (ofertas, reservas, voucher), operador (passeios, vagas, validação) e administrador (aprova operadores e passeios).
- **Segurança:** senhas com scrypt e sal aleatório, sessão em cookie HttpOnly, validação de tudo no servidor e texto escapado na tela.
- **PWA:** instalável e com cache offline das telas.

## Estrutura

```
server.js                  ponto de partida: só liga o backend
INICIAR.bat                dois cliques para ligar no Windows
frontend/                  o que o navegador baixa (cada arquivo é um endereço do site)
  index.html               página inicial
  entrar.html              login e cadastro
  painel.html              área logada (viajante, operador, administrador)
  css/                     base.css (cores e fontes), home.css, app.css
  js/                      home.js, entrar.js, painel.js
  sw.js                    service worker (cache offline)
backend/                   o servidor
  servidor.js              entrega o frontend ou chama a rota da API
  config.js                constantes (porta, categorias, 2h de última hora, 3h para cancelar)
  banco.js                 lê e grava banco-de-dados/db.json
  dados-demonstracao.js    contas de teste do primeiro uso
  seguranca.js             senhas e código do voucher
  sessoes.js               login por cookie
  regras.js                cálculo do desconto
  rotas/                   API: conta.js, perfil.js, passeios.js, ofertas.js
banco-de-dados/            db.json (fora do GitHub) e a explicação da estrutura dos dados
```

Sem dependências: o servidor usa só módulos nativos do Node.js e os dados ficam num arquivo JSON. As rotas da API estão nos arquivos de `backend/rotas/`.

## Testar no celular

O PWA só instala em endereço seguro (HTTPS). No computador, `localhost` já funciona. Para abrir no celular, use o [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

e abra o endereço `https` que ele mostrar.

Depois de atualizar o código, aperte **Ctrl + Shift + R** no navegador para não ficar com a versão antiga guardada no cache.

## Ainda não feito

- Pagamento por Pix e QR code no voucher (hoje a reserva gera só o código).
- Entrar com Google (o botão existe, mas falta configurar o Client ID).
- Páginas por cidade e por roteiro.
- Newsletter, avaliações, avisos de última hora por notificação ou WhatsApp, pacotes passeio + jantar e painel de comissão.
- Para produção: banco de dados de verdade, HTTPS e recuperação de senha.
