// ============================================================
// ARRANQUE
// ============================================================
//
// El único archivo que EJECUTA algo al cargar. Los otros cuatro solo
// definen funciones y quedan esperando a que alguien las llame.
//
// Por eso este va SIEMPRE AL FINAL en index.html: cuando corre, ya
// existen todas las funciones de motor, ajustes, captura y análisis,
// y el HTML de la página ya está completo.
//
// Contiene tres cosas:
//   - renderizarTodo(): vuelve a dibujar la app entera. Se llama
//     después de cualquier cambio en los datos.
//   - El cableado: qué función responde a cada botón y a cada campo.
//   - inicializar(): lo que pasa al abrir la app.

function renderizarTodo() {
  renderizarAvisoRespaldo();
  renderizarCintaCaptura();
  actualizarMontosDeCompromisosDeTarjeta(leerDatos());
  renderizarCategorias();
  actualizarSelectsDelFormularioRecurrente();
  renderizarTarjetas();
  renderizarDeudas();
  renderizarRecurrentes();
  actualizarSelectsDelFormularioCompromisoUnico();
  renderizarCompromisosUnicos();
  renderizarIngresos();
  renderizarOcurrenciasDelCiclo();
  renderizarPresupuestoSemanal();
  renderizarCompromisos();
  renderizarTicket();
  renderizarBalanceDelCiclo();
  renderizarTrayectoriaSemaforo();
  renderizarProximosPagosAnalisis();
  renderizarMovimientosDelCiclo();
  renderizarEstadoDeDeudaAnalisis();
  // La primera pantalla siempre trabaja sobre la simulación, así que se
  // asegura antes de dibujar cualquier parte de ella — y se sincroniza con
  // los datos reales, que pudieron cambiar desde Ajustes o desde Captura.
  asegurarSimulacionAbierta();
  sincronizarSimulacionConLosDatosReales();
  // Los siete ciclos se proyectan una sola vez por dibujado y de ahí leen el
  // encabezado, la trayectoria y el resumen del muro.
  recalcularProyeccionSimulada();
  renderizarEncabezadoDelCiclo();
  // El muro va al final: su acomodo mide la altura que le queda libre, así
  // que todo lo que comparte la primera pantalla con él (barra, trayectoria
  // y cajón) tiene que estar ya dibujado con su tamaño final.
  renderizarBarraDeSimulacion();
  renderizarTrayectoriaDeLaPrimeraPantalla();
  renderizarCajonDeCalendario();
  renderizarMuroDePagos();
  // Si la ventana de opciones estaba abierta, se vuelve a armar sobre el
  // mismo pago: así se prueban varias combinaciones (débito, 3 meses, 6
  // meses) viendo el efecto en el balance sin tener que reabrirla cada vez.
  if (idDePagoConOpcionesAbiertas !== null) {
    abrirOpcionesDePago(idDePagoConOpcionesAbiertas);
  }
  mostrarDatosEnPantalla();
}

document.getElementById("botonAgregarYAjustar").addEventListener("click", abrirAjustes);
document.getElementById("botonCerrarAjustes").addEventListener("click", cerrarAjustes);

document.getElementById("cicloAnterior").addEventListener("click", function () {
  cambiarCicloEnfocadoSimulacion(-1);
});
document.getElementById("cicloSiguiente").addEventListener("click", function () {
  cambiarCicloEnfocadoSimulacion(1);
});

document.getElementById("asaCajon").addEventListener("click", alternarCajonDeCalendario);
document.getElementById("mesAnteriorCajon").addEventListener("click", function () {
  cambiarMesDelCajon(-1);
});
document.getElementById("mesSiguienteCajon").addEventListener("click", function () {
  cambiarMesDelCajon(1);
});

// Clic en el fondo oscuro cierra; clic dentro del panel, no.
document.getElementById("capaModal").addEventListener("click", function (evento) {
  if (evento.target === this) {
    cerrarAjustes();
  }
});

document.addEventListener("keydown", function (evento) {
  if (evento.key !== "Escape") { return; }
  // Se cierra primero lo que esté más encima.
  if (opcionesDePagoEstanAbiertas()) {
    cerrarOpcionesDePago();
    return;
  }
  if (ajustesEstanAbiertos()) {
    cerrarAjustes();
  }
});

