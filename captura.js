// ============================================================
// CAPTURA — la vista del iPhone
// ============================================================
//
// El flujo de ticket: la caja registradora que se usa caminando,
// un paso por pantalla y sin scroll nunca. Se activa solo cuando la
// pantalla es angosta (menos de 641px de ancho).
//
// Contiene la cinta de arriba, el respaldo detrás de su botón, la
// lista de pendientes, el estado del ticket, su dibujado y los
// toques. El teclado lo dibuja la app a propósito: el del sistema
// tapaba el botón de Guardar.
//
// Depende de motor.js. No lo usa la vista ancha.

// ============================================================
// CAPTURA — NOMBRES DE FECHAS
// ============================================================

const DIAS_SEMANA_ABREVIADOS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

// Para las filas del muro, donde el año sobra porque todo lo que se ve
// pertenece al mismo ciclo.
const MESES_ABREVIADOS = ["ene", "feb", "mar", "abr", "may", "jun",
                          "jul", "ago", "sep", "oct", "nov", "dic"];

// Para el encabezado del calendario y del día elegido, donde sí hay espacio
// para el nombre completo.
const NOMBRES_DE_MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const DIAS_SEMANA_COMPLETOS = ["Domingo", "Lunes", "Martes", "Miércoles",
                               "Jueves", "Viernes", "Sábado"];

// ============================================================
// CAPTURA — LA CINTA
// ============================================================
//
// Lo único del estado del ciclo que sobrevive en el teléfono. No es una
// pantalla ni un resumen: es una línea que no estorba el flujo.
//
// Son dos números y responden preguntas distintas, por eso van juntos y del
// mismo tamaño (decisión del usuario, 2 ago 2026):
//
//   Libre para gastar — cuánto puedo gastar sin desfondar lo que ya está
//                       comprometido. Descuenta compromisos y presupuesto.
//   Saldo actual      — cuánto dinero hay en la cuenta ahora mismo. Solo
//                       ingresos menos lo que ya salió a débito.
//
// El saldo siempre es el mayor de los dos. Gastar $200 de comida dentro del
// presupuesto baja el saldo $200 y no mueve el disponible: el gasto y su
// apartado se cancelan. Pasarse sí baja los dos.
//
// Ningún cálculo se inventa aquí — los dos salen del motor, que es el mismo
// que alimenta la vista ancha.

function renderizarCintaCaptura() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();
  const disponible = calcularDisponibleReal(ciclo, datos);
  const saldo = calcularSaldoActual(ciclo, datos);

  document.getElementById("cintaCaptura").innerHTML =
    htmlDeUnNumeroDeLaCinta("Libre para gastar", disponible) +
    htmlDeUnNumeroDeLaCinta("Saldo actual", saldo) +
    "<button type=\"button\" class=\"boton-datos-cinta" +
      (necesitaAvisoDeRespaldo(datos) ? " toca-respaldar" : "") + "\"" +
      " data-abrir-datos=\"1\" aria-label=\"Respaldo\">⤓</button>";
}

function htmlDeUnNumeroDeLaCinta(etiqueta, monto) {
  return "<div class=\"cinta-cifra\">" +
      "<span class=\"cinta-etiqueta\">" + escaparHTML(etiqueta) + "</span>" +
      "<span class=\"cinta-monto mono" + (monto < 0 ? " en-numeros-rojos" : "") + "\">" +
        formatearMoneda(monto) +
      "</span>" +
    "</div>";
}

// ============================================================
// CAPTURA — RESPALDO
// ============================================================
//
// Exportar e importar tienen que existir en el teléfono, no solo en la
// laptop: los datos viven en el almacenamiento del navegador y iOS lo puede
// vaciar tras un tiempo sin abrir la app. Es también la única forma de mover
// datos entre los dos aparatos, porque no hay sincronización (fuera de
// alcance, decidido desde el principio).
//
// No va en el flujo de captura porque no es del día a día: vive detrás del
// botón de la cinta, que se marca en ámbar cuando ya toca respaldar.

function abrirCapaDeDatos() {
  const datos = leerDatos();
  const capa = document.getElementById("capaDatosCaptura");
  const estado = document.getElementById("estadoRespaldoCaptura");
  const toca = necesitaAvisoDeRespaldo(datos);

  if (datos.ultimoRespaldo) {
    const dias = calcularDiasDesdeFecha(datos.ultimoRespaldo);
    estado.textContent = dias === 0
      ? "Último respaldo: hoy."
      : "Último respaldo hace " + dias + (dias === 1 ? " día" : " días") + ".";
  } else {
    estado.textContent = "Todavía no has hecho ningún respaldo.";
  }

  if (toca) {
    estado.textContent += " Conviene exportar ya: si el teléfono borra los datos, no hay de dónde recuperarlos.";
  }
  estado.classList.toggle("toca-respaldar", toca);

  capa.hidden = false;
}

function cerrarCapaDeDatos() {
  document.getElementById("capaDatosCaptura").hidden = true;
}

// ============================================================
// CAPTURA — PENDIENTES
// ============================================================
//
// Un compromiso pendiente es un aviso de que hay que pagar algo. Al
// confirmarlo se crea el gasto que lo cierra, con su monto real, y deja de
// aparecer como pendiente. Un solo registro, nunca dos.
//
// Aquí viven las piezas compartidas: las usan tanto Captura (el teléfono)
// como Próximos pagos y el cajón del calendario (la laptop).

// Cuántos días faltan para una fecha. Negativo significa que ya pasó.
function calcularDiasHastaFecha(fechaTexto) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = crearFechaLocal(fechaTexto);
  const milisegundosPorDia = 1000 * 60 * 60 * 24;
  return Math.round((fecha - hoy) / milisegundosPorDia);
}

// Traduce el resultado de calcularDiasHastaFecha a una frase corta
// ("Vence hoy", "Vence en 3 días", "Venció hace 2 días") para la fila de
// Pendientes en Captura. Es solo redacción sobre un número que ya existe
// — no cambia qué cuenta como urgente ni ningún otro cálculo.
function formatearCuandoVence(diasHasta) {
  if (diasHasta === 0) {
    return "Vence hoy";
  }
  if (diasHasta > 0) {
    return "Vence en " + diasHasta + (diasHasta === 1 ? " día" : " días");
  }
  const diasVencidos = Math.abs(diasHasta);
  return "Venció hace " + diasVencidos + (diasVencidos === 1 ? " día" : " días");
}

// Compartida entre Pendientes (Captura) y Próximos pagos (Análisis) para
// no mantener la misma regla de filtro/orden en dos lugares.
function obtenerPendientesDelCiclo(datos, cicloId) {
  return datos.compromisos
    .filter(function (c) { return c.cicloId === cicloId && !c.pagado; })
    .sort(function (a, b) { return a.fechaProgramada < b.fechaProgramada ? -1 : 1; });
}

// Puente para la vista ancha: el cajón del calendario marca sus pagos con
// un bloque de campos (".monto-real-pendiente", ".fuente-pendiente") y un
// botón. Esta función lee esos campos y delega en la de abajo, que es la
// que de verdad escribe. Captura no la usa: allá el monto y la fuente ya
// viven en el estado del ticket, no en un formulario.
function confirmarPagoDeCompromiso(compromisoId, contenedorDeCampos) {
  const resultado = registrarPagoDeCompromiso(
    compromisoId,
    Number(contenedorDeCampos.querySelector(".monto-real-pendiente").value),
    contenedorDeCampos.querySelector(".fuente-pendiente").value
  );

  if (resultado.aviso) {
    mostrarMensaje(resultado.aviso);
  }
}

// Crea el gasto que cierra un compromiso y lo marca como pagado. Si el
// compromiso viene de un recurrente, el gasto hereda su categoría y
// subcategoría (para que cuente en el avance semanal si aplica). Si viene
// de una deuda o una tarjeta, no hay categoría de presupuesto semanal
// involucrada — son gasto fijo, no variable — así que se deja sin
// categoría y se usa el nombre del compromiso como descripción.
//
// Devuelve si guardó y, si aplica, el aviso que hay que darle al usuario.
// No lo muestra ella: el teléfono y la laptop lo enseñan en sitios
// distintos, y esta función no tiene por qué saber desde dónde la llamaron.
function registrarPagoDeCompromiso(compromisoId, montoReal, fuente) {
  const datos = leerDatos();
  const compromiso = datos.compromisos.find(function (c) { return c.id === compromisoId; });

  if (!compromiso || !montoReal || montoReal <= 0) {
    return { guardado: false, aviso: "" };
  }

  // Alerta obligatoria de SPEC.md: si el pago de una tarjeta es menor al
  // calculado (compras a crédito del periodo de corte), avisar que el
  // banco va a generar intereses sobre la diferencia. Solo informa, no
  // bloquea el pago — el usuario puede decidir pagar menos a propósito.
  let aviso = "";
  if (compromiso.origen === "tarjeta" && montoReal < compromiso.montoEstimado) {
    aviso = "Pagaste menos de lo calculado (" + formatearMoneda(compromiso.montoEstimado) + ") — el banco va a generar intereses sobre la diferencia.";
  }

  let categoriaId = null;
  let subcategoria = null;
  let destinatario = null;

  if (compromiso.origen === "recurrente") {
    const recurrente = datos.recurrentes.find(function (r) { return r.id === compromiso.origenId; });
    if (recurrente) {
      categoriaId = recurrente.categoriaId;
      subcategoria = recurrente.subcategoria;
      destinatario = recurrente.destinatario;
    }
  } else if (compromiso.origen === "unico") {
    // Un compromiso único ya trae su propia categoría y destinatario
    // (ambos opcionales), no los hereda de ninguna regla — no existe una
    // regla detrás.
    categoriaId = compromiso.categoriaId;
    subcategoria = compromiso.subcategoria;
    destinatario = compromiso.destinatario;
  }

  const ahora = new Date();
  const cicloActual = asegurarCicloActual();

  // El gasto se guarda en el ciclo del compromiso, que no siempre es el
  // ciclo de hoy (se puede adelantar el pago de algo del ciclo que viene),
  // así que su semana tiene que medirse contra ese mismo ciclo. Medirla
  // contra el ciclo actual daba una semana que no existe dentro del ciclo
  // al que el gasto pertenece.
  const cicloDelCompromiso = datos.ciclos.find(function (c) { return c.id === compromiso.cicloId; }) || cicloActual;
  const hoyTexto = formatearFechaISO(ahora);

  // Excepción: un compromiso de un ciclo YA CERRADO.
  //
  // Pagar algo vencido de un ciclo pasado es dinero que sale HOY, así que el
  // gasto tiene que vivir en el ciclo de hoy. Con la regla de arriba se iba al
  // ciclo viejo y ni el saldo actual ni el disponible lo sentían: los dos
  // seguían prometiendo dinero que ya no estaba. Le pasó al Director el 4 ago
  // 2026 al pagar el Sky de julio y su tarjeta Nu — su saldo decía $1,187 de
  // más. Hasta ese día el caso era inalcanzable, porque no había forma de
  // llegar a un pendiente de un ciclo pasado.
  //
  // Adelantar un pago del ciclo que VIENE se queda como estaba, a propósito
  // (decisión del Director, 4 ago 2026): ahí el gasto pertenece al
  // presupuesto del ciclo que se está adelantando, y moverlo obligaría además
  // a que ese ciclo dejara de contarlo en su proyección.
  const vieneDeUnCicloCerrado = compromiso.cicloId !== cicloActual.id &&
    cicloDelCompromiso.fechaFin < hoyTexto;
  const cicloDelGasto = vieneDeUnCicloCerrado ? cicloActual : cicloDelCompromiso;

  datos.gastos.push({
    id: generarId("gas"),
    cicloId: cicloDelGasto.id,
    semana: calcularSemanaDeLaFecha(hoyTexto, cicloDelGasto),
    fecha: hoyTexto,
    hora: String(ahora.getHours()).padStart(2, "0") + ":" + String(ahora.getMinutes()).padStart(2, "0"),
    monto: montoReal,
    categoriaId: categoriaId,
    subcategoria: subcategoria,
    destinatario: destinatario,
    fuente: fuente,
    tarjetaId: compromiso.origen === "tarjeta" ? compromiso.origenId : null,
    // Cerrar un compromiso nunca difiere a meses: es un pago que ya se debía,
    // no una compra nueva.
    mesesDiferidos: null,
    compromisoId: compromiso.id,
    descripcion: categoriaId ? "" : compromiso.nombre
  });

  compromiso.montoReal = montoReal;
  compromiso.pagado = true;

  // Cada pago confirmado de una deuda hace avanzar el contador de pagos
  // realizados. Sin esto, la generación de compromisos seguiría calculando
  // para siempre la misma fecha de "siguiente pago" (deduplicada contra el
  // compromiso ya existente) y la deuda dejaría de generar compromisos
  // nuevos en cualquier ciclo futuro.
  if (compromiso.origen === "deuda") {
    const deuda = datos.deudas.find(function (d) { return d.id === compromiso.origenId; });
    if (deuda) {
      deuda.pagosRealizados = deuda.pagosRealizados + 1;
    }
  }

  guardarDatos(datos);
  renderizarTodo();

  return { guardado: true, aviso: aviso };
}

