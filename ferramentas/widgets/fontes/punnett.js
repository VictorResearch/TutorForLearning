// Genética: quadro de Punnett (dois genes)
var GEN = [["AABB", "AABB"], ["AaBb", "AaBb"], ["AaBB", "AaBB"], ["Aabb", "Aabb"], ["aaBb", "aaBb"], ["aabb", "aabb"]];
var p1 = escolha("pai1", "genitor 1", GEN, "AaBb"), p2 = escolha("pai2", "genitor 2", GEN, "AaBb");
function gametas(s) { var out = []; [s[0], s[1]].forEach(function (x) { [s[2], s[3]].forEach(function (y) { out.push(x + y); }); }); return out; }
function par(x, y) { return x === x.toUpperCase() || y !== y.toUpperCase() ? x + y : y + x; }
function desenhar() {
  var g1 = gametas(p1.get()), g2 = gametas(p2.get()), cel = 64, x0 = 140, y0 = 50, fen = {};
  g.clearRect(0, 0, tela.width, tela.height);
  g1.forEach(function (x, i) { texto(x, x0 + i * cel + 20, y0 - 10, "#2563eb"); });
  g2.forEach(function (y, j) {
    texto(y, x0 - 40, y0 + j * cel + 36, "#dc2626");
    g1.forEach(function (x, i) {
      var gen = par(x[0], y[0]) + par(x[1], y[1]);
      var f = (gen.indexOf("A") >= 0 ? "A_" : "aa") + (gen.indexOf("B") >= 0 ? "B_" : "bb");
      fen[f] = (fen[f] || 0) + 1;
      g.strokeStyle = "#cbd5e1"; g.strokeRect(x0 + i * cel, y0 + j * cel, cel, cel); texto(gen, x0 + i * cel + 12, y0 + j * cel + 36);
    });
  });
  var tot = g1.length * g2.length, chaves = Object.keys(fen).sort(), prop = {};
  chaves.forEach(function (k) { prop[k] = +(fen[k] / tot).toFixed(4); });
  saida("fenótipos: <b>" + chaves.map(function (k) { return k + " " + fen[k] + "/" + tot; }).join(" · ") + "</b> (A_ = pelo menos um A dominante)");
  enviar({ pai1: p1.get(), pai2: p2.get(), fenotipos: prop });
}
desenhar();
