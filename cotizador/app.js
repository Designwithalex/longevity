import {
  pesos, esc, redondear, uid, nombreItem, precioModalidad, valorHora,
  codificar, totales, renderCotizacion, renderLista, textoWhatsApp
} from './comun.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clonar = o => JSON.parse(JSON.stringify(o));
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

// =====================================================================
// Almacenamiento: servidor (php/cotizador-api.php en produccion) o este
// navegador (preview de GitHub Pages, o produccion sin clave configurada).
// =====================================================================
const API = '../php/cotizador-api.php';
const LS = { tar: 'lgv-cot-tarifas', cots: 'lgv-cot-cotizaciones', vers: 'lgv-cot-versiones', num: 'lgv-cot-numero', clave: 'lgv-cot-clave' };

function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

const Almacen = {
  modo: 'local',
  clave: '',
  async api(accion, cuerpo) {
    const r = await fetch(`${API}?accion=${accion}`, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Clave': this.clave },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      cache: 'no-store'
    });
    const j = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida del servidor' }));
    if (!r.ok || j.ok === false) throw new Error(j.error || `Error ${r.status}`);
    return j;
  },
  async detectar() {
    try {
      const r = await fetch(`${API}?accion=ping`, { cache: 'no-store' });
      if (!r.ok) return 'local';
      const j = await r.json();
      return j.ok && j.configurado ? 'servidor' : 'local';
    } catch { return 'local'; }
  },
  async tarifasOriginales() {
    const r = await fetch('tarifas.json', { cache: 'no-store' });
    return r.json();
  },
  async cargarTarifas() {
    if (this.modo === 'servidor') {
      const j = await this.api('tarifas');
      if (j.tarifas) return j.tarifas;
    } else {
      const t = lsGet(LS.tar, null);
      if (t) return t;
    }
    return this.tarifasOriginales();
  },
  async guardarTarifas(t, anterior) {
    if (this.modo === 'servidor') return this.api('guardar-tarifas', t);
    if (anterior) {
      const v = lsGet(LS.vers, []);
      v.unshift({ fecha: new Date().toISOString(), vigencia: anterior.vigencia, tarifas: anterior });
      lsSet(LS.vers, v.slice(0, 15));
    }
    if (!lsSet(LS.tar, t)) throw new Error('No se pudo guardar en este navegador');
  },
  async versiones() {
    if (this.modo === 'servidor') return (await this.api('versiones')).versiones || [];
    return lsGet(LS.vers, []);
  },
  async listar() {
    if (this.modo === 'servidor') return (await this.api('cotizaciones')).cotizaciones || [];
    return lsGet(LS.cots, []);
  },
  async guardarCot(c) {
    if (this.modo === 'servidor') return (await this.api('guardar-cotizacion', c)).cotizacion;
    const l = lsGet(LS.cots, []);
    if (!c.numero) c.numero = this.siguienteNumeroLocal();
    const i = l.findIndex(x => x.id === c.id);
    if (i >= 0) l[i] = c; else l.unshift(c);
    if (!lsSet(LS.cots, l)) throw new Error('No se pudo guardar en este navegador');
    return c;
  },
  async borrarCot(id) {
    if (this.modo === 'servidor') return this.api('borrar-cotizacion', { id });
    lsSet(LS.cots, lsGet(LS.cots, []).filter(x => x.id !== id));
  },
  siguienteNumeroLocal() {
    const anio = new Date().getFullYear();
    const n = lsGet(LS.num, {});
    n[anio] = (n[anio] || 0) + 1;
    lsSet(LS.num, n);
    return `${anio}-${String(n[anio]).padStart(4, '0')}`;
  }
};

// =====================================================================
// Estado
// =====================================================================
let tar = null;          // tarifas en edicion
let tarGuardadas = null; // ultima version guardada (para "descartar")
let cot = null;          // cotizacion en edicion
let cots = [];           // cotizaciones guardadas
let cotGuardada = '';    // json de la ultima version guardada de `cot`

function aviso(msg, tipo = 'ok') {
  const el = $('#aviso');
  el.textContent = msg;
  el.className = 'aviso visible ' + tipo;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.className = 'aviso'; }, 3200);
}

// =====================================================================
// Cotizacion
// =====================================================================
function cotNueva() {
  return {
    id: uid('cot'),
    numero: '',
    fecha: hoy(),
    estado: 'Borrador',
    cliente: { nombre: '', telefono: '', email: '' },
    paciente: { nombre: '', edad: '', zona: '' },
    consulta: { origen: '', referencia: '' },
    items: [],
    coef: { valor: 1, motivo: '', mostrar: false },
    iva: { aplicar: false, porcentaje: tar.iva?.porcentaje ?? 21 },
    validezDias: tar.validezDias ?? 7,
    mostrarHora: true,
    observaciones: ''
  };
}

function buscar(catId, itemId) {
  const cat = tar.categorias.find(c => c.id === catId);
  const item = cat?.items.find(i => i.id === itemId);
  return { cat, item };
}

