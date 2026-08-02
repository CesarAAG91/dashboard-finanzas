// ============================================================
// AJUSTES
// ============================================================
//
// Los formularios con los que se da de alta y se corrige la
// configuración: categorías, tarjetas, deudas, recurrentes,
// compromisos únicos, ingresos, depósitos y presupuesto semanal.
//
// Todo esto vive detrás del botón "Agregar o ajustar" de la vista
// ancha. Es trabajo de laptop, no de teléfono, por decisión del
// usuario: el iPhone es para capturar el día a día.
//
// También trae la pantalla de depuración heredada de la Etapa 1
// (el cuadro de texto con el JSON crudo y los botones de respaldo).
//
// Depende de motor.js.

// ============================================================
// CONFIGURACIÓN — CATEGORÍAS
// ============================================================

function manejarEnvioCategoria(evento) {
  evento.preventDefault();

  const nombre = document.getElementById("nombreCategoria").value.trim();
  const subcategorias = document.getElementById("subcategoriasCategoria").value
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
  const esVariableSemanal = document.getElementById("esVariableSemanalCategoria").checked;

  if (nombre === "" || subcategorias.length === 0) {
    return;
  }

  const datos = leerDatos();
  datos.config.categorias.push({
    id: generarId("cat"),
    nombre: nombre,
    subcategorias: subcategorias,
    esVariableSemanal: esVariableSemanal
  });
  guardarDatos(datos);

  document.getElementById("formCategoria").reset();
  renderizarTodo();
}

function renderizarCategorias() {
  const datos = leerDatos();
  const lista = document.getElementById("listaCategorias");

  if (datos.config.categorias.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">Todavía no hay categorías.</li>";
    return;
  }

  lista.innerHTML = datos.config.categorias.map(function (categoria) {
    const etiquetaSemanal = categoria.esVariableSemanal ? "presupuesto semanal" : "sin presupuesto semanal";
    return "<li data-categoria-id=\"" + categoria.id + "\">" +
      "<div class=\"fila-categoria\"><strong>" + escaparHTML(categoria.nombre) + "</strong> — " +
      escaparHTML(categoria.subcategorias.join(", ")) +
      " <span class=\"detalle\">(" + etiquetaSemanal + ")</span></div>" +
      "<button type=\"button\" class=\"boton-editar-categoria\">Editar</button>" +
      "<div class=\"edicion-categoria\" id=\"edicion_" + categoria.id + "\" style=\"display: none;\">" +
        "<label>Nombre<input type=\"text\" class=\"nombre-editado\" value=\"" + escaparHTML(categoria.nombre) + "\"></label>" +
        "<label>Subcategorías, separadas por coma<input type=\"text\" class=\"subcategorias-editadas\" value=\"" + escaparHTML(categoria.subcategorias.join(", ")) + "\"></label>" +
        "<label><input type=\"checkbox\" class=\"variable-semanal-editada\"" + (categoria.esVariableSemanal ? " checked" : "") + "> Recibe presupuesto semanal</label>" +
        "<button type=\"button\" class=\"boton-guardar-categoria\">Guardar cambios</button>" +
      "</div>" +
    "</li>";
  }).join("");

  lista.querySelectorAll("li[data-categoria-id]").forEach(function (filaLi) {
    const categoriaId = filaLi.getAttribute("data-categoria-id");

    filaLi.querySelector(".boton-editar-categoria").addEventListener("click", function () {
      const bloqueEdicion = document.getElementById("edicion_" + categoriaId);
      bloqueEdicion.style.display = bloqueEdicion.style.display === "none" ? "block" : "none";
    });

    filaLi.querySelector(".boton-guardar-categoria").addEventListener("click", function () {
      guardarEdicionDeCategoria(categoriaId, filaLi);
    });
  });
}

// Guarda los cambios de nombre, subcategorías y presupuesto semanal de una
// categoría ya existente. El id no cambia, así que los recurrentes y
// gastos que ya apuntan a esta categoría (por categoriaId, no por nombre)
// siguen intactos sin importar qué tanto cambie el nombre o la lista de
// subcategorías.
function guardarEdicionDeCategoria(categoriaId, filaLi) {
  const nombre = filaLi.querySelector(".nombre-editado").value.trim();
  const subcategorias = filaLi.querySelector(".subcategorias-editadas").value
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
  const esVariableSemanal = filaLi.querySelector(".variable-semanal-editada").checked;

  if (nombre === "" || subcategorias.length === 0) {
    return;
  }

  const datos = leerDatos();
  const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaId; });
  categoria.nombre = nombre;
  categoria.subcategorias = subcategorias;
  categoria.esVariableSemanal = esVariableSemanal;

  guardarDatos(datos);
  renderizarTodo();
}

// ============================================================
// CONFIGURACIÓN — ATAJOS DE CAPTURA
// ============================================================
//
// Los cuatro botones grandes de la primera pantalla del teléfono. El
// porqué de todo esto está explicado en captura.js, sección "CAPTURA —
// ATAJOS DE CAPTURA"; aquí solo está el formulario que los elige.
//
// Son cuatro menús numerados en vez de una lista de casillas porque el
// número es la posición en pantalla: el atajo 1 es siempre el de arriba a
// la izquierda. Con casillas el orden lo decidiría el programa y los
// botones se moverían de lugar solos, que es justo lo que hay que evitar
// cuando se captura sin mirar.

function renderizarAtajosDeCaptura() {
  const datos = leerDatos();
  const contenedor = document.getElementById("listaAtajosDeCaptura");
  const candidatas = obtenerSubcategoriasCandidatasAAtajo(datos);

  if (candidatas.length === 0) {
    contenedor.innerHTML = "<p class=\"vacio\">Todavía no hay subcategorías que puedan ser atajo. " +
      "Solo pueden serlo las de categorías que reciben presupuesto semanal, " +
      "porque son las únicas donde se captura un gasto nuevo.</p>";
    return;
  }

  const atajosGuardados = datos.config.atajosDeCaptura || [];
  const menus = [];

  for (let posicion = 0; posicion < MAXIMO_DE_ATAJOS; posicion++) {
    const atajo = atajosGuardados[posicion];

    const opciones = candidatas.map(function (candidata, indice) {
      // Una candidata sin categoría es "Otros" antes de existir: todavía no
      // tiene id, así que no puede coincidir con nada ya guardado.
      const estaElegida = atajo && candidata.categoria !== null &&
        atajo.categoriaId === candidata.categoria.id &&
        atajo.subcategoria === candidata.subcategoria;

      // El nombre de la categoría entre paréntesis desambigua dos
      // subcategorías que se llamen igual. En "Otros" sobra: la etiqueta ya
      // es el nombre de la categoría.
      const deQueCategoria = candidata.categoria !== null &&
        candidata.etiqueta !== candidata.categoria.nombre
          ? " (" + escaparHTML(candidata.categoria.nombre) + ")"
          : "";

      return "<option value=\"" + indice + "\"" + (estaElegida ? " selected" : "") + ">" +
        escaparHTML(candidata.etiqueta) + deQueCategoria +
      "</option>";
    }).join("");

    menus.push(
      "<label>Atajo " + (posicion + 1) +
        "<select class=\"atajo-de-captura\">" +
          "<option value=\"\">— vacío —</option>" +
          opciones +
        "</select>" +
      "</label>"
    );
  }

  contenedor.innerHTML = menus.join("");

  contenedor.querySelectorAll(".atajo-de-captura").forEach(function (menu) {
    menu.addEventListener("change", guardarAtajosDeCaptura);
  });
}

