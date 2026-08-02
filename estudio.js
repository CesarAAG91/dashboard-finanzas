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
  renderizarEstructuraDelCiclo();
  // El ritmo dibuja la trayectoria por dentro: es su tercera pieza.
  renderizarRitmoDelCiclo();
  renderizarFrentesDelCiclo();
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
// ESTUDIO — §2 ESTRUCTURA
// ============================================================
//
// La tabla de en qué se fue el dinero, ordenada de mayor a menor. La
// primera fila es siempre la que hay que mirar, y eso lo hace el orden,
// no un color ni un icono.
//
// Cada categoría se puede desplegar para ver sus subcategorías dentro.
// Cerrada por default: la pregunta "¿en qué se me va?" se contesta
// primero con cuatro renglones, no con veinte.

// Qué categorías están desplegadas. Vive fuera de la función de dibujado
// para que sobreviva a renderizarTodo() — si no, cada gasto capturado
// cerraría todo lo que el usuario había abierto.
const categoriasDesplegadasDelEstudio = {};

function alternarCategoriaDelEstudio(claveCategoria) {
  categoriasDesplegadasDelEstudio[claveCategoria] = !categoriasDesplegadasDelEstudio[claveCategoria];
  renderizarEstructuraDelCiclo();
}

// La barra de presupuesto de una categoría variable, con su marca de
// ritmo. Es el componente que dice si el presupuesto está bien puesto:
// la barra es lo gastado contra la bolsa del ciclo, y la marca es en qué
// día del ciclo vamos. Barra por delante de la marca = vas más rápido
// que el calendario.
function htmlDeBarraDePresupuesto(fila, avanceDelCiclo) {
  if (fila.presupuestoDelCiclo === null || fila.presupuestoDelCiclo <= 0) {
    return "<span class=\"sin-presupuesto\">sin presupuesto</span>";
  }

  const proporcion = fila.gastadoDeLaBolsa / fila.presupuestoDelCiclo;
  const seExcedio = proporcion > 1;
  // La barra se acota al 100% del contenedor; el exceso se dice con
  // número y color, no estirando la barra fuera de su caja.
  const ancho = Math.min(proporcion, 1) * 100;

  return "<div class=\"barra-presupuesto" + (seExcedio ? " se-excedio" : "") + "\">" +
      "<div class=\"relleno-presupuesto\" style=\"width: " + ancho.toFixed(2) + "%;\"></div>" +
      "<div class=\"marca-ritmo\" style=\"left: " + (avanceDelCiclo * 100).toFixed(2) + "%;\"" +
        " title=\"Día " + Math.round(avanceDelCiclo * 100) + "% del ciclo\"></div>" +
    "</div>" +
    "<span class=\"cifra-presupuesto" + (seExcedio ? " en-rojo" : "") + "\">" +
      formatearPorcentaje(proporcion) + " de " + formatearMoneda(fila.presupuestoDelCiclo) +
    "</span>";
}

// El renglón de una categoría. Es un botón entero, no un enlace chiquito
// al final: lo que se quiere tocar es la fila, y así no hay que apuntarle.
function htmlDeFilaDeCategoria(fila, avanceDelCiclo) {
  const clave = fila.categoriaId || CATEGORIA_SIN_CLASIFICAR;
  const estaAbierta = Boolean(categoriasDesplegadasDelEstudio[clave]);

  const subfilas = fila.subcategorias.map(function (sub) {
    // El aviso de "no toca el presupuesto" solo aparece donde significa
    // algo: dentro de una categoría que sí tiene bolsa.
    const marcaFueraDeBolsa = (fila.esVariableSemanal && !sub.consumeLaBolsa)
      ? "<span class=\"fuera-de-bolsa\" title=\"Se registra y se analiza, pero no consume la bolsa semanal de esta categoría\">fuera del presupuesto</span>"
      : "";

    return "<tr class=\"fila-subcategoria\">" +
      "<td class=\"celda-nombre\">" + escaparHTML(sub.nombre) + marcaFueraDeBolsa + "</td>" +
      "<td class=\"celda-cifra\">" + formatearMoneda(sub.total) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + sub.conteo + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearMoneda(sub.ticketPromedio) + "</td>" +
      "<td class=\"celda-barra\"></td>" +
    "</tr>";
  }).join("");

  return "<tr class=\"fila-categoria" + (estaAbierta ? " abierta" : "") + "\"" +
      " data-categoria=\"" + escaparHTML(clave) + "\">" +
      "<td class=\"celda-nombre\">" +
        "<span class=\"chevron-categoria\" aria-hidden=\"true\">›</span>" +
        escaparHTML(fila.nombre) +
        "<span class=\"parte-del-ingreso\">" + formatearPorcentaje(fila.parteDelIngreso) + " del ingreso</span>" +
      "</td>" +
      "<td class=\"celda-cifra fuerte\">" + formatearMoneda(fila.total) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + fila.conteo + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearMoneda(fila.ticketPromedio) + "</td>" +
      "<td class=\"celda-barra\">" +
        (fila.esVariableSemanal ? htmlDeBarraDePresupuesto(fila, avanceDelCiclo) : "") +
      "</td>" +
    "</tr>" +
    (estaAbierta ? subfilas : "");
}

