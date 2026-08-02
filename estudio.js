// ============================================================
// ESTUDIO DEL CICLO — la segunda pantalla de la vista ancha
// ============================================================
//
// La primera pantalla (analisis.js) responde "¿qué pago y cuánto me
// queda?". Esta responde las otras cuatro preguntas, que son trabajo
// de contador y no de caja:
//
//   §1 CIERRE       ¿cómo terminó, o cómo va a terminar, este ciclo?
//   §2 ESTRUCTURA   ¿en qué se me va?
//   §3 RITMO        ¿cuándo se me va?
//   §4 FRENTES      ¿a quién le estoy pagando?
//   §5 HORIZONTE    ¿cuándo me libero de la deuda?
//   §6 COMPARATIVO  ¿voy mejor o peor que el ciclo pasado?
//
// Existe como archivo aparte (el sexto .js, aprobado el 2 ago 2026)
// porque analisis.js ya tenía 1,900 líneas y son dos pantallas
// distintas: mezclarlas hacía que buscar cualquier cosa costara el
// doble.
//
// Es un script clásico, igual que los demás: sin import ni export. Se
// carga después de analisis.js y antes de arranque.js.
//
// ------------------------------------------------------------
// Dos reglas que ordenan todo lo que vive aquí
// ------------------------------------------------------------
//
// 1. EL ESTUDIO MIDE LO REAL, NO LA SIMULACIÓN. La primera pantalla
//    trabaja siempre sobre la simulación (obtenerDatosVisibles). Esta
//    lee leerDatos(): analiza lo que pasó, no lo que pasaría. Y donde
//    necesita un número que el motor ya calcula, llama a la función
//    que existe — nunca una segunda fórmula para el mismo concepto.
//
// 2. ES DESCRIPTIVO, NO OPINA. Suma, resta, divide, ordena y compara.
//    No detecta fugas ni recomienda recortes: eso está fuera del
//    alcance del proyecto, y además convierte un tablero en un regaño.
//    Las conclusiones las saca quien lo lee.
//
// Depende de motor.js.

// ============================================================
// ESTUDIO — ESTADO DE LA PANTALLA
// ============================================================
//
// Dos cosas que el usuario elige y que mandan sobre todo lo demás: qué
// ciclo está viendo y con qué lente. Viven en variables de este archivo
// y no en localStorage porque no son datos suyos, son cómo está parado
// mirándolos ahora mismo. Sobreviven a renderizarTodo() sin más.

// null significa "el ciclo de hoy". Se guarda así, y no el id del ciclo
// actual, para que al pasar la medianoche del último día del ciclo la
// pantalla salte sola al nuevo en vez de quedarse clavada en el viejo.
let cicloIdEnfocadoDelEstudio = null;

// Consumo es el default porque esta pantalla existe para responder "¿en
// qué se me va?", y esa pregunta es de consumo. La caja ya la responde
// la primera pantalla, con el saldo y el disponible.
let lenteDelEstudio = LENTE_CONSUMO;

// El ciclo que se está estudiando. Si el enfocado ya no existe (por una
// importación de respaldo, o porque se limpiaron los datos) se cae al
// ciclo de hoy en vez de tronar.
function obtenerCicloDelEstudio() {
  const datos = leerDatos();

  if (cicloIdEnfocadoDelEstudio !== null) {
    const enfocado = datos.ciclos.find(function (ciclo) {
      return ciclo.id === cicloIdEnfocadoDelEstudio;
    });
    if (enfocado) {
      return enfocado;
    }
    cicloIdEnfocadoDelEstudio = null;
  }

  return asegurarCicloActual();
}

// Mueve el enfoque un ciclo hacia atrás (-1) o hacia adelante (+1) sobre
// los ciclos que existen de verdad. No crea ciclos nuevos: si no hay
// nada más hacia ese lado, no pasa nada — el botón se dibuja apagado.
function cambiarCicloDelEstudio(delta) {
  const datos = leerDatos();
  const ciclos = obtenerCiclosDelEstudio(datos);
  const cicloActual = obtenerCicloDelEstudio();

  const posicionActual = ciclos.findIndex(function (ciclo) {
    return ciclo.id === cicloActual.id;
  });
  const posicionNueva = posicionActual + delta;

  if (posicionNueva < 0 || posicionNueva >= ciclos.length) {
    return;
  }

  cicloIdEnfocadoDelEstudio = ciclos[posicionNueva].id;
  renderizarTodo();
}

function cambiarLenteDelEstudio(lente) {
  if (lente !== LENTE_CAJA && lente !== LENTE_CONSUMO) {
    return;
  }
  lenteDelEstudio = lente;
  renderizarTodo();
}

// ============================================================
// ESTUDIO — BARRA DE CONTROL
// ============================================================
//
// Dice de qué ciclo y con qué lente son todas las cifras de abajo. Es
// lo primero que se dibuja y lo único que se queda fijo al hacer scroll.

