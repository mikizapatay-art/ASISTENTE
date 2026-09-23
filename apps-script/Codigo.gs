/**
 * ASISTENTE DE AULA — 4to "C"
 * Backend: API JSON sobre una Google Sheet, para que el sitio de GitHub
 * Pages lea y escriba datos reales sin necesitar servidor propio.
 *
 * Esto NO sirve páginas HTML (eso ya lo hace GitHub Pages). Solo responde
 * JSON cuando el sitio le hace fetch().
 */

// 1) Reemplaza con el ID de tu Google Sheet (la parte de la URL entre /d/ y /edit)
const SHEET_ID = 'PON_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';

const HOJA_ACTIVIDADES = 'Actividades';
const HOJA_MATERIAS = 'Materias';
const HOJA_ESTUDIANTES = 'Estudiantes'; // opcional, solo para los correos

const DIAS_ALERTA = 2;

function abrirHoja_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function salidaJSON_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- GET: el sitio pide datos ----------
// TU_URL_API?accion=actividades   → lista de actividades
// TU_URL_API?accion=materias      → lista de materias + docente
function doGet(e) {
  const accion = (e && e.parameter && e.parameter.accion) || 'actividades';
  if (accion === 'materias') return salidaJSON_(obtenerMaterias());
  return salidaJSON_(obtenerActividades());
}

// ---------- POST: el presidente registra una actividad ----------
// El sitio manda el body como texto plano con JSON adentro (para evitar
// problemas de CORS con las peticiones "preflight" de los navegadores).
function doPost(e) {
  const datos = JSON.parse(e.postData.contents);
  const conflicto = verificarConflicto(datos.fecha, datos.tipo);

  const hoja = abrirHoja_().getSheetByName(HOJA_ACTIVIDADES);
  const id = new Date().getTime();
  hoja.appendRow([
    id, datos.materia, datos.docente, datos.tipo, datos.titulo,
    datos.descripcion || '', datos.fecha, datos.hora || '',
    datos.registradoPor || 'Presidente de curso', new Date()
  ]);

  return salidaJSON_({ ok: true, conflicto: conflicto });
}

// ---------- Lectura de datos ----------

function obtenerActividades() {
  const hoja = abrirHoja_().getSheetByName(HOJA_ACTIVIDADES);
  const datos = hoja.getDataRange().getValues();
  datos.shift();
  return datos
    .filter(function (fila) { return fila[0] !== ''; })
    .map(function (fila) {
      return {
        id: fila[0],
        materia: fila[1],
        docente: fila[2],
        tipo: fila[3],
        titulo: fila[4],
        descripcion: fila[5],
        fecha: Utilities.formatDate(new Date(fila[6]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        hora: fila[7],
        registradoPor: fila[8]
      };
    });
}

function obtenerMaterias() {
  const hoja = abrirHoja_().getSheetByName(HOJA_MATERIAS);
  const datos = hoja.getDataRange().getValues();
  datos.shift();
  return datos
    .filter(function (fila) { return fila[0] !== ''; })
    .map(function (fila) {
      return { materia: fila[0], docente: fila[1] };
    });
}

function verificarConflicto(fecha, tipo) {
  if (tipo !== 'Examen') return null;
  const mismasFecha = obtenerActividades().filter(function (a) {
    return a.fecha === fecha && a.tipo === 'Examen';
  });
  return mismasFecha.length > 0 ? mismasFecha : null;
}

// ---------- Alertas por correo (opcional) ----------
// Solo se activa si llenas la hoja "Estudiantes" (Nombre, Email) y creas
// el disparador diario — ver README. Esta hoja NUNCA se expone por la API:
// solo el propio Apps Script la lee, así que los correos de los estudiantes
// no salen del backend.

function enviarAlertasDiarias() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const proximas = obtenerActividades().filter(function (a) {
    const f = new Date(a.fecha + 'T00:00:00');
    const dias = Math.round((f - hoy) / (24 * 60 * 60 * 1000));
    return dias === DIAS_ALERTA;
  });
  if (proximas.length === 0) return;

  const hojaEst = abrirHoja_().getSheetByName(HOJA_ESTUDIANTES);
  if (!hojaEst) return; // hoja opcional: si no existe, no manda nada

  const estudiantes = hojaEst.getDataRange().getValues();
  estudiantes.shift();

  const cuerpo = proximas.map(function (a) {
    return '• ' + a.tipo + ' de ' + a.materia + ': "' + a.titulo + '" el ' + a.fecha +
      (a.hora ? ' a las ' + a.hora : '');
  }).join('\n');

  estudiantes.forEach(function (fila) {
    const nombre = fila[0];
    const email = fila[1];
    if (email && String(email).indexOf('@') > -1) {
      MailApp.sendEmail({
        to: email,
        subject: 'Recordatorio: actividades próximas - 4to C',
        body: 'Hola ' + nombre + ',\n\nEstas son tus actividades para dentro de ' +
          DIAS_ALERTA + ' días:\n\n' + cuerpo
      });
    }
  });
}
