/* ============================================================
   PROGRESIÓN Y TENDENCIAS
   Regla exacta pedida:
   - Si en la ÚLTIMA sesión del ejercicio completaste TODAS las series
     en el extremo alto del rango (p. ej. 4x8 en un 4x6-8) con el MISMO
     peso  ->  "Sube peso" + peso sugerido (peso + incremento del grupo).
   - Si no llegas al rango alto -> "Mantén peso".
   - Si llevas 3 sesiones seguidas por debajo del rango bajo ->
     "Valora bajar peso o revisar técnica".
   Las tendencias NO tocan nada: solo informan para que decidas tú.
   ============================================================ */

const Progresion = {

  /* Peso de trabajo de una sesión: el peso más repetido; a igualdad, el mayor */
  pesoTrabajo(series) {
    if (!series || !series.length) return 0;
    const cuenta = new Map();
    series.forEach(s => cuenta.set(s.peso, (cuenta.get(s.peso) || 0) + 1));
    let mejor = null;
    cuenta.forEach((n, peso) => {
      if (!mejor || n > mejor.n || (n === mejor.n && peso > mejor.peso)) mejor = { peso, n };
    });
    return mejor.peso;
  },

  mismoPesoEnTodas(series) {
    return series.length > 0 && series.every(s => s.peso === series[0].peso);
  },

  /* ¿Todas las series llegaron al extremo alto del rango? */
  todasEnRangoAlto(ejId, series) {
    const e = Rutina.ejercicio(ejId);
    if (!e) return false;
    return series.length >= e.series && series.every(s => s.reps >= e.max);
  },

  /* ¿La sesión se quedó por debajo del rango bajo? (alguna serie por debajo del mínimo) */
  porDebajoDelRango(ejId, series) {
    const e = Rutina.ejercicio(ejId);
    if (!e) return false;
    return series.some(s => s.reps < e.min);
  },

  redondear(n) { return Math.round(n * 100) / 100; },

  /* Diagnóstico principal de un ejercicio */
  analizar(ejId) {
    const e = Rutina.ejercicio(ejId);
    const hist = DB.historial(ejId);
    const inc = DB.incremento(ejId);

    /* Ejercicio que ya no está en la rutina: su historial se conserva
       y se puede consultar, pero no hay rango objetivo con el que juzgar. */
    if (!e) {
      const ultima = hist.length ? hist[hist.length - 1] : null;
      return {
        estado: 'archivado',
        titulo: 'Ejercicio archivado',
        mensaje: ultima
          ? `Ya no está en la rutina. Última vez el ${ultima.fecha}: ${this.resumenSeries(ultima.series, ejId)}.`
          : 'Ya no está en la rutina.',
        pesoSugerido: ultima ? this.pesoTrabajo(ultima.series) : null,
        repsSugeridas: null, incremento: inc
      };
    }

    if (!hist.length) {
      return {
        estado: 'nuevo',
        titulo: 'Primera vez',
        mensaje: `Sin historial todavía. Elige un peso con el que llegues a ${e.min} repeticiones limpias.`,
        pesoSugerido: null, repsSugeridas: e.min, incremento: inc
      };
    }

    const ultima = hist[hist.length - 1];
    const series = ultima.series;
    const peso = this.pesoTrabajo(series);

    // 1) ¿Toca subir?
    if (this.mismoPesoEnTodas(series) && this.todasEnRangoAlto(ejId, series)) {
      const nuevo = this.redondear(series[0].peso + inc);
      return {
        estado: 'subir',
        titulo: `Sube peso en ${e.nombre}`,
        mensaje: `Completaste ${series.length} series de ${e.max}${Rutina.unidad(ejId) === "seg" ? " s" : " reps"} con ${this.num(series[0].peso)} kg. Sube a ${this.num(nuevo)} kg (+${this.num(inc)}).`,
        pesoSugerido: nuevo, repsSugeridas: e.min, incremento: inc, pesoAnterior: series[0].peso
      };
    }

    // 2) ¿Tres sesiones seguidas por debajo del rango bajo?
    const ultimas3 = hist.slice(-3);
    if (ultimas3.length === 3 && ultimas3.every(h => this.porDebajoDelRango(ejId, h.series))) {
      return {
        estado: 'revisar',
        titulo: 'Valora bajar peso o revisar técnica',
        mensaje: `Llevas 3 sesiones sin alcanzar las ${e.min} repeticiones. Bajar a ${this.num(this.redondear(Math.max(0, peso - inc)))} kg y consolidar suele ir mejor que insistir.`,
        pesoSugerido: peso, repsSugeridas: e.min, incremento: inc
      };
    }

    // 3) Mantener
    const faltan = series.filter(s => s.reps < e.max).length;
    const corta = series.length < e.series;   // p. ej. una sesión del día comodín
    return {
      estado: 'mantener',
      titulo: 'Mantén peso',
      mensaje: corta
        ? `Última: ${this.resumenSeries(series, ejId)}. Fue una sesión corta (${series.length} de ${e.series} series), así que no cuenta para subir peso. Repite ${this.num(peso)} kg.`
        : `Última: ${this.resumenSeries(series, ejId)}. Repite ${this.num(peso)} kg y busca ${e.max} en ${faltan === 1 ? 'la serie que falta' : 'todas las series'}.`,
      pesoSugerido: peso, repsSugeridas: Math.min(e.max, (Math.max(...series.map(s => s.reps)) || e.min)), incremento: inc
    };
  },

  /* Panel de tendencias (solo informativo) */
  tendencias(ejId) {
    const hist = DB.historial(ejId);
    if (!hist.length) return { sesiones: 0 };

    let mejorPeso = 0, mejorSerie = null, mejorE1RM = 0;
    hist.forEach(h => h.series.forEach(s => {
      if (s.peso > mejorPeso) mejorPeso = s.peso;
      const e1rm = s.peso > 0 ? s.peso * (1 + s.reps / 30) : s.reps;   // Epley
      if (e1rm > mejorE1RM) { mejorE1RM = e1rm; mejorSerie = s; }
    }));

    // Sesiones seguidas sin subir el peso de trabajo
    const pesos = hist.map(h => this.pesoTrabajo(h.series));
    const ultimo = pesos[pesos.length - 1];
    let estancadas = 0;
    for (let i = pesos.length - 1; i >= 0; i--) {
      if (pesos[i] >= ultimo) estancadas++; else break;
    }

    // Última sesión en la que el peso de trabajo fue mayor que en todas las anteriores
    let idxUltimaSubida = 0;
    for (let i = 1; i < pesos.length; i++) if (pesos[i] > pesos[i - 1]) idxUltimaSubida = i;
    const fechaUltimaSubida = hist[idxUltimaSubida].fecha;
    const dias = Math.floor((Date.now() - DB.desdeIso(fechaUltimaSubida).getTime()) / 86400000);
    const semanas = Math.floor(dias / 7);

    // Volumen por sesión (kg x reps), para la gráfica
    const puntos = hist.map(h => ({
      fecha: h.fecha,
      peso: this.pesoTrabajo(h.series),
      reps: h.series.reduce((n, s) => n + s.reps, 0),
      volumen: h.series.reduce((n, s) => n + (s.peso || 1) * s.reps, 0),
      series: h.series.length
    }));

    let nota;
    if (hist.length === 1) nota = 'Solo una sesión registrada: aún no hay tendencia.';
    else if (estancadas >= 3 && semanas >= 2) nota = `Llevas ${semanas} ${semanas === 1 ? 'semana' : 'semanas'} sin progresar aquí (${estancadas} sesiones al mismo peso o menos).`;
    else if (estancadas >= 3) nota = `${estancadas} sesiones seguidas sin subir el peso de trabajo.`;
    else if (pesos[pesos.length - 1] > pesos[Math.max(0, pesos.length - 2)]) nota = 'Vas subiendo: última sesión con más peso que la anterior.';
    else nota = 'Progresión normal, sin estancamiento largo.';

    return {
      sesiones: hist.length, mejorPeso, mejorSerie, mejorE1RM: Math.round(mejorE1RM * 10) / 10,
      estancadas, semanasSinProgresar: semanas, fechaUltimaSubida, nota, puntos,
      pesoActual: ultimo
    };
  },

  /* Avisos de "sube peso" pendientes en toda la rutina */
  avisos() {
    return Rutina.ids()
      .map(id => ({ id, a: this.analizar(id) }))
      .filter(x => x.a.estado === 'subir' || x.a.estado === 'revisar');
  },

  num(n) {
    const v = Math.round(Number(n) * 100) / 100;
    return String(v).replace('.', ',');
  },

  resumenSeries(series, ejId) {
    const u = Rutina.unidad(ejId) === 'seg' ? 's' : '';
    return series.map(s => `${this.num(s.peso)}kg x${s.reps}${u}`).join(' · ');
  }
};
