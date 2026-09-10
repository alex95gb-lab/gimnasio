# Rutina 3+1 — app de gimnasio (PWA)

Registro de entrenamiento para la rutina 3+1 de 4 días. Sin backend, sin cuentas,
sin conexión obligatoria: **todos los datos se guardan en el navegador del móvil**
(`localStorage`).

## Qué hace

- **Hoy**: elige día (1 Empuje · 2 Tirón · 3 Pierna · 4 Torso mixto), marca el día
  sugerido según el día de la semana, avisos de progresión y resumen de la semana/mes.
- **Día comodín (5)**: full body corto, 7 ejercicios × 2 series, para semanas flojas o
  para volver a la rutina. Reutiliza ejercicios de los otros días a propósito, así que
  el peso y el historial son los mismos. No se sugiere solo: lo eliges tú.
- **Sesión**: por cada ejercicio, número libre de series con peso y repeticiones.
  La fila de registro viene rellenada con lo último, así que una serie son 1–3 toques.
  Se guarda al instante; puedes cerrar el navegador a media sesión.
- **Calendario**: mes en cuadrícula con un punto por sesión y color por día de rutina.
- **Ejercicios**: contador de **series semanales por grupo muscular** con el rango de
  referencia 12-20 marcado, y semanas anteriores navegables.
- **Ficha de ejercicio**: gráfica de evolución (peso de trabajo + volumen), mejores
  marcas, panel de tendencias e historial completo.
- **Ajustes**: copia de seguridad (descargar/copiar/restaurar) y borrado.

## Cómo se guardan los datos (y por qué no se pierden al actualizar)

- **Clave fija, sin número de versión**: todo vive en `localStorage` bajo
  `gimnasio.datos`. Cambiar la rutina —ejercicios, series objetivo, días— no toca
  esa clave: la plantilla vive en el código y el historial en el almacenamiento,
  y no se mezclan. Una sesión guarda `{id de ejercicio, peso, reps, fecha}` y nada más.
- **Versión de esquema dentro del JSON** (`esquema: 2`). Si algún día cambia la
  *estructura* de los datos, se sube ese número y se añade una función a
  `MIGRACIONES` en `js/datos.js`, que convierte los datos viejos en nuevos. Se
  aplican en cadena (1→2→3…), nunca se borra ni se reinicia.
- **Copia antes de migrar**: el JSON anterior se guarda literal en
  `gimnasio.copia-previa`, y la clave antigua (`gym3mas1.v1`) **no se borra**.
  Descargables desde Ajustes.
- **Modo seguro**: si el JSON está corrupto, viene de una versión más nueva de la
  app o una migración falla, la app **no escribe nada**, avisa en pantalla y
  ofrece descargar lo que hubiera guardado. Antes que arriesgar, no toca nada.
- **Ejercicios archivados**: al guardar se anota también el nombre de cada
  ejercicio. Si mañana quitas uno de la rutina, su historial sigue consultable en
  Ejercicios → Archivados en vez de desaparecer o romper la app.
- **Por qué localStorage y no IndexedDB**: un año de entrenos ocupa del orden de
  100-200 KB, muy lejos del límite (~5 MB), y localStorage es síncrono: cada serie
  queda escrita en el momento, sin transacciones a medias. IndexedDB añadiría
  complejidad y asincronía sin resolver nada aquí. Si algún día el volumen lo
  pidiera, la migración sería otro paso más de `MIGRACIONES`.

En **Ajustes → Almacenamiento** puedes ver en cualquier momento la clave, el
esquema, cuántas sesiones y series hay, cuánto ocupan y si existe copia previa.

## Probar la migración antes de fiarte

En `pruebas/v1/` hay una copia congelada de la versión 1.0.0 (esquema 1). Con el
servidor local en marcha:

1. Abre <http://localhost:8080/pruebas/v1/> y registra un entreno falso.
2. Abre <http://localhost:8080/> (la versión nueva).
3. El entreno tiene que seguir ahí, y en **Ajustes** debe salir el aviso verde
   «Datos migrados sin pérdidas» con el recuento de sesiones y series.

Comparten navegador y origen, así que comparten almacenamiento: es la misma
situación que actualizar la app en el móvil. La carpeta `pruebas/` no hace falta
subirla a GitHub Pages.

**Usa siempre la misma dirección en los dos pasos.** `localhost:8080` y
`127.0.0.1:8080` son orígenes distintos para el navegador y **no comparten
almacenamiento**: el entreno registrado en uno no aparece en el otro.

### Si algo no cuadra: `diagnostico.html`

<http://localhost:8080/diagnostico.html> dice en una pantalla qué está
pasando de verdad en ese navegador: en qué origen estás, qué claves de datos hay
y cuántas sesiones y series tiene cada una, qué versión de la app te está
sirviendo el navegador frente a la que hay en el servidor, y qué service worker
y cachés están activos. Incluye un botón para desregistrar el service worker y
borrar cachés (no toca los datos).

Funciona también desde el móvil, así que sirve igual cuando la app esté en
GitHub Pages: `https://TUUSUARIO.github.io/gimnasio/diagnostico.html`
(en ese caso sí tendrías que subir la carpeta `pruebas/`).

### La trampa clásica: la app vieja cacheada

Un service worker guarda la app para que funcione sin conexión, y eso hace que
tras actualizar puedas seguir viendo la versión anterior. Contra eso:

