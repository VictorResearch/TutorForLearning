# Kit para criar plugins do LearnHarness (OpenCode e outros agentes)

Este diretório é um kit para criar plugins do LearnHarness / TutorForLearning. Antes de qualquer coisa, leia `.claude/skills/criar-plugin/SKILL.md`: as instruções valem para qualquer agente, não só para o Claude Code.

Regras:
- Um plugin é uma pasta com `plugin.json` (veja `plugin.schema.json`) e arquivos de texto, dados e widgets `.html`. Nunca coloque programas (.js solto, .py, .exe, scripts).
- Comece copiando `plugin-modelo/`.
- Depois de cada mudança, rode `node lh-plugin.mjs verificar <pasta-do-plugin>`.
- **Só diga que o plugin está pronto quando o verificador mostrar `PASSOU`.** Corrija todo `✗` e explique cada `!` ao usuário.
- Escreva em português.