// Cómo se nombra un ciclo en pantalla. El id ("2026-08") es correcto pero
// no se lee: nadie piensa en su dinero por id. Se muestra el mes y el año
// del cierre, que es como el usuario lo llama cuando habla de él.
const NOMBRES_DE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function nombrarCicloDelEstudio(ciclo) {
  const fin = crearFechaLocal(ciclo.fechaFin);
  return NOMBRES_DE_MES[fin.getMonth()] + " " + fin.getFullYear();
}

// El renglón de estado: en qué punto del ciclo estamos. Un ciclo cerrado
// ya no tiene "día X de Y" que dar, tiene un veredicto; uno en curso sí,
// y ese número es el que hace que una proyección se pueda juzgar.
function describirSituacionDelCiclo(ciclo) {
  const situacion = calcularSituacionDelCiclo(ciclo);
  const rango = calcularRangoDeDiasDelCiclo(ciclo);

  if (situacion === "cerrado") {
    return "cerrado · " + rango.diasTotales + " días · " + ciclo.fechaInicio + " a " + ciclo.fechaFin;
  }
  if (situacion === "porVenir") {
    return "por venir · empieza el " + ciclo.fechaInicio;
  }
  return "en curso · día " + rango.diasTranscurridos + " de " + rango.diasTotales +
    " · " + ciclo.fechaInicio + " a " + ciclo.fechaFin;
}

function renderizarBarraDelEstudio() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const ciclos = obtenerCiclosDelEstudio(datos);
  const posicion = ciclos.findIndex(function (c) { return c.id === ciclo.id; });

  document.getElementById("nombreCicloEstudio").textContent = nombrarCicloDelEstudio(ciclo);
  document.getElementById("estadoCicloEstudio").textContent = describirSituacionDelCiclo(ciclo);

  // Los botones se apagan en los extremos en vez de desaparecer: un
  // control que se va y vuelve mueve todo lo que tiene al lado.
  document.getElementById("cicloEstudioAnterior").disabled = posicion <= 0;
  document.getElementById("cicloEstudioSiguiente").disabled = posicion >= ciclos.length - 1;

  document.querySelectorAll("#zonaAnalisis .opcion-lente").forEach(function (boton) {
    const estaActiva = boton.getAttribute("data-lente") === lenteDelEstudio;
    boton.classList.toggle("activa", estaActiva);
    boton.setAttribute("aria-pressed", estaActiva ? "true" : "false");
  });

  document.getElementById("explicacionLente").textContent = EXPLICACION_DE_LA_LENTE[lenteDelEstudio];

  // Arriba se puede estar simulando un pago a meses. El estudio no lo
  // mide — mide lo que pasó — así que se avisa en vez de dejar que los
  // números de las dos pantallas se contradigan en silencio.
  //
  // La pregunta NO es haySimulacionEnCurso(): esa siempre es verdadera,
  // porque la primera pantalla mantiene una simulación viva de base. Lo
  // que importa es si algo se movió, que es la misma cuenta que decide
  // si aparece la barra de simulación de arriba.
  const aviso = document.getElementById("avisoSimulacionEstudio");
  if (calcularCambiosDeLaSimulacion().total > 0) {
    aviso.innerHTML = "<p class=\"aviso-estudio\">Arriba hay una simulación abierta. El estudio mide lo real, no lo simulado.</p>";
  } else {
    aviso.innerHTML = "";
  }
}

// El dibujado completo de la segunda pantalla. arranque.js llama a esta
// y solo a esta: qué secciones existen es asunto de este archivo.
function renderizarEstudioDelCiclo() {
  renderizarBarraDelEstudio();
  renderizarCierreDelCiclo();
  renderizarTrayectoriaSemaforo();
  renderizarProximosPagosAnalisis();
  renderizarMovimientosDelCiclo();
  renderizarEstadoDeDeudaAnalisis();
}

// ============================================================
// ESTUDIO — HERRAMIENTAS DE PRESENTACIÓN
// ============================================================
//
// Cuatro funciones chicas que usan todas las secciones. Viven juntas
// para que un porcentaje se escriba igual en las seis, y no cada una a
// su manera.

// Un porcentaje legible. Sin decimales por default: en un tablero de
// gasto personal, "34.7%" y "35%" llevan a la misma decisión, y el
// decimal solo hace la cifra más difícil de comparar de un vistazo.
function formatearPorcentaje(fraccion, decimales) {
  if (fraccion === null || fraccion === undefined || !isFinite(fraccion)) {
    return "—";
  }
  return (fraccion * 100).toFixed(decimales || 0) + "%";
}

// Una variación con su signo delante. El signo importa más que el
// número: es lo que se lee primero.
function formatearVariacion(monto) {
  const signo = monto > 0 ? "+" : (monto < 0 ? "−" : "");
  return signo + formatearMoneda(Math.abs(monto));
}

