// pulso/src/render.js
export function render(templateStr, data) {
  const out = templateStr.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in data)) return `{{${k}}}`; // se detecta abajo
    return String(data[k]);
  });
  const leftover = out.match(/\{\{(\w+)\}\}/);
  if (leftover) throw new Error(`Marcador sin sustituir: ${leftover[0]}`);
  return out;
}
