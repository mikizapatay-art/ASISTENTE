/* ===== Lógica compartida del Asistente de Aula =====
   Los datos viven en una Google Sheet; este archivo habla con ella a
   través de la API de Apps Script cuya URL está en config.js. */

const DIAS_ALERTA = 3; // ventana del aviso "lo que se viene"

async function cargarActividades() {
  try {
    const res = await fetch(API_URL + '?accion=actividades', { cache: 'no-store' });
    if (!res.ok) throw new Error('respuesta no OK');
    return await res.json();
  } catch (err) {
    console.error('No se pudo cargar actividades desde la Sheet:', err);
    return [];
  }
}

async function cargarMaterias() {
  try {
    const res = await fetch(API_URL + '?accion=materias', { cache: 'no-store' });
    if (!res.ok) throw new Error('respuesta no OK');
    return await res.json();
  } catch (err) {
    console.error('No se pudo cargar materias desde la Sheet:', err);
    return [];
  }
}

// Envía una nueva actividad a la Sheet. Usa Content-Type text/plain a
// propósito: así el navegador no manda una petición "preflight" (OPTIONS),
// que Apps Script no sabe responder.
async function guardarActividad(datos) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(datos)
  });
  if (!res.ok) throw new Error('No se pudo guardar la actividad.');
  return res.json(); // { ok: true, conflicto: [...] | null }
}

function proximasActividades(actividades, dias) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy.getTime() + dias * 86400000);
  return actividades
    .filter(a => {
      const f = new Date(a.fecha + 'T00:00:00');
      return f >= hoy && f <= limite;
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

function conflictosGlobales(actividades) {
  const porFecha = {};
  actividades.forEach(a => {
    if (a.tipo === 'Examen') {
      (porFecha[a.fecha] = porFecha[a.fecha] || []).push(a);
    }
  });
  return Object.keys(porFecha)
    .filter(f => porFecha[f].length > 1)
    .map(f => ({ fecha: f, examenes: porFecha[f] }))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

/* ---------- Calendario mensual ---------- */
let calActividades = [];
let calAnio = new Date().getFullYear();
let calMes = new Date().getMonth();
const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function iniciarCalendario(contenedorId, actividades) {
  calActividades = actividades || [];
  dibujarCalendario(contenedorId);
}

function cambiarMes(contenedorId, delta) {
  calMes += delta;
  if (calMes > 11) { calMes = 0; calAnio++; }
  if (calMes < 0) { calMes = 11; calAnio--; }
  dibujarCalendario(contenedorId);
}

function dibujarCalendario(contenedorId) {
  const cont = document.getElementById(contenedorId);
  const primerDia = new Date(calAnio, calMes, 1).getDay();
  const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate();

  let html = '<div class="cal-cabecera">' +
    '<button onclick="cambiarMes(\'' + contenedorId + '\', -1)">‹</button>' +
    '<span>' + NOMBRES_MES[calMes] + ' ' + calAnio + '</span>' +
    '<button onclick="cambiarMes(\'' + contenedorId + '\', 1)">›</button>' +
    '</div><div class="cal-grid">';

  ['D','L','M','M','J','V','S'].forEach(d => { html += '<div class="cal-dias-semana">' + d + '</div>'; });

  for (let i = 0; i < primerDia; i++) html += '<div class="cal-celda vacia"></div>';

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = calAnio + '-' + String(calMes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
    const delDia = calActividades.filter(a => a.fecha === fechaStr);
    const examenes = delDia.filter(a => a.tipo === 'Examen');

    let clase = 'cal-celda' + (examenes.length > 1 ? ' conflicto' : '');
    html += '<div class="' + clase + '">';
    html += '<div class="cal-num">' + dia + '</div>';
    delDia.slice(0, 3).forEach(a => {
      html += '<div class="cal-chip ' + a.tipo.toLowerCase() + '">' + a.materia + '</div>';
    });
    if (delDia.length > 3) html += '<div class="cal-mas">+' + (delDia.length - 3) + '</div>';
    html += '</div>';
  }

  html += '</div><div class="leyenda">' +
    '<span><i class="punto examen"></i> Examen</span>' +
    '<span><i class="punto tarea"></i> Tarea</span>' +
    '<span><i class="punto salida"></i> Salida</span>' +
    '</div>';

  cont.innerHTML = html;
}