- la navegación va **a la red primero** (2,5 s de margen) y solo tira de la copia
  guardada si no hay conexión;
- cuando entra una versión nueva, la página se recarga sola una vez;
- **Ajustes → Versión de la app** enseña la versión cargada y las cachés activas,
  con un botón «Forzar actualización» que borra la caché sin tocar los entrenos;
- en el PC, `Ctrl+Shift+R` fuerza la recarga saltándose el service worker.

## Regla de progresión

Sobre la **última** sesión de cada ejercicio:

| Situación | Aviso |
|---|---|
| Todas las series en el extremo alto del rango y con el mismo peso (p. ej. 4x8 en un 4x6-8) | **Sube peso en [ejercicio]** + peso nuevo |
| No se llega al extremo alto | **Mantén peso** |
| 3 sesiones seguidas por debajo del rango bajo | **Valora bajar peso o revisar técnica** |

Una sesión con menos series de las que pide el ejercicio (lo normal en el día comodín)
nunca dispara «Sube peso»: avisa de que fue una sesión corta y dice qué peso repetir.

**Intensidad objetivo: RIR 1-2** en todas las series efectivas (deja 1-2 repeticiones
en recámara). Se muestra en la cabecera de cada sesión, en la línea de objetivo de
cada ejercicio y en su ficha.

Saltos de peso: **+2,5 kg** brazo y hombro · **+5 kg** press y remo · **+10 kg** pierna.
Cada ejercicio puede tener su propio salto (ficha del ejercicio → «Salto de peso»),
por si en tu gimnasio no hay discos de ese tamaño.

El panel de tendencias **no cambia nada solo**: enseña sesiones estancadas, mejor
marca y «llevas X semanas sin progresar aquí» para que decidas tú.

## Archivos

```
index.html              pantalla única, carga los scripts
diagnostico.html        qué datos, versión y cachés hay en este navegador
manifest.webmanifest    datos de instalación (nombre, iconos, color)
sw.js                   service worker: cachea todo para funcionar sin conexión
css/estilos.css         estilos (tema oscuro, botones grandes)
js/rutina.js            la rutina 3+1: ejercicios, series, rangos, grupos
js/datos.js             guardado en localStorage, esquema y migraciones
js/progresion.js        regla de progresión y tendencias
js/volumen.js           series semanales por grupo muscular
js/graficas.js          gráfica SVG sin librerías
js/app.js               interfaz y navegación
iconos/                 iconos de la pantalla de inicio
pruebas/v1/             copia congelada de la v1.0.0, para probar la migración
abrir-servidor.bat      doble clic: arranca el servidor de pruebas del PC
servidor.ps1            el servidor en si (lo lanza el .bat)
```

## Probar en el PC

Doble clic en **`abrir-servidor.bat`**. Se abre una ventana negra que se queda
abierta y el navegador va solo a <http://localhost:8080/>. Para pararlo, Ctrl+C en
esa ventana (o cerrarla).

No uses «Ejecutar con PowerShell» sobre `servidor.ps1`: la política de ejecución de
Windows (Restricted por defecto) lo bloquea y la ventana se cierra sola sin decir
nada. El `.bat` arranca el mismo script con `-ExecutionPolicy Bypass`, que solo
afecta a esa ejecución y no cambia ninguna configuración del equipo.

## Publicar para el iPhone (GitHub Pages, gratis)

1. Crea una cuenta en <https://github.com> si no la tienes.
2. **New repository** → nombre `gimnasio`, **Public**, crear.
3. En el repo vacío: *uploading an existing file* → abre esta carpeta, selecciona
   **todo su contenido menos la carpeta `pruebas`** y arrástralo al navegador.
   Ojo: el contenido, no la carpeta `gimnasio` entera. → **Commit changes**.
   (`pruebas/v1` es la copia vieja para probar migraciones en el PC; en el móvil
   solo estorba. `servidor.ps1` y `abrir-servidor.bat` no molestan si van.)
4. **Settings → Pages** → Source: *Deploy from a branch*, rama `main`, carpeta `/ (root)`
   → **Save**. En 1–2 minutos aparece la URL:
   `https://TUUSUARIO.github.io/gimnasio/`
5. Abre esa URL **en Safari** del iPhone (no Chrome) → botón Compartir →
   **Añadir a pantalla de inicio**.
6. Ábrela desde el icono y comprueba en **Ajustes → Versión de la app** que pone la
   versión esperada. Luego pon el móvil en modo avión y vuelve a abrirla: debe
   funcionar igual.

A partir de ahí la app abre a pantalla completa y funciona sin conexión.

**Usa siempre el icono, no la pestaña de Safari.** En iOS la app instalada y el
navegador pueden guardar los datos por separado; si mezclas, verás historiales
distintos y pensarás que se han perdido.

## Actualizar la app

Sube los archivos cambiados a GitHub y **sube el número de `CACHE` en `sw.js`**
(`rutina3mas1-v1` → `-v2`). Si no, el móvil seguirá usando la versión guardada.

## Copias de seguridad

Los datos viven solo en ese iPhone. Si borras los datos de Safari o desinstalas la
app, se pierden. En **Ajustes → Descargar copia de seguridad** tienes un `.json`
que puedes guardar donde quieras y restaurar luego pegándolo en «Restaurar».
