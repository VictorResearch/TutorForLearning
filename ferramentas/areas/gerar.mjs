// Gera os plugins de áreas (matemática, física, química, biologia, programação, vestibular)
// a partir de areas.json: didática + memória + interativos de ciências como dependência.
//   node ferramentas/areas/gerar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const plugins = path.resolve(aqui, "..", "..", "plugins");
const areas = JSON.parse(fs.readFileSync(path.join(aqui, "areas.json"), "utf-8"));
const memoria = fs.readFileSync(path.join(aqui, "memoria.md"), "utf-8");
const ciencias = JSON.parse(fs.readFileSync(path.join(plugins, "interativos-ciencias", "plugin.json"), "utf-8"));

for (const a of areas) {
	const dir = path.join(plugins, a.id);
	fs.mkdirSync(path.join(dir, "lh"), { recursive: true });
	const widgets = a.interativos.map((id) => ciencias.interativos.widgets.find((w) => w.id === id)).filter(Boolean);
	const lista = widgets.length ? `\n## Interativos desta área\n\n${widgets.map((w) => `- \`interativos-ciencias/${w.id}\` — ${w.nome}: ${w.descricao}`).join("\n")}\n` : "";
	fs.writeFileSync(path.join(dir, "lh", "didatica.md"), a.didatica + lista);
	fs.writeFileSync(path.join(dir, "lh", "memoria.md"), memoria);
	const manifesto = {
		id: a.id,
		name: a.name,
		version: "1.0.0",
		description: a.description,
		esquema: 2,
		app: ">=0.4 <1",
		licenca: "CC-BY-SA-4.0",
		autores: ["VictorResearch", "colaboradores do TutorForLearning"],
		repositorio: "https://github.com/VictorResearch/TutorForLearning",
		...(widgets.length ? { dependencias: { "interativos-ciencias": "^1.0" } } : {}),
		prompts: { prober: ["lh/didatica.md"], teacher: ["lh/didatica.md"], practice: ["lh/didatica.md"] },
		memory: { enabled: true, doctrine: "lh/memoria.md" },
	};
	fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(manifesto, null, "\t") + "\n");
}
console.log(`${areas.length} plugins de área gerados`);
