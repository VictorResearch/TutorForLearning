# TutorForLearning

Repositório público dos plugins do LearnHarness. Para criar ou mudar um plugin, siga a skill `kit/.claude/skills/criar-plugin/SKILL.md`.
- Verificador: `node kit/lh-plugin.mjs verificar plugins/<id> --registro plugins` (só está pronto com PASSOU).
- Widgets de `interativos-ciencias`: edite `ferramentas/widgets/fontes/*.js` e rode `node ferramentas/widgets/gerar.mjs`.
- Plugins de área: edite `ferramentas/areas/areas.json` e rode `node ferramentas/areas/gerar.mjs`.
- Depois de mudar plugins, refaça o registro: `node kit/lh-plugin.mjs registro plugins --saida registro.json --base https://raw.githubusercontent.com/VictorResearch/TutorForLearning/main/ --pacotes pacotes.json`.
