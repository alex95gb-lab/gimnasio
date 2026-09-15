/* ============================================================
   GRÁFICA SIMPLE EN SVG (sin librerías)
   Barras claras = volumen de la sesión (kg x reps)
   Línea + puntos = peso de trabajo
   ============================================================ */

const Grafica = {
  linea(puntos, opciones) {
    const o = Object.assign({ ancho: 320, alto: 170, unidad: 'kg' }, opciones || {});
    if (!puntos || puntos.length === 0) return '<p class="vacio">Sin datos todavía.</p>';

    const W = o.ancho, H = o.alto;
    const mIzq = 34, mDer = 10, mSup = 12, mInf = 24;
    const w = W - mIzq - mDer, h = H - mSup - mInf;

    const pesos = puntos.map(p => p.peso);
    let max = Math.max.apply(null, pesos);
    let min = Math.min.apply(null, pesos);
    // todos iguales: se abre un margen (vale también para lastre 0 o asistencia negativa)
    if (max === min) { const margen = Math.abs(max) * 0.1 || 1; max = max + margen; min = min === 0 ? 0 : min - margen; }
    const maxVol = Math.max.apply(null, puntos.map(p => p.volumen)) || 1;

    const x = i => puntos.length === 1 ? mIzq + w / 2 : mIzq + (i * w) / (puntos.length - 1);
    const y = v => mSup + h - ((v - min) / (max - min)) * h;

    let svg = `<svg class="grafica" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolución del peso">`;

    // rejilla horizontal
    [0, 0.5, 1].forEach(f => {
      const vy = mSup + h * f;
      const val = max - (max - min) * f;
      svg += `<line x1="${mIzq}" y1="${vy.toFixed(1)}" x2="${W - mDer}" y2="${vy.toFixed(1)}" class="g-rejilla"/>`;
      svg += `<text x="2" y="${(vy + 3.5).toFixed(1)}" class="g-eje">${Progresion.num(Math.round(val * 10) / 10)}</text>`;
    });

    // barras de volumen
    const bw = Math.max(3, Math.min(16, w / (puntos.length * 1.8)));
    puntos.forEach((p, i) => {
      const bh = (p.volumen / maxVol) * h * 0.85;
      svg += `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${(mSup + h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" class="g-barra"/>`;
    });

    // línea de peso
    const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.peso).toFixed(1)}`).join(' ');
    svg += `<path d="${d}" class="g-linea"/>`;
    puntos.forEach((p, i) => {
      svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.peso).toFixed(1)}" r="3.5" class="g-punto"><title>${p.fecha}: ${Progresion.num(p.peso)} ${o.unidad}</title></circle>`;
    });

    // fechas primera y última
    const corta = f => { const d2 = DB.desdeIso(f); return `${d2.getDate()}/${d2.getMonth() + 1}`; };
    svg += `<text x="${mIzq}" y="${H - 6}" class="g-eje">${corta(puntos[0].fecha)}</text>`;
    if (puntos.length > 1) svg += `<text x="${W - mDer}" y="${H - 6}" class="g-eje" text-anchor="end">${corta(puntos[puntos.length - 1].fecha)}</text>`;

    svg += '</svg>';
    return svg;
  }
};
