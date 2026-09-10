/* ============================================================
   ALMACENAMIENTO LOCAL — reglas de la casa
   ------------------------------------------------------------
   1. La clave NUNCA lleva número de versión: 'gimnasio.datos'.
      Cambiar la rutina (ejercicios, series objetivo) no toca la
      clave, así que el historial no se pierde jamás por eso.
   2. Dentro del JSON hay un número de esquema. Si la estructura
      cambia, se MIGRA con las funciones de MIGRACIONES; nunca se
      borra ni se empieza de cero.
   3. Antes de migrar se guarda una copia literal del JSON viejo
      en otra clave, y la clave antigua original no se borra.
   4. Si algo va mal al leer (JSON roto, esquema del futuro, una
      migración que falla) se entra en MODO SEGURO: la app no
      escribe nada encima, y avisa para poder rescatar la copia.
   5. Las sesiones guardan ids de ejercicio, pesos, repeticiones y
      fecha. Nada de la plantilla. Si mañana quitas un ejercicio de
      la rutina, su historial sigue aquí y se puede leer (por eso
      se guarda también el nombre en 'nombresEjercicios').

   Forma de una sesión:
   { id, dia, fecha:'2026-09-10', creada:ISO, finalizada:bool,
     ejercicios: { [ejId]: [ {peso, reps} ] }, nota:'' }
   ============================================================ */

