/* ============================================================
   RUTINA "3+1" — catálogo de ejercicios y reparto semanal.
   Un ejercicio que se repite en varios días comparte id, para
   que el historial y la progresión se acumulen en un solo sitio.
   grupo -> salto de peso por defecto (ver INCREMENTOS).
   ============================================================ */

const INCREMENTOS = {
  brazo_hombro: 2.5,   // brazo y hombro
  press_remo: 5,       // press y remo
  pierna: 10           // pierna
};

const ETIQUETA_GRUPO = {
  brazo_hombro: 'Brazo / hombro (+2,5 kg)',
  press_remo: 'Press / remo (+5 kg)',
  pierna: 'Pierna (+10 kg)'
};

/* Intensidad objetivo de todas las series efectivas.
   Se enseña en la sesión y en la ficha de cada ejercicio. */
const INTENSIDAD = 'RIR 1-2';
const INTENSIDAD_EXPLICACION = 'Deja 1-2 repeticiones en recámara en todas las series efectivas.';

/* series: nº de series objetivo | min-max: rango de repeticiones objetivo
   unidad: 'reps' o 'seg' | porPierna: el registro es por cada pierna
   musculo: grupo principal, solo para el contador de volumen semanal */
const EJERCICIOS = {
  // --- Día 1: Empuje ---
  press_inclinado_mancuernas: { nombre: 'Press inclinado con mancuernas', grupo: 'press_remo', musculo: 'pecho', series: 4, min: 6, max: 8, mancuernas: 'si' },
  fondos_paralelas:           { nombre: 'Fondos en paralelas', grupo: 'press_remo', musculo: 'pecho', series: 3, min: 8, max: 10, nota: 'Peso = lastre. Si vas a peso corporal, deja 0.' },
  press_militar_mancuernas:   { nombre: 'Press militar sentado con mancuernas', grupo: 'press_remo', musculo: 'hombro', series: 3, min: 8, max: 10, mancuernas: 'si' },
  elevaciones_laterales:      { nombre: 'Elevaciones laterales', grupo: 'brazo_hombro', musculo: 'hombro', series: 4, min: 12, max: 15, mancuernas: 'si' },
  extension_triceps_polea:    { nombre: 'Extensión de tríceps en polea alta', grupo: 'brazo_hombro', musculo: 'triceps', series: 2, min: 10, max: 12 },
  abduccion_cadera:           { nombre: 'Abducción de cadera', grupo: 'pierna', musculo: 'gluteo', series: 2, min: 15, max: 15 },

  // --- Día 2: Tirón ---
  dominadas:                  { nombre: 'Dominadas', grupo: 'press_remo', musculo: 'espalda', series: 4, min: 6, max: 8, nota: 'Peso = lastre. Si vas a peso corporal, deja 0.' },
  remo_barra:                 { nombre: 'Remo con barra', grupo: 'press_remo', musculo: 'espalda', series: 3, min: 8, max: 10 },
  remo_polea_neutro:          { nombre: 'Remo en polea baja, agarre neutro', grupo: 'press_remo', musculo: 'espalda', series: 2, min: 10, max: 12 },
  face_pull:                  { nombre: 'Face pull', grupo: 'brazo_hombro', musculo: 'hombro', series: 3, min: 15, max: 15 },
  curl_barra_z:               { nombre: 'Curl de bíceps con barra Z', grupo: 'brazo_hombro', musculo: 'biceps', series: 3, min: 8, max: 10 },
  curl_martillo:              { nombre: 'Curl martillo', grupo: 'brazo_hombro', musculo: 'biceps', series: 3, min: 10, max: 12, mancuernas: 'si' },

  // --- Día 3: Pierna ---
  kettlebell_swing:           { nombre: 'Kettlebell swing', grupo: 'pierna', musculo: 'isquios', series: 3, min: 12, max: 15 },
  peso_muerto_rumano:         { nombre: 'Peso muerto rumano', grupo: 'pierna', musculo: 'isquios', series: 3, min: 8, max: 10 },
  sentadilla_bulgara:         { nombre: 'Sentadilla búlgara', grupo: 'pierna', musculo: 'cuadriceps', series: 3, min: 8, max: 10, porPierna: true, mancuernas: 'opcional' },
  prensa_o_sentadilla:        { nombre: 'Prensa o sentadilla', grupo: 'pierna', musculo: 'cuadriceps', series: 3, min: 10, max: 12 },
  abduccion_sentado_maquina:  { nombre: 'Abducción sentado en máquina', grupo: 'pierna', musculo: 'gluteo', series: 2, min: 15, max: 20 },
  gemelo_de_pie:              { nombre: 'Gemelo de pie', grupo: 'pierna', musculo: 'gemelo', series: 3, min: 12, max: 15 },

  // --- Día 4: Torso mixto ---
  press_inclinado_maquina:    { nombre: 'Press inclinado en máquina o mancuernas', grupo: 'press_remo', musculo: 'pecho', series: 4, min: 8, max: 10, mancuernas: 'opcional' },
  cruces_polea_baja_alta:     { nombre: 'Cruces en polea de baja a alta', grupo: 'brazo_hombro', musculo: 'pecho', series: 3, min: 12, max: 15 },
  jalon_agarre_neutro:        { nombre: 'Jalón con agarre neutro', grupo: 'press_remo', musculo: 'espalda', series: 3, min: 8, max: 10 },
  pajaros_deltoide_posterior: { nombre: 'Pájaros para deltoide posterior', grupo: 'brazo_hombro', musculo: 'hombro', series: 3, min: 15, max: 15, mancuernas: 'opcional' },
  curl_inclinado_banco:       { nombre: 'Curl inclinado en banco', grupo: 'brazo_hombro', musculo: 'biceps', series: 3, min: 10, max: 12, mancuernas: 'si' },
  press_frances:              { nombre: 'Press francés', grupo: 'brazo_hombro', musculo: 'triceps', series: 4, min: 10, max: 12 },
  curl_muneca:                { nombre: 'Antebrazo: curl de muñeca', grupo: 'brazo_hombro', musculo: 'antebrazo', series: 2, min: 15, max: 15 },
  agarre_muerto:              { nombre: 'Antebrazo: agarre muerto', grupo: 'brazo_hombro', musculo: 'antebrazo', series: 2, min: 30, max: 45, unidad: 'seg' }
};

