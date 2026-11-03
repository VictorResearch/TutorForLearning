# Kit para criar plugins

Tudo o que você (ou o seu agente de IA) precisa para criar um plugin do LearnHarness:

| Arquivo | Para quê |
|---|---|
| `.claude/skills/criar-plugin/SKILL.md` | a skill do **Claude Code** (abra o Claude Code nesta pasta e peça "cria um plugin de farmacologia") |
| `AGENTS.md` | as mesmas instruções para o **OpenCode** e outros agentes |
| `plugin-modelo/` | um plugin mínimo para copiar: prompts, memória, um fluxograma e um interativo de exemplo |
| `plugin.schema.json` | o contrato v2 em JSON Schema (o editor completa os campos) |
| `lh-plugin.mjs` | o **verificador** (o mesmo código do app e do CI), sem dependências: só Node 20+ |

## Começar
```bash
cp -r plugin-modelo meu-plugin        # o nome da pasta = o id do plugin
node lh-plugin.mjs verificar meu-plugin
```
Teste no app: Configurações → Plugins → "pastas extras" → a pasta do kit → ligue o plugin.

## Publicar
Faça um fork de [VictorResearch/TutorForLearning](https://github.com/VictorResearch/TutorForLearning), coloque a pasta em `plugins/<id>/` e abra um pull request. O CI roda o verificador e, aprovado, o plugin entra no registro aberto que o app lê (Configurações → Comunidade → Registro aberto).
