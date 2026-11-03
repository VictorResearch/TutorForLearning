// Óptica: imagem numa lente convergente
var f = controle("foco", "f (cm)", 2, 12, 0.5, 6), d = controle("objeto", "p (cm)", 1, 30, 0.5, 15), h = controle("altura", "o (cm)", 1, 5, 0.5, 3);
function desenhar() {
  var F = f.get(), Pd = d.get(), O = h.get();
  var E = eixos(-32, 32, -10, 10, { rx: "cm" });
  var q = Math.abs(Pd - F) < 1e-9 ? Infinity : 1 / (1 / F - 1 / Pd), A = -q / Pd, I = A * O;
  linha(E, 0, -9, 0, 9, "#2563eb", 3); ponto(E, F, 0, "#2563eb", "F"); ponto(E, -F, 0, "#2563eb", "F′");
  linha(E, -Pd, 0, -Pd, O, "#111", 3);
  linha(E, -Pd, O, 0, O, "#f59e0b");
  if (isFinite(q)) { linha(E, 0, O, q, I, "#f59e0b"); linha(E, -Pd, O, q, I, "#16a34a"); linha(E, q, 0, q, I, q > 0 ? "#dc2626" : "#fca5a5", 3); }
  var tipo = !isFinite(q) ? "imprópria (no infinito)" : q > 0 ? "real e invertida" : "virtual e direita";
  saida("1/f = 1/p + 1/p′ → p′ = <b>" + (isFinite(q) ? q.toFixed(2) + " cm" : "∞") + "</b> · aumento = <b>" + (isFinite(A) ? A.toFixed(2) : "∞") + "</b> · imagem " + tipo + (isFinite(A) ? (Math.abs(A) > 1 ? ", maior" : Math.abs(A) < 1 ? ", menor" : ", do mesmo tamanho") : ""));
  enviar({ foco: F, objeto: Pd, imagem: isFinite(q) ? +q.toFixed(4) : null, aumento: isFinite(A) ? +A.toFixed(4) : null, real: isFinite(q) && q > 0 });
}
desenhar();
