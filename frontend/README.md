# frontend

O que roda no navegador: HTML, CSS e JavaScript puros, sem framework e sem etapa de build.

Cada arquivo desta pasta é um endereço do site: o backend entrega `frontend/js/painel.js` como `/js/painel.js`, por exemplo. Por isso nada aqui muda de nome ou de lugar sem mudar também os links e o service worker.

| Arquivo | O que é |
|---|---|
| `index.html` | Página inicial (`/`): busca e quadro "Próximas saídas" |
| `entrar.html` | Login e cadastro (`/entrar.html`) |
| `painel.html` | Área logada do viajante, do operador e do administrador (`/painel.html`) |
| `css/base.css` | Cores e fontes usadas em todas as páginas |
| `css/home.css` | Estilos da página inicial |
| `css/app.css` | Estilos do login e do painel |
| `js/home.js` | Busca, quadro de saídas e "Meu painel" na página inicial |
| `js/entrar.js` | Login, cadastro e a volta para a tela de onde a pessoa veio |
| `js/painel.js` | Todas as telas do painel |
| `js/qrcode.js` | Gerador de QR code do voucher, copiado sem mudanças do `qrcode-generator` 2.0.4 (licença MIT). Desenha o QR no próprio aparelho, sem internet |
| `sw.js` | Service worker: guarda as telas para abrir sem internet. Fica na raiz da pasta para valer no site todo |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png` | Nome e ícones para instalar como aplicativo |

## Regras

- O frontend só conversa com o backend pelos endereços `/api/...`.
- Texto da API colocado dentro de HTML (template string) passa por `esc()`. Com `textContent` não precisa, porque ele já mostra o texto como texto.
- As cores e fontes ficam só em `css/base.css`. Nos outros arquivos, use `var(--nome)`.
- Mudou um arquivo daqui? Aumente a versão do cache no `sw.js` (`vm-v10`, `vm-v11`…). Arquivo novo que precisa abrir sem internet entra na lista `SHELL` do `sw.js`.