function itemNuevo(tipo = 'lista') {
  if (tipo === 'libre') {
    return { uid: uid('it'), tipo: 'libre', categoria: 'Otros', titulo: '', descripcion: '', modalidad: 'Mensual', cantidad: 1, precio: 0 };
  }
  const cat = tar.categorias.find(c => c.activa !== false && c.items.some(i => i.activo !== false));
  const item = cat.items.find(i => i.activo !== false);
  const mod = tar.modalidades.find(m => m.destacada) || tar.modalidades[0];
  return { uid: uid('it'), tipo: 'lista', catId: cat.id, itemId: item.id, modId: mod.id, cantidad: 1, precioManual: false, conReferencia: false, descripcion: cat.descripcion || '' };
}

// Completa los campos "de foto" de un item de lista a partir de las tarifas vigentes
function completarItem(it) {
  if (it.tipo === 'libre') return it;
  const { cat, item } = buscar(it.catId, it.itemId);
  const mod = tar.modalidades.find(m => m.id === it.modId);
  if (!cat || !item || !mod) return it; // la tarifa se borro: se conserva la foto anterior
  it.categoria = cat.nombre;
  it.titulo = nombreItem(item);
  it.grupo = item.grupo || '';
  it.colItem = cat.colItem;
  it.modalidad = mod.nombre;
  it.modDetalle = mod.detalle;
  it.precioLista = precioModalidad(tar, item, mod.id);
  if (!it.precioManual) it.precio = it.precioLista;
  it.hora = item.horas ? it.precio / (Number(mod.dias) * Number(item.horas)) : null;
  it.referencia = it.conReferencia
    ? cat.items.filter(x => x.activo !== false && (x.grupo || '') === (item.grupo || '')).map(x => ({
      nombre: x.nombre,
      actual: x.id === item.id,
      precios: Object.fromEntries(tar.modalidades.map(m => [m.id, precioModalidad(tar, x, m.id)]))
    }))
    : [];
  return it;
}

// Version que ve el cliente: foto de textos/empresa + coeficiente "escondido" si corresponde
function paraCliente(c) {
  const x = clonar(c);
  x.items.forEach(completarItemFoto);
  x.empresa = tar.empresa;
  x.incluyeTitulo = tar.incluyeTitulo;
  x.incluye = tar.incluye;
  x.notaCoeficiente = tar.notaCoeficiente;
  x.notaFacturacion = tar.notaFacturacion;
  x.modalidades = tar.modalidades.map(m => ({ id: m.id, nombre: m.nombre, detalle: m.detalle, destacada: !!m.destacada }));
  const k = Number(x.coef?.valor) || 1;
  if (k !== 1 && !x.coef.mostrar) {
    x.items.forEach(it => {
      it.precio = redondear((Number(it.precio) || 0) * k, 1);
      if (it.hora) it.hora = it.hora * k;
      (it.referencia || []).forEach(r => Object.keys(r.precios).forEach(m => { r.precios[m] = redondear(r.precios[m] * k, 1); }));
    });
    x.coef = { valor: 1, motivo: '', mostrar: false };
  }
  // datos internos que no viajan al cliente
  delete x.consulta; delete x.estado; delete x.historial;
  x.items.forEach(it => { delete it.uid; delete it.catId; delete it.itemId; delete it.modId; delete it.precioManual; delete it.precioLista; delete it.conReferencia; delete it.tipo; });
  return x;
}
function completarItemFoto(it) { /* los items ya vienen completos desde el editor */ return it; }

function renderEditor() {
  const c = cot;
  $('#c-numero').textContent = c.numero ? `N.º ${c.numero}` : 'Sin guardar';
  $('#c-estado').value = c.estado || 'Borrador';
  for (const el of $$('[data-c]')) {
    const v = el.dataset.c.split('.').reduce((o, k) => o?.[k], c);
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  }
  // origenes de consulta
  const sel = $('#c-origen');
  sel.innerHTML = '<option value="">—</option>' + (tar.origenes || []).map(o => `<option>${esc(o)}</option>`).join('');
  sel.value = c.consulta.origen || '';
  renderItems();
  renderVista();
}