// Borra un movimiento mal capturado y deshace todo lo que provocó.
//
// Un gasto no siempre es un solo registro. Hay dos casos, y el segundo es el
// que puede corromper los datos si se atiende a medias:
//
//   - **Gasto libre** (compromisoId en null): basta con quitarlo. Una compra
//     a meses sin intereses tampoco deja nada que limpiar: el reparto entre
//     los cortes de la tarjeta se calcula al vuelo desde el propio gasto
//     (ver calcularAporteDeGastoAlPagoDeTarjeta), no se guarda en ningún
//     lado, así que desaparece con él.
//   - **Pago de un compromiso**: al registrarlo se marcó el compromiso como
//     pagado, se le guardó el montoReal, y si venía de una deuda se le sumó
//     uno a pagosRealizados. Borrar solo el gasto dejaría el recibo marcado
//     como pagado para siempre: no volvería a aparecer en Pendientes y no
//     habría forma de recuperarlo desde el teléfono. Por eso se revierten
//     las tres cosas, y el pendiente vuelve a estar donde estaba.
function borrarMovimiento(gastoId) {
  const datos = leerDatos();
  const gasto = datos.gastos.find(function (g) { return g.id === gastoId; });

  if (!gasto) {
    return;
  }

  datos.gastos = datos.gastos.filter(function (g) { return g.id !== gastoId; });

  if (gasto.compromisoId) {
    const compromiso = datos.compromisos.find(function (c) { return c.id === gasto.compromisoId; });

    if (compromiso) {
      compromiso.pagado = false;
      compromiso.montoReal = null;

      // El contador de la deuda tiene que retroceder igual que avanzó. Si no,
      // la deuda creería tener un pago de más y dejaría de generar el
      // compromiso que sí le toca en algún ciclo futuro.
      if (compromiso.origen === "deuda") {
        const deuda = datos.deudas.find(function (d) { return d.id === compromiso.origenId; });
        if (deuda && deuda.pagosRealizados > 0) {
          deuda.pagosRealizados = deuda.pagosRealizados - 1;
        }
      }
    }
  }

  guardarDatos(datos);
  renderizarTodo();
}

// ============================================================
// CAPTURA — LA CATEGORÍA "OTROS"
// ============================================================

// Nombre visible de la categoría "Otros": la que recibe lo que no encaja en
// ninguna otra. Se crea sola la primera vez que se usa (decisión del
// usuario, 30 jul 2026) en vez de dejar gastos sin categoría.
const NOMBRE_CATEGORIA_OTROS = "Otros";
const SUBCATEGORIA_OTROS = "Sin clasificar";

// Reconocer "Otros" tiene que ser tolerante, y en un solo lugar. Esta
// categoría se puede escribir a mano desde Ajustes: si se comparara el
// nombre exacto, capturar "otros" en minúscula haría que la app no la
// reconociera, ofreciera crear una segunda, y los gastos acabaran repartidos
// entre dos categorías que se llaman igual.
function esLaCategoriaOtros(categoria) {
  return String(categoria.nombre).trim().toLowerCase() === NOMBRE_CATEGORIA_OTROS.toLowerCase();
}

function asegurarCategoriaOtros() {
  const datos = leerDatos();
  let categoria = datos.config.categorias.find(esLaCategoriaOtros);

  if (!categoria) {
    categoria = {
      id: generarId("cat"),
      nombre: NOMBRE_CATEGORIA_OTROS,
      subcategorias: [SUBCATEGORIA_OTROS],
      esVariableSemanal: false
    };
    datos.config.categorias.push(categoria);
    guardarDatos(datos);
  } else if (categoria.subcategorias.indexOf(SUBCATEGORIA_OTROS) === -1) {
    categoria.subcategorias.push(SUBCATEGORIA_OTROS);
    guardarDatos(datos);
  }

  return categoria;
}

// ============================================================
// CAPTURA — QUÉ HAY QUE PAGAR
// ============================================================
//
// Consultas de solo lectura sobre los compromisos que ya existen. Ninguna
// crea nada ni cambia nada: son las preguntas que el ticket necesita
// hacerse para saber qué ofrecer en cada paso.

// Lo que ya venció y lo que vence hoy, junto y ordenado de lo más viejo a
// lo más reciente. Se buscan en TODOS los ciclos, no solo en el actual:
// un recibo del ciclo pasado que nunca se marcó pagado sigue debiéndose, y
// si solo mirara el ciclo en curso desaparecería del teléfono para siempre.
// Un compromiso de monto cero no es un pago pendiente: es una tarjeta sin
// compras en el periodo. Además sería imposible de quitar de aquí, porque
// no se puede registrar un pago de cero — se quedaría atorado para siempre
// empujando fuera de la vista a los pagos que sí se deben.
function hayAlgoQuePagar(compromiso) {
  return Number(compromiso.montoEstimado) > 0;
}

function obtenerVencimientosAlFrente(datos) {
  const hoyTexto = formatearFechaISO(new Date());
  return datos.compromisos
    .filter(function (c) { return !c.pagado && hayAlgoQuePagar(c) && c.fechaProgramada <= hoyTexto; })
    .sort(function (a, b) { return a.fechaProgramada < b.fechaProgramada ? -1 : 1; });
}

// Lo que vence mañana. No entra a la primera pantalla: sale como nota
// después de guardar, se ve y se va sola.
function obtenerVencimientosDeManana(datos) {
  const mananaTexto = formatearFechaISO(sumarDias(new Date(), 1));
  return datos.compromisos.filter(function (c) {
    return !c.pagado && c.fechaProgramada === mananaTexto;
  });
}

// Los compromisos sin pagar de una categoría en el ciclo. La categoría de
// un compromiso se resuelve con la función que ya existe: para uno que
// viene de un recurrente, vive en el recurrente, no en el compromiso.
function obtenerPendientesDeCategoria(categoriaId, cicloId, datos) {
  return datos.compromisos.filter(function (c) {
    return c.cicloId === cicloId && !c.pagado &&
      resolverCategoriaDeCompromiso(c, datos) === categoriaId;
  });
}

// Los de una subcategoría concreta. El emparejamiento es por subcategoría y
// no por el nombre del compromiso a propósito: el botón que se tocó ES una
// subcategoría, y el nombre es texto libre que puede no coincidir ("Recibo
// del agua" en la subcategoría "Agua").
function obtenerPendientesDeSubcategoria(categoriaId, subcategoria, cicloId, datos) {
  return obtenerPendientesDeCategoria(categoriaId, cicloId, datos).filter(function (c) {
    return resolverSubcategoriaDeCompromiso(c, datos) === subcategoria;
  });
}

// El compromiso sin pagar que le toca a una tarjeta o a una deuda en este
// ciclo. Es el mismo que ya generó el motor y cuyo monto mantiene al día
// actualizarMontosDeCompromisosDeTarjeta llamando a calcularPagoTarjeta —
// por eso pagar por aquí no puede contar doble: cierra ese, no crea otro.
function obtenerPendienteDeOrigen(origen, origenId, cicloId, datos) {
  return datos.compromisos.find(function (c) {
    return c.cicloId === cicloId && !c.pagado && hayAlgoQuePagar(c) &&
      c.origen === origen && c.origenId === origenId;
  }) || null;
}

// Nombre completo de un pago, con su destinatario si lo tiene: dos recibos
// que se llaman "Agua" son cosas distintas si son de domicilios distintos.
function etiquetaCompletaDeCompromiso(compromiso, datos) {
  const destinatario = resolverDestinatarioDeCompromiso(compromiso, datos);
  return escaparHTML(compromiso.nombre) + (destinatario ? " · " + escaparHTML(destinatario) : "");
}

// ============================================================
// CAPTURA — ATAJOS DE CAPTURA
// ============================================================
//
// Lo que de verdad se captura todos los días no son categorías, son
// subcategorías: el súper, la comida diaria, la gasolina. La categoría a la
// que pertenecen (Comida, Transporte) sirve para el análisis de después, no
// para capturar — obligar a pasar por ella es un toque y una pantalla que
// no deciden nada.
//
// Por eso la primera pantalla del teléfono es un muro con esas
// subcategorías directas, y las categorías completas quedan detrás de una
// puerta. Cuáles van en el muro no lo adivina la app: las elige el usuario
// desde la laptop, en Ajustes. Es una decisión que él ya conoce y que la
// app tardaría semanas en aprender sola — y que al aprenderla movería los
// botones de lugar justo cuando ya se memorizaron.
//
// Se guardan en config.atajosDeCaptura como una lista de
// { categoriaId, subcategoria }. Van juntos y no solo la subcategoría
// porque dos categorías distintas pueden tener una subcategoría con el
// mismo nombre. Y es una lista aparte, no una bandera dentro de la
// subcategoría, porque las subcategorías son texto suelto: convertirlas en
// objetos rompería los tres lugares que las comparan por ese texto.

// Cuántos atajos caben en el muro. Cuatro llenan la pantalla del iPhone con
// botones cómodos para el pulgar; con más habría que encogerlos, y un muro
// de atajos que hay que leer con cuidado ya no es un atajo.
const MAXIMO_DE_ATAJOS = 4;

// Los atajos configurados que todavía apuntan a algo que existe.
//
// Un atajo se puede romper solo: basta con renombrar o borrar la
// subcategoría desde Ajustes. Cuando pasa, el atajo simplemente no se
// dibuja, y el dato sigue guardado — si fue un typo y se corrige al rato,
// el botón vuelve a aparecer sin tener que reconfigurarlo. (Solo
// desaparece de verdad la próxima vez que se toque el formulario de
// Ajustes, que reescribe la lista con lo que muestran los menús.)
function obtenerAtajosDeCaptura(datos) {
  const atajos = datos.config.atajosDeCaptura || [];

  return atajos.map(function (atajo) {
    const categoria = datos.config.categorias.find(function (c) {
      return c.id === atajo.categoriaId;
    });

    if (!categoria || !(categoria.subcategorias || []).includes(atajo.subcategoria)) {
      return null;
    }

    return { categoria: categoria, subcategoria: atajo.subcategoria };
  }).filter(function (atajo) {
    return atajo !== null;
  });
}

// Cómo se llama un atajo en pantalla.
//
// Casi siempre es el nombre de la subcategoría, que es lo que se está
// capturando. La excepción es "Otros": su subcategoría real se llama "Sin
// clasificar", y un botón que dice eso no se entiende de un vistazo. Ahí
// manda el nombre de la categoría, que es como el usuario la piensa.
function etiquetaDeAtajo(categoria, subcategoria) {
  return esLaCategoriaOtros(categoria) ? categoria.nombre : subcategoria;
}

// Las subcategorías que se pueden poner en el muro: las de categorías de
// gasto libre. Una subcategoría de Servicios no cabe aquí — tocarla no
// captura un gasto nuevo, va a buscar un recibo que ya existe, y para eso
// está la otra puerta.
//
// "Otros" se ofrece siempre, exista o no la categoría todavía. Se crea sola
// la primera vez que se usa, así que sin esto no habría forma de ponerla en
// el muro antes de haberla usado una vez — justo al revés de lo que se
// necesita, que es tenerla a la mano desde el principio. Cuando todavía no
// existe viaja con categoria en null, y quien la elija la crea.
function obtenerSubcategoriasCandidatasAAtajo(datos) {
  const candidatas = [];

  datos.config.categorias.forEach(function (categoria) {
    if (!esCategoriaDeGastoLibre(categoria)) {
      return;
    }
    (categoria.subcategorias || []).forEach(function (subcategoria) {
      candidatas.push({
        categoria: categoria,
        subcategoria: subcategoria,
        etiqueta: etiquetaDeAtajo(categoria, subcategoria)
      });
    });
  });

  if (!datos.config.categorias.some(esLaCategoriaOtros)) {
    candidatas.push({
      categoria: null,
      subcategoria: SUBCATEGORIA_OTROS,
      etiqueta: NOMBRE_CATEGORIA_OTROS
    });
  }

  return candidatas;
}

