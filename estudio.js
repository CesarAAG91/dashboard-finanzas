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
// Cómo se dibuja, y por qué así
// ------------------------------------------------------------
//
// Esta pantalla NO se lee de arriba abajo: se escanea. La primera
// versión aplicó el sistema de la primera pantalla al pie de la letra
// (sin recuadros, el color solo como semáforo, mucho texto explicando
// cada bloque) y el usuario la rechazó con un diagnóstico exacto: "se
// me pierde todo, nada está encerrado, y llega un momento en que haces
// scroll y no sabes qué estás viendo".
//
// De ahí las cuatro reglas de este archivo:
//
//   1. TODO VA ENCERRADO. Cada sección es un panel con cabecera propia;
//      cada bloque de adentro, su propia caja.
//   2. EL COLOR IDENTIFICA. Se usa obtenerColorDeCategoria, la misma
//      paleta de ocho tonos que ya usa Captura. El semáforo sigue
//      significando estado y nada más: son dos usos que no se pisan.
//   3. SE VE, NO SE EXPLICA. Nada de párrafos describiendo lo que hace
//      cada bloque. Lo que necesite explicación va en un title.
//   4. SIEMPRE SE SABE DÓNDE SE ESTÁ. El índice de secciones vive en la
//      barra pegajosa y se ilumina solo con el scroll.
//
// ------------------------------------------------------------
// Dos reglas de fondo
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

// Las seis secciones, en orden. Una sola lista de la que salen el
// índice de arriba y los encabezados de cada panel: así no pueden
// decir cosas distintas.
const SECCIONES_DEL_ESTUDIO = [
  { numero: "01", id: "seccionCierre", nombre: "Cierre", pregunta: "¿Cómo va a terminar?" },
  { numero: "02", id: "seccionEstructura", nombre: "Estructura", pregunta: "¿En qué se me va?" },
  { numero: "03", id: "seccionRitmo", nombre: "Ritmo", pregunta: "¿Cuándo se me va?" },
  { numero: "04", id: "seccionFrentes", nombre: "Frentes", pregunta: "¿A quién le pago?" },
  { numero: "05", id: "seccionHorizonte", nombre: "Horizonte", pregunta: "¿Cuándo me libero?" },
  { numero: "06", id: "seccionComparativo", nombre: "Comparativo", pregunta: "¿Voy mejor o peor?" }
];

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
// ESTUDIO — PIEZAS DE DIBUJO
// ============================================================
//
// El puñado de piezas con las que se arman las seis secciones. Están
// juntas para que una ficha de cifra se vea igual en las seis, y no
// cada una a su manera.

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

// Moneda corta para las gráficas, donde no cabe "$12,345.00" y el
// centavo no aporta nada: $12.3k.
function formatearMonedaCorta(monto) {
  const absoluto = Math.abs(monto);
  if (absoluto >= 1000) {
    return "$" + (monto / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return "$" + Math.round(monto);
}

// La cabecera de un panel. El número va en su recuadro y el cuerpo se
// abre aparte, para que cada sección quede visiblemente cerrada.
function htmlDeEncabezadoDeSeccion(seccion) {
  return "<header class=\"encabezado-seccion\">" +
    "<span class=\"numero-seccion\">" + seccion.numero + "</span>" +
    "<h2 class=\"titulo-seccion\">" + escaparHTML(seccion.nombre) + "</h2>" +
    "<p class=\"pregunta-seccion\">" + escaparHTML(seccion.pregunta) + "</p>" +
  "</header>";
}

// Una ficha de cifra: etiqueta chica arriba, cifra grande abajo. Nada
// más. Si hace falta un pie, es un dato, no una explicación.
//
// opciones: { pie, tono, barra: {valor, color}, chica, titulo }
function htmlDeFicha(etiqueta, valor, opciones) {
  const config = opciones || {};
  const tono = config.tono ? " " + config.tono : "";
  const chica = config.chica ? " chica" : "";
  const titulo = config.titulo ? " title=\"" + escaparHTML(config.titulo) + "\"" : "";

  let barra = "";
  if (config.barra) {
    const ancho = Math.min(Math.max(config.barra.valor, 0), 1) * 100;
    barra = "<div class=\"barra-ficha\"><div style=\"width: " + ancho.toFixed(1) +
      "%; background-color: " + config.barra.color + ";\"></div></div>";
  }

  return "<div class=\"ficha\"" + titulo + ">" +
      "<span class=\"etiqueta-ficha\">" + escaparHTML(etiqueta) + "</span>" +
      "<span class=\"valor-ficha" + tono + chica + "\">" + valor + "</span>" +
      barra +
      (config.pie ? "<span class=\"pie-ficha\">" + escaparHTML(config.pie) + "</span>" : "") +
    "</div>";
}

// Un bloque interior con su propio recuadro y su título chico.
function htmlDeBloque(titulo, contenido) {
  return "<div class=\"bloque\">" +
      (titulo ? "<span class=\"titulo-bloque\">" + escaparHTML(titulo) + "</span>" : "") +
      contenido +
    "</div>";
}

// El estado vacío: una línea, centrada, y ya. La versión anterior
// explicaba en tres renglones qué iba a aparecer ahí algún día, que es
// justo el texto que sobraba.
function htmlDeEstadoVacio(queFalta) {
  return "<p class=\"estado-vacio\">" + escaparHTML(queFalta) + "</p>";
}

// El punto de color de una categoría, con el mismo tono que ya usa
// Captura. Es la pieza que hace legible todo lo demás: se aprende
// "azul = Comida" una vez y después se lee cualquier gráfica sin
// leyenda.
function htmlDePuntoDeCategoria(categoriaId, datos) {
  return "<span class=\"punto-categoria\" style=\"background-color: " +
    obtenerColorDeCategoria(categoriaId, datos) + ";\"></span>";
}

// Una tabla siempre envuelta: si no cabe, hace scroll ella sola y la
// página nunca se mueve de lado.
function htmlDeTabla(encabezados, cuerpo, clase) {
  return "<div class=\"envoltura-tabla\">" +
      "<table class=\"tabla-estudio " + (clase || "") + "\">" +
        "<thead><tr>" + encabezados + "</tr></thead>" +
        "<tbody>" + cuerpo + "</tbody>" +
      "</table>" +
    "</div>";
}

// El tono semántico de una proporción gastada contra un presupuesto.
// Verde hasta el 90%, ámbar hasta el 100%, rojo pasando. Son los mismos
// umbrales del semáforo del ciclo, para que la app no tenga dos ideas
// distintas de "vas bien".
function tonoDeProporcion(proporcion) {
  if (proporcion > UMBRAL_SEMAFORO_AMARILLO) { return "mal"; }
  if (proporcion > UMBRAL_SEMAFORO_VERDE) { return "cuidado"; }
  return "bien";
}

// ============================================================
// ESTUDIO — BARRA DE CONTROL E ÍNDICE
// ============================================================

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

// El estado del ciclo, como pastilla corta. Antes era un renglón largo
// con las dos fechas y el conteo de días; ahora las fechas viven en el
// title, porque lo que hay que saber de un vistazo es si el ciclo ya
// cerró o sigue corriendo.
function describirSituacionDelCiclo(ciclo) {
  const situacion = calcularSituacionDelCiclo(ciclo);
  const rango = calcularRangoDeDiasDelCiclo(ciclo);

  if (situacion === "cerrado") {
    return { texto: "Cerrado", clase: "es-cerrado" };
  }
  if (situacion === "porVenir") {
    return { texto: "Por venir", clase: "" };
  }
  return {
    texto: "Día " + rango.diasTranscurridos + " de " + rango.diasTotales,
    clase: "es-encurso"
  };
}

function renderizarBarraDelEstudio() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const ciclos = obtenerCiclosDelEstudio(datos);
  const posicion = ciclos.findIndex(function (c) { return c.id === ciclo.id; });

  document.getElementById("nombreCicloEstudio").textContent = nombrarCicloDelEstudio(ciclo);

  const situacion = describirSituacionDelCiclo(ciclo);
  const insignia = document.getElementById("estadoCicloEstudio");
  insignia.textContent = situacion.texto;
  insignia.className = situacion.clase;
  insignia.title = ciclo.fechaInicio + " a " + ciclo.fechaFin;

  // Los botones se apagan en los extremos en vez de desaparecer: un
  // control que se va y vuelve mueve todo lo que tiene al lado.
  document.getElementById("cicloEstudioAnterior").disabled = posicion <= 0;
  document.getElementById("cicloEstudioSiguiente").disabled = posicion >= ciclos.length - 1;

  document.querySelectorAll("#zonaAnalisis .opcion-lente").forEach(function (boton) {
    const lente = boton.getAttribute("data-lente");
    const estaActiva = lente === lenteDelEstudio;
    boton.classList.toggle("activa", estaActiva);
    boton.setAttribute("aria-pressed", estaActiva ? "true" : "false");
    // La explicación de la lente vive aquí, no en un párrafo debajo.
    boton.title = EXPLICACION_DE_LA_LENTE[lente];
  });

  // El índice. Se dibuja una sola vez: los botones no cambian.
  const indice = document.getElementById("indiceSecciones");
  if (indice.children.length === 0) {
    indice.innerHTML = SECCIONES_DEL_ESTUDIO.map(function (seccion) {
      return "<button type=\"button\" class=\"paso-indice\" data-seccion=\"" + seccion.id + "\">" +
          "<span class=\"cifra-paso\">" + seccion.numero + "</span>" +
          "<span>" + escaparHTML(seccion.nombre) + "</span>" +
        "</button>";
    }).join("");

    indice.querySelectorAll(".paso-indice").forEach(function (boton) {
      boton.addEventListener("click", function () {
        const destino = document.getElementById(boton.getAttribute("data-seccion"));
        if (destino) { destino.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    });
  }

  // Arriba se puede estar simulando un pago a meses. El estudio no lo
  // mide — mide lo que pasó — así que se avisa en vez de dejar que los
  // números de las dos pantallas se contradigan en silencio.
  //
  // La pregunta NO es haySimulacionEnCurso(): esa siempre es verdadera,
  // porque la primera pantalla mantiene una simulación viva de base. Lo
  // que importa es si algo se movió.
  const aviso = document.getElementById("avisoSimulacionEstudio");
  if (calcularCambiosDeLaSimulacion().total > 0) {
    aviso.innerHTML = "<p class=\"aviso-estudio\">Arriba hay una simulación abierta. El estudio mide lo real.</p>";
  } else {
    aviso.innerHTML = "";
  }
}

// Ilumina en el índice la sección que se está viendo. Se engancha una
// sola vez, sobre los <section> que nunca se destruyen (solo cambia su
// innerHTML), así que no hay que volver a engancharlo en cada dibujado.
function activarIndiceDelEstudio() {
  if (typeof IntersectionObserver !== "function") {
    return;
  }

  const observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) { return; }
      document.querySelectorAll("#indiceSecciones .paso-indice").forEach(function (boton) {
        boton.classList.toggle("activo", boton.getAttribute("data-seccion") === entrada.target.id);
      });
    });
  }, {
    // La franja de detección va en el tercio superior de la pantalla,
    // justo debajo de la barra pegajosa: es donde el ojo está leyendo.
    rootMargin: "-130px 0px -65% 0px"
  });

  SECCIONES_DEL_ESTUDIO.forEach(function (seccion) {
    const nodo = document.getElementById(seccion.id);
    if (nodo) { observador.observe(nodo); }
  });
}

