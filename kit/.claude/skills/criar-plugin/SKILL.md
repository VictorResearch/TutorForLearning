---
name: criar-plugin
description: Cria, corrige ou atualiza um plugin do LearnHarness / TutorForLearning (pasta com plugin.json — prompts de didática, memória do estudante, banco de notas, voz, anatomia 3D, fluxogramas clínicos, interativos em HTML) e só o declara pronto quando o verificador passa sem bloqueios. Use quando pedirem "cria um plugin de X", "um plugin para estudar Y", "adiciona um fluxograma / interativo", "atualiza o plugin", "publica o plugin", "por que o verificador barrou?".
---

# Criar plugin do LearnHarness

Um **plugin** é uma PASTA com um `plugin.json` (o manifesto) e os arquivos que ele cita. O app compõe esses arquivos nos agentes (sondagem, ensino, prática) e liga recursos que o próprio app implementa. **Plugin nunca leva programa:** só texto (md, yaml, json), dados (glb, swc, imagens) e widgets `.html` que rodam numa caixa de areia. O contrato completo está em `plugin.schema.json`, ao lado deste kit.

## Regra que não se quebra
**Só declare o plugin pronto quando `node lh-plugin.mjs verificar <pasta>` terminar em `PASSOU`.** Avisos (`!`) se discutem com o usuário; bloqueios (`✗`) se corrigem. Rode o verificador depois de cada mudança.

## Fluxo
1. **Entender o pedido:** área, público (ensino médio, graduação, residência), o que o tutor deve fazer diferente com o plugin, e se há conteúdo próprio (notas, fluxogramas, interativos).
2. **Escolher os recursos** (combine só o necessário):
   | Recurso | Quando | Campo |
   |---|---|---|
   | Prompts | didática da área: ordem de ensino, erros típicos, como perguntar | `prompts.{prober,teacher,practice}` → arquivos `.md` |
   | Memória | o tutor deve lembrar entre sessões e agendar revisão | `memory: {enabled, doctrine}` |
   | Banco de notas | o plugin traz conteúdo próprio para o tutor ler | `base: {path}` (no outro PC vale o banco do perfil) |
   | Casos clínicos | sessões de caso no agente de prática | `cases` |
   | Voz | o tutor fala | `voz` (o app instala o Piper; o plugin só lista vozes) |
   | Anatomia 3D | modelos 3D | `anatomia.pacotes` (zip hospedado: `url` https + `sha256` + host em `permissoes.baixar`) |
   | Fluxogramas | algoritmos de conduta estudados por recordação | `fluxogramas.arquivos` → `.yaml` |
   | Interativos | um conceito que muda com parâmetros | `interativos.widgets` + `permissoes.interativos: true` |
3. **Copiar `plugin-modelo/`** para a pasta nova (o nome da pasta = o `id`), preencher o `plugin.json` e escrever os arquivos.
4. **Verificar** (`node lh-plugin.mjs verificar <pasta>`), corrigir, repetir até `PASSOU`.
5. **Testar no app:** Configurações → Plugins → adicionar a pasta (campo "pastas extras") → ligar → abrir uma sessão e conferir que o tutor usa o plugin (pergunte algo da área; peça um fluxograma ou interativo).
6. **Exportar** (Configurações → Pacotes → exportar plugin → `.lhpack`) para mandar a amigos, **ou publicar** no registro aberto: fork do repositório `VictorResearch/TutorForLearning`, pasta em `plugins/<id>/`, pull request. O CI roda o mesmo verificador.

## Escrever bons prompts (`lh/*.md`)
- Escreva em português, curto e operacional: o que o tutor FAZ, em que ordem, que erros caçar. Não repita o que o app já faz (o método de ensino geral, as ferramentas).
- Sem instruções que tentem desligar regras do app, pedir chaves ou senhas, ou mandar dados para fora: o verificador avisa, e o plugin será recusado na revisão.
- Cada agente recebe só o que lhe serve: `prober` (sondar), `teacher` (ensinar), `practice` (praticar/revisar).
- O texto total por agente deve ficar abaixo de ~20 mil caracteres.

## Fluxograma (`fluxos/*.yaml`)
```yaml
id: sepse                       # minúsculas, - e _
titulo: Sepse — a primeira hora
area: infectologia
referencia: Surviving Sepsis Campaign 2021
inicio: suspeita
nos:
  - id: suspeita
    tipo: inicio                # inicio | decisao | conduta | exame | desfecho
    texto: Suspeita de infecção com disfunção orgânica
    vai: [{para: lactato}]
  - id: lactato
    tipo: exame
    texto: Lactato e hemoculturas antes do antibiótico
    nota: micro.sepse-antimicrobianos   # a nota do banco que sustenta o passo (opcional)
    porque: …                            # usado nas perguntas de justificativa
    erros_comuns: [Esperar a cultura para começar o antibiótico]   # viram distratores
    vai:
      - {para: antibiotico}
```
Decisões têm 2+ saídas, cada uma com `se`. Todo nó precisa ser alcançável a partir do `inicio`. O verificador confere.

## Interativo (`widgets/*.html`)
Um arquivo HTML **autocontido**: CSS e JS inline, sem `<script src>`, sem `fetch`/`XMLHttpRequest`/`WebSocket`, sem `eval`/`Function`, sem `parent`/`top` (exceto `postMessage`), sem `localStorage`/cookies, sem imagens por URL (use `data:` ou desenhe em canvas/SVG). O app injeta `window.lh`:
```js
lh.parametros                 // os parâmetros (padrões do manifesto + os do tutor)
lh.aoReceber(function (p) {}) // chamado agora e quando o tutor mudar parâmetros
lh.enviar({a: 1, raizes: [1, 3]})  // o ESTADO: é por ele que o app corrige o desafio
```
- Declare no manifesto `descricao` com os **campos do estado** — o tutor monta os critérios por eles (`{campo: "vertice.x", perto: 1}`).
- Biblioteca disponível: `"bibliotecas": ["d3"]` (o app injeta; o widget nunca baixa nada).
- Modelo pronto: `plugin-modelo/widgets/exemplo.html`. Mais exemplos: `plugins/interativos-ciencias/` no repositório (gerados de `ferramentas/widgets/`).

## Exemplos completos no repositório
- `plugins/matematica`, `plugins/fisica` … — só prompts + memória, dependendo dos interativos.
- `plugins/medicina` — prompts por agente, memória e casos.
- `plugins/voz`, `plugins/anatomia-3d` — recursos com dados baixados (url + sha256).
- `plugins/fluxogramas` — algoritmos clínicos.
- `plugins/interativos-ciencias` — 12 widgets.

## Erros comuns do verificador
| Mensagem | Correção |
|---|---|
| `arquivo executável ou de script (.js)` | JS vai DENTRO do .html do widget |
| `URL sem https` / `url sem sha256` / `não está em permissoes.baixar` | só https, sempre com sha256, host declarado |
| `widget usa fetch()` | widget não acessa rede: os dados vêm por `lh.parametros` ou embutidos |
| `depende de "x", que não está instalado` | instale a dependência ou tire de `dependencias` |
| `usa "interativos", que só existe a partir do app 0.4.0` | `"app": ">=0.4 <1"` |
| `nós que não se alcançam` | ligue o nó com um `vai` a partir do início |