function opcionesCategorias(sel) {
  return tar.categorias.filter(c => c.activa !== false || c.id === sel)
    .map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
}
function opcionesItems(catId, sel) {
  const cat = tar.categorias.find(c => c.id === catId);
  if (!cat) return '';
  return cat.items.filter(i => i.activo !== false || i.id === sel)
    .map(i => `<option value="${esc(i.id)}" ${i.id === sel ? 'selected' : ''}>${esc(nombreItem(i))}</option>`).join('');
}
function opcionesModalidades(sel) {
  return tar.modalidades.map(m => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(m.nombre)} · ${esc(m.detalle)}</option>`).join('');
}

function renderItems() {
  const cont = $('#c-items');
  if (!cot.items.length) {
    cont.innerHTML = '<p class="vacio">Todavía no agregaste servicios. Usá los botones de abajo.</p>';
    return;
  }
  cont.innerHTML = cot.items.map((it, i) => {
    completarItem(it);
    if (it.tipo === 'libre') {
      return `
      <div class="item libre" data-i="${i}">
        <div class="item-top"><span class="item-tag">Ítem libre</span><button type="button" class="x" data-acc="quitar" title="Quitar">×</button></div>
        <div class="grid g-libre">
          <label class="span2">Descripción<input data-it="titulo" value="${esc(it.titulo)}" placeholder="Ej: Kinesiología 2 veces por semana"></label>
          <label>Categoría<input data-it="categoria" value="${esc(it.categoria)}"></label>
          <label>Modalidad<input data-it="modalidad" value="${esc(it.modalidad)}"></label>
          <label>Cantidad<input data-it="cantidad" type="number" min="1" step="1" value="${esc(it.cantidad)}"></label>
          <label>Precio mensual<input data-it="precio" type="number" min="0" step="1" value="${esc(it.precio)}"></label>
          <label class="span2">Detalle (opcional)<input data-it="descripcion" value="${esc(it.descripcion)}"></label>
        </div>
      </div>`;
    }
    const manual = it.precioManual;
    return `
    <div class="item" data-i="${i}">
      <div class="item-top"><span class="item-tag">${esc(it.categoria || '')}</span><button type="button" class="x" data-acc="quitar" title="Quitar">×</button></div>
      <div class="grid">
        <label class="span2">Servicio<select data-it="catId">${opcionesCategorias(it.catId)}</select></label>
        <label>Nivel / turno<select data-it="itemId">${opcionesItems(it.catId, it.itemId)}</select></label>
        <label>Modalidad<select data-it="modId">${opcionesModalidades(it.modId)}</select></label>
        <label>Cantidad<input data-it="cantidad" type="number" min="1" step="1" value="${esc(it.cantidad)}"></label>
        <label>Precio mensual ${manual ? `<button type="button" class="link" data-acc="lista">volver a lista</button>` : '<small>(de lista)</small>'}
          <input data-it="precio" type="number" min="0" step="1" value="${esc(it.precio)}" class="${manual ? 'manual' : ''}"></label>
        <label class="span2">Detalle que ve el cliente<input data-it="descripcion" value="${esc(it.descripcion)}"></label>
      </div>
      <div class="item-pie">
        <label class="check"><input type="checkbox" data-it="conReferencia" ${it.conReferencia ? 'checked' : ''}> Mostrar referencia de los otros turnos${it.grupo ? ' de ' + esc(it.grupo) : ''}</label>
        <span class="item-hora">${it.hora ? 'Valor hora: ' + pesos(it.hora) : ''}${manual ? ` · Lista: ${pesos(it.precioLista)}` : ''}</span>
      </div>
    </div>`;
  }).join('');
}

function renderVista() {
  const x = paraCliente(cot);
  $('#c-vista').innerHTML = renderCotizacion(x);
  const t = totales(x);
  $('#c-total').textContent = pesos(t.total);
  $('#c-sucio').hidden = JSON.stringify(cot) === cotGuardada;
}

function onCampoCot(e) {
  const el = e.target;
  if (el.dataset.c) {
    const ruta = el.dataset.c.split('.');
    let o = cot;
    ruta.slice(0, -1).forEach(k => { o = o[k]; });
    const k = ruta.at(-1);
    o[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value);
    renderVista();
    return;
  }
  if (el.dataset.it) {
    const i = Number(el.closest('[data-i]').dataset.i);
    const it = cot.items[i];
    const k = el.dataset.it;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = v === '' ? 0 : Number(v);
    it[k] = v;
    if (k === 'catId') {
      const cat = tar.categorias.find(c => c.id === v);
      it.itemId = cat.items.find(x => x.activo !== false)?.id || cat.items[0]?.id;
      it.descripcion = cat.descripcion || '';
      it.precioManual = false;
    }
    if (k === 'itemId' || k === 'modId') it.precioManual = false;
    if (k === 'precio' && it.tipo !== 'libre') it.precioManual = Number(v) !== it.precioLista;
    // los select cambian opciones dependientes: re-render del bloque de items
    if (el.tagName === 'SELECT' || el.type === 'checkbox' || (k === 'precio' && e.type === 'change')) renderItems();
    else completarItem(it);
    renderVista();
  }
}

async function guardarCot(silencioso) {
  try {
    cot.actualizado = new Date().toISOString();
    cot.total = totales(paraCliente(cot)).total;
    const g = await Almacen.guardarCot(clonar(cot));
    cot.numero = g.numero;
    cotGuardada = JSON.stringify(cot);
    cots = await Almacen.listar();
    renderEditor();
    renderHistorial();
    if (!silencioso) aviso(`Cotización N.º ${cot.numero} guardada`);
    return true;
  } catch (err) { aviso(err.message, 'error'); return false; }
}

async function linkCliente() {
  if (!cot.numero || JSON.stringify(cot) !== cotGuardada) { if (!(await guardarCot(true))) return null; }
  const datos = await codificar(paraCliente(cot));
  return new URL(`ver.html#${datos}`, location.href).href;
}

async function copiar(txt, msg) {
  try { await navigator.clipboard.writeText(txt); aviso(msg); }
  catch { window.prompt('Copiá el texto:', txt); }
}

// =====================================================================
// Historial de cotizaciones
// =====================================================================
const ESTADOS = ['Borrador', 'Enviada', 'Aceptada', 'Rechazada'];

