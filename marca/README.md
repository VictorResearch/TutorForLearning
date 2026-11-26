# Marca do app (nome e ícone)

O app (Windows, Mac, Android e web) e o site leem `marca.json` daqui ao abrir. Para mudar:

- **Nome:** edite `"nome"` em `marca.json` (no GitHub: abrir o arquivo → lápis → Commit).
- **Ícone:** troque `icone.png` por outra imagem quadrada (PNG, 512×512 ou maior, até 4 MB). Para usar outro arquivo,
  aponte `"icone"` para a URL `https://raw.githubusercontent.com/...` dele. `"icone": ""` volta ao símbolo de fábrica.
- **Aviso de autoria:** `"aviso"`.

Os apps instalados pegam a mudança na próxima vez que abrirem (o GitHub pode levar até ~5 min para servir o arquivo
novo). Sem internet, vale a última marca guardada no aparelho.

O que só muda num instalador novo (o sistema grava no momento da instalação): o nome do atalho no Menu Iniciar, na Dock
e na tela inicial do Android, e o nome do arquivo do instalador. A pasta de dados continua "LearnHarness" (nome antigo) de propósito,
para nenhuma instalação perder os estudos.
