// Integral como área: somas de Riemann
var fs = { quad: [function (x) { return x * x; }, function (x) { return x * x * x / 3; }, "x²"], seno: [function (x) { return Math.sin(x) + 1.2; }, function (x) { return -Math.cos(x) + 1.2 * x; }, "sen x + 1,2"], raiz: [function (x) { return Math.sqrt(Math.max(0, x)); }, function (x) { return 2 / 3 * Math.pow(Math.max(0, x), 1.5); }, "√x"] };
var f = escolha("funcao", "f(x)", [["quad", "x²"], ["seno", "sen x + 1,2"], ["raiz", "√x"]], "quad");
var a = controle("a", "a", 0, 4, 0.1, 0), b = controle("b", "b", 0.5, 5, 0.1, 3), n = controle("n", "n", 1, 100, 1, 6);
var modo = escolha("modo", "ponto", [["esq", "esquerda"], ["meio", "meio"], ["dir", "direita"]], "esq");
function desenhar() {
  var F = fs[f.get()][0], Fp = fs[f.get()][1], A = a.get(), B = Math.max(A + 0.1, b.get()), N = n.get(), dx = (B - A) / N, s = 0;
  var E = eixos(-0.5, 5.5, -1, Math.max(3, F(5.5) * 1.1), { rx: "x", ry: "f(x)" });
  for (var i = 0; i < N; i++) {
    var xi = A + i * dx, xm = modo.get() === "esq" ? xi : modo.get() === "meio" ? xi + dx / 2 : xi + dx, y = F(xm); s += y * dx;
    g.fillStyle = "rgba(37,99,235,.18)"; g.strokeStyle = "rgba(37,99,235,.6)";
    g.fillRect(E.X(xi), E.Y(y), E.X(xi + dx) - E.X(xi), E.Y(0) - E.Y(y)); g.strokeRect(E.X(xi), E.Y(y), E.X(xi + dx) - E.X(xi), E.Y(0) - E.Y(y));
  }
  curva(E, F);
  var exata = Fp(B) - Fp(A);
  saida("soma de " + N + " retângulos = <b>" + s.toFixed(4) + "</b> · integral exata de " + A + " a " + B.toFixed(1) + " = <b>" + exata.toFixed(4) + "</b> · erro = " + (s - exata).toFixed(4));
  enviar({ funcao: f.get(), a: A, b: B, n: N, modo: modo.get(), soma: +s.toFixed(5), exata: +exata.toFixed(5), erro: +(s - exata).toFixed(5) });
}
desenhar();
