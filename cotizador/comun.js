// Logica compartida entre el cotizador (index.html) y la vista del cliente (ver.html).
// Sin dependencias: corre igual en GitHub Pages (preview) y en el hosting de produccion.

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function pesos(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return fmt.format(Math.round(n)).replace(/ /g, ' ');
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function redondear(n, paso) {
  paso = Number(paso) || 1;
  return Math.round(n / paso) * paso;
}

export function uid(prefijo = 'id') {
  return prefijo + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

// Nombre corto de un item: "Nivel 2 · 12 hs" o "Auxiliar de enfermeria"
export function nombreItem(item) {
  return [item.grupo, item.nombre].filter(Boolean).join(' · ');
}

// Precio mensual de un item para una modalidad.
// La lista toma como base el precio Lun-Dom (mes de `diasBase` dias) y lo prorratea
// por dias: Lun-Vie = base x 23/31, Sab y Dom = base x 8/31 (asi esta armada la lista
// de octubre 2026). Cada modalidad puede sumar un recargo % y cada item puede pisar
// el valor a mano con `fijos[modalidad]`.
export function precioModalidad(tarifas, item, modId) {
  if (item.fijos && item.fijos[modId] !== undefined && item.fijos[modId] !== null && item.fijos[modId] !== '') {
    return Number(item.fijos[modId]);
  }
  const mod = tarifas.modalidades.find(m => m.id === modId);
  if (!mod) return null;
  const base = Number(item.precio) || 0;
  const dias = Number(mod.dias) || 0;
  const diasBase = Number(tarifas.diasBase) || 31;
  const recargo = Number(mod.recargo) || 0;
  return redondear(base * dias / diasBase * (1 + recargo / 100), 1);
}

// Valor hora de referencia: precio de la modalidad / (dias x horas del turno)
export function valorHora(tarifas, item, modId) {
  const horas = Number(item.horas);
  if (!horas) return null;
  const mod = tarifas.modalidades.find(m => m.id === modId);
  if (!mod || !Number(mod.dias)) return null;
  return precioModalidad(tarifas, item, modId) / (Number(mod.dias) * horas);
}

// ---------- link compartible (la cotizacion viaja entera en el #hash) ----------

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function desdeB64url(txt) {
  const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function codificar(obj) {
  const datos = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return 'j' + b64url(datos);
  const comp = new Blob([datos]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return 'z' + b64url(new Uint8Array(await new Response(comp).arrayBuffer()));
}

export async function decodificar(txt) {
  const tipo = txt[0];
  const bytes = desdeB64url(txt.slice(1));
  if (tipo === 'j') return JSON.parse(new TextDecoder().decode(bytes));
  const desc = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(desc).text());
}

// ---------- totales ----------

export function totales(cot) {
  const coef = Number(cot.coef?.valor) || 1;
  const subtotal = cot.items.reduce((a, it) => a + (Number(it.precio) || 0) * (Number(it.cantidad) || 1), 0);
  const conCoef = redondear(subtotal * coef, 1);
  const ivaPct = cot.iva?.aplicar ? Number(cot.iva.porcentaje) || 0 : 0;
  const iva = redondear(conCoef * ivaPct / 100, 1);
  return { subtotal, coef, conCoef, ivaPct, iva, total: conCoef + iva };
}

function fechaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function sumarDias(iso, n) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const f = new Date(y, m - 1, d + Number(n || 0));
  return f.toISOString().slice(0, 10);
}

const ICONOS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M9 12v3a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="11" r="2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 11l3-3 2 2 4-4"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
];

function cabecera(emp, titulo, subtitulo, base) {
  return `
  <header class="doc-head">
    <img class="doc-logo" src="${base}img/marca2-270.webp" alt="${esc(emp.nombre)}" width="270" height="80">
    <div class="doc-titulo">
      <h1>${esc(titulo)}</h1>
      <p>${esc(subtitulo)}</p>
    </div>
    <div class="doc-sellos">
      <img src="${base}img/sello-ministerio-96.webp" alt="Habilitación Ministerio de Salud" width="48" height="48">
      <img src="${base}img/sello-longevity-96.webp" alt="" width="38" height="48">
      <img src="${base}img/sello-nac-96.webp" alt="National Alliance for Caregiving" width="51" height="48">
    </div>
  </header>`;
}

function bloqueIncluye(titulo, incluye) {
  if (!incluye?.length) return '';
  return `
  <section class="doc-incluye">
    <h2>${esc(titulo || 'Todos los planes incluyen')}:</h2>
    <ul>${incluye.map((t, i) => `<li>${ICONOS[i % ICONOS.length]}<span>${esc(t)}</span></li>`).join('')}</ul>
  </section>`;
}

function pie(emp, lema) {
  return `
  <footer class="doc-pie">
    <div><p class="doc-bajada">${esc(emp.bajada)}</p><p class="doc-lema">${esc(lema || emp.lema)}</p></div>
    <div><h3>Nuestras oficinas</h3>${(emp.oficinas || []).map(o => `<p>${esc(o)}</p>`).join('')}</div>
    <div><h3>Contacto</h3><p class="doc-tel">${esc(emp.telefono)}</p><p>${esc(emp.email)}</p><p>${esc(emp.web)}</p></div>
  </footer>`;
}

// ---------- la cotizacion individual (lo que ve el cliente) ----------
// `cot` es una "foto" autocontenida: trae empresa, textos y precios del momento,
// asi una cotizacion vieja no cambia si despues se actualiza la lista.
export function renderCotizacion(cot, base = '../') {
  const emp = cot.empresa || {};
  const t = totales(cot);
  const vence = cot.fecha ? sumarDias(cot.fecha, cot.validezDias) : '';
  const mods = cot.modalidades || [];
  const filas = cot.items.map(it => {
    const cant = Number(it.cantidad) || 1;
    return `
      <tr>
        <td class="c-serv">
          <span class="c-cat">${esc(it.categoria)}</span>
          <strong>${esc(it.titulo)}</strong>
          ${it.descripcion ? `<span class="c-desc">${esc(it.descripcion)}</span>` : ''}
          ${cot.mostrarHora && it.hora ? `<span class="c-hora">Valor hora de referencia: ${pesos(it.hora)}</span>` : ''}
        </td>
        <td class="c-mod">${esc(it.modalidad || '')}${it.modDetalle ? `<span>${esc(it.modDetalle)}</span>` : ''}</td>
        <td class="c-cant">${cant}</td>
        <td class="c-imp">${pesos((Number(it.precio) || 0) * cant)}</td>
      </tr>`;
  }).join('');

  const refs = cot.items.filter(it => it.referencia?.length).map(it => `
    <div class="doc-ref">
      <h3>${esc(it.categoria)}${it.grupo ? ' · ' + esc(it.grupo) : ''} <span>Referencia mensual por turno</span></h3>
      <table>
        <thead><tr><th>${esc(it.colItem || 'Turno')}</th>${mods.map(m => `<th class="${m.destacada ? 'dest' : ''}">${esc(m.nombre)}<span>${esc(m.detalle)}</span></th>`).join('')}</tr></thead>
        <tbody>${it.referencia.map(r => `<tr class="${r.actual ? 'actual' : ''}"><td>${esc(r.nombre)}</td>${mods.map(m => `<td class="${m.destacada ? 'dest' : ''}">${pesos(r.precios[m.id])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`).join('');

  return `
  <article class="doc doc-cotizacion">
    ${cabecera(emp, 'Cotización', `Plan mensual · N.º ${cot.numero || '—'}`, base)}
    <section class="doc-datos">
      <div><span>Cliente</span><strong>${esc(cot.cliente?.nombre) || '—'}</strong>${cot.cliente?.telefono ? `<em>${esc(cot.cliente.telefono)}</em>` : ''}${cot.cliente?.email ? `<em>${esc(cot.cliente.email)}</em>` : ''}</div>
      <div><span>Paciente</span><strong>${esc(cot.paciente?.nombre) || '—'}</strong>${cot.paciente?.edad ? `<em>${esc(cot.paciente.edad)} años</em>` : ''}${cot.paciente?.zona ? `<em>${esc(cot.paciente.zona)}</em>` : ''}</div>
      <div><span>Fecha</span><strong>${fechaLarga(cot.fecha)}</strong>${vence ? `<em>Válida hasta el ${fechaLarga(vence)}</em>` : ''}</div>
    </section>
    ${bloqueIncluye(cot.incluyeTitulo, cot.incluye)}
    <p class="doc-mas">Más la prestación presencial cotizada:</p>
    <table class="doc-items">
      <thead><tr><th>Servicio</th><th>Modalidad</th><th>Cant.</th><th>Importe mensual</th></tr></thead>
      <tbody>${filas || '<tr><td colspan="4" class="vacio">Sin servicios cargados</td></tr>'}</tbody>
    </table>
    <div class="doc-totales">
      ${(t.coef !== 1 && cot.coef?.mostrar) || t.ivaPct ? `<div><span>Subtotal</span><span>${pesos(t.subtotal)}</span></div>` : ''}
      ${t.coef !== 1 && cot.coef?.mostrar ? `<div><span>Coeficiente${cot.coef.motivo ? ' · ' + esc(cot.coef.motivo) : ''} (×${String(t.coef).replace('.', ',')})</span><span>${pesos(t.conCoef - t.subtotal)}</span></div>` : ''}
      ${t.ivaPct ? `<div><span>IVA ${t.ivaPct}%</span><span>${pesos(t.iva)}</span></div>` : ''}
      <div class="doc-total"><span>Total mensual${t.ivaPct ? '' : ' (sin IVA)'}</span><span>${pesos(t.total)}</span></div>
    </div>
    ${cot.observaciones ? `<section class="doc-obs"><h3>Observaciones</h3><p>${esc(cot.observaciones).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${refs ? `<section class="doc-refs"><p class="doc-mas">Por si necesitan sumar o reducir horas, estos son los valores de referencia:</p>${refs}</section>` : ''}
    <section class="doc-legal">
      ${cot.notaCoeficiente ? `<p>${esc(cot.notaCoeficiente)}</p>` : ''}
      <p>${esc(cot.notaFacturacion || '')}${cot.validezDias ? ` Validez: ${esc(cot.validezDias)} días.` : ''}</p>
    </section>
    ${pie(emp)}
  </article>`;
}

// ---------- la lista de precios completa (la que hoy arma Sol a mano) ----------
export function renderLista(tar, base = '../') {
  const mods = tar.modalidades;
  const cats = tar.categorias.filter(c => c.activa !== false).map(cat => {
    const items = cat.items.filter(i => i.activo !== false);
    if (!items.length) return '';
    const conGrupo = items.some(i => i.grupo);
    // agrupa filas consecutivas del mismo grupo para el rowspan
    const filas = [];
    items.forEach((it, i) => {
      const nuevo = i === 0 || items[i - 1].grupo !== it.grupo;
      const span = nuevo ? items.slice(i).findIndex((x, j) => j > 0 && x.grupo !== it.grupo) : 0;
      filas.push(`<tr class="${nuevo && i ? 'corte' : ''}">
        ${conGrupo && nuevo ? `<th class="l-grupo" rowspan="${span === -1 ? items.length - i : span}">${esc(it.grupo)}</th>` : ''}
        <td class="l-item ${conGrupo ? '' : 'l-item-izq'}">${esc(it.nombre)}</td>
        ${mods.map(m => `<td class="${m.destacada ? 'dest' : ''}">${pesos(precioModalidad(tar, it, m.id))}</td>`).join('')}
      </tr>`);
    });
    return `
    <section class="l-cat">
      <div class="l-cat-head"><h2>${esc(cat.nombre)}</h2><span>Plan mensual</span></div>
      <table class="l-tabla">
        <thead><tr>${conGrupo ? `<th>${esc(cat.colGrupo || '')}</th>` : ''}<th class="${conGrupo ? '' : 'l-item-izq'}">${esc(cat.colItem || 'Turno')}</th>${mods.map(m => `<th class="${m.destacada ? 'dest' : ''}">${esc(m.nombre)}<span>${esc(m.detalle)}</span></th>`).join('')}</tr></thead>
        <tbody>${filas.join('')}</tbody>
      </table>
    </section>`;
  }).join('');

  return `
  <article class="doc doc-lista">
    ${cabecera(tar.empresa, 'Lista de precios', `Planes mensuales · ${tar.vigencia || ''}`, base)}
    ${bloqueIncluye(tar.incluyeTitulo, tar.incluye)}
    <p class="doc-mas">Más la prestación presencial, según el turno horario elegido:</p>
    ${cats}
    <section class="doc-legal">
      <p>${esc(tar.notaCoeficiente || '')}</p>
      <p>${esc(tar.notaFacturacion || '')}${tar.validezDias ? ` Validez: ${esc(tar.validezDias)} días` : ''}</p>
    </section>
    ${pie(tar.empresa)}
  </article>`;
}

// Texto plano para pegar en WhatsApp
export function textoWhatsApp(cot, link) {
  const t = totales(cot);
  const l = [];
  l.push(`*${cot.empresa?.nombre || 'Longevity Argentina'} · Cotización N.º ${cot.numero}*`);
  if (cot.cliente?.nombre) l.push(`Cliente: ${cot.cliente.nombre}`);
  if (cot.paciente?.nombre) l.push(`Paciente: ${cot.paciente.nombre}`);
  l.push('');
  cot.items.forEach(it => {
    const cant = Number(it.cantidad) || 1;
    l.push(`• ${it.categoria} — ${it.titulo}${it.modalidad ? ` (${it.modalidad})` : ''}${cant > 1 ? ` x${cant}` : ''}: ${pesos((Number(it.precio) || 0) * cant)}`);
  });
  if (t.coef !== 1 && cot.coef?.mostrar) l.push(`• Coeficiente${cot.coef.motivo ? ' por ' + cot.coef.motivo : ''}: ${pesos(t.conCoef - t.subtotal)}`);
  if (t.ivaPct) l.push(`• IVA ${t.ivaPct}%: ${pesos(t.iva)}`);
  l.push('');
  l.push(`*Total mensual${t.ivaPct ? '' : ' (sin IVA)'}: ${pesos(t.total)}*`);
  if (cot.validezDias) l.push(`Validez: ${cot.validezDias} días.`);
  if (link) { l.push(''); l.push(`Ver la cotización completa: ${link}`); }
  return l.join('\n');
}
