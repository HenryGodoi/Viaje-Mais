# Plano do novo design do Viaje Mais

Plano que vai crescendo: a cada componente ou ideia que o Henry manda, entra uma seção aqui.

**Situação (v10, 29/10/2026):** as seções 1 a 4 estão feitas. Falta conferir a leitura do QR num celular Android de verdade: no computador ela foi testada com câmera e leitor simulados. Diferença do plano: no spinner, o texto do botão não muda para "Entrando…"; o botão fica travado e o resultado aparece na mensagem embaixo.

## Regra que muda tudo

Os exemplos que o Henry mandou são **React + Tailwind** (biblioteca Spell UI, `@/registry/spell-ui/...`). O site é **HTML, CSS e JS puros, sem npm e sem build** (decisão do `CLAUDE.md`).

Plano: **não colar o código React**. Refazer cada componente em CSS e JS puros, com o mesmo visual e o mesmo movimento. Assim o site continua sem dependências e o voucher continua abrindo sem internet.

Cada componente novo vira classes em `frontend/css/app.css` (cores sempre por `var(--nome)` do `base.css`) e, quando precisar de movimento, uma função pequena em JS.

## 1. Campos do login com rótulo flutuante (LabelInput)

**O que é:** o rótulo ("E-mail", "Senha") fica dentro do campo, como se fosse o placeholder. Ao clicar ou digitar, ele sobe e fica pequeno na borda do campo. Ao focar, aparece um anel colorido em volta.

**Onde entra:** `frontend/entrar.html` (e-mail, senha, nome, confirmar senha). Depois pode ir para os formulários do painel.

**Como fazer sem React:**
- HTML: `<div class="campo"><input id="email" placeholder=" "><label for="email">E-mail</label></div>`, com o `label` depois do `input`.
- CSS: `.campo input:focus + label, .campo input:not(:placeholder-shown) + label` sobe o rótulo. O anel é um `box-shadow` no `:focus-visible`.
- Sem JS. O preenchimento automático do navegador também precisa subir o rótulo (`:autofill`).

**Ajustes ao exemplo:**
- "Username or Gmail" vira **"E-mail"**: o login é só por e-mail, não existe nome de usuário.
- O anel azul (`ringColor="blue"`) vira **verde** (`--medio`): o novo design continua com a paleta "Viaje Mais — Verde" (decidido pelo Henry em 29/10/2026).

## 2. Spinner de carregamento

**O que é:** um círculo girando enquanto algo carrega.

**Onde entra:**
- Dentro do botão enquanto `aoEnviar` espera a resposta (hoje o botão só fica apagado). Vale para Entrar, Criar conta, Reservar, Publicar oferta e Validar.
- No lugar do conteúdo enquanto uma tela do painel carrega.

**Como fazer sem React:** um `<span class="spinner" aria-hidden="true">` com `border` e `@keyframes` de rotação. Com "reduzir movimento" ligado no aparelho, ele pisca devagar em vez de girar. O texto do botão muda para "Entrando…", para quem usa leitor de tela.

## 3. Voucher como cartão que inclina (TiltCard)

**O que é:** o voucher vira um cartão no formato de cartão de crédito que inclina seguindo o mouse ou o dedo (até 10°) e cresce um pouco (5%). É o que o viajante mostra ao vendedor no local.

**Onde entra:** tela `#/voucher/ID` (`vVoucher` em `frontend/js/painel.js`), no lugar do `.ingresso`.

**O que vai no cartão** (troca dos dados do exemplo):

| No exemplo | No voucher |
|---|---|
| Logo Spell | Logo do Viaje Mais |
| Logo Visa | Selo do status (Confirmada, Usada, Cancelada) |
| John Doe | Nome de quem reservou |
| Número do cartão | **QR code** com o **código de 8 letras embaixo** |
| Exp. 12/25 | Data e hora do passeio |
| (não tem) | Título do passeio, cidade, pessoas e total |