// El encabezado de una sección del estudio: número, nombre y la pregunta
// que responde. La pregunta no es adorno — es lo que permite saber si
// una sección sobra, y lo que hace que la pantalla se lea en orden en
// vez de como un tablero de widgets.
function htmlDeEncabezadoDeSeccion(numero, nombre, pregunta) {
  return "<header class=\"encabezado-seccion\">" +
    "<span class=\"numero-seccion\">" + numero + "</span>" +
    "<h2 class=\"titulo-seccion\">" + escaparHTML(nombre) + "</h2>" +
    "<p class=\"pregunta-seccion\">" + escaparHTML(pregunta) + "</p>" +
  "</header>";
}

// El estado vacío honesto: qué falta y cuándo se llena. Se usa en todos
// los bloques comparativos, que hoy no tienen con qué dibujarse. Un
// bloque que no se puede llenar todavía no se esconde: si desapareciera,
// el usuario nunca sabría que existe ni qué tiene que pasar para verlo.
function htmlDeEstadoVacio(queFalta) {
  return "<p class=\"estado-vacio\">" + escaparHTML(queFalta) + "</p>";
}

// ============================================================
// ESTUDIO — §1 CIERRE
// ============================================================
//
// El veredicto del ciclo. Una sola cifra manda, y debajo la regla del
// ingreso: una barra cuyo 100% es lo que entró, partida en los tres
// pedazos del gasto, con la cola vacía como lo que sobra.
//
// Es una barra y no una dona a propósito. Una dona obliga a comparar
// ángulos, que el ojo hace mal; una barra de una sola línea se lee de
// izquierda a derecha como se lee todo lo demás, y además deja ver de un
// golpe si el ciclo se pasó — que es cuando la barra se desborda.

// Los tres pedazos, en el orden en que se apilan y con el nombre con el
// que se muestran. El orden no es cosmético: va de lo menos negociable
// a lo más, que es el orden en que uno puede hacer algo al respecto.
const PEDAZOS_DE_LA_REGLA = [
  { clave: "fijo", nombre: "Fijo", pista: "Compromisos ya pagados de este ciclo" },
  { clave: "fijoPendiente", nombre: "Fijo por pagar", pista: "Compromisos del ciclo que faltan", esProyectado: true },
  { clave: "variablePresupuestado", nombre: "Variable", pista: "Gasto libre que consume una bolsa semanal" },
  { clave: "discrecional", nombre: "Discrecional", pista: "Gasto libre que no consume ninguna bolsa" }
];

// La barra. Cada tramo se dimensiona contra el ingreso, no contra el
// total gastado: así el hueco del final ES el remanente, a escala, y no
// hace falta ninguna leyenda que lo explique.
function htmlDeLaReglaDelIngreso(resumen) {
  if (!resumen.hayIngreso) {
    return htmlDeEstadoVacio("Sin ingreso capturado en este ciclo todavía. La regla del ingreso necesita saber contra qué medir.");
  }

  const comprometidoTotal = resumen.fijo + resumen.fijoPendiente +
    resumen.variablePresupuestado + resumen.discrecional;
  // Cuando el ciclo se pasa, los tramos se escalan contra lo gastado en
  // vez de contra el ingreso, y aparece la marca del 100%. Si se
  // escalaran contra el ingreso, la barra se saldría del contenedor y no
  // se vería cuánto se pasó, que es justo el dato.
  const base = Math.max(comprometidoTotal, resumen.ingreso);

  const tramos = PEDAZOS_DE_LA_REGLA.map(function (pedazo) {
    const monto = resumen[pedazo.clave];
    if (monto <= 0) {
      return "";
    }
    const ancho = (monto / base) * 100;
    const clases = "tramo-regla tramo-" + pedazo.clave + (pedazo.esProyectado ? " es-proyectado" : "");
    return "<div class=\"" + clases + "\" style=\"width: " + ancho.toFixed(3) + "%;\"" +
      " title=\"" + escaparHTML(pedazo.nombre + ": " + formatearMoneda(monto)) + "\"></div>";
  }).join("");

  // La marca del 100% del ingreso solo se dibuja cuando el ciclo se pasó:
  // si no, coincide con el final de la barra y solo estorba.
  const seExcedio = comprometidoTotal > resumen.ingreso;
  const marcaHTML = seExcedio
    ? "<div class=\"marca-ingreso\" style=\"left: " + ((resumen.ingreso / base) * 100).toFixed(3) + "%;\">" +
        "<span>100% del ingreso</span></div>"
    : "";

  const leyenda = PEDAZOS_DE_LA_REGLA.filter(function (pedazo) {
    return resumen[pedazo.clave] > 0;
  }).map(function (pedazo) {
    return "<div class=\"item-leyenda-regla\" title=\"" + escaparHTML(pedazo.pista) + "\">" +
      "<span class=\"marca-leyenda marca-" + pedazo.clave + (pedazo.esProyectado ? " es-proyectado" : "") + "\"></span>" +
      "<span class=\"nombre-leyenda\">" + pedazo.nombre + "</span>" +
      "<span class=\"monto-leyenda\">" + formatearMoneda(resumen[pedazo.clave]) + "</span>" +
      "<span class=\"parte-leyenda\">" + formatearPorcentaje(resumen[pedazo.clave] / resumen.ingreso) + "</span>" +
    "</div>";
  }).join("");

  return "<div class=\"regla-ingreso\">" +
      "<div class=\"barra-regla" + (seExcedio ? " se-excedio" : "") + "\">" + tramos + marcaHTML + "</div>" +
      "<div class=\"leyenda-regla\">" + leyenda + "</div>" +
    "</div>";
}

