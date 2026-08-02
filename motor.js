// ============================================================
// MOTOR
// ============================================================
//
// Todo lo que calcula, sin dibujar nada en la pantalla. Si un número
// de la app está mal, el error está aquí dentro; si algo se ve feo o
// mal acomodado, el error NO está aquí.
//
// Contiene, en este orden:
//   - Almacenamiento: la estructura de datos, leerla y guardarla.
//   - Constantes de negocio: los números que definen las reglas.
//   - Respaldo: exportar e importar el JSON.
//   - Fechas y ciclos: de qué día a qué día va un ciclo de pago.
//   - Generación automática de compromisos.
//   - Cálculos del ciclo: disponible, comprometido, presupuesto.
//   - Ingresos: las reglas y los depósitos que se derivan de ellas.
//   - Semáforo semanal y su trayectoria.
//   - Proyección multi-ciclo.
//   - Color por categoría.
//   - Días de un ciclo.
//   - Simulación: pura, nunca escribe en localStorage.
//
// Este archivo se carga PRIMERO, pero no está del todo aislado: llama a
// renderizarTodo() (que vive en arranque.js) para redibujar después de un
// cambio, y a mostrarMensaje() (en ajustes.js) al importar un respaldo.
// Eso funciona porque las funciones son globales entre archivos y esas
// llamadas ocurren cuando el usuario hace algo, no al cargar la página.
//
// Fuera de esas dos, no usa nada de los otros archivos.

// ============================================================
// ALMACENAMIENTO: estructura de datos, lectura y guardado
// ============================================================
//
// Todo lo que el usuario captura vive en un solo objeto JSON dentro de
// localStorage, un espacio de almacenamiento que el navegador reserva por
// sitio y que persiste aunque se cierre la pestaña o la app.

const CLAVE_ALMACENAMIENTO = "datosDashboardFinanzas";

// ============================================================
// CONSTANTES DE NEGOCIO
// ============================================================
//
// Nombradas y agrupadas aquí (no sueltas dentro de una función) para que
// se puedan ajustar sin tener que buscar dónde están escondidas.

// Un pendiente se resalta cuando faltan estos días o menos para su fecha
// programada. Incluye los que ya vencieron (días negativos): un compromiso
// vencido debe seguir viéndose urgente, no dejar de estarlo.
const DIAS_PARA_PENDIENTE_URGENTE = 3;

// Cuántos días del ciclo tienen que haber pasado para que el ritmo de gasto
// variable se tome en serio al proyectar. Una semana: menos que eso, un solo
// súper grande distorsiona la proyección de todo el mes.
const DIAS_MINIMOS_PARA_RITMO_REAL = 7;

// En cuántas semanas se parte un ciclo, siempre, dure lo que dure.
//
// Decisión del usuario (2 ago 2026). Antes las semanas eran de 7 días
// exactos y la última quedaba corta: un ciclo de 33 días daba cinco
// semanas, la última de 5 días. "Semana 5" no significa nada cuando el
// mes tiene cuatro, y una barra dibujada sobre eso se ve rota justo al
// final del ciclo.
//
// Ahora son cuatro semanas de longitud variable (ver
// calcularDiasDeCadaSemanaDelCiclo). Lo que no cambia es la tasa diaria:
// el presupuesto se sigue capturando por semana de 7 días, y la bolsa de
// cada semana es esa tasa por los días que de verdad tenga. Así el total
// del ciclo siempre es tasa diaria × días del ciclo, se agrupe como se
// agrupe.
const SEMANAS_POR_CICLO = 4;

// En cuántos tramos de color se parte la bolsa semanal para la barra de
// Captura. Cuatro: verde, amarillo, naranja y rojo, en cuartos exactos.
const TRAMOS_DE_COLOR_DE_LA_BARRA = 4;

// A partir de cuántos días sin exportar un respaldo (JSON) se muestra el
// aviso en pantalla. localStorage en iOS puede borrarse tras periodos de
// inactividad, así que el respaldo no es opcional.
const DIAS_PARA_AVISO_DE_RESPALDO = 7;

// Ventana de tiempo, en minutos, en la que dos gastos de la misma
// categoría y el mismo monto exacto se consideran un posible duplicado.
const MINUTOS_PARA_ALERTA_DUPLICADO = 30;

// Umbrales del semáforo del ciclo: qué porcentaje del ingreso ya conocido
// se proyecta gastar. Nombradas aparte para poder ajustarlas sin tocar la
// función que las usa.
const UMBRAL_SEMAFORO_VERDE = 0.90;
const UMBRAL_SEMAFORO_AMARILLO = 1.00;

// Cuántos ciclos hacia adelante del actual se proyectan en el calendario
// de Análisis.
const CANTIDAD_DE_CICLOS_A_PROYECTAR = 6;

// Construye la estructura vacía con la que arranca la app la primera vez
// que se abre en un dispositivo. Ningún arreglo trae datos de ejemplo:
// todo lo captura el usuario desde cero.
function crearEstructuraVacia() {
  return {
    config: {
      categorias: [],
      tarjetas: [],
      // Los atajos del muro de Captura: las subcategorías que se capturan
      // a diario y merecen un botón en la primera pantalla del teléfono.
      // Ver "ATAJOS DE CAPTURA" en captura.js.
      atajosDeCaptura: []
    },
    ciclos: [],
    ingresos: [],
    gastos: [],
    recurrentes: [],
    deudas: [],
    compromisos: [],
    // primerUso marca desde cuándo cuenta el aviso de respaldo si el
    // usuario nunca ha exportado nada. ultimoRespaldo se llena cada vez
    // que exporta un JSON (ver exportarJSON).
    primerUso: formatearFechaISO(new Date()),
    ultimoRespaldo: null
  };
}

// Lee los datos guardados en este dispositivo. Si todavía no existe nada,
// crea la estructura vacía, la guarda de inmediato y la regresa, para que
// el resto de la app siempre pueda contar con un objeto válido.
function leerDatos() {
  const textoGuardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);

  if (textoGuardado === null) {
    const datosVacios = crearEstructuraVacia();
    guardarDatos(datosVacios);
    return datosVacios;
  }

  const datos = JSON.parse(textoGuardado);
  const seCompletaronCampos = completarCamposDeRespaldoFaltantes(datos);
  const seLimpiaronCiclos = eliminarCiclosDuplicados(datos);
  const seLimpiaronIngresos = eliminarIngresosDelModeloViejo(datos);
  const seRecalcularonSemanas = recalcularLaSemanaDeLosGastos(datos);
  if (seCompletaronCampos || seLimpiaronCiclos || seLimpiaronIngresos || seRecalcularonSemanas) {
    guardarDatos(datos);
  }
  return datos;
}

// Pone al día el campo "semana" de los gastos ya guardados (2 ago 2026).
//
// Hasta ese día las semanas eran de 7 días exactos contados desde el inicio
// del ciclo, así que un ciclo de 33 días tenía cinco semanas y la última
// duraba 5 días. Ahora son siempre cuatro, de longitud variable (ver
// SEMANAS_POR_CICLO). Los gastos capturados antes del cambio traen el número
// viejo, y con él caerían en una semana que ya no existe: un gasto marcado
// como "semana 5" no lo contaría ninguna bolsa, y el disponible mentiría.
//
// Se recalcula contra el ciclo al que el gasto pertenece, no contra el ciclo
// de hoy — un gasto viejo se mide con su propio ciclo. Un gasto cuyo ciclo ya
// no exista se deja como está: no hay contra qué recalcularlo, y borrarlo o
// inventarle una semana sería peor.
function recalcularLaSemanaDeLosGastos(datos) {
  if (!Array.isArray(datos.gastos) || !Array.isArray(datos.ciclos)) {
    return false;
  }

  let seCambioAlgo = false;

  datos.gastos.forEach(function (gasto) {
    const ciclo = datos.ciclos.find(function (c) { return c.id === gasto.cicloId; });
    if (!ciclo) {
      return;
    }

    const semanaCorrecta = calcularSemanaDeLaFecha(gasto.fecha, ciclo);
    if (gasto.semana !== semanaCorrecta) {
      gasto.semana = semanaCorrecta;
      seCambioAlgo = true;
    }
  });

  return seCambioAlgo;
}

// Limpieza de una sola vez, decidida por el usuario el 30 jul 2026.
//
// Hasta esa fecha los ingresos se capturaban en tres lugares distintos: un
// ingreso real por ciclo (con cicloId guardado a mano), un monto mensual
// esperado global que servía solo para proyectar, y una lista de esperados
// sueltos por ciclo. Ese esquema no permitía lo que el usuario necesita —
// varias fuentes de ingreso conviviendo, cada una con su propia regla de
// fecha — y mezclaba "lo que espero" con "lo que cayó".
//
// El modelo nuevo (ver la sección "INGRESOS — reglas y ocurrencias") es una
// sola lista de reglas de las que los depósitos se derivan solos. Como no
// hay forma honesta de convertir los datos viejos a reglas (un ingreso
// suelto no dice si era mensual, bimestral o de una vez), el usuario pidió
// explícitamente borrarlos y recapturar limpio. Los ciclos, gastos y
// compromisos no se tocan: nada de eso referencia un ingreso por id.
//
// Un ingreso del modelo viejo se reconoce porque trae cicloId guardado; los
// nuevos nunca lo tienen, porque el ciclo se deriva de la fecha.
function eliminarIngresosDelModeloViejo(datos) {
  let seLimpioAlgo = false;

  if (Array.isArray(datos.ingresos)) {
    const ingresosDelModeloNuevo = datos.ingresos.filter(function (ingreso) {
      return ingreso.cicloId === undefined;
    });
    if (ingresosDelModeloNuevo.length !== datos.ingresos.length) {
      datos.ingresos = ingresosDelModeloNuevo;
      seLimpioAlgo = true;
    }
  }

  if (datos.ingresosEsperadosPorCiclo !== undefined) {
    delete datos.ingresosEsperadosPorCiclo;
    seLimpioAlgo = true;
  }

  if (datos.config && datos.config.ingresoRecurrenteEsperado !== undefined) {
    delete datos.config.ingresoRecurrenteEsperado;
    seLimpioAlgo = true;
  }

  return seLimpioAlgo;
}

// Limpieza de una sola vez para datos que ya venían dañados.
//
// Hubo un periodo en el que la app podía crear ciclos repetidos: el
// último día de cada ciclo no se reconocía a sí mismo (ver
// truncarAMedianoche) y cada dibujado de pantalla agregaba un ciclo más,
// siempre con el presupuesto semanal vacío. Los repetidos comparten el
// mismo id que el ciclo bueno, así que borrarlos no deja huérfano ningún
// gasto ni compromiso: todos siguen apuntando a un id que existe.
//
// De cada id se conserva el ciclo que sí tiene presupuesto capturado; si
// ninguno lo tiene, el primero. Devuelve true solo si borró algo, para
// no reescribir localStorage en cada lectura sin motivo.
function eliminarCiclosDuplicados(datos) {
  if (!Array.isArray(datos.ciclos)) {
    return false;
  }

  const ciclosPorId = {};
  datos.ciclos.forEach(function (ciclo) {
    const yaGuardado = ciclosPorId[ciclo.id];
    if (!yaGuardado) {
      ciclosPorId[ciclo.id] = ciclo;
      return;
    }
    const guardadoTienePresupuesto = yaGuardado.presupuestoSemanal && Object.keys(yaGuardado.presupuestoSemanal).length > 0;
    const nuevoTienePresupuesto = ciclo.presupuestoSemanal && Object.keys(ciclo.presupuestoSemanal).length > 0;
    if (!guardadoTienePresupuesto && nuevoTienePresupuesto) {
      ciclosPorId[ciclo.id] = ciclo;
    }
  });

  const ciclosSinRepetir = Object.keys(ciclosPorId).map(function (id) { return ciclosPorId[id]; });
  if (ciclosSinRepetir.length === datos.ciclos.length) {
    return false;
  }

  datos.ciclos = ciclosSinRepetir.sort(function (a, b) {
    return crearFechaLocal(a.fechaInicio) - crearFechaLocal(b.fechaInicio);
  });
  return true;
}

// Datos guardados antes de que existiera el aviso de respaldo (o un
// archivo importado de una versión vieja de la app) no traen primerUso
// ni ultimoRespaldo. Se completan la primera vez que se leen, para que
// el aviso funcione sin que el usuario tenga que hacer nada.
function completarCamposDeRespaldoFaltantes(datos) {
  let faltabaAlgo = false;

  if (datos.primerUso === undefined) {
    datos.primerUso = formatearFechaISO(new Date());
    faltabaAlgo = true;
  }
  if (datos.ultimoRespaldo === undefined) {
    datos.ultimoRespaldo = null;
    faltabaAlgo = true;
  }
  // Los atajos de Captura llegaron después de que la app ya estaba en uso,
  // así que unos datos guardados antes de esa fecha no traen la lista. Sin
  // esto, la primera pantalla del teléfono reventaría al recorrerla.
  if (datos.config && !Array.isArray(datos.config.atajosDeCaptura)) {
    datos.config.atajosDeCaptura = [];
    faltabaAlgo = true;
  }

  return faltabaAlgo;
}

// Guarda el objeto de datos completo en este dispositivo. Siempre se
// guarda el objeto entero, nunca piezas sueltas, para que localStorage
// nunca quede a medio actualizar.
function guardarDatos(datos) {
  localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(datos));
}

// Cuántos ids se han creado desde que se abrió la app. Existe porque la
// hora sola no alcanza: al generar los compromisos de un ciclo se crean
// veinte o más registros dentro del mismo milisegundo, así que todos
// comparten el Date.now() y lo único que los separaba era un número al azar
// de mil valores. Con veinte registros eso choca una de cada cinco veces
// (problema del cumpleaños), y se observó de verdad: dos compromisos del
// mismo ciclo con el mismo id. Un id repetido es grave — editar o borrar
// uno alcanza al otro, y cualquier conteo por id los cuenta como uno.
let idsCreadosEnEstaSesion = 0;

// Crea un identificador único para un registro nuevo (categoría, deuda,
// compromiso, etc.). El contador garantiza que no se repita dentro de esta
// carga; la hora separa entre cargas distintas; el número al azar cubre el
// caso de dos respaldos creados en el mismo instante en otro dispositivo.
function generarId(prefijo) {
  idsCreadosEnEstaSesion++;
  return prefijo + "_" + Date.now() + "_" + idsCreadosEnEstaSesion +
    "_" + Math.floor(Math.random() * 1000);
}

// Convierte texto escrito por el usuario en HTML seguro para mostrar en
// pantalla, para que un nombre o nota con caracteres especiales no rompa
// ni interfiera con el resto de la página.
function escaparHTML(texto) {
  const contenedorTemporal = document.createElement("div");
  contenedorTemporal.textContent = texto;
  return contenedorTemporal.innerHTML;
}

// Da formato de moneda mexicana a un número, para que las listas se lean
// como dinero ("$1,234.50") y no como números sueltos.
//
// El menos va antes del signo de pesos ("-$200.00"), no en medio
// ("$-200.00"), que es como sale si se concatena el "$" a secas. Importa
// porque hay varios números que pueden ser negativos y se leen a diario: el
// disponible de un ciclo que no cierra, y lo que queda de una bolsa semanal
// cuando ya se pasó.
function formatearMoneda(monto) {
  const numero = Number(monto);
  const signo = numero < 0 ? "-" : "";
  return signo + "$" + Math.abs(numero).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================
// RESPALDO: exportar e importar JSON
// ============================================================

function exportarJSON() {
  const datos = leerDatos();
  const fecha = formatearFechaISO(new Date());

  // Se registra la fecha de este respaldo en los propios datos antes de
  // generar el archivo, para que quede incluida en el JSON exportado y
  // el aviso de respaldo pueda calcularse contra ella la próxima vez.
  datos.ultimoRespaldo = fecha;
  guardarDatos(datos);

  const contenido = JSON.stringify(datos, null, 2);
  const archivo = new Blob([contenido], { type: "application/json" });

  const enlaceDescarga = document.createElement("a");
  enlaceDescarga.href = URL.createObjectURL(archivo);
  enlaceDescarga.download = "ciclo-respaldo-" + fecha + ".json";
  enlaceDescarga.click();

  URL.revokeObjectURL(enlaceDescarga.href);
  mostrarMensaje("Respaldo exportado.");
  renderizarAvisoRespaldo();
}

function importarJSON(evento) {
  const archivoElegido = evento.target.files[0];
  if (!archivoElegido) {
    return;
  }

  const lector = new FileReader();

  lector.onload = function () {
    let datosImportados;

    try {
      datosImportados = JSON.parse(lector.result);
    } catch (error) {
      avisarResultadoDeImportacion("Ese archivo no es un JSON válido. No se importó nada.");
      return;
    }

    // Un JSON válido puede no ser un respaldo de esta app (otro archivo
    // cualquiera, o uno a medio escribir). Sin esta comprobación se
    // guardaba igual y la app quedaba sin datos, que es peor que no
    // importar nada.
    if (!esRespaldoDeLaApp(datosImportados)) {
      avisarResultadoDeImportacion(
        "Ese archivo no parece un respaldo de esta app. No se importó nada."
      );
      return;
    }

    guardarDatos(datosImportados);

    // Importar reemplaza todo, así que la simulación que estuviera en curso
    // ya no corresponde a nada: se descarta para que la pantalla se rearme
    // desde los datos nuevos. Sin esto, una simulación con cambios sin
    // guardar sobrevivía al import y la pantalla seguía mostrando lo viejo.
    datosSimulados = null;
    compromisosMaterializadosSimulacion = null;
    indiceCicloEnfocadoSimulacion = 0;

    renderizarTodo();

    const ciclo = asegurarCicloActual();
    avisarResultadoDeImportacion(
      "Datos importados." +
      "\n\nIngresos capturados: " + (datosImportados.ingresos || []).length +
      "\nIngreso del ciclo: " + formatearMoneda(calcularIngresosDelCiclo(ciclo, leerDatos())) +
      "\nPagos del ciclo: " + datosImportados.compromisos.filter(function (c) {
        return c.cicloId === ciclo.id;
      }).length
    );
  };

  lector.onerror = function () {
    avisarResultadoDeImportacion("No se pudo leer el archivo. No se importó nada.");
  };

  lector.readAsText(archivoElegido);
  evento.target.value = "";
}

// Comprobación mínima de que el archivo es un respaldo de esta app: los
// arreglos que el resto del código da por hechos.
function esRespaldoDeLaApp(datos) {
  return datos !== null && typeof datos === "object" &&
    datos.config && Array.isArray(datos.config.categorias) &&
    Array.isArray(datos.ciclos) &&
    Array.isArray(datos.ingresos) &&
    Array.isArray(datos.gastos) &&
    Array.isArray(datos.compromisos);
}

// El resultado se dice en un aviso del navegador y no solo en el bloque de
// depuración: ese bloque vive colapsado al fondo de la página, así que en el
// teléfono uno importaba y no se enteraba de si había funcionado. Se
// resumen los datos importados para poder confirmar de un vistazo que
// entró el archivo correcto.
function avisarResultadoDeImportacion(texto) {
  mostrarMensaje(texto.split("\n")[0]);
  alert(texto);
}

// Cuántos días completos han pasado desde una fecha ("YYYY-MM-DD") hasta
// hoy. Mismo criterio de horas en cero que calcularDiasHastaFecha, para
// que un respaldo hecho más temprano hoy cuente como "0 días".
function calcularDiasDesdeFecha(fechaTexto) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = crearFechaLocal(fechaTexto);
  const milisegundosPorDia = 1000 * 60 * 60 * 24;
  return Math.round((hoy - fecha) / milisegundosPorDia);
}

