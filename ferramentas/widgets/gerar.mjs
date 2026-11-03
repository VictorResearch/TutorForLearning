// Gera os widgets do plugin interativos-ciencias: cada widget é UM .html autocontido
// (o verificador exige: sem rede, sem script externo). O que se repete — estilo, controles
// deslizantes e o desenho de gráficos em canvas — vem de base.js e base.css, embutidos em cada arquivo.
//   node ferramentas/widgets/gerar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..", "..");
const destino = path.join(raiz, "plugins", "interativos-ciencias", "widgets");
const base = fs.readFileSync(path.join(aqui, "base.js"), "utf-8");
const css = fs.readFileSync(path.join(aqui, "base.css"), "utf-8");
fs.mkdirSync(destino, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(path.join(aqui, "fontes")).sort()) {
	if (!f.endsWith(".js")) continue;
	const corpo = fs.readFileSync(path.join(aqui, "fontes", f), "utf-8");
	const titulo = /^\/\/ (.+)/.exec(corpo)?.[1] ?? f;
	const html = `<!doctype html>
<html lang="pt-BR">
<head>
<title>${titulo}</title>
<style>
${css}</style>
</head>
<body>
<div id="controles"></div>
<canvas id="tela" width="720" height="380"></canvas>
<div id="saida"></div>
<script>
${base}
${corpo}
</script>
</body>
</html>
`;
	fs.writeFileSync(path.join(destino, f.replace(/\.js$/, ".html")), html);
	n++;
}
console.log(`${n} widgets em ${path.relative(raiz, destino)}`);
