// Colisões em uma dimensão
var m1 = controle("m1", "m₁", 0.5, 10, 0.5, 2), v1 = controle("v1", "v₁", -6, 6, 0.1, 3), m2 = controle("m2", "m₂", 0.5, 10, 0.5, 1), v2 = controle("v2", "v₂", -6, 6, 0.1, -1), e = controle("e", "e", 0, 1, 0.05, 1);
function desenhar() {
  var M1 = m1.get(), V1 = v1.get(), M2 = m2.get(), V2 = v2.get(), E = e.get();
  var p = M1 * V1 + M2 * V2, u1 = (p + M2 * E * (V2 - V1)) / (M1 + M2), u2 = (p + M1 * E * (V1 - V2)) / (M1 + M2);
  var k0 = 0.5 * M1 * V1 * V1 + 0.5 * M2 * V2 * V2, k1 = 0.5 * M1 * u1 * u1 + 0.5 * M2 * u2 * u2;
  g.clearRect(0, 0, tela.width, tela.height);
  function bloco(x, y, m, v, cor, rot) {
    var s = 20 + 6 * m; g.fillStyle = cor; g.fillRect(x - s / 2, y - s, s, s);
    g.strokeStyle = cor; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - s - 8); g.lineTo(x + v * 18, y - s - 8); g.stroke();
    texto(rot + " = " + v.toFixed(2) + " m/s", x - 40, y + 16);
  }
  texto("antes", 20, 30); bloco(250, 150, M1, V1, "#2563eb", "v₁"); bloco(470, 150, M2, V2, "#dc2626", "v₂");
  texto("depois", 20, 230); bloco(250, 330, M1, u1, "#2563eb", "v₁′"); bloco(470, 330, M2, u2, "#dc2626", "v₂′");
  saida("quantidade de movimento: " + p.toFixed(2) + " → <b>" + (M1 * u1 + M2 * u2).toFixed(2) + "</b> (conserva) · energia cinética: " + k0.toFixed(2) + " J → <b>" + k1.toFixed(2) + " J</b> (" + (E === 1 ? "elástica: conserva" : "perde " + (k0 - k1).toFixed(2) + " J") + ")");
  enviar({ m1: M1, v1: V1, m2: M2, v2: V2, e: E, v1Depois: +u1.toFixed(4), v2Depois: +u2.toFixed(4), energiaPerdida: +(k0 - k1).toFixed(4) });
}
desenhar();