// Guarda los cuatro menús de una sola vez, en el orden en que aparecen.
//
// Los menús se identifican por su posición en la lista de candidatas y no
// por un texto compuesto, para no tener que inventar un separador que
// podría chocar con el nombre de una subcategoría.
//
// Si la misma subcategoría se eligió en dos menús se conserva solo la
// primera: dos botones idénticos en el muro no le sirven a nadie, y
// callarlo sería peor que arreglarlo.
function guardarAtajosDeCaptura() {
  const candidatas = obtenerSubcategoriasCandidatasAAtajo(leerDatos());
  const elegidos = [];

  document.querySelectorAll("#listaAtajosDeCaptura .atajo-de-captura").forEach(function (menu) {
    if (menu.value === "") {
      return;
    }

    const candidata = candidatas[Number(menu.value)];
    // "Otros" puede no existir todavía como categoría: elegirla en el muro
    // es la primera vez que se usa, y ahí es donde nace. Esto escribe en
    // los datos, así que tiene que pasar ANTES de leerlos abajo.
    const categoria = candidata.categoria || asegurarCategoriaOtros();

    const yaEstaba = elegidos.some(function (atajo) {
      return atajo.categoriaId === categoria.id &&
        atajo.subcategoria === candidata.subcategoria;
    });

    if (!yaEstaba) {
      elegidos.push({
        categoriaId: categoria.id,
        subcategoria: candidata.subcategoria
      });
    }
  });

  // Se lee hasta aquí, y no al principio, porque asegurarCategoriaOtros
  // pudo haber guardado una categoría nueva: leer antes y escribir después
  // la borraría sin dejar rastro.
  const datos = leerDatos();
  datos.config.atajosDeCaptura = elegidos;
  guardarDatos(datos);
  renderizarTodo();
}

// Llena un <select> con las categorías existentes. Se usa en el formulario
// de recurrentes, que necesita elegir a qué categoría pertenece cada uno.
function poblarSelectDeCategorias(selectElement) {
  const datos = leerDatos();
  selectElement.innerHTML = datos.config.categorias.map(function (categoria) {
    return "<option value=\"" + categoria.id + "\">" + escaparHTML(categoria.nombre) + "</option>";
  }).join("");
}

// Llena el <select> de subcategorías según la categoría elegida, porque
// las subcategorías dependen de a qué categoría pertenecen.
function poblarSelectDeSubcategorias(selectSubcategoria, categoriaId) {
  const datos = leerDatos();
  const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaId; });

  if (!categoria) {
    selectSubcategoria.innerHTML = "";
    return;
  }

  selectSubcategoria.innerHTML = categoria.subcategorias.map(function (sub) {
    return "<option value=\"" + escaparHTML(sub) + "\">" + escaparHTML(sub) + "</option>";
  }).join("");
}

function actualizarSelectsDelFormularioRecurrente() {
  const selectCategoria = document.getElementById("categoriaIdRecurrente");
  poblarSelectDeCategorias(selectCategoria);
  poblarSelectDeSubcategorias(document.getElementById("subcategoriaRecurrente"), selectCategoria.value);
}

// ============================================================
// CONFIGURACIÓN — TARJETAS
// ============================================================

function manejarEnvioTarjeta(evento) {
  evento.preventDefault();

  const datos = leerDatos();
  datos.config.tarjetas.push({
    id: generarId("tar"),
    nombre: document.getElementById("nombreTarjeta").value.trim(),
    diaCorte: Number(document.getElementById("diaCorteTarjeta").value),
    diaPago: Number(document.getElementById("diaPagoTarjeta").value),
    lineaTotal: Number(document.getElementById("lineaTotalTarjeta").value),
    permiteDiferirAMeses: document.getElementById("permiteDiferirAMesesTarjeta").checked
  });
  guardarDatos(datos);

  document.getElementById("formTarjeta").reset();

  // Una tarjeta nueva puede generar de inmediato un compromiso en el
  // ciclo actual si su día de pago cae dentro del rango.
  generarCompromisosDelCiclo(asegurarCicloActual());
  renderizarTodo();
}

function renderizarTarjetas() {
  const datos = leerDatos();
  const lista = document.getElementById("listaTarjetas");

  if (datos.config.tarjetas.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">Todavía no hay tarjetas.</li>";
    return;
  }

  lista.innerHTML = datos.config.tarjetas.map(function (tarjeta) {
    return "<li data-tarjeta-id=\"" + tarjeta.id + "\">" +
      "<div><strong>" + escaparHTML(tarjeta.nombre) + "</strong> — corte día " + tarjeta.diaCorte +
      ", pago día " + tarjeta.diaPago +
      " <span class=\"detalle\">(línea: " + formatearMoneda(tarjeta.lineaTotal) +
        (tarjeta.permiteDiferirAMeses ? ", permite MSI" : "") + ")</span></div>" +
      "<button type=\"button\" class=\"boton-editar-tarjeta\">Editar</button>" +
      "<div class=\"edicion-tarjeta\" id=\"edicionTarjeta_" + tarjeta.id + "\" style=\"display: none;\">" +
        "<p class=\"pista\">Día de corte (" + tarjeta.diaCorte + ") y día de pago (" + tarjeta.diaPago +
          ") no se pueden editar aquí — cambian qué compras entran en cada periodo ya calculado. Si el banco " +
          "de verdad te cambió esas fechas, es más seguro dar de alta la tarjeta de nuevo.</p>" +
        "<label>Nombre<input type=\"text\" class=\"nombre-editado\" value=\"" + escaparHTML(tarjeta.nombre) + "\"></label>" +
        "<label>Línea total<input type=\"number\" min=\"0\" step=\"0.01\" class=\"linea-total-editada\" value=\"" + tarjeta.lineaTotal + "\"></label>" +
        "<label><input type=\"checkbox\" class=\"permite-diferir-editado\"" + (tarjeta.permiteDiferirAMeses ? " checked" : "") + "> Permite diferir a meses (MSI)</label>" +
        "<button type=\"button\" class=\"boton-guardar-tarjeta\">Guardar cambios</button>" +
      "</div>" +
    "</li>";
  }).join("");

  lista.querySelectorAll("li[data-tarjeta-id]").forEach(function (filaLi) {
    const tarjetaId = filaLi.getAttribute("data-tarjeta-id");

    filaLi.querySelector(".boton-editar-tarjeta").addEventListener("click", function () {
      const bloqueEdicion = document.getElementById("edicionTarjeta_" + tarjetaId);
      bloqueEdicion.style.display = bloqueEdicion.style.display === "none" ? "block" : "none";
    });

    filaLi.querySelector(".boton-guardar-tarjeta").addEventListener("click", function () {
      guardarEdicionDeTarjeta(tarjetaId, filaLi);
    });
  });
}

// No hay activo/inactivo para tarjetas ni cascada de monto: el monto de
// un compromiso de tarjeta ya se recalcula solo en cada render
// (actualizarMontosDeCompromisosDeTarjeta), así que solo hace falta
// refrescar el nombre de los compromisos pendientes.
function guardarEdicionDeTarjeta(tarjetaId, filaLi) {
  const nombre = filaLi.querySelector(".nombre-editado").value.trim();
  const lineaTotal = Number(filaLi.querySelector(".linea-total-editada").value);

  if (nombre === "") {
    return;
  }

  const datos = leerDatos();
  const tarjeta = datos.config.tarjetas.find(function (t) { return t.id === tarjetaId; });
  tarjeta.nombre = nombre;
  tarjeta.lineaTotal = lineaTotal || 0;
  tarjeta.permiteDiferirAMeses = filaLi.querySelector(".permite-diferir-editado").checked;

  actualizarCompromisosPendientesDeOrigen(datos, "tarjeta", tarjetaId, { nombre: nombre });

  guardarDatos(datos);
  renderizarTodo();
}

