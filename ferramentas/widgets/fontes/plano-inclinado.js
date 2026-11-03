// Plano inclinado: forças e aceleração
var ang = controle("angulo", "θ (°)", 0, 60, 1, 30), m = controle("massa", "m (kg)", 0.5, 20, 0.5, 2), mu = controle("atrito", "μ", 0, 1, 0.01, 0.2);
function desenhar() {
  var t = ang.get() * Math.PI / 180, M = m.get(), U = mu.get(), G = 9.8;
  var P = M * G, Px = P * Math.sin(t), N = P * Math.cos(t), Fat = U * N;
  var a = Px > Fat ? (Px - Fat) / M : 0, atritoAtual = Math.min(Fat, Px);
  var W = tela.width, H = tela.height; g.clearRect(0, 0, W, H);
  var x0 = 80, y0 = H - 40, L = 520, x1 = x0 + L * Math.cos(t), y1 = y0 - L * Math.sin(t);
  g.fillStyle = "#e5e7eb"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1, y1); g.closePath(); g.fill();
  g.strokeStyle = "#475569"; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  var cx = x0 + 0.55 * L * Math.cos(t), cy = y0 - 0.55 * L * Math.sin(t), esc = 110 / (P + 1e-9);
  g.save(); g.translate(cx, cy); g.rotate(-t); g.fillStyle = "#2563eb"; g.fillRect(-25, -40, 50, 40);
  function seta(dx, dy, cor, rot) { g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -20); g.lineTo(dx, -20 + dy); g.stroke(); g.beginPath(); g.arc(dx, -20 + dy, 3.5, 0, 7); g.fill(); g.font = "12px system-ui"; g.fillText(rot, dx + 5, -20 + dy); }
  seta(0, -N * esc, "#16a34a", "N");
  seta(-Px * esc, 0, "#dc2626", "P·sen θ");
  if (atritoAtual > 0) seta(atritoAtual * esc, 0, "#f59e0b", "atrito");
  g.restore();
  g.save(); g.translate(cx, cy); g.strokeStyle = "#7c3aed"; g.fillStyle = "#7c3aed"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -20); g.lineTo(0, -20 + P * esc); g.stroke(); g.font = "12px system-ui"; g.fillText("P", 5, -20 + P * esc); g.restore();
  texto("θ", x1 - 40, y0 - 8, "#475569");
  saida("P = " + P.toFixed(1) + " N · componente ao longo do plano = <b>" + Px.toFixed(1) + " N</b> · normal = " + N.toFixed(1) + " N · atrito máximo = " + Fat.toFixed(1) + " N · aceleração = <b>" + a.toFixed(2) + " m/s²</b>" + (a === 0 ? " (o bloco fica parado)" : ""));
  enviar({ angulo: ang.get(), massa: M, atrito: U, normal: +N.toFixed(3), componente: +Px.toFixed(3), aceleracao: +a.toFixed(3), parado: a === 0 });
}
desenhar();