// El dibujado completo de la segunda pantalla. arranque.js llama a esta
// y solo a esta: qué secciones existen es asunto de este archivo.
function renderizarEstudioDelCiclo() {
  renderizarBarraDelEstudio();
  renderizarCierreDelCiclo();
  renderizarEstructuraDelCiclo();
  renderizarRitmoDelCiclo();
  renderizarFrentesDelCiclo();
  renderizarHorizonteDelCiclo();
  renderizarComparativoDelCiclo();
  renderizarMovimientosDelCiclo();
}

// ============================================================
// ESTUDIO — §1 CIERRE
// ============================================================
//
// El veredicto, y de qué está hecho. A la izquierda la cifra que manda;
// a la derecha la regla del ingreso — una barra cuyo 100% es lo que
// entró, partida en los pedazos del gasto, con la cola vacía como lo
// que sobra. Es una barra y no una dona porque el ojo compara largos
// bien y ángulos mal.

const PEDAZOS_DE_LA_REGLA = [
  { clave: "fijo", nombre: "Fijo pagado" },
  { clave: "fijoPendiente", nombre: "Fijo por pagar" },
  { clave: "variablePresupuestado", nombre: "Variable" },
  { clave: "discrecional", nombre: "Discrecional" }
];

function htmlDeLaReglaDelIngreso(resumen) {
  if (!resumen.hayIngreso) {
    return htmlDeEstadoVacio("Sin ingreso capturado en este ciclo.");
  }

  const comprometidoTotal = resumen.fijo + resumen.fijoPendiente +
    resumen.variablePresupuestado + resumen.discrecional;
  // Cuando el ciclo se pasa, los tramos se escalan contra lo gastado y
  // aparece la marca del 100%. Si se escalaran siempre contra el
  // ingreso, la barra se saldría de su caja y no se vería cuánto se
  // pasó, que es justo el dato.
  const base = Math.max(comprometidoTotal, resumen.ingreso);
  const seExcedio = comprometidoTotal > resumen.ingreso;

  const tramos = PEDAZOS_DE_LA_REGLA.map(function (pedazo) {
    const monto = resumen[pedazo.clave];
    if (monto <= 0) { return ""; }
    return "<div class=\"tramo-regla tramo-" + pedazo.clave + "\"" +
      " style=\"width: " + ((monto / base) * 100).toFixed(3) + "%;\"" +
      " title=\"" + escaparHTML(pedazo.nombre + ": " + formatearMoneda(monto)) + "\"></div>";
  }).join("");

  const marca = seExcedio
    ? "<div class=\"marca-ingreso\" style=\"left: " + ((resumen.ingreso / base) * 100).toFixed(3) + "%;\">" +
        "<span>ingreso</span></div>"
    : "";

  const leyenda = PEDAZOS_DE_LA_REGLA.filter(function (pedazo) {
    return resumen[pedazo.clave] > 0;
  }).map(function (pedazo) {
    return "<div class=\"item-leyenda-regla\">" +
        "<span class=\"marca-leyenda marca-" + pedazo.clave + "\"></span>" +
        "<span class=\"nombre-leyenda\">" + pedazo.nombre + "</span>" +
        "<span class=\"monto-leyenda\">" + formatearMoneda(resumen[pedazo.clave]) + "</span>" +
      "</div>";
  }).join("");

  return "<div class=\"barra-regla\">" + tramos + marca + "</div>" +
    "<div class=\"leyenda-regla\">" + leyenda + "</div>";
}

// La cifra protagonista. La proyección de cierre solo existe bajo la
// lente de caja, y llama a calcularProyeccionDeCierre — la MISMA
// función que alimenta el semáforo. Escribir aquí un segundo pronóstico
// daría dos números distintos para la misma pregunta en la misma app.
function htmlDelVeredicto(resumen, ciclo, datos) {
  const cerro = resumen.situacion === "cerrado";
  const tono = resumen.remanente < 0 ? " mal" : "";

  if (resumen.situacion === "porVenir") {
    return "<div class=\"panel-veredicto\">" +
        "<span class=\"etiqueta-ficha\">Ingreso previsto</span>" +
        "<span class=\"cifra-cierre\">" + formatearMoneda(resumen.ingreso) + "</span>" +
      "</div>";
  }

  let proyectado = "";
  if (!cerro && lenteDelEstudio === LENTE_CAJA && resumen.hayIngreso) {
    const remanenteProyectado = resumen.ingreso - calcularProyeccionDeCierre(ciclo, datos);
    proyectado = "<div class=\"renglon-proyectado\" title=\"Si el ritmo no cambia. Es el mismo cálculo que usa el semáforo de arriba.\">" +
        "<span class=\"etiqueta-ficha\">Cerraría con</span>" +
        "<span class=\"cifra-proyectada" + (remanenteProyectado < 0 ? " mal" : "") + "\">" +
          formatearMoneda(remanenteProyectado) + "</span>" +
      "</div>";
  }

  return "<div class=\"panel-veredicto\">" +
      "<span class=\"etiqueta-ficha\">" + (cerro ? "Cerró con" : "Va sobrando") + "</span>" +
      "<span class=\"cifra-cierre" + tono + "\">" + formatearMoneda(resumen.remanente) + "</span>" +
      proyectado +
    "</div>";
}