// ============================================================
// CAPTURA — LOS DOS RENGLONES INFORMATIVOS
// ============================================================
//
// Dos cálculos nuevos, y los dos leen datos que ya existen: presupuesto
// semanal, gastos y compromisos. Ninguno agrega un campo al modelo ni
// toca una fórmula del motor.
//
// Los dos son informativos. Ninguno bloquea, ninguno es un tope, ninguno
// es una barra de progreso: dicen cómo va la cosa y ya.

// Cuánto queda del presupuesto semanal de una categoría variable, contando
// lo que se está tecleando ahora mismo. Puede quedar negativo, y entonces
// dice por cuánto se pasó.
//
// Devuelve null cuando esa categoría no tiene presupuesto capturado: sin un
// total contra el cual medir, no hay nada honesto que decir.
function calcularRestanteSemanalDeCategoria(categoria, ciclo, datos, montoEnCurso) {
  // Contra la bolsa de ESTA semana, no contra el presupuesto capturado.
  // Desde que las semanas son cuatro y de distinta longitud, una semana de 9
  // días tiene bolsa de $2,700 aunque el presupuesto capturado diga $2,100:
  // medir contra el número plano le habría quitado tres días de comida.
  const semanaDeHoy = calcularSemanaDeLaFecha(formatearFechaISO(new Date()), ciclo);
  const bolsa = calcularBolsaSemanalDeCategoria(categoria, ciclo, datos, semanaDeHoy);
  if (bolsa <= 0) {
    return null;
  }

  // Lo ya gastado sale de la misma función que usa el apartado del
  // disponible, con su mismo filtro exacto (categoría, ciclo, semana, débito
  // y subcategoría que consume): así el teléfono y la laptop nunca pueden
  // decir números distintos.
  const yaGastado = calcularGastadoDeLaBolsaEnLaSemana(categoria, ciclo, datos, semanaDeHoy);

  return bolsa - yaGastado - montoEnCurso;
}

// Cuántos pagos de esta categoría siguen pendientes en el ciclo y cuánto
// suman, SIN contar el que se está pagando en este momento. Por eso este
// renglón no se mueve al editar el monto: el monto que cambia es
// justamente el del pago que queda fuera de la cuenta.
function calcularFaltantesDeCategoriaEnElCiclo(categoriaId, cicloId, datos, idQueSeEstaPagando) {
  const faltantes = obtenerPendientesDeCategoria(categoriaId, cicloId, datos)
    .filter(function (c) { return c.id !== idQueSeEstaPagando; });

  return {
    cuantos: faltantes.length,
    suma: faltantes.reduce(function (total, c) { return total + Number(c.montoEstimado); }, 0)
  };
}

// Qué dice el renglón que va arriba del monto, como texto y no como HTML.
// Cuál de los dos aparece lo decide la categoría:
//
// - Variable y pagando con débito -> lo que queda de la semana. Con
//   crédito no aparece: el presupuesto semanal mide lo que sale de la
//   cuenta esta semana, y una compra a crédito sale en otro ciclo.
// - No variable y cerrando un compromiso -> cuántos faltan de esa
//   categoría este ciclo.
// - Cualquier otro caso (tarjetas, deudas, categorías sin presupuesto):
//   ningún renglón. Más vale nada que un número que no significa nada.
//
// Devuelve el texto en vez del HTML porque teclear cambia solo el texto del
// renglón que ya está en pantalla, sin volver a crear el elemento (ver
// actualizarMontoEnPantalla). htmlDelRenglonInformativo, abajo, es la que lo
// envuelve para el dibujado inicial.
function textoDelRenglonInformativo(categoriaId, fuente, montoEnCurso, idQueSeEstaPagando) {
  const sinRenglon = { texto: "", excedido: false };
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();
  const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaId; });

  if (!categoria) {
    return sinRenglon;
  }

  if (categoria.esVariableSemanal) {
    if (fuente !== "debito") {
      return sinRenglon;
    }
    const restante = calcularRestanteSemanalDeCategoria(categoria, ciclo, datos, montoEnCurso);
    if (restante === null) {
      return sinRenglon;
    }
    // El nombre que se dice es el de quien de verdad gasta esa bolsa. Si el
    // presupuesto de Transporte solo lo consume la gasolina, decir "te quedan
    // $342 en Transporte" invitaría a gastarlos en un Didi que no los toca.
    const nombreDeLaBolsa = categoria.subcategoriaQueConsumeElPresupuesto || categoria.nombre;

    if (restante < 0) {
      return {
        texto: "Te pasaste por " + formatearMoneda(Math.abs(restante)) + " en " + nombreDeLaBolsa + " esta semana",
        excedido: true
      };
    }
    return {
      texto: "Te quedan " + formatearMoneda(restante) + " en " + nombreDeLaBolsa + " esta semana",
      excedido: false
    };
  }

  if (!idQueSeEstaPagando) {
    return sinRenglon;
  }

  const faltantes = calcularFaltantesDeCategoriaEnElCiclo(categoriaId, ciclo.id, datos, idQueSeEstaPagando);
  if (faltantes.cuantos === 0) {
    return { texto: "Con este se cierra " + categoria.nombre + " este ciclo", excedido: false };
  }
  return {
    texto: "Faltan " + faltantes.cuantos + " de " + categoria.nombre + " este ciclo · " +
      formatearMoneda(faltantes.suma) + " por pagar",
    excedido: false
  };
}

// El renglón como HTML, para el dibujado completo del ticket. Al teclear no
// se usa: ahí se cambia el texto del que ya existe.
function htmlDelRenglonInformativo(categoriaId, fuente, montoEnCurso, idQueSeEstaPagando) {
  const renglon = textoDelRenglonInformativo(categoriaId, fuente, montoEnCurso, idQueSeEstaPagando);
  return "<p class=\"renglon-informativo" + (renglon.excedido ? " excedido" : "") + "\">" +
    escaparHTML(renglon.texto) + "</p>";
}

// ============================================================
// CAPTURA — ESTADO DEL TICKET
// ============================================================
//
// Captura funciona como una caja registradora: un paso por pantalla, el
// papel imprimiéndose hacia abajo, y al guardar el ticket se desprende para
// dejar salir el siguiente en blanco. Nunca hay dos pasos abiertos a la vez
// y nunca hay scroll.
//
// Los pasos son:
//
//   "opciones"     El muro de atajos: lo que vence hoy o ya venció, los
//                  botones grandes de lo que se captura a diario, y las dos
//                  puertas al resto. Es lo primero que se ve al abrir.
//   "categorias"   Las categorías completas, más Tarjetas y Deudas. Es lo
//                  que antes era la primera pantalla; ahora vive detrás de
//                  la puerta "Otra categoría".
//   "pendientes"   Todo lo que falta pagar en el ciclo, por fecha. Detrás de
//                  la puerta "Adelantar un pago".
//   "movimientos"  Lo ya capturado, hoy arriba y los días anteriores debajo.
//                  Detrás de la puerta "Lo registrado".
//   "subcategoria" Las subcategorías de la categoría elegida (o la lista de
//                  tarjetas, o la de deudas).
//   "monto"        Teclado propio, débito/crédito y Guardar. Es el paso de
//                  un gasto libre, uno que nadie esperaba.
//   "pago"         La misma pantalla, pero cerrando un compromiso que ya
//                  existía. Se llega desde un vencimiento, desde una
//                  subcategoría no variable, o desde una tarjeta o deuda.
//
// Qué categorías son de gasto libre y cuáles van a buscar un pendiente lo
// decide esVariableSemanal, que ya está en el modelo: las variables
// (comida, transporte) son gasto libre; las no variables (servicios,
// suscripciones) tienen un compromiso detrás, y lo que se hace con ellas
// no es inventar un gasto, es pagar el que ya existe.

const PASO_OPCIONES = "opciones";
const PASO_CATEGORIAS = "categorias";
const PASO_PENDIENTES = "pendientes";
const PASO_MOVIMIENTOS = "movimientos";
const PASO_SUBCATEGORIA = "subcategoria";
const PASO_MONTO = "monto";
const PASO_PAGO = "pago";

// Cuántos vencimientos se ven completos antes de resumir el resto en una
// línea. Los primeros son los más viejos: lo vencido pesa más que lo que
// apenas vence hoy.
//
// Son dos y no más porque la pantalla de entrada ya no es solo esto: abajo
// van los últimos movimientos y las cuatro burbujas, y todo tiene que caber
// sin scroll en un iPhone. El resto de lo vencido no se pierde — se resume
// en una línea aquí y está completo detrás de "Adelantar un pago".
const VENCIMIENTOS_VISIBLES_AL_FRENTE = 2;

// A partir de cuántas opciones la rejilla pasa de dos a tres columnas. Con
// más de doce en dos columnas, los botones quedan demasiado bajos para el
// pulgar.
const OPCIONES_PARA_TRES_COLUMNAS = 12;

let pasoDelTicket = PASO_OPCIONES;
let categoriaSeleccionadaGasto = null;
let subcategoriaSeleccionadaGasto = null;
let fuenteSeleccionadaGasto = "debito";
let tarjetaSeleccionadaGasto = null;
// A cuántos meses sin intereses va la compra. 1 es de contado, y es siempre
// el punto de partida: diferir es la excepción, no lo normal.
let mesesDiferidosDelTicket = 1;
// El monto se guarda como el texto que se ha tecleado, no como número: es
// lo que permite mostrar "12." mientras se escribe "12.50".
let montoEscritoEnElTicket = "";
let descripcionEscritaEnElTicket = "";
let destinatarioElegidoEnElTicket = "";
// Tarjetas y Deudas no son categorías, así que cuando se elige una de esas
// dos el paso siguiente muestra tarjetas o deudas en vez de subcategorías.
let bloqueEspecialElegido = null;
let compromisoQueSeEstaPagando = null;
let pasoAlQueRegresaElPago = PASO_OPCIONES;
// A dónde manda la flecha de regreso desde el paso del monto. Normalmente
// a las subcategorías, que es de donde se vino; pero un atajo del muro se
// salta ese paso, así que tiene que regresar hasta el muro o la flecha
// llevaría a una pantalla por la que nunca se pasó.
let pasoAlQueRegresaElGasto = PASO_SUBCATEGORIA;
// Qué campo de texto está abierto ocupando el lugar del teclado numérico.
let campoDeTextoAbierto = null;
let elTicketDebeEntrarImprimiendose = false;

// "Otros" no es variable, pero sí es gasto libre: es la salida para lo que no
// encaja en ninguna categoría y nunca va a tener un compromiso detrás. Ahí
// viven las compras que nadie programa.
function esCategoriaDeGastoLibre(categoria) {
  return categoria.esVariableSemanal || esLaCategoriaOtros(categoria);
}

function montoDelTicketComoNumero() {
  return Number(montoEscritoEnElTicket) || 0;
}

// Deja el ticket como recién salido de la máquina.
function reiniciarElTicket() {
  pasoDelTicket = PASO_OPCIONES;
  categoriaSeleccionadaGasto = null;
  subcategoriaSeleccionadaGasto = null;
  fuenteSeleccionadaGasto = "debito";
  tarjetaSeleccionadaGasto = null;
  mesesDiferidosDelTicket = 1;
  montoEscritoEnElTicket = "";
  descripcionEscritaEnElTicket = "";
  destinatarioElegidoEnElTicket = "";
  bloqueEspecialElegido = null;
  compromisoQueSeEstaPagando = null;
  pasoAlQueRegresaElPago = PASO_OPCIONES;
  pasoAlQueRegresaElGasto = PASO_SUBCATEGORIA;
  campoDeTextoAbierto = null;
}

// La tarjeta que viene marcada de entrada: la de mayor línea.
//
// Se eligió por lineaTotal, que es un dato ya capturado por tarjeta, y no
// por "línea disponible": la app no lleva el saldo ocupado real de una
// tarjeta sobre datos reales (el que existe vive solo dentro de la
// simulación), así que calcularlo sería inventar un tercer cálculo.
function tarjetaPreseleccionada(datos) {
  if (datos.config.tarjetas.length === 0) {
    return null;
  }
  const ordenadas = datos.config.tarjetas.slice().sort(function (a, b) {
    return Number(b.lineaTotal) - Number(a.lineaTotal);
  });
  return ordenadas[0].id;
}