document.getElementById("capaOpcionesPago").addEventListener("click", function (evento) {
  if (evento.target === this) {
    cerrarOpcionesDePago();
  }
});


document.getElementById("formCategoria").addEventListener("submit", manejarEnvioCategoria);
document.getElementById("formTarjeta").addEventListener("submit", manejarEnvioTarjeta);
document.getElementById("formDeuda").addEventListener("submit", manejarEnvioDeuda);
document.getElementById("montoPorPagoDeuda").addEventListener("input", calcularCostoDelCreditoEnVivo);
document.getElementById("pagosTotalesDeuda").addEventListener("input", calcularCostoDelCreditoEnVivo);
document.getElementById("montoSolicitadoDeuda").addEventListener("input", calcularCostoDelCreditoEnVivo);
document.getElementById("formRecurrente").addEventListener("submit", manejarEnvioRecurrente);
document.getElementById("frecuenciaRecurrente").addEventListener("change", manejarCambioFrecuenciaRecurrente);
document.getElementById("categoriaIdRecurrente").addEventListener("change", function () {
  poblarSelectDeSubcategorias(document.getElementById("subcategoriaRecurrente"), this.value);
});
document.getElementById("formCompromisoUnico").addEventListener("submit", manejarEnvioCompromisoUnico);
document.getElementById("categoriaIdCompromisoUnico").addEventListener("change", actualizarSubcategoriaCompromisoUnico);
document.getElementById("formIngreso").addEventListener("submit", manejarEnvioIngreso);
document.getElementById("tipoIngreso").addEventListener("change", ajustarCamposDelFormularioDeIngreso);
// La vista previa se recalcula con cualquier campo que pueda mover la fecha
// del depósito, para que nunca muestre algo que ya no corresponde.
["reglaPrimerDiaHabilIngreso", "fechaInicioIngreso", "fechaIngreso"].forEach(function (id) {
  document.getElementById(id).addEventListener("change", renderizarVistaPreviaDeIngreso);
});
document.getElementById("botonGuardar").addEventListener("click", guardarDesdeElCuadroDeTexto);
document.getElementById("botonExportar").addEventListener("click", exportarJSON);
document.getElementById("botonImportar").addEventListener("click", function () {
  document.getElementById("inputArchivo").click();
});
document.getElementById("inputArchivo").addEventListener("change", importarJSON);

// Un solo escucha para todo el ticket: su contenido se reescribe entero en
// cada paso, pero el contenedor no cambia nunca.
const ticketCaptura = document.getElementById("ticketCaptura");
ticketCaptura.addEventListener("click", manejarToqueEnElTicket);
ticketCaptura.addEventListener("input", manejarEscrituraEnElTicket);
ticketCaptura.addEventListener("change", manejarCambioEnElTicket);

// La cinta se vuelve a dibujar en cada guardado, así que el escucha va en el
// contenedor y no en el botón, que deja de existir en cada redibujado.
document.getElementById("cintaCaptura").addEventListener("click", function (evento) {
  if (evento.target.closest("[data-abrir-datos]")) {
    abrirCapaDeDatos();
  }
});

document.getElementById("botonCerrarDatos").addEventListener("click", cerrarCapaDeDatos);

document.getElementById("botonExportarCaptura").addEventListener("click", function () {
  exportarJSON();
  // En el teléfono no existe el bloque de mensajes de la laptop, así que la
  // confirmación tiene que interrumpir: sin ella no hay forma de saber si el
  // respaldo salió, y creerlo hecho cuando no lo está es el peor caso.
  alert("Respaldo exportado. Guárdalo fuera del teléfono (Archivos, correo o la nube).");
  abrirCapaDeDatos();
});

document.getElementById("botonImportarCaptura").addEventListener("click", function () {
  document.getElementById("archivoRespaldoCaptura").click();
});

// Reusa la misma función que la laptop, incluido el aviso que resume qué
// entró: un import que no se aplicó ya pasó inadvertido una vez.
document.getElementById("archivoRespaldoCaptura").addEventListener("change", function (evento) {
  importarJSON(evento);
  cerrarCapaDeDatos();
});

function inicializar() {
  const cicloActual = asegurarCicloActual();
  generarCompromisosDelCiclo(cicloActual);
  ajustarCamposDelFormularioDeIngreso();
  renderizarTodo();
}

inicializar();