// Las dos razones que acompañan a la cifra. Son porcentajes y no pesos a
// propósito: $8,000 de remanente no significa lo mismo con un ingreso de
// $20,000 que con uno de $80,000, y la tasa sí es comparable entre
// ciclos aunque el ingreso se mueva.
function htmlDeLasRazones(resumen) {
  if (!resumen.hayIngreso) {
    return "";
  }

  // En un ciclo a medias, "queda sin gastar" todavía no es un resultado:
  // faltan días de gasto por suceder. Se dice "va" para que no se lea
  // como un cierre que ya ocurrió.
  const cerro = resumen.situacion === "cerrado";

  return "<div class=\"razones-cierre\">" +
    "<div class=\"razon\">" +
      "<span class=\"etiqueta-ancha\">Tasa de compromiso</span>" +
      "<span class=\"cifra-razon\">" + formatearPorcentaje(resumen.tasaDeCompromiso) + "</span>" +
      "<span class=\"pista-razon\">Del ingreso ya estaba comprometido antes de empezar — " +
        formatearMoneda(resumen.montoComprometidoDelCiclo) + " entre recurrentes, deuda y tarjeta. " +
        "No cambia con la lente: una obligación es la misma se mire como se mire.</span>" +
    "</div>" +
    "<div class=\"razon\">" +
      "<span class=\"etiqueta-ancha\">" + (cerro ? "Tasa de ahorro" : "Tasa de ahorro, por ahora") + "</span>" +
      "<span class=\"cifra-razon\">" + formatearPorcentaje(resumen.tasaDeAhorro) + "</span>" +
      "<span class=\"pista-razon\">" +
        (cerro
          ? "Del ingreso quedó sin gastar al cerrar."
          : "Del ingreso va sin gastar. Todavía faltan días de ciclo, así que va a bajar.") +
      "</span>" +
    "</div>" +
  "</div>";
}

// Las comparaciones. Cada una declara qué necesita, y si no lo hay dice
// qué falta en vez de esconderse: así el usuario sabe que el bloque
// existe y cuándo lo va a poder ver.
function htmlDeLasComparaciones(resumen, ciclo, datos) {
  const anterior = obtenerCicloAnteriorCerrado(ciclo, datos);
  const serie = calcularSerieDeCiclosCerrados(datos, lenteDelEstudio)
    .filter(function (r) { return r.cicloId !== ciclo.id; });

  const fichas = [];

  if (anterior) {
    const resumenAnterior = resumirCicloCompleto(anterior, datos, lenteDelEstudio);
    const variacion = calcularVariacion(resumen.gastadoTotal, resumenAnterior.gastadoTotal);
    fichas.push(
      "<div class=\"ficha-comparacion\">" +
        "<span class=\"etiqueta-ancha\">vs. " + escaparHTML(nombrarCicloDelEstudio(anterior)) + "</span>" +
        "<span class=\"valor-ficha\">" + formatearVariacion(variacion.enPesos) + "</span>" +
        "<span class=\"pista-ficha\">" +
          (variacion.enPorcentaje === null ? "gastado" : formatearPorcentaje(variacion.enPorcentaje) + " en lo gastado") +
        "</span>" +
      "</div>"
    );
  }

  const estadistica = calcularEstadisticaDeSerie(serie.map(function (r) { return r.gastadoTotal; }));
  if (estadistica.promedio !== null) {
    const variacion = calcularVariacion(resumen.gastadoTotal, estadistica.promedio);
    fichas.push(
      "<div class=\"ficha-comparacion\">" +
        "<span class=\"etiqueta-ancha\">vs. promedio</span>" +
        "<span class=\"valor-ficha\">" + formatearVariacion(variacion.enPesos) + "</span>" +
        "<span class=\"pista-ficha\">sobre " + estadistica.n + " ciclos cerrados</span>" +
      "</div>"
    );
  }

  if (fichas.length === 0) {
    const faltan = CICLOS_MINIMOS_PARA_PROMEDIO - estadistica.n;
    return htmlDeEstadoVacio(
      estadistica.n === 0
        ? "Primer ciclo: todavía no hay contra qué compararlo. La comparación aparece sola en cuanto cierre este."
        : "Faltan " + faltan + " ciclos cerrados para el promedio."
    );
  }

  return "<div class=\"comparaciones-cierre\">" + fichas.join("") + "</div>";
}