// Las fichas del cierre: las dos tasas y la comparación contra el ciclo
// anterior. Todas con su barra cuando la proporción significa algo.
function htmlDeLasFichasDelCierre(resumen, ciclo, datos) {
  const fichas = [];

  if (resumen.hayIngreso) {
    fichas.push(htmlDeFicha("Tasa de compromiso", formatearPorcentaje(resumen.tasaDeCompromiso), {
      pie: formatearMoneda(resumen.montoComprometidoDelCiclo) + " comprometido",
      barra: { valor: resumen.tasaDeCompromiso, color: "#6d28d9" },
      titulo: "Cuánto del ingreso ya estaba comprometido antes de empezar el ciclo. No cambia con la lente."
    }));

    fichas.push(htmlDeFicha(
      resumen.situacion === "cerrado" ? "Tasa de ahorro" : "Tasa de ahorro, por ahora",
      formatearPorcentaje(resumen.tasaDeAhorro),
      {
        pie: formatearMoneda(resumen.ingreso) + " de ingreso",
        barra: { valor: Math.max(resumen.tasaDeAhorro, 0), color: "#34d399" },
        tono: resumen.tasaDeAhorro < 0 ? "mal" : "bien"
      }
    ));
  }

  const anterior = obtenerCicloAnteriorCerrado(ciclo, datos);
  if (anterior) {
    const resumenAnterior = resumirCicloCompleto(anterior, datos, lenteDelEstudio);
    const variacion = calcularVariacion(resumen.gastadoTotal, resumenAnterior.gastadoTotal);
    // Si el ciclo va a medias, la comparación favorece al que está en
    // curso: le faltan días de gasto. Se dice en el title, que es donde
    // va lo que hay que saber pero no hay que leer siempre.
    const incompleto = resumen.situacion === "enCurso"
      ? " Este ciclo va en el " + formatearPorcentaje(calcularAvanceDelCiclo(ciclo)) +
        " y el anterior está completo."
      : "";
    fichas.push(htmlDeFicha("vs. " + nombrarCicloDelEstudio(anterior), formatearVariacion(variacion.enPesos), {
      pie: variacion.enPorcentaje === null ? "gastado" : formatearPorcentaje(variacion.enPorcentaje) + " gastado",
      tono: variacion.enPesos > 0 ? "cuidado" : "bien",
      chica: true,
      titulo: "Diferencia en lo gastado contra el ciclo anterior cerrado." + incompleto
    }));
  }

  const serie = calcularSerieDeCiclosCerrados(datos, lenteDelEstudio)
    .filter(function (r) { return r.cicloId !== ciclo.id; });
  const estadistica = calcularEstadisticaDeSerie(serie.map(function (r) { return r.gastadoTotal; }));
  if (estadistica.promedio !== null) {
    const variacion = calcularVariacion(resumen.gastadoTotal, estadistica.promedio);
    fichas.push(htmlDeFicha("vs. promedio", formatearVariacion(variacion.enPesos), {
      pie: estadistica.n + " ciclos cerrados",
      tono: variacion.enPesos > 0 ? "cuidado" : "bien",
      chica: true
    }));
  }

  return "<div class=\"fila-fichas\">" + fichas.join("") + "</div>";
}

function renderizarCierreDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const resumen = resumirCicloCompleto(ciclo, datos, lenteDelEstudio);

  document.getElementById("seccionCierre").innerHTML =
    htmlDeEncabezadoDeSeccion(SECCIONES_DEL_ESTUDIO[0]) +
    "<div class=\"cuerpo-seccion\">" +
      "<div class=\"cuerpo-cierre\">" +
        htmlDelVeredicto(resumen, ciclo, datos) +
        htmlDeBloque("En qué se repartió el ingreso", htmlDeLaReglaDelIngreso(resumen)) +
      "</div>" +
      "<div style=\"margin-top: 16px;\">" + htmlDeLasFichasDelCierre(resumen, ciclo, datos) + "</div>" +
    "</div>";
}

// ============================================================
// ESTUDIO — §2 ESTRUCTURA
// ============================================================
//
// La tabla de en qué se fue el dinero, ordenada de mayor a menor con la
// barra de cada categoría en su color. La primera fila es siempre la
// que hay que mirar, y eso lo hace el orden.

// Qué categorías están desplegadas. Vive fuera de la función de dibujado
// para que sobreviva a renderizarTodo() — si no, cada gasto capturado
// cerraría todo lo que el usuario había abierto.
const categoriasDesplegadasDelEstudio = {};

function alternarCategoriaDelEstudio(claveCategoria) {
  categoriasDesplegadasDelEstudio[claveCategoria] = !categoriasDesplegadasDelEstudio[claveCategoria];
  renderizarEstructuraDelCiclo();
}

// La barra de presupuesto con su marca de ritmo. Sin la marca, una barra
// al 60% no se puede juzgar: el día 5 es alarma y el día 25 es ir bien.
function htmlDeBarraDePresupuesto(fila, avanceDelCiclo) {
  if (fila.presupuestoDelCiclo === null || fila.presupuestoDelCiclo <= 0) {
    return "<span class=\"sin-dato\">sin presupuesto</span>";
  }

  const proporcion = fila.gastadoDeLaBolsa / fila.presupuestoDelCiclo;
  const tono = tonoDeProporcion(proporcion);

  return "<div class=\"barra-presupuesto\" title=\"" +
      escaparHTML(formatearMoneda(fila.gastadoDeLaBolsa) + " de " + formatearMoneda(fila.presupuestoDelCiclo)) + "\">" +
      "<div class=\"relleno-presupuesto " + tono + "\" style=\"width: " +
        (Math.min(proporcion, 1) * 100).toFixed(2) + "%;\"></div>" +
      "<div class=\"marca-ritmo\" style=\"left: " + (avanceDelCiclo * 100).toFixed(2) + "%;\"" +
        " title=\"Vas en el " + Math.round(avanceDelCiclo * 100) + "% del ciclo\"></div>" +
    "</div>" +
    "<span class=\"pie-barra\">" + formatearPorcentaje(proporcion) + " de " +
      formatearMonedaCorta(fila.presupuestoDelCiclo) + "</span>";
}

function htmlDeFilaDeCategoria(fila, avanceDelCiclo, mayorTotal, datos) {
  const clave = fila.categoriaId || CATEGORIA_SIN_CLASIFICAR;
  const estaAbierta = Boolean(categoriasDesplegadasDelEstudio[clave]);
  const color = obtenerColorDeCategoria(fila.categoriaId, datos);

  const subfilas = estaAbierta ? fila.subcategorias.map(function (sub) {
    const fueraDeBolsa = (fila.esVariableSemanal && !sub.consumeLaBolsa)
      ? "<span class=\"marca-chica\" title=\"Se registra y se analiza, pero no consume la bolsa semanal\">fuera del presupuesto</span>"
      : "";
    return "<tr class=\"fila-subcategoria\">" +
      "<td class=\"celda-nombre\">" + escaparHTML(sub.nombre) + fueraDeBolsa + "</td>" +
      "<td class=\"celda-cifra\">" + formatearMoneda(sub.total) + "</td>" +
      "<td class=\"celda-proporcion\"></td>" +
      "<td class=\"celda-cifra secundaria\">" + sub.conteo + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearMoneda(sub.ticketPromedio) + "</td>" +
      "<td class=\"celda-presupuesto\"></td>" +
    "</tr>";
  }).join("") : "";

  const proporcion = mayorTotal > 0 ? (fila.total / mayorTotal) * 100 : 0;

  return "<tr class=\"fila-categoria" + (estaAbierta ? " abierta" : "") + "\"" +
      " data-categoria=\"" + escaparHTML(clave) + "\">" +
      "<td class=\"celda-nombre\">" +
        "<span class=\"chevron-categoria\" aria-hidden=\"true\">›</span>" +
        htmlDePuntoDeCategoria(fila.categoriaId, datos) +
        escaparHTML(fila.nombre) +
      "</td>" +
      "<td class=\"celda-cifra fuerte\">" + formatearMoneda(fila.total) + "</td>" +
      "<td class=\"celda-proporcion\">" +
        "<div class=\"barra-proporcion\"><div style=\"width: " + proporcion.toFixed(2) +
          "%; background-color: " + color + ";\"></div></div>" +
        "<span class=\"pie-barra\">" + formatearPorcentaje(fila.parteDelIngreso) + " del ingreso</span>" +
      "</td>" +
      "<td class=\"celda-cifra secundaria\">" + fila.conteo + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearMoneda(fila.ticketPromedio) + "</td>" +
      "<td class=\"celda-presupuesto\">" +
        (fila.esVariableSemanal ? htmlDeBarraDePresupuesto(fila, avanceDelCiclo) : "<span class=\"sin-dato\">—</span>") +
      "</td>" +
    "</tr>" + subfilas;
}

function renderizarEstructuraDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionEstructura");

  const resumen = resumirCicloCompleto(ciclo, datos, lenteDelEstudio);
  const filas = calcularGastoPorCategoriaDelCiclo(ciclo, datos, lenteDelEstudio);
  const avance = calcularAvanceDelCiclo(ciclo);
  const encabezado = htmlDeEncabezadoDeSeccion(SECCIONES_DEL_ESTUDIO[1]);

  if (filas.length === 0) {
    seccion.innerHTML = encabezado + "<div class=\"cuerpo-seccion\">" +
      htmlDeEstadoVacio("Sin gastos registrados en este ciclo.") + "</div>";
    return;
  }

  const fijoTotal = resumen.fijo + resumen.fijoPendiente;
  const total = fijoTotal + resumen.variablePresupuestado + resumen.discrecional;
  const fichas = "<div class=\"fila-fichas\">" +
    htmlDeFicha("Fijo", formatearMoneda(fijoTotal), {
      pie: formatearPorcentaje(total > 0 ? fijoTotal / total : 0) + " del gasto",
      barra: { valor: total > 0 ? fijoTotal / total : 0, color: "#6d28d9" },
      titulo: "Compromisos del ciclo, pagados y por pagar"
    }) +
    htmlDeFicha("Variable presupuestado", formatearMoneda(resumen.variablePresupuestado), {
      pie: formatearPorcentaje(total > 0 ? resumen.variablePresupuestado / total : 0) + " del gasto",
      barra: { valor: total > 0 ? resumen.variablePresupuestado / total : 0, color: "#a78bfa" },
      titulo: "Gasto libre que consume una bolsa semanal"
    }) +
    htmlDeFicha("Discrecional", formatearMoneda(resumen.discrecional), {
      pie: formatearPorcentaje(total > 0 ? resumen.discrecional / total : 0) + " del gasto",
      barra: { valor: total > 0 ? resumen.discrecional / total : 0, color: "#ddd6fe" },
      titulo: "Gasto libre que ninguna bolsa cubre"
    }) +
  "</div>";

  const mayorTotal = filas[0].total;
  const encabezados =
    "<th>Categoría</th>" +
    "<th class=\"celda-cifra\">Gastado</th>" +
    "<th class=\"celda-proporcion\">Peso</th>" +
    "<th class=\"celda-cifra\">Movs.</th>" +
    "<th class=\"celda-cifra\">Ticket</th>" +
    "<th class=\"celda-presupuesto\">Contra el presupuesto</th>";

  const cuerpo = filas.map(function (fila) {
    return htmlDeFilaDeCategoria(fila, avance, mayorTotal, datos);
  }).join("");

  seccion.innerHTML = encabezado +
    "<div class=\"cuerpo-seccion\">" +
      fichas +
      "<div style=\"margin-top: 16px;\">" +
        htmlDeBloque(null, htmlDeTabla(encabezados, cuerpo, "tabla-categorias")) +
      "</div>" +
    "</div>";

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
// Cuándo se va el dinero, a tres resoluciones: por semana, por día de
// la semana y día por día. Las barras de cada semana van apiladas por
// categoría en sus colores, así que no solo se ve qué semana fue cara
// sino de qué estuvo hecha.

const DIAS_EN_ORDEN_DE_LECTURA = [
  { indice: 1, nombre: "Lun" },
  { indice: 2, nombre: "Mar" },
  { indice: 3, nombre: "Mié" },
  { indice: 4, nombre: "Jue" },
  { indice: 5, nombre: "Vie" },
  { indice: 6, nombre: "Sáb" },
  { indice: 0, nombre: "Dom" }
];

// Una dona: anillo de segmentos proporcionales, con la cifra en el
// centro. Se dibuja en SVG a mano, sin librerías, como el resto de las
// gráficas de la app.
//
// Cuándo SÍ va una dona, después de haberlas descartado en julio: aquí
// la pregunta es de parte sobre todo dentro de UNA semana ("¿de qué
// está hecha?"), que es justo lo que una dona contesta bien. Lo que una
// dona hace mal — comparar magnitudes entre varias — aquí no se le
// pide: eso lo resuelve la cifra del centro, que es un número y se lee
// exacto.
//
// segmentos: [{ fraccion, color, etiqueta }]
function htmlDeUnaDona(segmentos, cifraCentral, pieCentral) {
  const RADIO = 40;
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

  // Sin nada que repartir se dibuja el anillo apagado, no un hueco: una
  // semana en cero es un dato, no un error.
  if (segmentos.length === 0) {
    return "<svg class=\"dona\" viewBox=\"0 0 100 100\" role=\"img\">" +
        "<circle class=\"aro-vacio\" cx=\"50\" cy=\"50\" r=\"" + RADIO + "\" fill=\"none\" stroke-width=\"13\"></circle>" +
        "<text class=\"cifra-dona apagada\" x=\"50\" y=\"50\">" + escaparHTML(cifraCentral) + "</text>" +
        (pieCentral ? "<text class=\"pie-dona\" x=\"50\" y=\"62\">" + escaparHTML(pieCentral) + "</text>" : "") +
      "</svg>";
  }

  // Los arcos se encadenan con stroke-dasharray: cada uno pinta su
  // trozo y deja el resto en blanco, y el dashoffset lo empuja a donde
  // le toca empezar. El grupo va rotado -90° para que el primer
  // segmento arranque arriba y no a las tres en punto.
  let recorrido = 0;
  const arcos = segmentos.map(function (segmento) {
    const largo = segmento.fraccion * CIRCUNFERENCIA;
    const arco = "<circle class=\"arco-dona\" cx=\"50\" cy=\"50\" r=\"" + RADIO + "\" fill=\"none\"" +
      " stroke=\"" + segmento.color + "\" stroke-width=\"13\"" +
      " stroke-dasharray=\"" + largo.toFixed(3) + " " + (CIRCUNFERENCIA - largo).toFixed(3) + "\"" +
      " stroke-dashoffset=\"" + (-recorrido).toFixed(3) + "\">" +
      "<title>" + escaparHTML(segmento.etiqueta) + "</title></circle>";
    recorrido += largo;
    return arco;
  }).join("");

  return "<svg class=\"dona\" viewBox=\"0 0 100 100\" role=\"img\">" +
      "<circle class=\"aro-vacio\" cx=\"50\" cy=\"50\" r=\"" + RADIO + "\" fill=\"none\" stroke-width=\"13\"></circle>" +
      "<g transform=\"rotate(-90 50 50)\">" + arcos + "</g>" +
      "<text class=\"cifra-dona\" x=\"50\" y=\"" + (pieCentral ? 48 : 53) + "\">" + escaparHTML(cifraCentral) + "</text>" +
      (pieCentral ? "<text class=\"pie-dona\" x=\"50\" y=\"61\">" + escaparHTML(pieCentral) + "</text>" : "") +
    "</svg>";
}

// Las cuatro semanas, una dona cada una: el anillo dice de qué está
// hecha y el centro cuánto fue. La semana en curso se marca con su aro.
function htmlDeLasCuatroSemanas(matriz, ciclo, datos) {
  const semanaDeHoy = calcularSituacionDelCiclo(ciclo) === "enCurso"
    ? calcularSemanaDeLaFecha(formatearFechaISO(new Date()), ciclo)
    : null;

  return "<div class=\"cuatro-semanas\">" + matriz.totalesPorSemana.map(function (semana) {
    const segmentos = semana.total > 0
      ? matriz.filas
          .filter(function (fila) { return fila.semanas[semana.numero - 1] > 0; })
          .map(function (fila) {
            const monto = fila.semanas[semana.numero - 1];
            return {
              fraccion: monto / semana.total,
              color: obtenerColorDeCategoria(fila.categoriaId, datos),
              etiqueta: fila.nombre + ": " + formatearMoneda(monto) +
                " (" + formatearPorcentaje(monto / semana.total) + ")"
            };
          })
      : [];

    const esActual = semanaDeHoy === semana.numero;

    return "<figure class=\"semana" + (esActual ? " es-actual" : "") + "\">" +
        htmlDeUnaDona(segmentos, formatearMonedaCorta(semana.total), formatearMonedaCorta(semana.porDia) + "/día") +
        "<figcaption>" +
          "<span class=\"nombre-semana\">Semana " + semana.numero +
            (esActual ? " · vas aquí" : "") + "</span>" +
          "<span class=\"monto-semana\">" + formatearMoneda(semana.total) + "</span>" +
          "<span class=\"detalle-semana\" title=\"" +
            escaparHTML(semana.fechaInicio + " a " + semana.fechaFin) + "\">" +
            semana.dias + " días</span>" +
        "</figcaption>" +
      "</figure>";
  }).join("") + "</div>" + htmlDeLaLeyendaDeCategorias(matriz.filas, datos);
}