// ============================================================
// CONFIGURACIÓN — DEUDAS
// ============================================================

// Muestra en vivo, mientras se llena el formulario, cuánto cuesta el
// crédito en total: la diferencia entre lo que se va a pagar en total y
// lo que realmente se pidió prestado. Se pinta en rojo a propósito, para
// que el costo sea visible en el momento de decidir, no después.
function calcularCostoDelCreditoEnVivo() {
  const montoPorPago = Number(document.getElementById("montoPorPagoDeuda").value) || 0;
  const pagosTotales = Number(document.getElementById("pagosTotalesDeuda").value) || 0;
  const montoSolicitado = Number(document.getElementById("montoSolicitadoDeuda").value) || 0;

  const contenedor = document.getElementById("previewCostoCredito");

  if (montoSolicitado <= 0 || pagosTotales <= 0) {
    contenedor.textContent = "";
    return;
  }

  const montoTotalAPagar = montoPorPago * pagosTotales;
  const costoDelCredito = montoTotalAPagar - montoSolicitado;
  const porcentajeSobrante = costoDelCredito / montoSolicitado;

  contenedor.textContent = "Costo del crédito: " + formatearMoneda(costoDelCredito) +
    " (" + (porcentajeSobrante * 100).toFixed(1) + "% sobre lo solicitado)";
}

function manejarEnvioDeuda(evento) {
  evento.preventDefault();

  const datos = leerDatos();
  datos.deudas.push({
    id: generarId("deu"),
    nombre: document.getElementById("nombreDeuda").value.trim(),
    tipo: document.getElementById("tipoDeuda").value,
    montoSolicitado: Number(document.getElementById("montoSolicitadoDeuda").value),
    montoPorPago: Number(document.getElementById("montoPorPagoDeuda").value),
    frecuencia: document.getElementById("frecuenciaDeuda").value,
    pagosTotales: Number(document.getElementById("pagosTotalesDeuda").value),
    pagosRealizados: Number(document.getElementById("pagosRealizadosDeuda").value) || 0,
    fechaPrimerPago: document.getElementById("fechaPrimerPagoDeuda").value,
    saldoManual: Number(document.getElementById("saldoManualDeuda").value) || null,
    fechaSaldoManual: document.getElementById("fechaSaldoManualDeuda").value || null,
    fuente: "debito",
    activa: true
  });
  guardarDatos(datos);

  document.getElementById("formDeuda").reset();
  document.getElementById("previewCostoCredito").textContent = "";

  generarCompromisosDelCiclo(asegurarCicloActual());
  renderizarTodo();
}

function renderizarDeudas() {
  const datos = leerDatos();
  const lista = document.getElementById("listaDeudas");

  if (datos.deudas.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">Todavía no hay deudas.</li>";
    return;
  }

  lista.innerHTML = datos.deudas.map(function (deuda) {
    const estado = calcularEstadoDeDeuda(deuda);
    let etiquetaSaldo;
    if (deuda.saldoManual !== null && deuda.saldoManual !== undefined) {
      etiquetaSaldo = "saldo real: " + formatearMoneda(estado.saldoRestante) +
        " al " + deuda.fechaSaldoManual;
    } else {
      etiquetaSaldo = "saldo restante: " + formatearMoneda(estado.saldoRestante);
    }
    const etiquetaActiva = deuda.activa ? "" : " (inactiva)";
    return "<li data-deuda-id=\"" + deuda.id + "\">" +
      "<div><strong>" + escaparHTML(deuda.nombre) + "</strong> — pago " + deuda.pagosRealizados +
      " de " + deuda.pagosTotales +
      " <span class=\"detalle\">(" + etiquetaSaldo + etiquetaActiva + ")</span></div>" +
      "<button type=\"button\" class=\"boton-editar-deuda\">Editar</button>" +
      "<div class=\"edicion-deuda\" id=\"edicionDeuda_" + deuda.id + "\" style=\"display: none;\">" +
        "<p class=\"pista\">Fecha del primer pago (" + deuda.fechaPrimerPago + "), frecuencia (" + deuda.frecuencia +
          "), pagos totales (" + deuda.pagosTotales + ") y pagos ya realizados (" + deuda.pagosRealizados +
          ") no se pueden editar aquí — cambiarlos dejaría compromisos ya generados con fechas que no calzan " +
          "con ninguna regla real. Si de verdad cambió el crédito, da de alta uno nuevo y desactiva este.</p>" +
        "<label>Nombre<input type=\"text\" class=\"nombre-editado\" value=\"" + escaparHTML(deuda.nombre) + "\"></label>" +
        "<label>Tipo<select class=\"tipo-editado\">" +
          "<option value=\"prestamo\"" + (deuda.tipo === "prestamo" ? " selected" : "") + ">Préstamo</option>" +
          "<option value=\"msi\"" + (deuda.tipo === "msi" ? " selected" : "") + ">MSI (meses sin intereses)</option>" +
        "</select></label>" +
        "<label>Monto solicitado<input type=\"number\" min=\"0\" step=\"0.01\" class=\"monto-solicitado-editado\" value=\"" + deuda.montoSolicitado + "\"></label>" +
        "<label>Monto por pago<input type=\"number\" min=\"0\" step=\"0.01\" class=\"monto-por-pago-editado\" value=\"" + deuda.montoPorPago + "\"></label>" +
        "<label>Saldo real según el banco (opcional)<input type=\"number\" min=\"0\" step=\"0.01\" class=\"saldo-manual-editado\" value=\"" + (deuda.saldoManual === null || deuda.saldoManual === undefined ? "" : deuda.saldoManual) + "\"></label>" +
        "<label>Fecha de ese saldo<input type=\"date\" class=\"fecha-saldo-manual-editada\" value=\"" + (deuda.fechaSaldoManual || "") + "\"></label>" +
        "<label><input type=\"checkbox\" class=\"activa-editada\"" + (deuda.activa ? " checked" : "") + "> Activa</label>" +
        "<button type=\"button\" class=\"boton-guardar-deuda\">Guardar cambios</button>" +
      "</div>" +
    "</li>";
  }).join("");

  lista.querySelectorAll("li[data-deuda-id]").forEach(function (filaLi) {
    const deudaId = filaLi.getAttribute("data-deuda-id");

    filaLi.querySelector(".boton-editar-deuda").addEventListener("click", function () {
      const bloqueEdicion = document.getElementById("edicionDeuda_" + deudaId);
      bloqueEdicion.style.display = bloqueEdicion.style.display === "none" ? "block" : "none";
    });

    filaLi.querySelector(".boton-guardar-deuda").addEventListener("click", function () {
      guardarEdicionDeDeuda(deudaId, filaLi);
    });
  });
}