function renderHistorial() {
  const q = ($('#h-buscar').value || '').toLowerCase();
  const fe = $('#h-estado').value;
  const lista = cots.filter(c => (!fe || c.estado === fe) &&
    (!q || [c.numero, c.cliente?.nombre, c.paciente?.nombre, c.consulta?.referencia, c.consulta?.origen].join(' ').toLowerCase().includes(q)));

  const porEstado = Object.fromEntries(ESTADOS.map(e => [e, cots.filter(c => (c.estado || 'Borrador') === e)]));
  $('#h-resumen').innerHTML = ESTADOS.map(e => `
    <div class="kpi"><span>${e}</span><strong>${porEstado[e].length}</strong><em>${pesos(porEstado[e].reduce((a, c) => a + (c.total || 0), 0))}/mes</em></div>`).join('');

  $('#h-tabla tbody').innerHTML = lista.length ? lista.map(c => `
    <tr data-id="${esc(c.id)}">
      <td><strong>${esc(c.numero)}</strong><span>${esc(c.fecha)}</span></td>
      <td>${esc(c.cliente?.nombre) || '—'}<span>${esc(c.cliente?.telefono || '')}</span></td>
      <td>${esc(c.paciente?.nombre) || '—'}</td>
      <td>${esc(c.consulta?.origen || '')}<span>${esc(c.consulta?.referencia || '')}</span></td>
      <td class="num">${pesos(c.total)}</td>
      <td><select data-h="estado">${ESTADOS.map(e => `<option ${e === (c.estado || 'Borrador') ? 'selected' : ''}>${e}</option>`).join('')}</select></td>
      <td class="acc">
        <button type="button" data-h="abrir">Abrir</button>
        <button type="button" data-h="duplicar">Duplicar</button>
        <button type="button" data-h="borrar" class="peligro">Borrar</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" class="vacio">${cots.length ? 'No hay cotizaciones con ese filtro.' : 'Todavía no hay cotizaciones guardadas.'}</td></tr>`;
}

function exportarCSV() {
  const cols = ['numero', 'fecha', 'estado', 'cliente', 'telefono', 'email', 'paciente', 'zona', 'origen', 'referencia', 'servicios', 'total'];
  const filas = cots.map(c => [c.numero, c.fecha, c.estado, c.cliente?.nombre, c.cliente?.telefono, c.cliente?.email, c.paciente?.nombre, c.paciente?.zona,
    c.consulta?.origen, c.consulta?.referencia, c.items.map(i => `${i.categoria} ${i.titulo} (${i.modalidad})`).join(' + '), c.total]);
  const csv = [cols, ...filas].map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  descargar(`cotizaciones-longevity-${hoy()}.csv`, '﻿' + csv, 'text/csv');
}

function descargar(nombre, contenido, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// =====================================================================
// Tarifas
// =====================================================================
function setRuta(obj, ruta, valor) {
  const k = ruta.split('.');
  let o = obj;
  k.slice(0, -1).forEach(p => { o = o[p]; });
  o[k.at(-1)] = valor;
}
function getRuta(obj, ruta) { return ruta.split('.').reduce((o, k) => o?.[k], obj); }

function tarSucias() { return JSON.stringify(tar) !== JSON.stringify(tarGuardadas); }
function marcarTar() {
  const s = tarSucias();
  $('#t-sucio').hidden = !s;
  $('#t-guardar').disabled = !s;
  $('#t-descartar').disabled = !s;
}

function inp(ruta, tipo = 'text', extra = '') {
  const v = getRuta(tar, ruta);
  if (tipo === 'checkbox') return `<input type="checkbox" data-t="${ruta}" ${v !== false ? 'checked' : ''} ${extra}>`;
  return `<input type="${tipo}" data-t="${ruta}" value="${esc(v ?? '')}" ${tipo === 'number' ? 'step="any"' : ''} ${extra}>`;
}

function renderTarifas() {
  // generales
  for (const el of $$('[data-tg]')) {
    const v = getRuta(tar, el.dataset.tg);
    el.value = Array.isArray(v) ? v.join(el.tagName === 'TEXTAREA' ? '\n' : ', ') : (v ?? '');
  }
  $('#t-actualizado').textContent = tar.actualizado ? `Última actualización: ${tar.actualizado}` : '';

  // modalidades
  $('#t-modalidades tbody').innerHTML = tar.modalidades.map((m, i) => `
    <tr>
      <td>${inp(`modalidades.${i}.nombre`)}</td>
      <td>${inp(`modalidades.${i}.detalle`)}</td>
      <td class="num">${inp(`modalidades.${i}.dias`, 'number', 'min="0"')}</td>
      <td class="num">${inp(`modalidades.${i}.recargo`, 'number')}</td>
      <td class="c"><input type="radio" name="t-dest" data-dest="${i}" ${m.destacada ? 'checked' : ''} title="Columna destacada"></td>
    </tr>`).join('');

  // alcances del ajuste masivo
  const alc = $('#a-alcance');
  const prev = alc.value;
  const horas = [...new Set(tar.categorias.flatMap(c => c.items.map(i => i.horas)).filter(Boolean))].sort((a, b) => a - b);
  alc.innerHTML = `<option value="todo">Toda la lista</option>
    <optgroup label="Por servicio">${tar.categorias.map(c => `<option value="cat:${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}</optgroup>
    <optgroup label="Por nivel">${tar.categorias.flatMap(c => [...new Set(c.items.map(i => i.grupo).filter(Boolean))].map(g => `<option value="grupo:${esc(c.id)}|${esc(g)}">${esc(c.nombre)} · ${esc(g)}</option>`)).join('')}</optgroup>
    <optgroup label="Por turno">${horas.map(h => `<option value="horas:${h}">Turnos de ${h} hs (todos los servicios)</option>`).join('')}</optgroup>`;
  if ([...alc.options].some(o => o.value === prev)) alc.value = prev;
  previaAjuste();

  // categorias
  $('#t-categorias').innerHTML = tar.categorias.map((c, ci) => `
    <section class="t-cat ${c.activa === false ? 'inactiva' : ''}" data-ci="${ci}">
      <div class="t-cat-head">
        <input class="t-cat-nombre" data-t="categorias.${ci}.nombre" value="${esc(c.nombre)}" aria-label="Nombre del servicio">
        <label class="check">${inp(`categorias.${ci}.activa`, 'checkbox')} Visible</label>
        <div class="t-cat-acc">
          <button type="button" data-ta="cat-subir" title="Subir" ${ci === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-ta="cat-bajar" title="Bajar" ${ci === tar.categorias.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-ta="cat-borrar" class="peligro" title="Borrar servicio">Borrar</button>
        </div>
      </div>
      <div class="grid g-cat">
        <label class="span2">Descripción (la ve el cliente en la cotización)${inp(`categorias.${ci}.descripcion`)}</label>
        <label>Título columna nivel${inp(`categorias.${ci}.colGrupo`, 'text', 'placeholder="Ej: Nivel (vacío = sin niveles)"')}</label>
        <label>Título columna ítem${inp(`categorias.${ci}.colItem`)}</label>
      </div>
      <div class="tabla-scroll">
      <table class="t-items">
        <thead><tr>
          <th>Nivel</th><th>Turno / prestación</th><th class="num">Horas</th>
          ${tar.modalidades.map(m => `<th class="num ${m.destacada ? 'dest' : ''}">${esc(m.nombre)}${m.destacada ? '<span>precio base</span>' : '<span>auto · o fijo</span>'}</th>`).join('')}
          <th class="num">Valor hora</th><th class="c">Visible</th><th></th>
        </tr></thead>
        <tbody>${c.items.map((it, ii) => filaItem(ci, ii)).join('')}</tbody>
      </table>
      </div>
      <button type="button" class="sec" data-ta="item-agregar">+ Agregar turno / prestación</button>
    </section>`).join('');

  renderListaPrevia();
  marcarTar();
}

function filaItem(ci, ii) {
  const it = tar.categorias[ci].items[ii];
  const base = tar.modalidades.find(m => m.destacada) || tar.modalidades[0];
  return `
    <tr data-ii="${ii}" class="${it.activo === false ? 'inactiva' : ''}">
      <td>${inp(`categorias.${ci}.items.${ii}.grupo`, 'text', 'class="corto" placeholder="—"')}</td>
      <td>${inp(`categorias.${ci}.items.${ii}.nombre`)}</td>
      <td class="num">${inp(`categorias.${ci}.items.${ii}.horas`, 'number', 'class="mini" min="0" placeholder="—"')}</td>
      ${tar.modalidades.map(m => m.id === base.id
    ? `<td class="num dest">${inp(`categorias.${ci}.items.${ii}.precio`, 'number', 'min="0" step="1"')}</td>`
    : `<td class="num"><input type="number" step="1" min="0" data-fijo="${ci}.${ii}.${m.id}" value="${esc(it.fijos?.[m.id] ?? '')}" placeholder="${precioModalidad(tar, { ...it, fijos: {} }, m.id)}" title="Vacío = se calcula solo. Escribí un valor para fijarlo a mano." class="${it.fijos?.[m.id] != null && it.fijos?.[m.id] !== '' ? 'manual' : ''}"></td>`).join('')}
      <td class="num calc" data-calc-hora>${it.horas ? pesos(valorHora(tar, it, base.id)) : '—'}</td>
      <td class="c">${inp(`categorias.${ci}.items.${ii}.activo`, 'checkbox')}</td>
      <td class="acc">
        <button type="button" data-ta="item-subir" title="Subir" ${ii === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-ta="item-bajar" title="Bajar" ${ii === tar.categorias[ci].items.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" data-ta="item-borrar" class="peligro" title="Borrar">×</button>
      </td>
    </tr>`;
}

function renderListaPrevia() {
  $('#t-lista').innerHTML = renderLista(tar);
}

function refrescarFila(ci, ii) {
  const tr = $(`.t-cat[data-ci="${ci}"] tr[data-ii="${ii}"]`);
  if (!tr) return;
  const it = tar.categorias[ci].items[ii];
  const base = tar.modalidades.find(m => m.destacada) || tar.modalidades[0];
  for (const f of $$('[data-fijo]', tr)) {
    const m = f.dataset.fijo.split('.')[2];
    f.placeholder = precioModalidad(tar, { ...it, fijos: {} }, m);
  }
  $('[data-calc-hora]', tr).textContent = it.horas ? pesos(valorHora(tar, it, base.id)) : '—';
}

function onCampoTar(e) {
  const el = e.target;
  if (el.dataset.t) {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = v === '' ? null : Number(v);
    setRuta(tar, el.dataset.t, v);
    const m = el.dataset.t.match(/^categorias\.(\d+)\.items\.(\d+)\./);
    if (m) refrescarFila(+m[1], +m[2]);
    if (el.dataset.t.startsWith('modalidades') || el.type === 'checkbox') { if (e.type === 'change') renderTarifas(); }
    else if (el.dataset.t.endsWith('.nombre') && /^categorias\.\d+\.nombre$/.test(el.dataset.t) && e.type === 'change') renderTarifas();
    renderListaPrevia();
    previaAjuste();
    marcarTar();
    return;
  }
  if (el.dataset.fijo) {
    const [ci, ii, m] = el.dataset.fijo.split('.');
    const it = tar.categorias[ci].items[ii];
    it.fijos = it.fijos || {};
    if (el.value === '') delete it.fijos[m]; else it.fijos[m] = Number(el.value);
    if (!Object.keys(it.fijos).length) delete it.fijos;
    el.classList.toggle('manual', el.value !== '');
    renderListaPrevia();
    marcarTar();
    return;
  }
  if (el.dataset.dest !== undefined) {
    tar.modalidades.forEach((m, i) => { m.destacada = i === Number(el.dataset.dest); });
    renderTarifas();
    return;
  }
  if (el.dataset.tg) {
    const k = el.dataset.tg;
    let v = el.value;
    if (k === 'origenes') v = v.split(',').map(s => s.trim()).filter(Boolean);
    else if (k === 'incluye' || k === 'empresa.oficinas') v = v.split('\n').map(s => s.trim()).filter(Boolean);
    else if (el.type === 'number') v = v === '' ? null : Number(v);
    setRuta(tar, k, v);
    if (k === 'diasBase' || k === 'redondeo') $$('.t-cat tr[data-ii]').forEach(tr => refrescarFila(+tr.closest('.t-cat').dataset.ci, +tr.dataset.ii));
    renderListaPrevia();
    marcarTar();
  }
}

function accionTar(btn) {
  const a = btn.dataset.ta;
  const ci = Number(btn.closest('[data-ci]')?.dataset.ci);
  const ii = Number(btn.closest('[data-ii]')?.dataset.ii);
  const cats = tar.categorias;
  const mover = (arr, i, d) => { const [x] = arr.splice(i, 1); arr.splice(i + d, 0, x); };
  if (a === 'cat-subir') mover(cats, ci, -1);
  if (a === 'cat-bajar') mover(cats, ci, 1);
  if (a === 'cat-borrar') {
    if (!confirm(`¿Borrar el servicio "${cats[ci].nombre}" y todas sus tarifas? (Si solo querés ocultarlo, destildá "Visible")`)) return;
    cats.splice(ci, 1);
  }
  if (a === 'cat-agregar') {
    cats.push({ id: uid('cat'), nombre: 'Nuevo servicio', descripcion: '', colGrupo: '', colItem: 'Turno', activa: true,
      items: [{ id: uid('it'), grupo: '', nombre: '12 hs', horas: 12, precio: 0, activo: true }] });
  }
  const items = cats[ci]?.items;
  if (a === 'item-subir') mover(items, ii, -1);
  if (a === 'item-bajar') mover(items, ii, 1);
  if (a === 'item-borrar') items.splice(ii, 1);
  if (a === 'item-agregar') {
    const ult = items.at(-1);
    items.push({ id: uid('it'), grupo: ult?.grupo || '', nombre: '', horas: ult?.horas ?? null, precio: 0, activo: true });
  }
  renderTarifas();
  if (a === 'cat-agregar') $$('.t-cat').at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- ajuste masivo ----
function itemsDelAlcance(alcance) {
  const out = [];
  tar.categorias.forEach(c => c.items.forEach(i => {
    if (alcance === 'todo') out.push(i);
    else if (alcance.startsWith('cat:') && c.id === alcance.slice(4)) out.push(i);
    else if (alcance.startsWith('grupo:')) { const [cid, g] = alcance.slice(6).split('|'); if (c.id === cid && i.grupo === g) out.push(i); }
    else if (alcance.startsWith('horas:') && Number(i.horas) === Number(alcance.slice(6))) out.push(i);
  }));
  return out;
}
function previaAjuste() {
  const pct = Number($('#a-pct').value) || 0;
  const items = itemsDelAlcance($('#a-alcance').value || 'todo');
  const paso = Number($('#a-redondeo').value) || 1;
  const ej = items[0];
  $('#a-previa').innerHTML = items.length
    ? `${items.length} tarifa${items.length > 1 ? 's' : ''}. ${ej && pct ? `Ej: ${esc(nombreItem(ej))} ${pesos(ej.precio)} → <strong>${pesos(redondear(ej.precio * (1 + pct / 100), paso))}</strong>` : ''}`
    : 'Ninguna tarifa en ese alcance.';
  $('#a-aplicar').disabled = !pct || !items.length;
}
function aplicarAjuste() {
  const pct = Number($('#a-pct').value) || 0;
  const paso = Number($('#a-redondeo').value) || 1;
  const items = itemsDelAlcance($('#a-alcance').value);
  if (!pct || !items.length) return;
  items.forEach(i => {
    i.precio = redondear((Number(i.precio) || 0) * (1 + pct / 100), paso);
    if (i.fijos) Object.keys(i.fijos).forEach(m => { i.fijos[m] = redondear(i.fijos[m] * (1 + pct / 100), paso); });
  });
  $('#a-pct').value = '';
  renderTarifas();
  aviso(`Ajuste de ${pct > 0 ? '+' : ''}${pct}% aplicado a ${items.length} tarifas. Revisá y tocá "Guardar cambios".`);
}

async function guardarTarifas() {
  try {
    tar.actualizado = hoy();
    await Almacen.guardarTarifas(tar, tarGuardadas);
    tarGuardadas = clonar(tar);
    renderTarifas();
    if (cot) { cot.items.forEach(completarItem); renderEditor(); }
    aviso('Tarifas guardadas');
  } catch (err) { aviso(err.message, 'error'); }
}

async function renderVersiones() {
  const v = await Almacen.versiones().catch(() => []);
  $('#t-versiones').innerHTML = v.length ? v.map((x, i) => `
    <li><span>${new Date(x.fecha).toLocaleString('es-AR')} · ${esc(x.vigencia || '')}</span>
    <button type="button" class="link" data-ver="${i}">Restaurar</button></li>`).join('') : '<li class="vacio">Todavía no hay versiones anteriores.</li>';
  renderVersiones.lista = v;
}

// =====================================================================
// Navegacion, arranque y eventos
// =====================================================================
function irA(tab) {
  $$('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === tab));
  $$('.panel').forEach(p => { p.hidden = p.id !== 'p-' + tab; });
  try { sessionStorage.setItem('lgv-cot-tab', tab); } catch { /* sin storage */ }
  if (tab === 'tarifas') renderVersiones();
}

async function arrancar() {
  Almacen.modo = await Almacen.detectar();
  if (Almacen.modo === 'servidor') {
    Almacen.clave = (() => { try { return sessionStorage.getItem(LS.clave) || ''; } catch { return ''; } })();
    let ok = false;
    while (!ok) {
      if (!Almacen.clave) Almacen.clave = await pedirClave();
      try { await Almacen.api('cotizaciones'); ok = true; } catch { Almacen.clave = ''; $('#login-error').hidden = false; }
    }
    try { sessionStorage.setItem(LS.clave, Almacen.clave); } catch { /* sin storage */ }
    $('#modo').textContent = 'Guardado en el servidor';
    $('#modo').className = 'modo servidor';
  } else {
    $('#modo').textContent = 'Modo prueba · se guarda en este navegador';
    $('#modo').className = 'modo local';
    $('#modo').title = 'En el link de prueba no hay servidor: las tarifas y cotizaciones quedan en este navegador. Usá Exportar/Importar para pasarlas a otra compu.';
  }
  $('#login').hidden = true;

  tar = await Almacen.cargarTarifas();
  tarGuardadas = clonar(tar);
  cots = await Almacen.listar();
  cot = cotNueva();
  cotGuardada = '';

  renderEditor();
  renderHistorial();
  renderTarifas();
  let tab = 'cotizar';
  try { tab = sessionStorage.getItem('lgv-cot-tab') || 'cotizar'; } catch { /* sin storage */ }
  irA(tab);
  document.body.classList.add('listo');
}

function pedirClave() {
  return new Promise(res => {
    $('#login').hidden = false;
    $('#login-clave').focus();
    $('#login').onsubmit = e => { e.preventDefault(); res($('#login-clave').value); };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $$('.tab').forEach(t => t.addEventListener('click', () => irA(t.dataset.tab)));

  // ---- cotizar ----
  const pc = $('#p-cotizar');
  pc.addEventListener('input', onCampoCot);
  pc.addEventListener('change', onCampoCot);
  pc.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    const acc = b.dataset.acc;
    const i = Number(b.closest('[data-i]')?.dataset.i);
    if (acc === 'quitar') { cot.items.splice(i, 1); renderItems(); renderVista(); }
    if (acc === 'lista') { cot.items[i].precioManual = false; renderItems(); renderVista(); }
    if (acc === 'agregar') { cot.items.push(itemNuevo('lista')); renderItems(); renderVista(); }
    if (acc === 'libre') { cot.items.push(itemNuevo('libre')); renderItems(); renderVista(); $$('#c-items .item').at(-1)?.querySelector('input')?.focus(); }
    if (acc === 'guardar') guardarCot();
    if (acc === 'nueva') {
      if (JSON.stringify(cot) !== cotGuardada && cot.items.length && !confirm('Hay cambios sin guardar. ¿Empezar una cotización nueva igual?')) return;
      cot = cotNueva(); cotGuardada = ''; renderEditor();
    }
    if (acc === 'link') { const l = await linkCliente(); if (l) copiar(l, 'Link copiado. Pegalo en WhatsApp o en el mail.'); }
    if (acc === 'abrir-link') { const l = await linkCliente(); if (l) window.open(l, '_blank'); }
    if (acc === 'whatsapp') {
      const l = await linkCliente(); if (!l) return;
      const txt = textoWhatsApp(paraCliente(cot), l);
      const tel = String(cot.cliente.telefono || '').replace(/\D/g, '');
      if (b.dataset.modo === 'copiar' || !tel) copiar(txt, 'Texto copiado para WhatsApp');
      else window.open(`https://wa.me/${tel.length <= 10 ? '549' + tel : tel}?text=${encodeURIComponent(txt)}`, '_blank');
    }
    if (acc === 'imprimir') {
      if (!cot.numero) await guardarCot(true);
      document.body.dataset.imprimir = 'cotizacion';
      window.print();
    }
  });

  // ---- historial ----
  $('#h-buscar').addEventListener('input', renderHistorial);
  $('#h-estado').addEventListener('change', renderHistorial);
  $('#h-csv').addEventListener('click', exportarCSV);
  $('#h-tabla').addEventListener('change', async e => {
    if (e.target.dataset.h !== 'estado') return;
    const c = cots.find(x => x.id === e.target.closest('tr').dataset.id);
    c.estado = e.target.value;
    try { await Almacen.guardarCot(c); renderHistorial(); if (cot.id === c.id) { cot.estado = c.estado; cotGuardada = JSON.stringify(cot); renderEditor(); } }
    catch (err) { aviso(err.message, 'error'); }
  });
  $('#h-tabla').addEventListener('click', async e => {
    const b = e.target.closest('button[data-h]');
    if (!b) return;
    const c = cots.find(x => x.id === b.closest('tr').dataset.id);
    if (b.dataset.h === 'abrir') { cot = clonar(c); cotGuardada = JSON.stringify(cot); renderEditor(); irA('cotizar'); }
    if (b.dataset.h === 'duplicar') {
      cot = clonar(c);
      Object.assign(cot, { id: uid('cot'), numero: '', fecha: hoy(), estado: 'Borrador' });
      cot.items.forEach(it => { it.uid = uid('it'); });
      cotGuardada = ''; renderEditor(); irA('cotizar');
      aviso('Copia lista: los precios se actualizaron a la lista vigente');
    }
    if (b.dataset.h === 'borrar') {
      if (!confirm(`¿Borrar la cotización N.º ${c.numero}?`)) return;
      await Almacen.borrarCot(c.id);
      cots = await Almacen.listar(); renderHistorial();
    }
  });

  // ---- tarifas ----
  const pt = $('#p-tarifas');
  pt.addEventListener('input', onCampoTar);
  pt.addEventListener('change', onCampoTar);
  pt.addEventListener('click', e => { const b = e.target.closest('button[data-ta]'); if (b) accionTar(b); });
  $('#a-pct').addEventListener('input', previaAjuste);
  $('#a-alcance').addEventListener('change', previaAjuste);
  $('#a-redondeo').addEventListener('change', previaAjuste);
  $('#a-aplicar').addEventListener('click', aplicarAjuste);
  $('#t-guardar').addEventListener('click', guardarTarifas);
  $('#t-descartar').addEventListener('click', () => { tar = clonar(tarGuardadas); renderTarifas(); });
  $('#t-imprimir').addEventListener('click', () => { document.body.dataset.imprimir = 'lista'; window.print(); });
  $('#t-exportar').addEventListener('click', () => descargar(`tarifas-longevity-${hoy()}.json`, JSON.stringify(tar, null, 2), 'application/json'));
  $('#t-importar').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const t = JSON.parse(await f.text());
      if (!Array.isArray(t.categorias) || !Array.isArray(t.modalidades)) throw new Error('El archivo no es una lista de tarifas');
      tar = t; renderTarifas(); aviso('Lista importada. Revisá y tocá "Guardar cambios".');
    } catch (err) { aviso(err.message, 'error'); }
    e.target.value = '';
  });
  $('#t-original').addEventListener('click', async () => {
    if (!confirm('¿Volver a cargar la lista de precios original (octubre 2026)? Vas a poder revisarla antes de guardar.')) return;
    tar = await Almacen.tarifasOriginales(); renderTarifas(); aviso('Lista original cargada. Tocá "Guardar cambios" para quedártela.');
  });
  $('#t-versiones').addEventListener('click', e => {
    const b = e.target.closest('[data-ver]');
    if (!b) return;
    tar = clonar(renderVersiones.lista[Number(b.dataset.ver)].tarifas);
    renderTarifas(); aviso('Versión cargada. Tocá "Guardar cambios" para restaurarla.');
  });

  window.addEventListener('afterprint', () => { delete document.body.dataset.imprimir; });
  window.addEventListener('beforeunload', e => { if (tar && tarSucias()) { e.preventDefault(); e.returnValue = ''; } });

  arrancar().catch(err => {
    console.error(err);
    $('#arranque').textContent = 'No se pudo cargar el cotizador: ' + err.message;
  });
});