// El aviso se calcula contra el último respaldo o, si nunca ha habido
// uno, contra la fecha en que se empezó a usar la app en este
// dispositivo — así una instalación nueva no dispara el aviso de
// inmediato, pero tampoco se le perdona para siempre no respaldar.
function necesitaAvisoDeRespaldo(datos) {
  const fechaDeReferencia = datos.ultimoRespaldo || datos.primerUso;
  return calcularDiasDesdeFecha(fechaDeReferencia) > DIAS_PARA_AVISO_DE_RESPALDO;
}

// Muestra u oculta el aviso de respaldo. No hay botón para cerrarlo a
// mano: desaparece solo en cuanto se exporta un JSON, porque en ese
// momento deja de cumplirse la condición que lo activa.
function renderizarAvisoRespaldo() {
  const datos = leerDatos();
  const elementoAviso = document.getElementById("avisoRespaldo");

  if (necesitaAvisoDeRespaldo(datos)) {
    elementoAviso.textContent = "No has hecho un respaldo (exportar JSON) en más de " + DIAS_PARA_AVISO_DE_RESPALDO + " días.";
    elementoAviso.style.display = "block";
  } else {
    elementoAviso.style.display = "none";
  }
}

// ============================================================
// FECHAS Y CICLOS
// ============================================================
//
// El ciclo va del día en que cae el ingreso mensual de un mes al día
// anterior a como caiga el siguiente, no del 1 al 31. Esta sección
// calcula en qué ciclo cae una fecha cualquiera, y crea el registro del
// ciclo la primera vez que hace falta — el usuario nunca "abre" un ciclo
// a mano.

// Dos dígitos entrega el input date como texto "YYYY-MM-DD". Se arma la
// fecha con año, mes y día por separado (en vez de pasarle el texto
// completo a "new Date") porque de la otra forma JavaScript interpreta el
// texto como UTC y en algunas zonas horarias el día se corre uno hacia atrás.
function crearFechaLocal(textoFecha) {
  const partes = textoFecha.split("-");
  const anio = Number(partes[0]);
  const mes = Number(partes[1]) - 1;
  const dia = Number(partes[2]);
  return new Date(anio, mes, dia);
}

// Deja una fecha en la medianoche de su propio día, tirando la hora.
//
// Existe por un bug real: "new Date()" trae la hora actual (por ejemplo,
// las 14:30), mientras que todas las fechas guardadas por la app se
// reconstruyen con crearFechaLocal, que siempre da medianoche. Comparar
// "hoy a las 14:30" contra "medianoche del último día del ciclo" daba
// falso justo el último día de cada ciclo, y la app creía que ese ciclo
// no existía. Cualquier fecha que vaya a compararse contra las fechas
// guardadas tiene que pasar por aquí primero.
function truncarAMedianoche(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

// Hace el camino inverso: de un objeto Date a texto "YYYY-MM-DD", para
// guardarlo o compararlo como el resto de las fechas de la app.
function formatearFechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return anio + "-" + mes + "-" + dia;
}

// Cuántos días tiene un mes. El truco es que el "día 0" del mes siguiente
// es, por definición, el último día del mes actual.
function diasEnElMes(anio, mesIndiceCero) {
  return new Date(anio, mesIndiceCero + 1, 0).getDate();
}

// Si el día pedido (de corte, o de pago, o base de un recurrente) no
// existe en ese mes — el caso típico es el 29, 30 o 31 en febrero — se usa
// el último día del mes en su lugar.
function diaAjustadoAlMes(anio, mesIndiceCero, dia) {
  return Math.min(dia, diasEnElMes(anio, mesIndiceCero));
}

function sumarDias(fecha, cantidadDeDias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + cantidadDeDias);
  return resultado;
}

// Suma meses de calendario conservando el día cuando se puede (y usando
// el último día del mes cuando el día original no existe ahí — ej. el 31
// sumado a un mes que solo tiene 30).
function sumarMeses(fecha, cantidadDeMeses) {
  const diaOriginal = fecha.getDate();
  const resultado = new Date(fecha.getFullYear(), fecha.getMonth() + cantidadDeMeses, 1);
  const diaMaximo = diasEnElMes(resultado.getFullYear(), resultado.getMonth());
  resultado.setDate(Math.min(diaOriginal, diaMaximo));
  return resultado;
}

// El ingreso mensual del usuario cae un día antes de que termine el mes
// (el 30 en un mes de 31 días, el 29 en uno de 30, el 27 en febrero) y,
// si ese día cae en sábado o domingo, el banco lo deposita el viernes
// anterior. Esta función calcula esa fecha para un mes dado — es el punto
// en el que arranca el ciclo de ese mes. Los días festivos entre semana
// también recorren el depósito, pero no hay una regla fija para calcular
// cuáles (cambian cada año); esos casos quedan fuera a propósito, porque
// el ingreso siempre se captura con su fecha real de todos modos.
function calcularFechaDeCorteDelMes(anio, mesIndiceCero) {
  const diaAntesDeFinDeMes = diasEnElMes(anio, mesIndiceCero) - 1;
  const fecha = new Date(anio, mesIndiceCero, diaAntesDeFinDeMes);

  if (fecha.getDay() === 6) {
    return sumarDias(fecha, -1);
  }
  if (fecha.getDay() === 0) {
    return sumarDias(fecha, -2);
  }
  return fecha;
}

// La segunda regla de depósito que maneja el usuario: hay ingresos que
// caen el primer día hábil del mes. Si el día 1 cae en sábado el depósito
// se recorre al lunes 3; si cae en domingo, al lunes 2. Nunca se adelanta
// al mes anterior, a diferencia de la regla de fin de mes: un depósito de
// "principios de mes" que llegara antes del día 1 no tendría sentido.
//
// Igual que en calcularFechaDeCorteDelMes, los días festivos entre semana
// quedan fuera a propósito: cambian cada año y no hay regla fija. Cuando
// uno recorre el depósito, el usuario ajusta esa ocurrencia a mano (ver
// "ajustes" en la sección de ingresos) y ninguna otra se entera.
function calcularPrimerDiaHabilDelMes(anio, mesIndiceCero) {
  const primerDia = new Date(anio, mesIndiceCero, 1);

  if (primerDia.getDay() === 6) {
    return sumarDias(primerDia, 2);
  }
  if (primerDia.getDay() === 0) {
    return sumarDias(primerDia, 1);
  }
  return primerDia;
}

// Dado un mes, calcula en qué fecha exacta empieza el ciclo que arranca
// ahí.
function calcularInicioDeCicloParaFecha(fecha) {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth();
  const candidatoEsteMes = calcularFechaDeCorteDelMes(anio, mes);

  if (candidatoEsteMes <= fecha) {
    return candidatoEsteMes;
  }

  // La fecha es anterior al corte de este mes: el ciclo que la contiene
  // empezó el mes anterior.
  const mesAnterior = mes === 0 ? 11 : mes - 1;
  const anioDelMesAnterior = mes === 0 ? anio - 1 : anio;
  return calcularFechaDeCorteDelMes(anioDelMesAnterior, mesAnterior);
}

// El ciclo termina un día antes de que empiece el siguiente.
function calcularFinDeCiclo(fechaInicio) {
  const mesSiguiente = fechaInicio.getMonth() === 11 ? 0 : fechaInicio.getMonth() + 1;
  const anioDelMesSiguiente = fechaInicio.getMonth() === 11 ? fechaInicio.getFullYear() + 1 : fechaInicio.getFullYear();
  const inicioDelSiguienteCiclo = calcularFechaDeCorteDelMes(anioDelMesSiguiente, mesSiguiente);
  return sumarDias(inicioDelSiguienteCiclo, -1);
}

// El id de un ciclo es el año-mes en el que termina (ej. un ciclo de 29 de
// julio a 28 de agosto se llama "2026-08"), porque es el mes en el que
// vive la mayoría de sus días y en el que se cierra.
function generarIdDeCiclo(fechaFin) {
  const anio = fechaFin.getFullYear();
  const mes = String(fechaFin.getMonth() + 1).padStart(2, "0");
  return anio + "-" + mes;
}

// A qué ciclo pertenece una fecha, sin crear ni guardar nada (a diferencia
// de obtenerOCrearCicloParaFecha, que sí escribe en localStorage). Sirve
// para responder "¿en qué ciclo cae esto?" en vistas previas y avisos, sin
// el efecto secundario de materializar un ciclo que quizá no exista.
function calcularIdDeCicloParaFecha(fecha) {
  return generarIdDeCiclo(calcularFinDeCiclo(calcularInicioDeCicloParaFecha(fecha)));
}

// Calcula el ciclo que sigue a uno dado, sin guardarlo en ningún lado —
// a diferencia de obtenerOCrearCicloParaFecha, esta función nunca toca
// localStorage. Sirve tanto para la proyección multi-ciclo (ciclos que
// todavía no existen) como, más abajo, para saber cuál sería "el
// siguiente ciclo" al dar de alta un recurrente bimestral.
function calcularSiguienteCicloSimulado(cicloAnterior) {
  const fechaInicio = sumarDias(crearFechaLocal(cicloAnterior.fechaFin), 1);
  const fechaFin = calcularFinDeCiclo(fechaInicio);
  return {
    id: generarIdDeCiclo(fechaFin),
    fechaInicio: formatearFechaISO(fechaInicio),
    fechaFin: formatearFechaISO(fechaFin)
  };
}

// Encadena calcularSiguienteCicloSimulado la cantidad de veces que haga
// falta, a partir de un ciclo base (normalmente el ciclo actual real).
function generarCiclosSimulados(cicloBase, cantidadDeCiclos) {
  const ciclos = [];
  let anterior = cicloBase;
  for (let i = 0; i < cantidadDeCiclos; i++) {
    anterior = calcularSiguienteCicloSimulado(anterior);
    ciclos.push(anterior);
  }
  return ciclos;
}

// Busca el ciclo que contiene una fecha dada. Si no existe todavía (por
// ejemplo, la primera vez que se abre la app, o al registrar un ingreso
// con fecha pasada que cae fuera de cualquier ciclo ya creado), lo crea y
// lo guarda en ese momento.
function obtenerOCrearCicloParaFecha(fechaConHoraPosible) {
  const datos = leerDatos();

  // Se compara siempre día contra día, nunca instante contra instante:
  // si aquí entrara "hoy a las 14:30", el último día del ciclo quedaría
  // fuera de su propio ciclo y la app crearía un ciclo duplicado.
  const fecha = truncarAMedianoche(fechaConHoraPosible);

  const cicloExistente = datos.ciclos.find(function (ciclo) {
    return fecha >= crearFechaLocal(ciclo.fechaInicio) && fecha <= crearFechaLocal(ciclo.fechaFin);
  });

  if (cicloExistente) {
    return cicloExistente;
  }

  const fechaInicio = calcularInicioDeCicloParaFecha(fecha);
  const fechaFin = calcularFinDeCiclo(fechaInicio);

  // El presupuesto semanal (comida, transporte...) es un estimado estable,
  // no algo que se decida ciclo a ciclo — así que un ciclo nuevo hereda los
  // montos del ciclo anterior más reciente en vez de arrancar en blanco.
  // Se puede seguir ajustando para este ciclo específico en cualquier
  // momento, sin que eso afecte a los ciclos ya cerrados ni a los futuros.
  const cicloAnterior = datos.ciclos
    .filter(function (ciclo) { return crearFechaLocal(ciclo.fechaFin) < fechaInicio; })
    .sort(function (a, b) { return crearFechaLocal(b.fechaFin) - crearFechaLocal(a.fechaFin); })[0];

  const nuevoCiclo = {
    id: generarIdDeCiclo(fechaFin),
    fechaInicio: formatearFechaISO(fechaInicio),
    fechaFin: formatearFechaISO(fechaFin),
    presupuestoSemanal: cicloAnterior ? Object.assign({}, cicloAnterior.presupuestoSemanal) : {}
  };

  datos.ciclos.push(nuevoCiclo);
  guardarDatos(datos);
  return nuevoCiclo;
}

// Atajo para el caso más común: el ciclo que contiene el día de hoy.
function asegurarCicloActual() {
  return obtenerOCrearCicloParaFecha(new Date());
}

// Cuál es el presupuesto semanal que le toca a un ciclo.
//
// Copiar el presupuesto del ciclo anterior en el momento de crear el
// ciclo nuevo no alcanza: un ciclo futuro puede nacer antes de que el
// presupuesto exista (pasa al registrar un ingreso con fecha adelantada,
// que crea el ciclo de esa fecha en ese instante). Ese ciclo se quedaba
// con el presupuesto vacío para siempre, y el gasto variable proyectado
// daba cero.
//
// La regla es: un ciclo usa su propio presupuesto si alguna vez se le
// capturó uno; si no, hereda el del ciclo anterior más reciente que sí
// tenga. "Tener uno" significa tener al menos una categoría anotada — un
// presupuesto de 0 sí cuenta como decisión tomada, porque guardar el
// formulario escribe todas las categorías, incluidas las que valen 0.
function obtenerPresupuestoSemanalVigente(ciclo, datos) {
  if (ciclo.presupuestoSemanal && Object.keys(ciclo.presupuestoSemanal).length > 0) {
    return ciclo.presupuestoSemanal;
  }

  const ciclosAnterioresConPresupuesto = datos.ciclos
    .filter(function (otro) {
      return crearFechaLocal(otro.fechaFin) < crearFechaLocal(ciclo.fechaInicio) &&
        otro.presupuestoSemanal && Object.keys(otro.presupuestoSemanal).length > 0;
    })
    .sort(function (a, b) { return crearFechaLocal(b.fechaFin) - crearFechaLocal(a.fechaFin); });

  return ciclosAnterioresConPresupuesto.length > 0
    ? ciclosAnterioresConPresupuesto[0].presupuestoSemanal
    : {};
}

// ============================================================
// GENERACIÓN AUTOMÁTICA DE COMPROMISOS
// ============================================================
//
// Un compromiso puede venir de un recurrente, una deuda o una tarjeta.
// Esta sección revisa las reglas activas y, para el ciclo dado, crea los
// compromisos que le correspondan — sin duplicar los que ya existen.

// Editar un recurrente o una deuda no debe dejar "huérfanos" los
// compromisos que ya se generaron de esa regla y que siguen sin pagar
// — si no, la edición se siente rota (arreglas el monto pero el
// pendiente en la pantalla sigue mostrando el número viejo). Los ya
// pagados nunca se tocan: son historia cerrada, no una proyección.
function obtenerCompromisosPendientesDeOrigen(datos, origen, origenId) {
  return datos.compromisos.filter(function (c) { return c.origen === origen && c.origenId === origenId && !c.pagado; });
}

// "cambios" es un objeto con los campos del compromiso que deben quedar
// igual que la regla editada (típicamente nombre y montoEstimado).
function actualizarCompromisosPendientesDeOrigen(datos, origen, origenId, cambios) {
  obtenerCompromisosPendientesDeOrigen(datos, origen, origenId).forEach(function (compromiso) {
    Object.assign(compromiso, cambios);
  });
}

// Cuando una regla se desactiva (ej. se liquidó una deuda antes de
// tiempo), un compromiso que ya se generó pero sigue sin pagar ya no va
// a suceder de verdad — dejarlo ahí lo contaría de más en compromisos
// pendientes y en la proyección de cierre para siempre. Se borra. Lo ya
// pagado no se toca.
function eliminarCompromisosPendientesDeOrigen(datos, origen, origenId) {
  datos.compromisos = datos.compromisos.filter(function (c) {
    return !(c.origen === origen && c.origenId === origenId && !c.pagado);
  });
}

// Evita duplicados: un mismo origen no puede generar dos veces un
// compromiso con la misma fecha programada.
function agregarCompromisoSiNoExiste(datos, ciclo, origen, origenId, nombre, fecha, montoEstimado, pagoNde) {
  const fechaTexto = formatearFechaISO(fecha);
  const yaExiste = datos.compromisos.some(function (compromiso) {
    return compromiso.origen === origen && compromiso.origenId === origenId && compromiso.fechaProgramada === fechaTexto;
  });

  if (yaExiste) {
    return;
  }

  datos.compromisos.push({
    id: generarId("cmp"),
    cicloId: ciclo.id,
    origen: origen,
    origenId: origenId,
    nombre: nombre,
    fechaProgramada: fechaTexto,
    montoEstimado: montoEstimado,
    montoReal: null,
    pagado: false,
    pagoNde: pagoNde
  });
}

// Un evento "mensual" ocurre una vez al mes en un día fijo. Como el ciclo
// cruza dos meses de calendario, se prueba ese día tanto en el mes en que
// empieza el ciclo como en el mes en que termina, y se devuelven TODOS los
// que caigan dentro del rango.
//
// Devuelve una lista y no una sola fecha porque los ciclos no miden lo mismo
// (van de 28 a 33 días), así que en uno largo el mismo día del mes cae dos
// veces: el ciclo 28 ago – 28 sep contiene dos días 28. Antes se devolvía la
// primera y la segunda se descartaba en silencio; como el ciclo siguiente
// arranca el 29, ese cobro no caía en ningún ciclo y desaparecía del sistema.
// Medido con un barrido de 36 ciclos: los días base 26, 27, 28 y 29 perdían
// entre 1 y 13 cobros cada uno en tres años.
function calcularFechasEnCicloParaDiaBase(ciclo, diaBase) {
  const inicio = crearFechaLocal(ciclo.fechaInicio);
  const fin = crearFechaLocal(ciclo.fechaFin);

  const mesesAProbar = [
    { anio: inicio.getFullYear(), mes: inicio.getMonth() },
    { anio: fin.getFullYear(), mes: fin.getMonth() }
  ];

  const fechas = [];
  mesesAProbar.forEach(function (referencia) {
    const candidato = new Date(
      referencia.anio,
      referencia.mes,
      diaAjustadoAlMes(referencia.anio, referencia.mes, diaBase)
    );
    if (candidato < inicio || candidato > fin) {
      return;
    }
    // Si el ciclo no cruzara mes, los dos candidatos serían el mismo día.
    const yaEsta = fechas.some(function (fecha) {
      return formatearFechaISO(fecha) === formatearFechaISO(candidato);
    });
    if (!yaEsta) {
      fechas.push(candidato);
    }
  });

  return fechas;
}

