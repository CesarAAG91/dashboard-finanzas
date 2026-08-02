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
  renderizarBalanceDelCiclo();
  renderizarTrayectoriaSemaforo();
  renderizarProximosPagosAnalisis();
  renderizarMovimientosDelCiclo();
  renderizarEstadoDeDeudaAnalisis();
}

// ============================================================
// ESTUDIO — BALANCE Y PRÓXIMOS PAGOS
// ============================================================

const ETIQUETA_SEMAFORO = {
  verde: "Vas bien",
  amarillo: "Al límite",
  rojo: "Te vas a pasar",
  gris: "Ningún ingreso cae en este ciclo"
};

function renderizarBalanceDelCiclo() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();
  const contenedor = document.getElementById("contenedorBalanceCiclo");

  const ingresosDelCiclo = calcularIngresosDelCiclo(ciclo, datos);
  const compromisosPendientes = calcularCompromisosPendientesDelCiclo(ciclo, datos);
  const disponibleReal = calcularDisponibleReal(ciclo, datos);
  const proyeccionCierre = calcularProyeccionDeCierre(ciclo, datos);
  const color = calcularColorDelSemaforo(proyeccionCierre, ingresosDelCiclo);
  const rango = calcularRangoDeDiasDelCiclo(ciclo);

  // El margen solo tiene sentido con ingreso ya capturado (si no, no hay
  // nada contra qué medir la holgura). En rojo ya no hay margen que
  // mostrar hacia adelante, así que se avisa que ya se cruzó el 100%.
  let margenHTML = "";
  if (ingresosDelCiclo > 0) {
    const margen = calcularMargenAntesDeUmbrales(proyeccionCierre, ingresosDelCiclo);
    if (color === "rojo") {
      margenHTML = "<p class=\"detalle\">Ya se pasó del 100% del ingreso proyectado.</p>";
    } else if (color === "amarillo") {
      margenHTML = "<p class=\"detalle\">Margen antes de rojo: " + formatearMoneda(margen.antesDeRojo) + "</p>";
    } else {
      margenHTML = "<p class=\"detalle\">Margen antes de amarillo: " + formatearMoneda(margen.antesDeAmarillo) + "</p>";
    }
  }

  const proximoCambio = ingresosDelCiclo > 0 ? calcularProximoCambioDeColor(calcularTrayectoriaDelSemaforo(ciclo, datos)) : null;
  const proximoCambioHTML = proximoCambio
    ? "<p class=\"pista\">Si sigues a este ritmo, se pondría " + proximoCambio.color + " el " + proximoCambio.fechaISO + ".</p>"
    : "";

  contenedor.innerHTML =
    "<div class=\"monto-grande\">" + formatearMoneda(disponibleReal) + "</div>" +
    "<div class=\"semaforo semaforo-" + color + "\">" + ETIQUETA_SEMAFORO[color] + "</div>" +
    "<p class=\"detalle\">Libre para gastar en lo que queda del ciclo</p>" +
    "<p class=\"detalle\">Ingresos del ciclo: " + formatearMoneda(ingresosDelCiclo) + "</p>" +
    "<p class=\"detalle\">Compromisos pendientes: " + formatearMoneda(compromisosPendientes) + "</p>" +
    "<p class=\"detalle\">Presupuesto variable por gastar: " +
      formatearMoneda(calcularPresupuestoVariablePendiente(ciclo, datos)) + "</p>" +
    "<p class=\"detalle\">Proyección de cierre: " + formatearMoneda(proyeccionCierre) + "</p>" +
    margenHTML +
    proximoCambioHTML +
    "<p class=\"pista\">" + ciclo.fechaInicio + " a " + ciclo.fechaFin +
      " — día " + rango.diasTranscurridos + " de " + rango.diasTotales + "</p>";
}

// ============================================================
// ESTUDIO — GRÁFICA DE TRAYECTORIA DEL SEMÁFORO
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
