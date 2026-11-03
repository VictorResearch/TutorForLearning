# Como contribuir

Obrigado por ajudar! Toda contribuição passa pelo mesmo caminho: **pull request → verificador no CI → revisão humana → registro**.

## Plugins novos ou melhorias
1. Faça um fork e crie uma branch.
2. Crie ou edite a pasta `plugins/<id>/` (o nome da pasta é o `id` do `plugin.json`). Comece pelo [`kit/plugin-modelo`](kit/plugin-modelo) e leia a [skill do kit](kit/.claude/skills/criar-plugin/SKILL.md): ela vale para pessoas também.
3. Rode o verificador (Node 20+, sem instalar nada):
   ```bash
   node kit/lh-plugin.mjs verificar plugins/<id> --registro plugins
   ```
   Corrija todo `✗` (bloqueio). Explique no PR os `!` (avisos) que ficarem.
4. Teste no app: Configurações → Plugins → "pastas extras" → `plugins/` do seu clone → ligue o plugin e abra uma sessão.
5. **Mudou um plugin publicado?** Suba a `version` (semver): correção = `1.0.1`, recurso novo = `1.1.0`, mudança que quebra = `2.0.0`.
6. Abra o PR usando o modelo. O CI roda o verificador em todos os plugins e confere o `registro.json`.

## Conteúdo médico e científico
- Cite a fonte (diretriz, protocolo, livro) no `referencia` dos fluxogramas e nos textos.
- **Não copie** trechos de livros, apostilas de cursinho, provas ou bancos de questões pagos. Escreva com suas palavras.
- Fluxogramas e casos clínicos de medicina passam por revisão de pelo menos uma pessoa da área antes de entrar.
- Nada de dado de paciente, nem anonimizado de forma fraca.

## Interativos (widgets)
- Um arquivo `.html` autocontido, sem rede, sem script externo, sem `eval`. O estado sai por `lh.enviar(...)`.
- Os widgets de `interativos-ciencias` são gerados: edite `ferramentas/widgets/fontes/*.js` e rode `node ferramentas/widgets/gerar.mjs`.

## Código (verificador, geradores)
O verificador (`kit/lh-plugin.mjs`) é gerado a partir do código do app. Para mudar uma regra, abra uma issue descrevendo o caso.

## Conduta
Siga o [Código de Conduta](CODE_OF_CONDUCT.md). Falhas de segurança: veja [SECURITY.md](SECURITY.md), nunca numa issue pública.