// El reparto en tres, arriba de la tabla. Son los mismos tres pedazos de
// la regla del §1, en números: aquí se ven en pesos, allá en proporción.
function htmlDelRepartoEnTres(resumen) {
  const pedazos = [
    { nombre: "Fijo", monto: resumen.fijo + resumen.fijoPendiente,
      pista: "Compromisos del ciclo, pagados y por pagar" },
    { nombre: "Variable presupuestado", monto: resumen.variablePresupuestado,
      pista: "Gasto libre que consume una bolsa semanal" },
    { nombre: "Discrecional", monto: resumen.discrecional,
      pista: "Gasto libre que ninguna bolsa cubre" }
  ];

  return "<div class=\"reparto-en-tres\">" + pedazos.map(function (pedazo) {
    return "<div class=\"pedazo\">" +
      "<span class=\"etiqueta-ancha\">" + pedazo.nombre + "</span>" +
      "<span class=\"cifra-pedazo\">" + formatearMoneda(pedazo.monto) + "</span>" +
      "<span class=\"pista-pedazo\">" + escaparHTML(pedazo.pista) + "</span>" +
    "</div>";
  }).join("") + "</div>";
}

// Cuando el total de una categoría no coincide con lo que descontó de su
// bolsa, hay que decir por qué. Si no, la barra y la cifra de al lado se
// contradicen y parece un error de la app.
function htmlDeLaNotaDeBolsa(filas) {
  const conDiferencia = filas.filter(function (fila) {
    return fila.esVariableSemanal && fila.fueraDeLaBolsa > 0.005;
  });

  if (conDiferencia.length === 0) {
    return "";
  }

  const detalle = conDiferencia.map(function (fila) {
    return escaparHTML(fila.nombre) + " " + formatearMoneda(fila.fueraDeLaBolsa);
  }).join(" · ");

  return "<p class=\"nota-de-bolsa\">La barra mide solo lo que descuenta de la bolsa semanal. " +
    "Queda fuera lo pagado con tarjeta y las subcategorías que no consumen el presupuesto: " +
    detalle + ".</p>";
}

function renderizarEstructuraDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionEstructura");

  const resumen = resumirCicloCompleto(ciclo, datos, lenteDelEstudio);
  const filas = calcularGastoPorCategoriaDelCiclo(ciclo, datos, lenteDelEstudio);
  const avance = calcularAvanceDelCiclo(ciclo);

  const encabezado = htmlDeEncabezadoDeSeccion("02", "Estructura", "¿En qué se me va?");

  if (filas.length === 0) {
    seccion.innerHTML = encabezado +
      htmlDeEstadoVacio("Todavía no hay gastos registrados en este ciclo.");
    return;
  }

  seccion.innerHTML = encabezado +
    htmlDelRepartoEnTres(resumen) +
    "<table class=\"tabla-estudio tabla-categorias\">" +
      "<thead><tr>" +
        "<th>Categoría</th>" +
        "<th class=\"celda-cifra\">Gastado</th>" +
        "<th class=\"celda-cifra\" title=\"Cuántos movimientos\">Movs.</th>" +
        "<th class=\"celda-cifra\" title=\"Gastado entre movimientos\">Ticket prom.</th>" +
        "<th class=\"celda-barra\">Contra el presupuesto</th>" +
      "</tr></thead>" +
      "<tbody>" + filas.map(function (fila) {
        return htmlDeFilaDeCategoria(fila, avance);
      }).join("") + "</tbody>" +
    "</table>" +
    htmlDeLaNotaDeBolsa(filas);

  // El cableado va aquí y no en arranque.js porque las filas se crean y
  // se destruyen en cada dibujado: un listener puesto una sola vez al
  // arrancar apuntaría a filas que ya no existen.
  seccion.querySelectorAll(".fila-categoria").forEach(function (filaHTML) {
    filaHTML.addEventListener("click", function () {
      alternarCategoriaDelEstudio(filaHTML.getAttribute("data-categoria"));
    });
  });
}