// Los destinatarios que ya se han usado en esta categoría. Se ofrecen como
// lista y no como texto libre porque en el teléfono volver a teclear un
// nombre largo es la diferencia entre que el campo se use y que se ignore.
function obtenerDestinatariosDeLaCategoria(datos, categoriaId) {
  const usados = [];

  function anotar(destinatario) {
    if (destinatario && usados.indexOf(destinatario) === -1) {
      usados.push(destinatario);
    }
  }

  datos.gastos.forEach(function (g) { if (g.categoriaId === categoriaId) { anotar(g.destinatario); } });
  datos.recurrentes.forEach(function (r) { if (r.categoriaId === categoriaId) { anotar(r.destinatario); } });
  datos.compromisos.forEach(function (c) { if (c.categoriaId === categoriaId) { anotar(c.destinatario); } });

  return usados;
}

// Revisa si ya existe, en los últimos MINUTOS_PARA_ALERTA_DUPLICADO
// minutos, un gasto de la misma categoría con el mismo monto exacto — para
// avisar antes de registrar por accidente el mismo gasto dos veces.
function existeGastoSimilarReciente(categoriaId, monto) {
  const datos = leerDatos();
  const ahora = new Date();

  return datos.gastos.some(function (gasto) {
    if (gasto.categoriaId !== categoriaId || Number(gasto.monto) !== Number(monto)) {
      return false;
    }

    const partesHora = gasto.hora.split(":");
    const momentoDelGasto = crearFechaLocal(gasto.fecha);
    momentoDelGasto.setHours(Number(partesHora[0]), Number(partesHora[1]), 0, 0);

    const minutosTranscurridos = (ahora - momentoDelGasto) / (1000 * 60);
    return minutosTranscurridos >= 0 && minutosTranscurridos <= MINUTOS_PARA_ALERTA_DUPLICADO;
  });
}

// Guarda un gasto libre: el de las categorías variables y el de "Otros".
// No cierra ningún compromiso — nace del flujo de tres pantallas, no de
// algo que ya se debía — así que su compromisoId va en null.
function guardarGastoDelTicket() {
  const monto = montoDelTicketComoNumero();

  if (!categoriaSeleccionadaGasto || !subcategoriaSeleccionadaGasto || monto <= 0) {
    return;
  }

  if (fuenteSeleccionadaGasto === "credito" && !tarjetaSeleccionadaGasto) {
    alert("Elige a qué tarjeta se carga este gasto.");
    return;
  }

  if (existeGastoSimilarReciente(categoriaSeleccionadaGasto, monto)) {
    const continuar = confirm("Ya registraste un gasto igual en esta categoría hace menos de 30 minutos. ¿Registrar de todas formas?");
    if (!continuar) {
      return;
    }
  }

  const ahora = new Date();
  const cicloActual = asegurarCicloActual();
  const datos = leerDatos();

  datos.gastos.push({
    id: generarId("gas"),
    cicloId: cicloActual.id,
    semana: calcularSemanaDeLaFecha(formatearFechaISO(ahora), cicloActual),
    fecha: formatearFechaISO(ahora),
    hora: String(ahora.getHours()).padStart(2, "0") + ":" + String(ahora.getMinutes()).padStart(2, "0"),
    monto: monto,
    categoriaId: categoriaSeleccionadaGasto,
    subcategoria: subcategoriaSeleccionadaGasto,
    // Se captura desde el propio gasto: sin esto, el desglose por
    // destinatario que pide SPEC.md nunca tendría datos de gastos libres.
    destinatario: destinatarioElegidoEnElTicket || null,
    fuente: fuenteSeleccionadaGasto,
    tarjetaId: tarjetaSeleccionadaGasto,
    // null es de contado. Se guarda el plazo, no las mensualidades: el monto
    // sigue siendo lo que costó la compra, y quien reparte es el pago de la
    // tarjeta. Así el análisis por categoría ve la compra del día que se
    // hizo, y el flujo de efectivo ve la mensualidad.
    mesesDiferidos: (fuenteSeleccionadaGasto === "credito" && mesesDiferidosDelTicket > 1)
      ? mesesDiferidosDelTicket
      : null,
    compromisoId: null,
    descripcion: descripcionEscritaEnElTicket.trim()
  });

  guardarDatos(datos);
  cerrarElTicketYEmpezarOtro();
}

// Cierra un compromiso que ya existía: un vencimiento, un recibo que se
// buscó por su subcategoría, o el corte de una tarjeta. Delega en la misma
// función que usa la laptop, para que un pago se registre igual venga de
// donde venga.
function guardarPagoDelTicket() {
  const monto = montoDelTicketComoNumero();

  if (!compromisoQueSeEstaPagando || monto <= 0) {
    return;
  }

  const resultado = registrarPagoDeCompromiso(compromisoQueSeEstaPagando, monto, fuenteSeleccionadaGasto);

  if (!resultado.guardado) {
    return;
  }

  // En el teléfono no existe el bloque de mensajes de la laptop, así que
  // un aviso que importa (pagar menos del corte genera intereses) tiene
  // que interrumpir: es la última oportunidad de enterarse.
  if (resultado.aviso) {
    alert(resultado.aviso);
  }

  cerrarElTicketYEmpezarOtro();
}

// El gesto que cierra cualquier guardado: el ticket se desprende hacia
// abajo, sube uno en blanco por la pantalla 1, y si algo vence mañana sale
// la nota. Se repite cada vez que se guarda, aunque sea la tercera del día.
function cerrarElTicketYEmpezarOtro() {
  desprenderElTicket();
  reiniciarElTicket();
  renderizarTodo();
  mostrarNotaDeManana();
}

// ============================================================
// CAPTURA — DIBUJADO DEL TICKET
// ============================================================
//
// Cada paso arma su propio HTML y se pinta entero. Los pasos no comparten
// marcado y no se acumulan: el ticket siempre muestra uno y solo uno.

// Cabecera común: la flecha para regresar, a dónde va lo que se está
// capturando, y la fecha en la esquina como en cualquier recibo.
function htmlCabeceraDelTicket(titulo, color, conFlecha) {
  const hoy = new Date();
  const fecha = DIAS_SEMANA_ABREVIADOS[hoy.getDay()] + " " + hoy.getDate() + " " + MESES_ABREVIADOS[hoy.getMonth()];

  return "<div class=\"ticket-cabecera\">" +
    (conFlecha ? "<button type=\"button\" class=\"boton-atras\" data-accion=\"atras\" aria-label=\"Regresar un paso\">←</button>" : "") +
    (color ? "<span class=\"marca-categoria\" style=\"--color-categoria: " + color + ";\"></span>" : "") +
    "<span class=\"ticket-titulo\">" + titulo + "</span>" +
    "<span class=\"ticket-fecha mono\">" + fecha + "</span>" +
  "</div>";
}

// Una rejilla de botones grandes. Se usa para categorías, subcategorías,
// tarjetas, deudas y para elegir entre varios recibos del mismo nombre.
const ALTO_MAXIMO_DE_RENGLON = 88;
const SEPARACION_ENTRE_RENGLONES = 7;

function htmlRejillaDeOpciones(opciones) {
  const columnas = opciones.length > OPCIONES_PARA_TRES_COLUMNAS ? 3 : 2;
  const filas = Math.ceil(opciones.length / columnas);

  // El tope de alto se calcula aquí porque el CSS no sabe cuántas filas
  // hay. Si el tope no cabe en la pantalla, la rejilla se encoge sola: el
  // tope es un máximo, nunca un mínimo.
  const topeDeAlto = (filas * ALTO_MAXIMO_DE_RENGLON) + ((filas - 1) * SEPARACION_ENTRE_RENGLONES);

  const botones = opciones.map(function (opcion) {
    const atributos = Object.keys(opcion.datos || {}).map(function (nombre) {
      return " data-" + nombre + "=\"" + escaparHTML(String(opcion.datos[nombre])) + "\"";
    }).join("");

    return "<button type=\"button\" class=\"boton-ticket\"" +
      " style=\"--color-categoria: " + (opcion.color || "var(--tinta-ter-c)") + ";\"" +
      (opcion.apagada ? " disabled" : "") +
      atributos + ">" +
      "<span>" + escaparHTML(opcion.nombre) + "</span>" +
      (opcion.apoyo ? "<span class=\"apoyo-boton-ticket\">" + escaparHTML(opcion.apoyo) + "</span>" : "") +
    "</button>";
  }).join("");

  return "<div class=\"rejilla-ticket\" style=\"--columnas-ticket: " + columnas +
    "; max-height: " + topeDeAlto + "px;\">" + botones + "</div>";
}

// ---------- Paso 1: el muro de atajos ----------

// La primera pantalla. Tres bloques y nada más: lo que ya venció o vence
// hoy, los botones de lo que se captura a diario, y las dos puertas al
// resto. Cada atajo trae categoría y subcategoría, así que cae directo al
// teclado: dos toques y guardar.
//
// Si todavía no hay atajos configurados, esta pantalla se comporta como
// antes y muestra las categorías completas. Así la app nunca se ve vacía
// mientras no se haya entrado a Ajustes a elegirlos.
function htmlPasoOpciones() {
  const datos = leerDatos();
  const atajos = obtenerAtajosDeCaptura(datos);

  if (atajos.length === 0) {
    return htmlPasoCategorias();
  }

  // El orden de la pantalla no es casual: primero lo que hay que saber (lo
  // que vence, lo último capturado) y hasta abajo lo que se toca. Los
  // atajos quedan cerca del pulgar, que es donde tienen que estar cuando se
  // captura de pie y con una mano.
  return htmlCabeceraDelTicket("Ciclo", null, false) +
    htmlVencimientosAlFrente(datos) +
    htmlUltimosMovimientos(datos) +
    htmlDeLaBarraSemanal(datos) +
    htmlBurbujasDeAtajos(atajos, datos) +
    htmlDeLasDosPuertas(datos);
}

// La barra de la semana, entre lo ya capturado y los atajos. Ese lugar lo
// eligió el usuario: es lo último que ve antes de tocar el botón con el que
// va a gastar, que es justo cuando la información sirve.
//
// Un segmento por día de la semana. El de hoy va apagado hasta que el día
// termine; los ya cerrados llevan el color que tenía el acumulado al cerrar.
// El único número es lo que queda de la bolsa, y ese sí se mueve en vivo.
// Nada más — el usuario fue explícito en no llenarla de cifras.
//
// Si no hay categoría marcada con barra, o no tiene presupuesto capturado,
// no se dibuja nada. Una barra sin bolsa contra la cual medir mentiría.
function htmlDeLaBarraSemanal(datos) {
  const barra = calcularBarraSemanalDeComida(asegurarCicloActual(), datos);
  if (!barra) {
    return "";
  }

  const segmentos = barra.segmentos.map(function (segmento) {
    return "<span class=\"segmento-barra segmento-" + segmento.color +
      (segmento.esHoy ? " es-hoy" : "") + "\"></span>";
  }).join("");

  const textoDelRestante = barra.fueraDePresupuesto
    ? "Fuera de presupuesto · " + formatearMoneda(barra.restante)
    : "Quedan " + formatearMoneda(barra.restante);

  return "<div class=\"barra-semanal" + (barra.fueraDePresupuesto ? " excedida" : "") + "\">" +
      "<div class=\"pista-barra\">" + segmentos + "</div>" +
      "<p class=\"restante-barra\">" + escaparHTML(textoDelRestante) + "</p>" +
    "</div>";
}

// Los atajos como burbujas en lista: una por renglón, redondeadas, con el
// color de su categoría como punto.
//
// Antes eran tarjetas grandes en cuadrícula y llenaban la pantalla ellas
// solas. Se compactaron para dejarle sitio a los últimos movimientos, que
// es lo que se viene a ver antes de capturar. Siguen siendo del ancho
// completo, que es lo que hace imposible fallarles con el pulgar.
function htmlBurbujasDeAtajos(atajos, datos) {
  const burbujas = atajos.map(function (atajo) {
    return "<button type=\"button\" class=\"burbuja-atajo\"" +
      " style=\"--color-categoria: " + obtenerColorDeCategoria(atajo.categoria.id, datos) + ";\"" +
      " data-accion=\"atajo\"" +
      " data-categoria=\"" + escaparHTML(atajo.categoria.id) + "\"" +
      " data-subcategoria=\"" + escaparHTML(atajo.subcategoria) + "\">" +
      escaparHTML(etiquetaDeAtajo(atajo.categoria, atajo.subcategoria)) +
    "</button>";
  }).join("");

  return "<div class=\"burbujas-atajos\">" + burbujas + "</div>";
}