// La leyenda de colores, una sola vez para las cuatro donas. Sin ella,
// una dona es un adorno: hay que poder saber qué es cada gajo.
function htmlDeLaLeyendaDeCategorias(filas, datos) {
  return "<div class=\"leyenda-categorias\">" + filas.map(function (fila) {
    return "<span class=\"item-leyenda-categoria\">" +
        htmlDePuntoDeCategoria(fila.categoriaId, datos) +
        escaparHTML(fila.nombre) +
      "</span>";
  }).join("") + "</div>";
}

// La matriz semana × categoría, como mapa de calor. Antes eran tubos
// con barras adentro, y con pocos datos se veían como una rejilla de
// cajas vacías. Un mapa de calor no tiene caja que llenar: la celda ES
// el dato, y la intensidad del color de la categoría dice cuánto.
//
// Cada renglón se mide contra su propia semana más cara, porque la
// pregunta es "¿cuándo se va ESTA categoría?" — con una escala común
// Transporte quedaría invisible al lado de Comida. El total del renglón
// va enfrente para que se vea de qué tamaño es esa escala.
function htmlDeLaMatrizDeSemanas(filas, datos) {
  const encabezados = "<th>Categoría</th>" +
    "<th class=\"celda-cifra\">Total</th>" +
    [1, 2, 3, 4].map(function (n) { return "<th class=\"celda-mapa\">Sem " + n + "</th>"; }).join("");

  const cuerpo = filas.map(function (fila) {
    const maximoDeLaFila = fila.semanas.reduce(function (max, v) { return Math.max(max, v); }, 0);
    const color = obtenerColorDeCategoria(fila.categoriaId, datos);

    const celdas = fila.semanas.map(function (monto, indice) {
      const bolsa = fila.bolsas[indice];
      const deLaBolsa = fila.semanasDeLaBolsa[indice];
      // El rojo compara contra la bolsa lo que DE VERDAD la consume, no
      // el total: si comparara el total, el Didi pondría en rojo una
      // semana de Transporte que no se pasó de gasolina.
      const seExcedio = bolsa !== null && bolsa > 0 && deLaBolsa > bolsa;

      if (monto <= 0) {
        return "<td class=\"celda-mapa\"><div class=\"casilla vacia\">—</div></td>";
      }

      // La intensidad arranca en 0.18 y no en 0: una celda con un gasto
      // chico tiene que verse, no desaparecer contra el fondo.
      const intensidad = maximoDeLaFila > 0 ? 0.18 + 0.82 * (monto / maximoDeLaFila) : 0.18;
      const explicacion = formatearMoneda(monto) +
        (bolsa !== null && bolsa > 0
          ? " · " + formatearMoneda(deLaBolsa) + " de la bolsa de " + formatearMoneda(bolsa)
          : "");

      return "<td class=\"celda-mapa\">" +
          "<div class=\"casilla" + (seExcedio ? " se-paso" : "") + "\"" +
            " style=\"background-color: " + color + "; opacity: " + intensidad.toFixed(3) + ";\"" +
            " title=\"" + escaparHTML(explicacion) + "\"></div>" +
          "<span class=\"cifra-casilla\">" + formatearMonedaCorta(monto) + "</span>" +
        "</td>";
    }).join("");

    return "<tr><td class=\"celda-nombre\">" +
        htmlDePuntoDeCategoria(fila.categoriaId, datos) + " " + escaparHTML(fila.nombre) +
      "</td>" +
      "<td class=\"celda-cifra fuerte\">" + formatearMoneda(fila.total) + "</td>" +
      celdas + "</tr>";
  }).join("");

  return htmlDeTabla(encabezados, cuerpo, "tabla-matriz");
}

// Los siete días. Barras sobre una línea base compartida, sin caja que
// las contenga: con la caja, un día flojo se veía como un hueco vacío
// en vez de como una barra chica.
function htmlDeLosDiasDeLaSemana(distribucion) {
  const maximo = distribucion.montos.reduce(function (max, v) { return Math.max(max, v); }, 0);
  if (maximo <= 0) { return ""; }

  return "<div class=\"barras-dias\">" + DIAS_EN_ORDEN_DE_LECTURA.map(function (dia) {
    const monto = distribucion.montos[dia.indice];
    const esPico = monto === maximo && monto > 0;
    // Mínimo visible: un día con gasto siempre deja marca, aunque sea
    // el 1% del pico. Un día en cero no dibuja nada, que es lo correcto.
    const alto = monto > 0 ? Math.max((monto / maximo) * 100, 3) : 0;

    // Un día sin gasto no dibuja barra. Con una barra mínima parecería
    // que algo pasó ese día, y no pasó nada.
    const barra = monto > 0
      ? "<div class=\"relleno-dia\" style=\"height: " + alto.toFixed(2) + "%;\"></div>"
      : "";

    return "<div class=\"columna-dia" + (esPico ? " es-pico" : "") + "\" title=\"" +
        escaparHTML(dia.nombre + ": " + formatearMoneda(monto) + " en " +
          distribucion.conteos[dia.indice] + " movimientos") + "\">" +
        "<div class=\"riel-dia\">" + barra + "</div>" +
        "<span class=\"nombre-dia\">" + dia.nombre + "</span>" +
        "<span class=\"monto-dia\">" + (monto > 0 ? formatearMonedaCorta(monto) : "—") + "</span>" +
      "</div>";
  }).join("") + "</div>";
}

function renderizarRitmoDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionRitmo");

  const matriz = calcularGastoPorSemanaYCategoria(ciclo, datos, lenteDelEstudio);
  const distribucion = calcularGastoPorDiaDeLaSemana(ciclo, datos, lenteDelEstudio);
  const encabezado = htmlDeEncabezadoDeSeccion(SECCIONES_DEL_ESTUDIO[2]);

  if (matriz.filas.length === 0) {
    seccion.innerHTML = encabezado + "<div class=\"cuerpo-seccion\">" +
      htmlDeEstadoVacio("Sin gastos registrados en este ciclo.") + "</div>";
    return;
  }

  seccion.innerHTML = encabezado +
    "<div class=\"cuerpo-seccion\">" +
      "<div class=\"rejilla-bloques\">" +
        htmlDeBloque("Las cuatro semanas del ciclo", htmlDeLasCuatroSemanas(matriz, ciclo, datos)) +
        htmlDeBloque("Semana por semana, categoría por categoría",
          htmlDeLaMatrizDeSemanas(matriz.filas, datos)) +
        htmlDeBloque("Por día de la semana", htmlDeLosDiasDeLaSemana(distribucion)) +
        htmlDeBloque("Día por día", "<div id=\"contenedorTrayectoriaSemaforo\"></div>") +
      "</div>" +
    "</div>";

  // La gráfica se dibuja después de que su contenedor existe: este
  // innerHTML acaba de destruir el anterior.
  renderizarTrayectoriaSemaforo();
}

// ============================================================
// ESTUDIO — §4 FRENTES
// ============================================================
//
// A quién le estoy pagando. Lo gastado sólido, lo que falta por pagar
// rayado, los dos contra el mismo máximo para que las barras de
// distintos frentes se comparen entre sí.

const frentesDesplegadosDelEstudio = {};

function alternarFrenteDelEstudio(clave) {
  frentesDesplegadosDelEstudio[clave] = !frentesDesplegadosDelEstudio[clave];
  renderizarFrentesDelCiclo();
}

function renderizarFrentesDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionFrentes");
  const frentes = calcularGastoPorDestinatario(ciclo, datos, lenteDelEstudio);
  const encabezado = htmlDeEncabezadoDeSeccion(SECCIONES_DEL_ESTUDIO[3]);

  const hayFrentesDeVerdad = frentes.some(function (f) { return !f.esSinAsignar; });
  if (!hayFrentesDeVerdad) {
    seccion.innerHTML = encabezado + "<div class=\"cuerpo-seccion\">" +
      htmlDeEstadoVacio("Ningún gasto de este ciclo tiene destinatario asignado.") + "</div>";
    return;
  }

  const maximo = frentes.reduce(function (max, f) { return Math.max(max, f.total); }, 0);

  const cuerpo = frentes.map(function (frente) {
    const abierto = Boolean(frentesDesplegadosDelEstudio[frente.clave]);

    const conceptos = abierto ? frente.conceptos.map(function (concepto) {
      const suma = concepto.gastado + concepto.porPagar;
      const marca = concepto.porPagar > 0 && concepto.gastado === 0
        ? "<span class=\"marca-chica\">por pagar</span>" : "";
      return "<tr class=\"fila-subcategoria\">" +
        "<td class=\"celda-nombre\">" + escaparHTML(concepto.nombre) + marca + "</td>" +
        "<td class=\"celda-cifra\">" + formatearMoneda(suma) + "</td>" +
        "<td class=\"celda-proporcion\"></td>" +
        "<td class=\"celda-cifra secundaria\">" + (concepto.conteo > 0 ? concepto.conteo : "—") + "</td>" +
      "</tr>";
    }).join("") : "";

    const anchoGastado = maximo > 0 ? (frente.gastado / maximo) * 100 : 0;
    const anchoPorPagar = maximo > 0 ? (frente.porPagar / maximo) * 100 : 0;
    const pie = frente.porPagar > 0
      ? formatearMoneda(frente.gastado) + " gastado · " + formatearMoneda(frente.porPagar) + " por pagar"
      : formatearPorcentaje(frente.parteDelIngreso) + " del ingreso";

    return "<tr class=\"fila-frente" + (frente.esSinAsignar ? " sin-asignar" : "") +
        (abierto ? " abierta" : "") + "\" data-frente=\"" + escaparHTML(frente.clave) + "\">" +
        "<td class=\"celda-nombre\">" +
          "<span class=\"chevron-categoria\" aria-hidden=\"true\">›</span>" +
          escaparHTML(frente.nombre) +
        "</td>" +
        "<td class=\"celda-cifra fuerte\">" + formatearMoneda(frente.total) + "</td>" +
        "<td class=\"celda-proporcion\">" +
          "<div class=\"barra-frente\">" +
            "<div class=\"parte-gastada\" style=\"width: " + anchoGastado.toFixed(2) + "%;\"></div>" +
            "<div class=\"parte-por-pagar\" style=\"width: " + anchoPorPagar.toFixed(2) + "%;\"></div>" +
          "</div>" +
          "<span class=\"pie-barra\">" + escaparHTML(pie) + "</span>" +
        "</td>" +
        "<td class=\"celda-cifra secundaria\">" + (frente.conteo > 0 ? frente.conteo : "—") + "</td>" +
      "</tr>" + conceptos;
  }).join("");

  const encabezados = "<th>Frente</th>" +
    "<th class=\"celda-cifra\">Total del ciclo</th>" +
    "<th class=\"celda-proporcion\">Gastado y por pagar</th>" +
    "<th class=\"celda-cifra\">Movs.</th>";

  seccion.innerHTML = encabezado +
    "<div class=\"cuerpo-seccion\">" +
      htmlDeBloque(null, htmlDeTabla(encabezados, cuerpo, "tabla-frentes")) +
    "</div>";

  seccion.querySelectorAll(".fila-frente").forEach(function (filaHTML) {
    filaHTML.addEventListener("click", function () {
      alternarFrenteDelEstudio(filaHTML.getAttribute("data-frente"));
    });
  });
}

// ============================================================
// ESTUDIO — §5 HORIZONTE
// ============================================================
//
// Deuda y crédito: lo único del presupuesto con fecha de caducidad
// conocida. La pieza que importa es la línea de liberación — no
// "cuánto debo" sino "cuándo me libero, y de cuánto al mes".

function htmlDeUnaDeuda(deuda) {
  const estado = calcularEstadoDeDeuda(deuda);
  const pagosRestantes = deuda.pagosTotales - deuda.pagosRealizados;
  const avance = deuda.pagosTotales > 0 ? deuda.pagosRealizados / deuda.pagosTotales : 0;

  // De dónde sale el saldo importa: uno lo dice el banco y el otro lo
  // deduce la app suponiendo que no hubo abonos a capital.
  const esDelBanco = deuda.saldoManual !== null && deuda.saldoManual !== undefined;
  const origen = esDelBanco
    ? "Saldo del banco al " + (deuda.fechaSaldoManual || "sin fecha")
    : "Calculado: " + pagosRestantes + " pagos × " + formatearMoneda(deuda.montoPorPago);

  return "<article class=\"tarjeta-deuda\">" +
      "<header class=\"cabeza-deuda\">" +
        "<span class=\"nombre-deuda\">" + escaparHTML(deuda.nombre) + "</span>" +
        "<span class=\"pagos-deuda\">" + deuda.pagosRealizados + " / " + deuda.pagosTotales + "</span>" +
      "</header>" +
      "<div class=\"barra-deuda\" title=\"" + escaparHTML(formatearPorcentaje(avance) + " pagado") + "\">" +
        "<div class=\"relleno-deuda\" style=\"width: " + (avance * 100).toFixed(2) + "%;\"></div>" +
      "</div>" +
      "<div class=\"datos-deuda\">" +
        "<div class=\"dato-deuda\" title=\"" + escaparHTML(origen) + "\">" +
          "<span class=\"etiqueta-ficha\">Falta</span>" +
          "<span class=\"cifra-deuda\">" + formatearMoneda(estado.saldoRestante) + "</span>" +
        "</div>" +
        "<div class=\"dato-deuda\" title=\"" +
            escaparHTML(formatearPorcentaje(estado.porcentajeSobrante, 1) + " sobre lo solicitado") + "\">" +
          "<span class=\"etiqueta-ficha\">Costo del crédito</span>" +
          "<span class=\"cifra-deuda\">" + formatearMoneda(estado.costoDelCredito) + "</span>" +
        "</div>" +
        "<div class=\"dato-deuda\">" +
          "<span class=\"etiqueta-ficha\">Se liquida</span>" +
          "<span class=\"cifra-deuda\">" + formatearFechaISO(estado.fechaLiquidacion) + "</span>" +
        "</div>" +
      "</div>" +
    "</article>";
}

// La línea de liberación: un hito por deuda, con la fecha a la
// izquierda y lo que suelta al mes a la derecha, en verde. Es una
// línea de tiempo, no una tabla, porque la pregunta es cuándo.
function htmlDeLaLineaDeLiberacion(eventos) {
  if (eventos.length === 0) { return ""; }

  return "<div class=\"linea-liberacion\">" + eventos.map(function (evento) {
    return "<div class=\"hito-liberacion\" title=\"" +
        escaparHTML("Acumulado al liquidarse: " + formatearMoneda(evento.acumuladoMensual) + "/mes") + "\">" +
        "<span class=\"fecha-hito\">" + escaparHTML(evento.fechaLiquidacion) + "</span>" +
        "<span class=\"nombre-hito\">" + escaparHTML(evento.nombre) + "</span>" +
        "<span class=\"suelta-hito\">+" + formatearMoneda(evento.mensualQueSeLibera) + "/mes</span>" +
      "</div>";
  }).join("") + "</div>";
}

function htmlDeLasTarjetas(tarjetas) {
  if (tarjetas.length === 0) { return ""; }

  const cuerpo = tarjetas.map(function (tarjeta) {
    const estado = tarjeta.pagado ? "Pagado" : (tarjeta.fechaDePago || "sin pago");
    const meses = tarjeta.comprasAMeses > 0
      ? "<span class=\"marca-chica\">" + tarjeta.comprasAMeses + " a meses</span>" : "";

    return "<tr>" +
      "<td class=\"celda-nombre\">" + escaparHTML(tarjeta.nombre) + meses + "</td>" +
      "<td class=\"celda-cifra fuerte\">" + formatearMoneda(tarjeta.pagoDelCiclo) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + escaparHTML(estado) + "</td>" +
      "<td class=\"celda-cifra\">" + formatearMoneda(tarjeta.compradoEnElCiclo) + "</td>" +
      "<td class=\"celda-cifra secundaria\" title=\"Informativa: nunca suma a lo disponible\">" +
        (tarjeta.lineaTotal > 0 ? formatearMoneda(tarjeta.lineaTotal) : "—") + "</td>" +
    "</tr>";
  }).join("");

  const encabezados = "<th>Tarjeta</th>" +
    "<th class=\"celda-cifra\">Pago del ciclo</th>" +
    "<th class=\"celda-cifra\">Estado</th>" +
    "<th class=\"celda-cifra\">Comprado</th>" +
    "<th class=\"celda-cifra\">Línea</th>";

  return htmlDeTabla(encabezados, cuerpo);
}