// La cifra protagonista y su etiqueta, que cambian según el ciclo haya
// cerrado o siga en curso.
//
// La proyección de cierre solo existe bajo la lente de caja, y con eso
// se llama a calcularProyeccionDeCierre — la MISMA función que alimenta
// el semáforo y la primera pantalla. Escribir aquí un segundo pronóstico
// daría dos números distintos para la misma pregunta en la misma app,
// que es el error que ya se pagó una vez con la simulación.
function htmlDelVeredicto(resumen, ciclo, datos) {
  const esCerrado = resumen.situacion === "cerrado";

  if (resumen.situacion === "porVenir") {
    return "<div class=\"veredicto-cierre\">" +
      "<span class=\"etiqueta-ancha\">Ciclo por venir</span>" +
      "<span class=\"cifra-cierre\">" + formatearMoneda(resumen.ingreso) + "</span>" +
      "<span class=\"pista-veredicto\">Ingreso previsto. Todavía no hay gasto que medir.</span>" +
    "</div>";
  }

  if (esCerrado) {
    const signo = resumen.remanente < 0 ? " en-rojo" : "";
    return "<div class=\"veredicto-cierre\">" +
      "<span class=\"etiqueta-ancha\">Cerró con</span>" +
      "<span class=\"cifra-cierre" + signo + "\">" + formatearMoneda(resumen.remanente) + "</span>" +
      "<span class=\"pista-veredicto\">" +
        (resumen.remanente < 0 ? "Se gastó más de lo que entró." : "Sobró al cerrar el ciclo.") +
      "</span>" +
    "</div>";
  }

  // En curso: lo que va es un hecho, y la proyección es otra cosa. Se
  // dibujan separadas y la proyectada lleva el trato de proyectada
  // (punteada y a media intensidad), nunca disfrazada de real.
  let proyeccionHTML;
  if (lenteDelEstudio === LENTE_CAJA && resumen.hayIngreso) {
    const proyeccionDeGasto = calcularProyeccionDeCierre(ciclo, datos);
    const remanenteProyectado = resumen.ingreso - proyeccionDeGasto;
    proyeccionHTML = "<div class=\"proyeccion-cierre\">" +
      "<span class=\"etiqueta-ancha\">Cerraría con</span>" +
      "<span class=\"cifra-proyectada" + (remanenteProyectado < 0 ? " en-rojo" : "") + "\">" +
        formatearMoneda(remanenteProyectado) + "</span>" +
      "<span class=\"pista-veredicto\">Si el ritmo no cambia. Es el mismo cálculo que usa el semáforo de arriba.</span>" +
    "</div>";
  } else {
    // Sin proyección de consumo. Un bloque grande con un guion ocuparía
    // el mejor lugar de la pantalla para no decir nada: se dice en una
    // línea y ya.
    proyeccionHTML = "<p class=\"nota-sin-proyeccion\">" +
      "Proyectar el cierre es una pregunta de caja. Cambia la lente a " +
      "<strong>Caja</strong> para ver con cuánto cerrarías." +
    "</p>";
  }

  return "<div class=\"veredicto-cierre\">" +
      "<span class=\"etiqueta-ancha\">Va sobrando</span>" +
      "<span class=\"cifra-cierre" + (resumen.remanente < 0 ? " en-rojo" : "") + "\">" +
        formatearMoneda(resumen.remanente) + "</span>" +
      "<span class=\"pista-veredicto\">De lo que entró, menos lo que ya salió.</span>" +
    "</div>" + proyeccionHTML;
}

function renderizarCierreDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionCierre");
  const resumen = resumirCicloCompleto(ciclo, datos, lenteDelEstudio);

  seccion.innerHTML =
    htmlDeEncabezadoDeSeccion("01", "Cierre", "¿Cómo va a terminar este ciclo?") +
    "<div class=\"cuerpo-cierre\">" +
      htmlDelVeredicto(resumen, ciclo, datos) +
      htmlDeLaReglaDelIngreso(resumen) +
      htmlDeLasRazones(resumen) +
      htmlDeLasComparaciones(resumen, ciclo, datos) +
    "</div>";
}
// ============================================================
//
// Dibuja calcularTrayectoriaDelSemaforo como una línea SVG hecha a mano
// (sin librerías de gráficas, por las restricciones del proyecto): un
// tramo por cada racha de color/condición pasado-futuro — pasado sólido,
// futuro punteado —, más las líneas de referencia de los umbrales del
// semáforo y un cursor que sigue al mouse o al dedo.

const COLOR_HEX_SEMAFORO = {
  verde: "#5eead4",
  amarillo: "#fde047",
  rojo: "#fca5a5",
  gris: "#94a3b8"
};

// Cómo se llama cada color del semáforo en pantalla. El color solo, sin
// su nombre, obliga a recordar qué significaba cada uno.
const ETIQUETA_SEMAFORO = {
  verde: "Vas bien",
  amarillo: "Al límite",
  rojo: "Te vas a pasar",
  gris: "Ningún ingreso cae en este ciclo"
};