// Las dos salidas al pie del muro, para todo lo que no es del día a día.
// Se ven como renglones y no como botones grandes a propósito: son la
// excepción, y no deben competir con los atajos por la mirada.
//
// "Adelantar un pago" solo aparece si hay algo que pagar. Una puerta que
// lleva a una lista vacía es una promesa incumplida.
function htmlDeLasDosPuertas(datos) {
  const ciclo = asegurarCicloActual();
  const cuantosPendientes = obtenerPendientesParaAdelantar(datos, ciclo.id).length;

  const puertaDePagos = cuantosPendientes > 0
    ? "<button type=\"button\" class=\"puerta-ticket\" data-accion=\"ir-a-paso\" data-paso=\"" + PASO_PENDIENTES + "\">" +
        "<span>Adelantar un pago</span>" +
        "<span class=\"cuantos\">" + cuantosPendientes + "</span>" +
      "</button>"
    : "";

  // Lo registrado lleva el total de hoy en la propia puerta. Es el dato que
  // casi siempre se venía a buscar, así que muchas veces se responde sin
  // entrar. Si hoy no se ha capturado nada, la puerta se ve pero sin cifra.
  const hoyTexto = formatearFechaISO(new Date());
  const totalDeHoy = datos.gastos
    .filter(function (gasto) { return gasto.fecha === hoyTexto; })
    .reduce(function (suma, gasto) { return suma + Number(gasto.monto); }, 0);

  const puertaDeMovimientos = datos.gastos.length > 0
    ? "<button type=\"button\" class=\"puerta-ticket\" data-accion=\"ir-a-paso\" data-paso=\"" + PASO_MOVIMIENTOS + "\">" +
        "<span>Lo registrado</span>" +
        (totalDeHoy > 0 ? "<span class=\"cuantos mono\">hoy " + formatearMoneda(totalDeHoy) + "</span>" : "") +
      "</button>"
    : "";

  return "<div class=\"puertas-ticket\">" +
    "<button type=\"button\" class=\"puerta-ticket\" data-accion=\"ir-a-paso\" data-paso=\"" + PASO_CATEGORIAS + "\">" +
      "<span>Otra categoría</span>" +
    "</button>" +
    puertaDePagos +
    puertaDeMovimientos +
  "</div>";
}

// ---------- Detrás de la puerta: las categorías completas ----------

// Lo que hasta el 1 ago 2026 era la primera pantalla. No cambió nada de lo
// que hace; solo dejó de ser lo primero que se ve. Sigue aquí entera porque
// es la que cubre lo que no es del día a día: el restaurante de una vez por
// semana, el Didi suelto, o adelantar un pago entrando por su categoría.
function htmlPasoCategorias() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();

  if (datos.config.categorias.length === 0 && datos.config.tarjetas.length === 0) {
    return htmlCabeceraDelTicket("Captura", null, false) +
      "<p class=\"ticket-vacio\">Todavía no hay categorías dadas de alta.<br>" +
      "Créalas desde la laptop y aquí aparecen solas.</p>";
  }

  const opciones = [];

  datos.config.categorias.forEach(function (categoria) {
    // Una categoría que solo sirve para pagar pendientes y no tiene
    // ninguno este ciclo se ve apagada: entrar sería llegar a una pantalla
    // donde no hay nada que tocar.
    const sinNadaQuePagar = !esCategoriaDeGastoLibre(categoria) &&
      obtenerPendientesDeCategoria(categoria.id, ciclo.id, datos).length === 0;

    opciones.push({
      nombre: categoria.nombre,
      color: obtenerColorDeCategoria(categoria.id, datos),
      apagada: sinNadaQuePagar,
      datos: { accion: "elegir-categoria", categoria: categoria.id }
    });
  });

  // La salida para lo que no encaja en nada. Si la categoría todavía no
  // existe se ofrece igual y se crea sola al usarla, como hasta ahora.
  if (!datos.config.categorias.some(esLaCategoriaOtros)) {
    opciones.push({
      nombre: NOMBRE_CATEGORIA_OTROS,
      color: COLOR_CATEGORIA_SIN_ASIGNAR,
      datos: { accion: "crear-otros" }
    });
  }

  // Tarjetas y Deudas no son categorías: su gasto es saldo, no
  // presupuesto. Pero sí son pagos del ciclo, así que entran al mismo
  // nivel, con el gris de "sin categoría" que ya usan en el muro.
  if (datos.config.tarjetas.length > 0) {
    const hayCorte = datos.config.tarjetas.some(function (tarjeta) {
      return obtenerPendienteDeOrigen("tarjeta", tarjeta.id, ciclo.id, datos) !== null;
    });
    opciones.push({
      nombre: "Tarjetas",
      color: COLOR_CATEGORIA_SIN_ASIGNAR,
      apagada: !hayCorte,
      datos: { accion: "elegir-bloque", bloque: "tarjeta" }
    });
  }

  const deudasActivas = datos.deudas.filter(function (d) { return d.activa; });
  if (deudasActivas.length > 0) {
    const hayPago = deudasActivas.some(function (deuda) {
      return obtenerPendienteDeOrigen("deuda", deuda.id, ciclo.id, datos) !== null;
    });
    opciones.push({
      nombre: "Deudas",
      color: COLOR_CATEGORIA_SIN_ASIGNAR,
      apagada: !hayPago,
      datos: { accion: "elegir-bloque", bloque: "deuda" }
    });
  }

  // Esta pantalla se dibuja en dos situaciones y no se ve igual en las dos.
  // Si todavía no hay atajos configurados, ella ES la primera pantalla: no
  // lleva flecha (no hay a dónde regresar) y carga los vencimientos. Si se
  // llegó por la puerta del muro, lleva flecha y no repite los vencimientos,
  // que ya se vieron en la pantalla anterior.
  const esLaPrimeraPantalla = pasoDelTicket === PASO_OPCIONES;

  return htmlCabeceraDelTicket(
      esLaPrimeraPantalla ? "Ciclo" : "Otra categoría",
      null,
      !esLaPrimeraPantalla
    ) +
    (esLaPrimeraPantalla ? htmlVencimientosAlFrente(datos) : "") +
    htmlRejillaDeOpciones(opciones);
}

// Cuántos movimientos recientes se asoman en la pantalla de entrada. Dos
// bastan para reconocer si lo que se viene a capturar ya está — que es la
// única pregunta que se hace aquí — y es lo que cabe sin empujar las
// burbujas fuera de la pantalla. Para ver más está la puerta.
const ULTIMOS_EN_LA_ENTRADA = 2;

// Lo último capturado, asomado en la primera pantalla.
//
// Existe para responder "¿ya lo registré?" ANTES de capturar, que es cuando
// sirve. La misma lista completa vive detrás de la puerta "Lo registrado",
// pero llegar hasta allá y volver es justo lo que no se hace cuando se está
// parado en la caja del súper.
//
// No se puede tocar: es para mirar. Borrar y revisar días anteriores se
// hacen adentro, donde hay espacio para hacerlo con cuidado.
function htmlUltimosMovimientos(datos) {
  const ultimos = obtenerMovimientosRecientes(datos).slice(0, ULTIMOS_EN_LA_ENTRADA);

  if (ultimos.length === 0) {
    return "";
  }

  const hoyTexto = formatearFechaISO(new Date());

  const filas = ultimos.map(function (gasto) {
    // La hora sola basta para lo de hoy. Para lo de antes hace falta el día,
    // o "08:40" mentiría diciendo que fue esta mañana.
    const cuando = gasto.fecha === hoyTexto
      ? gasto.hora
      : nombreDelDiaDeMovimientos(gasto.fecha);

    return "<div class=\"fila-ultimo\">" +
      "<span class=\"cuando mono\">" + escaparHTML(cuando) + "</span>" +
      "<span class=\"que\">" + escaparHTML(etiquetaDeMovimiento(gasto, datos)) + "</span>" +
      "<span class=\"monto mono\">" + formatearMoneda(gasto.monto) + "</span>" +
    "</div>";
  }).join("");

  return "<div class=\"ultimos-ticket\">" +
    "<p class=\"rotulo-ultimos\">Lo último</p>" +
    filas +
  "</div>";
}

// Lo vencido y lo que vence hoy, arriba de las categorías. No tapa nada ni
// interrumpe: es una fila más que se puede tocar o ignorar. Si no hay nada,
// no se ve absolutamente nada.
function htmlVencimientosAlFrente(datos) {
  const vencimientos = obtenerVencimientosAlFrente(datos);

  if (vencimientos.length === 0) {
    return "";
  }

  const alFrente = vencimientos.slice(0, VENCIMIENTOS_VISIBLES_AL_FRENTE);
  const resto = vencimientos.length - alFrente.length;

  const filas = alFrente.map(function (compromiso) {
    const diasHasta = calcularDiasHastaFecha(compromiso.fechaProgramada);

    return "<button type=\"button\" class=\"fila-vencimiento" + (diasHasta < 0 ? " ya-vencido" : "") + "\"" +
      " data-accion=\"pagar\" data-compromiso=\"" + compromiso.id + "\" data-regreso=\"" + PASO_OPCIONES + "\">" +
      "<span class=\"nombre\">" + etiquetaCompletaDeCompromiso(compromiso, datos) +
        "<span class=\"cuando\">" + formatearCuandoVence(diasHasta) + "</span>" +
      "</span>" +
      "<span class=\"monto mono\">" + formatearMoneda(compromiso.montoEstimado) + "</span>" +
    "</button>";
  }).join("");

  const linea = resto > 0
    ? "<p class=\"vencimientos-de-mas\">y " + resto + (resto === 1 ? " más" : " más") + " esperando</p>"
    : "";

  return "<div class=\"vencimientos-ticket\">" + filas + linea + "</div>";
}

// ---------- Detrás de la puerta: adelantar un pago ----------

// Todo lo que falta pagar, en un solo lugar y ordenado por fecha.
//
// Entran los pendientes del ciclo en curso y, además, los que ya vencieron
// en cualquier ciclo anterior. Los vencidos viejos se incluyen a propósito:
// la franja del muro solo muestra los primeros cuatro, y sin esta lista los
// demás quedarían sin ninguna forma de alcanzarlos desde el teléfono.
//
// Los de monto cero SÍ entran, pero siempre al final (4 ago 2026).
//
// Antes quedaban fuera, con el argumento de que una tarjeta sin compras
// registradas no es un pago y se quedaría atorada empujando fuera a los pagos
// de verdad. La primera mitad resultó falsa en la práctica: al Director el
// banco le cobró $487 de su tarjeta Nu por compras que nunca capturó en la
// app, y al ir a registrar el pago la tarjeta aparecía apagada, sin forma de
// tocarla. Terminó anotándolo como gasto suelto en "Otros", donde le comió la
// bolsa de comida.
//
// La app solo sabe de una tarjeta lo que se le capturó; el banco sabe más.
// Así que un pendiente en cero no significa "no debes nada", significa "no me
// consta que debas algo" — y eso no es razón para impedir pagarlo.
//
// La segunda mitad del argumento sí era buena, y por eso van al final en vez
// de mezclados: nunca empujan fuera de la vista a un recibo que sí vence.
function obtenerPendientesParaAdelantar(datos, cicloId) {
  const hoyTexto = formatearFechaISO(new Date());

  return datos.compromisos
    .filter(function (compromiso) {
      if (compromiso.pagado) {
        return false;
      }
      return compromiso.cicloId === cicloId || compromiso.fechaProgramada <= hoyTexto;
    })
    .sort(function (a, b) {
      // Primero todo lo que tiene monto conocido, por fecha. Después los de
      // monto cero, también por fecha entre ellos.
      const aTieneMonto = hayAlgoQuePagar(a);
      const bTieneMonto = hayAlgoQuePagar(b);

      if (aTieneMonto !== bTieneMonto) {
        return aTieneMonto ? -1 : 1;
      }
      return a.fechaProgramada < b.fechaProgramada ? -1 : 1;
    });
}

// La pantalla de esa lista. Usa la misma rejilla que los demás pasos, y no
// filas largas, porque la rejilla ya sabe encogerse cuando hay muchas
// opciones — y aquí no puede haber scroll, como en ningún paso del ticket.
function htmlPasoPendientes() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();
  const pendientes = obtenerPendientesParaAdelantar(datos, ciclo.id);

  const opciones = pendientes.map(function (compromiso) {
    const diasHasta = calcularDiasHastaFecha(compromiso.fechaProgramada);
    const destinatario = resolverDestinatarioDeCompromiso(compromiso, datos);

    // Un pendiente sin monto no dice "$0.00": diría que no debes nada, y lo
    // que pasa es que la app no sabe cuánto. Se dice eso mismo, para que
    // quede claro que hay que escribir el monto en la pantalla siguiente.
    const cuanto = hayAlgoQuePagar(compromiso)
      ? formatearMoneda(compromiso.montoEstimado)
      : "sin compras registradas";

    return {
      nombre: compromiso.nombre + (destinatario ? " · " + destinatario : ""),
      color: obtenerColorDeCategoria(resolverCategoriaDeCompromiso(compromiso, datos), datos),
      // Cuándo vence y cuánto es, juntos: son las dos cosas que deciden si
      // este es el pago que se quiere adelantar hoy.
      apoyo: formatearCuandoVence(diasHasta) + " · " + cuanto,
      datos: { accion: "pagar", compromiso: compromiso.id, regreso: PASO_PENDIENTES }
    };
  });

  return htmlCabeceraDelTicket("Adelantar un pago", null, true) +
    htmlRejillaDeOpciones(opciones);
}