function renderizarHorizonteDelCiclo() {
  const datos = leerDatos();
  const ciclo = obtenerCicloDelEstudio();
  const seccion = document.getElementById("seccionHorizonte");

  const deudasActivas = datos.deudas.filter(function (deuda) { return deuda.activa; });
  const compromisoMensual = calcularCompromisoMensualFijo(datos);
  const liberacion = calcularCalendarioDeLiberacionDeFlujo(datos);
  const tarjetas = calcularUtilizacionDeTarjetas(ciclo, datos);
  const encabezado = htmlDeEncabezadoDeSeccion(SECCIONES_DEL_ESTUDIO[4]);

  if (deudasActivas.length === 0 && tarjetas.length === 0) {
    seccion.innerHTML = encabezado + "<div class=\"cuerpo-seccion\">" +
      htmlDeEstadoVacio("No hay deudas activas ni tarjetas dadas de alta.") + "</div>";
    return;
  }

  const totalLiberado = liberacion.length > 0
    ? liberacion[liberacion.length - 1].acumuladoMensual : 0;

  const fichas = "<div class=\"fila-fichas\">" +
    htmlDeFicha("Compromiso mensual fijo", formatearMoneda(compromisoMensual.total), {
      pie: "lo que sale antes de comer",
      titulo: "Deudas y recurrentes activos llevados a su equivalente mensual. No incluye el pago de las tarjetas, que no es fijo."
    }) +
    htmlDeFicha("De deuda", formatearMoneda(compromisoMensual.deDeudas), {
      pie: formatearPorcentaje(compromisoMensual.total > 0 ? compromisoMensual.deDeudas / compromisoMensual.total : 0) + " del piso",
      barra: {
        valor: compromisoMensual.total > 0 ? compromisoMensual.deDeudas / compromisoMensual.total : 0,
        color: "#f87171"
      },
      chica: true
    }) +
    htmlDeFicha("De recurrentes", formatearMoneda(compromisoMensual.deRecurrentes), {
      pie: formatearPorcentaje(compromisoMensual.total > 0 ? compromisoMensual.deRecurrentes / compromisoMensual.total : 0) + " del piso",
      barra: {
        valor: compromisoMensual.total > 0 ? compromisoMensual.deRecurrentes / compromisoMensual.total : 0,
        color: "#6d28d9"
      },
      chica: true
    }) +
    (totalLiberado > 0 ? htmlDeFicha("Se libera al terminar", "+" + formatearMoneda(totalLiberado), {
      pie: formatearPorcentaje(compromisoMensual.total > 0 ? totalLiberado / compromisoMensual.total : 0) + " del piso, al mes",
      tono: "bien",
      chica: true
    }) : "") +
  "</div>";

  const bloques = [];
  if (deudasActivas.length > 0) {
    bloques.push(htmlDeBloque("Cada deuda",
      "<div class=\"lista-deudas\">" + deudasActivas.map(htmlDeUnaDeuda).join("") + "</div>"));
    bloques.push(htmlDeBloque("Cuándo se libera el flujo", htmlDeLaLineaDeLiberacion(liberacion)));
  }
  if (tarjetas.length > 0) {
    bloques.push(htmlDeBloque("Tarjetas", htmlDeLasTarjetas(tarjetas)));
  }

  seccion.innerHTML = encabezado +
    "<div class=\"cuerpo-seccion\">" +
      fichas +
      "<div class=\"rejilla-bloques\" style=\"margin-top: 16px;\">" + bloques.join("") + "</div>" +
    "</div>";
}

// ============================================================
// ESTUDIO — §6 COMPARATIVO
// ============================================================
//
// Todo lo de aquí compara ciclos CERRADOS. Un ciclo en curso no se
// puede comparar contra uno completo sin mentir: le faltan días de
// gasto por suceder, así que siempre saldría "mejor". Entra igual a la
// tabla, pero marcado y fuera de todo promedio.

function htmlDeLaTablaDeCiclos(datos) {
  const cerrados = calcularSerieDeCiclosCerrados(datos, lenteDelEstudio);
  const cicloEnfocado = obtenerCicloDelEstudio();
  const enCurso = calcularSituacionDelCiclo(cicloEnfocado) === "enCurso"
    ? resumirCicloCompleto(cicloEnfocado, datos, lenteDelEstudio)
    : null;

  if (cerrados.length === 0) {
    return htmlDeEstadoVacio("Todavía no cierra ningún ciclo.");
  }

  const ciclos = obtenerCiclosDelEstudio(datos);

  function filaDe(resumen, ciclo, incompleto) {
    return "<tr class=\"" + (incompleto ? "fila-incompleta" : "") + "\">" +
      "<td class=\"celda-nombre\">" + escaparHTML(nombrarCicloDelEstudio(ciclo)) +
        (incompleto ? "<span class=\"marca-chica\">en curso</span>" : "") + "</td>" +
      "<td class=\"celda-cifra\">" + formatearMoneda(resumen.ingreso) + "</td>" +
      "<td class=\"celda-cifra\">" + formatearMoneda(resumen.fijo + resumen.fijoPendiente) + "</td>" +
      "<td class=\"celda-cifra\">" + formatearMoneda(resumen.variablePresupuestado) + "</td>" +
      "<td class=\"celda-cifra\">" + formatearMoneda(resumen.discrecional) + "</td>" +
      "<td class=\"celda-cifra fuerte" + (resumen.remanente < 0 ? " mal" : "") + "\">" +
        formatearMoneda(resumen.remanente) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearPorcentaje(resumen.tasaDeCompromiso) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearPorcentaje(resumen.tasaDeAhorro) + "</td>" +
    "</tr>";
  }

  const filas = cerrados.map(function (resumen) {
    return filaDe(resumen, ciclos.find(function (c) { return c.id === resumen.cicloId; }), false);
  }).join("") + (enCurso ? filaDe(enCurso, cicloEnfocado, true) : "");

  const estadistica = calcularEstadisticaDeSerie(cerrados.map(function (r) { return r.remanente; }));
  const promedio = estadistica.promedio !== null
    ? "<tr class=\"fila-promedio\">" +
        "<td class=\"celda-nombre\">Promedio de " + estadistica.n + "</td>" +
        "<td class=\"celda-cifra\" colspan=\"4\"></td>" +
        "<td class=\"celda-cifra fuerte\">" + formatearMoneda(estadistica.promedio) + "</td>" +
        "<td class=\"celda-cifra\" colspan=\"2\"></td>" +
      "</tr>"
    : "";

  const encabezados = "<th>Ciclo</th>" +
    "<th class=\"celda-cifra\">Ingreso</th>" +
    "<th class=\"celda-cifra\">Fijo</th>" +
    "<th class=\"celda-cifra\">Variable</th>" +
    "<th class=\"celda-cifra\">Discrecional</th>" +
    "<th class=\"celda-cifra\">Remanente</th>" +
    "<th class=\"celda-cifra\" title=\"Comprometido entre ingreso\">T. compr.</th>" +
    "<th class=\"celda-cifra\" title=\"Remanente entre ingreso\">T. ahorro</th>";

  return htmlDeTabla(encabezados, filas + promedio) +
    (estadistica.promedio === null
      ? "<span class=\"pie-barra\">El promedio aparece con " + CICLOS_MINIMOS_PARA_PROMEDIO +
        " ciclos cerrados; van " + estadistica.n + ".</span>"
      : "");
}

