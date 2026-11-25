# TutorForLearning — plugins abertos do LearnHarness

*[English below](#english)*

Plugins, kit e registro aberto para o **LearnHarness**, um tutor de estudo com IA que roda no seu computador. Ele ensina pelo porquê, lembra do que você errou e agenda a revisão. Este repositório é o **ecossistema aberto**: qualquer pessoa pode usar, melhorar e criar plugins.

> **Versão modificada.** Este é um fork do [LearnHarness](https://github.com/amosblomqvist/learnharness) (de Amos Blomqvist, AGPL-3.0), **modificado por Victor Gonçalves Soares**. Não é afiliado ao autor original.
> *Modified version: a fork of [LearnHarness](https://github.com/amosblomqvist/learnharness) (AGPL-3.0), modified by Victor Gonçalves Soares; not affiliated with the original author.*

## Baixar o app
Os instaladores (Windows, Mac Apple Silicon e Intel, Android) ficam em [**Releases**](https://github.com/VictorResearch/TutorForLearning/releases/latest).
Nome e ícone do app são editáveis sem reinstalar: veja [`marca/`](marca).

## O que tem aqui
| Pasta | O que é |
|---|---|
| [`plugins/`](plugins) | os plugins publicados: medicina, fluxogramas clínicos, anatomia 3D, voz do tutor, interativos de ciências, matemática, física, química, biologia, programação, vestibular/ENEM, flashcards (Anki), resumos em tópicos (RemNote) |
| [`kit/`](kit) | o **kit para criar plugins**: skill para o Claude Code, instruções para o OpenCode, modelo pronto, esquema do manifesto e o **verificador** |
| [`registro.json`](registro.json) | o índice que o app lê para instalar plugins (gerado pelo CI) |
| [`ferramentas/`](ferramentas) | geradores dos widgets e dos plugins de área |

## Usar um plugin
No app: **Configurações → Comunidade → Registro aberto → Instalar**. O app baixa cada arquivo, confere o sha256, roda o verificador e instala. Depois, ligue o plugin em **Configurações → Plugins**.

## Criar um plugin
Baixe o kit (no app: Configurações → Plugins → "Kit para criar plugins", ou copie a pasta [`kit/`](kit)). Abra o Claude Code ou o OpenCode na pasta do kit e peça, por exemplo: *"cria um plugin de farmacologia com didática pelo mecanismo de ação e um fluxograma de anafilaxia"*. O agente só declara o plugin pronto quando o verificador passa.

Regras de um plugin:
- É uma pasta com `plugin.json` e arquivos de **texto, dados e widgets HTML**. Nada de programas.
- Widgets rodam numa caixa de areia sem rede e sem acesso ao seu computador.
- Downloads de dados só por https, com sha256.

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenças
- **Código** (verificador, geradores, widgets): [AGPL-3.0](LICENSE), a mesma do LearnHarness original.
- **Conteúdo** dos plugins (textos, fluxogramas): CC BY-SA 4.0, salvo outra licença declarada no `plugin.json` de cada um.
- **Modelos 3D:** BodyParts3D e NeuroMorpho (CC BY 4.0), Brainder (CC BY-SA 3.0), com créditos no pacote.

O LearnHarness original é de [amosblomqvist/learnharness](https://github.com/amosblomqvist/learnharness) ([learnharness.ai](https://learnharness.ai)). Este repositório não é afiliado ao autor original.

**Aviso médico:** o conteúdo é material de estudo, não orientação clínica. Os fluxogramas citam a diretriz de referência; confira sempre a versão vigente.

---

## English

Open plugins, a plugin kit and an open registry for **LearnHarness**, an AI study tutor that runs on your computer: it teaches through the *why*, remembers what you got wrong and schedules reviews.

- **Use a plugin:** in the app, Settings → Community → Open registry → Install. Each file is checked against its sha256 and the plugin passes the verifier before it is installed.
- **Create a plugin:** use the [`kit/`](kit) folder with Claude Code (skill `criar-plugin`) or OpenCode (`AGENTS.md`). Run `node kit/lh-plugin.mjs verificar <folder>`; a plugin is ready only when it says `PASSOU` (passed).
- **What a plugin is:** a folder with a `plugin.json` manifest plus text, data and sandboxed HTML widgets. No executables. Widgets get no network access and cannot reach your computer.
- **Contribute:** fork, add `plugins/<id>/`, open a pull request; CI runs the verifier and rebuilds `registro.json`.
- **Licences:** code AGPL-3.0; plugin content CC BY-SA 4.0 unless the plugin says otherwise.
- Prompts and content are in Brazilian Portuguese for now; plugins in other languages are welcome.