// ---------- Detrás de la puerta: lo registrado ----------

// Cuántos movimientos se ven antes de resumir el resto en una línea. El
// ticket no tiene scroll, así que la lista tiene que caber: los primeros son
// los más recientes, que son los que se quieren revisar.
const MOVIMIENTOS_VISIBLES = 12;

// Todos los gastos capturados, de lo más reciente a lo más viejo. Incluye
// tanto los gastos libres como los que cerraron un compromiso: para revisar
// "qué llevo hoy" los dos cuentan igual, y separarlos obligaría a mirar en
// dos lados lo que salió de la misma cuenta.
function obtenerMovimientosRecientes(datos) {
  return datos.gastos.slice().sort(function (a, b) {
    if (a.fecha !== b.fecha) {
      return a.fecha < b.fecha ? 1 : -1;
    }
    return a.hora < b.hora ? 1 : -1;
  });
}

// Cómo se llama un movimiento en la lista.
//
// Un gasto libre se identifica por dónde se clasificó ("Comida · Súper").
// Un pago de tarjeta o de deuda no tiene categoría — su gasto es saldo, no
// presupuesto — y para esos el nombre del compromiso quedó guardado en la
// descripción al registrarlos.
function etiquetaDeMovimiento(gasto, datos) {
  const categoria = datos.config.categorias.find(function (c) {
    return c.id === gasto.categoriaId;
  });

  if (categoria) {
    return categoria.nombre + (gasto.subcategoria ? " · " + gasto.subcategoria : "");
  }

  return gasto.descripcion || "Pago";
}

// El nombre del día que encabeza cada grupo. "Hoy" y "Ayer" se dicen así
// porque es como se piensan; de ahí para atrás va la fecha, que es lo único
// que ya distingue un jueves de otro.
function nombreDelDiaDeMovimientos(fechaTexto) {
  const hoyTexto = formatearFechaISO(new Date());
  const ayerTexto = formatearFechaISO(sumarDias(new Date(), -1));

  if (fechaTexto === hoyTexto) {
    return "Hoy";
  }
  if (fechaTexto === ayerTexto) {
    return "Ayer";
  }

  const fecha = crearFechaLocal(fechaTexto);
  return DIAS_SEMANA_ABREVIADOS[fecha.getDay()].toLowerCase() + " " +
    fecha.getDate() + " " + MESES_ABREVIADOS[fecha.getMonth()];
}

// La pantalla de lo registrado: hoy arriba con su total, y los días
// anteriores debajo, cada uno con el suyo. Responde dos preguntas de un
// vistazo — "¿ya lo capturé?" y "¿cuánto llevo hoy?" — sin tener que
// recordar ni abrir la laptop.
function htmlPasoMovimientos() {
  const datos = leerDatos();
  const todos = obtenerMovimientosRecientes(datos);

  if (todos.length === 0) {
    return htmlCabeceraDelTicket("Lo registrado", null, true) +
      "<p class=\"ticket-vacio\">Todavía no has capturado nada.<br>" +
      "Lo que registres aparece aquí, del más reciente al más viejo.</p>";
  }

  const visibles = todos.slice(0, MOVIMIENTOS_VISIBLES);
  const resto = todos.length - visibles.length;

  // Se agrupan recorriendo la lista ya ordenada y abriendo un encabezado
  // cada vez que cambia la fecha. No hace falta agrupar antes: viene
  // ordenada, así que los de un mismo día ya están juntos.
  let fechaDelGrupoAbierto = null;
  const filas = visibles.map(function (gasto) {
    let encabezado = "";

    if (gasto.fecha !== fechaDelGrupoAbierto) {
      fechaDelGrupoAbierto = gasto.fecha;
      const totalDelDia = todos
        .filter(function (otro) { return otro.fecha === gasto.fecha; })
        .reduce(function (suma, otro) { return suma + Number(otro.monto); }, 0);

      encabezado = "<p class=\"dia-movimientos\">" +
        "<span>" + escaparHTML(nombreDelDiaDeMovimientos(gasto.fecha)) + "</span>" +
        "<span class=\"total mono\">" + formatearMoneda(totalDelDia) + "</span>" +
      "</p>";
    }

    return encabezado +
      "<div class=\"fila-movimiento\">" +
        "<span class=\"hora mono\">" + escaparHTML(gasto.hora) + "</span>" +
        "<span class=\"que\">" + escaparHTML(etiquetaDeMovimiento(gasto, datos)) + "</span>" +
        "<span class=\"monto mono\">" + formatearMoneda(gasto.monto) + "</span>" +
        "<button type=\"button\" class=\"borrar-movimiento\" data-accion=\"borrar-movimiento\"" +
          " data-gasto=\"" + gasto.id + "\" aria-label=\"Borrar este registro\">×</button>" +
      "</div>";
  }).join("");

  const linea = resto > 0
    ? "<p class=\"movimientos-de-mas\">y " + resto + " más antes de estos</p>"
    : "";

  return htmlCabeceraDelTicket("Lo registrado", null, true) +
    "<div class=\"movimientos-ticket\">" + filas + linea + "</div>";
}

// ---------- Paso 2: subcategoría, tarjeta o deuda ----------

function htmlPasoSubcategoria() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();

  if (bloqueEspecialElegido === "tarjeta") {
    return htmlCabeceraDelTicket("Tarjetas", COLOR_CATEGORIA_SIN_ASIGNAR, true) +
      htmlRejillaDeOpciones(datos.config.tarjetas
        .slice()
        .sort(function (a, b) { return Number(b.lineaTotal) - Number(a.lineaTotal); })
        .map(function (tarjeta) {
          const pendiente = obtenerPendienteDeOrigen("tarjeta", tarjeta.id, ciclo.id, datos);
          return {
            nombre: tarjeta.nombre,
            color: COLOR_CATEGORIA_SIN_ASIGNAR,
            apoyo: pendiente ? formatearMoneda(pendiente.montoEstimado) : "sin corte por pagar",
            apagada: !pendiente,
            datos: pendiente
              ? { accion: "pagar", compromiso: pendiente.id, regreso: PASO_SUBCATEGORIA }
              : {}
          };
        }));
  }

  if (bloqueEspecialElegido === "deuda") {
    return htmlCabeceraDelTicket("Deudas", COLOR_CATEGORIA_SIN_ASIGNAR, true) +
      htmlRejillaDeOpciones(datos.deudas.filter(function (d) { return d.activa; }).map(function (deuda) {
        const pendiente = obtenerPendienteDeOrigen("deuda", deuda.id, ciclo.id, datos);
        return {
          nombre: deuda.nombre,
          color: COLOR_CATEGORIA_SIN_ASIGNAR,
          apoyo: pendiente ? formatearMoneda(pendiente.montoEstimado) : "sin pago este ciclo",
          apagada: !pendiente,
          datos: pendiente
            ? { accion: "pagar", compromiso: pendiente.id, regreso: PASO_SUBCATEGORIA }
            : {}
        };
      }));
  }

  const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaSeleccionadaGasto; });
  if (!categoria) {
    return htmlPasoOpciones();
  }

  const color = obtenerColorDeCategoria(categoria.id, datos);
  const esLibre = esCategoriaDeGastoLibre(categoria);

  const opciones = (categoria.subcategorias || []).map(function (subcategoria) {
    if (esLibre) {
      return {
        nombre: subcategoria,
        color: color,
        datos: { accion: "elegir-subcategoria", subcategoria: subcategoria }
      };
    }

    // Categoría no variable: la subcategoría no abre un gasto libre, va a
    // buscar el recibo que ya se debe. Uno solo entra directo; varios (el
    // mismo servicio en dos lugares) preguntan cuál.
    const pendientes = obtenerPendientesDeSubcategoria(categoria.id, subcategoria, ciclo.id, datos);

    if (pendientes.length === 0) {
      return { nombre: subcategoria, color: color, apoyo: "nada por pagar", apagada: true, datos: {} };
    }
    if (pendientes.length === 1) {
      return {
        nombre: subcategoria,
        color: color,
        apoyo: formatearMoneda(pendientes[0].montoEstimado),
        datos: { accion: "pagar", compromiso: pendientes[0].id, regreso: PASO_SUBCATEGORIA }
      };
    }
    return {
      nombre: subcategoria,
      color: color,
      apoyo: pendientes.length + " por pagar",
      datos: { accion: "elegir-subcategoria", subcategoria: subcategoria }
    };
  });

  return htmlCabeceraDelTicket(categoria.nombre, color, true) +
    htmlLoRegistradoHoy(datos, categoria) +
    htmlRejillaDeOpciones(opciones);
}

// Cuando una subcategoría no variable tiene varios recibos pendientes (el
// mismo servicio en dos casas), se elige cuál se está pagando. Solo salen
// los que siguen sin pagar.
function htmlPasoElegirPendiente() {
  const datos = leerDatos();
  const ciclo = asegurarCicloActual();
  const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaSeleccionadaGasto; });
  const color = obtenerColorDeCategoria(categoria.id, datos);
  const pendientes = obtenerPendientesDeSubcategoria(categoria.id, subcategoriaSeleccionadaGasto, ciclo.id, datos);

  return htmlCabeceraDelTicket(categoria.nombre + " · " + subcategoriaSeleccionadaGasto, color, true) +
    htmlRejillaDeOpciones(pendientes.map(function (compromiso) {
      const destinatario = resolverDestinatarioDeCompromiso(compromiso, datos);
      return {
        nombre: destinatario || compromiso.nombre,
        color: color,
        apoyo: formatearMoneda(compromiso.montoEstimado),
        datos: { accion: "pagar", compromiso: compromiso.id, regreso: PASO_SUBCATEGORIA }
      };
    }));
}

// Lo ya registrado hoy en esta categoría, con hora y monto. Responde "¿ya
// lo capturé?" sin tener que recordarlo. Solo aparece si hay algo, y el
// CSS lo corta a tres líneas: es un vistazo, no una lista para leer.
function htmlLoRegistradoHoy(datos, categoria) {
  const hoyTexto = formatearFechaISO(new Date());

  const deHoy = datos.gastos
    .filter(function (g) { return g.fecha === hoyTexto && g.categoriaId === categoria.id; })
    .sort(function (a, b) { return a.hora < b.hora ? -1 : 1; });

  if (deHoy.length === 0) {
    return "";
  }

  const partes = deHoy.map(function (gasto) {
    return "<span class=\"hora mono\">" + escaparHTML(gasto.hora) + "</span> " +
      escaparHTML(gasto.subcategoria || "") + " " +
      "<span class=\"importe mono\">" + formatearMoneda(gasto.monto) + "</span>";
  });

  return "<p class=\"hoy-en-categoria\">Hoy en " + escaparHTML(categoria.nombre) + ": " +
    partes.join(" · ") + "</p>";
}

// ---------- Paso 3: el monto ----------

// La misma pantalla sirve para un gasto libre y para cerrar un compromiso.
// Lo único que cambia es de dónde sale el título, si hay campos de detalle,
// y qué hace el botón de abajo.
function htmlPasoMonto() {
  const datos = leerDatos();
  const esPago = pasoDelTicket === PASO_PAGO;

  let titulo = "";
  let color = null;
  let categoriaDelRenglon = null;

  if (esPago) {
    const compromiso = datos.compromisos.find(function (c) { return c.id === compromisoQueSeEstaPagando; });
    if (!compromiso) {
      return htmlPasoOpciones();
    }
    categoriaDelRenglon = resolverCategoriaDeCompromiso(compromiso, datos);
    color = obtenerColorDeCategoria(categoriaDelRenglon, datos);
    titulo = etiquetaCompletaDeCompromiso(compromiso, datos) +
      " · " + formatearCuandoVence(calcularDiasHastaFecha(compromiso.fechaProgramada));
  } else {
    const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaSeleccionadaGasto; });
    categoriaDelRenglon = categoria.id;
    color = obtenerColorDeCategoria(categoria.id, datos);
    titulo = escaparHTML(categoria.nombre) + " · " + escaparHTML(subcategoriaSeleccionadaGasto);
  }

  return htmlCabeceraDelTicket(titulo, color, true) +
    htmlDelRenglonInformativo(
      categoriaDelRenglon,
      fuenteSeleccionadaGasto,
      montoDelTicketComoNumero(),
      esPago ? compromisoQueSeEstaPagando : null
    ) +
    htmlDelMonto() +
    htmlDeLaFuente(datos, esPago) +
    (esPago ? "" : htmlDeLosDetalles(datos)) +
    (campoDeTextoAbierto ? htmlDelCampoDeTexto() : htmlDelTeclado()) +
    "<button type=\"button\" class=\"boton-guardar-ticket\" data-accion=\"guardar\"" +
      (montoDelTicketComoNumero() > 0 ? "" : " disabled") + ">" +
      (esPago ? "Confirmar pago" : "Guardar") +
    "</button>";
}