// ============================================================
// ESTUDIO — §3 RITMO
// ============================================================
//
// Cuándo se va el dinero dentro del ciclo. Tres piezas que responden lo
// mismo a tres resoluciones distintas: por semana, por día de la semana,
// y día por día en la gráfica de trayectoria.

// Los días de la semana en el orden en que se leen, no en el de
// getDay(). Lunes primero: la semana de gasto de una persona empieza en
// lunes, aunque el calendario diga otra cosa.
const DIAS_EN_ORDEN_DE_LECTURA = [
  { indice: 1, nombre: "Lun" },
  { indice: 2, nombre: "Mar" },
  { indice: 3, nombre: "Mié" },
  { indice: 4, nombre: "Jue" },
  { indice: 5, nombre: "Vie" },
  { indice: 6, nombre: "Sáb" },
  { indice: 0, nombre: "Dom" }
];

// La fila de las cuatro semanas, que es el titular de la sección. Las
// barras se escalan contra la semana más cara, y debajo va el gasto por
// día — que es lo único comparable cuando las semanas miden distinto.
function htmlDeLasCuatroSemanas(totalesPorSemana) {
  const maximo = totalesPorSemana.reduce(function (max, s) { return Math.max(max, s.total); }, 0);

  return "<div class=\"cuatro-semanas\">" + totalesPorSemana.map(function (semana) {
    const alto = maximo > 0 ? (semana.total / maximo) * 100 : 0;
    return "<div class=\"columna-semana\">" +
        "<div class=\"tubo-semana\">" +
          "<div class=\"relleno-semana\" style=\"height: " + alto.toFixed(2) + "%;\"></div>" +
        "</div>" +
        "<div class=\"pie-semana\">" +
          "<span class=\"nombre-semana\">Semana " + semana.numero + "</span>" +
          "<span class=\"monto-semana\">" + formatearMoneda(semana.total) + "</span>" +
          "<span class=\"detalle-semana\">" + formatearMoneda(semana.porDia) + " al día · " +
            semana.dias + " días</span>" +
          "<span class=\"fechas-semana\">" + semana.fechaInicio + " a " + semana.fechaFin + "</span>" +
        "</div>" +
      "</div>";
  }).join("") + "</div>";
}

// La matriz por categoría. Cada renglón se escala contra su propia
// semana más cara, no contra la matriz entera: la pregunta aquí es
// "¿cuándo se va ESTA categoría?", y comparar categorías entre sí ya lo
// hace el §2.
function htmlDeLaMatrizDeSemanas(filas) {
  const encabezado = "<tr><th>Categoría</th>" +
    [1, 2, 3, 4].map(function (n) { return "<th class=\"celda-semana\">Sem " + n + "</th>"; }).join("") +
    "</tr>";

  const cuerpo = filas.map(function (fila) {
    const maximoDeLaFila = fila.semanas.reduce(function (max, v) { return Math.max(max, v); }, 0);

    const celdas = fila.semanas.map(function (monto, indice) {
      const alto = maximoDeLaFila > 0 ? (monto / maximoDeLaFila) * 100 : 0;
      const bolsa = fila.bolsas[indice];
      // La marca de la bolsa solo se dibuja si cabe dentro de la escala
      // de la fila. Si la bolsa es mayor que el gasto más alto, la marca
      // saldría fuera del tubo y no diría nada.
      const marca = (bolsa !== null && bolsa > 0 && maximoDeLaFila > 0 && bolsa <= maximoDeLaFila)
        ? "<div class=\"marca-bolsa\" style=\"bottom: " + ((bolsa / maximoDeLaFila) * 100).toFixed(2) + "%;\"" +
          " title=\"Bolsa de la semana: " + escaparHTML(formatearMoneda(bolsa)) + "\"></div>"
        : "";

      // El rojo compara contra la bolsa lo que DE VERDAD la consume, no
      // el total de la categoría. Si comparara el total, el Didi pondría
      // en rojo una semana de Transporte que no se pasó de gasolina.
      const deLaBolsa = fila.semanasDeLaBolsa[indice];
      const seExcedio = bolsa !== null && bolsa > 0 && deLaBolsa > bolsa;

      const explicacion = formatearMoneda(monto) +
        (bolsa !== null && bolsa > 0
          ? " · " + formatearMoneda(deLaBolsa) + " de la bolsa de " + formatearMoneda(bolsa)
          : "");

      return "<td class=\"celda-semana\">" +
          "<div class=\"tubo-celda\" title=\"" + escaparHTML(explicacion) + "\">" +
            "<div class=\"relleno-celda" + (seExcedio ? " se-excedio" : "") + "\"" +
              " style=\"height: " + alto.toFixed(2) + "%;\"></div>" + marca +
          "</div>" +
          "<span class=\"cifra-celda\">" + (monto > 0 ? formatearMoneda(monto) : "—") + "</span>" +
        "</td>";
    }).join("");

    return "<tr><td class=\"celda-nombre\">" + escaparHTML(fila.nombre) + "</td>" + celdas + "</tr>";
  }).join("");

  return "<table class=\"tabla-estudio tabla-matriz\">" +
      "<thead>" + encabezado + "</thead><tbody>" + cuerpo + "</tbody>" +
    "</table>" +
    "<p class=\"nota-matriz\">Cada renglón se escala contra su propia semana más cara. " +
      "La línea clara dentro del tubo es la bolsa de esa semana, donde hay presupuesto.</p>";
}