// Agrupa la trayectoria en tramos consecutivos que comparten color y
// condición pasado/futuro, repitiendo el punto de quiebre en el tramo
// anterior para que la línea se vea continua aunque cambie de color a
// la mitad.
function construirTramosDeTrayectoria(trayectoria) {
  const tramos = [];
  let tramoActual = null;

  trayectoria.forEach(function (punto, indice) {
    const clave = punto.color + "|" + punto.esFuturo;
    const entrada = { indice: indice, porcentaje: punto.porcentaje };

    if (!tramoActual || tramoActual.clave !== clave) {
      const quiebre = indice > 0 ? [{ indice: indice - 1, porcentaje: trayectoria[indice - 1].porcentaje }] : [];
      tramoActual = { clave: clave, color: punto.color, esFuturo: punto.esFuturo, entradas: quiebre.concat([entrada]) };
      tramos.push(tramoActual);
    } else {
      tramoActual.entradas.push(entrada);
    }
  });

  return tramos;
}

function renderizarTrayectoriaSemaforo() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();
  const contenedor = document.getElementById("contenedorTrayectoriaSemaforo");
  const ingresosDelCiclo = calcularIngresosDelCiclo(ciclo, datos);

  // Sin ingreso capturado no hay nada que graficar todavía — mismo
  // criterio "gris" que ya usa el semáforo de Balance del ciclo.
  if (ingresosDelCiclo <= 0) {
    contenedor.innerHTML = "<div class=\"grafica-trayectoria\"><p class=\"pista\">Captura un ingreso que caiga en este ciclo para ver la gráfica de trayectoria.</p></div>";
    return;
  }

  const trayectoria = calcularTrayectoriaDelSemaforo(ciclo, datos);
  const ANCHO = 640;
  const ALTO = 200;
  const MARGEN = { izquierda: 8, derecha: 34, arriba: 10, abajo: 20 };
  const anchoGrafica = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoGrafica = ALTO - MARGEN.arriba - MARGEN.abajo;

  const maxObservado = trayectoria.reduce(function (max, d) { return Math.max(max, d.porcentaje); }, 0);
  const porcentajeMaximoEje = Math.max(1.15, maxObservado * 1.1);

  function coordenadaX(indice) {
    return MARGEN.izquierda + (indice / (trayectoria.length - 1)) * anchoGrafica;
  }
  function coordenadaY(porcentaje) {
    return MARGEN.arriba + (1 - (porcentaje / porcentajeMaximoEje)) * altoGrafica;
  }

  const yBase = coordenadaY(0);
  let indiceHoy = 0;
  trayectoria.forEach(function (dia, indice) {
    if (!dia.esFuturo) { indiceHoy = indice; }
  });

  const tramos = construirTramosDeTrayectoria(trayectoria);
  const tramosHTML = tramos.map(function (tramo) {
    const colorHex = COLOR_HEX_SEMAFORO[tramo.color];
    const puntosLinea = tramo.entradas.map(function (e) { return coordenadaX(e.indice) + "," + coordenadaY(e.porcentaje); }).join(" ");
    const primeraX = coordenadaX(tramo.entradas[0].indice);
    const ultimaX = coordenadaX(tramo.entradas[tramo.entradas.length - 1].indice);
    const puntosArea = primeraX + "," + yBase + " " + puntosLinea + " " + ultimaX + "," + yBase;
    const guionado = tramo.esFuturo ? " stroke-dasharray=\"5 4\"" : "";

    return "<polygon points=\"" + puntosArea + "\" fill=\"" + colorHex + "\" opacity=\"0.1\"></polygon>" +
      "<polyline points=\"" + puntosLinea + "\" fill=\"none\" stroke=\"" + colorHex + "\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"" + guionado + "></polyline>";
  }).join("");

  const yVerde = coordenadaY(UMBRAL_SEMAFORO_VERDE);
  const yAmarillo = coordenadaY(UMBRAL_SEMAFORO_AMARILLO);
  const lineasReferenciaHTML =
    "<line class=\"grafica-linea-referencia\" x1=\"" + MARGEN.izquierda + "\" x2=\"" + (ANCHO - MARGEN.derecha) + "\" y1=\"" + yVerde + "\" y2=\"" + yVerde + "\"></line>" +
    "<text class=\"grafica-eje-texto\" x=\"" + (ANCHO - MARGEN.derecha + 4) + "\" y=\"" + (yVerde + 3) + "\">90%</text>" +
    "<line class=\"grafica-linea-referencia\" x1=\"" + MARGEN.izquierda + "\" x2=\"" + (ANCHO - MARGEN.derecha) + "\" y1=\"" + yAmarillo + "\" y2=\"" + yAmarillo + "\"></line>" +
    "<text class=\"grafica-eje-texto\" x=\"" + (ANCHO - MARGEN.derecha + 4) + "\" y=\"" + (yAmarillo + 3) + "\">100%</text>";

  const lineaHoyHTML =
    "<line class=\"grafica-linea-hoy\" x1=\"" + coordenadaX(indiceHoy) + "\" x2=\"" + coordenadaX(indiceHoy) + "\" y1=\"" + MARGEN.arriba + "\" y2=\"" + yBase + "\"></line>" +
    "<text class=\"grafica-eje-texto\" x=\"" + coordenadaX(indiceHoy) + "\" y=\"" + (ALTO - 4) + "\" text-anchor=\"middle\">hoy</text>";

  const puntoHoy = trayectoria[indiceHoy];
  const puntoFinal = trayectoria[trayectoria.length - 1];
  const marcadoresHTML =
    "<circle cx=\"" + coordenadaX(indiceHoy) + "\" cy=\"" + coordenadaY(puntoHoy.porcentaje) + "\" r=\"4\" fill=\"" + COLOR_HEX_SEMAFORO[puntoHoy.color] + "\" stroke=\"#1e293b\" stroke-width=\"2\"></circle>" +
    "<circle cx=\"" + coordenadaX(trayectoria.length - 1) + "\" cy=\"" + coordenadaY(puntoFinal.porcentaje) + "\" r=\"4\" fill=\"" + COLOR_HEX_SEMAFORO[puntoFinal.color] + "\" stroke=\"#1e293b\" stroke-width=\"2\"></circle>";

  const etiquetaFinalHTML = "<text class=\"grafica-eje-texto\" x=\"" + (coordenadaX(trayectoria.length - 1) - 4) + "\" y=\"" + (coordenadaY(puntoFinal.porcentaje) - 8) + "\" text-anchor=\"end\">" +
    Math.round(puntoFinal.porcentaje * 100) + "%" + (puntoFinal.esFuturo ? " proyectado" : "") + "</text>";

  const crosshairHTML = "<line class=\"grafica-crosshair\" id=\"graficaCrosshair\" y1=\"" + MARGEN.arriba + "\" y2=\"" + yBase + "\"></line>";

  const coloresPresentes = Array.from(new Set(trayectoria.map(function (d) { return d.color; }))).filter(function (c) { return c !== "gris"; });
  const leyendaHTML = "<div class=\"grafica-leyenda\">" + coloresPresentes.map(function (c) {
    return "<span><span class=\"marca\" style=\"background-color: " + COLOR_HEX_SEMAFORO[c] + ";\"></span>" + ETIQUETA_SEMAFORO[c] + "</span>";
  }).join("") + "</div>";

  contenedor.innerHTML =
    "<div class=\"grafica-trayectoria\">" +
      "<svg viewBox=\"0 0 " + ANCHO + " " + ALTO + "\" id=\"svgTrayectoriaSemaforo\">" +
        lineasReferenciaHTML + lineaHoyHTML + tramosHTML + marcadoresHTML + etiquetaFinalHTML + crosshairHTML +
      "</svg>" +
      "<div class=\"grafica-tooltip\" id=\"tooltipTrayectoriaSemaforo\"></div>" +
      leyendaHTML +
    "</div>";

  // Cursor: encuentra el día más cercano al puntero y mueve la línea
  // vertical y el tooltip a esa posición — así se puede leer el valor
  // exacto de cualquier día sin tener que acertarle a la línea.
  const svg = document.getElementById("svgTrayectoriaSemaforo");
  const crosshair = document.getElementById("graficaCrosshair");
  const tooltip = document.getElementById("tooltipTrayectoriaSemaforo");

  function actualizarCursor(clientX) {
    const rectSVG = svg.getBoundingClientRect();
    const rectContenedor = contenedor.getBoundingClientRect();
    const xRelativo = ((clientX - rectSVG.left) / rectSVG.width) * ANCHO;
    const indiceCercano = Math.round(((xRelativo - MARGEN.izquierda) / anchoGrafica) * (trayectoria.length - 1));
    const indiceAcotado = Math.min(Math.max(indiceCercano, 0), trayectoria.length - 1);
    const punto = trayectoria[indiceAcotado];

    crosshair.setAttribute("x1", coordenadaX(indiceAcotado));
    crosshair.setAttribute("x2", coordenadaX(indiceAcotado));
    crosshair.style.display = "block";

    const xPantalla = rectSVG.left + (coordenadaX(indiceAcotado) / ANCHO) * rectSVG.width - rectContenedor.left;
    const yPantalla = rectSVG.top + (coordenadaY(punto.porcentaje) / ALTO) * rectSVG.height - rectContenedor.top;

    tooltip.style.left = xPantalla + "px";
    tooltip.style.top = (yPantalla - 8) + "px";
    tooltip.style.display = "block";
    tooltip.innerHTML = "<div>" + punto.fechaISO + (punto.esFuturo ? " (proyectado)" : "") + "</div>" +
      "<div class=\"valor\">" + Math.round(punto.porcentaje * 100) + "% — " + ETIQUETA_SEMAFORO[punto.color] + "</div>";
  }

  svg.addEventListener("pointermove", function (evento) { actualizarCursor(evento.clientX); });
  svg.addEventListener("pointerleave", function () {
    crosshair.style.display = "none";
    tooltip.style.display = "none";
  });
}