const DIAS = [
  {
    numero: 1, nombre: 'Empuje', color: '#ff8a3d', diaSemana: 1, diaSemanaTexto: 'Lunes',
    ejercicios: ['press_inclinado_mancuernas', 'fondos_paralelas', 'press_militar_mancuernas',
                 'elevaciones_laterales', 'extension_triceps_polea', 'abduccion_cadera']
  },
  {
    numero: 2, nombre: 'Tirón', color: '#4dabf7', diaSemana: 2, diaSemanaTexto: 'Martes',
    ejercicios: ['dominadas', 'remo_barra', 'remo_polea_neutro', 'face_pull', 'curl_barra_z', 'curl_martillo']
  },
  {
    numero: 3, nombre: 'Pierna', color: '#51cf66', diaSemana: 4, diaSemanaTexto: 'Jueves',
    ejercicios: ['kettlebell_swing', 'peso_muerto_rumano', 'sentadilla_bulgara',
                 'prensa_o_sentadilla', 'abduccion_sentado_maquina', 'gemelo_de_pie']
  },
  {
    numero: 4, nombre: 'Torso mixto', color: '#cc5de8', diaSemana: 6, diaSemanaTexto: 'Sábado o domingo',
    ejercicios: ['press_inclinado_maquina', 'cruces_polea_baja_alta', 'jalon_agarre_neutro',
                 'elevaciones_laterales', 'pajaros_deltoide_posterior', 'curl_inclinado_banco',
                 'press_frances', 'curl_muneca', 'agarre_muerto']
  },
  {
    /* Día comodín: cuerpo entero en una sesión corta, para semanas flojas o
       para volver a la rutina. Usa ejercicios de los otros días a propósito,
       para que el historial y la progresión sean los mismos. */
    numero: 5, nombre: 'Full body (comodín)', color: '#20c997', diaSemana: null,
    diaSemanaTexto: 'Cualquier día', comodin: true,
    ejercicios: ['prensa_o_sentadilla', 'press_inclinado_maquina', 'jalon_agarre_neutro',
                 'peso_muerto_rumano', 'press_militar_mancuernas', 'remo_polea_neutro',
                 'elevaciones_laterales'],
    /* menos series de lo normal: la idea es salir del gimnasio, no reventarse */
    seriesPropias: {
      prensa_o_sentadilla: 2, press_inclinado_maquina: 2, jalon_agarre_neutro: 2,
      peso_muerto_rumano: 2, press_militar_mancuernas: 2, remo_polea_neutro: 2,
      elevaciones_laterales: 2
    }
  }
];

