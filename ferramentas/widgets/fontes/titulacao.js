// Titulação: ácido forte × base forte
var ca = controle("concAcido", "[HCl] (M)", 0.01, 1, 0.01, 0.1), va = controle("volAcido", "V ácido (mL)", 5, 50, 1, 25), cb = controle("concBase", "[NaOH] (M)", 0.01, 1, 0.01, 0.1), vb = controle("volBase", "V base (mL)", 0, 60, 0.1, 10);
function ph(vB) {
  var nA = ca.get() * va.get(), nB = cb.get() * vB, V = va.get() + vB;
  if (Math.abs(nA - nB) < 1e-9) return 7;
  return nA > nB ? -Math.log10((nA - nB) / V) : 14 + Math.log10((nB - nA) / V);
}
function desenhar() {
  var E = eixos(0, 60, 0, 14, { rx: "V base (mL)", ry: "pH" });
  curva(E, ph); var p = ph(vb.get()), veq = ca.get() * va.get() / cb.get();
  linha(E, veq, 0, veq, 14, "#94a3b8"); ponto(E, vb.get(), p, "#dc2626", "pH " + p.toFixed(2));
  saida("pH = <b>" + p.toFixed(2) + "</b> · ponto de equivalência em <b>" + veq.toFixed(2) + " mL</b> (pH 7) · " + (vb.get() < veq - 0.05 ? "excesso de ácido" : vb.get() > veq + 0.05 ? "excesso de base" : "na equivalência"));
  enviar({ concAcido: ca.get(), volAcido: va.get(), concBase: cb.get(), volBase: vb.get(), pH: +p.toFixed(3), equivalencia: +veq.toFixed(3) });
}
desenhar();
