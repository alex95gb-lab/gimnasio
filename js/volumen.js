/* ============================================================
   VOLUMEN SEMANAL POR GRUPO MUSCULAR (aproximado)
   Cuenta las SERIES REGISTRADAS de cada semana y las suma al
   músculo principal de cada ejercicio (Rutina: campo 'musculo').
   Es una aproximación a propósito: cada serie cuenta entera para
   un solo grupo, no se reparte por implicación secundaria.
   Referencia: 12-20 series semanales por grupo.
   ============================================================ */

const MUSCULOS = [
  { id: 'pecho',      nombre: 'Pecho',              color: '#ff8a3d' },
  { id: 'espalda',    nombre: 'Espalda',            color: '#4dabf7' },
  { id: 'hombro',     nombre: 'Hombro',             color: '#ffd43b' },
  { id: 'biceps',     nombre: 'Bíceps',             color: '#da77f2' },
  { id: 'triceps',    nombre: 'Tríceps',            color: '#cc5de8' },
  { id: 'cuadriceps', nombre: 'Cuádriceps',         color: '#51cf66' },
  { id: 'isquios',    nombre: 'Isquios y glúteo',   color: '#20c997' },
  { id: 'gluteo',     nombre: 'Glúteo y abductores',color: '#38d9a9' },
  { id: 'gemelo',     nombre: 'Gemelo',             color: '#94d82d' },
  { id: 'antebrazo',  nombre: 'Antebrazo',          color: '#adb5bd' }
];

const OBJETIVO_SERIES = { min: 12, max: 20 };

const Volumen = {
  musculos: MUSCULOS,
  objetivo: OBJETIVO_SERIES,

  /* Lunes de la semana en la que cae una fecha */
  lunesDe(fecha) {
    const x = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  },

  estado(series) {
    if (series === 0) return 'cero';
    if (series < OBJETIVO_SERIES.min) return 'corto';
    if (series > OBJETIVO_SERIES.max) return 'alto';
    return 'ok';
  },

  /* Resumen de la semana que empieza en 'lunes' (Date) */
  semana(lunes) {
    const domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6);
    const desde = DB.iso(lunes), hasta = DB.iso(domingo);

    const sesiones = DB.sesionesRegistradas().filter(s => s.fecha >= desde && s.fecha <= hasta);

    const cuenta = {};
    MUSCULOS.forEach(m => { cuenta[m.id] = 0; });
    let sinClasificar = 0, total = 0;

    sesiones.forEach(s => {
      Object.keys(s.ejercicios || {}).forEach(ejId => {
        const n = s.ejercicios[ejId].length;
        if (!n) return;
        const mus = Rutina.musculo(ejId);          // null si ya no está en la rutina
        if (mus && cuenta[mus] != null) { cuenta[mus] += n; total += n; }
        else sinClasificar += n;
      });
    });

    const filas = MUSCULOS.map(m => ({
      id: m.id, nombre: m.nombre, color: m.color,
      series: cuenta[m.id], estado: this.estado(cuenta[m.id])
    }));

    return {
      desde, hasta, lunes: new Date(lunes),
      sesiones: sesiones.length, total, sinClasificar, filas,
      cortos: filas.filter(f => f.estado === 'corto' || f.estado === 'cero').length
    };
  },

  /* Lo que la rutina completa daría en una semana perfecta (los 4 días),
     para poder comparar lo registrado con lo previsto. */
  previsto() {
    const cuenta = {};
    MUSCULOS.forEach(m => { cuenta[m.id] = 0; });
    Rutina.diasFijos().forEach(d => {
      d.ejercicios.forEach(ejId => {
        const mus = Rutina.musculo(ejId);
        if (mus && cuenta[mus] != null) cuenta[mus] += Rutina.seriesObjetivo(ejId, d.numero);
      });
    });
    return cuenta;
  }
};
