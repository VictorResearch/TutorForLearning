# Segurança

## Relatar uma falha
**Não abra issue pública.** Use o botão **"Report a vulnerability"** na aba *Security* deste repositório (relato privado do GitHub). Descreva:
- o que acontece e como reproduzir;
- o impacto (o que um plugin malicioso conseguiria fazer);
- a versão do app e do plugin.

Respondemos em até 7 dias. Quando a correção sair, damos o crédito a você (se quiser).

## O que conta como falha
- Um plugin que passa no verificador e consegue: executar programa, acessar a rede de dentro de um widget, ler arquivos do computador, sair da caixa de areia ou mexer na janela do app.
- Um pacote do registro que instala arquivos fora da pasta do plugin.
- Um download que não confere o sha256.
- Texto de plugin capaz de fazer o tutor revelar chaves ou mandar dados para fora.

## Como a segurança funciona
- **Plugins não têm código executável.** O verificador barra executáveis, scripts soltos, caminhos absolutos e `..`.
- **Widgets** rodam num iframe `sandbox="allow-scripts"`, sem `allow-same-origin`, com uma política (CSP) que bloqueia toda rede. A comunicação é só por `postMessage`, com parâmetros entrando e estado saindo.
- **Downloads** (vozes, modelos 3D, arquivos do registro) só por https, com sha256 conferido.
- **Chaves de API** ficam no computador de cada pessoa e nunca vão em pacote nem plugin.