// Igual que guardarEdicionDeRecurrente: si sigue activa, los compromisos
// ya generados y sin pagar de esta deuda se actualizan con el nombre y
// monto por pago nuevos; si se acaba de desactivar (ej. se liquidó
// antes de tiempo), esos compromisos se eliminan.
function guardarEdicionDeDeuda(deudaId, filaLi) {
  const nombre = filaLi.querySelector(".nombre-editado").value.trim();
  const montoPorPago = Number(filaLi.querySelector(".monto-por-pago-editado").value);
  const montoSolicitado = Number(filaLi.querySelector(".monto-solicitado-editado").value);

  if (nombre === "" || !montoPorPago || montoPorPago <= 0 || !montoSolicitado || montoSolicitado <= 0) {
    return;
  }

  const datos = leerDatos();
  const deuda = datos.deudas.find(function (d) { return d.id === deudaId; });
  const estabaActiva = deuda.activa;

  deuda.nombre = nombre;
  deuda.tipo = filaLi.querySelector(".tipo-editado").value;
  deuda.montoSolicitado = montoSolicitado;
  deuda.montoPorPago = montoPorPago;
  deuda.saldoManual = Number(filaLi.querySelector(".saldo-manual-editado").value) || null;
  deuda.fechaSaldoManual = filaLi.querySelector(".fecha-saldo-manual-editada").value || null;
  deuda.activa = filaLi.querySelector(".activa-editada").checked;

  if (estabaActiva && !deuda.activa) {
    eliminarCompromisosPendientesDeOrigen(datos, "deuda", deudaId);
  } else {
    actualizarCompromisosPendientesDeOrigen(datos, "deuda", deudaId, { nombre: nombre, montoEstimado: montoPorPago });
  }

  guardarDatos(datos);
  renderizarTodo();
}

// ============================================================
// CONFIGURACIÓN — RECURRENTES
// ============================================================

// El campo "a partir de qué ciclo empieza" solo tiene sentido para los
// recurrentes bimestrales (los demás se repiten en todos los ciclos), así
// que se muestra u oculta según la frecuencia elegida.
function manejarCambioFrecuenciaRecurrente() {
  const frecuencia = document.getElementById("frecuenciaRecurrente").value;
  const contenedor = document.getElementById("contenedorCicloDeInicio");

  if (frecuencia === "bimestral") {
    contenedor.style.display = "block";
    poblarSelectDeCicloDeInicio();
  } else {
    contenedor.style.display = "none";
  }
}

// Ofrece como ancla el ciclo actual o el siguiente. No tiene sentido
// anclar un recurrente nuevo a un ciclo que ya pasó.
function poblarSelectDeCicloDeInicio() {
  const cicloActual = asegurarCicloActual();
  const cicloSiguiente = calcularSiguienteCicloSimulado(cicloActual);

  const select = document.getElementById("cicloDeInicioRecurrente");
  select.innerHTML =
    "<option value=\"" + cicloActual.id + "\">Este ciclo (" + cicloActual.id + ")</option>" +
    "<option value=\"" + cicloSiguiente.id + "\">El siguiente ciclo (" + cicloSiguiente.id + ")</option>";
}

function manejarEnvioRecurrente(evento) {
  evento.preventDefault();

  const frecuencia = document.getElementById("frecuenciaRecurrente").value;
  const cicloDeInicio = frecuencia === "bimestral"
    ? document.getElementById("cicloDeInicioRecurrente").value
    : null;

  const vigenciaHasta = document.getElementById("vigenciaHastaRecurrente").value || null;
  const destinatario = document.getElementById("destinatarioRecurrente").value.trim() || null;

  const datos = leerDatos();
  datos.recurrentes.push({
    id: generarId("rec"),
    nombre: document.getElementById("nombreRecurrente").value.trim(),
    categoriaId: document.getElementById("categoriaIdRecurrente").value,
    subcategoria: document.getElementById("subcategoriaRecurrente").value,
    destinatario: destinatario,
    frecuencia: frecuencia,
    diaBase: Number(document.getElementById("diaBaseRecurrente").value),
    cicloDeInicio: cicloDeInicio,
    vigenciaHasta: vigenciaHasta,
    montoEstimado: Number(document.getElementById("montoEstimadoRecurrente").value),
    fuente: document.getElementById("fuenteRecurrente").value,
    activo: true
  });
  guardarDatos(datos);

  document.getElementById("formRecurrente").reset();
  document.getElementById("contenedorCicloDeInicio").style.display = "none";

  generarCompromisosDelCiclo(asegurarCicloActual());
  renderizarTodo();
}

function renderizarRecurrentes() {
  const datos = leerDatos();
  const lista = document.getElementById("listaRecurrentes");

  if (datos.recurrentes.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">Todavía no hay gastos recurrentes.</li>";
    return;
  }

  lista.innerHTML = datos.recurrentes.map(function (recurrente) {
    const etiquetaVigencia = recurrente.vigenciaHasta ? ", vigente hasta " + recurrente.vigenciaHasta : "";
    const etiquetaDestinatario = recurrente.destinatario ? ", " + escaparHTML(recurrente.destinatario) : "";
    const etiquetaActivo = recurrente.activo ? "" : " (inactivo)";
    return "<li data-recurrente-id=\"" + recurrente.id + "\">" +
      "<div><strong>" + escaparHTML(recurrente.nombre) + "</strong> — " + recurrente.frecuencia +
      ", día " + recurrente.diaBase +
      " <span class=\"detalle\">(" + formatearMoneda(recurrente.montoEstimado) + " est." + etiquetaVigencia + etiquetaDestinatario + etiquetaActivo + ")</span></div>" +
      "<button type=\"button\" class=\"boton-editar-recurrente\">Editar</button>" +
      "<div class=\"edicion-recurrente\" id=\"edicionRecurrente_" + recurrente.id + "\" style=\"display: none;\">" +
        "<p class=\"pista\">Frecuencia (" + recurrente.frecuencia + ") y día del mes (" + recurrente.diaBase +
          ") no se pueden editar aquí — si de verdad cambiaron, da de alta un recurrente nuevo y pon " +
          "\"vigente hasta\" hoy en este, o desactívalo.</p>" +
        "<label>Nombre<input type=\"text\" class=\"nombre-editado\" value=\"" + escaparHTML(recurrente.nombre) + "\"></label>" +
        "<label>Categoría<select class=\"categoria-editada\"></select></label>" +
        "<label>Subcategoría<select class=\"subcategoria-editada\"></select></label>" +
        "<label>Destinatario (opcional)<input type=\"text\" class=\"destinatario-editado\" value=\"" + escaparHTML(recurrente.destinatario || "") + "\"></label>" +
        "<label>Monto estimado<input type=\"number\" min=\"0\" step=\"0.01\" class=\"monto-editado\" value=\"" + recurrente.montoEstimado + "\"></label>" +
        "<label>Fuente<select class=\"fuente-editada\">" +
          "<option value=\"debito\">Débito</option>" +
          "<option value=\"credito\">Crédito</option>" +
        "</select></label>" +
        "<label>Vigente hasta (opcional)<input type=\"date\" class=\"vigencia-editada\" value=\"" + (recurrente.vigenciaHasta || "") + "\"></label>" +
        "<label><input type=\"checkbox\" class=\"activo-editado\"" + (recurrente.activo ? " checked" : "") + "> Activo</label>" +
        "<button type=\"button\" class=\"boton-guardar-recurrente\">Guardar cambios</button>" +
      "</div>" +
    "</li>";
  }).join("");

  lista.querySelectorAll("li[data-recurrente-id]").forEach(function (filaLi) {
    const recurrenteId = filaLi.getAttribute("data-recurrente-id");
    const recurrente = datos.recurrentes.find(function (r) { return r.id === recurrenteId; });

    filaLi.querySelector(".boton-editar-recurrente").addEventListener("click", function () {
      const bloqueEdicion = document.getElementById("edicionRecurrente_" + recurrenteId);
      const mostrar = bloqueEdicion.style.display === "none";
      bloqueEdicion.style.display = mostrar ? "block" : "none";
      if (mostrar) {
        const selectCategoria = filaLi.querySelector(".categoria-editada");
        poblarSelectDeCategorias(selectCategoria);
        selectCategoria.value = recurrente.categoriaId;
        poblarSelectDeSubcategorias(filaLi.querySelector(".subcategoria-editada"), recurrente.categoriaId);
        filaLi.querySelector(".subcategoria-editada").value = recurrente.subcategoria;
        filaLi.querySelector(".fuente-editada").value = recurrente.fuente;
        selectCategoria.addEventListener("change", function () {
          poblarSelectDeSubcategorias(filaLi.querySelector(".subcategoria-editada"), selectCategoria.value);
        });
      }
    });

    filaLi.querySelector(".boton-guardar-recurrente").addEventListener("click", function () {
      guardarEdicionDeRecurrente(recurrenteId, filaLi);
    });
  });
}