function htmlDeLosDiasDeLaSemana(distribucion) {
  const maximo = distribucion.montos.reduce(function (max, v) { return Math.max(max, v); }, 0);

  if (maximo <= 0) {
    return "";
  }

  return "<div class=\"bloque-dias\">" +
      "<span class=\"etiqueta-ancha\">Por día de la semana</span>" +
      "<div class=\"barras-dias\">" + DIAS_EN_ORDEN_DE_LECTURA.map(function (dia) {
        const monto = distribucion.montos[dia.indice];
        const alto = (monto / maximo) * 100;
        return "<div class=\"columna-dia\" title=\"" +
            escaparHTML(dia.nombre + ": " + formatearMoneda(monto) + " en " + distribucion.conteos[dia.indice] + " movimientos") + "\">" +
            "<div class=\"tubo-dia\"><div class=\"relleno-dia\" style=\"height: " + alto.toFixed(2) + "%;\"></div></div>" +
            "<span class=\"nombre-dia\">" + dia.nombre + "</span>" +
            "<span class=\"monto-dia\">" + (monto > 0 ? formatearMoneda(monto) : "—") + "</span>" +
          "</div>";
      }).join("") + "</div>" +
    "</div>";
}

function renderizarRitmoDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionRitmo");

  const matriz = calcularGastoPorSemanaYCategoria(ciclo, datos, lenteDelEstudio);
  const distribucion = calcularGastoPorDiaDeLaSemana(ciclo, datos, lenteDelEstudio);

  const encabezado = htmlDeEncabezadoDeSeccion("03", "Ritmo", "¿Cuándo se me va?");

  if (matriz.filas.length === 0) {
    seccion.innerHTML = encabezado +
      htmlDeEstadoVacio("Todavía no hay gastos registrados en este ciclo.") +
      "<div id=\"contenedorTrayectoriaSemaforo\"></div>";
    renderizarTrayectoriaSemaforo();
    return;
  }

  seccion.innerHTML = encabezado +
    htmlDeLasCuatroSemanas(matriz.totalesPorSemana) +
    htmlDeLaMatrizDeSemanas(matriz.filas) +
    htmlDeLosDiasDeLaSemana(distribucion) +
    "<div class=\"bloque-trayectoria\">" +
      "<span class=\"etiqueta-ancha\">Día por día</span>" +
      "<div id=\"contenedorTrayectoriaSemaforo\"></div>" +
    "</div>";

  // La gráfica se dibuja después de que su contenedor existe: este
  // innerHTML acaba de destruir el anterior.
  renderizarTrayectoriaSemaforo();
}

// ============================================================
// ESTUDIO — GRÁFICA DE TRAYECTORIA DEL SEMÁFORO
// ============================================================
//
// La tercera pieza del §3, y la de mayor resolución: el ciclo día por
// día. Se dibuja dentro de la sección de Ritmo.
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
  // El ciclo que se está estudiando, no el de hoy: si el usuario navegó
  // a mayo, la gráfica tiene que ser la de mayo.
  const ciclo = obtenerCicloDelEstudio();
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
  const ciclo = obtenerCicloDelEstudio();
  const lista = document.getElementById("listaProximosPagosAnalisis");

  const pendientes = obtenerPendientesDelCiclo(datos, ciclo.id);

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
  const ciclo = obtenerCicloDelEstudio();
  const lista = document.getElementById("listaMovimientosCiclo");
  const movimientos = obtenerMovimientosDelCiclo(datos, ciclo.id);

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

// ============================================================
// ESTUDIO — §4 FRENTES
// ============================================================
//
// A quién le estoy pagando. Va a todo lo ancho porque es una tabla por
// derecho propio y porque, para quien sostiene más de una casa, es la
// sección que más se va a mirar.