const Rutina = {
  dia(numero) { return DIAS.find(d => d.numero === Number(numero)); },
  dias() { return DIAS; },
  /* Los 4 días fijos de la rutina, sin el comodín */
  diasFijos() { return DIAS.filter(d => !d.comodin); },
  esComodin(numero) { const d = this.dia(numero); return !!(d && d.comodin); },
  /* Series objetivo del ejercicio; un día puede pedir menos (comodín) */
  seriesObjetivo(ejId, numeroDia) {
    const d = numeroDia != null ? this.dia(numeroDia) : null;
    if (d && d.seriesPropias && d.seriesPropias[ejId]) return d.seriesPropias[ejId];
    const e = EJERCICIOS[ejId];
    return e ? e.series : 0;
  },
  ejercicio(id) { return EJERCICIOS[id]; },
  ids() { return Object.keys(EJERCICIOS); },
  nombre(id) { return EJERCICIOS[id] ? EJERCICIOS[id].nombre : id; },
  unidad(id) { return (EJERCICIOS[id] && EJERCICIOS[id].unidad) || 'reps'; },
  musculo(id) { return EJERCICIOS[id] ? EJERCICIOS[id].musculo : null; },
  /* Cómo se apunta el peso con mancuernas: 'si' = siempre con mancuernas,
     'opcional' = según lo hagas ese día. Siempre el peso de UNA mancuerna. */
  pesoPorMancuerna(id) { return (EJERCICIOS[id] && EJERCICIOS[id].mancuernas) || null; },
  notaPeso(id) {
    const m = this.pesoPorMancuerna(id);
    if (m === 'si') return 'Apunta el peso de UNA mancuerna (con dos de 18 kg, pon 18).';
    if (m === 'opcional') return 'Si lo haces con mancuernas, apunta el peso de UNA mancuerna (con dos de 18 kg, pon 18).';
    return '';
  },
  intensidad() { return INTENSIDAD; },
  /* En qué días aparece un ejercicio */
  diasDe(id) { return DIAS.filter(d => d.ejercicios.includes(id)).map(d => d.numero); },
  /* Rango objetivo como texto: "4x6-8" (con el día, usa sus series) */
  prescripcion(id, numeroDia) {
    const e = EJERCICIOS[id]; if (!e) return '';
    const u = e.unidad === 'seg' ? 's' : '';
    const rango = e.min === e.max ? `${e.min}${u}` : `${e.min}-${e.max}${u}`;
    return `${this.seriesObjetivo(id, numeroDia)}x${rango}`;
  },
  /* Día de entrenamiento sugerido según el día de la semana (0=domingo) */
  diaSugerido(fecha) {
    const dow = fecha.getDay();
    if (dow === 1) return 1;
    if (dow === 2) return 2;
    if (dow === 4) return 3;
    if (dow === 6 || dow === 0) return 4;
    return null;
  }
};
