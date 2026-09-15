/* ============================================================
   INTERFAZ. Router por hash, todo renderizado a mano.
   Rutas: #/hoy  #/sesion/:id  #/calendario  #/ejercicios
          #/ejercicio/:id  #/ajustes
   ============================================================ */

const App = (function () {

  const $ = sel => document.querySelector(sel);
  let main, tabs, toastTimer;
  const abiertos = new Set();      // tarjetas de ejercicio desplegadas
  const nueva = {};                // valores de la fila "nueva serie" por ejercicio
  const modoElegido = {};          // bilateral/unilateral elegido antes de apuntar series
  const modoFicha = {};            // forma que se está viendo en la ficha de cada ejercicio

  /* ---------- utilidades ---------- */
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const DOW = ['lun','mar','mié','jue','vie','sáb','dom'];
  const DOW_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

  function hoyIso() { return DB.iso(new Date()); }

  function fechaLarga(iso) {
    const d = DB.desdeIso(iso);
    return `${DOW_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }
  function fechaCorta(iso) {
    const d = DB.desdeIso(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function num(n) { return Progresion.num(n); }
  function aNumero(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function toast(txt) {
    let t = $('#toast');
    t.textContent = txt; t.classList.add('ver');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('ver'), 1800);
  }
  function ir(ruta) { location.hash = ruta; }

  function descargar(nombre, texto) {
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const enlace = document.createElement('a');
    enlace.href = url; enlace.download = nombre;
    document.body.appendChild(enlace); enlace.click(); enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  /* Lunes de la semana de una fecha */
  function lunesDe(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - dow);
    return x;
  }

  /* ============================================================
     VISTA: HOY
     ============================================================ */
  function vistaHoy() {
    const hoy = new Date();
    const sugerido = Rutina.diaSugerido(hoy);
    const sesiones = DB.sesionesRegistradas();

    // semana actual
    const lun = lunesDe(hoy);
    const dom = new Date(lun); dom.setDate(dom.getDate() + 6);
    const deEstaSemana = sesiones.filter(s => {
      const f = DB.desdeIso(s.fecha);
      return f >= lun && f <= dom;
    });
    const delMes = sesiones.filter(s => {
      const f = DB.desdeIso(s.fecha);
      return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
    });

    // sesión en curso (hoy, sin finalizar)
    const enCurso = DB.sesiones().find(s => s.fecha === hoyIso() && !s.finalizada);

    let html = '';

    if (enCurso) {
      const d = Rutina.dia(enCurso.dia);
      html += `<div class="tarjeta" style="border-color:${d.color}">
        <div class="fila"><h3>Sesión en curso</h3><span class="pill dia" style="background:${d.color}">Día ${d.numero}</span></div>
        <p class="suave peque">${esc(d.nombre)} · ${DB.numSeries(enCurso)} series registradas</p>
        <button class="btn" data-a="ir" data-ruta="#/sesion/${enCurso.id}">Continuar entrenamiento</button>
      </div>`;
    }

    html += `<h2 style="margin-top:${enCurso ? '18px' : '2px'}">¿Qué toca hoy?</h2><div class="dias">`;
    Rutina.diasFijos().forEach(d => {
      const ultima = sesiones.filter(s => s.dia === d.numero).pop();
      html += `<button class="dia-btn" data-a="empezar" data-dia="${d.numero}" data-sugerido="${sugerido === d.numero ? 1 : 0}">
        <span class="n">Día ${d.numero} · ${esc(d.diaSemanaTexto)}</span>
        <span class="t" style="color:${d.color}">${esc(d.nombre)}</span>
        <span class="d">${ultima ? 'Último: ' + fechaCorta(ultima.fecha) : 'Sin registros'}</span>
      </button>`;
    });
    // comodín: ancho completo, nunca se sugiere solo
    const com = Rutina.dia(5);
    const ultimoCom = sesiones.filter(s => s.dia === 5).pop();
    html += `<button class="dia-btn ancho" data-a="empezar" data-dia="5">
      <span class="n">Comodín · ${esc(com.diaSemanaTexto)}</span>
      <span class="t" style="color:${com.color}">${esc(com.nombre)}</span>
      <span class="d">Sesión corta de cuerpo entero, para una semana floja o para volver${ultimoCom ? ' · Último: ' + fechaCorta(ultimoCom.fecha) : ''}</span>
    </button>`;
    html += '</div>';

    // avisos de progresión
    const avisos = Progresion.avisos();
    html += '<h2>Avisos de progresión</h2>';
    if (!avisos.length) {
      html += '<p class="vacio">Nada pendiente. Los avisos aparecen cuando completas todas las series en el extremo alto del rango.</p>';
    } else {
      avisos.forEach(x => {
        html += `<div class="aviso ${x.a.estado}" data-a="ir" data-ruta="#/ejercicio/${x.id}">
          <b>${x.a.estado === 'subir' ? '&#9650; ' : '&#9888; '}${esc(x.a.titulo)}</b>${esc(x.a.mensaje)}
        </div>`;
      });
    }

    // resumen semana / mes
    html += '<h2>Esta semana</h2><div class="tarjeta compacta">';
    if (!deEstaSemana.length) {
      html += '<p class="vacio" style="padding:2px 0">Todavía no has entrenado esta semana.</p>';
    } else {
      html += '<ul class="lista">';
      deEstaSemana.forEach(s => {
        const d = Rutina.dia(s.dia);
        html += `<li><button class="item" data-a="ir" data-ruta="#/sesion/${s.id}">
          <span class="barra-dia" style="background:${d.color}"></span>
          <span><b>${esc(d.nombre)}</b><br><span class="suave peque">${fechaLarga(s.fecha)}</span></span>
          <span class="meta">${DB.numSeries(s)} series</span></button></li>`;
      });
      html += '</ul>';
    }
    const comodines = deEstaSemana.filter(s => s.dia === 5).length;
    html += `<div class="sep"></div><p class="peque suave" style="margin:0">
      ${deEstaSemana.length - comodines} de 4 sesiones de la rutina${comodines ? ` · ${comodines} comodín${comodines > 1 ? 'es' : ''}` : ''} · ${delMes.length} en ${MESES[hoy.getMonth()]}</p></div>`;

    render(html, 'Rutina 3+1', fechaLarga(hoyIso()));
  }

  /* ============================================================
     VISTA: SESIÓN
     ============================================================ */
  function vistaSesion(id) {
    const s = DB.sesion(id);
    if (!s) { ir('#/hoy'); return; }
    const d = Rutina.dia(s.dia);

    let html = `<div class="tarjeta compacta">
      <div class="fila">
        <div><b style="color:${d.color}">Día ${d.numero} · ${esc(d.nombre)}</b>
          <div class="suave peque">${fechaLarga(s.fecha)}</div></div>
        <span class="pill">${DB.numSeries(s)} series</span>
      </div>
      <p class="peque suave" style="margin:8px 0 0">Intensidad: <b>${Rutina.intensidad()}</b> — ${esc(INTENSIDAD_EXPLICACION)}</p>
      <div class="sep" style="margin:12px 0"></div>
      <label class="peque suave" for="fecha-sesion">Fecha de la sesión</label>
      <input type="date" id="fecha-sesion" value="${s.fecha}" data-in="fecha">
    </div>`;

    if (d.comodin) {
      html += `<div class="aviso nuevo">
        <b>Día comodín</b>Cuerpo entero en 7 ejercicios y 2 series cada uno. Los ejercicios
        son los mismos de los otros días, así que el peso y el historial se guardan en el mismo sitio.
        Al ser una sesión corta no dispara subidas de peso: para eso hacen falta las series completas del día que toque.
      </div>`;
    }

    d.ejercicios.forEach(ejId => { html += tarjetaEjercicio(s, ejId); });

    html += `<div class="sep"></div>
      <button class="btn ${s.finalizada ? 'sec' : ''}" data-a="finalizar">
        ${s.finalizada ? 'Sesión finalizada &#10003; (tocar para reabrir)' : 'Finalizar sesión'}</button>
      <div style="height:10px"></div>
      <button class="btn sec linea peligro" data-a="borrar-sesion">Borrar esta sesión</button>`;

    render(html, 'Entrenamiento', `Día ${d.numero} · ${d.nombre}`, true);
  }

  /* Forma en que se hace hoy: la de las series ya apuntadas en esta sesión,
     la elegida con el interruptor, o la de la última vez */
  function modoSesion(s, ejId) {
    const series = s.ejercicios[ejId] || [];
    if (series.length) return series[0].modo || Rutina.ladoPorDefecto(ejId);
    return modoElegido[ejId] || DB.ultimoModo(ejId);
  }

  function interruptorModo(ejId, modo, accion) {
    return `<div class="segmento" role="group" aria-label="Forma de hacer el ejercicio">
      <button class="${modo === 'bi' ? 'activo' : ''}" data-a="${accion}" data-ej="${ejId}" data-modo="bi">Bilateral</button>
      <button class="${modo === 'uni' ? 'activo' : ''}" data-a="${accion}" data-ej="${ejId}" data-modo="uni">Unilateral</button>
    </div>`;
  }

  function tarjetaEjercicio(s, ejId) {
    const e = Rutina.ejercicio(ejId);
    const series = s.ejercicios[ejId] || [];
    const modo = modoSesion(s, ejId);
    const pc = Rutina.pesoCorporal(ejId);
    const an = Progresion.analizar(ejId, modo);
    const abierto = abiertos.has(ejId);
    const unidad = Rutina.unidad(ejId) === 'seg' ? 'segundos' : 'reps';
    const objetivo = Rutina.seriesObjetivo(ejId, s.dia);   // el comodín pide menos series

    // valores de la fila nueva
    if (!nueva[ejId]) {
      const ult = series[series.length - 1];
      nueva[ejId] = {
        peso: ult ? ult.peso : (an.pesoSugerido != null ? an.pesoSugerido : 0),
        reps: ult ? ult.reps : an.repsSugeridas
      };
    }

    let filas = '';
    series.forEach((x, i) => { filas += filaGuardada(ejId, i, x.peso, x.reps, modo); });
    const etiquetaPeso = pc ? 'lastre (kg)' : (modo === 'uni' ? 'kg por lado' : 'kg');
    filas += `<div class="etiquetas"><span>${etiquetaPeso}</span><span>${unidad}</span></div>`;
    filas += filaNueva(ejId, nueva[ejId].peso, nueva[ejId].reps);

    const completo = series.length >= objetivo;

    return `<div class="ej ${completo ? 'hecho' : ''}" id="ej-${ejId}">
      <div class="ej-cab" data-a="toggle" data-ej="${ejId}">
        <div class="info">
          <div class="nom">${esc(e.nombre)}</div>
          <div class="pres">${Rutina.prescripcion(ejId, s.dia)}${e.porPierna ? ' por pierna' : ''}${series.length ? ' · ' + esc(Progresion.resumenSeries(series, ejId)) : ''}</div>
        </div>
        <div class="marca">${series.length ? series.length : ''}</div>
      </div>
      <div class="ej-cuerpo ${abierto ? '' : 'oculto'}">
        <div class="aviso ${an.estado}" style="margin-top:12px"><b>${esc(an.titulo)}</b>${esc(an.mensaje)}</div>
        ${e.nota ? `<p class="peque suave">${esc(e.nota)}</p>` : ''}
        ${pc ? '' : interruptorModo(ejId, modo, 'modo')}
        <p class="peque suave" style="margin:6px 0 0">${pc
          ? 'Apunta el <b>lastre</b>: 0 es peso corporal, positivo es lastre añadido, negativo es asistencia.'
          : modo === 'uni'
            ? 'Cada lado con su carga (mancuerna en cada mano, muñequera, una pierna): apunta el peso de <b>un lado</b>.'
            : 'Una carga para los dos lados (barra, máquina, polea con barra): apunta el peso <b>total</b>.'}</p>
        ${filas}
        <div class="acciones-serie">
          <button class="btn" data-a="add" data-ej="${ejId}">&#10003; Guardar serie</button>
        </div>
        <p class="sugerencia">Objetivo hoy: ${objetivo} series de ${e.min === e.max ? e.min : e.min + '-' + e.max} ${unidad} a <b>${Rutina.intensidad()}</b> · salto de peso +${num(DB.incremento(ejId))} kg</p>
        <button class="btn sec linea" data-a="ir" data-ruta="#/ejercicio/${ejId}">Ver historial y tendencia</button>
      </div>
    </div>`;
  }

  /* Serie ya guardada: compacta, editable tocando el número. */
  function filaGuardada(ejId, i, peso, reps, modo) {
    const uds = Rutina.pesoCorporal(ejId) ? 'lastre' : (modo === 'uni' ? 'kg/lado' : 'kg');
    return `<div class="serie guardada">
      <span class="idx">${Number(i) + 1}</span>
      <div class="campo"><input inputmode="decimal" data-in="peso" data-ej="${ejId}" data-i="${i}" value="${num(peso)}"></div>
      <span class="uds">${uds} &times;</span>
      <div class="campo"><input inputmode="numeric" data-in="reps" data-ej="${ejId}" data-i="${i}" value="${reps}"></div>
      <button class="quitar" data-a="quitar" data-ej="${ejId}" data-i="${i}" aria-label="Quitar serie">&times;</button>
    </div>`;
  }

  /* Fila de registro rápido: botones grandes, se rellena sola con lo último. */
  function filaNueva(ejId, peso, reps) {
    const paso = DB.incremento(ejId);
    return `<div class="serie nueva">
      <div class="campo">
        <button class="paso" data-a="paso" data-ej="${ejId}" data-i="n" data-c="peso" data-d="-${paso}">&minus;</button>
        <input inputmode="decimal" data-in="peso" data-ej="${ejId}" data-i="n" value="${num(peso)}">
        <button class="paso" data-a="paso" data-ej="${ejId}" data-i="n" data-c="peso" data-d="${paso}">+</button>
      </div>
      <div class="campo">
        <button class="paso" data-a="paso" data-ej="${ejId}" data-i="n" data-c="reps" data-d="-1">&minus;</button>
        <input inputmode="numeric" data-in="reps" data-ej="${ejId}" data-i="n" value="${reps}">
        <button class="paso" data-a="paso" data-ej="${ejId}" data-i="n" data-c="reps" data-d="1">+</button>
      </div>
    </div>`;
  }

  function refrescarEjercicio(s, ejId) {
    const el = document.getElementById('ej-' + ejId);
    if (!el) { vistaSesion(s.id); return; }
    el.outerHTML = tarjetaEjercicio(s, ejId);
  }

  /* ============================================================
     VISTA: CALENDARIO
     ============================================================ */
  let calMes = null;    // Date del primer día del mes mostrado
  let volSemana = null; // Date del lunes de la semana del panel de volumen

  function vistaCalendario() {
    if (!calMes) { const h = new Date(); calMes = new Date(h.getFullYear(), h.getMonth(), 1); }
    const anio = calMes.getFullYear(), mes = calMes.getMonth();
    const sesiones = DB.sesionesRegistradas();
    const porFecha = {};
    sesiones.forEach(s => { (porFecha[s.fecha] = porFecha[s.fecha] || []).push(s); });

    const primero = new Date(anio, mes, 1);
    const inicio = lunesDe(primero);
    let html = `<div class="cal-cab">
        <button data-a="mes" data-d="-1">&lsaquo;</button>
        <b>${MESES[mes]} ${anio}</b>
        <button data-a="mes" data-d="1">&rsaquo;</button>
      </div><div class="cal">`;
    DOW.forEach(x => { html += `<div class="dow">${x}</div>`; });

    for (let i = 0; i < 42; i++) {
      const f = new Date(inicio); f.setDate(inicio.getDate() + i);
      if (i >= 35 && f.getMonth() !== mes) break;
      const iso = DB.iso(f);
      const ses = porFecha[iso] || [];
      const clases = ['celda'];
      if (f.getMonth() !== mes) clases.push('fuera');
      if (iso === hoyIso()) clases.push('hoy');
      if (ses.length) clases.push('con');
      const puntos = ses.map(s => `<i class="punto" style="background:${Rutina.dia(s.dia).color}"></i>`).join('');
      html += `<div class="${clases.join(' ')}" ${ses.length ? `data-a="ir" data-ruta="#/sesion/${ses[0].id}"` : ''}>
        <span>${f.getDate()}</span><span class="puntos">${puntos}</span></div>`;
    }
    html += '</div><div class="leyenda">';
    Rutina.dias().forEach(d => { html += `<span><i style="background:${d.color}"></i>${d.numero}. ${esc(d.nombre)}</span>`; });
    html += '</div>';

    const delMes = sesiones.filter(s => { const f = DB.desdeIso(s.fecha); return f.getMonth() === mes && f.getFullYear() === anio; });
    html += `<h2>Sesiones de ${MESES[mes]} (${delMes.length})</h2>`;
    if (!delMes.length) html += '<p class="vacio">Ninguna sesión registrada este mes.</p>';
    else {
      html += '<div class="tarjeta compacta"><ul class="lista">';
      delMes.slice().reverse().forEach(s => {
        const d = Rutina.dia(s.dia);
        html += `<li><button class="item" data-a="ir" data-ruta="#/sesion/${s.id}">
          <span class="barra-dia" style="background:${d.color}"></span>
          <span><b>${esc(d.nombre)}</b><br><span class="suave peque">${fechaLarga(s.fecha)}</span></span>
          <span class="meta">${DB.numSeries(s)} series${s.finalizada ? '' : '<br>en curso'}</span></button></li>`;
      });
      html += '</ul></div>';
    }

    render(html, 'Calendario', `${sesiones.length} sesiones registradas`);
  }

  /* ============================================================
     VISTA: LISTA DE EJERCICIOS
     ============================================================ */
  /* Series semanales por grupo muscular, con el rango 12-20 marcado */
  function tarjetaVolumen() {
    if (!volSemana) volSemana = Volumen.lunesDe(new Date());
    const v = Volumen.semana(volSemana);
    const estaSemana = DB.iso(Volumen.lunesDe(new Date())) === v.desde;
    const escala = Math.max(24, ...v.filas.map(f => f.series));
    const pct = n => (n / escala) * 100;

    let filas = '';
    v.filas.forEach(f => {
      filas += `<div class="vol">
        <span class="vm">${esc(f.nombre)}</span>
        <span class="vb">
          <span class="vbanda" style="left:${pct(Volumen.objetivo.min)}%;width:${pct(Volumen.objetivo.max - Volumen.objetivo.min)}%"></span>
          <span class="vfill ${f.estado}" style="width:${pct(f.series)}%"></span>
        </span>
        <b class="vn ${f.estado}">${f.series}</b>
      </div>`;
    });

    const d1 = DB.desdeIso(v.desde), d2 = DB.desdeIso(v.hasta);
    const rotulo = `${d1.getDate()} ${MESES[d1.getMonth()].slice(0, 3)} – ${d2.getDate()} ${MESES[d2.getMonth()].slice(0, 3)}`;

    return `<div class="tarjeta">
      <div class="fila"><h3>Volumen semanal</h3><span class="pill">series directas</span></div>
      <div class="cal-cab" style="margin:10px 0 6px">
        <button data-a="vol-sem" data-d="-1">&lsaquo;</button>
        <b class="peque">${estaSemana ? 'Esta semana' : rotulo}<br><span class="suave" style="font-weight:400">${estaSemana ? rotulo : ''}</span></b>
        <button data-a="vol-sem" data-d="1" ${estaSemana ? 'disabled style="opacity:.35"' : ''}>&rsaquo;</button>
      </div>
      ${filas}
      <p class="peque suave" style="margin-top:10px">
        La franja clara es el rango de referencia: <b>12-20 series por grupo y semana</b>.
        ${v.total} series en ${v.sesiones} ${v.sesiones === 1 ? 'sesión' : 'sesiones'}.
        ${v.sinClasificar ? v.sinClasificar + ' series de ejercicios archivados no se cuentan aquí.' : ''}
      </p>
      <p class="peque suave" style="margin:4px 0 0">
        Es una aproximación: cada serie cuenta entera para un solo músculo, sin repartir por implicación secundaria.
      </p>
    </div>`;
  }

  function vistaEjercicios() {
    let html = tarjetaVolumen();
    const iconos = { subir: '&#9650;', revisar: '&#9888;', mantener: '=', nuevo: '&middot;', archivado: '&#128451;' };
    // el comodín no sale aquí: repite ejercicios de estos cuatro días
    Rutina.diasFijos().forEach(d => {
      html += `<h2 style="color:${d.color}">Día ${d.numero} · ${esc(d.nombre)}</h2><div class="tarjeta compacta"><ul class="lista">`;
      d.ejercicios.forEach(ejId => {
        const an = Progresion.analizar(ejId);
        const t = Progresion.tendencias(ejId);
        html += `<li><button class="item" data-a="ir" data-ruta="#/ejercicio/${ejId}">
          <span class="barra-dia" style="background:${d.color}"></span>
          <span><b>${esc(Rutina.nombre(ejId))}</b><br>
            <span class="suave peque">${Rutina.prescripcion(ejId)}${t.sesiones ? ' · ' + t.sesiones + (t.sesiones === 1 ? ' sesión' : ' sesiones') : ' · sin datos'}</span></span>
          <span class="meta">${t.sesiones ? esc(Progresion.formatoPeso(t.pesoActual, ejId, t.modo, true)) + (t.modo === 'uni' && !t.pc ? '/lado' : '') + '<br>' : ''}<span style="color:${an.estado === 'subir' ? '#51cf66' : an.estado === 'revisar' ? '#ffd8a8' : '#9aa3b2'}">${iconos[an.estado]}</span></span>
        </button></li>`;
      });
      html += '</ul></div>';
    });
    // ejercicios con historial que ya no están en la rutina
    const archivados = DB.ejerciciosArchivados();
    if (archivados.length) {
      html += `<h2 class="suave">Archivados</h2>
        <p class="peque suave" style="margin-top:-4px">Ya no están en la rutina, pero su historial se conserva.</p>
        <div class="tarjeta compacta"><ul class="lista">`;
      archivados.forEach(ejId => {
        const t = Progresion.tendencias(ejId);
        html += `<li><button class="item" data-a="ir" data-ruta="#/ejercicio/${ejId}">
          <span class="barra-dia" style="background:#495057"></span>
          <span><b>${esc(DB.nombreEjercicio(ejId))}</b><br>
            <span class="suave peque">${t.sesiones} ${t.sesiones === 1 ? 'sesión' : 'sesiones'} guardadas</span></span>
          <span class="meta">${num(t.pesoActual)} kg</span></button></li>`;
      });
      html += '</ul></div>';
    }

    html += `<p class="peque suave centro" style="margin-top:16px">El día comodín usa siete de
      estos mismos ejercicios, así que su historial se suma aquí.</p>`;
    render(html, 'Ejercicios', 'Volumen, historial y tendencias');
  }

  /* ============================================================
     VISTA: DETALLE DE EJERCICIO
     ============================================================ */
  function vistaEjercicio(ejId) {
    const e = Rutina.ejercicio(ejId);
    // un ejercicio archivado (fuera de la rutina) sigue siendo consultable
    if (!e && !DB.historial(ejId).length) { ir('#/ejercicios'); return; }
    const pc = Rutina.pesoCorporal(ejId);
    const usados = DB.modosUsados(ejId);
    // bilateral y unilateral son progresiones distintas: la ficha enseña una cada vez
    if (!modoFicha[ejId] || usados.indexOf(modoFicha[ejId]) === -1) modoFicha[ejId] = DB.ultimoModo(ejId);
    const modo = modoFicha[ejId];
    const an = Progresion.analizar(ejId, modo);
    const t = Progresion.tendencias(ejId, modo);
    const hist = DB.historial(ejId, modo).slice().reverse();
    const unidad = Rutina.unidad(ejId) === 'seg' ? 's' : '';

    let html = '';
    if (usados.length > 1) {
      html += `${interruptorModo(ejId, modo, 'modo-ficha')}
        <p class="peque suave" style="margin:6px 0 12px">Lo has hecho de las dos formas. Son progresiones separadas:
        aquí ves solo la ${modo === 'uni' ? 'unilateral' : 'bilateral'}.</p>`;
    }
    html += `<div class="aviso ${an.estado}"><b>${esc(an.titulo)}</b>${esc(an.mensaje)}</div>`;

    if (t.sesiones) {
      html += `<div class="tarjeta">
        <div class="fila"><h3>Evolución</h3><span class="pill">${pc ? 'lastre' : (modo === 'uni' ? 'peso por lado' : 'peso de trabajo')}</span></div>
        ${Grafica.linea(t.puntos, { unidad: pc ? 'kg de lastre' : 'kg' })}
        <p class="peque suave" style="margin-top:6px">${pc
          ? 'La línea es el lastre (0 = peso corporal). Las barras, las repeticiones totales de cada sesión.'
          : 'Las barras son el volumen de cada sesión (kg &times; repeticiones).'}</p>
      </div>

      <div class="metricas">
        <div class="metrica"><div class="v">${pc ? esc(Progresion.formatoPeso(t.mejorPeso, ejId, modo, true)) : num(t.mejorPeso)}</div><div class="k">${pc ? 'mejor lastre' : (modo === 'uni' ? 'mejor peso (kg/lado)' : 'mejor peso (kg)')}</div></div>
        <div class="metrica"><div class="v">${pc ? esc(Progresion.formatoPeso(t.mejorSerie.peso, ejId, modo, true)) : num(t.mejorSerie.peso)}&times;${t.mejorSerie.reps}</div><div class="k">mejor serie</div></div>
        <div class="metrica"><div class="v">${t.sesiones}</div><div class="k">sesiones</div></div>
      </div>

      <div class="tarjeta">
        <h3>Tendencia</h3>
        <p class="peque">${esc(t.nota)}</p>
        <ul class="lista peque suave" style="margin-top:8px">
          <li style="padding:8px 0">Sesiones seguidas sin subir peso: <b style="color:var(--texto)">${t.estancadas}</b></li>
          <li style="padding:8px 0">Última subida de peso: <b style="color:var(--texto)">${fechaCorta(t.fechaUltimaSubida)}</b></li>
          ${pc ? '' : `<li style="padding:8px 0">1RM estimado (Epley): <b style="color:var(--texto)">${num(t.mejorE1RM)} kg${modo === 'uni' ? ' por lado' : ''}</b></li>`}
        </ul>
        <p class="peque suave" style="margin-top:8px">La app no cambia nada por su cuenta: decides tú.</p>
      </div>`;
    } else {
      html += '<p class="vacio">Sin sesiones registradas todavía para este ejercicio.</p>';
    }

    html += `<div class="tarjeta">
      <h3>Ajuste de este ejercicio</h3>
      <p class="peque suave">${e ? 'Grupo: ' + ETIQUETA_GRUPO[e.grupo] + '. Intensidad objetivo: <b>' + Rutina.intensidad() + '</b>. ' : ''}Puedes cambiar el salto si en tu gimnasio no hay discos de ese tamaño.</p>
      <div class="fila" style="margin-top:8px">
        <span class="peque">Salto de peso</span>
        <div class="campo" style="max-width:190px">
          <button class="paso" data-a="inc" data-ej="${ejId}" data-d="-0.5">&minus;</button>
          <input inputmode="decimal" data-in="incremento" data-ej="${ejId}" value="${num(DB.incremento(ejId))}">
          <button class="paso" data-a="inc" data-ej="${ejId}" data-d="0.5">+</button>
        </div>
      </div>
    </div>`;

    if (hist.length) {
      html += '<h2>Historial</h2><div class="tarjeta compacta"><table class="hist"><thead><tr><th>Fecha</th><th>Peso</th><th>Series</th></tr></thead><tbody>';
      hist.forEach(h => {
        const p = Progresion.pesoTrabajo(h.series);
        html += `<tr data-a="ir" data-ruta="#/sesion/${h.sesionId}">
          <td>${fechaCorta(h.fecha)}</td>
          <td><b>${esc(Progresion.formatoPeso(p, ejId, modo))}</b></td>
          <td class="series">${h.series.map(x => `${esc(Progresion.formatoPeso(x.peso, ejId, modo, true))}&times;${x.reps}${unidad}`).join(' · ')}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    const dias = Rutina.diasDe(ejId);
    render(html, DB.nombreEjercicio(ejId),
      e ? `${Rutina.prescripcion(ejId)} · ${Rutina.intensidad()} · día ${dias.join(' y ')}` : 'Archivado · historial conservado',
      true);
  }

  /* ============================================================
     VISTA: AJUSTES
     ============================================================ */
  function vistaAjustes() {
    const s = DB.sesionesRegistradas();
    const dg = DB.diagnostico();
    const inf = DB.informe();

    let html = '';

    const um = dg.ultimaMigracion;
    if (inf.ok && um) {
      const f = new Date(um.fecha);
      html += `<div class="aviso subir"><b>&#10003; Datos migrados sin pérdidas</b>
        ${inf.migrado ? 'Ahora mismo' : `El ${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()} a las ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`}:
        historial recuperado ${um.origen !== dg.clave ? 'de la clave antigua «' + esc(um.origen) + '»' : 'del esquema ' + um.de}
        y guardado en el esquema ${um.a}, con ${um.sesiones} ${um.sesiones === 1 ? 'sesión' : 'sesiones'} y ${um.series} series.
        La copia anterior sigue guardada.</div>`;
    }

    html += `<div class="tarjeta">
      <h3>Tus datos</h3>
      <p class="peque suave">${s.length} sesiones guardadas en este dispositivo. No se envía nada a ningún servidor.</p>
      <div class="sep"></div>
      <button class="btn sec linea" data-a="exportar">Descargar copia de seguridad (.json)</button>
      <div style="height:8px"></div>
      <button class="btn sec linea" data-a="copiar">Copiar copia al portapapeles</button>
      <p class="peque suave">Hazlo de vez en cuando: si borras los datos de Safari, se pierde el historial.</p>
    </div>

    <div class="tarjeta">
      <h3>Restaurar</h3>
      <p class="peque suave">Pega aquí el contenido de una copia y pulsa restaurar. Sustituye todo lo que haya ahora.</p>
      <textarea id="importar" placeholder='{"version":1,"sesiones":[...]}'></textarea>
      <div style="height:8px"></div>
      <button class="btn sec linea" data-a="importar">Restaurar desde el texto</button>
    </div>

    <div class="tarjeta">
      <h3>Saltos de peso por defecto</h3>
      <ul class="lista peque">
        <li style="padding:10px 0">Brazo y hombro <span class="meta">+2,5 kg</span></li>
        <li style="padding:10px 0">Press y remo <span class="meta">+5 kg</span></li>
        <li style="padding:10px 0">Pierna <span class="meta">+10 kg</span></li>
      </ul>
      <p class="peque suave">Cada ejercicio puede tener su propio salto: se cambia en su ficha.</p>
    </div>

    <div class="tarjeta">
      <h3>Cómo funciona la progresión</h3>
      <p class="peque suave">Todas las series efectivas van a <b>${Rutina.intensidad()}</b>: ${esc(INTENSIDAD_EXPLICACION)}</p>
      <p class="peque suave">Cuando en la última sesión completas <b>todas</b> las series en el extremo alto del rango con el <b>mismo peso</b>, aparece &laquo;Sube peso&raquo; con el nuevo peso. Si no llegas, &laquo;Mantén peso&raquo;. Si llevas 3 sesiones por debajo del rango bajo, te propone valorar bajar peso o revisar la técnica.</p>
    </div>

    <div class="tarjeta">
      <h3>Almacenamiento</h3>
      <ul class="lista peque">
        <li style="padding:9px 0">Clave (fija) <span class="meta">${esc(dg.clave)}</span></li>
        <li style="padding:9px 0">Esquema de datos <span class="meta">v${dg.esquema}</span></li>
        <li style="padding:9px 0">Sesiones / series <span class="meta">${dg.sesiones} / ${dg.series}</span></li>
        <li style="padding:9px 0">Ocupa <span class="meta">${(dg.bytes / 1024).toFixed(1)} KB</span></li>
        <li style="padding:9px 0">Copia previa a migrar <span class="meta">${dg.hayCopiaPrevia ? 'sí' : 'no'}</span></li>
        ${dg.clavesHeredadas.length ? `<li style="padding:9px 0">Claves antiguas conservadas <span class="meta">${esc(dg.clavesHeredadas.join(', '))}</span></li>` : ''}
      </ul>
      <p class="peque suave">La clave no lleva número de versión: cambiar la rutina (ejercicios o series objetivo) nunca toca tu historial. Si cambia la estructura de los datos, la app los migra al abrirse y guarda antes una copia literal.</p>
      ${dg.hayCopiaPrevia ? '<div style="height:8px"></div><button class="btn sec linea" data-a="descargar-copia-previa">Descargar la copia previa a la última migración</button>' : ''}
    </div>

    <div class="tarjeta">
      <h3>Versión de la app</h3>
      <ul class="lista peque">
        <li style="padding:9px 0">Versión <span class="meta"><b>${VERSION_APP}</b></span></li>
        <li style="padding:9px 0">Caché sin conexión <span class="meta" id="sw-cache">comprobando…</span></li>
      </ul>
      <p class="peque suave">Si aquí no ves la versión que esperas, el móvil está usando una copia guardada de la app.
      Este botón borra esa caché y vuelve a bajarla. <b>No toca tus datos.</b></p>
      <div style="height:8px"></div>
      <button class="btn sec linea" data-a="actualizar-app">Forzar actualización de la app</button>
    </div>

    <div class="tarjeta">
      <h3>Zona peligrosa</h3>
      <button class="btn peligro" data-a="borrar-todo">Borrar todo el historial</button>
    </div>
    <p class="peque suave centro">Rutina 3+1 &middot; versión ${VERSION_APP}</p>`;

    render(html, 'Ajustes', 'Copias, saltos de peso y datos');
    pintarEstadoCache();
  }

  /* Qué caché de la app está sirviendo el navegador (para detectar
     una versión vieja atrapada en el service worker) */
  function pintarEstadoCache() {
    const el = document.getElementById('sw-cache');
    if (!el) return;
    if (!('caches' in window)) { el.textContent = 'sin caché (http)'; return; }
    caches.keys().then(ks => {
      const mias = ks.filter(k => k.indexOf('rutina3mas1') === 0);
      el.textContent = mias.length ? mias.join(', ') : 'ninguna';
    }).catch(() => { el.textContent = 'no disponible'; });
  }

  /* Borra service worker y cachés (NO los datos) y recarga.
     Orden importante:
     1. se desregistra el service worker y se borran sus cachés;
     2. se vuelven a pedir los archivos de esta página con cache:'reload', que
        machaca la caché del navegador (GitHub Pages deja guardar 10 min); sin
        esto, al recargar se volvía a leer el app.js viejo;
     3. se borran otra vez las cachés: el service worker saliente sigue
        atendiendo esta página hasta recargar y puede haberlas recreado en el paso 2. */
  function forzarActualizacion() {
    const borrarCaches = () => ('caches' in window)
      ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).catch(() => {})
      : Promise.resolve();
    const desregistrar = () => ('serviceWorker' in navigator)
      ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))).catch(() => {})
      : Promise.resolve();
    const refrescarNavegador = () => {
      const urls = new Set(['index.html', 'sw.js', 'manifest.webmanifest']);
      document.querySelectorAll('script[src]').forEach(s => urls.add(s.getAttribute('src')));
      document.querySelectorAll('link[rel="stylesheet"]').forEach(l => urls.add(l.getAttribute('href')));
      return Promise.all([...urls].map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
    };

    Promise.all([desregistrar(), borrarCaches()])
      .then(refrescarNavegador)
      .then(borrarCaches)
      .catch(() => {})
      .then(() => { location.replace(location.pathname + '?nueva=' + Date.now()); });
  }

  /* ============================================================
     RENDER + ROUTER
     ============================================================ */
  /* Aviso permanente si el almacenamiento está en modo seguro: la app
     no escribe nada para no pisar datos que no ha podido leer bien. */
  function bannerDatos() {
    const inf = DB.informe();
    if (inf.ok) return '';
    return `<div class="aviso revisar">
      <b>&#9888; Modo seguro: no se está guardando nada</b>
      ${esc(inf.mensaje)}
      <div style="height:8px"></div>
      <button class="btn sec linea" data-a="rescatar">Descargar lo que había guardado</button>
    </div>`;
  }

  function render(html, titulo, sub, atras) {
    html = bannerDatos() + html;
    document.getElementById('titulo').innerHTML =
      (atras ? '<button class="paso" data-a="atras" style="width:38px;height:38px;font-size:17px;margin-right:10px">&lsaquo;</button>' : '') +
      `<span><span style="display:block;font-size:20px;font-weight:800">${esc(titulo)}</span>
       <span class="sub">${esc(sub || '')}</span></span>`;
    main.innerHTML = html;
    window.scrollTo(0, 0);
    marcarTab();
  }

  function marcarTab() {
    const r = location.hash || '#/hoy';
    tabs.querySelectorAll('a').forEach(a => {
      a.classList.toggle('activo', r.indexOf(a.dataset.raiz) === 0);
    });
  }

  function router() {
    const partes = (location.hash || '#/hoy').replace(/^#\//, '').split('/');
    switch (partes[0]) {
      case 'sesion': vistaSesion(partes[1]); break;
      case 'calendario': vistaCalendario(); break;
      case 'ejercicios': vistaEjercicios(); break;
      case 'ejercicio': vistaEjercicio(partes[1]); break;
      case 'ajustes': vistaAjustes(); break;
      default: vistaHoy();
    }
  }

  /* ============================================================
     EVENTOS (delegación)
     ============================================================ */
  function sesionActual() {
    const p = (location.hash || '').split('/');
    return p[1] === 'sesion' ? DB.sesion(p[2]) : null;
  }

  function onClick(ev) {
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    const ejId = el.dataset.ej;
    const s = sesionActual();

    if (a === 'ir') { ir(el.dataset.ruta); return; }
    if (a === 'atras') { history.length > 1 ? history.back() : ir('#/hoy'); return; }

    if (a === 'empezar') {
      const ses = DB.abrirSesion(el.dataset.dia, hoyIso());
      abiertos.clear();
      const d = Rutina.dia(ses.dia);
      d.ejercicios.forEach(id => { delete nueva[id]; delete modoElegido[id]; });
      abiertos.add(d.ejercicios[0]);
      ir('#/sesion/' + ses.id);
      return;
    }

    if (a === 'toggle') {
      if (abiertos.has(ejId)) abiertos.delete(ejId); else abiertos.add(ejId);
      el.parentElement.querySelector('.ej-cuerpo').classList.toggle('oculto');
      return;
    }

    if (a === 'paso') {
      const campo = el.dataset.c, i = el.dataset.i, delta = parseFloat(el.dataset.d);
      const input = document.querySelector(`input[data-in="${campo}"][data-ej="${ejId}"][data-i="${i}"]`);
      let v = aNumero(input.value) + delta;
      // solo con peso corporal tiene sentido bajar de 0 (asistencia)
      if (v < 0 && !(campo === 'peso' && Rutina.pesoCorporal(ejId))) v = 0;
      v = Math.round(v * 100) / 100;
      input.value = campo === 'reps' ? Math.round(v) : num(v);
      aplicarValor(s, ejId, i, campo, v);
      return;
    }

    if (a === 'add') {
      const p = document.querySelector(`input[data-in="peso"][data-ej="${ejId}"][data-i="n"]`);
      const r = document.querySelector(`input[data-in="reps"][data-ej="${ejId}"][data-i="n"]`);
      const peso = aNumero(p.value), reps = Math.round(aNumero(r.value));
      if (reps <= 0) { toast('Pon las repeticiones conseguidas'); r.focus(); return; }
      s.ejercicios[ejId] = s.ejercicios[ejId] || [];
      s.ejercicios[ejId].push({ peso, reps, modo: modoSesion(s, ejId) });
      nueva[ejId] = { peso, reps };
      DB.guardar();
      refrescarEjercicio(s, ejId);
      toast('Serie ' + s.ejercicios[ejId].length + ' guardada');
      const card = document.getElementById('ej-' + ejId);
      if (card) card.scrollIntoView({ block: 'nearest' });
      return;
    }

    /* Bilateral / unilateral: cambia la forma de las series de este ejercicio
       en esta sesión y la de las siguientes que se apunten */
    if (a === 'modo') {
      const m = el.dataset.modo;
      modoElegido[ejId] = m;
      const ya = s.ejercicios[ejId] || [];
      ya.forEach(x => { x.modo = m; });
      if (ya.length) DB.guardar();
      delete nueva[ejId];     // vuelve a proponer peso con el historial de esa forma
      refrescarEjercicio(s, ejId);
      toast(m === 'uni' ? 'Unilateral: peso de un lado' : 'Bilateral: peso total');
      return;
    }

    if (a === 'modo-ficha') {
      modoFicha[ejId] = el.dataset.modo;
      vistaEjercicio(ejId);
      return;
    }

    if (a === 'quitar') {
      s.ejercicios[ejId].splice(Number(el.dataset.i), 1);
      if (!s.ejercicios[ejId].length) delete s.ejercicios[ejId];
      DB.guardar();
      refrescarEjercicio(s, ejId);
      return;
    }

    if (a === 'finalizar') {
      s.finalizada = !s.finalizada;
      DB.guardar();
      if (s.finalizada && !DB.tieneSeries(s)) { DB.borrarSesion(s.id); ir('#/hoy'); return; }
      if (s.finalizada) { toast('Sesión guardada'); ir('#/hoy'); } else vistaSesion(s.id);
      return;
    }

    if (a === 'borrar-sesion') {
      if (confirm('¿Borrar esta sesión y todas sus series?')) { DB.borrarSesion(s.id); ir('#/calendario'); }
      return;
    }

    if (a === 'mes') {
      calMes = new Date(calMes.getFullYear(), calMes.getMonth() + Number(el.dataset.d), 1);
      vistaCalendario();
      return;
    }

    if (a === 'inc') {
      const input = document.querySelector(`input[data-in="incremento"][data-ej="${ejId}"]`);
      let v = Math.max(0.5, aNumero(input.value) + parseFloat(el.dataset.d));
      DB.setIncremento(ejId, v);
      input.value = num(v);
      return;
    }

    if (a === 'actualizar-app') {
      if (confirm('Se borra la copia guardada de la app y se vuelve a descargar.\n\nTus entrenos NO se tocan. ¿Seguir?')) {
        toast('Actualizando…');
        forzarActualizacion();
      }
      return;
    }

    if (a === 'exportar') { descargar(`copia-gimnasio-${hoyIso()}.json`, DB.exportar()); return; }

    if (a === 'descargar-copia-previa') {
      const c = DB.copiaPrevia();
      if (!c) { toast('No hay copia previa'); return; }
      descargar(`copia-previa-gimnasio-${hoyIso()}.json`, c);
      return;
    }

    /* Modo seguro: sacar tal cual lo que había guardado, sin interpretarlo */
    if (a === 'rescatar') {
      const inf = DB.informe();
      const bruto = inf.bruto || DB.copiaPrevia() || '';
      if (!bruto) { toast('No hay nada que rescatar'); return; }
      descargar(`rescate-gimnasio-${hoyIso()}.json`, bruto);
      return;
    }

    if (a === 'vol-sem') {
      const d = new Date(volSemana);
      d.setDate(d.getDate() + 7 * Number(el.dataset.d));
      if (d > Volumen.lunesDe(new Date())) return;      // no se va al futuro
      volSemana = d;
      vistaEjercicios();
      return;
    }

    if (a === 'copiar') {
      const txt = DB.exportar();
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Copia en el portapapeles'));
      else { prompt('Copia este texto:', txt); }
      return;
    }

    if (a === 'importar') {
      const txt = document.getElementById('importar').value.trim();
      if (!txt) { toast('Pega antes el contenido'); return; }
      try {
        if (!confirm('Esto sustituye todos los datos actuales. ¿Seguir?')) return;
        DB.importar(txt);
        toast('Datos restaurados');
        vistaAjustes();
      } catch (err) { alert('No se ha podido restaurar: ' + err.message); }
      return;
    }

    if (a === 'borrar-todo') {
      if (confirm('¿Borrar TODO el historial? No se puede deshacer.') && confirm('Última confirmación: se borra todo.')) {
        DB.borrarTodo(); toast('Historial borrado'); vistaAjustes();
      }
      return;
    }
  }

  function aplicarValor(s, ejId, i, campo, valor) {
    if (i === 'n') { nueva[ejId][campo] = valor; return; }
    if (!s || !s.ejercicios[ejId]) return;
    s.ejercicios[ejId][Number(i)][campo] = campo === 'reps' ? Math.round(valor) : valor;
    DB.guardar();
    // refresca el resumen de la cabecera sin cerrar la tarjeta
    const cab = document.querySelector(`#ej-${ejId} .pres`);
    if (cab) {
      const e = Rutina.ejercicio(ejId);
      cab.innerHTML = `${Rutina.prescripcion(ejId)}${e.porPierna ? ' por pierna' : ''} · ${esc(Progresion.resumenSeries(s.ejercicios[ejId], ejId))}`;
    }
  }

  function onInput(ev) {
    const el = ev.target;
    if (!el.dataset || !el.dataset.in) return;
    const s = sesionActual();

    if (el.dataset.in === 'fecha') {
      if (el.value) { s.fecha = el.value; DB.guardar(); toast('Fecha actualizada'); }
      return;
    }
    if (el.dataset.in === 'incremento') {
      DB.setIncremento(el.dataset.ej, Math.max(0.5, aNumero(el.value)));
      return;
    }
    aplicarValor(s, el.dataset.ej, el.dataset.i, el.dataset.in, aNumero(el.value));
  }

  return {
    init() {
      main = document.getElementById('contenido');
      tabs = document.querySelector('nav.tabs');
      document.addEventListener('click', onClick);
      document.addEventListener('change', onInput);
      window.addEventListener('hashchange', router);
      router();
    }
  };
})();

const VERSION_APP = '1.2.0';
document.addEventListener('DOMContentLoaded', App.init);
