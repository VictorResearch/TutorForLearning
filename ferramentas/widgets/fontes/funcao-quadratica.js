// Função do 2º grau: a parábola
var a = controle("a", "a", -3, 3, 0.1, 1), b = controle("b", "b", -6, 6, 0.1, -2), c = controle("c", "c", -6, 6, 0.1, -3);
function desenhar() {
  var A = a.get(), B = b.get(), C = c.get();
  var E = eixos(-6, 6, -8, 8, { rx: "x", ry: "y" });
  curva(E, function (x) { return A * x * x + B * x + C; });
  var delta = B * B - 4 * A * C, raizes = [];
  if (A !== 0) {
    if (delta > 1e-12) raizes = [(-B - Math.sqrt(delta)) / (2 * A), (-B + Math.sqrt(delta)) / (2 * A)].sort(function (p, q) { return p - q; });
    else if (Math.abs(delta) <= 1e-12) raizes = [-B / (2 * A)];
  } else if (B !== 0) raizes = [-C / B];
  var xv = A !== 0 ? -B / (2 * A) : null, yv = A !== 0 ? -delta / (4 * A) : null;
  raizes.forEach(function (r) { ponto(E, r, 0, "#16a34a"); });
  if (xv !== null) ponto(E, xv, yv, "#dc2626", "vértice");
  ponto(E, 0, C, "#7c3aed", "c");
  saida("y = <b>" + A + "</b>x² + <b>" + B + "</b>x + <b>" + C + "</b> · Δ = " + delta.toFixed(2) +
    " · raízes: " + (raizes.length ? raizes.map(function (r) { return r.toFixed(2); }).join(" e ") : "nenhuma real") +
    (xv !== null ? " · vértice (" + xv.toFixed(2) + ", " + yv.toFixed(2) + ")" : "") + " · concavidade " + (A > 0 ? "para cima" : A < 0 ? "para baixo" : "—"));
  enviar({ a: A, b: B, c: C, delta: +delta.toFixed(4), raizes: raizes.map(function (r) { return +r.toFixed(4); }), vertice: xv === null ? null : { x: +xv.toFixed(4), y: +yv.toFixed(4) } });
}
desenhar();