// Compatibilidad para quien solo puede tener una: devuelve la primera.
function calcularPrimeraFechaEnCicloParaDiaBase(ciclo, diaBase) {
  const fechas = calcularFechasEnCicloParaDiaBase(ciclo, diaBase);
  return fechas.length > 0 ? fechas[0] : null;
}

// Un recurrente "quincenal" ocurre dos veces al mes: en diaBase, y quince
// días después (pasando al mes siguiente si se sale del actual). Se
// calculan las ocurrencias en los dos meses que toca el ciclo y se filtran
// las que caen dentro del rango.
function calcularFechasQuincenalesEnCiclo(ciclo, diaBase) {
  const inicio = crearFechaLocal(ciclo.fechaInicio);
  const fin = crearFechaLocal(ciclo.fechaFin);
  const mesesAProbar = [
    { anio: inicio.getFullYear(), mes: inicio.getMonth() },
    { anio: fin.getFullYear(), mes: fin.getMonth() }
  ];

  const candidatas = [];
  mesesAProbar.forEach(function (referencia) {
    const diasDelMes = diasEnElMes(referencia.anio, referencia.mes);
    candidatas.push(new Date(referencia.anio, referencia.mes, diaAjustadoAlMes(referencia.anio, referencia.mes, diaBase)));

    const segundaQuincena = diaBase + 15;
    if (segundaQuincena <= diasDelMes) {
      candidatas.push(new Date(referencia.anio, referencia.mes, segundaQuincena));
    } else {
      const mesSiguiente = referencia.mes === 11 ? 0 : referencia.mes + 1;
      const anioSiguiente = referencia.mes === 11 ? referencia.anio + 1 : referencia.anio;
      candidatas.push(new Date(anioSiguiente, mesSiguiente, segundaQuincena - diasDelMes));
    }
  });

  const fechasVistas = new Set();
  return candidatas.filter(function (fecha) {
    if (fecha < inicio || fecha > fin) {
      return false;
    }
    const iso = formatearFechaISO(fecha);
    if (fechasVistas.has(iso)) {
      return false;
    }
    fechasVistas.add(iso);
    return true;
  });
}

// Un recurrente "bimestral" solo aplica cada dos ciclos, contando desde su
// cicloDeInicio. Se compara por diferencia de meses entre los ids de
// ciclo (formato "YYYY-MM"): si la diferencia es par, este ciclo le toca.
function estaEnFaseBimestral(ciclo, cicloDeInicioId) {
  const partesInicio = cicloDeInicioId.split("-").map(Number);
  const partesActual = ciclo.id.split("-").map(Number);
  const diferenciaEnMeses = (partesActual[0] - partesInicio[0]) * 12 + (partesActual[1] - partesInicio[1]);
  return diferenciaEnMeses >= 0 && diferenciaEnMeses % 2 === 0;
}

// Un recurrente sin vigenciaHasta se repite para siempre, como hasta ahora.
// Uno con vigenciaHasta deja de generar compromisos cuya fecha caiga
// después de ese límite — el plazo forzoso ya terminó (ej. una póliza de
// seguro de 12 meses).
function fechaDentroDeLaVigencia(fecha, vigenciaHasta) {
  if (!vigenciaHasta) {
    return true;
  }
  return fecha <= crearFechaLocal(vigenciaHasta);
}

// Misma lógica de ramas (mensual/quincenal/bimestral + vigencia) que
// antes generaba compromisos directamente, pero aquí es pura: arma una
// lista de candidatos en vez de escribir en datos.compromisos. Así la
// puede usar tanto la generación real (ciclo actual, se persiste) como
// la proyección multi-ciclo (ciclos simulados, nunca se persiste) sin
// duplicar las reglas de fechas.
function calcularCandidatosDeRecurrentesParaCiclo(ciclo, recurrentesActivos) {
  const candidatos = [];

  recurrentesActivos.forEach(function (recurrente) {
    if (recurrente.frecuencia === "mensual") {
      // Todas las veces que su día cae en este ciclo, no solo la primera: en
      // un ciclo largo son dos cobros reales del mismo servicio.
      calcularFechasEnCicloParaDiaBase(ciclo, recurrente.diaBase).forEach(function (fecha) {
        if (fechaDentroDeLaVigencia(fecha, recurrente.vigenciaHasta)) {
          candidatos.push({ origen: "recurrente", origenId: recurrente.id, nombre: recurrente.nombre, fechaProgramada: formatearFechaISO(fecha), montoEstimado: recurrente.montoEstimado, pagoNde: null });
        }
      });
    } else if (recurrente.frecuencia === "quincenal") {
      calcularFechasQuincenalesEnCiclo(ciclo, recurrente.diaBase).forEach(function (fecha) {
        if (fechaDentroDeLaVigencia(fecha, recurrente.vigenciaHasta)) {
          candidatos.push({ origen: "recurrente", origenId: recurrente.id, nombre: recurrente.nombre, fechaProgramada: formatearFechaISO(fecha), montoEstimado: recurrente.montoEstimado, pagoNde: null });
        }
      });
    } else if (recurrente.frecuencia === "bimestral") {
      if (recurrente.cicloDeInicio && estaEnFaseBimestral(ciclo, recurrente.cicloDeInicio)) {
        // Aquí sí una sola, a diferencia del mensual: un bimestral cae cada
        // dos meses, y las dos fechas que un ciclo largo puede contener son
        // de meses consecutivos — cobrarlas las dos sería cobrar de más.
        const fecha = calcularPrimeraFechaEnCicloParaDiaBase(ciclo, recurrente.diaBase);
        if (fecha && fechaDentroDeLaVigencia(fecha, recurrente.vigenciaHasta)) {
          candidatos.push({ origen: "recurrente", origenId: recurrente.id, nombre: recurrente.nombre, fechaProgramada: formatearFechaISO(fecha), montoEstimado: recurrente.montoEstimado, pagoNde: null });
        }
      }
    }
  });

  return candidatos;
}

// Todos los números de pago (k+1, k+2, ...) de una deuda cuya fecha cae
// dentro de un rango cualquiera, empezando en el pago real siguiente
// (deuda.pagosRealizados). Como la fecha de cada pago es creciente en k,
// basta con avanzar y cortar en cuanto nos pasamos del fin del rango —
// así un mismo ciclo puede capturar 0, 1 o más de un pago (típico en
// deudas quincenales dentro de un ciclo de ~30 días). Al depender solo
// de fechaPrimerPago y del número de pago (nunca de "avanzar" un
// contador ciclo a ciclo), cada rango se calcula de forma independiente
// de los demás — es imposible que un ciclo contamine a otro.
// La fecha del pago N de una deuda: fechaPrimerPago es, por definición, la
// fecha del pago #1 (cero intervalos después), así que el pago N cae
// (N-1) intervalos después. La comparten calcularNumerosDePagoEnRango
// (fechas de los pagos que le tocan a cada ciclo) y calcularEstadoDeDeuda
// (fechaLiquidacion es, con esta misma regla, la fecha del último pago).
function calcularFechaDelPagoNumero(deuda, numeroDePago) {
  const fechaPrimerPago = crearFechaLocal(deuda.fechaPrimerPago);
  const intervalosTranscurridos = numeroDePago - 1;
  return deuda.frecuencia === "quincenal"
    ? sumarDias(fechaPrimerPago, intervalosTranscurridos * 15)
    : sumarMeses(fechaPrimerPago, intervalosTranscurridos);
}

function calcularNumerosDePagoEnRango(deuda, fechaInicioRango, fechaFinRango) {
  const numeros = [];
  let k = deuda.pagosRealizados;

  while (k < deuda.pagosTotales) {
    const fechaPago = calcularFechaDelPagoNumero(deuda, k + 1);

    if (fechaPago > fechaFinRango) {
      break;
    }
    if (fechaPago >= fechaInicioRango) {
      numeros.push({ numeroDePago: k + 1, fecha: fechaPago });
    }
    k++;
  }

  return numeros;
}

// Junta las fórmulas de deuda de SPEC.md en un solo lugar, para que
// Configuración y Análisis lean el mismo cálculo en vez de duplicarlo.
// saldoManual, cuando existe, sustituye al saldo calculado — igual que ya
// hacía (por separado) la lista de deudas en Configuración.
function calcularEstadoDeDeuda(deuda) {
  const montoTotalAPagar = deuda.montoPorPago * deuda.pagosTotales;
  const costoDelCredito = montoTotalAPagar - deuda.montoSolicitado;
  const porcentajeSobrante = costoDelCredito / deuda.montoSolicitado;

  const saldoCalculado = deuda.montoPorPago * (deuda.pagosTotales - deuda.pagosRealizados);
  const hayValorManual = deuda.saldoManual !== null && deuda.saldoManual !== undefined;
  const saldoRestante = hayValorManual ? deuda.saldoManual : saldoCalculado;
  const porcentajePagado = 1 - (saldoRestante / montoTotalAPagar);

  return {
    montoTotalAPagar: montoTotalAPagar,
    costoDelCredito: costoDelCredito,
    porcentajeSobrante: porcentajeSobrante,
    saldoRestante: saldoRestante,
    porcentajePagado: porcentajePagado,
    fechaLiquidacion: calcularFechaDelPagoNumero(deuda, deuda.pagosTotales)
  };
}

function calcularCandidatosDeDeudaParaCiclo(ciclo, deuda) {
  if (!deuda.activa) {
    return [];
  }
  const inicio = crearFechaLocal(ciclo.fechaInicio);
  const fin = crearFechaLocal(ciclo.fechaFin);

  return calcularNumerosDePagoEnRango(deuda, inicio, fin).map(function (item) {
    return { origen: "deuda", origenId: deuda.id, nombre: deuda.nombre, fechaProgramada: formatearFechaISO(item.fecha), montoEstimado: deuda.montoPorPago, pagoNde: item.numeroDePago + " de " + deuda.pagosTotales };
  });
}

function calcularCandidatosDeDeudasParaCiclo(ciclo, deudas) {
  return deudas.reduce(function (acumulado, deuda) {
    return acumulado.concat(calcularCandidatosDeDeudaParaCiclo(ciclo, deuda));
  }, []);
}

// Punto de entrada único para "qué compromisos le tocan a este ciclo",
// sea real o simulado. Las tarjetas quedan fuera a propósito: su pago
// depende de gastos a crédito que en un ciclo futuro todavía no existen,
// así que no son proyectables sin inventar un número.
function calcularCandidatosDelCiclo(ciclo, datos) {
  const recurrentesActivos = datos.recurrentes.filter(function (r) { return r.activo; });
  return calcularCandidatosDeRecurrentesParaCiclo(ciclo, recurrentesActivos)
    .concat(calcularCandidatosDeDeudasParaCiclo(ciclo, datos.deudas));
}

// Corte y pago son fechas distintas: una compra posterior al corte entra
// al pago siguiente, no al inmediato. Dado el día de pago de una
// instancia concreta, el corte que le corresponde es el mismo mes si
// diaPago cae después de diaCorte (ej. corte 5, pago 20); si no, el
// corte fue el mes anterior (ej. corte 25, pago 10 — el pago de este mes
// cubre lo que se cortó a fin del mes pasado). El periodo es del día
// siguiente al corte anterior a ese, hasta ese corte, inclusive.
function calcularPeriodoDeCorteParaPago(tarjeta, fechaPago) {
  const corteEsDelMismoMes = tarjeta.diaPago > tarjeta.diaCorte;
  const mesBaseDelCorte = corteEsDelMismoMes ? fechaPago : sumarMeses(fechaPago, -1);
  const finPeriodo = new Date(mesBaseDelCorte.getFullYear(), mesBaseDelCorte.getMonth(), diaAjustadoAlMes(mesBaseDelCorte.getFullYear(), mesBaseDelCorte.getMonth(), tarjeta.diaCorte));
  const corteAnterior = sumarMeses(finPeriodo, -1);
  const inicioPeriodo = sumarDias(corteAnterior, 1);

  return { inicio: inicioPeriodo, fin: finPeriodo };
}

// Camino inverso al de arriba: dada la fecha de una compra, en qué fecha
// se paga. Primero, cuál es el corte que la captura — el primer día de
// corte igual o posterior a la compra (el día del corte todavía cuenta
// dentro de ese periodo, mismo criterio que usa calcularPagoTarjeta).
function calcularCorteQueCapturaLaCompra(tarjeta, fechaCompra) {
  const anio = fechaCompra.getFullYear();
  const mes = fechaCompra.getMonth();
  const corteDeEsteMes = new Date(anio, mes, diaAjustadoAlMes(anio, mes, tarjeta.diaCorte));

  if (corteDeEsteMes >= fechaCompra) {
    return corteDeEsteMes;
  }
  return sumarMeses(corteDeEsteMes, 1);
}

// Y de ese corte, la fecha en que se cobra: el mismo mes si el día de
// pago es posterior al de corte (ej. corte 5, pago 20), o el mes
// siguiente si no (ej. corte 25, pago 12). Es la misma regla de
// calcularPeriodoDeCorteParaPago, leída al revés.
//
// Existe porque la simulación necesita saber en qué CICLO cae realmente
// la primera mensualidad de una compra diferida: mover un pago del 5 al
// 26 de agosto, con corte el 25, recorre su primer cargo un mes entero.
function calcularFechaDePrimerPagoDeTarjeta(tarjeta, fechaCompra) {
  const corte = calcularCorteQueCapturaLaCompra(tarjeta, fechaCompra);
  const corteEsDelMismoMes = tarjeta.diaPago > tarjeta.diaCorte;
  const mesDelPago = corteEsDelMismoMes ? corte : sumarMeses(corte, 1);

  return new Date(
    mesDelPago.getFullYear(),
    mesDelPago.getMonth(),
    diaAjustadoAlMes(mesDelPago.getFullYear(), mesDelPago.getMonth(), tarjeta.diaPago)
  );
}

// pagoTarjeta = compras a crédito de esa tarjeta dentro de su periodo de
// corte. Las deudas MSI quedan fuera a propósito: en este modelo son
// compromisos independientes pagados por débito, igual que un préstamo
// — no están ligadas a ninguna tarjeta (ver SPEC.md).
// Cuánto de una compra a crédito se cobra en un pago concreto de la tarjeta.
//
// Una compra de contado aporta su monto completo a un solo pago. Una a N
// meses aporta monto/N a N pagos consecutivos, empezando por el que le
// tocaría si fuera de contado. Sin esto, una compra de $12,000 a 12 meses
// caía entera en el primer corte: la app creía que se pagaban $12,000 de
// golpe y luego que no se debía nada durante un año.
//
// Las mensualidades se ubican por fechas reales (la del primer pago, más un
// mes cada vez), que es el mismo criterio que ya usa la simulación para
// repartir un compromiso diferido. No se cuentan ciclos: un ciclo no mide un
// mes exacto y el reparto se iría desfasando.
function calcularAporteDeGastoAlPagoDeTarjeta(gasto, tarjeta, fechaPago) {
  // Sin campo, o con 1, es de contado. Así los gastos capturados antes de que
  // existieran los meses siguen valiendo lo mismo, sin migrar nada.
  const mensualidades = Number(gasto.mesesDiferidos) || 1;
  const primerPago = calcularFechaDePrimerPagoDeTarjeta(tarjeta, crearFechaLocal(gasto.fecha));
  const fechaPagoTexto = formatearFechaISO(fechaPago);

  for (let mensualidad = 0; mensualidad < mensualidades; mensualidad++) {
    if (formatearFechaISO(sumarMeses(primerPago, mensualidad)) === fechaPagoTexto) {
      return Number(gasto.monto) / mensualidades;
    }
  }

  return 0;
}

function calcularPagoTarjeta(tarjeta, fechaPago, datos) {
  return datos.gastos
    .filter(function (g) { return g.fuente === "credito" && g.tarjetaId === tarjeta.id; })
    .reduce(function (suma, g) {
      return suma + calcularAporteDeGastoAlPagoDeTarjeta(g, tarjeta, fechaPago);
    }, 0);
}

function generarCompromisosDesdeTarjetas(ciclo, datos) {
  datos.config.tarjetas.forEach(function (tarjeta) {
    // Igual que los recurrentes mensuales: si el día de pago cae dos veces en
    // un ciclo largo, son dos pagos de tarjeta reales, cada uno con el monto
    // de su propio periodo de corte.
    calcularFechasEnCicloParaDiaBase(ciclo, tarjeta.diaPago).forEach(function (fecha) {
      const montoCalculado = calcularPagoTarjeta(tarjeta, fecha, datos);
      agregarCompromisoSiNoExiste(datos, ciclo, "tarjeta", tarjeta.id, tarjeta.nombre, fecha, montoCalculado, null);
    });
  });
}

// A diferencia del resto de los compromisos (que se generan una sola vez
// y ya no cambian), uno de tarjeta sin pagar no tiene un monto fijo:
// cambia cada vez que se registra una compra a crédito dentro de su
// periodo de corte. Por eso se recalcula en cada render, nunca después
// de pagado — ahí ya es historia, y lo que importa es montoReal, no la
// estimación.
function actualizarMontosDeCompromisosDeTarjeta(datos) {
  let huboCambios = false;

  datos.compromisos.forEach(function (compromiso) {
    if (compromiso.origen !== "tarjeta" || compromiso.pagado) {
      return;
    }
    const tarjeta = datos.config.tarjetas.find(function (t) { return t.id === compromiso.origenId; });
    if (!tarjeta) {
      return;
    }
    const montoActualizado = calcularPagoTarjeta(tarjeta, crearFechaLocal(compromiso.fechaProgramada), datos);
    if (montoActualizado !== compromiso.montoEstimado) {
      compromiso.montoEstimado = montoActualizado;
      huboCambios = true;
    }
  });

  if (huboCambios) {
    guardarDatos(datos);
  }
}

function generarCompromisosDelCiclo(ciclo) {
  const datos = leerDatos();
  calcularCandidatosDelCiclo(ciclo, datos).forEach(function (candidato) {
    agregarCompromisoSiNoExiste(datos, ciclo, candidato.origen, candidato.origenId, candidato.nombre, crearFechaLocal(candidato.fechaProgramada), candidato.montoEstimado, candidato.pagoNde);
  });
  generarCompromisosDesdeTarjetas(ciclo, datos);
  guardarDatos(datos);
}

// ============================================================
// CÁLCULOS DEL CICLO
// ============================================================
//
// Disponible real, proyección de cierre y semáforo — las fórmulas de
// SPEC.md. Son funciones puras: reciben el ciclo y los datos, no leen
// localStorage por su cuenta, para poder reusarse tanto con el ciclo
// actual real como con ciclos simulados de la proyección multi-ciclo.