// Actualiza los campos "seguros" de un recurrente (ver SPEC.md, sección
// "Edición de entidades"). Si sigue activo, los compromisos ya
// generados y todavía sin pagar de ese recurrente se actualizan con el
// nombre y monto nuevos. Si se acaba de desactivar, esos compromisos se
// eliminan en vez de actualizarse — ya no van a suceder de verdad.
function guardarEdicionDeRecurrente(recurrenteId, filaLi) {
  const nombre = filaLi.querySelector(".nombre-editado").value.trim();
  const montoEstimado = Number(filaLi.querySelector(".monto-editado").value);

  if (nombre === "" || !montoEstimado || montoEstimado <= 0) {
    return;
  }

  const datos = leerDatos();
  const recurrente = datos.recurrentes.find(function (r) { return r.id === recurrenteId; });
  const estabaActivo = recurrente.activo;

  recurrente.nombre = nombre;
  recurrente.categoriaId = filaLi.querySelector(".categoria-editada").value;
  recurrente.subcategoria = filaLi.querySelector(".subcategoria-editada").value;
  recurrente.destinatario = filaLi.querySelector(".destinatario-editado").value.trim() || null;
  recurrente.montoEstimado = montoEstimado;
  recurrente.fuente = filaLi.querySelector(".fuente-editada").value;
  recurrente.vigenciaHasta = filaLi.querySelector(".vigencia-editada").value || null;
  recurrente.activo = filaLi.querySelector(".activo-editado").checked;

  if (estabaActivo && !recurrente.activo) {
    eliminarCompromisosPendientesDeOrigen(datos, "recurrente", recurrenteId);
  } else {
    actualizarCompromisosPendientesDeOrigen(datos, "recurrente", recurrenteId, { nombre: nombre, montoEstimado: montoEstimado });
  }

  guardarDatos(datos);
  renderizarTodo();
}

// ============================================================
// CONFIGURACIÓN — COMPROMISO ÚNICO
// ============================================================
//
// Una obligación de una sola vez, sin regla detrás (ver SPEC.md, sección
// "compromisos únicos — alta"). A diferencia de recurrentes, deudas y
// tarjetas, aquí no se guarda ninguna regla en config: el formulario
// inserta directamente la instancia en datos.compromisos, con el ciclo
// calculado a partir de su fecha.

// La categoría es opcional, así que el select siempre ofrece "Sin
// categoría" además de las categorías existentes.
function actualizarSelectsDelFormularioCompromisoUnico() {
  const datos = leerDatos();
  const selectCategoria = document.getElementById("categoriaIdCompromisoUnico");

  selectCategoria.innerHTML = "<option value=\"\">Sin categoría</option>" +
    datos.config.categorias.map(function (categoria) {
      return "<option value=\"" + categoria.id + "\">" + escaparHTML(categoria.nombre) + "</option>";
    }).join("");

  actualizarSubcategoriaCompromisoUnico();
}

// La subcategoría solo tiene sentido si se eligió una categoría. Si el
// usuario vuelve a "Sin categoría", el select de subcategoría se vacía y
// se deshabilita para que no quede un valor suelto sin categoría dueña.
function actualizarSubcategoriaCompromisoUnico() {
  const categoriaId = document.getElementById("categoriaIdCompromisoUnico").value;
  const selectSubcategoria = document.getElementById("subcategoriaCompromisoUnico");

  if (categoriaId === "") {
    selectSubcategoria.innerHTML = "";
    selectSubcategoria.disabled = true;
    return;
  }

  selectSubcategoria.disabled = false;
  poblarSelectDeSubcategorias(selectSubcategoria, categoriaId);
}

function manejarEnvioCompromisoUnico(evento) {
  evento.preventDefault();

  const nombre = document.getElementById("nombreCompromisoUnico").value.trim();
  const fechaTexto = document.getElementById("fechaCompromisoUnico").value;
  const montoEstimado = Number(document.getElementById("montoEstimadoCompromisoUnico").value);
  const categoriaId = document.getElementById("categoriaIdCompromisoUnico").value || null;
  const subcategoria = categoriaId ? document.getElementById("subcategoriaCompromisoUnico").value : null;
  const destinatario = document.getElementById("destinatarioCompromisoUnico").value.trim() || null;

  if (nombre === "" || fechaTexto === "" || !montoEstimado || montoEstimado <= 0) {
    return;
  }

  // No pasa por generarCompromisosDelCiclo(): no hay regla que regenerar
  // en ciclos futuros, solo existe esta vez.
  const ciclo = obtenerOCrearCicloParaFecha(crearFechaLocal(fechaTexto));
  const datos = leerDatos();

  datos.compromisos.push({
    id: generarId("cmp"),
    cicloId: ciclo.id,
    origen: "unico",
    origenId: null,
    nombre: nombre,
    categoriaId: categoriaId,
    subcategoria: subcategoria,
    destinatario: destinatario,
    fechaProgramada: fechaTexto,
    montoEstimado: montoEstimado,
    montoReal: null,
    pagado: false,
    pagoNde: null
  });
  guardarDatos(datos);

  document.getElementById("formCompromisoUnico").reset();
  actualizarSelectsDelFormularioCompromisoUnico();
  renderizarTodo();
}

function renderizarCompromisosUnicos() {
  const datos = leerDatos();
  const lista = document.getElementById("listaCompromisosUnicos");

  const compromisosUnicos = datos.compromisos
    .filter(function (c) { return c.origen === "unico"; })
    .sort(function (a, b) { return a.fechaProgramada < b.fechaProgramada ? -1 : 1; });

  if (compromisosUnicos.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">Todavía no hay compromisos únicos.</li>";
    return;
  }

  lista.innerHTML = compromisosUnicos.map(function (compromiso) {
    const estado = compromiso.pagado ? "pagado" : "pendiente";
    const etiquetaDestinatario = compromiso.destinatario ? ", " + escaparHTML(compromiso.destinatario) : "";
    return "<li>" + compromiso.fechaProgramada + " — " + escaparHTML(compromiso.nombre) +
      " <span class=\"detalle\">(" + formatearMoneda(compromiso.montoEstimado) + " est., " + estado + etiquetaDestinatario + ")</span></li>";
  }).join("");
}

// ============================================================
// CONFIGURACIÓN — INGRESOS
// ============================================================
//
// Un solo formulario para los tres tipos. Los campos que no le tocan al
// tipo elegido se ocultan en vez de quedarse vacíos en pantalla: el
// formulario anterior pedía siempre todos los campos de todos los casos, y
// esa era justo la queja del usuario.
//
// Lo que se guarda aquí es la regla. Los depósitos concretos se calculan
// en la sección "INGRESOS — reglas y ocurrencias" del motor.

