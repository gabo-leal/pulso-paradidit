// pulso/src/chart.js
// Genera el SVG combinado: barras de ingreso diario + línea de gasto, layout exacto Fase 0.
// Branding LOCKED — no modificar colores, fuentes, ni layout.

export function buildSvg(incomeByDay, spendByDay, days, todayKey) {
  const L = 44, R = 1356, T = 40, B = 392, plotH = B - T;
  const VMAX = Math.max(6000, ...Object.values(incomeByDay), ...Object.values(spendByDay));
  const n = days.length;
  // Si no hay días, devolver SVG vacío pero válido
  if (n === 0) {
    return `<svg viewBox="0 0 1400 430" width="100%" style="margin-top:10px;overflow:visible"></svg>`;
  }
  const sw = (R - L) / n;
  const cx = i => L + (i + 0.5) * sw;           // i es 0-based
  const y  = v => B - (v / VMAX) * plotH;
  const fmt = v => '$' + Math.round(v).toLocaleString('en-US');

  const parts = [];

  // defs + styles (idénticos al Fase 0)
  parts.push(`<defs><linearGradient id="gToday" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A78FF"/><stop offset="1" stop-color="#5B5BF6"/></linearGradient></defs>`);
  parts.push(`<style>
    .bar{fill:rgba(91,91,246,.22)} .bar-today{fill:url(#gToday)}
    .ilab{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;text-anchor:middle}
    .sline{fill:none;stroke:#F5A623;stroke-width:2.8;stroke-linejoin:round;stroke-linecap:round}
    .sdot{fill:#F5A623;stroke:#0A0A0C;stroke-width:1.8}
    .slab{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;fill:#F5A623;text-anchor:middle}
    .dlab{font-family:'Barlow',sans-serif;font-size:13px;fill:#5C5C66;text-anchor:middle}
    .baseaxis{stroke:#1F1F24;stroke-width:1}
  </style>`);

  // Baseline
  parts.push(`<line class="baseaxis" x1="${L}" y1="${B}" x2="${R}" y2="${B}"/>`);

  // Barras + labels de ingreso
  for (let i = 0; i < n; i++) {
    const d = days[i];
    const v = incomeByDay[d] || 0;
    if (v > 0) {
      const bh = (v / VMAX) * plotH;
      const bw = sw * 0.6;
      const bx = cx(i) - bw / 2;
      const by = B - bh;
      const cls = d === todayKey ? 'bar-today' : 'bar';
      const lcolor = d === todayKey ? '#8B89FF' : '#c4c4cf';
      parts.push(`<rect class="${cls}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4"/>`);
      parts.push(`<text class="ilab" x="${cx(i).toFixed(1)}" y="${(by - 7).toFixed(1)}" fill="${lcolor}">${fmt(v)}</text>`);
    }
  }

  // Polyline de gasto — rompe en gaps (solo conecta días consecutivos con datos)
  // Construimos segmentos: secuencias de días con spend consecutivos en el array
  const spendPoints = days.map((d, i) => {
    const v = spendByDay[d];
    return v !== undefined ? { i, d, v } : null;
  });

  // Agrupar en segmentos de índices consecutivos
  const segments = [];
  let seg = [];
  for (let i = 0; i <= n; i++) {
    const p = i < n ? spendPoints[i] : null;
    if (p !== null && p !== undefined) {
      // Check if this is consecutive to previous in segment
      if (seg.length === 0 || p.i === seg[seg.length - 1].i + 1) {
        seg.push(p);
      } else {
        if (seg.length >= 1) segments.push(seg);
        seg = [p];
      }
    } else {
      if (seg.length >= 1) segments.push(seg);
      seg = [];
    }
  }

  // Dibujar polylines (solo segmentos con >=2 puntos para una línea, pero dibujamos círculos para todos)
  for (const s of segments) {
    if (s.length >= 2) {
      const pts = s.map(p => `${cx(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
      parts.push(`<polyline class="sline" points="${pts}"/>`);
    }
  }

  // Círculos en cada punto de gasto
  for (const p of spendPoints) {
    if (p === null) continue;
    parts.push(`<circle class="sdot" cx="${cx(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.2"/>`);
  }

  // Labels de gasto (encima del círculo, 10px hacia arriba; si el punto está muy cerca del borde inferior,
  // colocar debajo del eje para el último punto del día actual — lógica del Fase 0: último punto usa y+18)
  const allSpendIdxs = spendPoints.filter(p => p !== null);
  const lastSpendIdx = allSpendIdxs.length > 0 ? allSpendIdxs[allSpendIdxs.length - 1].i : -1;
  for (const p of allSpendIdxs) {
    const py = y(p.v);
    let ly;
    // Si el punto cae cerca del fondo (y cercano a B), poner label debajo del eje
    if (p.i === lastSpendIdx && days[p.i] === todayKey) {
      // Hoy (último punto): label debajo de la baseline
      ly = B + 18;
    } else {
      ly = py - 10;
    }
    parts.push(`<text class="slab" x="${cx(p.i).toFixed(1)}" y="${ly.toFixed(1)}">${fmt(p.v)}</text>`);
  }

  // Labels de día (todos los días, debajo del eje)
  for (let i = 0; i < n; i++) {
    const d = days[i];
    // Usar solo el número del día (último segmento del YYYY-MM-DD)
    const dayNum = d.slice(8).replace(/^0/, '');
    parts.push(`<text class="dlab" x="${cx(i).toFixed(1)}" y="${(B + 26).toFixed(1)}">${dayNum}</text>`);
  }

  return `<svg viewBox="0 0 1400 430" width="100%" style="margin-top:10px;overflow:visible">\n${parts.join('')}\n</svg>`;
}

// ── Dona de motivos de error de pago (pestaña Trials) ─────────────────────────
// Paleta categórica validada (dataviz, dark surface #141417): el color sigue al
// motivo (entidad), nunca a su posición en el ranking.
const DONUT_COLORS = {
  'Fondos insuficientes': '#6E6BFF',
  'Tarjeta rechazada':    '#d95926',
  'Tarjeta expirada':     '#199e70',
  'Otro':                 '#c98500',
};

export function buildDonutSvg(segments) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (!total) return '';
  const cx = 105, cy = 105, r = 72, sw = 30;
  const C = 2 * Math.PI * r;
  const GAP = segments.length > 1 ? 2 : 0; // gap de superficie entre segmentos

  const parts = [];
  let offset = C * 0.25; // arranca a las 12:00 (dashoffset corre antihorario)
  for (const seg of segments) {
    const len = (seg.count / total) * C;
    const color = DONUT_COLORS[seg.motivo] || '#8A8A93';
    // style inline: gana a cualquier CSS global filtrado desde otros SVG del documento
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:none;stroke:${color};stroke-width:${sw}px" stroke-dasharray="${Math.max(len - GAP, 0.5).toFixed(1)} ${(C - len + GAP).toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>`);
    offset -= len;
  }

  // Centro: total + etiqueta (tokens de texto, no color de serie)
  parts.push(`<text x="${cx}" y="${cy - 2}" text-anchor="middle" style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:44px;fill:#fff">${total}</text>`);
  parts.push(`<text x="${cx}" y="${cy + 22}" text-anchor="middle" style="font-family:'Barlow',sans-serif;font-size:12px;letter-spacing:.1em;fill:#8A8A93">ERROR${total === 1 ? '' : 'ES'}</text>`);

  // Leyenda: swatch + motivo + count (pct)
  let ly = cy - (segments.length * 30) / 2 + 12;
  for (const seg of segments) {
    const color = DONUT_COLORS[seg.motivo] || '#8A8A93';
    const pct = Math.round((seg.count / total) * 100);
    parts.push(`<rect x="228" y="${ly - 11}" width="12" height="12" rx="3" fill="${color}"/>`);
    parts.push(`<text x="250" y="${ly}" style="font-family:'Barlow',sans-serif;font-size:14px;fill:#fff">${seg.motivo}</text>`);
    parts.push(`<text x="250" y="${ly + 0.1}" dx="${seg.motivo.length * 7.2 + 10}" style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;fill:#8A8A93">${seg.count} · ${pct}%</text>`);
    ly += 30;
  }

  return `<svg viewBox="0 0 470 210" width="100%" style="max-width:470px" role="img" aria-label="Motivos de error de pago">${parts.join('')}</svg>`;
}