// Cuántos días completos dura un ciclo cualquiera (real o simulado).
function calcularDiasTotalesDelCiclo(ciclo) {
  const inicio = crearFechaLocal(ciclo.fechaInicio);
  const fin = crearFechaLocal(ciclo.fechaFin);
  return Math.round((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
}

// Día del ciclo en el que está "hoy" — solo tiene sentido para el ciclo
// actual real, no para uno proyectado (ahí no hay un "hoy" dentro).
// Cuántos días de un rango cualquiera ya pasaron, contando desde "hoy" —
// la comparten calcularRangoDeDiasDelCiclo (el ciclo completo) y
// calcularRangoDeLaSemanaActual (una semana dentro del ciclo), porque es
// el mismo cálculo con distintas fechas de ancla.
function calcularRangoDeDias(fechaInicioTexto, fechaFinTexto) {
  const inicio = crearFechaLocal(fechaInicioTexto);
  const fin = crearFechaLocal(fechaFinTexto);
  const hoy = crearFechaLocal(formatearFechaISO(new Date()));
  const diasTotales = Math.round((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
  const diasTranscurridosSinAcotar = Math.round((hoy - inicio) / (1000 * 60 * 60 * 24)) + 1;
  const diasTranscurridos = Math.min(Math.max(diasTranscurridosSinAcotar, 1), diasTotales);
  return {
    diasTranscurridos: diasTranscurridos,
    diasTotales: diasTotales,
    diasRestantes: diasTotales - diasTranscurridos
  };
}

function calcularRangoDeDiasDelCiclo(ciclo) {
  return calcularRangoDeDias(ciclo.fechaInicio, ciclo.fechaFin);
}

// Cuántos días le toca a cada una de las cuatro semanas del ciclo.
//
// Un ciclo dura entre 28 y 33 días, casi nunca múltiplo de 4, así que el
// sobrante se reparte de a un día a las primeras semanas. La del depósito
// es la larga, por decisión del usuario: es cuando acaba de cobrar.
//
//   33 días -> 9, 8, 8, 8      30 días -> 8, 8, 7, 7
//   32 días -> 8, 8, 8, 8      29 días -> 8, 7, 7, 7
//   31 días -> 8, 8, 8, 7      28 días -> 7, 7, 7, 7
//
// Esta es la ÚNICA fuente del reparto. Todo lo que necesite saber dónde
// empieza o acaba una semana sale de aquí, para que no puedan existir dos
// respuestas distintas a la misma pregunta.
function calcularDiasDeCadaSemanaDelCiclo(ciclo) {
  const diasDelCiclo = calcularDiasTotalesDelCiclo(ciclo);
  const diasBase = Math.floor(diasDelCiclo / SEMANAS_POR_CICLO);
  const diasSobrantes = diasDelCiclo % SEMANAS_POR_CICLO;

  const dias = [];
  for (let semana = 1; semana <= SEMANAS_POR_CICLO; semana++) {
    const leTocaUnDiaExtra = semana <= diasSobrantes;
    dias.push(diasBase + (leTocaUnDiaExtra ? 1 : 0));
  }
  return dias;
}

// En qué día del ciclo empieza la semana N, contando el primer día como 0.
// Es la suma de los días de todas las semanas anteriores.
function calcularDiaDelCicloEnQueEmpiezaLaSemana(ciclo, numeroDeSemana) {
  const diasPorSemana = calcularDiasDeCadaSemanaDelCiclo(ciclo);
  let dias = 0;
  for (let semana = 1; semana < numeroDeSemana; semana++) {
    dias += diasPorSemana[semana - 1];
  }
  return dias;
}

// Las fechas de la semana N del ciclo, ya con sus días transcurridos y
// restantes. La longitud sale del reparto, no de un 7 fijo.
function calcularRangoDeLaSemanaActual(ciclo, numeroDeSemana) {
  const inicioCiclo = crearFechaLocal(ciclo.fechaInicio);
  const diasDeLaSemana = calcularDiasDeCadaSemanaDelCiclo(ciclo)[numeroDeSemana - 1];
  const diasAntesDeEstaSemana = calcularDiaDelCicloEnQueEmpiezaLaSemana(ciclo, numeroDeSemana);

  const inicioSemana = sumarDias(inicioCiclo, diasAntesDeEstaSemana);
  const finSemana = sumarDias(inicioSemana, diasDeLaSemana - 1);

  return calcularRangoDeDias(formatearFechaISO(inicioSemana), formatearFechaISO(finSemana));
}

// Lo inverso de la anterior: dada una fecha, en qué semana del ciclo cae.
// La primera semana es la 1, no la 0, y nunca devuelve más de 4.
//
// Recibe el ciclo completo y no solo su fecha de inicio porque las semanas
// ya no miden lo mismo en todos los ciclos: sin saber cuánto dura el ciclo
// no se puede saber dónde termina su primera semana.
function calcularSemanaDeLaFecha(fechaTexto, ciclo) {
  const fecha = crearFechaLocal(fechaTexto);
  const inicio = crearFechaLocal(ciclo.fechaInicio);
  const milisegundosPorDia = 1000 * 60 * 60 * 24;
  const diaDelCiclo = Math.round((fecha - inicio) / milisegundosPorDia);

  // Se avanza semana por semana hasta pasarse del día buscado. Una fecha
  // anterior al ciclo cae en la 1 y una posterior en la última: fuera de
  // rango no hay respuesta mejor, y devolver 0 o 5 rompería a quien la use.
  const diasPorSemana = calcularDiasDeCadaSemanaDelCiclo(ciclo);
  let diasAcumulados = 0;
  for (let semana = 1; semana <= SEMANAS_POR_CICLO; semana++) {
    diasAcumulados += diasPorSemana[semana - 1];
    if (diaDelCiclo < diasAcumulados) {
      return semana;
    }
  }
  return SEMANAS_POR_CICLO;
}

// ============================================================
// INGRESOS — reglas y ocurrencias
// ============================================================
//
// Un ingreso guardado es una **regla**, no un depósito. Los depósitos
// concretos ("ocurrencias") se calculan cuando se necesitan y nunca se
// guardan: mismo patrón de regla/instancia que ya usan los recurrentes de
// gasto, y la razón por la que un ingreso ya no guarda cicloId — el ciclo
// se deriva de la fecha, así que nunca puede quedar contado en el ciclo
// equivocado.
//
// Hay tres tipos:
//   mensual    — cae todos los meses, en la fecha que diga su regla.
//   bimestral  — cae cada dos meses, contando desde el mes de fechaInicio.
//   extra      — un solo depósito, en su fecha exacta. No se repite.
//
// Y dos reglas de fecha para los recurrentes:
//   finDeMes       — el día antes de que termine el mes, adelantado al
//                    viernes si cae en fin de semana (calcularFechaDeCorteDelMes).
//   primerDiaHabil — el día 1, recorrido al lunes si cae en fin de semana.
//
// Cuando un festivo mueve un depósito, el usuario ajusta esa ocurrencia
// suelta y el ajuste se guarda en `ingreso.ajustes` con el mes como llave
// ("2026-09"). Se usa el mes y no la fecha a propósito: así el ajuste
// sobrevive aunque la fecha se mueva, y ninguna otra ocurrencia ni ningún
// otro ingreso se ve afectado. Un ajuste puede cambiar la fecha, el monto,
// o los dos.

// Etiqueta "AAAA-MM" de un mes. Es la llave con la que se identifica cada
// ocurrencia de un ingreso recurrente.
function generarClaveDeMes(anio, mesIndiceCero) {
  return anio + "-" + String(mesIndiceCero + 1).padStart(2, "0");
}

// Los ingresos capturados antes de que existiera la segunda regla no traen
// el campo, y la regla de fin de mes es la que el usuario tenía desde el
// principio — así que es la que se asume cuando falta.
function obtenerReglaDeFechaDeIngreso(ingreso) {
  return ingreso.reglaDeFecha === "primerDiaHabil" ? "primerDiaHabil" : "finDeMes";
}

// ¿A este ingreso recurrente le toca caer en este mes?
//
// Al mensual siempre le toca. Al bimestral le toca en el mes de su
// fechaInicio y de ahí cada dos meses hacia adelante — nunca antes, porque
// esa fecha es el ancla que dice en qué meses cae (agosto, octubre,
// diciembre...), no una vigencia.
function leTocaAlIngresoEsteMes(ingreso, anio, mesIndiceCero) {
  if (ingreso.tipo === "mensual") {
    return true;
  }
  if (ingreso.tipo !== "bimestral" || !ingreso.fechaInicio) {
    return false;
  }

  const fechaAncla = crearFechaLocal(ingreso.fechaInicio);
  const mesesDeDiferencia =
    (anio - fechaAncla.getFullYear()) * 12 + (mesIndiceCero - fechaAncla.getMonth());

  return mesesDeDiferencia >= 0 && mesesDeDiferencia % 2 === 0;
}

// La fecha que le tocaría a este ingreso en este mes según su regla, antes
// de aplicar cualquier ajuste manual.
function calcularFechaBaseDeOcurrencia(ingreso, anio, mesIndiceCero) {
  if (obtenerReglaDeFechaDeIngreso(ingreso) === "primerDiaHabil") {
    return calcularPrimerDiaHabilDelMes(anio, mesIndiceCero);
  }
  return calcularFechaDeCorteDelMes(anio, mesIndiceCero);
}

function buscarAjusteDeOcurrencia(ingreso, claveDeMes) {
  return (ingreso.ajustes || []).find(function (ajuste) {
    return ajuste.mes === claveDeMes;
  });
}

// Arma la ocurrencia de un ingreso recurrente en un mes concreto, ya con su
// ajuste manual aplicado si lo tiene. Devuelve null si a ese ingreso no le
// toca caer ese mes.
function construirOcurrenciaDeIngreso(ingreso, anio, mesIndiceCero) {
  if (!leTocaAlIngresoEsteMes(ingreso, anio, mesIndiceCero)) {
    return null;
  }

  const claveDeMes = generarClaveDeMes(anio, mesIndiceCero);
  const ajuste = buscarAjusteDeOcurrencia(ingreso, claveDeMes);
  const fechaBase = formatearFechaISO(calcularFechaBaseDeOcurrencia(ingreso, anio, mesIndiceCero));

  return {
    ingresoId: ingreso.id,
    nombre: ingreso.nombre,
    tipo: ingreso.tipo,
    mes: claveDeMes,
    fecha: (ajuste && ajuste.fecha) ? ajuste.fecha : fechaBase,
    fechaBase: fechaBase,
    monto: (ajuste && ajuste.monto !== undefined && ajuste.monto !== null) ? Number(ajuste.monto) : Number(ingreso.monto),
    montoBase: Number(ingreso.monto),
    fueAjustada: Boolean(ajuste)
  };
}

// Un ingreso "extra" no tiene regla que repetir: es su propia ocurrencia,
// con la fecha exacta que capturó el usuario. Se le da la misma forma que
// a las demás para que todo lo que consume ocurrencias las trate igual.
function construirOcurrenciaDeIngresoExtra(ingreso) {
  return {
    ingresoId: ingreso.id,
    nombre: ingreso.nombre,
    tipo: "extra",
    mes: (ingreso.fecha || "").slice(0, 7),
    fecha: ingreso.fecha,
    fechaBase: ingreso.fecha,
    monto: Number(ingreso.monto),
    montoBase: Number(ingreso.monto),
    fueAjustada: false
  };
}

// Todas las ocurrencias de todos los ingresos activos que caen dentro de un
// rango de fechas, ordenadas por fecha.
//
// Se recorren los meses del rango con un mes de margen a cada lado: un
// ajuste manual puede haber movido la ocurrencia de un mes vecino hacia
// adentro del rango, y sin ese margen se perdería.
function calcularOcurrenciasDeIngresosEnRango(datos, fechaDesdeISO, fechaHastaISO) {
  const fechaDesde = crearFechaLocal(fechaDesdeISO);
  const fechaHasta = crearFechaLocal(fechaHastaISO);
  const ingresosActivos = (datos.ingresos || []).filter(function (ingreso) {
    return ingreso.activo !== false;
  });

  const ocurrencias = [];

  ingresosActivos.forEach(function (ingreso) {
    if (ingreso.tipo === "extra") {
      ocurrencias.push(construirOcurrenciaDeIngresoExtra(ingreso));
      return;
    }

    let mesRecorrido = new Date(fechaDesde.getFullYear(), fechaDesde.getMonth() - 1, 1);
    const ultimoMes = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth() + 1, 1);

    while (mesRecorrido <= ultimoMes) {
      const ocurrencia = construirOcurrenciaDeIngreso(ingreso, mesRecorrido.getFullYear(), mesRecorrido.getMonth());
      if (ocurrencia) {
        ocurrencias.push(ocurrencia);
      }
      mesRecorrido = new Date(mesRecorrido.getFullYear(), mesRecorrido.getMonth() + 1, 1);
    }
  });

  return ocurrencias
    .filter(function (ocurrencia) {
      if (!ocurrencia.fecha) {
        return false;
      }
      const fecha = crearFechaLocal(ocurrencia.fecha);
      return fecha >= fechaDesde && fecha <= fechaHasta;
    })
    .sort(function (a, b) {
      return a.fecha < b.fecha ? -1 : 1;
    });
}

// Los depósitos que caen dentro de un ciclo. El ciclo es el rango: no hace
// falta que nadie guarde a qué ciclo pertenece un ingreso.
function calcularOcurrenciasDeIngresosDelCiclo(ciclo, datos) {
  return calcularOcurrenciasDeIngresosEnRango(datos, ciclo.fechaInicio, ciclo.fechaFin);
}

// El ingreso total de un ciclo: todo lo que cae dentro de su rango, haya
// llegado ya o no. Un ciclo se analiza completo (decisión del usuario, 30
// jul 2026), así que el día uno ya cuenta con todo lo que va a entrar.
function calcularIngresosDelCiclo(ciclo, datos) {
  return calcularOcurrenciasDeIngresosDelCiclo(ciclo, datos)
    .reduce(function (suma, ocurrencia) { return suma + ocurrencia.monto; }, 0);
}

// Un compromiso diferido a crédito dentro de una simulación deja de salir de
// este ciclo: se vuelve mensualidades de la tarjeta, que se cuentan aparte.
// Sobre datos reales esto nunca aplica — estadoCredito solo existe en una
// simulación — así que Captura y Análisis se comportan igual que siempre.
function calcularCompromisosPendientesDelCiclo(ciclo, datos) {
  return datos.compromisos
    .filter(function (c) { return c.cicloId === ciclo.id && !c.pagado && !c.estadoCredito; })
    .reduce(function (suma, c) { return suma + Number(c.montoEstimado); }, 0);
}

// Cuánto del presupuesto variable sigue apartado de aquí al cierre del ciclo.
//
// Se cuenta semana por semana, y a la semana en curso se le descuenta lo que
// ya se gastó en ella. Eso es lo que hace que "Libre para gastar" NO se mueva
// mientras se gasta dentro de lo presupuestado: la comida de hoy resta como
// gasto, pero el apartado de esta semana baja exactamente lo mismo, y los dos
// se cancelan. Cuando una categoría se pasa de su presupuesto semanal, su
// apartado llega a cero, y de ahí en adelante cada peso de más sí baja el
// disponible — que es justo lo que tiene que pasar.
//
// Antes esto era "tasa diaria × días que faltan", sin mirar lo gastado. El
// efecto era desconcertante y por eso se cambió (1 ago 2026): el número solo
// podía bajar durante el día y se recuperaba de golpe a medianoche, cuando
// caía un día del apartado. Nunca se descontaba de la bolsa semanal, así que
// gastar $200 de comida bajaba $200 el disponible aunque esos $200 ya
// estuvieran apartados para comer.
//
// Solo descuenta gastos a débito, porque solo esos los resta el disponible.
// Una comida a crédito no sale de la cuenta en este ciclo (sale cuando se
// paga la tarjeta, que ya cuenta como compromiso): si consumiera el apartado,
// el disponible SUBIRÍA por haber gastado, que sería absurdo.
// Cuánto dinero le toca a una categoría en una semana concreta del ciclo.
//
// Es la ÚNICA definición de "la bolsa de esta semana". La usan el apartado
// del disponible, el renglón informativo del teléfono y la barra de Captura,
// y por eso los tres no pueden decir números distintos.
//
// Hay dos formas de repartir, y cuál se usa depende de qué clase de gasto es
// (decisión del usuario, 2 ago 2026, al ver el caso real de la gasolina):
//
// **Se reparte por día** cuando el presupuesto lo consumen todas las
// subcategorías. Es el caso de la comida: se come todos los días, así que una
// semana de 8 días necesita ocho días de comida. $2,100 semanales son $300
// diarios, y la bolsa de esa semana es $2,400.
//
// **Es un tope fijo** cuando el presupuesto lo consume una sola subcategoría.
// Es el caso de la gasolina: no se carga "por día", se carga un tanque cada
// tantos días, y que la semana traiga un día extra no hace falta más gasolina.
// Sus $500 son $500 en una semana de 7 días y en una de 8.
//
// Que la regla se derive de subcategoriaQueConsumeElPresupuesto en vez de
// tener su propio interruptor es deliberado: designar una subcategoría ya es
// decir "esto es un gasto puntual y repetible", no un flujo diario. El efecto
// que hay que tener presente es que marcar "Comida → solo Súper" la volvería
// tope fijo, que probablemente no sería lo querido.
//
// Antes todo se repartía por día, y la gasolina quedaba rara: en una semana
// de 8 días la bolsa era $571.43, así que cargar los $500 completos dejaba
// $71.43 "disponibles" que nunca se iban a usar — y el disponible los
// apartaba como si fueran a gastarse.
function calcularBolsaSemanalDeCategoria(categoria, ciclo, datos, numeroDeSemana) {
  const presupuesto = obtenerPresupuestoSemanalVigente(ciclo, datos);
  const montoSemanal = Number(presupuesto[categoria.id]) || 0;

  if (categoria.subcategoriaQueConsumeElPresupuesto) {
    return montoSemanal;
  }

  const diasDeLaSemana = calcularDiasDeCadaSemanaDelCiclo(ciclo)[numeroDeSemana - 1];
  return (montoSemanal / 7) * diasDeLaSemana;
}

// Si un gasto consume o no la bolsa semanal de su categoría.
//
// Dos condiciones. La primera: solo el gasto a débito, porque una compra a
// crédito no saca dinero de la cuenta en este ciclo (sale cuando se paga la
// tarjeta, que ya cuenta como compromiso). Si consumiera la bolsa, gastar
// haría SUBIR el disponible.
//
// La segunda es del usuario (2 ago 2026): una categoría puede declarar que
// su presupuesto lo gasta una sola de sus subcategorías. Transporte tiene
// $500 semanales que son de gasolina; el Didi y el transporte urbano se
// registran en la misma categoría y salen en el análisis, pero son gasto
// extra y no tocan esos $500 — bajan el disponible directo, sin bolsa que
// los cubra. Cuando la categoría no declara nada, todas sus subcategorías
// consumen, que es el caso de Comida (diaria, súper y restaurante).
function elGastoConsumeLaBolsa(gasto, categoria) {
  if (gasto.fuente !== "debito") {
    return false;
  }
  if (!categoria.subcategoriaQueConsumeElPresupuesto) {
    return true;
  }
  return gasto.subcategoria === categoria.subcategoriaQueConsumeElPresupuesto;
}

// Lo que ya se gastó de la bolsa de una categoría en una semana del ciclo.
// El filtro vive aquí y en ningún otro lado: es lo que evita que el teléfono
// y la laptop cuenten cosas distintas.
function calcularGastadoDeLaBolsaEnLaSemana(categoria, ciclo, datos, numeroDeSemana) {
  return datos.gastos
    .filter(function (gasto) {
      return gasto.categoriaId === categoria.id &&
        gasto.cicloId === ciclo.id &&
        gasto.semana === numeroDeSemana &&
        elGastoConsumeLaBolsa(gasto, categoria);
    })
    .reduce(function (suma, gasto) { return suma + Number(gasto.monto); }, 0);
}

function calcularPresupuestoVariablePendiente(ciclo, datos) {
  const semanaDeHoy = calcularSemanaDeLaFecha(formatearFechaISO(new Date()), ciclo);

  return datos.config.categorias
    .filter(function (categoria) { return categoria.esVariableSemanal; })
    .reduce(function (total, categoria) {
      let apartadoDeLaCategoria = 0;

      // Las semanas que ya cerraron no apartan nada: lo que se gastó en ellas
      // ya está restado como gasto, y lo que sobró se fue con la semana.
      for (let semana = Math.max(semanaDeHoy, 1); semana <= SEMANAS_POR_CICLO; semana++) {
        const bolsa = calcularBolsaSemanalDeCategoria(categoria, ciclo, datos, semana);
        const gastado = calcularGastadoDeLaBolsaEnLaSemana(categoria, ciclo, datos, semana);
        apartadoDeLaCategoria += Math.max(0, bolsa - gastado);
      }

      return total + apartadoDeLaCategoria;
    }, 0);
}

// Cuánto se puede gastar libremente en lo que queda del ciclo.
//
// El dinero comprometido no está disponible aunque siga en la cuenta, y los
// gastos a crédito no salen de la cuenta hasta que se paga la tarjeta (eso ya
// está contemplado como compromiso) — por eso solo se resta el gasto a débito.
//
// También se resta el presupuesto variable que todavía no se gasta. Decisión
// del usuario (30 jul 2026): la comida y la gasolina son gasto variable, pero
// ese mínimo semanal está tan comprometido como un recibo. Sin descontarlo,
// la cifra grande de la pantalla prometía $9,839 disponibles cuando $10,771
// ya estaban destinados a comer y a cargar gasolina.
// mensualidadesDeTarjetaDelCiclo es opcional y solo lo pasa la primera
// pantalla: lo que las tarjetas cobran en este ciclo por lo diferido en la
// simulación. Es dinero que sí sale de la cuenta, así que resta igual que un
// compromiso.
//
// Este es el único número: "Libre para gastar" y el balance al cerrar del
// resumen salen los dos de aquí. Antes se calculaban por separado y diferían
// en un día de presupuesto variable, porque uno contaba los días que faltan y
// el otro el ciclo completo. Lo que sobra al cerrar ES lo que se puede gastar
// de más: no son dos preguntas, es una.
// Todo el dinero que ya salió de la cuenta en este ciclo. Solo débito: lo
// comprado a crédito todavía no sale del banco.
function calcularGastosDebitoDelCiclo(ciclo, datos) {
  return datos.gastos
    .filter(function (gasto) { return gasto.cicloId === ciclo.id && gasto.fuente === "debito"; })
    .reduce(function (suma, gasto) { return suma + Number(gasto.monto); }, 0);
}

// Cuánto dinero hay ahora mismo en la cuenta: lo que entró menos lo que ya
// salió. Nada más — no descuenta compromisos ni presupuesto apartado.
//
// Es la pregunta "¿cuánto tengo?", distinta de "¿cuánto puedo gastar?", que
// es calcularDisponibleReal. Van juntas en la cinta del teléfono a propósito:
// el saldo siempre es el número grande, y el disponible siempre el chico.
//
// El gasto a crédito no resta aquí (decisión del usuario, 2 ago 2026: "me
// interesa ver lo real que me queda de dinero"). Ese gasto sí queda
// registrado, y sale cuando se paga la tarjeta.
function calcularSaldoActual(ciclo, datos) {
  return calcularIngresosDelCiclo(ciclo, datos) - calcularGastosDebitoDelCiclo(ciclo, datos);
}

function calcularDisponibleReal(ciclo, datos, mensualidadesDeTarjetaDelCiclo) {
  const gastosDebitoDelCiclo = calcularGastosDebitoDelCiclo(ciclo, datos);

  // Aquí manda el presupuesto apartado, no el ritmo real (1 ago 2026). El
  // ritmo dice "vas más rápido de lo que planeaste", y para eso sirve el
  // semáforo y la trayectoria; metido en la cifra grande hacía que una comida
  // de $200 la bajara $457, porque contaba el gasto y además proyectaba ese
  // ritmo sobre todos los días que faltan. Un número que baja más de lo que
  // gastaste no se puede leer.
  return calcularIngresosDelCiclo(ciclo, datos)
    - gastosDebitoDelCiclo
    - calcularCompromisosPendientesDelCiclo(ciclo, datos)
    - calcularPresupuestoVariablePendiente(ciclo, datos)
    - Number(mensualidadesDeTarjetaDelCiclo || 0);
}

// Todos los compromisos del ciclo cuentan siempre, se hayan pagado o no
// — pagados con su montoReal, pendientes con su montoEstimado. Pagar un
// compromiso no puede "mejorar" la proyección de cierre: solo mueve su
// monto de estimado a real, nunca lo saca de la cuenta. (Antes se sumaban
// solo los pendientes, así que un compromiso desaparecía de la proyección
// en cuanto se pagaba — como si esa plata ya no importara.)
function calcularMontoComprometidoTotalDelCiclo(ciclo, datos) {
  return datos.compromisos
    .filter(function (c) { return c.cicloId === ciclo.id; })
    .reduce(function (suma, c) { return suma + Number(c.pagado ? c.montoReal : c.montoEstimado); }, 0);
}

// Lo conocido (todos los compromisos del ciclo, pagados o no) se suma tal
// cual. Lo desconocido (gasto variable del resto del ciclo) se proyecta
// al ritmo diario que ya se lleva. "Variable" es todo gasto sin
// compromisoId — los fijos ya se cuentan aparte, en los compromisos.
// Cuánto se va a gastar en variables de aquí al cierre del ciclo.
//
// Se toma el mayor entre el presupuesto de los días que faltan y lo que se
// gastaría siguiendo el ritmo real. Decisión del usuario (30 jul 2026):
//
// - Solo el ritmo real mentía al principio del ciclo: sin gastos
//   registrados el ritmo es cero, y la app concluía que no se gastaría nada
//   más en 28 días, prometiendo un cierre con $9,839 que no existía.
// - Solo el presupuesto perdería la señal de "vas más rápido de lo que
//   planeaste", que es justo para lo que sirve el semáforo.
//
// Con el mayor de los dos, nunca promete gastar menos de lo presupuestado y
// sigue avisando cuando el ritmo real se pasa.
function calcularGastoVariablePorVenir(ciclo, datos) {
  const rango = calcularRangoDeDiasDelCiclo(ciclo);
  const segunPresupuesto = calcularPresupuestoVariablePendiente(ciclo, datos);

  // Con muy pocos días transcurridos el ritmo no significa nada: un gasto de
  // $500 el primer día se leería como "$500 diarios" y proyectaría $14,000
  // donde el presupuesto son $10,400, haciendo saltar el número por un solo
  // súper. Hasta completar una semana manda el presupuesto, que es lo que el
  // usuario planeó.
  if (rango.diasTranscurridos < DIAS_MINIMOS_PARA_RITMO_REAL) {
    return segunPresupuesto;
  }

  // El ritmo solo puede medirse sobre las categorías que tienen presupuesto
  // semanal. Antes contaba cualquier gasto sin compromiso detrás, así que una
  // compra suelta en Servicios o en "Otros" se proyectaba como si fuera a
  // repetirse todos los días que faltan del ciclo: $200 en Servicios movían
  // el cierre $457. Un gasto de una sola vez no es un ritmo.
  //
  // Ojo: esto es solo la base del ritmo hacia adelante. El gasto que ya se
  // hizo en categorías no variables sigue contando completo en
  // calcularProyeccionDeCierre, porque ese dinero sí salió.
  const idsDeCategoriasVariables = datos.config.categorias
    .filter(function (categoria) { return categoria.esVariableSemanal; })
    .map(function (categoria) { return categoria.id; });

  const gastoVariableAcumulado = datos.gastos
    .filter(function (g) {
      return g.cicloId === ciclo.id && g.compromisoId === null &&
        idsDeCategoriasVariables.indexOf(g.categoriaId) !== -1;
    })
    .reduce(function (suma, g) { return suma + Number(g.monto); }, 0);

  const alRitmoReal = (gastoVariableAcumulado / rango.diasTranscurridos) * rango.diasRestantes;

  return Math.max(alRitmoReal, segunPresupuesto);
}

function calcularProyeccionDeCierre(ciclo, datos) {
  const gastoVariableAcumulado = datos.gastos
    .filter(function (g) { return g.cicloId === ciclo.id && g.compromisoId === null; })
    .reduce(function (suma, g) { return suma + Number(g.monto); }, 0);

  const proyeccionVariable = gastoVariableAcumulado + calcularGastoVariablePorVenir(ciclo, datos);
  return proyeccionVariable + calcularMontoComprometidoTotalDelCiclo(ciclo, datos);
}

// "gris" cuando el ciclo todavía no tiene ingreso capturado: dividir
// entre cero no tiene sentido, y no es ni verde ni rojo, es "todavía no
// se sabe".
function calcularColorDelSemaforo(proyeccionCierre, ingresosDelCiclo) {
  if (ingresosDelCiclo <= 0) {
    return "gris";
  }
  const porcentaje = proyeccionCierre / ingresosDelCiclo;
  if (porcentaje <= UMBRAL_SEMAFORO_VERDE) {
    return "verde";
  }
  if (porcentaje <= UMBRAL_SEMAFORO_AMARILLO) {
    return "amarillo";
  }
  return "rojo";
}

// Cuántos pesos de holgura quedan antes de que la proyección de cierre
// cruce cada umbral del semáforo — la pregunta directa de "¿puedo
// gastarle más a esto sin pasarme?". Puede salir negativo: significa que
// ya se cruzó ese umbral.
function calcularMargenAntesDeUmbrales(proyeccionCierre, ingresosDelCiclo) {
  return {
    antesDeAmarillo: (ingresosDelCiclo * UMBRAL_SEMAFORO_VERDE) - proyeccionCierre,
    antesDeRojo: (ingresosDelCiclo * UMBRAL_SEMAFORO_AMARILLO) - proyeccionCierre
  };
}

// ============================================================
// SEMÁFORO SEMANAL POR CATEGORÍA
// ============================================================
//
// Misma idea que calcularProyeccionDeCierre, pero a escala de una semana
// dentro del ciclo. La diferencia es que aquí no hay "compromisos" que
// sumar aparte: todo el gasto de una categoría variable (comida,
// transporte, entretenimiento...) es desconocido por naturaleza, así que
// toda la proyección sale del ritmo diario que ya lleva esa semana,
// extrapolado a los días que le faltan. Reusa calcularColorDelSemaforo y
// calcularMargenAntesDeUmbrales tal cual — ambas son genéricas en un
// monto contra un total, no saben ni les importa si ese total es el
// ingreso del ciclo o el presupuesto semanal de una categoría.
//
// Lo gastado sale de calcularGastadoDeLaBolsaEnLaSemana, el mismo filtro que
// usa el apartado del disponible. Antes esta función contaba todo el gasto de
// la categoría, incluido el de crédito, mientras el apartado solo contaba el
// débito: el renglón "Te quedan $X" del teléfono y el disponible se movían
// distinto ante la misma compra con tarjeta. Ahora es imposible que discrepen.
function calcularProyeccionDeCierreSemanal(categoria, ciclo, datos, numeroDeSemana) {
  const rango = calcularRangoDeLaSemanaActual(ciclo, numeroDeSemana);
  const gastadoEnLaSemana = calcularGastadoDeLaBolsaEnLaSemana(categoria, ciclo, datos, numeroDeSemana);

  const ritmoDiarioSemanal = gastadoEnLaSemana / rango.diasTranscurridos;
  const proyeccionCierreSemanal = gastadoEnLaSemana + (ritmoDiarioSemanal * rango.diasRestantes);

  return { gastadoEnLaSemana: gastadoEnLaSemana, proyeccionCierreSemanal: proyeccionCierreSemanal };
}

// ============================================================
// BARRA SEMANAL DE COMIDA
// ============================================================
//
// La barra que vive en la pantalla de entrada del teléfono, entre lo pagado
// del día y los atajos. Existe para una sola pregunta, en el momento exacto
// en que importa: "voy a gastar, ¿cómo llevo la semana?".
//
// Cómo se lee, y en qué se diferencia de todo lo demás de la app:
//
// La barra NO mide ritmo. No compara contra los días que han pasado. Mide
// consumo: cuánto llevas de la bolsa de esta semana, sin importar en cuántos
// días te lo gastaste. La bolsa se parte en cuartos exactos y el color sale
// de en qué cuarto cae el acumulado.
//
// Eso tiene una consecuencia que el usuario conoce y aceptó (2 ago 2026):
// gastando sus $300 diarios perfectos, al día 6 el acumulado son $1,800 de
// $2,100 y la barra está roja. Rojo significa "queda poca bolsa", no "te
// portaste mal". La alternativa era mover los cortes con los días, y la
// descartó: quiere ver cuánto le queda, no si va a tiempo.
//
// Un segmento por día de la semana — nueve segmentos en una semana de nueve
// días. El día en curso no se pinta hasta que termina, porque hasta la
// medianoche todavía puede empeorar. Al cerrar, el segmento se queda con el
// color que tenía el acumulado en ese momento y ya no cambia nunca. Un día
// sin gasto repite el color del anterior, porque el acumulado no se movió.
// Como el acumulado solo puede subir, el color nunca retrocede: la barra
// acaba siendo un degradado que cuenta la historia de la semana.

// Cuál categoría lleva barra. Se marca en Ajustes y no se adivina por el
// nombre: reconocerla como "Comida" se rompería el día que el usuario la
// llame "Alimentos". Solo puede haber una — la primera marcada gana.
function obtenerCategoriaDeLaBarraSemanal(datos) {
  return datos.config.categorias.find(function (categoria) {
    return categoria.esVariableSemanal && categoria.muestraBarraSemanal;
  }) || null;
}

// En qué tramo de color cae un acumulado dentro de su bolsa. Cuartos
// exactos, por decisión del usuario: 25%, 50% y 75%.
function calcularColorDelTramoDeLaBarra(acumulado, bolsa) {
  if (bolsa <= 0) {
    return "sin-color";
  }
  const tramo = Math.ceil((acumulado / bolsa) * TRAMOS_DE_COLOR_DE_LA_BARRA);
  if (tramo <= 1) {
    return "verde";
  }
  if (tramo === 2) {
    return "amarillo";
  }
  if (tramo === 3) {
    return "naranja";
  }
  return "rojo";
}

// Todo lo que la pantalla necesita para dibujar la barra de esta semana.
//
// Devuelve null cuando no hay categoría marcada o cuando esa categoría no
// tiene presupuesto capturado: sin un total contra el cual medir no hay nada
// honesto que dibujar, y una barra vacía miente más que no ponerla. Mismo
// criterio que el renglón informativo del monto.
function calcularBarraSemanalDeComida(ciclo, datos) {
  const categoria = obtenerCategoriaDeLaBarraSemanal(datos);
  if (!categoria) {
    return null;
  }

  const semanaDeHoy = calcularSemanaDeLaFecha(formatearFechaISO(new Date()), ciclo);
  const bolsa = calcularBolsaSemanalDeCategoria(categoria, ciclo, datos, semanaDeHoy);
  if (bolsa <= 0) {
    return null;
  }

  const inicioDeLaSemana = sumarDias(
    crearFechaLocal(ciclo.fechaInicio),
    calcularDiaDelCicloEnQueEmpiezaLaSemana(ciclo, semanaDeHoy)
  );
  const diasDeLaSemana = calcularDiasDeCadaSemanaDelCiclo(ciclo)[semanaDeHoy - 1];
  const hoy = crearFechaLocal(formatearFechaISO(new Date()));

  // Se recorre día por día acumulando, porque el color de cada segmento es
  // el del acumulado hasta ese día — no el del gasto de ese día suelto.
  const segmentos = [];
  let acumulado = 0;

  for (let numeroDeDia = 0; numeroDeDia < diasDeLaSemana; numeroDeDia++) {
    const fechaDelDia = sumarDias(inicioDeLaSemana, numeroDeDia);
    const fechaDelDiaTexto = formatearFechaISO(fechaDelDia);

    acumulado += datos.gastos
      .filter(function (gasto) {
        return gasto.categoriaId === categoria.id &&
          gasto.cicloId === ciclo.id &&
          gasto.fecha === fechaDelDiaTexto &&
          elGastoConsumeLaBolsa(gasto, categoria);
      })
      .reduce(function (suma, gasto) { return suma + Number(gasto.monto); }, 0);

    const elDiaYaCerro = fechaDelDia < hoy;
    segmentos.push({
      color: elDiaYaCerro ? calcularColorDelTramoDeLaBarra(acumulado, bolsa) : "sin-color",
      esHoy: fechaDelDia.getTime() === hoy.getTime()
    });
  }

  // El restante sí cuenta el gasto de hoy, aunque el segmento de hoy todavía
  // no se pinte: el número tiene que bajar en el momento en que se registra
  // la compra, que es cuando se está mirando.
  const gastadoEnLaSemana = calcularGastadoDeLaBolsaEnLaSemana(categoria, ciclo, datos, semanaDeHoy);

  return {
    categoria: categoria,
    segmentos: segmentos,
    bolsa: bolsa,
    restante: bolsa - gastadoEnLaSemana,
    fueraDePresupuesto: gastadoEnLaSemana > bolsa
  };
}

// ============================================================
// TRAYECTORIA DEL SEMÁFORO
// ============================================================
//
// El semáforo de arriba responde "¿a dónde voy a llegar si sigo así?" con
// un solo número de hoy. Esta sección responde una pregunta distinta y
// complementaria: "¿cómo se fue llenando el ciclo, día por día?" — para
// pintar el calendario y la gráfica de Análisis.
//
// Aquí un compromiso solo "cuenta" a partir de su fechaProgramada, no
// desde el día 1 del ciclo como en calcularProyeccionDeCierre (que los da
// por hechos desde el principio porque ya son certeza). Por eso esta
// curva sube en escalones conforme vencen los compromisos, en vez de
// partir con todo ya sumado. El día pasado usa el gasto variable real de
// ese día; el día futuro usa el mismo ritmo diario congelado de hoy que
// ya usa calcularProyeccionDeCierre. Por construcción, el último día del
// ciclo da el mismo número que calcularProyeccionDeCierre: es el mismo
// destino, visto como recorrido en vez de como punto final.
// mensualidadesDeTarjetaDelCiclo es opcional y solo lo pasa la primera
// pantalla: es lo que las tarjetas cobran en este ciclo por lo que se difirió
// en la simulación. Análisis la llama sin ese argumento y se comporta igual
// que siempre.
function calcularTrayectoriaDelSemaforo(ciclo, datos, mensualidadesDeTarjetaDelCiclo) {
  const ingresosDelCiclo = calcularIngresosDelCiclo(ciclo, datos);
  const hoyISO = formatearFechaISO(new Date());
  const rango = calcularRangoDeDiasDelCiclo(ciclo);

  const gastosVariablesDelCiclo = datos.gastos
    .filter(function (g) { return g.cicloId === ciclo.id && g.compromisoId === null; });
  const gastoVariableHastaHoy = gastosVariablesDelCiclo
    .reduce(function (suma, g) { return suma + Number(g.monto); }, 0);

  // El tramo futuro de la curva se reparte a un ritmo diario que nunca baja
  // del presupuesto (ver calcularGastoVariablePorVenir): con el ritmo real a
  // secas, un ciclo sin gastos registrados dibujaba una curva plana y
  // anunciaba un cierre que ignoraba el presupuesto completo.
  const ritmoDiario = rango.diasRestantes > 0
    ? calcularGastoVariablePorVenir(ciclo, datos) / rango.diasRestantes
    : 0;

  // Un compromiso ya pagado cuenta desde la fecha real en que se pagó (la
  // del gasto que lo liga vía compromisoId), no desde su fechaProgramada
  // — si se pagó antes por un descuento de pronto pago (o después, ya
  // vencido), el escalón de la curva tiene que aparecer ese día real, no
  // en la fecha nominal. Uno que sigue pendiente no tiene fecha real
  // todavía, así que usa fechaProgramada como mejor estimado.
  // Un compromiso diferido a crédito en la simulación deja de salir de este
  // ciclo: se convierte en mensualidades de la tarjeta, que se suman aparte
  // (ver mensualidadesDeTarjetaDelCiclo). Sobre datos reales esto nunca
  // aplica, porque estadoCredito solo existe dentro de una simulación.
  const compromisosDelCiclo = datos.compromisos
    .filter(function (c) { return c.cicloId === ciclo.id && !c.estadoCredito; })
    .map(function (c) {
      const gastoDelPago = c.pagado ? datos.gastos.find(function (g) { return g.compromisoId === c.id; }) : null;
      return {
        monto: Number(c.pagado ? c.montoReal : c.montoEstimado),
        fechaEfectiva: gastoDelPago ? gastoDelPago.fecha : c.fechaProgramada
      };
    });

  // Las mensualidades de lo diferido cuentan desde el primer día del ciclo:
  // son un cargo del periodo, no de una fecha concreta que la curva pueda
  // escalonar. Sin ellas, diferir haría bajar la curva sin que ese dinero
  // apareciera en ninguna parte.
  if (mensualidadesDeTarjetaDelCiclo > 0) {
    compromisosDelCiclo.push({
      monto: mensualidadesDeTarjetaDelCiclo,
      fechaEfectiva: ciclo.fechaInicio
    });
  }

  return generarDiasDelCiclo(ciclo).map(function (fechaISO, indice) {
    const numeroDeDia = indice + 1;
    const esFuturo = fechaISO > hoyISO;

    const gastoVariableAcumulado = esFuturo
      ? gastoVariableHastaHoy + (ritmoDiario * (numeroDeDia - rango.diasTranscurridos))
      : gastosVariablesDelCiclo
          .filter(function (g) { return g.fecha <= fechaISO; })
          .reduce(function (suma, g) { return suma + Number(g.monto); }, 0);

    const montoComprometidoAcumulado = compromisosDelCiclo
      .filter(function (c) { return c.fechaEfectiva <= fechaISO; })
      .reduce(function (suma, c) { return suma + c.monto; }, 0);

    const acumulado = gastoVariableAcumulado + montoComprometidoAcumulado;

    return {
      fechaISO: fechaISO,
      acumulado: acumulado,
      porcentaje: ingresosDelCiclo > 0 ? acumulado / ingresosDelCiclo : null,
      color: calcularColorDelSemaforo(acumulado, ingresosDelCiclo),
      esFuturo: esFuturo
    };
  });
}

// El primer día futuro en el que la trayectoria empeora respecto al color
// de hoy — "si sigues a este ritmo, se pondría amarillo/rojo el día X".
// null si no se proyecta ningún empeoramiento dentro de este ciclo (o si
// todavía no hay ingreso capturado para comparar).
function calcularProximoCambioDeColor(trayectoria) {
  const ORDEN_SEMAFORO = { verde: 0, amarillo: 1, rojo: 2 };
  const hoyISO = formatearFechaISO(new Date());
  const indiceHoy = trayectoria.findIndex(function (dia) { return dia.fechaISO === hoyISO; });
  if (indiceHoy === -1 || !(trayectoria[indiceHoy].color in ORDEN_SEMAFORO)) {
    return null;
  }

  const colorDeHoy = trayectoria[indiceHoy].color;
  const diaPeor = trayectoria.slice(indiceHoy + 1).find(function (dia) {
    return ORDEN_SEMAFORO[dia.color] > ORDEN_SEMAFORO[colorDeHoy];
  });
  return diaPeor ? { fechaISO: diaPeor.fechaISO, color: diaPeor.color } : null;
}

// ============================================================
// PROYECCIÓN MULTI-CICLO
// ============================================================
//
// Encadena CANTIDAD_DE_CICLOS_A_PROYECTAR ciclos simulados a partir del
// ciclo actual, estimando el balance de cada uno con lo único que se
// puede saber de antemano: compromisos de recurrentes y deudas (con la
// misma regla determinista de siempre), los ingresos que las reglas de
// ingreso hacen caer en ese ciclo, y el gasto variable a la tasa diaria
// del presupuesto semanal vigente.
// Nunca persiste nada — ni ciclos, ni compromisos.

// Cuánto se espera gastar en categorías variables (comida, transporte...)
// durante un ciclo completo, a partir del presupuesto SEMANAL ya
// capturado. Se usa una tasa diaria (presupuesto / 7) multiplicada por
// los días reales del ciclo, en vez de contar "semanas" del ciclo: un
// ciclo de ~30 días no son 5 semanas completas, son ~4.3 — usar 5
// sobreestimaría el gasto proyectado.
function calcularGastoVariableProyectado(ciclo, categoriasVariables, presupuestoSemanalBase) {
  const diasTotales = calcularDiasTotalesDelCiclo(ciclo);
  return categoriasVariables.reduce(function (suma, categoria) {
    const tasaDiaria = (Number(presupuestoSemanalBase[categoria.id]) || 0) / 7;
    return suma + (tasaDiaria * diasTotales);
  }, 0);
}

// Balance de un solo ciclo simulado: lo que ya traía de remanente, más
// el ingreso del ciclo, menos los compromisos proyectados (recurrentes +
// deudas + compromisos único ya capturados a futuro para ese ciclo — son
// datos reales, no estimaciones) y el gasto variable proyectado.
//
// El ingreso de un ciclo futuro se calcula exactamente igual que el del
// ciclo actual: las reglas de ingreso son deterministas, así que no hay
// "esperado" que pueda contradecir a un "real". Antes sí lo había, y con
// él toda una lógica de cuál de los dos ganaba para no contar el mismo
// dinero dos veces; ya no hace falta.
function calcularBalanceProyectadoDelCiclo(ciclo, datos, remanenteInicial, categoriasVariables, presupuestoSemanalBase) {
  const ingresoDelCiclo = calcularIngresosDelCiclo(ciclo, datos);
  const candidatos = calcularCandidatosDelCiclo(ciclo, datos);
  const unicosFuturos = datos.compromisos.filter(function (c) { return c.cicloId === ciclo.id && c.origen === "unico"; });
  const totalCompromisos = candidatos.concat(unicosFuturos).reduce(function (suma, c) { return suma + Number(c.montoEstimado); }, 0);
  const gastoVariableProyectado = calcularGastoVariableProyectado(ciclo, categoriasVariables, presupuestoSemanalBase);
  const balanceDelCiclo = remanenteInicial + ingresoDelCiclo - totalCompromisos - gastoVariableProyectado;

  return {
    ciclo: ciclo,
    candidatos: candidatos,
    unicosFuturos: unicosFuturos,
    totalCompromisos: totalCompromisos,
    gastoVariableProyectado: gastoVariableProyectado,
    remanenteInicial: remanenteInicial,
    ingresoDelCiclo: ingresoDelCiclo,
    balanceDelCiclo: balanceDelCiclo
  };
}

// El remanente de un ciclo simulado se encadena como punto de partida del
// siguiente ("flujo encadenado"): el saldo de cuenta no se reinicia entre
// ciclos, aunque el presupuesto se piense ciclo a ciclo. El primer
// remanente es el disponible real de hoy — pero solo si el ciclo actual
// ya tiene ingreso capturado. Sin ingreso capturado, disponibleReal resta
// compromisos pendientes contra cero ingreso y da un número negativo que
// no representa nada real (mismo criterio que el semáforo "gris": sin
// ingreso capturado, no hay nada que calcular todavía).
function calcularProyeccionMultiCiclo() {
  const datos = leerDatos();
  const cicloActual = asegurarCicloActual();
  const ciclosSimulados = generarCiclosSimulados(cicloActual, CANTIDAD_DE_CICLOS_A_PROYECTAR);
  const categoriasVariables = datos.config.categorias.filter(function (c) { return c.esVariableSemanal; });

  let remanente = calcularIngresosDelCiclo(cicloActual, datos) > 0 ? calcularDisponibleReal(cicloActual, datos) : 0;
  return ciclosSimulados.map(function (ciclo) {
    const resultado = calcularBalanceProyectadoDelCiclo(ciclo, datos, remanente, categoriasVariables, obtenerPresupuestoSemanalVigente(cicloActual, datos));
    remanente = resultado.balanceDelCiclo;
    return resultado;
  });
}

// ============================================================
// COLOR POR CATEGORÍA
// ============================================================
//
// Ocho tonos validados (OKLab, separación para daltonismo y contraste
// contra fondo oscuro — los ocho pasan) para diferenciar categorías a
// simple vista. Orden fijo, nunca se reasignan: la categoría en la
// posición N del arreglo de config.categorias siempre usa el tono N. Una
// novena categoría no inventa un tono nuevo: cae en el gris neutro de
// "sin categoría", el mismo que usan Deudas y Tarjetas, que no pertenecen
// a ninguna categoría de presupuesto.
//
// Vivía dentro de la sección de Simulación, pero desde el rediseño de
// Captura la usan las dos vistas, así que se subió aquí. No cambió ningún
// valor: son exactamente los mismos ocho tonos de siempre.
const PALETA_CATEGORIAS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const COLOR_CATEGORIA_SIN_ASIGNAR = "#64748b";

function obtenerColorDeCategoria(categoriaId, datos) {
  if (!categoriaId) {
    return COLOR_CATEGORIA_SIN_ASIGNAR;
  }
  const indice = datos.config.categorias.findIndex(function (c) { return c.id === categoriaId; });
  if (indice === -1) {
    return COLOR_CATEGORIA_SIN_ASIGNAR;
  }
  return PALETA_CATEGORIAS[indice % PALETA_CATEGORIAS.length];
}

// ============================================================
// DÍAS DE UN CICLO
// ============================================================
//
// Lo que sobrevive del calendario que vivía en Análisis. Ese calendario se
// eliminó: quedaba al fondo de la página, después de Movimientos del ciclo,
// y el cajón de la primera pantalla hace su trabajo — desplegable, con el
// mes completo y con los pagos marcables desde el propio día.

function generarDiasDelCiclo(ciclo) {
  const inicio = crearFechaLocal(ciclo.fechaInicio);
  const fin = crearFechaLocal(ciclo.fechaFin);
  const dias = [];
  let cursor = inicio;
  while (cursor <= fin) {
    dias.push(formatearFechaISO(cursor));
    cursor = sumarDias(cursor, 1);
  }
  return dias;
}

// ============================================================
// SIMULACIÓN — pura, nunca escribe en localStorage
// ============================================================
//
// Vive en su propia pestaña, aislada de Análisis/Configuración. Todo lo
// que pasa aquí ocurre sobre datosSimulados, un clon profundo de
// leerDatos() hecho al entrar a la pestaña — ningún handler de esta
// sección llama jamás a guardarDatos. Recargar la página, cambiar de
// pestaña y volver, o pulsar "Reiniciar simulación" descartan el clon: es
// una variable JS normal, no algo persistido.
//
// El ciclo actual se trata igual que los 6 proyectados dentro de este
// motor (remanente inicial en cero, mismo cálculo encadenado) — no se
// reusa calcularProyeccionDeCierre/calcularColorDelSemaforo aquí. Si se
// mezclaran las dos fórmulas, mover un compromiso HACIA el ciclo actual
// desde uno proyectado se perdería en silencio (esa fórmula real solo lee
// datos.compromisos, nunca la lista materializada de esta pestaña).
// Análisis sigue mostrando exactamente lo mismo que siempre con las
// fórmulas reales, sin tocar.

let datosSimulados = null;
let compromisosMaterializadosSimulacion = null;
let indiceCicloEnfocadoSimulacion = 0;

function obtenerHorizonteDeCiclosSimulacion() {
  const cicloActual = asegurarCicloActual();
  return [cicloActual].concat(generarCiclosSimulados(cicloActual, CANTIDAD_DE_CICLOS_A_PROYECTAR));
}

// No existe hoy una función centralizada para esto — confirmarPagoDeCompromiso
// resuelve la categoría inline, y no se toca (ver "qué NO se toca" del
// plan: la simulación no paga nada real). Funciona igual sobre un
// compromiso real ya persistido que sobre un candidato recién derivado de
// una regla, porque ambos traen "origen" y, si aplica, "origenId".
function resolverCategoriaDeCompromiso(compromisoOCandidato, datos) {
  if (compromisoOCandidato.origen === "recurrente") {
    const recurrente = datos.recurrentes.find(function (r) { return r.id === compromisoOCandidato.origenId; });
    return recurrente ? recurrente.categoriaId : null;
  }
  if (compromisoOCandidato.origen === "unico") {
    return compromisoOCandidato.categoriaId || null;
  }
  return null; // "deuda" y "tarjeta" no tienen categoría de presupuesto
}

// Hermana de resolverCategoriaDeCompromiso, mismo criterio — para agrupar
// dentro de cada tarjeta de categoría por subcategoría (Servicios -> Luz,
// Agua, Internet...), sin inventar un campo nuevo: ya se captura al dar de
// alta el recurrente o el compromiso único.
function resolverSubcategoriaDeCompromiso(compromisoOCandidato, datos) {
  if (compromisoOCandidato.origen === "recurrente") {
    const recurrente = datos.recurrentes.find(function (r) { return r.id === compromisoOCandidato.origenId; });
    return recurrente ? recurrente.subcategoria : null;
  }
  if (compromisoOCandidato.origen === "unico") {
    return compromisoOCandidato.subcategoria || null;
  }
  return null;
}

// Tercera hermana de las dos de arriba, con el mismo criterio exacto: a qué
// propiedad, o a qué persona, corresponde este pago.
//
// Existe porque el destinatario de un compromiso que viene de un
// recurrente NO vive en el compromiso: vive en el recurrente que lo
// generó. Sin esta función, "Agua" y "Agua" se ven idénticos en el muro
// aunque sean dos domicilios distintos. No agrega ningún campo al
// modelo — solo va a leer el que ya se captura al dar de alta la regla.
function resolverDestinatarioDeCompromiso(compromisoOCandidato, datos) {
  if (compromisoOCandidato.origen === "recurrente") {
    const recurrente = datos.recurrentes.find(function (r) { return r.id === compromisoOCandidato.origenId; });
    return (recurrente && recurrente.destinatario) || null;
  }
  if (compromisoOCandidato.origen === "unico") {
    return compromisoOCandidato.destinatario || null;
  }
  return null; // "deuda" y "tarjeta" se pagan a la institución, no a un destinatario
}

// Un compromiso pagado cuenta con su montoReal, no con montoEstimado —
// mismo criterio que calcularMontoComprometidoTotalDelCiclo ya usa para el
// ciclo actual real.
function montoEfectivoDeSimulado(item) {
  return Number(item.pagado ? item.montoReal : item.montoEstimado);
}

// Problema que resuelve esto: los compromisos de recurrentes/deudas en
// ciclos proyectados no viven en datos.compromisos — calcularCandidatosDelCiclo
// los re-deriva en cada llamada. Si el usuario "mueve" uno a otro ciclo o
// lo marca a crédito diferido, no hay dónde recordar esa edición sin que
// la siguiente recomputación la descarte. Por eso se materializa una sola
// vez, al entrar a la pestaña, y de ahí en adelante se edita esa copia.
function materializarCompromisosDelHorizonte(datosSim) {
  const horizonte = obtenerHorizonteDeCiclosSimulacion();
  const materializados = [];

  horizonte.forEach(function (ciclo, indice) {
    if (indice === 0) {
      // Ciclo actual real: son los mismos objetos de datosSim.compromisos,
      // decorados en el lugar (así "mover un compromiso HACIA el ciclo
      // actual desde uno proyectado" y "mover uno DEL ciclo actual hacia
      // otro" quedan simétricos, ambos operando sobre la misma lista
      // plana en vez de dos representaciones distintas).
      datosSim.compromisos
        .filter(function (c) { return c.cicloId === ciclo.id; })
        .forEach(function (compromiso) {
          compromiso.idSimulado = compromiso.idSimulado || generarId("sim");
          compromiso.categoriaId = resolverCategoriaDeCompromiso(compromiso, datosSim);
          compromiso.subcategoria = resolverSubcategoriaDeCompromiso(compromiso, datosSim);
          compromiso.estadoCredito = compromiso.estadoCredito || null;
          compromiso.modificadoEnSimulacion = compromiso.modificadoEnSimulacion || false;
          materializados.push(compromiso);
        });
    } else {
      const candidatos = calcularCandidatosDelCiclo(ciclo, datosSim);
      const unicosFuturos = datosSim.compromisos.filter(function (c) { return c.cicloId === ciclo.id && c.origen === "unico"; });
      candidatos.concat(unicosFuturos).forEach(function (candidato) {
        materializados.push({
          idSimulado: generarId("sim"),
          cicloId: ciclo.id,
          origen: candidato.origen,
          origenId: candidato.origenId || null,
          nombre: candidato.nombre,
          // La fecha se arrastra porque el reparto de un diferimiento a
          // crédito depende de ella: es lo que decide qué corte de la
          // tarjeta captura la compra. Sin fecha no se puede saber en qué
          // ciclo cae la primera mensualidad.
          fechaProgramada: candidato.fechaProgramada,
          categoriaId: resolverCategoriaDeCompromiso(candidato, datosSim),
          subcategoria: resolverSubcategoriaDeCompromiso(candidato, datosSim),
          montoEstimado: Number(candidato.montoEstimado),
          montoReal: null,
          pagado: false,
          estadoCredito: null,
          modificadoEnSimulacion: false
        });
      });
    }
  });

  return materializados;
}

// Aislada a propósito (Pieza 3, pedido explícito): división exacta
// monto/N. Punto único donde se agregarían intereses después, sin tocar
// el resto del motor.
function calcularDiferimientoSimulado(monto, mesesDiferidos) {
  return monto / mesesDiferidos;
}

// Reparte cada compromiso marcado con estadoCredito en sus N
// mensualidades, como aporte a un bucket sintético por (tarjeta, ciclo)
// — no hay una "línea genérica de crédito" aparte: este bucket ES la
// representación del pago proyectado de esa tarjeta. Lo que no cabe
// dentro de los 7 ciclos del horizonte se reporta aparte, nunca se
// descarta en silencio.
//
// Cada mensualidad se coloca en el ciclo que contiene su FECHA REAL de
// cargo, calculada desde el corte de la tarjeta. Antes se repartían por
// aritmética de índices ("el ciclo siguiente al de la compra"), lo que
// era incorrecto de dos formas: ignoraba que una compra posterior al
// corte se va al pago siguiente (con corte 25 y pago 12, comprar el 5 o
// el 26 de agosto separa el primer cargo un mes entero), e ignoraba que
// el primer cargo puede caer en el MISMO ciclo de la compra cuando el
// día de pago es posterior al de corte.
function calcularContribucionesDeTarjetaSimulada(materializados, horizonte, datosSim) {
  const contribucionesPorCiclo = {};
  const advertenciasFueraDeHorizonte = [];

  horizonte.forEach(function (ciclo) { contribucionesPorCiclo[ciclo.id] = {}; });

  materializados.forEach(function (item) {
    if (!item.estadoCredito || !item.fechaProgramada) {
      return;
    }
    const tarjeta = datosSim.config.tarjetas.find(function (t) { return t.id === item.estadoCredito.tarjetaId; });
    if (!tarjeta) {
      return;
    }

    const montoPorMes = calcularDiferimientoSimulado(montoEfectivoDeSimulado(item), item.estadoCredito.mesesDiferidos);
    const primerPago = calcularFechaDePrimerPagoDeTarjeta(tarjeta, crearFechaLocal(item.fechaProgramada));

    let mesesDentro = 0;
    for (let mes = 0; mes < item.estadoCredito.mesesDiferidos; mes++) {
      const fechaDelCargo = sumarMeses(primerPago, mes);
      const cicloDestino = horizonte.find(function (ciclo) {
        return fechaDelCargo >= crearFechaLocal(ciclo.fechaInicio) && fechaDelCargo <= crearFechaLocal(ciclo.fechaFin);
      });
      if (!cicloDestino) {
        continue; // cae fuera del horizonte; se reporta abajo
      }
      contribucionesPorCiclo[cicloDestino.id][tarjeta.id] = (contribucionesPorCiclo[cicloDestino.id][tarjeta.id] || 0) + montoPorMes;
      mesesDentro++;
    }

    const mesesFuera = item.estadoCredito.mesesDiferidos - mesesDentro;
    if (mesesFuera > 0) {
      advertenciasFueraDeHorizonte.push({
        idSimulado: item.idSimulado,
        nombre: item.nombre,
        montoFuera: montoPorMes * mesesFuera,
        mesesFuera: mesesFuera
      });
    }
  });

  return { contribucionesPorCiclo: contribucionesPorCiclo, advertenciasFueraDeHorizonte: advertenciasFueraDeHorizonte };
}

// Encadena los 7 ciclos del horizonte (actual + 6 proyectados) igual que
// calcularProyeccionMultiCiclo, pero leyendo la lista materializada (ya
// editable) en vez de re-derivar candidatos en cada paso.
function calcularProyeccionSimuladaCompleta(datosSim, materializados) {
  const horizonte = obtenerHorizonteDeCiclosSimulacion();
  const categoriasVariables = datosSim.config.categorias.filter(function (c) { return c.esVariableSemanal; });
  const presupuestoSemanalBase = obtenerPresupuestoSemanalVigente(horizonte[0], datosSim);

  const contribuciones = calcularContribucionesDeTarjetaSimulada(materializados, horizonte, datosSim);

  let remanente = 0;
  const resultadosPorCiclo = horizonte.map(function (ciclo) {
    const compromisosNormales = materializados.filter(function (m) { return m.cicloId === ciclo.id && !m.estadoCredito; });
    const totalNormal = compromisosNormales.reduce(function (s, m) { return s + montoEfectivoDeSimulado(m); }, 0);
    const contribucionesTarjeta = contribuciones.contribucionesPorCiclo[ciclo.id] || {};
    const totalTarjetaSimulada = Object.keys(contribucionesTarjeta).reduce(function (s, tarjetaId) { return s + contribucionesTarjeta[tarjetaId]; }, 0);
    const totalComprometido = totalNormal + totalTarjetaSimulada;

    const ingresoDelCiclo = calcularIngresosDelCiclo(ciclo, datosSim);
    const gastoVariableProyectado = calcularGastoVariableProyectado(ciclo, categoriasVariables, presupuestoSemanalBase);
    const remanenteInicial = remanente;
    const balanceDelCiclo = remanenteInicial + ingresoDelCiclo - totalComprometido - gastoVariableProyectado;
    remanente = balanceDelCiclo;

    return {
      ciclo: ciclo,
      remanenteInicial: remanenteInicial,
      ingresoDelCiclo: ingresoDelCiclo,
      totalComprometido: totalComprometido,
      totalTarjetaSimulada: totalTarjetaSimulada,
      contribucionesTarjeta: contribucionesTarjeta,
      gastoVariableProyectado: gastoVariableProyectado,
      balanceDelCiclo: balanceDelCiclo
    };
  });

  return { horizonte: horizonte, resultadosPorCiclo: resultadosPorCiclo, advertenciasFueraDeHorizonte: contribuciones.advertenciasFueraDeHorizonte };
}

// Descarta la simulación y vuelve a partir de los datos reales.
function reiniciarSimulacion() {
  datosSimulados = JSON.parse(JSON.stringify(leerDatos()));
  compromisosMaterializadosSimulacion = materializarCompromisosDelHorizonte(datosSimulados);
  indiceCicloEnfocadoSimulacion = 0;
  renderizarTodo();
}

function cambiarCicloEnfocadoSimulacion(delta) {
  indiceCicloEnfocadoSimulacion = Math.min(Math.max(indiceCicloEnfocadoSimulacion + delta, 0), CANTIDAD_DE_CICLOS_A_PROYECTAR);
  renderizarTodo();
}

// Fila de un compromiso editable dentro del panel. Si ya está marcado a
// crédito diferido, sigue apareciendo aquí (no solo en el bucket
// sintético) para poder revertirlo o cambiarle tarjeta/meses — su monto
// ya no cuenta en el subtotal de su categoría mientras lo esté.
function construirFilaCompromisoSimulado(item, horizonteOpcionesHTML, tarjetasQuePermitenDiferir) {
  const deshabilitado = item.pagado ? " disabled" : "";
  const marcaModificado = item.modificadoEnSimulacion ? "<span class=\"marca-modificado\">modificado</span>" : "";
  const etiquetaPagado = item.pagado ? " <span class=\"detalle\">(pagado)</span>" : "";
  const etiquetaCredito = item.estadoCredito ? " <span class=\"detalle\">(diferido a crédito, no cuenta en este subtotal)</span>" : "";
  const permiteFuente = item.origen !== "tarjeta"; // pagar una tarjeta con "crédito" no tiene sentido

  const opcionesTarjeta = tarjetasQuePermitenDiferir.length > 0
    ? tarjetasQuePermitenDiferir.map(function (t) { return "<option value=\"" + t.id + "\">" + escaparHTML(t.nombre) + "</option>"; }).join("")
    : "<option value=\"\">Ninguna tarjeta permite MSI</option>";

  const controlesFuenteHTML = permiteFuente
    ? "<select class=\"fuente-simulada-editada\"" + deshabilitado + ">" +
        "<option value=\"debito\">Débito</option>" +
        "<option value=\"credito\">Crédito</option>" +
      "</select>" +
      "<span class=\"controles-credito-simulado\" style=\"display: none;\">" +
        "<select class=\"tarjeta-simulada-editada\">" + opcionesTarjeta + "</select>" +
        "<select class=\"meses-simulados-editada\">" +
          "<option value=\"1\">1 mes</option><option value=\"3\">3 meses</option><option value=\"6\">6 meses</option>" +
          "<option value=\"9\">9 meses</option><option value=\"12\">12 meses</option>" +
        "</select>" +
      "</span>"
    : "";

  return "<div class=\"fila-compromiso-simulado\" data-id-simulado=\"" + item.idSimulado + "\">" +
    "<span class=\"nombre-compromiso-simulado\">" + escaparHTML(item.nombre) + etiquetaPagado + etiquetaCredito + marcaModificado + "</span>" +
    "<input type=\"number\" class=\"monto-simulado-editado\" min=\"0\" step=\"0.01\" value=\"" + montoEfectivoDeSimulado(item) + "\"" + deshabilitado + ">" +
    "<select class=\"ciclo-destino-simulado\"" + deshabilitado + ">" + horizonteOpcionesHTML + "</select>" +
    controlesFuenteHTML +
  "</div>";
}

function conectarEventosDeFilaCompromisoSimulado(contenedor) {
  contenedor.querySelectorAll(".fila-compromiso-simulado").forEach(function (fila) {
    const idSimulado = fila.getAttribute("data-id-simulado");
    const item = compromisosMaterializadosSimulacion.find(function (m) { return m.idSimulado === idSimulado; });
    if (!item || item.pagado) {
      return;
    }

    const selectCiclo = fila.querySelector(".ciclo-destino-simulado");
    selectCiclo.value = item.cicloId;
    selectCiclo.addEventListener("change", function (evento) {
      item.cicloId = evento.target.value;
      item.modificadoEnSimulacion = true;
      renderizarTodo();
    });

    fila.querySelector(".monto-simulado-editado").addEventListener("change", function (evento) {
      const monto = Number(evento.target.value);
      if (!monto || monto <= 0) {
        return;
      }
      item.montoEstimado = monto;
      item.modificadoEnSimulacion = true;
      renderizarTodo();
    });

    const selectFuente = fila.querySelector(".fuente-simulada-editada");
    if (!selectFuente) {
      return; // origen "tarjeta": no tiene selector de fuente
    }
    const controlesCredito = fila.querySelector(".controles-credito-simulado");
    const selectTarjeta = fila.querySelector(".tarjeta-simulada-editada");
    const selectMeses = fila.querySelector(".meses-simulados-editada");

    if (item.estadoCredito) {
      selectFuente.value = "credito";
      controlesCredito.style.display = "inline-flex";
      if (selectTarjeta.querySelector("option[value='" + item.estadoCredito.tarjetaId + "']")) {
        selectTarjeta.value = item.estadoCredito.tarjetaId;
      }
      selectMeses.value = String(item.estadoCredito.mesesDiferidos);
    }

    selectFuente.addEventListener("change", function (evento) {
      if (evento.target.value === "credito") {
        // El pago de una tarjeta no se puede pagar con una tarjeta: sería
        // un ciclo sin fondo (el cargo alimentaría el mismo pago que lo
        // origina) y no representa nada real.
        if (item.origen === "tarjeta") {
          alert("El pago de una tarjeta no se puede diferir a otra tarjeta.");
          evento.target.value = "debito";
          return;
        }
        const tarjetasQuePermitenDiferir = datosSimulados.config.tarjetas.filter(function (t) { return t.permiteDiferirAMeses; });
        if (tarjetasQuePermitenDiferir.length === 0) {
          alert("Ninguna tarjeta permite diferir a meses todavía. Márcalo en Configuración → Tarjetas.");
          evento.target.value = "debito";
          return;
        }
        item.estadoCredito = { tarjetaId: tarjetasQuePermitenDiferir[0].id, mesesDiferidos: 1 };
      } else {
        item.estadoCredito = null;
      }
      item.modificadoEnSimulacion = true;
      renderizarTodo();
    });

    selectTarjeta.addEventListener("change", function (evento) {
      if (item.estadoCredito) {
        item.estadoCredito.tarjetaId = evento.target.value;
        item.modificadoEnSimulacion = true;
        renderizarTodo();
      }
    });

    selectMeses.addEventListener("change", function (evento) {
      if (item.estadoCredito) {
        item.estadoCredito.mesesDiferidos = Number(evento.target.value);
        item.modificadoEnSimulacion = true;
        renderizarTodo();
      }
    });
  });
}

// ============================================================
// ESTUDIO DEL CICLO — LA LENTE: CAJA O CONSUMO
// ============================================================
//
// Todo lo que dibuja estudio.js empieza aquí, y hay una razón contable
// de peso para que así sea.
//
// El resto del motor cuenta CAJA: una compra a crédito no sale del banco
// hasta que se paga la tarjeta, así que calcularGastosDebitoDelCiclo
// filtra por fuente "debito" y ya. Es la lente correcta para responder
// "¿cuánto tengo?".
//
// Pero un análisis por categoría no puede usar esa lente. Si un súper de
// $2,000 se pagó con tarjeta, bajo caja el mes en que se compró aparece
// $0 de Comida, y tres semanas después aparecen $2,000 sin categoría
// dentro del pago de la tarjeta. La comida se vuelve invisible.
//
// La lente de CONSUMO responde la otra pregunta: "¿cuánto gasté, sin
// importar cuándo lo pago?". La compra cuenta el día que se hizo.
//
// Lo que NO se puede hacer nunca es mezclarlas en un mismo total: la
// compra se contaría dos veces, primero en su categoría y después dentro
// del pago de la tarjeta. Por eso la lente es un parámetro explícito que
// atraviesa todas las funciones de esta sección, en vez de una decisión
// escondida en cada una.
//
//                         CAJA                    CONSUMO
//   Gasto de débito       cuenta                  cuenta
//   Compra a crédito      NO (no salió del banco) cuenta el día de la compra
//   Pago de tarjeta       cuenta                  NO (ya se contaron las compras)
//   Pago de deuda         cuenta                  cuenta
//
// El pago de deuda cuenta en las dos a propósito. Su "compra" nunca se
// registró como gasto — montoSolicitado no entra al flujo de efectivo —
// así que sacarlo de consumo lo haría desaparecer de todas las vistas, y
// es una obligación mensual tan real como la luz.

const LENTE_CAJA = "caja";
const LENTE_CONSUMO = "consumo";

// Qué mide cada lente, en una frase. Se muestra en pantalla junto al
// control: sin esto, dos totales distintos para el mismo ciclo se leen
// como un error de la app en vez de como dos preguntas distintas.
const EXPLICACION_DE_LA_LENTE = {
  caja: "Lo que salió del banco en este ciclo. Una compra a crédito no cuenta hasta que se paga la tarjeta.",
  consumo: "Lo que gastaste en este ciclo, sin importar cuándo lo pagas. La compra a crédito cuenta el día que la hiciste."
};

// Un gasto es el pago de una tarjeta cuando cierra un compromiso de
// origen "tarjeta". Es la única marca confiable: por monto no se puede
// (cambia cada ciclo) y por categoría tampoco (no tiene).
//
// Si alguien pagara la tarjeta a mano, sin marcar el compromiso, ese
// gasto quedaría contado como consumo. No se defiende contra eso porque
// la app genera los compromisos de tarjeta sola y el camino normal es
// marcarlos.
function esPagoDeTarjeta(gasto, datos) {
  if (!gasto.compromisoId) {
    return false;
  }
  const compromiso = datos.compromisos.find(function (c) { return c.id === gasto.compromisoId; });
  return Boolean(compromiso) && compromiso.origen === "tarjeta";
}

// Los movimientos de un ciclo bajo la lente pedida. De aquí sale TODO lo
// demás del estudio: categorías, semanas, destinatarios y comparativos
// no vuelven a filtrar datos.gastos por su cuenta, para que no puedan
// discrepar entre secciones.
function calcularMovimientosDelCicloSegunLente(ciclo, datos, lente) {
  const gastosDelCiclo = datos.gastos.filter(function (gasto) {
    return gasto.cicloId === ciclo.id;
  });

  if (lente === LENTE_CAJA) {
    return gastosDelCiclo.filter(function (gasto) { return gasto.fuente === "debito"; });
  }

  return gastosDelCiclo.filter(function (gasto) { return !esPagoDeTarjeta(gasto, datos); });
}

// Suma los montos de una lista de gastos. Existe como función con nombre
// porque se repite en cada sección y un reduce suelto en diez lugares es
// diez lugares donde puede escribirse distinto.
function sumarMontosDeGastos(gastos) {
  return gastos.reduce(function (suma, gasto) { return suma + Number(gasto.monto); }, 0);
}

// La diferencia entre las dos lentes, explicada en sus dos piezas. Sirve
// para dos cosas: mostrarle al usuario por qué los totales no coinciden,
// y como prueba de que no hay doble conteo — tiene que cumplirse siempre
//
//   consumo − caja = compras a crédito del ciclo − pagos de tarjeta del ciclo
//
// Si esa identidad falla, alguna compra se está contando dos veces.
function calcularPuenteEntreLentes(ciclo, datos) {
  const gastosDelCiclo = datos.gastos.filter(function (gasto) {
    return gasto.cicloId === ciclo.id;
  });

  const comprasACredito = gastosDelCiclo.filter(function (gasto) {
    return gasto.fuente === "credito";
  });
  const pagosDeTarjeta = gastosDelCiclo.filter(function (gasto) {
    return esPagoDeTarjeta(gasto, datos);
  });

  return {
    comprasACredito: sumarMontosDeGastos(comprasACredito),
    pagosDeTarjeta: sumarMontosDeGastos(pagosDeTarjeta),
    diferencia: sumarMontosDeGastos(comprasACredito) - sumarMontosDeGastos(pagosDeTarjeta)
  };
}

// ============================================================
// ESTUDIO DEL CICLO — QUÉ CICLOS HAY Y EN CUÁL ESTAMOS
// ============================================================
//
// El estudio navega los ciclos REALES (los que existen en datos.ciclos),
// no los siete simulados del muro de la primera pantalla. Son dos
// navegaciones con dos propósitos: arriba se explora el futuro para
// decidir cómo pagar algo, aquí se revisa lo que ya pasó.

// Los ciclos ordenados del más viejo al más nuevo. Se ordena por
// fechaInicio y no por id porque el id se deriva de la fecha de fin, y
// aunque hoy los dos ordenan igual, la fecha es la que manda de verdad.
function obtenerCiclosDelEstudio(datos) {
  return datos.ciclos.slice().sort(function (a, b) {
    return crearFechaLocal(a.fechaInicio) - crearFechaLocal(b.fechaInicio);
  });
}

// En qué situación está un ciclo respecto de hoy. El estudio cambia lo
// que muestra según esto: un ciclo cerrado tiene remanente real, uno en
// curso solo tiene proyección, y uno por venir no tiene ni gastos.
function calcularSituacionDelCiclo(ciclo) {
  const hoy = truncarAMedianoche(new Date());
  const inicio = crearFechaLocal(ciclo.fechaInicio);
  const fin = crearFechaLocal(ciclo.fechaFin);

  if (hoy > fin) { return "cerrado"; }
  if (hoy < inicio) { return "porVenir"; }
  return "enCurso";
}

// Solo los ciclos que ya terminaron. Es la base de todo lo comparativo:
// un ciclo en curso no se puede comparar contra uno completo sin mentir,
// porque le faltan días de gasto por suceder.
function obtenerCiclosCerrados(datos) {
  return obtenerCiclosDelEstudio(datos).filter(function (ciclo) {
    return calcularSituacionDelCiclo(ciclo) === "cerrado";
  });
}

// ============================================================
// ESTUDIO DEL CICLO — EL REPARTO DEL INGRESO
// ============================================================
//
// Un ciclo se cuenta en cuatro pedazos, y la razón de que sean cuatro y
// no dos es que "gasto" a secas no se puede accionar: bajarle a la luz,
// bajarle al súper y no comprar la pantalla son tres decisiones de
// naturaleza distinta.
//
//   FIJO           Lo que cierra un compromiso: recurrentes, deudas,
//                  el pago de la tarjeta, compromisos únicos. Ya estaba
//                  decidido antes de que el ciclo empezara.
//
//   VARIABLE       Gasto libre que consume una bolsa semanal. Es lo que
//   PRESUPUESTADO  el usuario planeó gastar: comida, gasolina.
//
//   DISCRECIONAL   Gasto libre que NO consume ninguna bolsa. Son dos
//                  casos y los dos importan: el Didi en una categoría
//                  cuyo presupuesto es solo de gasolina, y cualquier
//                  compra sin categoría. Es el pedazo que hoy no se ve
//                  en ninguna barra de la app y que baja el disponible
//                  sin que nada lo anuncie.
//
//   REMANENTE      Lo que sobra. ingreso − los tres de arriba.
//
// La regla de qué consume bolsa NO se reescribe aquí: se llama a
// elGastoConsumeLaBolsa, que es la misma que usan el teléfono y el
// disponible. Si esa regla cambia, cambia en un solo lugar.

// Clasifica un gasto en uno de los tres pedazos. Se separa de la suma
// para que la regla se pueda leer de un golpe, sin el ruido del reduce.
function clasificarGastoDelEstudio(gasto, datos) {
  if (gasto.compromisoId) {
    return "fijo";
  }

  const categoria = datos.config.categorias.find(function (c) {
    return c.id === gasto.categoriaId;
  });

  if (categoria && categoria.esVariableSemanal && elGastoConsumeLaBolsa(gasto, categoria)) {
    return "variable";
  }

  return "discrecional";
}

// Los compromisos del ciclo que todavía no se pagan, bajo la lente
// pedida. Se cuentan aparte del fijo ya pagado porque no son lo mismo:
// uno es un hecho y el otro es una promesa, y el diseño no puede
// dibujarlos iguales.
//
// Bajo la lente de consumo se sacan los de tarjeta, por la misma razón
// que se sacan sus pagos: las compras que ese pago cubre ya se contaron
// una por una el día que se hicieron.
function calcularFijoPendienteDelCiclo(ciclo, datos, lente) {
  return datos.compromisos
    .filter(function (compromiso) {
      if (compromiso.cicloId !== ciclo.id || compromiso.pagado) {
        return false;
      }
      if (lente === LENTE_CONSUMO && compromiso.origen === "tarjeta") {
        return false;
      }
      return true;
    })
    .reduce(function (suma, compromiso) { return suma + Number(compromiso.montoEstimado); }, 0);
}

// El resumen completo de un ciclo bajo una lente. Es la base del §1 y
// también de todo lo comparativo: un ciclo del histórico es exactamente
// este objeto, calculado para un ciclo viejo.
function resumirCicloCompleto(ciclo, datos, lente) {
  const movimientos = calcularMovimientosDelCicloSegunLente(ciclo, datos, lente);

  let fijo = 0;
  let variablePresupuestado = 0;
  let discrecional = 0;

  movimientos.forEach(function (gasto) {
    const pedazo = clasificarGastoDelEstudio(gasto, datos);
    if (pedazo === "fijo") { fijo += Number(gasto.monto); }
    else if (pedazo === "variable") { variablePresupuestado += Number(gasto.monto); }
    else { discrecional += Number(gasto.monto); }
  });

  const ingreso = calcularIngresosDelCiclo(ciclo, datos);
  const fijoPendiente = calcularFijoPendienteDelCiclo(ciclo, datos, lente);
  const gastadoTotal = fijo + variablePresupuestado + discrecional;
  const remanente = ingreso - gastadoTotal;

  // Sin ingreso capturado no hay contra qué medir nada. Se marca en vez
  // de devolver ceros o infinitos, para que la pantalla pueda decir
  // "todavía no se sabe" en lugar de dibujar un 0% que parece un dato.
  const hayIngreso = ingreso > 0;

  return {
    cicloId: ciclo.id,
    situacion: calcularSituacionDelCiclo(ciclo),
    lente: lente,
    ingreso: ingreso,
    hayIngreso: hayIngreso,

    fijo: fijo,
    fijoPendiente: fijoPendiente,
    variablePresupuestado: variablePresupuestado,
    discrecional: discrecional,
    gastadoTotal: gastadoTotal,
    remanente: remanente,

    // Cuánto del ingreso ya estaba comprometido antes de empezar,
    // pagado o no. Es el número que mide libertad: un saldo alto con una
    // tasa de compromiso del 80% no es holgura, es un respiro de días.
    //
    // NO depende de la lente, a propósito, y por eso no se calcula con
    // fijo + fijoPendiente: se llama a calcularMontoComprometidoTotalDelCiclo,
    // que cuenta TODOS los compromisos del ciclo incluido el pago de la
    // tarjeta. Una obligación no deja de existir porque se mire con otra
    // lente — bajo consumo la tasa salía sin el pago de la tarjeta y
    // marcaba 12% donde la realidad era el doble.
    tasaDeCompromiso: hayIngreso ? calcularMontoComprometidoTotalDelCiclo(ciclo, datos) / ingreso : null,
    montoComprometidoDelCiclo: calcularMontoComprometidoTotalDelCiclo(ciclo, datos),
    tasaDeAhorro: hayIngreso ? remanente / ingreso : null,
    // Cuánto del ingreso se ha ido en total. Es lo que dibuja la regla
    // del ingreso, y por encima de 1 significa que el ciclo se pasó.
    porcentajeConsumido: hayIngreso ? gastadoTotal / ingreso : null
  };
}

// ============================================================
// ESTUDIO DEL CICLO — ESTADÍSTICA CON PUERTAS
// ============================================================
//
// Con dos ciclos cerrados un promedio no es un promedio, es la mitad de
// una anécdota. Y una línea de tendencia sobre tres puntos es un dibujo
// que da confianza sin ninguna razón para darla.
//
// Por eso cada medida declara cuántos datos necesita, y si no los hay se
// devuelve en null para que la pantalla diga qué le falta en vez de
// inventar un número:
//
//   1 ciclo cerrado    variación contra el ciclo anterior
//   3 ciclos cerrados  promedio
//   4 ciclos cerrados  mediana y banda mínimo–máximo
//   nunca              línea de tendencia o regresión
//
// El "nunca" es en serio: con los ciclos que un año da (12), cualquier
// pendiente ajustada estaría dominada por el ruido de dos meses raros.

const CICLOS_MINIMOS_PARA_PROMEDIO = 3;
const CICLOS_MINIMOS_PARA_MEDIANA = 4;

function calcularEstadisticaDeSerie(valores) {
  const n = valores.length;

  if (n === 0) {
    return { n: 0, promedio: null, mediana: null, minimo: null, maximo: null };
  }

  const ordenados = valores.slice().sort(function (a, b) { return a - b; });
  const suma = valores.reduce(function (total, v) { return total + v; }, 0);

  // La mediana de un número par de datos es el promedio de los dos de en
  // medio. Con impar es el de en medio y ya.
  const mitad = Math.floor(n / 2);
  const mediana = n % 2 === 0
    ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
    : ordenados[mitad];

  return {
    n: n,
    promedio: n >= CICLOS_MINIMOS_PARA_PROMEDIO ? suma / n : null,
    mediana: n >= CICLOS_MINIMOS_PARA_MEDIANA ? mediana : null,
    minimo: n >= CICLOS_MINIMOS_PARA_MEDIANA ? ordenados[0] : null,
    maximo: n >= CICLOS_MINIMOS_PARA_MEDIANA ? ordenados[n - 1] : null
  };
}

// La variación de un número contra otro, en pesos y en porcentaje. El
// porcentaje se devuelve en null cuando la base es cero: "subió un
// infinito por ciento" no le dice nada a nadie, y "de $0 a $500" sí.
function calcularVariacion(actual, anterior) {
  const enPesos = actual - anterior;
  return {
    enPesos: enPesos,
    enPorcentaje: anterior === 0 ? null : enPesos / Math.abs(anterior)
  };
}

// El ciclo cerrado inmediatamente anterior a uno dado. Es contra el que
// se compara por default: "el mes pasado" es la referencia que cualquiera
// usa sin que se la expliquen.
function obtenerCicloAnteriorCerrado(ciclo, datos) {
  const cerrados = obtenerCiclosCerrados(datos).filter(function (c) {
    return crearFechaLocal(c.fechaFin) < crearFechaLocal(ciclo.fechaFin);
  });
  return cerrados.length > 0 ? cerrados[cerrados.length - 1] : null;
}

// El resumen de todos los ciclos cerrados, del más viejo al más nuevo.
// De aquí salen los promedios, las sparklines y la tabla comparativa —
// y siempre bajo la misma lente que el usuario tiene puesta, para que la
// comparación sea contra lo mismo que está viendo arriba.
function calcularSerieDeCiclosCerrados(datos, lente) {
  return obtenerCiclosCerrados(datos).map(function (ciclo) {
    return resumirCicloCompleto(ciclo, datos, lente);
  });
}

// ============================================================
// ESTUDIO DEL CICLO — EL DESGLOSE POR CATEGORÍA
// ============================================================
//
// La tabla del §2: en qué se fue el dinero, ordenado por monto. El orden
// no es una preferencia, es el análisis — la primera fila es siempre la
// que hay que mirar.
//
// Se cuentan cuatro cosas por categoría, y las cuatro juntas dicen algo
// que ninguna dice sola:
//
//   TOTAL             cuánto.
//   MOVIMIENTOS       en cuántas veces. $3,000 de comida en 30 compras
//                     de $100 y en 2 de $1,500 son problemas distintos,
//                     y el total solo los muestra iguales.
//   TICKET PROMEDIO   total ÷ movimientos.
//   CONTRA EL         solo las categorías con bolsa semanal. Es lo que
//   PRESUPUESTO       dice si el presupuesto está bien puesto.
//
// Los gastos sin categoría (el pago de una deuda, el de una tarjeta, una
// compra suelta) no se esconden: van a un grupo propio donde el nombre
// de la fila es su descripción. Esconderlos haría que la tabla no sumara
// el total del ciclo, y una tabla que no suma no sirve.

const CATEGORIA_SIN_CLASIFICAR = "__sin_categoria__";

// El presupuesto de una categoría para el ciclo completo: la suma de sus
// cuatro bolsas semanales. Se calcula sumando y no multiplicando por
// cuatro porque las bolsas no son iguales entre sí — una semana de 8
// días necesita ocho días de comida, y la gasolina es tope fijo. La
// regla de cuál es cuál ya vive en calcularBolsaSemanalDeCategoria.
function calcularPresupuestoDelCicloParaCategoria(categoria, ciclo, datos) {
  let total = 0;
  for (let semana = 1; semana <= SEMANAS_POR_CICLO; semana++) {
    total += calcularBolsaSemanalDeCategoria(categoria, ciclo, datos, semana);
  }
  return total;
}

// Cómo se llama la fila de un gasto sin categoría. Se busca el nombre
// más informativo que exista: el del compromiso que cerró, si no su
// descripción, y si no queda nada, una etiqueta genérica.
function nombrarGastoSinCategoria(gasto, datos) {
  if (gasto.compromisoId) {
    const compromiso = datos.compromisos.find(function (c) { return c.id === gasto.compromisoId; });
    if (compromiso) {
      return compromiso.nombre;
    }
  }
  if (gasto.descripcion) {
    return gasto.descripcion;
  }
  return "Sin descripción";
}

// El desglose completo, ordenado de mayor a menor. Cada categoría trae
// sus subcategorías dentro, también ordenadas.
function calcularGastoPorCategoriaDelCiclo(ciclo, datos, lente) {
  const movimientos = calcularMovimientosDelCicloSegunLente(ciclo, datos, lente);
  const ingreso = calcularIngresosDelCiclo(ciclo, datos);
  const grupos = {};

  movimientos.forEach(function (gasto) {
    const claveCategoria = gasto.categoriaId || CATEGORIA_SIN_CLASIFICAR;
    const categoria = datos.config.categorias.find(function (c) { return c.id === gasto.categoriaId; });

    if (!grupos[claveCategoria]) {
      grupos[claveCategoria] = {
        categoriaId: gasto.categoriaId || null,
        nombre: categoria ? categoria.nombre : "Sin categoría",
        esVariableSemanal: Boolean(categoria && categoria.esVariableSemanal),
        categoria: categoria || null,
        total: 0,
        conteo: 0,
        gastadoDeLaBolsa: 0,
        subcategorias: {}
      };
    }
    const grupo = grupos[claveCategoria];

    // El nombre de la fila de adentro: la subcategoría cuando existe, y
    // si no, lo que mejor describa al gasto.
    const nombreDeFila = categoria
      ? (gasto.subcategoria || "Sin subcategoría")
      : nombrarGastoSinCategoria(gasto, datos);

    if (!grupo.subcategorias[nombreDeFila]) {
      grupo.subcategorias[nombreDeFila] = {
        nombre: nombreDeFila,
        total: 0,
        conteo: 0,
        // Si esta subcategoría es la que consume la bolsa de su
        // categoría. Sirve para marcar en pantalla al Didi como "no toca
        // el presupuesto" sin tener que explicarlo cada vez.
        consumeLaBolsa: Boolean(categoria) && (
          !categoria.subcategoriaQueConsumeElPresupuesto ||
          categoria.subcategoriaQueConsumeElPresupuesto === gasto.subcategoria
        )
      };
    }

    const monto = Number(gasto.monto);
    grupo.total += monto;
    grupo.conteo += 1;
    grupo.subcategorias[nombreDeFila].total += monto;
    grupo.subcategorias[nombreDeFila].conteo += 1;

    // Lo que de verdad descuenta de la bolsa semanal. No es lo mismo que
    // el total de la categoría: una comida pagada con tarjeta es comida,
    // pero no toca el presupuesto (ver elGastoConsumeLaBolsa). Bajo la
    // lente de consumo esa diferencia se vuelve visible, y se muestra en
    // vez de taparse.
    if (categoria && elGastoConsumeLaBolsa(gasto, categoria)) {
      grupo.gastadoDeLaBolsa += monto;
    }
  });

  return Object.keys(grupos).map(function (clave) {
    const grupo = grupos[clave];
    const presupuesto = grupo.categoria && grupo.esVariableSemanal
      ? calcularPresupuestoDelCicloParaCategoria(grupo.categoria, ciclo, datos)
      : null;

    return {
      categoriaId: grupo.categoriaId,
      nombre: grupo.nombre,
      esVariableSemanal: grupo.esVariableSemanal,
      total: grupo.total,
      conteo: grupo.conteo,
      ticketPromedio: grupo.conteo > 0 ? grupo.total / grupo.conteo : 0,
      parteDelIngreso: ingreso > 0 ? grupo.total / ingreso : null,
      presupuestoDelCiclo: presupuesto,
      gastadoDeLaBolsa: grupo.gastadoDeLaBolsa,
      // Lo que se gastó en la categoría sin tocar su bolsa. Es el Didi, y
      // la comida a crédito: gasto real que ningún presupuesto cubre.
      fueraDeLaBolsa: grupo.total - grupo.gastadoDeLaBolsa,
      subcategorias: Object.keys(grupo.subcategorias)
        .map(function (nombre) {
          const fila = grupo.subcategorias[nombre];
          return {
            nombre: fila.nombre,
            total: fila.total,
            conteo: fila.conteo,
            ticketPromedio: fila.conteo > 0 ? fila.total / fila.conteo : 0,
            consumeLaBolsa: fila.consumeLaBolsa
          };
        })
        .sort(function (a, b) { return b.total - a.total; })
    };
  }).sort(function (a, b) { return b.total - a.total; });
}

// Qué tan avanzado va el ciclo, de 0 a 1. Es la marca de ritmo de las
// barras de presupuesto: sin ella, una barra al 60% no se puede juzgar
// — el día 5 es una alarma y el día 25 es ir bien.
function calcularAvanceDelCiclo(ciclo) {
  const situacion = calcularSituacionDelCiclo(ciclo);
  if (situacion === "cerrado") { return 1; }
  if (situacion === "porVenir") { return 0; }

  const rango = calcularRangoDeDiasDelCiclo(ciclo);
  return rango.diasTranscurridos / rango.diasTotales;
}
