// Frank-Starling: volume sistólico × pré-carga
var contr = controle("contratilidade", "contratilidade", 0.4, 1.6, 0.05, 1), pos = controle("poscarga", "pós-carga", 0.5, 2, 0.05, 1), pre = controle("precarga", "PDFVE (mmHg)", 0, 30, 0.5, 10);
function vs(p) { return 110 * contr.get() / pos.get() * (1 - Math.exp(-p / 8)); }
function desenhar() {
  var E = eixos(0, 30, 0, 160, { rx: "pré-carga: PDFVE (mmHg)", ry: "volume sistólico (mL)" });
  curva(E, function (p) { return 110 * (1 - Math.exp(-p / 8)); }, "#cbd5e1", 1.5);
  curva(E, vs, "#dc2626", 2.5);
  var V = vs(pre.get()); ponto(E, pre.get(), V, "#111", "VS " + V.toFixed(0) + " mL");
  linha(E, 18, 0, 18, 160, "#f59e0b"); texto("congestão →", E.X(18) + 4, E.Y(150), "#b45309");
  var nota = pre.get() > 18 ? "PDFVE alta: congestão pulmonar" : V < 50 ? "baixo débito" : "faixa adequada";
  saida("volume sistólico = <b>" + V.toFixed(0) + " mL</b> · " + nota + " · cinza = curva normal. Inotrópico sobe a curva; reduzir a pós-carga também; diurético anda para a esquerda na mesma curva.");
  enviar({ contratilidade: contr.get(), poscarga: pos.get(), precarga: pre.get(), volumeSistolico: +V.toFixed(2), congestao: pre.get() > 18 });
}
desenhar();
