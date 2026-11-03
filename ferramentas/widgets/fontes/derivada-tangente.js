// Derivada como inclinação da reta tangente
var fs = { quad: [function (x) { return x * x / 2; }, "x²/2"], cubo: [function (x) { return x * x * x / 6 - x; }, "x³/6 − x"], seno: [function (x) { return 2 * Math.sin(x); }, "2·sen(x)"], exp: [function (x) { return Math.exp(x / 2); }, "e^(x/2)"] };
var f = escolha("funcao", "f(x)", [["quad", "x²/2"], ["cubo", "x³/6 − x"], ["seno", "2·sen x"], ["exp", "e^(x/2)"]], "quad");
var x0 = controle("x0", "x₀", -5, 5, 0.1, 1), h = controle("h", "h", 0.01, 3, 0.01, 1.5);
function desenhar() {
  var F = fs[f.get()][0], X = x0.get(), H = h.get();
  var E = eixos(-6, 6, -6, 8, { rx: "x", ry: "f(x)" });
  curva(E, F);
  var d = (F(X + 1e-5) - F(X - 1e-5)) / 2e-5, sec = (F(X + H) - F(X)) / H;
  curva(E, function (x) { return F(X) + sec * (x - X); }, "#f59e0b", 1.5);
  curva(E, function (x) { return F(X) + d * (x - X); }, "#dc2626", 2);
  ponto(E, X, F(X), "#dc2626", "x₀"); ponto(E, X + H, F(X + H), "#f59e0b", "x₀+h");
  saida("f(x) = " + fs[f.get()][1] + " · inclinação da secante (laranja) = <b>" + sec.toFixed(3) + "</b> · derivada em x₀ (tangente, vermelha) = <b>" + d.toFixed(3) + "</b> — diminua h e veja a secante virar tangente");
  enviar({ funcao: f.get(), x0: X, h: H, secante: +sec.toFixed(4), derivada: +d.toFixed(4) });
}
desenhar();