// Muestra solo los campos que le corresponden al tipo elegido:
//   mensual   → regla de fecha
//   bimestral → regla de fecha + primer mes en que cae
//   extra     → fecha exacta
function ajustarCamposDelFormularioDeIngreso() {
  const tipo = document.getElementById("tipoIngreso").value;

  document.getElementById("campoReglaDeFechaIngreso").style.display = tipo === "extra" ? "none" : "block";
  document.getElementById("campoFechaInicioIngreso").style.display = tipo === "bimestral" ? "block" : "none";
  document.getElementById("campoFechaIngreso").style.display = tipo === "extra" ? "block" : "none";

  renderizarVistaPreviaDeIngreso();
}

// Dice, antes de guardar, en qué fecha exacta va a caer el primer depósito
// y a qué ciclo pertenece.
//
// Existe por una asimetría que es imposible de adivinar al capturar: con la
// regla de fin de mes, el depósito del mes de julio (el 30) es el que abre
// el ciclo llamado "2026-08". Así que un bimestral anclado en agosto cae el
// 30 de agosto y ese día ya pertenece al ciclo 2026-09 — un ciclo después
// de donde el usuario probablemente lo quería. En vez de cambiar la regla
// (el ciclo se define así desde el principio y todo lo demás depende de
// eso), se muestra el resultado para que el usuario lo corrija antes de
// guardar.
function renderizarVistaPreviaDeIngreso() {
  const contenedor = document.getElementById("vistaPreviaIngreso");
  const tipo = document.getElementById("tipoIngreso").value;
  const monto = Number(document.getElementById("montoIngreso").value);

  if (tipo === "extra") {
    const fecha = document.getElementById("fechaIngreso").value;
    contenedor.textContent = fecha
      ? "Cae el " + fecha + ", dentro del ciclo " + calcularIdDeCicloParaFecha(crearFechaLocal(fecha)) + "."
      : "";
    return;
  }

  const fechaInicio = document.getElementById("fechaInicioIngreso").value;
  if (tipo === "bimestral" && !fechaInicio) {
    contenedor.textContent = "Elige el primer mes en que cae para ver las fechas.";
    return;
  }

  // Se arma un ingreso de mentiras con lo que hay capturado hasta ahora y se
  // le piden sus primeras ocurrencias, usando exactamente el mismo motor que
  // usará una vez guardado — así la vista previa nunca puede mentir.
  const ingresoTentativo = {
    id: "vista-previa",
    nombre: "",
    tipo: tipo,
    monto: monto || 0,
    reglaDeFecha: document.getElementById("reglaPrimerDiaHabilIngreso").checked ? "primerDiaHabil" : "finDeMes",
    fechaInicio: fechaInicio,
    activo: true,
    ajustes: []
  };

  const desde = tipo === "bimestral" ? crearFechaLocal(fechaInicio) : new Date();
  const hasta = new Date(desde.getFullYear(), desde.getMonth() + 5, 1);
  const proximas = calcularOcurrenciasDeIngresosEnRango(
    { ingresos: [ingresoTentativo] },
    formatearFechaISO(desde),
    formatearFechaISO(hasta)
  ).slice(0, 3);

  if (proximas.length === 0) {
    contenedor.textContent = "";
    return;
  }

  contenedor.textContent = "Próximos depósitos: " + proximas.map(function (ocurrencia) {
    return ocurrencia.fecha + " (ciclo " + calcularIdDeCicloParaFecha(crearFechaLocal(ocurrencia.fecha)) + ")";
  }).join(", ") + ".";
}

function manejarEnvioIngreso(evento) {
  evento.preventDefault();

  const nombre = document.getElementById("nombreIngreso").value.trim();
  const tipo = document.getElementById("tipoIngreso").value;
  const monto = Number(document.getElementById("montoIngreso").value);
  const fechaInicio = document.getElementById("fechaInicioIngreso").value;
  const fecha = document.getElementById("fechaIngreso").value;

  if (!nombre || !monto || monto <= 0) {
    return;
  }
  if (tipo === "bimestral" && !fechaInicio) {
    alert("Un ingreso bimestral necesita el primer mes en que cae, para saber en qué meses toca.");
    return;
  }
  if (tipo === "extra" && !fecha) {
    alert("Un ingreso extra necesita su fecha exacta.");
    return;
  }

  const ingresoNuevo = {
    id: generarId("ing"),
    nombre: nombre,
    tipo: tipo,
    monto: monto,
    nota: document.getElementById("notaIngreso").value.trim(),
    activo: true
  };

  if (tipo === "extra") {
    ingresoNuevo.fecha = fecha;
  } else {
    ingresoNuevo.reglaDeFecha = document.getElementById("reglaPrimerDiaHabilIngreso").checked ? "primerDiaHabil" : "finDeMes";
    ingresoNuevo.ajustes = [];
    if (tipo === "bimestral") {
      ingresoNuevo.fechaInicio = fechaInicio;
    }
  }

  const datos = leerDatos();
  datos.ingresos.push(ingresoNuevo);
  guardarDatos(datos);

  document.getElementById("formIngreso").reset();
  ajustarCamposDelFormularioDeIngreso();
  renderizarTodo();
}

// Texto corto que describe la regla de un ingreso, para leerla de un golpe
// en la lista sin tener que abrir la edición.
function describirReglaDeIngreso(ingreso) {
  if (ingreso.tipo === "extra") {
    return "una sola vez, el " + ingreso.fecha;
  }

  const cadaCuando = ingreso.tipo === "bimestral" ? "cada 2 meses" : "cada mes";
  const cuandoCae = obtenerReglaDeFechaDeIngreso(ingreso) === "primerDiaHabil"
    ? "el primer día hábil"
    : "el día hábil antes de fin de mes";

  return cadaCuando + ", " + cuandoCae;
}