// La barra de un frente: lo gastado sólido, lo que falta por pagar
// rayado. Los dos contra el mismo máximo de la tabla, para que las
// barras de distintos frentes se puedan comparar entre sí de un vistazo.
function htmlDeBarraDeFrente(frente, maximo) {
  if (maximo <= 0) {
    return "";
  }
  const anchoGastado = (frente.gastado / maximo) * 100;
  const anchoPorPagar = (frente.porPagar / maximo) * 100;

  return "<div class=\"barra-frente\">" +
      "<div class=\"parte-gastada\" style=\"width: " + anchoGastado.toFixed(2) + "%;\"></div>" +
      "<div class=\"parte-por-pagar\" style=\"width: " + anchoPorPagar.toFixed(2) + "%;\"></div>" +
    "</div>";
}

function renderizarFrentesDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionFrentes");
  const frentes = calcularGastoPorDestinatario(ciclo, datos, lenteDelEstudio);

  const encabezado = htmlDeEncabezadoDeSeccion("04", "Frentes", "¿A quién le estoy pagando?");

  // Con todo sin etiquetar no hay nada que analizar todavía, y decirlo
  // es más útil que dibujar una tabla de un solo renglón: el campo
  // existe desde hace tiempo y quizá nadie sabe que está ahí.
  const hayFrentesDeVerdad = frentes.some(function (f) { return !f.esSinAsignar; });
  if (!hayFrentesDeVerdad) {
    seccion.innerHTML = encabezado + htmlDeEstadoVacio(
      "Ningún gasto de este ciclo tiene destinatario. El destinatario es a quién o a qué " +
      "corresponde un gasto — la casa de tu abuela, el celular de tu mamá — y se captura " +
      "al registrar el monto, o se hereda del recurrente. En cuanto etiquetes uno, esta " +
      "sección suma cuánto cuesta cada frente."
    );
    return;
  }

  const maximo = frentes.reduce(function (max, f) { return Math.max(max, f.total); }, 0);

  const filas = frentes.map(function (frente) {
    const conceptos = frente.conceptos.map(function (concepto) {
      const suma = concepto.gastado + concepto.porPagar;
      const marcaPorPagar = concepto.porPagar > 0 && concepto.gastado === 0
        ? "<span class=\"marca-por-pagar\">por pagar</span>"
        : "";
      return "<tr class=\"fila-subcategoria\">" +
        "<td class=\"celda-nombre\">" + escaparHTML(concepto.nombre) + marcaPorPagar + "</td>" +
        "<td class=\"celda-cifra\">" + formatearMoneda(suma) + "</td>" +
        "<td class=\"celda-cifra secundaria\">" + (concepto.conteo > 0 ? concepto.conteo : "—") + "</td>" +
        "<td class=\"celda-barra\"></td>" +
      "</tr>";
    }).join("");

    const detallePorPagar = frente.porPagar > 0
      ? "<span class=\"detalle-frente\">" + formatearMoneda(frente.gastado) + " gastados · " +
        formatearMoneda(frente.porPagar) + " por pagar</span>"
      : "";

    return "<tr class=\"fila-frente" + (frente.esSinAsignar ? " sin-asignar" : "") + "\">" +
        "<td class=\"celda-nombre\">" +
          escaparHTML(frente.nombre) +
          "<span class=\"parte-del-ingreso\">" + formatearPorcentaje(frente.parteDelIngreso) + " del ingreso</span>" +
        "</td>" +
        "<td class=\"celda-cifra fuerte\">" + formatearMoneda(frente.total) + "</td>" +
        "<td class=\"celda-cifra secundaria\">" + (frente.conteo > 0 ? frente.conteo : "—") + "</td>" +
        "<td class=\"celda-barra\">" + htmlDeBarraDeFrente(frente, maximo) + detallePorPagar + "</td>" +
      "</tr>" + conceptos;
  }).join("");

  seccion.innerHTML = encabezado +
    "<table class=\"tabla-estudio tabla-frentes\">" +
      "<thead><tr>" +
        "<th>Frente</th>" +
        "<th class=\"celda-cifra\">Total del ciclo</th>" +
        "<th class=\"celda-cifra\">Movs.</th>" +
        "<th class=\"celda-barra\">Gastado y por pagar</th>" +
      "</tr></thead>" +
      "<tbody>" + filas + "</tbody>" +
    "</table>" +
    "<p class=\"nota-de-bolsa\">La parte sólida ya salió; la rayada son compromisos del ciclo " +
      "que todavía no se pagan. «Sin asignar» va siempre al final: no es un frente, es lo que " +
      "falta por etiquetar.</p>";
}