**Como fazer sem React:**
- CSS: `perspective: 1200px` no contêiner e `transform: rotateX() rotateY() scale(1.05)` no cartão.
- JS (cerca de 15 linhas): no `pointermove`, calcula a posição do mouse ou dedo no cartão e vira isso em graus, até 10°. No `pointerleave`, volta reto.
- Com "reduzir movimento" ligado, o cartão fica parado.
- Voucher usado ou cancelado: fica cinza e não inclina.
- O QR e o código precisam ficar **retos e grandes** na hora de mostrar ao vendedor. Ideia: um toque no cartão para a inclinação e aumenta o QR.

**QR code:** hoje o voucher é só o código em texto (está nas pendências do `CLAUDE.md`). O QR precisa ser desenhado **no próprio celular**, a partir do código salvo em `vm_reservas`, para funcionar sem internet. Gerador escolhido: ver "Decidido".

## 4. Vendedor lendo o QR com a câmera

**Decidido:** fazer agora (Henry, 29/10/2026), com digitar o código como reserva.

**Onde entra:** tela "Validar" do operador (`frontend/js/painel.js`, onde fica o campo `codigo-input`).

**Como fazer:**
- O QR guarda **só o código de 8 letras**. Assim a validação no servidor (`POST /api/operador/validar`) não muda nada.
- Botão "Ler QR code" ao lado do campo. Ele abre a câmera de trás (`getUserMedia` com `facingMode: 'environment'`) num `<video>` na própria tela.
- O `BarcodeDetector` do navegador procura um QR na imagem algumas vezes por segundo. Achou: desliga a câmera, preenche o campo e valida pelo mesmo caminho do botão "Validar" (`aoEnviar`), para não validar duas vezes.
- A câmera desliga ao sair da tela ou ao tocar em "Fechar".
- Câmera negada ou sem câmera: aviso em português e o campo de digitar continua ali.

**Limites:**
- O `BarcodeDetector` funciona no **Chrome do Android**. Não funciona no **iPhone** nem no **Chrome do Windows**. Nesses, o botão nem aparece e o vendedor digita o código.
- A câmera só abre em **HTTPS** ou em `localhost`. Para testar no celular, usar `ngrok http 3000`.
- Para ler também no iPhone depois: copiar um leitor pronto (por exemplo o `jsQR`, licença Apache 2.0), do mesmo jeito do gerador.

## Decidido

- **Tecnologia:** o site continua em HTML, CSS e JS puros (Henry, 29/10/2026). React com Tailwind foi considerado e ficou de fora: exigiria npm, build e reescrever as três telas e o `sw.js`. Os exemplos da Spell UI servem só de referência visual.
- **Paleta:** a "Viaje Mais — Verde" foi trocada pela paleta marinho, céu, branco e laranja, na regra 60-30-10 (Henry, 01/11/2026). Todas as peças novas usam as cores do `base.css`.
- **Gerador de QR:** copiar um arquivo pronto (Henry, 29/10/2026). Candidato: `js/qrcode.js` do projeto `qrcode-generator` de Kazuhiko Arase (licença MIT, um arquivo só, sem npm, muito usado). Entra como `frontend/js/qrcode.js`, com o aviso de licença no topo do arquivo, e na lista `SHELL` do `sw.js`. O voucher desenha o QR com `createSvgTag()`, a partir do código da reserva.
- **Câmera:** o vendedor lê o QR pela câmera já nesta mudança, no Chrome do Android, e digitar o código continua valendo (Henry, 29/10/2026). Detalhes na seção 4.

## Ainda esperando

O Henry vai mandar mais componentes, exemplos e ideias. Cada um entra aqui como uma seção nova. Depois que tudo estiver no plano, a ordem de trabalho sugerida é: base visual (cores, fontes) → login → spinner → voucher com QR → leitura pela câmera → resto do painel → home.

Ao mexer em `frontend/`, lembrar: subir a versão do cache no `sw.js` e incluir arquivo novo na lista `SHELL`.