function renderizarIngresos() {
  const datos = leerDatos();
  const lista = document.getElementById("listaIngresos");

  if (datos.ingresos.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">Todavía no hay ingresos registrados.</li>";
    return;
  }

  lista.innerHTML = datos.ingresos.map(function (ingreso) {
    const notaTexto = ingreso.nota ? ", " + escaparHTML(ingreso.nota) : "";
    const etiquetaActivo = ingreso.activo === false ? " (inactivo)" : "";
    const cantidadDeAjustes = (ingreso.ajustes || []).length;
    const etiquetaAjustes = cantidadDeAjustes > 0
      ? " <span class=\"detalle\">" + cantidadDeAjustes + " mes(es) ajustado(s)</span>"
      : "";

    return "<li data-ingreso-id=\"" + ingreso.id + "\">" +
      "<div><strong>" + escaparHTML(ingreso.nombre || "(sin nombre)") + "</strong> — " + formatearMoneda(ingreso.monto) +
      " <span class=\"detalle\">(" + describirReglaDeIngreso(ingreso) + notaTexto + etiquetaActivo + ")</span>" + etiquetaAjustes + "</div>" +
      "<button type=\"button\" class=\"boton-editar-ingreso\">Editar</button>" +
      "<div class=\"edicion-ingreso\" id=\"edicionIngreso_" + ingreso.id + "\" style=\"display: none;\">" +
        "<label>Nombre<input type=\"text\" class=\"nombre-editado\" value=\"" + escaparHTML(ingreso.nombre || "") + "\"></label>" +
        "<label>Monto<input type=\"number\" min=\"0\" step=\"0.01\" class=\"monto-editado\" value=\"" + ingreso.monto + "\"></label>" +
        (ingreso.tipo === "extra"
          ? "<label>Fecha<input type=\"date\" class=\"fecha-editada\" value=\"" + (ingreso.fecha || "") + "\"></label>"
          : "<label><input type=\"checkbox\" class=\"regla-editada\"" + (obtenerReglaDeFechaDeIngreso(ingreso) === "primerDiaHabil" ? " checked" : "") + "> Cae el primer día hábil del mes</label>") +
        (ingreso.tipo === "bimestral"
          ? "<label>Primer mes en que cae<input type=\"date\" class=\"fecha-inicio-editada\" value=\"" + (ingreso.fechaInicio || "") + "\"></label>"
          : "") +
        "<label>Nota (opcional)<input type=\"text\" class=\"nota-editada\" value=\"" + escaparHTML(ingreso.nota || "") + "\"></label>" +
        "<label><input type=\"checkbox\" class=\"activo-editado\"" + (ingreso.activo === false ? "" : " checked") + "> Activo</label>" +
        "<button type=\"button\" class=\"boton-guardar-ingreso\">Guardar cambios</button>" +
        "<button type=\"button\" class=\"boton-borrar-ingreso\">Borrar</button>" +
      "</div>" +
    "</li>";
  }).join("");

  lista.querySelectorAll("li[data-ingreso-id]").forEach(function (filaLi) {
    const ingresoId = filaLi.getAttribute("data-ingreso-id");

    filaLi.querySelector(".boton-editar-ingreso").addEventListener("click", function () {
      const bloqueEdicion = document.getElementById("edicionIngreso_" + ingresoId);
      bloqueEdicion.style.display = bloqueEdicion.style.display === "none" ? "block" : "none";
    });

    filaLi.querySelector(".boton-guardar-ingreso").addEventListener("click", function () {
      guardarEdicionDeIngreso(ingresoId, filaLi);
    });

    filaLi.querySelector(".boton-borrar-ingreso").addEventListener("click", function () {
      borrarIngreso(ingresoId);
    });
  });
}

// El tipo no se edita: cambiarlo dejaría los ajustes por mes apuntando a
// ocurrencias que ya no existen (un extra no tiene ocurrencias mensuales,
// un bimestral tiene la mitad). Si el tipo estuvo mal, se borra la regla y
// se captura de nuevo — no hay nada que se pierda, porque ningún gasto ni
// compromiso referencia un ingreso por id.
function guardarEdicionDeIngreso(ingresoId, filaLi) {
  const nombre = filaLi.querySelector(".nombre-editado").value.trim();
  const monto = Number(filaLi.querySelector(".monto-editado").value);

  if (!nombre || !monto || monto <= 0) {
    return;
  }

  const datos = leerDatos();
  const ingreso = datos.ingresos.find(function (i) { return i.id === ingresoId; });

  ingreso.nombre = nombre;
  ingreso.monto = monto;
  ingreso.nota = filaLi.querySelector(".nota-editada").value.trim();
  ingreso.activo = filaLi.querySelector(".activo-editado").checked;

  if (ingreso.tipo === "extra") {
    ingreso.fecha = filaLi.querySelector(".fecha-editada").value;
  } else {
    ingreso.reglaDeFecha = filaLi.querySelector(".regla-editada").checked ? "primerDiaHabil" : "finDeMes";
  }

  if (ingreso.tipo === "bimestral") {
    ingreso.fechaInicio = filaLi.querySelector(".fecha-inicio-editada").value;
  }

  guardarDatos(datos);
  renderizarTodo();
}

function borrarIngreso(ingresoId) {
  const datos = leerDatos();
  const ingreso = datos.ingresos.find(function (i) { return i.id === ingresoId; });

  if (!confirm("¿Borrar el ingreso \"" + (ingreso ? ingreso.nombre : "") + "\"? Se van con él los ajustes por mes que le hayas hecho.")) {
    return;
  }

  datos.ingresos = datos.ingresos.filter(function (i) { return i.id !== ingresoId; });
  guardarDatos(datos);
  renderizarTodo();
}

// ============================================================
// CONFIGURACIÓN — DEPÓSITOS DEL CICLO (ocurrencias)
// ============================================================
//
// Aquí no se captura nada nuevo: se muestra lo que las reglas producen para
// el ciclo en curso y se permite corregir un depósito suelto — la fecha
// (un festivo lo recorrió) o el monto (ese mes cayó distinto). El ajuste
// queda guardado dentro de su regla, indexado por mes, y no afecta a
// ninguna otra ocurrencia ni a ningún otro ingreso.
//
// Los ingresos "extra" no aparecen con opción de ajuste: son su propia
// ocurrencia, así que se corrigen editando la regla directamente arriba.

function renderizarOcurrenciasDelCiclo() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();
  const contenedor = document.getElementById("contenedorOcurrenciasDelCiclo");
  const ocurrencias = calcularOcurrenciasDeIngresosDelCiclo(ciclo, datos);

  const encabezado = "<p class=\"pista\">Ciclo " + ciclo.id + ": del " + ciclo.fechaInicio + " al " + ciclo.fechaFin + ".</p>";

  if (ocurrencias.length === 0) {
    contenedor.innerHTML = encabezado + "<p class=\"vacio\">Ningún depósito cae en este ciclo.</p>";
    return;
  }

  const total = ocurrencias.reduce(function (suma, o) { return suma + o.monto; }, 0);

  contenedor.innerHTML = encabezado +
    "<ul class=\"lista-items\">" +
    ocurrencias.map(function (ocurrencia) {
      const etiquetaAjustada = ocurrencia.fueAjustada ? " <span class=\"detalle\">(ajustado)</span>" : "";

      if (ocurrencia.tipo === "extra") {
        return "<li>" + ocurrencia.fecha + " — " + escaparHTML(ocurrencia.nombre) + " " +
          formatearMoneda(ocurrencia.monto) + " <span class=\"detalle\">(extra)</span></li>";
      }

      const llave = ocurrencia.ingresoId + "__" + ocurrencia.mes;
      return "<li data-ocurrencia=\"" + llave + "\">" +
        "<div>" + ocurrencia.fecha + " — " + escaparHTML(ocurrencia.nombre) + " " +
        formatearMoneda(ocurrencia.monto) + etiquetaAjustada + "</div>" +
        "<button type=\"button\" class=\"boton-ajustar-ocurrencia\">Ajustar este depósito</button>" +
        "<div class=\"ajuste-ocurrencia\" id=\"ajusteOcurrencia_" + llave + "\" style=\"display: none;\">" +
          "<label>Fecha<input type=\"date\" class=\"fecha-ajustada\" value=\"" + ocurrencia.fecha + "\"></label>" +
          "<label>Monto<input type=\"number\" min=\"0\" step=\"0.01\" class=\"monto-ajustado\" value=\"" + ocurrencia.monto + "\"></label>" +
          "<button type=\"button\" class=\"boton-guardar-ajuste\">Guardar ajuste</button>" +
          (ocurrencia.fueAjustada
            ? "<button type=\"button\" class=\"boton-quitar-ajuste\">Volver a la regla</button>"
            : "") +
        "</div>" +
      "</li>";
    }).join("") +
    "</ul>" +
    "<p><strong>Total del ciclo: " + formatearMoneda(total) + "</strong></p>";

  contenedor.querySelectorAll("li[data-ocurrencia]").forEach(function (filaLi) {
    const llave = filaLi.getAttribute("data-ocurrencia");
    const ingresoId = llave.split("__")[0];
    const mes = llave.split("__")[1];

    filaLi.querySelector(".boton-ajustar-ocurrencia").addEventListener("click", function () {
      const bloque = document.getElementById("ajusteOcurrencia_" + llave);
      bloque.style.display = bloque.style.display === "none" ? "block" : "none";
    });

    filaLi.querySelector(".boton-guardar-ajuste").addEventListener("click", function () {
      guardarAjusteDeOcurrencia(ingresoId, mes, filaLi);
    });

    const botonQuitar = filaLi.querySelector(".boton-quitar-ajuste");
    if (botonQuitar) {
      botonQuitar.addEventListener("click", function () {
        quitarAjusteDeOcurrencia(ingresoId, mes);
      });
    }
  });
}