// De solo lectura, a diferencia de Pendientes (Captura): la acción de
// marcar como pagado se queda concentrada ahí y en el panel de detalle
// del calendario, para no duplicarla en dos superficies de la misma
// pantalla ancha.
function renderizarProximosPagosAnalisis() {
  const datos = leerDatos();
  const cicloActual = asegurarCicloActual();
  const lista = document.getElementById("listaProximosPagosAnalisis");

  const pendientes = obtenerPendientesDelCiclo(datos, cicloActual.id);

  if (pendientes.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">No hay pendientes en este ciclo.</li>";
    return;
  }

  lista.innerHTML = pendientes.map(function (compromiso) {
    const esUrgente = calcularDiasHastaFecha(compromiso.fechaProgramada) <= DIAS_PARA_PENDIENTE_URGENTE;
    const etiquetaPago = compromiso.pagoNde ? " (pago " + compromiso.pagoNde + ")" : "";
    return "<li class=\"" + (esUrgente ? "pendiente-urgente" : "") + "\">" +
      compromiso.fechaProgramada + " — " + escaparHTML(compromiso.nombre) + etiquetaPago +
      " <span class=\"detalle\">(" + formatearMoneda(compromiso.montoEstimado) + " est.)</span></li>";
  }).join("");
}

// Movimientos son hechos, no promesas: solo gastos ya registrados
// (datos.gastos), sea que hayan cerrado un compromiso o que sean gasto
// libre — a diferencia de Próximos pagos, que son compromisos que
// todavía no suceden. Más reciente arriba, mismo criterio que ya usa
// "Hoy" en Captura.
function obtenerMovimientosDelCiclo(datos, cicloId) {
  return datos.gastos
    .filter(function (g) { return g.cicloId === cicloId; })
    .sort(function (a, b) {
      if (a.fecha !== b.fecha) {
        return a.fecha < b.fecha ? 1 : -1;
      }
      return a.hora < b.hora ? 1 : -1;
    });
}