function htmlDelMonto() {
  const enEspera = montoEscritoEnElTicket === "";
  return "<div class=\"monto-ticket\" id=\"montoDelTicket\">" +
    "<span class=\"signo mono\">$</span>" +
    "<span class=\"cifra mono" + (enEspera ? " en-espera" : "") + "\">" +
      (enEspera ? "0" : escaparHTML(montoEscritoEnElTicket)) +
    "</span>" +
  "</div>";
}

// Débito viene abierta por default. Cambiar de pestaña no borra el monto:
// el monto vive en el estado del ticket, no en la pestaña.
function htmlDeLaFuente(datos, esPago) {
  const pestanas = "<div class=\"pestanas-fuente\">" +
    "<button type=\"button\" class=\"pestana-fuente" + (fuenteSeleccionadaGasto === "debito" ? " activa" : "") + "\"" +
      " data-accion=\"elegir-fuente\" data-fuente=\"debito\">Débito</button>" +
    "<button type=\"button\" class=\"pestana-fuente" + (fuenteSeleccionadaGasto === "credito" ? " activa" : "") + "\"" +
      " data-accion=\"elegir-fuente\" data-fuente=\"credito\">Crédito</button>" +
  "</div>";

  // Al cerrar un compromiso no se pregunta la tarjeta ni los meses: el gasto
  // que se crea hereda lo que ya sabe el compromiso, y preguntar aquí
  // prometería guardar un dato que ese camino no guarda.
  if (esPago || fuenteSeleccionadaGasto !== "credito" || datos.config.tarjetas.length === 0) {
    return pestanas;
  }

  // Con una sola tarjeta no hay nada que elegir: ya se asignó sola.
  const chipsTarjeta = datos.config.tarjetas.length < 2 ? "" :
    "<div class=\"chips-tarjeta\">" + datos.config.tarjetas.map(function (tarjeta) {
      return "<button type=\"button\" class=\"chip-tarjeta" + (tarjeta.id === tarjetaSeleccionadaGasto ? " activa" : "") + "\"" +
        " data-accion=\"elegir-tarjeta\" data-tarjeta=\"" + tarjeta.id + "\">" + escaparHTML(tarjeta.nombre) + "</button>";
    }).join("") + "</div>";

  return pestanas + chipsTarjeta + htmlDeLosMeses(datos);
}

// Los plazos que ofrece el banco. Son los mismos que ya maneja la simulación
// de la vista ancha, para que las dos pantallas hablen del mismo catálogo.
const PLAZOS_DE_MESES = [1, 3, 6, 9, 12];

// El selector de meses solo aparece si la tarjeta elegida tiene marcado
// "permite diferir a meses" en Ajustes. Ofrecerlo en una tarjeta que no da
// MSI sería prometer un reparto que el banco no va a hacer.
function htmlDeLosMeses(datos) {
  const tarjeta = datos.config.tarjetas.find(function (t) { return t.id === tarjetaSeleccionadaGasto; });

  if (!tarjeta || !tarjeta.permiteDiferirAMeses) {
    return "";
  }

  const chips = PLAZOS_DE_MESES.map(function (meses) {
    return "<button type=\"button\" class=\"chip-tarjeta" + (meses === mesesDiferidosDelTicket ? " activa" : "") + "\"" +
      " data-accion=\"elegir-meses\" data-meses=\"" + meses + "\">" +
      (meses === 1 ? "De contado" : meses + " meses") +
    "</button>";
  }).join("");

  // Decir en voz alta en qué se convierte la compra: es la diferencia entre
  // elegir "12 meses" a ciegas y ver que son $1,000 al mes durante un año.
  const monto = montoDelTicketComoNumero();
  const reparto = (mesesDiferidosDelTicket > 1 && monto > 0)
    ? mesesDiferidosDelTicket + " pagos de " + formatearMoneda(monto / mesesDiferidosDelTicket) + " al mes"
    : "";

  // Lleva su propia clase, y no la del renglón de arriba del monto, porque
  // los dos se refrescan con cada tecla y hay que poder distinguirlos.
  return "<div class=\"chips-tarjeta\">" + chips + "</div>" +
    "<p class=\"renglon-reparto\">" + reparto + "</p>";
}

// Descripción y "Para quién", debajo del monto. "Para quién" solo aparece
// si esa categoría ya tiene destinatarios: ofrecer un selector vacío es
// peor que no ofrecer nada.
function htmlDeLosDetalles(datos) {
  const destinatarios = obtenerDestinatariosDeLaCategoria(datos, categoriaSeleccionadaGasto);

  let html = "<div class=\"detalles-ticket\">" +
    "<button type=\"button\" class=\"fila-detalle\" data-accion=\"abrir-descripcion\">" +
      "<span>Descripción</span>" +
      "<span class=\"valor" + (descripcionEscritaEnElTicket ? "" : " sin-poner") + "\">" +
        (descripcionEscritaEnElTicket ? escaparHTML(descripcionEscritaEnElTicket) : "—") +
      "</span>" +
    "</button>";

  if (destinatarios.length > 0) {
    html += "<div class=\"fila-detalle\">" +
      "<span>Para quién</span>" +
      "<select class=\"valor\" data-campo=\"destinatario\">" +
        "<option value=\"\">—</option>" +
        destinatarios.map(function (destinatario) {
          return "<option value=\"" + escaparHTML(destinatario) + "\"" +
            (destinatario === destinatarioElegidoEnElTicket ? " selected" : "") + ">" +
            escaparHTML(destinatario) + "</option>";
        }).join("") +
      "</select>" +
    "</div>";
  }

  return html + "</div>";
}

// El teclado lo dibuja la app: así está visible desde el primer instante,
// sin un toque extra, y nunca tapa el botón Guardar.
const TECLAS_DEL_TICKET = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "borrar"];

function htmlDelTeclado() {
  return "<div class=\"teclado-ticket\">" +
    TECLAS_DEL_TICKET.map(function (tecla) {
      const esBorrar = tecla === "borrar";
      return "<button type=\"button\" class=\"tecla" + (esBorrar ? " tecla-borrar" : "") + "\"" +
        " data-accion=\"tecla\" data-tecla=\"" + tecla + "\"" +
        (esBorrar ? " aria-label=\"Borrar\"" : "") + ">" +
        (esBorrar ? "⌫" : tecla) +
      "</button>";
    }).join("") +
  "</div>";
}

// Mientras se escribe la descripción, el campo ocupa el lugar del teclado
// numérico. Es el único momento en que sale el teclado de letras del
// sistema, y al terminar el ticket vuelve a como estaba.
function htmlDelCampoDeTexto() {
  return "<div class=\"campo-escritura\">" +
    "<span class=\"rotulo\">Descripción</span>" +
    "<input type=\"text\" data-campo=\"descripcion\" value=\"" + escaparHTML(descripcionEscritaEnElTicket) + "\">" +
    "<button type=\"button\" class=\"boton-listo\" data-accion=\"cerrar-descripcion\">Listo</button>" +
  "</div>";
}

// ---------- Dibujar y animar ----------

function renderizarTicket() {
  const ticket = document.getElementById("ticketCaptura");

  if (pasoDelTicket === PASO_OPCIONES) {
    ticket.innerHTML = htmlPasoOpciones();
  } else if (pasoDelTicket === PASO_CATEGORIAS) {
    ticket.innerHTML = htmlPasoCategorias();
  } else if (pasoDelTicket === PASO_PENDIENTES) {
    ticket.innerHTML = htmlPasoPendientes();
  } else if (pasoDelTicket === PASO_MOVIMIENTOS) {
    ticket.innerHTML = htmlPasoMovimientos();
  } else if (pasoDelTicket === PASO_SUBCATEGORIA) {
    ticket.innerHTML = htmlPasoSubcategoria();
  } else if (pasoDelTicket === PASO_MONTO && !laCategoriaElegidaEsDeGastoLibre()) {
    // Una subcategoría no variable con varios recibos pendientes no lleva
    // al monto: lleva a elegir cuál de ellos se está pagando.
    ticket.innerHTML = htmlPasoElegirPendiente();
  } else {
    ticket.innerHTML = htmlPasoMonto();
  }

  ticket.classList.toggle("entrando", elTicketDebeEntrarImprimiendose);
  elTicketDebeEntrarImprimiendose = false;

  // Si se estaba escribiendo la descripción, el foco vuelve al campo: sin
  // esto, cada letra cerraría el teclado del sistema.
  const campo = ticket.querySelector("input[data-campo=\"descripcion\"]");
  if (campo) {
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
}

function laCategoriaElegidaEsDeGastoLibre() {
  const datos = leerDatos();
  const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaSeleccionadaGasto; });
  return !categoria || esCategoriaDeGastoLibre(categoria);
}

// El corte: se clona el ticket que está en pantalla y el clon se va hacia
// abajo mientras el nuevo entra desde arriba. Se clona en vez de animar el
// original porque el original se reescribe entero en el mismo instante.
function desprenderElTicket() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const carro = document.getElementById("carroCaptura");
  const fantasma = document.getElementById("ticketCaptura").cloneNode(true);

  fantasma.removeAttribute("id");
  fantasma.classList.remove("entrando");
  fantasma.classList.add("ticket-fantasma");
  carro.appendChild(fantasma);

  fantasma.addEventListener("animationend", function () { fantasma.remove(); });
  elTicketDebeEntrarImprimiendose = true;
}

// Pone al día lo que cambia al teclear: el monto, el renglón informativo, el
// reparto a meses y el botón de guardar. El resto del ticket no se toca.
//
// Nada de esto vuelve a crear un elemento. Antes el monto y el renglón se
// reemplazaban con outerHTML, que destruye el nodo y construye uno nuevo en su
// lugar: el número desaparecía y se volvía a pintar en cada tecla, y eso se
// veía como un parpadeo de la cifra completa mientras se escribía. Cambiar el
// texto del nodo que ya está en pantalla no tiene ese costo — el navegador
// repinta el texto y nada más.
//
// Si algún día hay que meterle otro dato a esta pantalla, que se actualice
// igual: buscar el nodo y cambiarle el contenido, nunca reemplazarlo.
function actualizarMontoEnPantalla() {
  const ticket = document.getElementById("ticketCaptura");
  const datos = leerDatos();
  const esPago = pasoDelTicket === PASO_PAGO;

  let categoriaDelRenglon = categoriaSeleccionadaGasto;
  if (esPago) {
    const compromiso = datos.compromisos.find(function (c) { return c.id === compromisoQueSeEstaPagando; });
    categoriaDelRenglon = compromiso ? resolverCategoriaDeCompromiso(compromiso, datos) : null;
  }

  // El monto: solo cambia la cifra. El signo de pesos no se toca nunca.
  const cifra = ticket.querySelector(".monto-ticket .cifra");
  const enEspera = montoEscritoEnElTicket === "";
  cifra.textContent = enEspera ? "0" : montoEscritoEnElTicket;
  cifra.classList.toggle("en-espera", enEspera);

  const renglon = textoDelRenglonInformativo(
    categoriaDelRenglon,
    fuenteSeleccionadaGasto,
    montoDelTicketComoNumero(),
    esPago ? compromisoQueSeEstaPagando : null
  );
  const renglonEnPantalla = ticket.querySelector(".renglon-informativo");
  renglonEnPantalla.textContent = renglon.texto;
  renglonEnPantalla.classList.toggle("excedido", renglon.excedido);
  // El reparto a meses también se mueve con cada tecla: "12 pagos de $1,000"
  // solo sirve si va cambiando mientras se escribe el monto.
  const renglonReparto = ticket.querySelector(".renglon-reparto");
  if (renglonReparto) {
    renglonReparto.textContent = mesesDiferidosDelTicket > 1 && montoDelTicketComoNumero() > 0
      ? mesesDiferidosDelTicket + " pagos de " +
        formatearMoneda(montoDelTicketComoNumero() / mesesDiferidosDelTicket) + " al mes"
      : "";
  }

  ticket.querySelector(".boton-guardar-ticket").disabled = montoDelTicketComoNumero() <= 0;
}

