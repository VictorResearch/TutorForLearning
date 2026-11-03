// Mitose passo a passo
var fases = [
  ["intérfase", "o DNA se duplica (fase S); os cromossomos ainda não estão condensados"],
  ["prófase", "os cromossomos condensam (duas cromátides-irmãs cada) e o fuso começa a se formar"],
  ["metáfase", "os cromossomos se alinham na placa equatorial, presos ao fuso pelos cinetocoros"],
  ["anáfase", "as cromátides-irmãs se separam e vão para polos opostos"],
  ["telófase", "os núcleos se refazem nos polos e os cromossomos descondensam"],
  ["citocinese", "o citoplasma se divide: duas células-filhas idênticas à mãe"]
];
var f = controle("fase", "fase", 0, 5, 1, 0);
var cores = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b"];
function cromossomo(x, y, cor, irmas, ang) {
  g.save(); g.translate(x, y); g.rotate(ang || 0); g.strokeStyle = cor; g.lineWidth = 6; g.lineCap = "round";
  g.beginPath(); g.moveTo(-3, -16); g.lineTo(-3, 16); g.stroke();
  if (irmas) { g.beginPath(); g.moveTo(5, -16); g.lineTo(5, 16); g.stroke(); }
  g.restore();
}
function desenhar() {
  var i = f.get(), cx = tela.width / 2, cy = tela.height / 2, k;
  g.clearRect(0, 0, tela.width, tela.height); g.strokeStyle = "#64748b"; g.lineWidth = 2;
  if (i < 5) { g.beginPath(); g.ellipse(cx, cy, i >= 3 ? 230 : 170, 140, 0, 0, 7); g.stroke(); }
  else { [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(cx + s * 130, cy, 120, 120, 0, 0, 7); g.stroke(); }); }
  if (i === 0) {
    g.setLineDash([4, 4]); g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.stroke(); g.setLineDash([]);
    for (k = 0; k < 4; k++) { g.strokeStyle = cores[k]; g.lineWidth = 2; g.beginPath(); for (var t = 0; t < 30; t++) g.lineTo(cx - 40 + t * 3, cy - 30 + k * 18 + 6 * Math.sin(t + k)); g.stroke(); }
  }
  if (i === 1) for (k = 0; k < 4; k++) cromossomo(cx - 60 + k * 40, cy - 20 + (k % 2) * 40, cores[k], true, k * 0.5);
  if (i === 2) for (k = 0; k < 4; k++) {
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 160, cy); g.lineTo(cx, cy - 75 + k * 50); g.lineTo(cx + 160, cy); g.stroke();
    cromossomo(cx, cy - 75 + k * 50, cores[k], true, Math.PI / 2);
  }
  if (i === 3) for (k = 0; k < 4; k++) { cromossomo(cx - 120, cy - 75 + k * 50, cores[k], false, Math.PI / 2); cromossomo(cx + 120, cy - 75 + k * 50, cores[k], false, Math.PI / 2); }
  if (i >= 4) [-1, 1].forEach(function (s) {
    var dx = i === 5 ? 130 : 150; g.strokeStyle = "#64748b"; g.setLineDash([4, 4]); g.beginPath(); g.arc(cx + s * dx, cy, 60, 0, 7); g.stroke(); g.setLineDash([]);
    for (k = 0; k < 4; k++) cromossomo(cx + s * dx - 30 + k * 20, cy, cores[k], false, 0.3 * k);
  });
  texto(fases[i][0].toUpperCase(), 20, 28);
  saida("<b>" + fases[i][0] + "</b>: " + fases[i][1] + " · 2n = 4: cada célula-filha recebe uma cromátide de cada cromossomo");
  enviar({ fase: i, nome: fases[i][0] });
}
desenhar();
