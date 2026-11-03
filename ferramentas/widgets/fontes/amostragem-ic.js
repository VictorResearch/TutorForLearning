// Amostragem e intervalo de confiança da média
var mu = controle("media", "μ", 50, 150, 1, 100), sigma = controle("dp", "σ", 1, 40, 1, 15), n = controle("n", "n", 2, 200, 1, 25);
var conf = escolha("confianca", "confiança", [["0.9", "90%"], ["0.95", "95%"], ["0.99", "99%"]], "0.95");
var ics = [];
function normal() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function z() { return { "0.9": 1.645, "0.95": 1.96, "0.99": 2.576 }[conf.get()]; }
function sortear(k) {
  for (var j = 0; j < k; j++) {
    var s = 0, N = n.get();
    for (var i = 0; i < N; i++) s += mu.get() + sigma.get() * normal();
    var m = s / N, e = z() * sigma.get() / Math.sqrt(N); ics.push([m - e, m + e]);
  }
  if (ics.length > 100) ics = ics.slice(-100);
  desenhar();
}
botao("sortear 1 amostra", function () { sortear(1); }); botao("sortear 20", function () { sortear(20); }); botao("limpar", function () { ics = []; desenhar(); });
function desenhar() {
  var M = mu.get(), S = sigma.get();
  var E = eixos(M - 3 * S, M + 3 * S, 0, 101, { rx: "valor", ry: "amostra" });
  linha(E, M, 0, M, 101, "#16a34a", 2);
  ics.forEach(function (ic, i) { var ok = ic[0] <= M && M <= ic[1]; linha(E, ic[0], i + 1, ic[1], i + 1, ok ? "#2563eb" : "#dc2626", 2); });
  var vistos = ics.filter(function (ic) { return ic[0] <= M && M <= ic[1]; }).length;
  var marg = z() * S / Math.sqrt(n.get());
  saida("margem de erro = ±<b>" + marg.toFixed(2) + "</b> · intervalos que contêm μ: <b>" + vistos + "/" + ics.length + "</b>" + (ics.length ? " (" + (100 * vistos / ics.length).toFixed(0) + "%)" : "") + " — vermelho = o intervalo errou μ");
  enviar({ media: M, dp: S, n: n.get(), confianca: Number(conf.get()), margem: +marg.toFixed(4), amostras: ics.length, cobertura: ics.length ? +(vistos / ics.length).toFixed(3) : null });
}
desenhar();