// La nota de mañana: sale sola al guardar y se va sola. No pide ningún
// toque y no bloquea nada.
function mostrarNotaDeManana() {
  const nota = document.getElementById("notaCaptura");
  const datos = leerDatos();
  const vencenManana = obtenerVencimientosDeManana(datos);

  if (vencenManana.length === 0) {
    nota.hidden = true;
    return;
  }

  if (vencenManana.length === 1) {
    nota.innerHTML = "Mañana vence " + etiquetaCompletaDeCompromiso(vencenManana[0], datos) +
      " · <span class=\"mono\">" + formatearMoneda(vencenManana[0].montoEstimado) + "</span>";
  } else {
    const suma = vencenManana.reduce(function (total, c) { return total + Number(c.montoEstimado); }, 0);
    nota.innerHTML = "Mañana vencen " + vencenManana.length + " pagos · " +
      "<span class=\"mono\">" + formatearMoneda(suma) + "</span>";
  }

  // Se quita y se vuelve a poner para que la animación arranque de nuevo
  // aunque la nota ya estuviera puesta de un guardado anterior.
  nota.hidden = true;
  void nota.offsetWidth;
  nota.hidden = false;
  nota.addEventListener("animationend", function alTerminar() {
    nota.hidden = true;
    nota.removeEventListener("animationend", alTerminar);
  });
}

// ============================================================
// CAPTURA — TOQUES DEL TICKET
// ============================================================
//
// Un solo escucha para todo el ticket, en vez de reconectar botones en
// cada dibujado: el contenido cambia entero en cada paso, pero el
// contenedor es siempre el mismo.

function avanzarDelTicket(paso) {
  pasoDelTicket = paso;
  renderizarTicket();
  document.getElementById("ticketCaptura").classList.add("paso-avanza");
}

// Las teclas del monto responden al bajar el dedo, no al levantarlo.
//
// Un "click" en pantalla táctil no se dispara cuando tocas: se dispara cuando
// SUELTAS. El navegador tiene que esperar a ver si el dedo se va a mover
// (sería un deslizamiento, no un toque), así que todo el tiempo que el dedo
// esté sobre la tecla es tiempo en el que el número no aparece. Teclear
// rápido se siente pegajoso aunque no haya nada lento detrás: el cálculo de
// un dígito toma menos de un milisegundo.
//
// "pointerdown" ocurre en el instante en que el dedo toca el cristal, que es
// como responde el teclado del sistema. La diferencia es de unas décimas de
// segundo, pero es justo la que separa "responde" de "va lento".
//
// Solo las teclas del monto entran aquí, a propósito. Guardar, las puertas y
// los atajos siguen esperando al click: en un botón que comete un gasto o
// cambia de pantalla, poder arrastrar el dedo fuera para arrepentirse vale
// más que ganar 100 milisegundos.
function manejarTeclaAlBajarElDedo(evento) {
  const boton = evento.target.closest("[data-accion=\"tecla\"]");
  if (!boton) {
    return;
  }
  escribirEnElMontoDelTicket(boton.getAttribute("data-tecla"));
}

function manejarToqueEnElTicket(evento) {
  const boton = evento.target.closest("[data-accion]");
  if (!boton) {
    return;
  }

  const datos = leerDatos();
  const accion = boton.getAttribute("data-accion");

  if (accion === "atras") {
    regresarUnPasoDelTicket();
    return;
  }

  // Las dos puertas del muro. No eligen nada todavía: solo abren la
  // pantalla que corresponde, así que no tocan el estado del ticket.
  if (accion === "ir-a-paso") {
    avanzarDelTicket(boton.getAttribute("data-paso"));
    return;
  }

  // Un atajo del muro trae categoría y subcategoría de una vez, así que se
  // salta el paso de subcategorías y cae directo al teclado. Es el camino
  // corto del día a día: dos toques y guardar.
  if (accion === "atajo") {
    categoriaSeleccionadaGasto = boton.getAttribute("data-categoria");
    subcategoriaSeleccionadaGasto = boton.getAttribute("data-subcategoria");
    bloqueEspecialElegido = null;
    fuenteSeleccionadaGasto = "debito";
    tarjetaSeleccionadaGasto = null;
    // Como se saltó un paso, la flecha tiene que regresar hasta el muro.
    pasoAlQueRegresaElGasto = PASO_OPCIONES;
    avanzarDelTicket(PASO_MONTO);
    return;
  }

  if (accion === "elegir-categoria" || accion === "crear-otros") {
    const categoria = accion === "crear-otros"
      ? asegurarCategoriaOtros()
      : datos.config.categorias.find(function (c) { return c.id === boton.getAttribute("data-categoria"); });

    categoriaSeleccionadaGasto = categoria.id;
    subcategoriaSeleccionadaGasto = null;
    bloqueEspecialElegido = null;
    avanzarDelTicket(PASO_SUBCATEGORIA);
    return;
  }

  if (accion === "elegir-bloque") {
    bloqueEspecialElegido = boton.getAttribute("data-bloque");
    categoriaSeleccionadaGasto = null;
    avanzarDelTicket(PASO_SUBCATEGORIA);
    return;
  }

  if (accion === "elegir-subcategoria") {
    subcategoriaSeleccionadaGasto = boton.getAttribute("data-subcategoria");
    // En una categoría de gasto libre esto lleva al monto; en una no
    // variable con varios recibos del mismo nombre, a elegir cuál. Lo
    // decide renderizarTicket, que ya sabe distinguirlas.
    fuenteSeleccionadaGasto = "debito";
    tarjetaSeleccionadaGasto = null;
    // Se vino del paso de subcategorías, así que ahí regresa la flecha.
    pasoAlQueRegresaElGasto = PASO_SUBCATEGORIA;
    avanzarDelTicket(PASO_MONTO);
    return;
  }

  if (accion === "pagar") {
    compromisoQueSeEstaPagando = boton.getAttribute("data-compromiso");
    pasoAlQueRegresaElPago = boton.getAttribute("data-regreso");
    const compromiso = datos.compromisos.find(function (c) { return c.id === compromisoQueSeEstaPagando; });
    // El monto llega precargado con el estimado y es editable: casi
    // siempre es el correcto, y cuando no lo es se corrige tecleando.
    //
    // Un estimado de cero no se precarga: se deja el teclado en espera. Un
    // "0" heredado se ve idéntico a un monto de verdad, y aquí justamente el
    // punto es que la app NO sabe cuánto es y hay que escribirlo (pasa con
    // una tarjeta cuyas compras nunca se capturaron).
    montoEscritoEnElTicket = Number(compromiso.montoEstimado) > 0
      ? String(compromiso.montoEstimado)
      : "";
    fuenteSeleccionadaGasto = "debito";
    avanzarDelTicket(PASO_PAGO);
    return;
  }

  // Borrar pide confirmación siempre: es la única acción del teléfono que
  // destruye algo, y un dedo en la fila equivocada no se deshace.
  if (accion === "borrar-movimiento") {
    const gastoId = boton.getAttribute("data-gasto");
    const gasto = datos.gastos.find(function (g) { return g.id === gastoId; });

    if (!gasto) {
      return;
    }

    const aviso = gasto.compromisoId
      ? "¿Borrar este pago de " + formatearMoneda(gasto.monto) + "?\n\n" +
        "El recibo vuelve a quedar pendiente."
      : "¿Borrar este gasto de " + formatearMoneda(gasto.monto) + "?";

    if (confirm(aviso)) {
      borrarMovimiento(gastoId);
    }
    return;
  }

  if (accion === "elegir-fuente") {
    fuenteSeleccionadaGasto = boton.getAttribute("data-fuente");
    // Si solo hay una tarjeta se asigna sola: no le cuesta un toque al
    // usuario. Con varias, viene marcada la de mayor línea.
    if (fuenteSeleccionadaGasto === "credito") {
      tarjetaSeleccionadaGasto = datos.config.tarjetas.length === 1
        ? datos.config.tarjetas[0].id
        : tarjetaPreseleccionada(datos);
    } else {
      tarjetaSeleccionadaGasto = null;
    }
    renderizarTicket();
    return;
  }

  if (accion === "elegir-tarjeta") {
    tarjetaSeleccionadaGasto = boton.getAttribute("data-tarjeta");
    // Cambiar de tarjeta vuelve a "de contado": la tarjeta nueva puede no dar
    // meses, y dejar un plazo puesto de la anterior guardaría una mentira.
    mesesDiferidosDelTicket = 1;
    renderizarTicket();
    return;
  }

  if (accion === "elegir-meses") {
    mesesDiferidosDelTicket = Number(boton.getAttribute("data-meses"));
    renderizarTicket();
    return;
  }

  if (accion === "tecla") {
    // Las teclas del monto no se atienden aquí: ya respondieron al bajar el
    // dedo (ver manejarTeclaAlBajarElDedo). Este camino solo queda para un
    // navegador sin Pointer Events, donde el click es lo único que hay.
    if (!window.PointerEvent) {
      escribirEnElMontoDelTicket(boton.getAttribute("data-tecla"));
    }
    return;
  }

  if (accion === "abrir-descripcion") {
    campoDeTextoAbierto = "descripcion";
    renderizarTicket();
    return;
  }

  if (accion === "cerrar-descripcion") {
    campoDeTextoAbierto = null;
    renderizarTicket();
    return;
  }

  if (accion === "guardar") {
    if (pasoDelTicket === PASO_PAGO) {
      guardarPagoDelTicket();
    } else {
      guardarGastoDelTicket();
    }
  }
}

function regresarUnPasoDelTicket() {
  if (campoDeTextoAbierto) {
    campoDeTextoAbierto = null;
    renderizarTicket();
    return;
  }

  if (pasoDelTicket === PASO_PAGO) {
    compromisoQueSeEstaPagando = null;
    montoEscritoEnElTicket = "";
    avanzarDelTicket(pasoAlQueRegresaElPago);
    return;
  }

  if (pasoDelTicket === PASO_MONTO) {
    // Si se llegó por un atajo no hay paso intermedio al que volver: la
    // flecha regresa al muro, y entonces se limpia el ticket entero porque
    // ni la categoría sigue teniendo sentido.
    if (pasoAlQueRegresaElGasto === PASO_OPCIONES) {
      reiniciarElTicket();
      avanzarDelTicket(PASO_OPCIONES);
      return;
    }

    subcategoriaSeleccionadaGasto = null;
    montoEscritoEnElTicket = "";
    descripcionEscritaEnElTicket = "";
    destinatarioElegidoEnElTicket = "";
    avanzarDelTicket(PASO_SUBCATEGORIA);
    return;
  }

  reiniciarElTicket();
  avanzarDelTicket(PASO_OPCIONES);
}

// Escribe un dígito, un punto o borra. Las reglas evitan lo que un teclado
// numérico de verdad tampoco deja hacer: dos puntos, tres decimales, o un
// número más largo que la pantalla.
function escribirEnElMontoDelTicket(tecla) {
  if (tecla === "borrar") {
    montoEscritoEnElTicket = montoEscritoEnElTicket.slice(0, -1);
    actualizarMontoEnPantalla();
    return;
  }

  if (tecla === ".") {
    if (montoEscritoEnElTicket.indexOf(".") === -1) {
      montoEscritoEnElTicket = (montoEscritoEnElTicket === "" ? "0" : montoEscritoEnElTicket) + ".";
      actualizarMontoEnPantalla();
    }
    return;
  }

  const partes = montoEscritoEnElTicket.split(".");
  const yaTieneDosDecimales = partes.length === 2 && partes[1].length >= 2;
  if (yaTieneDosDecimales || montoEscritoEnElTicket.length >= 9) {
    return;
  }

  // Sin ceros a la izquierda: "007" no es un monto.
  montoEscritoEnElTicket = montoEscritoEnElTicket === "0" ? tecla : montoEscritoEnElTicket + tecla;
  actualizarMontoEnPantalla();
}

function manejarEscrituraEnElTicket(evento) {
  if (evento.target.getAttribute("data-campo") === "descripcion") {
    descripcionEscritaEnElTicket = evento.target.value;
  }
}

function manejarCambioEnElTicket(evento) {
  if (evento.target.getAttribute("data-campo") === "destinatario") {
    destinatarioElegidoEnElTicket = evento.target.value;
  }
}