// Qué se movió, con barra de variación desde un eje central: a la
// derecha si subió, a la izquierda si bajó. El signo se ve antes de
// leer la cifra.
function htmlDeQueSeMovio(datos) {
  const ciclo = obtenerCicloDelEstudio();
  const anterior = obtenerCicloAnteriorCerrado(ciclo, datos);

  if (!anterior) {
    return htmlDeEstadoVacio("No hay un ciclo cerrado anterior contra el cual comparar.");
  }

  const movimientos = calcularQueSeMovio(ciclo, anterior, datos, lenteDelEstudio)
    .filter(function (m) { return Math.abs(m.variacionEnPesos) > 0.005; });

  if (movimientos.length === 0) {
    return htmlDeEstadoVacio("Ninguna categoría se movió entre los dos ciclos.");
  }

  const mayor = movimientos.reduce(function (max, m) {
    return Math.max(max, Math.abs(m.variacionEnPesos));
  }, 0);

  const cuerpo = movimientos.map(function (m) {
    const subio = m.variacionEnPesos > 0;
    const ancho = mayor > 0 ? (Math.abs(m.variacionEnPesos) / mayor) * 50 : 0;

    return "<tr>" +
      "<td class=\"celda-nombre\">" +
        htmlDePuntoDeCategoria(m.clave === CATEGORIA_SIN_CLASIFICAR ? null : m.clave, datos) +
        " " + escaparHTML(m.nombre) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearMoneda(m.antes) + "</td>" +
      "<td class=\"celda-cifra fuerte\">" + formatearMoneda(m.ahora) + "</td>" +
      "<td class=\"celda-variacion\">" +
        "<div class=\"barra-variacion\">" +
          "<div class=\"eje-variacion\"></div>" +
          "<div class=\"parte-variacion " + (subio ? "subio" : "bajo") + "\" style=\"width: " +
            ancho.toFixed(2) + "%;\"></div>" +
        "</div>" +
      "</td>" +
      "<td class=\"celda-cifra " + (subio ? "cuidado" : "bien") + "\">" +
        formatearVariacion(m.variacionEnPesos) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" +
        (m.variacionEnPorcentaje === null ? "nuevo" : formatearPorcentaje(m.variacionEnPorcentaje)) + "</td>" +
    "</tr>";
  }).join("");

  const encabezados = "<th>Categoría</th>" +
    "<th class=\"celda-cifra\">" + escaparHTML(nombrarCicloDelEstudio(anterior)) + "</th>" +
    "<th class=\"celda-cifra\">" + escaparHTML(nombrarCicloDelEstudio(ciclo)) + "</th>" +
    "<th class=\"celda-variacion\">Cambio</th>" +
    "<th class=\"celda-cifra\">En pesos</th>" +
    "<th class=\"celda-cifra\">En %</th>";

  // Comparar un ciclo a medias contra uno completo siempre da "bajaste",
  // y no es verdad: es que faltan días por gastar. Se muestra igual,
  // porque a media quincena es cuando más se quiere ver, pero se dice.
  const aviso = calcularSituacionDelCiclo(ciclo) === "enCurso"
    ? "<span class=\"pie-barra\">Este ciclo va en el " +
      formatearPorcentaje(calcularAvanceDelCiclo(ciclo)) +
      " y el anterior está completo: todo va a parecer que bajó hasta que cierre.</span>"
    : "";

  return htmlDeTabla(encabezados, cuerpo) + aviso;
}

function htmlDeLaFiabilidadDelPresupuesto(datos) {
  const fiabilidad = calcularFiabilidadDelPresupuesto(datos, lenteDelEstudio);

  if (fiabilidad.length === 0) { return ""; }

  if (fiabilidad.every(function (f) { return f.ciclosContados === 0; })) {
    return htmlDeEstadoVacio("Necesita ciclos cerrados para comparar presupuesto contra realidad.");
  }

  const cuerpo = fiabilidad.map(function (f) {
    const ultima = f.observaciones[f.observaciones.length - 1];
    const desviacion = f.desviacionPromedio;
    const proporcion = ultima.presupuesto > 0 ? ultima.gastado / ultima.presupuesto : 0;
    const tono = tonoDeProporcion(proporcion);

    return "<tr>" +
      "<td class=\"celda-nombre\">" + htmlDePuntoDeCategoria(f.categoriaId, datos) + " " +
        escaparHTML(f.nombre) + "</td>" +
      "<td class=\"celda-cifra secundaria\">" + formatearMoneda(ultima.presupuesto) + "</td>" +
      "<td class=\"celda-cifra fuerte\">" + formatearMoneda(ultima.gastado) + "</td>" +
      "<td class=\"celda-presupuesto\">" +
        "<div class=\"barra-presupuesto\">" +
          "<div class=\"relleno-presupuesto " + tono + "\" style=\"width: " +
            (Math.min(proporcion, 1) * 100).toFixed(2) + "%;\"></div>" +
        "</div>" +
        "<span class=\"pie-barra\">" + formatearPorcentaje(proporcion) + "</span>" +
      "</td>" +
      "<td class=\"celda-cifra " + (desviacion !== null && desviacion > 0 ? "mal" : "") + "\">" +
        (desviacion === null ? "—" : formatearVariacion(desviacion)) + "</td>" +
    "</tr>";
  }).join("");

  const encabezados = "<th>Categoría</th>" +
    "<th class=\"celda-cifra\">Presupuesto</th>" +
    "<th class=\"celda-cifra\">Gastado</th>" +
    "<th class=\"celda-presupuesto\">Del último ciclo cerrado</th>" +
    "<th class=\"celda-cifra\" title=\"Promedio de la diferencia en los ciclos cerrados. Positivo: el presupuesto se queda corto.\">Desviación</th>";

  return htmlDeTabla(encabezados, cuerpo);
}

function renderizarComparativoDelCiclo() {
  const datos = leerDatos();

  document.getElementById("seccionComparativo").innerHTML =
    htmlDeEncabezadoDeSeccion(SECCIONES_DEL_ESTUDIO[5]) +
    "<div class=\"cuerpo-seccion\">" +
      "<div class=\"rejilla-bloques\">" +
        htmlDeBloque("Ciclo por ciclo", htmlDeLaTablaDeCiclos(datos)) +
        htmlDeBloque("Qué se movió", htmlDeQueSeMovio(datos)) +
        htmlDeBloque("Si el presupuesto está bien puesto", htmlDeLaFiabilidadDelPresupuesto(datos)) +
      "</div>" +
    "</div>";
}

// ============================================================
// ESTUDIO — EL LIBRO DE MOVIMIENTOS
// ============================================================
//
// Los gastos ya registrados del ciclo, del más reciente al más antiguo.
// Es referencia, no análisis, así que vive plegado al final: si
// estuviera abierto competiría con las seis secciones por la atención,
// y treinta renglones de texto es justo lo que sobraba en la primera
// versión de esta pantalla.

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
  const contenedor = document.getElementById("listaMovimientosCiclo");
  const movimientos = obtenerMovimientosDelCiclo(datos, ciclo.id);

  document.getElementById("cuentaMovimientos").textContent =
    movimientos.length + (movimientos.length === 1 ? " movimiento" : " movimientos");

  if (movimientos.length === 0) {
    contenedor.innerHTML = "<div class=\"cuerpo-seccion\">" +
      htmlDeEstadoVacio("Sin gastos registrados en este ciclo.") + "</div>";
    return;
  }

  const cuerpo = movimientos.map(function (gasto) {
    const categoria = datos.config.categorias.find(function (c) { return c.id === gasto.categoriaId; });
    const nombre = categoria
      ? escaparHTML(categoria.nombre) + " · " + escaparHTML(gasto.subcategoria || "")
      : escaparHTML(gasto.descripcion || "Sin categoría");
    const destinatario = gasto.destinatario
      ? "<span class=\"marca-chica\">" + escaparHTML(gasto.destinatario) + "</span>" : "";
    const credito = gasto.fuente === "credito"
      ? "<span class=\"marca-chica\">crédito" + (gasto.mesesDiferidos ? " " + gasto.mesesDiferidos + "m" : "") + "</span>"
      : "";

    return "<tr>" +
      "<td class=\"celda-cifra secundaria\">" + gasto.fecha + "</td>" +
      "<td class=\"celda-nombre\">" + htmlDePuntoDeCategoria(gasto.categoriaId, datos) + " " +
        nombre + destinatario + credito + "</td>" +
      "<td class=\"celda-cifra fuerte\">" + formatearMoneda(gasto.monto) + "</td>" +
    "</tr>";
  }).join("");

  contenedor.innerHTML = "<div class=\"cuerpo-seccion\">" +
    htmlDeTabla("<th>Fecha</th><th>Concepto</th><th class=\"celda-cifra\">Monto</th>", cuerpo) +
  "</div>";
}

// ============================================================
// ESTUDIO — GRÁFICA DE TRAYECTORIA DEL SEMÁFORO
// ============================================================
//
// La cuarta pieza del §3, y la de mayor resolución: el ciclo día por
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