// Guarda (o reemplaza) el ajuste de un mes concreto de un ingreso
// recurrente. Si los valores capturados coinciden con lo que ya dice la
// regla, el ajuste se quita en vez de guardarse: no tiene sentido conservar
// una excepción que no excepciona nada.
function guardarAjusteDeOcurrencia(ingresoId, mes, filaLi) {
  const fecha = filaLi.querySelector(".fecha-ajustada").value;
  const monto = Number(filaLi.querySelector(".monto-ajustado").value);

  if (!fecha || !monto || monto <= 0) {
    return;
  }

  const datos = leerDatos();
  const ingreso = datos.ingresos.find(function (i) { return i.id === ingresoId; });
  const partesDelMes = mes.split("-");
  const fechaBase = formatearFechaISO(calcularFechaBaseDeOcurrencia(ingreso, Number(partesDelMes[0]), Number(partesDelMes[1]) - 1));

  ingreso.ajustes = (ingreso.ajustes || []).filter(function (ajuste) { return ajuste.mes !== mes; });

  const coincideConLaRegla = fecha === fechaBase && monto === Number(ingreso.monto);
  if (!coincideConLaRegla) {
    ingreso.ajustes.push({ mes: mes, fecha: fecha, monto: monto });
  }

  guardarDatos(datos);
  renderizarTodo();
}

function quitarAjusteDeOcurrencia(ingresoId, mes) {
  const datos = leerDatos();
  const ingreso = datos.ingresos.find(function (i) { return i.id === ingresoId; });

  ingreso.ajustes = (ingreso.ajustes || []).filter(function (ajuste) { return ajuste.mes !== mes; });

  guardarDatos(datos);
  renderizarTodo();
}


// ============================================================
// CONFIGURACIÓN — PRESUPUESTO SEMANAL
// ============================================================
//
// Solo las categorías marcadas como "esVariableSemanal" reciben un tope
// por semana. El formulario se arma con JavaScript porque sus campos
// dependen de qué categorías existan en ese momento.

function renderizarPresupuestoSemanal() {
  const datos = leerDatos();
  const cicloActual = asegurarCicloActual();
  const categoriasVariables = datos.config.categorias.filter(function (c) { return c.esVariableSemanal; });
  const contenedor = document.getElementById("contenedorPresupuestoSemanal");

  if (categoriasVariables.length === 0) {
    contenedor.innerHTML = "<p class=\"pista\">Agrega primero una categoría marcada como \"presupuesto semanal\".</p>";
    return;
  }

  const presupuestoVigente = obtenerPresupuestoSemanalVigente(cicloActual, datos);
  const camposHTML = categoriasVariables.map(function (categoria) {
    const valorActual = presupuestoVigente[categoria.id] || "";
    return "<label>" + escaparHTML(categoria.nombre) +
      "<input type=\"number\" min=\"0\" step=\"0.01\" data-categoria-id=\"" + categoria.id + "\" value=\"" + valorActual + "\"></label>";
  }).join("");

  contenedor.innerHTML = camposHTML +
    "<button type=\"button\" id=\"botonGuardarPresupuestoSemanal\">Guardar presupuesto semanal</button>" +
    "<div id=\"mensajePresupuestoSemanal\" class=\"pista\"></div>";

  document.getElementById("botonGuardarPresupuestoSemanal").addEventListener("click", guardarPresupuestoSemanal);
}

function guardarPresupuestoSemanal() {
  const cicloActual = asegurarCicloActual();
  const datos = leerDatos();
  const cicloEnDatos = datos.ciclos.find(function (c) { return c.id === cicloActual.id; });

  // Un ciclo importado de una versión vieja puede no traer el campo.
  if (!cicloEnDatos.presupuestoSemanal) {
    cicloEnDatos.presupuestoSemanal = {};
  }

  document.querySelectorAll("#contenedorPresupuestoSemanal input[data-categoria-id]").forEach(function (entrada) {
    const categoriaId = entrada.getAttribute("data-categoria-id");
    cicloEnDatos.presupuestoSemanal[categoriaId] = Number(entrada.value) || 0;
  });

  guardarDatos(datos);
  document.getElementById("mensajePresupuestoSemanal").textContent = "Presupuesto semanal guardado.";
}

// ============================================================
// VISTA PREVIA DE COMPROMISOS
// ============================================================

function renderizarCompromisos() {
  const datos = leerDatos();
  const cicloActual = asegurarCicloActual();
  const lista = document.getElementById("listaCompromisos");

  const compromisosDelCiclo = datos.compromisos
    .filter(function (c) { return c.cicloId === cicloActual.id; })
    .sort(function (a, b) { return a.fechaProgramada < b.fechaProgramada ? -1 : 1; });

  if (compromisosDelCiclo.length === 0) {
    lista.innerHTML = "<li class=\"vacio\">No hay compromisos generados para este ciclo todavía.</li>";
    return;
  }

  lista.innerHTML = compromisosDelCiclo.map(function (compromiso) {
    const etiquetaPago = compromiso.pagoNde ? " (pago " + compromiso.pagoNde + ")" : "";
    return "<li>" + compromiso.fechaProgramada + " — " + escaparHTML(compromiso.nombre) + etiquetaPago +
      " <span class=\"detalle\">(" + compromiso.origen + ", " + formatearMoneda(compromiso.montoEstimado) + " est.)</span></li>";
  }).join("");
}

// ============================================================
// PANTALLA DE DEPURACIÓN (heredada de la Etapa 1)
// ============================================================

function mostrarDatosEnPantalla() {
  const datos = leerDatos();
  document.getElementById("areaDatos").value = JSON.stringify(datos, null, 2);
}

function mostrarMensaje(texto) {
  document.getElementById("mensajeEstado").textContent = texto;
}

function guardarDesdeElCuadroDeTexto() {
  const textoEscrito = document.getElementById("areaDatos").value;
  try {
    const datos = JSON.parse(textoEscrito);
    guardarDatos(datos);
    renderizarTodo();
    mostrarMensaje("Guardado.");
  } catch (error) {
    mostrarMensaje("El texto no es JSON válido. No se guardó nada.");
  }
}

// ============================================================
// MODAL DE AJUSTES
// ============================================================
//
// Reemplaza a la pestaña de Configuración. Es una ventana flotante de
// tamaño contenido, nunca a pantalla completa: se abre, se captura o se
// corrige algo, y se cierra volviendo al muro.
//
// El estado (abierto o cerrado) vive en el DOM, no en los datos: es un
// detalle de la pantalla en este momento, no algo que deba sobrevivir a un
// respaldo ni sincronizarse entre dispositivos.

function abrirAjustes() {
  document.getElementById("capaModal").hidden = false;
  document.getElementById("botonCerrarAjustes").focus();
}

function cerrarAjustes() {
  document.getElementById("capaModal").hidden = true;
  document.getElementById("botonAgregarYAjustar").focus();
}

function ajustesEstanAbiertos() {
  return document.getElementById("capaModal").hidden === false;
}