function renderizarMovimientosDelCiclo() {
  const datos = leerDatos();
  const cicloActual = asegurarCicloActual();
  const lista = document.getElementById("listaMovimientosCiclo");
  const movimientos = obtenerMovimientosDelCiclo(datos, cicloActual.id);

  if (movimientos.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">Todavía no hay gastos registrados en este ciclo.</li>";
    return;
  }

  lista.innerHTML = movimientos.map(function (gasto) {
    const categoria = datos.config.categorias.find(function (c) { return c.id === gasto.categoriaId; });
    const etiquetaCategoria = categoria
      ? escaparHTML(categoria.nombre) + " — " + escaparHTML(gasto.subcategoria)
      : escaparHTML(gasto.descripcion || "Sin categoría");

    const etiquetaDestinatario = gasto.destinatario ? ", " + escaparHTML(gasto.destinatario) : "";

    let etiquetaOrigen;
    if (gasto.compromisoId) {
      const compromiso = datos.compromisos.find(function (c) { return c.id === gasto.compromisoId; });
      etiquetaOrigen = compromiso ? "compromiso: " + escaparHTML(compromiso.nombre) : "compromiso";
    } else {
      etiquetaOrigen = "gasto libre";
    }

    return "<li>" + gasto.fecha + " " + gasto.hora + " — " + etiquetaCategoria +
      " <span class=\"detalle\">(" + formatearMoneda(gasto.monto) + ", " + gasto.fuente + etiquetaDestinatario + ", " + etiquetaOrigen + ")</span></li>";
  }).join("");
}

// ============================================================
// ESTUDIO — DEUDA
// ============================================================
//
// Aplica calcularEstadoDeDeuda a cada deuda activa. Solo texto por ahora
// — la barra de avance visual queda para una pasada de diseño aparte.
function renderizarEstadoDeDeudaAnalisis() {
  const datos = leerDatos();
  const contenedor = document.getElementById("contenedorDeuda");
  const deudasActivas = datos.deudas.filter(function (deuda) { return deuda.activa; });

  if (deudasActivas.length === 0) {
    contenedor.innerHTML = "<p class=\"pista\">No hay deudas activas.</p>";
    return;
  }

  contenedor.innerHTML = deudasActivas.map(function (deuda) {
    const estado = calcularEstadoDeDeuda(deuda);
    const pagosRestantes = deuda.pagosTotales - deuda.pagosRealizados;

    return "<div class=\"estado-deuda-item\">" +
      "<div><strong>" + escaparHTML(deuda.nombre) + "</strong> — " + pagosRestantes + " de " + deuda.pagosTotales + " pagos restantes</div>" +
      "<p class=\"detalle\">Saldo restante: " + formatearMoneda(estado.saldoRestante) + " (" + (estado.porcentajePagado * 100).toFixed(1) + "% pagado)</p>" +
      "<p class=\"detalle\">Costo del crédito: " + formatearMoneda(estado.costoDelCredito) + " (" + (estado.porcentajeSobrante * 100).toFixed(1) + "% sobre lo solicitado)</p>" +
      "<p class=\"pista\">Se liquida aprox. el " + formatearFechaISO(estado.fechaLiquidacion) + "</p>" +
    "</div>";
  }).join("");
}