const DB = (function () {

  const CLAVE = 'gimnasio.datos';               // estable, para siempre
  const CLAVES_HEREDADAS = ['gym3mas1.v1'];     // versiones anteriores de la app
  const CLAVE_COPIA = 'gimnasio.copia-previa';  // copia literal antes de migrar
  const ESQUEMA = 2;                            // esquema que entiende esta versión

  let soloLectura = false;
  let informe = { ok: true, esquema: ESQUEMA, migrado: false, desde: null, origen: CLAVE, mensaje: '' };

  function ahora() { return new Date().toISOString(); }

  function vacio() {
    return { esquema: ESQUEMA, sesiones: [], incrementos: {}, ajustes: {},
             nombresEjercicios: {}, migraciones: [], creado: ahora(), actualizado: ahora() };
  }

  /* ------------------------------------------------------------
     MIGRACIONES: clave = esquema de partida, devuelve el dato ya
     convertido al esquema siguiente. Se aplican en cadena.
     Añadir una nueva = escribir la función y subir ESQUEMA.
     ------------------------------------------------------------ */
  const MIGRACIONES = {
    /* 1 -> 2 : el JSON pasa de la clave 'gym3mas1.v1' a 'gimnasio.datos',
       'version' pasa a llamarse 'esquema' y se empieza a guardar el nombre
       de cada ejercicio para que el historial sobreviva a cambios de rutina.
       Las sesiones no se tocan: mismos pesos, series, repeticiones y fechas. */
    1: function (d) {
      d.nombresEjercicios = d.nombresEjercicios || {};
      d.incrementos = d.incrementos || {};
      d.ajustes = d.ajustes || {};
      d.creado = d.creado || ahora();
      // deja escrito el nombre de cada ejercicio con historial
      if (typeof Rutina !== 'undefined') {
        d.sesiones.forEach(s => Object.keys(s.ejercicios || {}).forEach(id => {
          const e = Rutina.ejercicio(id);
          if (e && !d.nombresEjercicios[id]) d.nombresEjercicios[id] = e.nombre;
        }));
      }
      delete d.version;
      d.esquema = 2;
      return d;
    }
  };

  /* ------------------------------------------------------------ */

  function modoSeguro(mensaje, bruto) {
    soloLectura = true;
    informe = { ok: false, esquema: null, migrado: false, desde: null, origen: null, mensaje: mensaje, bruto: bruto || '' };
    console.error('[datos] MODO SEGURO:', mensaje);
    return vacio();
  }

  function guardarCopiaPrevia(esquemaViejo, bruto) {
    try {
      localStorage.setItem(CLAVE_COPIA, JSON.stringify({
        fecha: ahora(), esquema: esquemaViejo, datos: bruto
      }));
    } catch (e) {
      console.warn('[datos] no se pudo guardar la copia previa:', e.message);
    }
  }

  /* nº de sesiones de un JSON crudo; -1 si no se puede leer */
  function cuantasSesiones(bruto) {
    try {
      const d = JSON.parse(bruto);
      return (d && Array.isArray(d.sesiones)) ? d.sesiones.length : -1;
    } catch (e) { return -1; }
  }

  function leer() {
    let bruto = null, origen = CLAVE;

    try {
      bruto = localStorage.getItem(CLAVE);

      /* Se mira la clave antigua si no hay clave nueva, y también si la nueva
         está vacía: así un arranque en blanco de la app nueva no deja huérfano
         el historial de la versión anterior. */
      const nuevaVacia = bruto !== null && cuantasSesiones(bruto) === 0;
      if (bruto === null || nuevaVacia) {
        for (let i = 0; i < CLAVES_HEREDADAS.length; i++) {
          const r = localStorage.getItem(CLAVES_HEREDADAS[i]);
          if (r !== null && cuantasSesiones(r) > 0) { bruto = r; origen = CLAVES_HEREDADAS[i]; break; }
        }
      }
    } catch (e) {
      return modoSeguro('El navegador no deja acceder al almacenamiento (¿modo privado?): ' + e.message);
    }

    if (bruto === null) return vacio();          // instalación nueva

    let d;
    try { d = JSON.parse(bruto); }
    catch (e) { return modoSeguro('Los datos guardados no son un JSON válido. No se ha tocado nada.', bruto); }

    if (!d || !Array.isArray(d.sesiones)) {
      return modoSeguro('Los datos guardados no tienen el formato esperado. No se ha tocado nada.', bruto);
    }

    let esq = Number(d.esquema != null ? d.esquema : (d.version != null ? d.version : 1));
    if (!isFinite(esq) || esq < 1) esq = 1;

    if (esq > ESQUEMA) {
      return modoSeguro('Estos datos los escribió una versión más nueva de la app (esquema ' +
                        esq + '). Actualiza la app antes de seguir; no se sobrescribe nada.', bruto);
    }

    const hayQueMigrar = esq < ESQUEMA || origen !== CLAVE;
    const desde = esq;
    if (hayQueMigrar) guardarCopiaPrevia(esq, bruto);

    try {
      while (esq < ESQUEMA) {
        const paso = MIGRACIONES[esq];
        if (!paso) throw new Error('falta la migración del esquema ' + esq);
        d = paso(d);
        const nuevo = Number(d.esquema);
        if (!(nuevo > esq)) throw new Error('la migración del esquema ' + esq + ' no avanzó');
        esq = nuevo;
      }
    } catch (e) {
      return modoSeguro('No se han podido migrar los datos (' + e.message +
                        '). Tu copia sigue guardada, no se ha borrado nada.', bruto);
    }

    d.esquema = ESQUEMA;
    d.nombresEjercicios = d.nombresEjercicios || {};
    d.incrementos = d.incrementos || {};
    d.ajustes = d.ajustes || {};
    d.migraciones = Array.isArray(d.migraciones) ? d.migraciones : [];

    /* Queda registrado en los propios datos: así la confirmación se puede
       ver en Ajustes cuando sea, no solo en el arranque en que ocurrió. */
    if (hayQueMigrar) {
      d.migraciones.push({
        fecha: ahora(), de: desde, a: ESQUEMA, origen: origen,
        sesiones: d.sesiones.length,
        series: d.sesiones.reduce((n, s) => n + Object.keys(s.ejercicios || {})
          .reduce((m, k) => m + (s.ejercicios[k] ? s.ejercicios[k].length : 0), 0), 0)
      });
      d.migraciones = d.migraciones.slice(-5);
    }

    informe = { ok: true, esquema: ESQUEMA, migrado: hayQueMigrar, desde: hayQueMigrar ? desde : null,
                origen: origen, mensaje: '' };

    /* Si venía de una clave antigua, se escribe en la nueva y la vieja
       se deja intacta a propósito: red de seguridad. */
    if (hayQueMigrar) {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(d));
        console.info('[datos] migrado del esquema ' + desde + ' al ' + ESQUEMA +
                     (origen !== CLAVE ? ' (clave antigua "' + origen + '" conservada)' : ''));
      } catch (e) {
        return modoSeguro('No hay espacio para guardar los datos migrados: ' + e.message, bruto);
      }
    }
    return d;
  }

  let estado = leer();

  /* Guarda el nombre visible de cada ejercicio con historial, para que
     el registro se pueda leer aunque mañana desaparezca de la rutina. */
  function sincronizarNombres() {
    if (typeof Rutina === 'undefined') return;
    estado.sesiones.forEach(s => {
      Object.keys(s.ejercicios || {}).forEach(id => {
        if (!estado.nombresEjercicios[id]) {
          const e = Rutina.ejercicio(id);
          if (e) estado.nombresEjercicios[id] = e.nombre;
        }
      });
    });
  }

  function escribir() {
    if (soloLectura) {
      alert('Modo seguro: la app no está guardando cambios para no pisar tus datos.\n\n' +
            'Ve a Ajustes y descarga la copia de seguridad antes de seguir.');
      return false;
    }
    try {
      sincronizarNombres();
      estado.esquema = ESQUEMA;
      estado.actualizado = ahora();
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      alert('No se han podido guardar los datos: ' + e.message +
            '\n\nSi es falta de espacio, descarga una copia en Ajustes y borra sesiones antiguas.');
      return false;
    }
  }

  function idNuevo() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* --- fechas en local, sin líos de zona horaria --- */
  function iso(fecha) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function desdeIso(s) {
    const [a, m, d] = s.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  return {
    iso, desdeIso,

    /* --- estado del almacenamiento (para la pantalla de Ajustes) --- */
    informe() { return informe; },
    soloLectura() { return soloLectura; },
    esquemaActual() { return ESQUEMA; },
    copiaPrevia() {
      try { return localStorage.getItem(CLAVE_COPIA); } catch (e) { return null; }
    },
    diagnostico() {
      let bytes = 0, heredadas = [];
      try {
        bytes = (localStorage.getItem(CLAVE) || '').length;
        CLAVES_HEREDADAS.forEach(k => { if (localStorage.getItem(k) !== null) heredadas.push(k); });
      } catch (e) { /* nada */ }
      return {
        clave: CLAVE, esquema: ESQUEMA, bytes,
        sesiones: estado.sesiones.length,
        series: estado.sesiones.reduce((n, s) => n + this.numSeries(s), 0),
        clavesHeredadas: heredadas,
        hayCopiaPrevia: this.copiaPrevia() !== null,
        actualizado: estado.actualizado,
        migraciones: estado.migraciones || [],
        ultimaMigracion: (estado.migraciones && estado.migraciones.length)
          ? estado.migraciones[estado.migraciones.length - 1] : null
      };
    },

    todo() { return estado; },

    sesiones() {
      return estado.sesiones.slice().sort((a, b) =>
        a.fecha === b.fecha ? (a.creada || '').localeCompare(b.creada || '') : a.fecha.localeCompare(b.fecha));
    },

    sesion(id) { return estado.sesiones.find(s => s.id === id) || null; },

    /* Sesión de ese día y fecha si ya existe; si no, la crea */
    abrirSesion(dia, fechaIso) {
      let s = estado.sesiones.find(x => x.dia === Number(dia) && x.fecha === fechaIso);
      if (!s) {
        s = { id: idNuevo(), dia: Number(dia), fecha: fechaIso, creada: ahora(),
              finalizada: false, ejercicios: {}, nota: '' };
        estado.sesiones.push(s);
        escribir();
      }
      return s;
    },

    guardar() { return escribir(); },

    borrarSesion(id) {
      estado.sesiones = estado.sesiones.filter(s => s.id !== id);
      escribir();
    },

    tieneSeries(s) {
      return Object.values(s.ejercicios || {}).some(arr => Array.isArray(arr) && arr.length > 0);
    },

    numSeries(s) {
      return Object.values(s.ejercicios || {}).reduce((n, arr) => n + (arr ? arr.length : 0), 0);
    },

    sesionesRegistradas() {
      return this.sesiones().filter(s => this.tieneSeries(s));
    },

    /* Historial de un ejercicio: [{sesionId, fecha, dia, series}] de vieja a nueva */
    historial(ejId) {
      return this.sesiones()
        .filter(s => s.ejercicios[ejId] && s.ejercicios[ejId].length > 0)
        .map(s => ({ sesionId: s.id, fecha: s.fecha, dia: s.dia, series: s.ejercicios[ejId] }));
    },

    /* Ids con historial que ya no están en la rutina actual */
    ejerciciosArchivados() {
      const vistos = {};
      estado.sesiones.forEach(s => Object.keys(s.ejercicios || {}).forEach(id => {
        if (s.ejercicios[id] && s.ejercicios[id].length) vistos[id] = true;
      }));
      return Object.keys(vistos).filter(id => !Rutina.ejercicio(id));
    },

    /* Nombre visible: rutina actual > nombre guardado > id */
    nombreEjercicio(id) {
      const e = Rutina.ejercicio(id);
      if (e) return e.nombre;
      return estado.nombresEjercicios[id] || id;
    },

    /* Incremento de peso: el del grupo, salvo que se haya cambiado a mano */
    incremento(ejId) {
      if (estado.incrementos[ejId] != null) return Number(estado.incrementos[ejId]);
      const e = Rutina.ejercicio(ejId);
      return e ? INCREMENTOS[e.grupo] : 2.5;
    },
    incrementoPersonalizado(ejId) { return estado.incrementos[ejId] != null; },
    setIncremento(ejId, valor) {
      const e = Rutina.ejercicio(ejId);
      if (valor == null || valor === '' || (e && Number(valor) === INCREMENTOS[e.grupo])) delete estado.incrementos[ejId];
      else estado.incrementos[ejId] = Number(valor);
      escribir();
    },

    exportar() { return JSON.stringify(estado, null, 2); },

    /* Acepta copias de cualquier esquema anterior: las migra al importar */
    importar(texto) {
      const d = JSON.parse(texto);
      if (!d || !Array.isArray(d.sesiones)) throw new Error('El archivo no tiene el formato esperado.');
      let esq = Number(d.esquema != null ? d.esquema : (d.version != null ? d.version : 1));
      if (esq > ESQUEMA) throw new Error('La copia es de una versión más nueva de la app (esquema ' + esq + ').');
      let dato = d;
      while (esq < ESQUEMA) { dato = MIGRACIONES[esq](dato); esq = Number(dato.esquema); }
      guardarCopiaPrevia(estado.esquema, JSON.stringify(estado));   // por si te arrepientes
      soloLectura = false;
      estado = Object.assign(vacio(), dato, { esquema: ESQUEMA });
      informe = { ok: true, esquema: ESQUEMA, migrado: esq !== ESQUEMA, desde: null, origen: CLAVE, mensaje: '' };
      escribir();
    },

    borrarTodo() {
      guardarCopiaPrevia(estado.esquema, JSON.stringify(estado));   // red de seguridad
      soloLectura = false;
      estado = vacio();
      escribir();
    }
  };
})();
