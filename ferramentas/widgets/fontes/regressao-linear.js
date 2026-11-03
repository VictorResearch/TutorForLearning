// Regressão linear: ajuste a reta aos pontos
var dados = [[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1], [6, 12.2], [7, 13.8], [8, 16.1]];
var b1 = controle("inclinacao", "b₁", -1, 4, 0.05, 1), b0 = controle("intercepto", "b₀", -5, 8, 0.1, 3);
var mostrar = escolha("mostrar", "ver ótima", [["nao", "não"], ["sim", "sim"]], "nao");
function ajuste() {
  var n = dados.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
  dados.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
  var b = (n * sxy - sx * sy) / (n * sxx - sx * sx); return [b, (sy - b * sx) / n];
}
function desenhar() {
  var B1 = b1.get(), B0 = b0.get();
  var E = eixos(0, 9, -2, 20, { rx: "x", ry: "y" }), sqr = 0;
  dados.forEach(function (p) { var yh = B0 + B1 * p[0]; sqr += Math.pow(p[1] - yh, 2); linha(E, p[0], p[1], p[0], yh, "#f59e0b", 1); ponto(E, p[0], p[1], "#111"); });
  curva(E, function (x) { return B0 + B1 * x; }, "#dc2626", 2);
  var o = ajuste(), sqrMin = 0; dados.forEach(function (p) { sqrMin += Math.pow(p[1] - o[1] - o[0] * p[0], 2); });
  if (mostrar.get() === "sim") curva(E, function (x) { return o[1] + o[0] * x; }, "#16a34a", 1.5);
  saida("soma dos quadrados dos resíduos (laranja) = <b>" + sqr.toFixed(3) + "</b>" + (mostrar.get() === "sim" ? " · mínimos quadrados: b₁ = " + o[0].toFixed(3) + ", b₀ = " + o[1].toFixed(3) + " (SQR = " + sqrMin.toFixed(3) + ")" : " · tente chegar ao menor valor possível"));
  enviar({ inclinacao: B1, intercepto: B0, sqr: +sqr.toFixed(4), sqrMinima: +sqrMin.toFixed(4) });
}
desenhar();
