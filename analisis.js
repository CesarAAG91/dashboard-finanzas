// ============================================================
// ANÁLISIS — la primera pantalla de la vista ancha
// ============================================================
//
// La pantalla de entrada de la laptop: el muro de pagos del ciclo, el
// encabezado, la banda de trayectoria, la simulación, la ventana de
// opciones de pago y el cajón de calendario. Responde una sola
// pregunta: "¿qué pago y cuánto me queda?".
//
// Aquí vive el acomodo adaptativo del muro, que mide el espacio libre
// y decide columnas, escala y cuánto detalle mostrar.
//
// La segunda pantalla — el estudio del ciclo, que es lo que se ve al
// hacer scroll — vive en estudio.js. Se separaron el 2 ago 2026: son
// dos pantallas con propósitos distintos y en un solo archivo de 1,900
// líneas buscar cualquier cosa costaba el doble.
//
// Depende de motor.js.

// ============================================================
// VISTA ANCHA — MURO DE PAGOS DEL CICLO
// ============================================================
//
// Requisito duro del usuario: todos los pagos del ciclo visibles de un
// golpe, sin scroll, agrupados por categoría y subcategoría, cada uno en su
// recuadro con su total.
//
// Nada aquí fija cuántos pagos caben. Se mide el contenido real y se busca
// el acomodo que quepa completo con el texto más grande posible. Se pueden
// mover tres cosas, en este orden, que es el orden de lo que menos cuesta
// perder:
//
//   1. Cuántas columnas. No cuesta nada, solo reparte.
//   2. La escala del texto, dentro de un margen chico — el muro debe verse
//      casi igual de un mes a otro, no cambiar de tamaño cada ciclo.
//   3. Los títulos de subcategoría. Cuesta contexto pero no pierde ni un
//      dato: la fila ya dice "Totalplay", el título "Internet" es
//      envoltorio. Medido en un mes real, esos títulos pesaban más de la
//      mitad de lo que pesaban los datos del recuadro más cargado.
//
// Si ni el modo más compacto cabe, ese mes concreto se resuelve con scroll.

const ESCALA_MINIMA_MURO = 0.85;
const ESCALA_MAXIMA_MURO = 1.15;
const PASOS_DE_BISECCION_MURO = 7;
const COLUMNAS_A_PROBAR_MURO = [2, 3, 4, 5, 6];
const SEPARACION_BASE_MURO = 10;

// De menos a más pérdida. Se usa el primero que quepa.
const MODOS_DE_DENSIDAD_MURO = [
  { id: "completo", titulos: true },
  { id: "compacto", titulos: false }
];

// El estado de un pago se deriva de pagado + fechaProgramada; no hace falta
// ningún campo nuevo en el modelo.
function calcularEstadoDePago(compromiso) {
  if (compromiso.pagado) {
    return "pagado";
  }
  const hoy = truncarAMedianoche(new Date());
  return crearFechaLocal(compromiso.fechaProgramada) < hoy ? "vencido" : "pendiente";
}

// Ordena los pagos de un grupo del muro para que se lean como una agenda.
//
// Antes salían en el orden en que el motor materializa los compromisos —o
// sea, orden de registro— así que para saber qué venía había que leer fecha
// y estado fila por fila. Ruido reportado por el usuario (4 ago 2026): "los
// próximos pagos no los tengo bien detectados".
//
// Dos criterios, en este orden:
//
// 1. Primero lo que todavía pide algo, al fondo lo que ya está resuelto.
//    "Resuelto" incluye lo diferido a meses: no está pagado, pero ya no sale
//    de este ciclo, así que no debe competir por la atención con lo que sí
//    hay que pagar.
// 2. Entre los del mismo bando, por fecha. Lo vencido queda arriba solo, sin
//    necesidad de un criterio aparte: su fecha ya es la más vieja.
//
// El desempate por nombre existe para que dos pagos del mismo día no bailen
// de posición entre un dibujado y el siguiente.
function ordenarPagosDelMuro(pagos) {
  return pagos.slice().sort(function (a, b) {
    const resueltoA = a.pagado || Boolean(a.estadoCredito);
    const resueltoB = b.pagado || Boolean(b.estadoCredito);

    if (resueltoA !== resueltoB) {
      return resueltoA ? 1 : -1;
    }
    if (a.fechaProgramada !== b.fechaProgramada) {
      // Las fechas son "AAAA-MM-DD": comparadas como texto ya quedan en
      // orden cronológico, sin construir un Date por comparación.
      return a.fechaProgramada < b.fechaProgramada ? -1 : 1;
    }
    return a.nombre < b.nombre ? -1 : 1;
  });
}

// Ordena los grupos de un recuadro entre sí, por su pago pendiente más
// próximo.
//
// Ordenar solo dentro de cada grupo no basta: las subcategorías salen en el
// orden en que la categoría las declara, así que el recuadro se lee en
// zigzag —un pago del día 22 encima de uno del día 8— y cuando el muro se
// aprieta y esconde los títulos, los grupos se funden en una sola lista
// donde ese zigzag es lo único que queda a la vista.
//
// Un grupo sin nada pendiente (todo pagado o diferido) se va al final: ya
// no pide nada, así que no compite por la atención.
function ordenarGruposDelRecuadro(grupos) {
  function fechaDelPrimerPendiente(grupo) {
    const pendiente = grupo.pagos.find(function (pago) {
      return !pago.pagado && !pago.estadoCredito;
    });
    // Los pagos del grupo ya vienen ordenados, así que el primer pendiente
    // que aparece es el más próximo. Sin pendientes, una fecha imposible que
    // lo manda al final sin necesitar un caso aparte en la comparación.
    return pendiente ? pendiente.fechaProgramada : "9999-12-31";
  }

  return grupos.slice().sort(function (a, b) {
    const fechaA = fechaDelPrimerPendiente(a);
    const fechaB = fechaDelPrimerPendiente(b);

    if (fechaA !== fechaB) {
      return fechaA < fechaB ? -1 : 1;
    }
    // Empate: se conserva el orden en que la categoría declara sus
    // subcategorías, que es el que el usuario capturó.
    return 0;
  });
}

// Etiqueta corta de fecha para las filas del muro ("14 ago"), donde el año
// sobra porque todo lo que se ve pertenece al mismo ciclo.
function formatearDiaYMes(fechaISO) {
  const fecha = crearFechaLocal(fechaISO);
  return fecha.getDate() + " " + MESES_ABREVIADOS[fecha.getMonth()];
}

// ¿Este título de subcategoría aporta algo?
//
// No aporta cuando agrupa un solo pago que ya se llama igual: "SUSCRIPCIONES
// → Amazon → • Amazon" dice tres veces lo mismo. Sí aporta cuando el nombre
// del pago no revela la subcategoría ("INTERNET → • Totalplay") o cuando
// agrupa varios pagos.
//
// El caso surgió al separar las suscripciones en su propia categoría, donde
// cada servicio quedó como su propia subcategoría.
function tituloAportaAlgo(subcategoria, pagos) {
  if (pagos.length > 1) {
    return true;
  }
  return pagos[0].nombre.trim().toLowerCase() !== String(subcategoria).trim().toLowerCase();
}

// La decisión de mostrar títulos es de todo el recuadro, no de cada grupo.
//
// Si se decidiera grupo por grupo, un grupo sin título colocado después de
// uno con título se leería como si perteneciera al anterior: en Servicios,
// "Agua" y "Luz" sin título quedaban visualmente colgados bajo "INTERNET",
// que es peor que la repetición que se quería evitar. Así que o los lleva
// todos, o ninguno.
function elRecuadroNecesitaTitulos(gruposCandidatos) {
  return gruposCandidatos.some(function (grupo) {
    return grupo.titulo !== null && tituloAportaAlgo(grupo.titulo, grupo.pagos);
  });
}

// Dos pagos de la misma categoría pueden llamarse igual y ser cosas
// distintas: el "Agua" de un domicilio y el "Agua" del otro. Con el nombre
// solo, el muro miente — se ven idénticos.
//
// Hasta el 6 ago 2026 el destinatario solo aparecía cuando dos pagos del
// mismo recuadro se llamaban igual: la idea era ahorrar tinta cuando el
// nombre ya bastaba para distinguirlos. El uso real la tumbó — si en el
// ciclo cae un solo recibo de "Agua", esa regla lo deja mudo y no hay forma
// de saber de qué domicilio es. Que un nombre no se repita este mes no
// significa que se explique solo. Ahora se muestra siempre que exista.
//
// Devuelve un índice de "qué destinatario le toca a qué pago", no lo
// escribe en ningún lado: es una decisión de dibujo, no un dato.
function calcularDestinatariosVisiblesDelRecuadro(grupos, datos) {
  const destinatarioPorPago = {};

  grupos.forEach(function (grupo) {
    grupo.pagos.forEach(function (pago) {
      const destinatario = resolverDestinatarioDeCompromiso(pago, datos);
      if (destinatario) {
        destinatarioPorPago[pago.idSimulado || pago.id] = destinatario;
      }
    });
  });

  return destinatarioPorPago;
}

// Arma los recuadros del muro a partir de los compromisos del ciclo.
//
// Un recuadro por categoría de presupuesto, más uno de Deudas y otro de
// Tarjetas: esos dos no tienen categoría (su gasto no es de presupuesto,
// es saldo) pero sí son pagos del ciclo y el usuario los quiere ver.
// Las categorías variables no traen pagos con fecha: traen su tope semanal,
// editable desde aquí.
function construirRecuadrosDelMuro(ciclo, datos) {
  // Los pagos vienen de la lista materializada de la simulación, no de
  // datos.compromisos: es la única que incluye los ciclos proyectados y la
  // que recuerda los diferimientos a crédito.
  const compromisosDelCiclo = obtenerItemsSimuladosDelCicloEnfocado();
  const presupuestoVigente = obtenerPresupuestoSemanalVigente(ciclo, datos);

  // Se recorre config.categorias, no los compromisos, para que el orden de
  // los recuadros sea el orden de las categorías del usuario.
  const recuadros = [];

  datos.config.categorias.forEach(function (categoria) {
    if (categoria.esVariableSemanal) {
      return; // van al final, con su tope semanal
    }

    // Los materializados ya traen categoriaId resuelta por el motor.
    const suyos = compromisosDelCiclo.filter(function (compromiso) {
      return compromiso.categoriaId === categoria.id;
    });
    if (suyos.length === 0) {
      return;
    }

    // Agrupados por subcategoría, en el orden en que la categoría las
    // declara; lo que no encaje en ninguna cae en un grupo sin título.
    //
    // Se reparte en UN solo recorrido, resolviendo la subcategoría de cada
    // pago una única vez. Hacerlo en dos pases (uno por subcategoría y otro
    // para los sobrantes) obliga a que las dos condiciones sean exactamente
    // complementarias, y cualquier diferencia entre ellas duplica un pago o
    // lo pierde en silencio — que es lo peor que puede pasar en una pantalla
    // cuyo único trabajo es mostrarlos todos.
    const pagosPorSubcategoria = {};
    const sinSubcategoria = [];

    suyos.forEach(function (compromiso) {
      const subcategoria = compromiso.subcategoria;
      const esConocida = subcategoria && (categoria.subcategorias || []).indexOf(subcategoria) !== -1;

      if (!esConocida) {
        sinSubcategoria.push(compromiso);
        return;
      }
      if (!pagosPorSubcategoria[subcategoria]) {
        pagosPorSubcategoria[subcategoria] = [];
      }
      pagosPorSubcategoria[subcategoria].push(compromiso);
    });

    const grupos = [];

    (categoria.subcategorias || []).forEach(function (subcategoria) {
      const pagos = pagosPorSubcategoria[subcategoria];
      if (pagos && pagos.length > 0) {
        grupos.push({ titulo: subcategoria, pagos: ordenarPagosDelMuro(pagos) });
      }
    });

    if (sinSubcategoria.length > 0) {
      grupos.push({ titulo: null, pagos: ordenarPagosDelMuro(sinSubcategoria) });
    }

    // Se decide una sola vez para todo el recuadro (ver
    // elRecuadroNecesitaTitulos) y se aplica a todos sus grupos.
    if (!elRecuadroNecesitaTitulos(grupos)) {
      grupos.forEach(function (grupo) { grupo.titulo = null; });
    }

    const gruposEnOrden = ordenarGruposDelRecuadro(grupos);

    recuadros.push({
      tipo: "pagos",
      nombre: categoria.nombre,
      grupos: gruposEnOrden,
      destinatariosVisibles: calcularDestinatariosVisiblesDelRecuadro(gruposEnOrden, datos)
    });
  });

  // Deudas y tarjetas, cada una en su recuadro.
  [
    { nombre: "Deudas", origen: "deuda" },
    { nombre: "Tarjetas", origen: "tarjeta" }
  ].forEach(function (bloque) {
    const pagos = compromisosDelCiclo.filter(function (c) { return c.origen === bloque.origen; });
    if (pagos.length > 0) {
      recuadros.push({
        tipo: "pagos",
        nombre: bloque.nombre,
        grupos: [{ titulo: null, pagos: ordenarPagosDelMuro(pagos) }]
      });
    }
  });

  // Las categorías variables van juntas en un solo recuadro: no tienen
  // pagos con fecha, tienen un tope semanal, y verlas una al lado de otra es
  // lo que permite repartir entre ellas. Un recuadro por cada una las
  // separaba sin motivo y llenaba el muro de cajas de una sola fila.
  const categoriasVariables = datos.config.categorias.filter(function (categoria) {
    return categoria.esVariableSemanal;
  });

  if (categoriasVariables.length > 0) {
    recuadros.push({
      tipo: "presupuesto",
      nombre: "Presupuesto variable",
      topes: categoriasVariables.map(function (categoria) {
        return {
          categoriaId: categoria.id,
          nombre: categoria.nombre,
          monto: Number(presupuestoVigente[categoria.id] || 0)
        };
      })
    });
  }

  return recuadros;
}

// conAccionDePago solo lo usa el panel del día del calendario: agrega bajo
// cada pago pendiente los campos para confirmarlo. El marcado es el que
// confirmarPagoDeCompromiso ya espera (".monto-real-pendiente",
// ".fuente-pendiente", el botón), el mismo que usa Pendientes en Captura,
// así que esa función funciona sin saber quién la llamó.
function htmlDeRecuadroDelMuro(recuadro, mostrarTitulos, conAccionDePago) {
  if (recuadro.tipo === "presupuesto") {
    const totalSemanal = recuadro.topes.reduce(function (suma, tope) { return suma + tope.monto; }, 0);
    return "<div class=\"recuadro\">" +
      "<div class=\"encabezado-recuadro\">" +
        "<span class=\"nombre-categoria-muro\">" + escaparHTML(recuadro.nombre) + "</span>" +
        "<span class=\"total-categoria-muro\">" + formatearMoneda(totalSemanal) + "</span>" +
      "</div>" +
      recuadro.topes.map(function (tope) {
        return "<div class=\"fila-presupuesto-muro\">" +
          "<label for=\"topeMuro_" + tope.categoriaId + "\">" + escaparHTML(tope.nombre) + "</label>" +
          "<input type=\"number\" min=\"0\" step=\"50\" id=\"topeMuro_" + tope.categoriaId + "\"" +
            " data-categoria-tope=\"" + tope.categoriaId + "\" value=\"" + tope.monto + "\">" +
          "<span class=\"unidad-tope\">/sem</span>" +
        "</div>";
      }).join("") +
    "</div>";
  }

  const total = recuadro.grupos.reduce(function (suma, grupo) {
    return suma + grupo.pagos.reduce(function (s, pago) {
      return s + Number(pago.pagado ? pago.montoReal : pago.montoEstimado);
    }, 0);
  }, 0);

  return "<div class=\"recuadro\">" +
    "<div class=\"encabezado-recuadro\">" +
      "<span class=\"nombre-categoria-muro\">" + escaparHTML(recuadro.nombre) + "</span>" +
      "<span class=\"total-categoria-muro\">" + formatearMoneda(total) + "</span>" +
    "</div>" +
    recuadro.grupos.map(function (grupo) {
      const titulo = (grupo.titulo && mostrarTitulos)
        ? "<div class=\"titulo-subcategoria-muro\">" + escaparHTML(grupo.titulo) + "</div>"
        : "";
      return titulo + grupo.pagos.map(function (pago) {
        const estado = calcularEstadoDePago(pago);
        const monto = Number(pago.pagado ? pago.montoReal : pago.montoEstimado);

        // Un pago diferido a crédito deja de salir de este ciclo: se convierte
        // en mensualidades que alimentan el pago de la tarjeta. Se marca en la
        // fila y su monto ya no suma al total de la categoría.
        const etiquetaCredito = pago.estadoCredito
          ? " <span class=\"marca-credito\">" + pago.estadoCredito.mesesDiferidos + " MSI</span>"
          : "";

        // El monto va siempre como texto. Antes era un campo suelto dentro
        // de la fila, y convivía mal con el botón de tres puntos de al
        // lado: dos blancos chiquitos que acertar en la misma línea.
        const montoHTML = "<span class=\"monto-fila-muro\">" + formatearMoneda(monto) + "</span>";

        // El destinatario va pegado al nombre, en el mismo renglón y en tono
        // apagado: "Agua Zafiro" se lee de corrido, como una sola cosa.
        // Estuvo en una segunda línea hasta el 6 ago 2026 — cada pago con
        // destinatario costaba el doble de alto, y el muro se auto-escala
        // para caber sin scroll, así que ese alto lo pagaban todos.
        // Nunca se trunca: si el nombre es largo, la fila crece, y el muro
        // se reacomoda solo porque su ajuste mide el contenido real.
        const destinatarioVisible = (recuadro.destinatariosVisibles || {})[pago.idSimulado || pago.id];
        const marcaDestinatario = destinatarioVisible
          ? " <span class=\"destinatario-fila-muro\">" + escaparHTML(destinatarioVisible) + "</span>"
          : "";

        // La fila ENTERA es el botón: nombre, día y monto. Antes había que
        // acertarle a un botón de tres puntos de 20px al final de la línea,
        // que en el teléfono es un blanco imposible y en la laptop obliga a
        // buscarlo. Decisión del usuario (2 ago 2026): "quiero que cada
        // gasto pueda tocarlo toda su línea".
        //
        // Un pago ya pagado no es botón: no hay nada que decidir sobre él.
        const interior =
          "<span class=\"punto-estado " + estado + "\"></span>" +
          "<span class=\"nombre-fila-muro\">" + escaparHTML(pago.nombre) + marcaDestinatario + etiquetaCredito + "</span>" +
          "<span class=\"dia-fila-muro\">" + formatearDiaYMes(pago.fechaProgramada) + "</span>" +
          montoHTML;

        const clases = "fila-muro" + (estado === "pagado" ? " es-pagado" : "") +
          (pago.estadoCredito ? " es-credito" : "") +
          (idDePagoConOpcionesAbiertas === pago.idSimulado ? " esta-abierta" : "");

        const fila = pago.pagado
          ? "<div class=\"" + clases + "\">" + interior + "</div>"
          : "<button type=\"button\" class=\"" + clases + " es-tocable\"" +
              " data-opciones-de=\"" + pago.idSimulado + "\"" +
              " aria-label=\"Ajustar " + escaparHTML(pago.nombre) + "\">" +
              interior +
            "</button>";

        if (!conAccionDePago || pago.pagado) {
          return fila;
        }

        return fila +
          "<div class=\"confirmacion-en-cajon\">" +
            "<label>Mover a" +
              "<input type=\"date\" class=\"fecha-a-posponer\" data-fecha-de=\"" + pago.id + "\"" +
                " value=\"" + pago.fechaProgramada + "\">" +
            "</label>" +
            "<label>Monto real" +
              "<input type=\"number\" min=\"0\" step=\"0.01\" class=\"monto-real-pendiente\" value=\"" + pago.montoEstimado + "\">" +
            "</label>" +
            "<label>Fuente" +
              "<select class=\"fuente-pendiente\">" +
                "<option value=\"debito\">Débito</option>" +
                "<option value=\"credito\">Crédito</option>" +
              "</select>" +
            "</label>" +
            "<button type=\"button\" class=\"boton-marcar-pagado\" data-compromiso-id=\"" + pago.id + "\">" +
              "Marcar pagado" +
            "</button>" +
          "</div>";
      }).join("");
    }).join("") +
  "</div>";
}

// Reparte los recuadros en N columnas conservando el orden de las
// categorías (el orden es decisión del usuario, no del algoritmo) y
// mandando cada uno a la columna que va más corta. Es lo que produce el
// efecto de mampostería sin dejar huecos.
function repartirRecuadrosEnColumnas(alturas, numeroDeColumnas, separacion) {
  const columnas = [];
  for (let i = 0; i < numeroDeColumnas; i++) {
    columnas.push({ indices: [], alto: 0 });
  }

  alturas.forEach(function (alto, indice) {
    let masCorta = columnas[0];
    columnas.forEach(function (columna) {
      if (columna.alto < masCorta.alto) {
        masCorta = columna;
      }
    });
    masCorta.indices.push(indice);
    masCorta.alto += alto + (masCorta.indices.length > 1 ? separacion : 0);
  });

  return columnas;
}

function alturaDelReparto(columnas) {
  return columnas.reduce(function (maximo, columna) {
    return Math.max(maximo, columna.alto);
  }, 0);
}

// Cuánto mide cada recuadro con un ancho y una escala dados. Se dibujan
// todos en una columna oculta del ancho que les tocaría y se leen las
// alturas de un tirón: un solo reflujo por combinación.
//
// El medidor se cuelga dentro de #vistaAncha, no de <body>, porque las
// reglas del muro y sus variables de color están ancladas ahí.
function medirRecuadrosDelMuro(recuadros, numeroDeColumnas, escala, mostrarTitulos) {
  const zona = document.getElementById("zonaMuro");
  const estilos = getComputedStyle(zona);
  const separacion = SEPARACION_BASE_MURO * escala;
  const anchoUtil = zona.clientWidth - parseFloat(estilos.paddingLeft) - parseFloat(estilos.paddingRight);
  const anchoDeColumna = (anchoUtil - separacion * (numeroDeColumnas - 1)) / numeroDeColumnas;

  const medidor = document.createElement("div");
  medidor.className = "columna-muro";
  medidor.style.position = "absolute";
  medidor.style.visibility = "hidden";
  medidor.style.pointerEvents = "none";
  medidor.style.left = "-10000px";
  medidor.style.top = "0";
  medidor.style.width = anchoDeColumna + "px";
  medidor.style.setProperty("--escala", String(escala));
  medidor.innerHTML = recuadros.map(function (recuadro) {
    return htmlDeRecuadroDelMuro(recuadro, mostrarTitulos);
  }).join("");

  document.getElementById("vistaAncha").appendChild(medidor);
  const alturas = Array.prototype.map.call(medidor.children, function (hijo) {
    return hijo.getBoundingClientRect().height;
  });
  medidor.parentNode.removeChild(medidor);

  return { alturas: alturas, separacion: separacion };
}

// La escala más grande, dentro del margen permitido, con la que el
// contenido cabe en N columnas. Devuelve null si no cabe ni con la mínima.
function buscarMejorEscalaDelMuro(recuadros, numeroDeColumnas, mostrarTitulos, disponible) {
  function probar(escala) {
    const medicion = medirRecuadrosDelMuro(recuadros, numeroDeColumnas, escala, mostrarTitulos);
    const reparto = repartirRecuadrosEnColumnas(medicion.alturas, numeroDeColumnas, medicion.separacion);
    const alto = alturaDelReparto(reparto);
    return { cabe: alto <= disponible, reparto: reparto, alto: alto };
  }

  const conMaxima = probar(ESCALA_MAXIMA_MURO);
  if (conMaxima.cabe) {
    return { escala: ESCALA_MAXIMA_MURO, reparto: conMaxima.reparto, alto: conMaxima.alto };
  }

  const conMinima = probar(ESCALA_MINIMA_MURO);
  if (!conMinima.cabe) {
    return null;
  }

  // Cabe en la mínima pero no en la máxima: el punto está en medio. La
  // altura no baja de forma lineal con la escala (el texto se reacomoda),
  // así que se busca por bisección en vez de despejarlo de una fórmula.
  let cabe = ESCALA_MINIMA_MURO;
  let noCabe = ESCALA_MAXIMA_MURO;
  let mejorReparto = conMinima.reparto;
  let mejorAlto = conMinima.alto;

  for (let paso = 0; paso < PASOS_DE_BISECCION_MURO; paso++) {
    const medio = (cabe + noCabe) / 2;
    const intento = probar(medio);
    if (intento.cabe) {
      cabe = medio;
      mejorReparto = intento.reparto;
      mejorAlto = intento.alto;
    } else {
      noCabe = medio;
    }
  }

  return { escala: cabe, reparto: mejorReparto, alto: mejorAlto };
}

function pintarMuro(recuadros, columnas, mostrarTitulos) {
  document.getElementById("muroPagos").innerHTML = columnas.map(function (columna) {
    return "<div class=\"columna-muro\">" +
      columna.indices.map(function (indice) {
        return htmlDeRecuadroDelMuro(recuadros[indice], mostrarTitulos);
      }).join("") +
    "</div>";
  }).join("");

  // Los cambios se aplican al salir del campo, no en cada tecla: por tecla
  // se dispararía un redibujado completo con el cursor dentro del input.
  document.querySelectorAll("#muroPagos [data-categoria-tope]").forEach(function (campo) {
    campo.addEventListener("change", function () {
      cambiarTopeSemanalSimulado(campo.getAttribute("data-categoria-tope"), campo.value);
    });
  });

  conectarAperturaDeOpciones(document.getElementById("muroPagos"), false);
}

// La fila entera abre su ventanita, y volver a tocarla la cierra: si no
// fuera así, la única forma de cerrarla sería acertarle a la ×.
//
// La usan los tres lugares desde donde se puede tocar un pago: el muro, la
// franja "Lo que sigue" y la lista de pendientes. Los tres abren la misma
// ventana sobre el mismo pago, y por eso el cableado vive en un solo sitio.
//
// `vengoDeLaLista` cambia dos cosas: la ventana ofrece un "‹ Pendientes"
// para regresar, y NO se re-ancla al elemento tocado — esas filas viven
// dentro del propio panel y desaparecen al cambiarle el contenido, así que
// medir contra ellas dejaría la ventana en cualquier lado.
function conectarAperturaDeOpciones(contenedor, vengoDeLaLista) {
  contenedor.querySelectorAll("[data-opciones-de]").forEach(function (elemento) {
    elemento.addEventListener("click", function () {
      const id = elemento.getAttribute("data-opciones-de");
      if (idDePagoConOpcionesAbiertas === id) {
        cerrarOpcionesDePago();
      } else {
        abrirOpcionesDePago(id, vengoDeLaLista ? null : elemento, vengoDeLaLista);
      }
    });
  });
}

// ============================================================
// OPCIONES DE PAGO — débito, crédito a meses, y a qué ciclo
// ============================================================
//
// Ventana flotante de tamaño contenido, la misma idea que Ajustes. Aquí es
// donde se decide pagar algo con tarjeta de crédito y a cuántos meses: el
// motor reparte entonces las mensualidades en los ciclos que les toca según
// la fecha real de corte de esa tarjeta, y el pago deja de salir de este
// ciclo para convertirse en pago de tarjeta.
//
// Los controles son los de construirFilaCompromisoSimulado, sin cambios: ya
// están probados, incluidos los dos avisos (no se puede diferir el pago de
// una tarjeta a otra tarjeta, y no se puede diferir si ninguna tarjeta tiene
// marcado que permite meses sin intereses).

function abrirOpcionesDePago(idSimulado, elementoAncla, vengoDeLaLista) {
  const item = compromisosMaterializadosSimulacion.find(function (m) { return m.idSimulado === idSimulado; });
  if (!item) { return; }

  const tarjetasQuePermitenDiferir = datosSimulados.config.tarjetas.filter(function (t) {
    return t.permiteDiferirAMeses;
  });

  // El regreso solo se ofrece si se llegó desde la lista. Abrir un pago
  // desde el muro y encontrarse un "‹ Pendientes" sería una puerta a un
  // lugar donde nunca se estuvo.
  const botonVolver = vengoDeLaLista
    ? "<button type=\"button\" id=\"botonVolverAPendientes\" class=\"volver-en-panel\" " +
        "aria-label=\"Volver a la lista de pendientes\">‹</button>"
    : "";

  // El nombre lleva su destinatario: es justo aquí donde se acaba de tocar
  // un pago para saber cuál es, y "Agua" a secas no lo dice.
  const panel = document.getElementById("panelOpcionesPago");
  panel.classList.remove("con-lista");
  panel.innerHTML =
    "<header id=\"encabezadoOpcionesPago\">" +
      botonVolver +
      "<span class=\"nombre-en-panel\">" + etiquetaCompletaDeCompromiso(item, obtenerDatosVisibles()) + "</span>" +
      "<button type=\"button\" id=\"botonCerrarOpcionesPago\" aria-label=\"Cerrar\">×</button>" +
    "</header>" +
    "<div id=\"cuerpoOpcionesPago\">" +
      construirFilaCompromisoSimulado(item, tarjetasQuePermitenDiferir) +
      "<p class=\"pie-simulacion\">Es una simulación. Nada se guarda hasta que uses " +
        "<strong>Guardar</strong> en la barra de arriba.</p>" +
    "</div>";

  document.getElementById("capaOpcionesPago").hidden = false;
  document.getElementById("botonCerrarOpcionesPago").addEventListener("click", cerrarOpcionesDePago);

  if (vengoDeLaLista) {
    document.getElementById("botonVolverAPendientes").addEventListener("click", function () {
      abrirListaDePendientes();
    });
  }

  // Los mismos manejadores del motor: cada cambio marca el item y redibuja
  // toda la pantalla, así que el balance y la trayectoria responden en vivo.
  conectarEventosDeFilaCompromisoSimulado(panel);

  // Al redibujar, la ventana se queda abierta sobre el mismo pago para poder
  // probar varias combinaciones sin volver a buscarlo.
  idDePagoConOpcionesAbiertas = idSimulado;
  laListaDePendientesEstaAbierta = false;

  marcarLoQueEstaAbierto();
  anclarPanelDeOpciones(elementoAncla);
}

// Deja marcado el chip o la fila del pago abierto, y desmarca los demás.
//
// La clase también se escribe al construir el HTML, pero eso solo sirve
// cuando algo redibuja la pantalla — y abrir la ventanita no redibuja nada.
// Sin esto, el chip solo se marcaba después de tocarle un campo, que es
// justo cuando ya no hace falta saber cuál se abrió.
function marcarLoQueEstaAbierto() {
  document.querySelectorAll("[data-opciones-de]").forEach(function (elemento) {
    const esElAbierto = elemento.getAttribute("data-opciones-de") === idDePagoConOpcionesAbiertas;
    elemento.classList.toggle("esta-abierta", esElAbierto);
  });
}

// Coloca la ventanita pegada al elemento que se tocó, no en el centro de la
// pantalla. Se posiciona con position: fixed y coordenadas medidas, y no
// como hijo de ese elemento, porque el muro recorta lo que se sale de sus
// recuadros y la ventana quedaría cortada.
//
// Debajo del elemento si cabe; encima si no. Y siempre dentro de la
// ventana del navegador, aunque esté pegado a un borde.
//
// Recibe el elemento y no un id porque el mismo pago aparece hasta en tres
// lugares a la vez —el muro, la franja de arriba y la lista— y buscarlo por
// id devolvería el primero del documento, que es el de la franja: tocar una
// fila del muro abriría la ventana pegada al techo de la pantalla.
function anclarPanelDeOpciones(elementoAncla) {
  const panel = document.getElementById("panelOpcionesPago");

  // Sin ancla nueva se reusa la última: cuando la ventana navega dentro de
  // sí misma (lista → detalle → lista) no debe brincar de lugar. Y si el
  // ancla murió en un redibujado, se deja donde está en vez de medir contra
  // un elemento huérfano, que devuelve ceros y la mandaría a la esquina.
  const ancla = elementoAncla || elementoAnclaDeOpciones;
  if (!ancla || !ancla.isConnected) { return; }
  elementoAnclaDeOpciones = ancla;

  const MARGEN = 10;
  const SEPARACION = 6;
  const rectFila = ancla.getBoundingClientRect();

  // Se mide el panel ya dibujado, sin tope de altura, para saber cuánto
  // quiere ocupar. El tope se le pone después, según el hueco que haya.
  panel.style.maxHeight = "";
  const alturaDeseada = panel.getBoundingClientRect().height;
  const anchoPanel = panel.getBoundingClientRect().width;

  let izquierda = rectFila.left;
  if (izquierda + anchoPanel > window.innerWidth - MARGEN) {
    izquierda = window.innerWidth - anchoPanel - MARGEN;
  }
  panel.style.left = Math.max(izquierda, MARGEN) + "px";

  const huecoAbajo = window.innerHeight - rectFila.bottom - SEPARACION - MARGEN;
  const huecoArriba = rectFila.top - SEPARACION - MARGEN;

  // Debajo de la fila si cabe entero; si no, encima. Y si no cabe de
  // ningún lado —pantallas bajas, o una fila a media altura— se queda del
  // lado con más hueco y el panel se recorta con scroll propio. Antes se
  // pegaba al borde de arriba y terminaba tapando justo el pago que se
  // estaba editando, que es lo peor que puede hacer.
  if (alturaDeseada <= huecoAbajo) {
    panel.style.top = (rectFila.bottom + SEPARACION) + "px";
  } else if (alturaDeseada <= huecoArriba) {
    panel.style.top = (rectFila.top - alturaDeseada - SEPARACION) + "px";
  } else if (huecoAbajo >= huecoArriba) {
    panel.style.top = (rectFila.bottom + SEPARACION) + "px";
    panel.style.maxHeight = huecoAbajo + "px";
  } else {
    panel.style.top = MARGEN + "px";
    panel.style.maxHeight = huecoArriba + "px";
  }
}

let idDePagoConOpcionesAbiertas = null;
let laListaDePendientesEstaAbierta = false;

// El elemento contra el que se midió la posición de la ventana. Se guarda
// porque la ventana navega —de la lista al detalle de un pago y de vuelta—
// y en esos saltos hay que seguir midiendo contra el botón de origen.
let elementoAnclaDeOpciones = null;

// La lista completa de lo que falta por pagar, ordenada por vencimiento.
//
// El muro ya tiene todos los pendientes, pero agrupados por categoría, que
// es como se decide el presupuesto; para saber en qué orden vencen hay que
// barrer las columnas comparando fechas a ojo. La franja de arriba resuelve
// eso para los primeros cuatro, y esta lista para todos los demás, sin
// mover el muro de sitio ni obligarlo a reordenarse.
//
// Muestra TODOS los pendientes del ciclo, no solo los que no cupieron en la
// franja: la lista es "qué falta por pagar", y empezar en el quinto sería
// una lista que arranca a media frase.
function abrirListaDePendientes(elementoAncla) {
  const datos = obtenerDatosVisibles();
  const pendientes = ordenarPagosDelMuro(obtenerPendientesDelCicloEnfocado());

  if (pendientes.length === 0) {
    cerrarOpcionesDePago();
    return;
  }

  const total = pendientes.reduce(function (suma, pago) {
    return suma + Number(pago.montoEstimado);
  }, 0);

  const filas = pendientes.map(function (pago) {
    const estado = calcularEstadoDePago(pago);
    return "<button type=\"button\" class=\"fila-pendiente-lista " + estado + "\"" +
        " data-opciones-de=\"" + pago.idSimulado + "\"" +
        " aria-label=\"Ajustar " + escaparHTML(pago.nombre) + "\">" +
        "<span class=\"punto-estado " + estado + "\"></span>" +
        "<span class=\"fecha-pendiente-lista\">" + formatearDiaYMes(pago.fechaProgramada) + "</span>" +
        "<span class=\"nombre-pendiente-lista\">" + etiquetaCompletaDeCompromiso(pago, datos) + "</span>" +
        "<span class=\"monto-pendiente-lista\">" + formatearMoneda(Number(pago.montoEstimado)) + "</span>" +
      "</button>";
  }).join("");

  // La clase va antes de anclar: el anclaje mide el ancho ya dibujado para
  // decidir de qué lado cabe, y con la medida vieja se saldría de pantalla.
  const panel = document.getElementById("panelOpcionesPago");
  panel.classList.add("con-lista");
  panel.innerHTML =
    "<header id=\"encabezadoOpcionesPago\">" +
      // El conteo y el total van en el encabezado y no al pie: con muchos
      // pendientes la lista se lleva todo el alto disponible y un pie queda
      // debajo del scroll, que es como no estar.
      "<span class=\"nombre-en-panel\">Por pagar · " + pendientes.length + " · " +
        formatearMoneda(total) + "</span>" +
      "<button type=\"button\" id=\"botonCerrarOpcionesPago\" aria-label=\"Cerrar\">×</button>" +
    "</header>" +
    "<div id=\"cuerpoOpcionesPago\">" +
      "<div class=\"lista-pendientes\">" + filas + "</div>" +
    "</div>";

  document.getElementById("capaOpcionesPago").hidden = false;
  document.getElementById("botonCerrarOpcionesPago").addEventListener("click", cerrarOpcionesDePago);

  // Las filas de esta lista abren el detalle del pago dentro de la misma
  // ventana, no una segunda encima: dos ventanas apiladas sobre el muro
  // dejan de ser un ajuste rápido y se vuelven una interrupción.
  conectarAperturaDeOpciones(panel, true);

  idDePagoConOpcionesAbiertas = null;
  laListaDePendientesEstaAbierta = true;

  marcarLoQueEstaAbierto();
  anclarPanelDeOpciones(elementoAncla);
}

function cerrarOpcionesDePago() {
  document.getElementById("capaOpcionesPago").hidden = true;
  document.getElementById("panelOpcionesPago").innerHTML = "";
  idDePagoConOpcionesAbiertas = null;
  laListaDePendientesEstaAbierta = false;
  elementoAnclaDeOpciones = null;
  marcarLoQueEstaAbierto();
}

function opcionesDePagoEstanAbiertas() {
  return document.getElementById("capaOpcionesPago").hidden === false;
}

// El tope semanal se edita dentro de la simulación, como los montos: mover
// el presupuesto variable es justo una de las cosas con las que se juega
// para ver si el ciclo cierra, y no debe escribirse hasta guardar.
function cambiarTopeSemanalSimulado(categoriaId, valor) {
  const trabajo = asegurarSimulacionAbierta();
  const ciclo = asegurarCicloActual();
  const cicloDeTrabajo = trabajo.ciclos.find(function (c) { return c.id === ciclo.id; });

  if (!cicloDeTrabajo) {
    return;
  }
  if (!cicloDeTrabajo.presupuestoSemanal) {
    cicloDeTrabajo.presupuestoSemanal = {};
  }
  cicloDeTrabajo.presupuestoSemanal[categoriaId] = Number(valor) || 0;

  renderizarTodo();
}

function alturaDisponibleDelMuro() {
  const zona = document.getElementById("zonaMuro");
  const estilos = getComputedStyle(zona);
  return zona.clientHeight - parseFloat(estilos.paddingTop) - parseFloat(estilos.paddingBottom);
}

function acomodarMuroDePagos(recuadros) {
  const zona = document.getElementById("zonaMuro");
  const vista = document.getElementById("vistaAncha");

  // Se mide siempre en el mismo estado: si la clase de scroll quedara
  // puesta del acomodo anterior, la barra angostaría la zona y las
  // mediciones no serían comparables entre sí.
  zona.classList.remove("con-scroll");
  const disponible = alturaDisponibleDelMuro();

  for (let indiceModo = 0; indiceModo < MODOS_DE_DENSIDAD_MURO.length; indiceModo++) {
    const modo = MODOS_DE_DENSIDAD_MURO[indiceModo];
    let mejor = null;

    COLUMNAS_A_PROBAR_MURO.forEach(function (numeroDeColumnas) {
      const resultado = buscarMejorEscalaDelMuro(recuadros, numeroDeColumnas, modo.titulos, disponible);
      if (resultado === null) {
        return;
      }
      if (mejor === null) {
        mejor = { columnas: numeroDeColumnas, escala: resultado.escala, reparto: resultado.reparto, alto: resultado.alto };
        return;
      }
      // Primero manda la legibilidad: gana la escala más grande. Entre dos
      // igual de legibles gana la que deja menos pantalla sin usar; sin ese
      // desempate el muro se apila arriba y deja hueco abajo.
      const esMasLegible = resultado.escala > mejor.escala + 0.001;
      const esIgualDeLegible = Math.abs(resultado.escala - mejor.escala) <= 0.001;
      if (esMasLegible || (esIgualDeLegible && resultado.alto > mejor.alto)) {
        mejor = { columnas: numeroDeColumnas, escala: resultado.escala, reparto: resultado.reparto, alto: resultado.alto };
      }
    });

    if (mejor !== null) {
      vista.style.setProperty("--escala", String(mejor.escala));
      pintarMuro(recuadros, mejor.reparto, modo.titulos);
      return { columnas: mejor.columnas, escala: mejor.escala, modo: modo.id, conScroll: false };
    }
  }

  // Ni el modo más compacto cabe: este mes se resuelve con scroll, en el
  // reparto que menos desborde.
  const modoFinal = MODOS_DE_DENSIDAD_MURO[MODOS_DE_DENSIDAD_MURO.length - 1];
  let menosDesborde = null;

  COLUMNAS_A_PROBAR_MURO.forEach(function (numeroDeColumnas) {
    const medicion = medirRecuadrosDelMuro(recuadros, numeroDeColumnas, ESCALA_MINIMA_MURO, modoFinal.titulos);
    const reparto = repartirRecuadrosEnColumnas(medicion.alturas, numeroDeColumnas, medicion.separacion);
    const alto = alturaDelReparto(reparto);
    if (menosDesborde === null || alto < menosDesborde.alto) {
      menosDesborde = { columnas: numeroDeColumnas, reparto: reparto, alto: alto };
    }
  });

  vista.style.setProperty("--escala", String(ESCALA_MINIMA_MURO));
  pintarMuro(recuadros, menosDesborde.reparto, modoFinal.titulos);
  zona.classList.add("con-scroll");
  return { columnas: menosDesborde.columnas, escala: ESCALA_MINIMA_MURO, modo: modoFinal.id, conScroll: true };
}

// ============================================================
// VISTA ANCHA — LO QUE SIGUE
// ============================================================
//
// El muro contesta "¿qué debo este ciclo y cuánto?": por eso agrupa por
// categoría, que es como se decide el presupuesto. Pero no contesta "¿qué
// sigue?", porque para eso hay que barrer todas las columnas comparando
// fechas a ojo. Son dos preguntas distintas y necesitan dos lugares.
//
// Esta franja es la versión de laptop de lo que el teléfono ya tenía arriba
// de todo: los próximos pagos, cruzando categorías, ordenados por fecha.
//
// Los chips nacieron informativos, a propósito: el muro era el único lugar
// donde se tocaba un pago, y dos vías para la misma acción parecían una de
// más. El uso real lo desmintió (6 ago 2026) — si el pago que hay que mover
// está a la vista aquí arriba, mandar al usuario a buscarlo otra vez entre
// las columnas del muro es la vía de más. Ahora el chip abre la misma
// ventana que la fila del muro, sobre el mismo pago.

// Cuántos pagos alcanzan a leerse de un vistazo sin que la franja se vuelva
// una lista. Más de esto deja de ser "lo que sigue" y empieza a ser el muro
// otra vez, pero en horizontal.
const CUANTOS_PAGOS_MUESTRA_LO_QUE_SIGUE = 4;

// Lo que todavía pide dinero en el ciclo enfocado.
//
// Una sola definición para los tres que la necesitan: los chips, el conteo
// del "+N pendientes" y la lista que ese botón abre. Filtrando cada uno por
// su cuenta, el botón podría acabar diciendo "+10 pendientes" y la lista
// mostrar doce, y no habría forma de saber cuál de los dos miente.
//
// Los de monto cero no entran, misma regla que en el teléfono: una tarjeta
// sin compras del periodo no es un pendiente, y un pago de cero no se puede
// registrar. Los diferidos a crédito tampoco: ya no salen de este ciclo.
function obtenerPendientesDelCicloEnfocado() {
  return obtenerItemsSimuladosDelCicloEnfocado().filter(function (pago) {
    return !pago.pagado && !pago.estadoCredito && Number(pago.montoEstimado) > 0;
  });
}

function renderizarBandaLoQueSigue() {
  const banda = document.getElementById("bandaLoQueSigue");
  const datos = obtenerDatosVisibles();
  const pendientes = obtenerPendientesDelCicloEnfocado();

  // Sin pendientes la franja se va del todo, en vez de quedarse diciendo
  // "nada": el alto que ocupa lo necesita el muro, que se auto-escala para
  // caber sin scroll.
  if (pendientes.length === 0) {
    banda.innerHTML = "";
    banda.hidden = true;
    return;
  }

  const ordenados = ordenarPagosDelMuro(pendientes);
  const proximos = ordenados.slice(0, CUANTOS_PAGOS_MUESTRA_LO_QUE_SIGUE);
  const cuantosNoCaben = ordenados.length - proximos.length;

  const chips = proximos.map(function (pago) {
    const estado = calcularEstadoDePago(pago);

    // El chip abierto se queda marcado, igual que la fila del muro: con la
    // ventanita encima hay que poder ver sobre cuál de los cuatro está.
    const abierto = idDePagoConOpcionesAbiertas === pago.idSimulado ? " esta-abierta" : "";

    // etiquetaCompletaDeCompromiso ya devuelve HTML escapado, y resuelve el
    // destinatario para que dos recibos que se llaman "Agua" no se confundan.
    return "<button type=\"button\" class=\"chip-siguiente " + estado + abierto + "\"" +
        " data-opciones-de=\"" + pago.idSimulado + "\"" +
        " aria-label=\"Ajustar " + escaparHTML(pago.nombre) + "\">" +
        "<span class=\"punto-estado " + estado + "\"></span>" +
        "<span class=\"fecha-chip\">" + formatearDiaYMes(pago.fechaProgramada) + "</span>" +
        "<span class=\"nombre-chip\">" + etiquetaCompletaDeCompromiso(pago, datos) + "</span>" +
        "<span class=\"monto-chip\">" + formatearMoneda(Number(pago.montoEstimado)) + "</span>" +
      "</button>";
  }).join("");

  // Decía "+10 en el muro", que describía dónde buscarlos en vez de qué son.
  // Ahora dice qué son y además los trae: abre la lista completa por fecha.
  const resto = cuantosNoCaben > 0
    ? "<button type=\"button\" class=\"resto-siguiente\" id=\"botonVerPendientes\">+" +
        cuantosNoCaben + " pendiente" + (cuantosNoCaben === 1 ? "" : "s") + "</button>"
    : "";

  banda.hidden = false;
  banda.innerHTML =
    "<span class=\"etiqueta-ancha\">Lo que sigue</span>" +
    "<div class=\"chips-siguientes\">" + chips + resto + "</div>";

  conectarAperturaDeOpciones(banda, false);

  const botonPendientes = document.getElementById("botonVerPendientes");
  if (botonPendientes) {
    botonPendientes.addEventListener("click", function () {
      if (laListaDePendientesEstaAbierta) {
        cerrarOpcionesDePago();
      } else {
        abrirListaDePendientes(botonPendientes);
      }
    });
  }
}

function renderizarMuroDePagos() {
  const zona = document.getElementById("zonaMuro");

  // Acomodar el muro exige medir la altura que tiene libre. Si no está en
  // pantalla —porque el cajón lo tapa, o porque es un celular y la vista
  // ancha está oculta— esa altura es cero y el acomodo elegiría cualquier
  // cosa. Se deja para cuando vuelva a verse: quien lo muestre lo pide.
  if (zona.offsetParent === null || zona.clientHeight === 0) {
    return null;
  }

  const datos = obtenerDatosVisibles();
  const ciclo = asegurarCicloActual();

  // Va ANTES de acomodar el muro, no después: la franja le quita alto a la
  // zona del muro, y el acomodo mide ese alto en vivo. Al revés, el muro se
  // escalaría contra un espacio que ya no tiene.
  renderizarBandaLoQueSigue();

  const recuadros = construirRecuadrosDelMuro(ciclo, datos);

  if (recuadros.length === 0) {
    document.getElementById("muroPagos").innerHTML =
      "<p class=\"pista\">Todavía no hay pagos ni presupuestos en este ciclo. " +
      "Captura categorías, recurrentes o deudas desde Ajustes.</p>";
    return null;
  }

  return acomodarMuroDePagos(recuadros);
}

// El acomodo depende del tamaño de la ventana, así que se recalcula al
// cambiarla. Con espera, para no correr la búsqueda completa en cada uno de
// los cuadros intermedios de un arrastre.
let temporizadorDeReacomodoDelMuro = null;
window.addEventListener("resize", function () {
  clearTimeout(temporizadorDeReacomodoDelMuro);
  temporizadorDeReacomodoDelMuro = setTimeout(function () {
    if (document.getElementById("vistaAncha").offsetParent !== null) {
      renderizarMuroDePagos();
    }
  }, 120);
});

// ============================================================
// VISTA ANCHA — ENCABEZADO DEL CICLO
// ============================================================
//
// Un solo número manda: el disponible real, el mismo que ya muestra
// Captura y el titular de Balance del ciclo. El resto de la barra son los
// números que el usuario quiere ver al entrar — ingresos, comprometido,
// pagado, variable — en fichas con el mismo lenguaje visual del estudio.
// Antes vivían en un recuadro "Resumen del ciclo" dentro del muro; el
// usuario pidió subirlos aquí (2 ago 2026) para que el muro quede solo
// con pagos.

// Los números que resumen el ciclo enfocado. Devuelve datos, no HTML: la
// barra los acomoda como quiera, pero las cuentas viven en un solo lugar.
//
// Usa las fórmulas que ya están en SPEC.md, no versiones simplificadas:
// "lo que falta del gasto variable" se proyecta al ritmo diario que se lleva
// de verdad, no con el presupuesto teórico.
function calcularResumenDelCiclo(ciclo, datos) {
  // Del motor de simulación, no de las fórmulas reales: es el único que
  // descuenta lo diferido a crédito de este ciclo y suma en su lugar las
  // mensualidades que caen aquí. Con las fórmulas reales, diferir un pago no
  // movía estos números ni un peso, que era justo lo que había que arreglar.
  const resultado = obtenerResultadoSimuladoDelCicloEnfocado();
  const items = obtenerItemsSimuladosDelCicloEnfocado();
  const esCicloActual = indiceCicloEnfocadoSimulacion === 0;

  // Lo ya pagado son hechos: solo cuentan los pagos de verdad marcados, y
  // nunca uno diferido (si se difirió, no se pagó de esta cuenta).
  const comprometidoPagado = items
    .filter(function (item) { return item.pagado && !item.estadoCredito; })
    .reduce(function (suma, item) { return suma + Number(item.montoReal); }, 0);

  // La ficha de la derecha mide UNA sola bolsa: la de la categoría que el
  // usuario marcó en Ajustes como la que lleva barra en Captura — su gasto
  // diario, que en su caso es Comida.
  //
  // Antes sumaba TODO gasto libre a débito, sin mirar la categoría. Con sus
  // datos reales eso metía en la cifra un pago de tarjeta, un empeño y una
  // recarga registrados en "Otros": le decía que llevaba el 72% de su bolsa
  // cuando llevaba el 50% (medido el 4 ago 2026). Decisión suya ese día:
  // "comida es comida, ningún otro dato debe inflar ese monto".
  //
  // Se pregunta por la marca y nunca por el nombre: reconocerla como "Comida"
  // se rompería el día que la llame "Alimentos" — misma razón por la que
  // existe obtenerCategoriaDeLaBarraSemanal.
  //
  // Si no hay ninguna marcada (instalación nueva), la ficha vuelve a hablar
  // de todo el presupuesto variable, que es mejor que no decir nada.
  const categoriaDeLaBolsa = obtenerCategoriaDeLaBarraSemanal(datos);

  // Se reusan las funciones del motor en vez de filtrar aquí: son las mismas
  // que ya usan la barra de Captura y el §3 del estudio, así que las tres
  // pantallas no pueden discrepar sobre cuánto llevas gastado de comida.
  const variableGastado = categoriaDeLaBolsa
    ? calcularGastadoDeLaBolsaEnElCiclo(categoriaDeLaBolsa, ciclo, datos)
    : datos.gastos
        .filter(function (g) {
          return g.cicloId === ciclo.id && g.compromisoId === null && g.fuente === "debito";
        })
        .reduce(function (suma, g) { return suma + Number(g.monto); }, 0);

  // Lo que sigue apartado de esa bolsa en lo que queda del ciclo. En un ciclo
  // futuro no hay nada consumido, así que manda el presupuesto completo.
  let variablePorVenir;
  if (categoriaDeLaBolsa) {
    variablePorVenir = esCicloActual
      ? calcularPresupuestoPendienteDeCategoria(categoriaDeLaBolsa, ciclo, datos)
      : calcularBolsaCompletaDeCategoria(categoriaDeLaBolsa, ciclo, datos);
  } else {
    variablePorVenir = esCicloActual
      ? calcularPresupuestoVariablePendiente(ciclo, datos)
      : resultado.gastoVariableProyectado;
  }

  // En el ciclo en curso, el balance y "Libre para gastar" son el mismo
  // número y se calculan igual: lo que sobra al cerrar ES lo que se puede
  // gastar de más. Por eso la barra no muestra "Balance al cerrar": sería
  // repetir la cifra grande con otro nombre.
  //
  // En un ciclo futuro no hay días transcurridos ni gasto real que medir,
  // así que ahí manda el presupuesto del ciclo entero, que es lo que
  // calcula el motor de simulación.
  const mensualidadesDeTarjeta = Object.keys(resultado.contribucionesTarjeta || {})
    .reduce(function (suma, tarjetaId) { return suma + resultado.contribucionesTarjeta[tarjetaId]; }, 0);

  const balance = esCicloActual
    ? calcularDisponibleReal(ciclo, datos, mensualidadesDeTarjeta)
    : resultado.balanceDelCiclo;

  return {
    esCicloActual: esCicloActual,
    ingreso: resultado.ingresoDelCiclo,
    comprometido: resultado.totalComprometido,
    comprometidoPagado: comprometidoPagado,
    faltaPagar: Math.max(resultado.totalComprometido - comprometidoPagado, 0),
    pagosHechos: items.filter(function (item) { return item.pagado; }).length,
    pagosTotales: items.length,
    variableGastado: variableGastado,
    variablePorVenir: variablePorVenir,
    // El nombre lo pone la categoría, no una constante: si la renombra, la
    // ficha se entera sola.
    nombreDeLaBolsa: categoriaDeLaBolsa ? categoriaDeLaBolsa.nombre : null,
    balance: balance
  };
}

function renderizarEncabezadoDelCiclo() {
  const ciclo = obtenerCicloEnfocado();
  const resumen = calcularResumenDelCiclo(ciclo, obtenerDatosVisibles());

  // En el ciclo actual la cifra que manda es el disponible de hoy. En un
  // ciclo futuro no existe "disponible": lo que se puede saber es con cuánto
  // cerraría, así que esa pasa a ser la cifra principal.
  document.getElementById("etiquetaCifraPrincipal").textContent =
    resumen.esCicloActual ? "Libre para gastar" : "Balance proyectado";
  document.getElementById("cifraDisponibleAncha").textContent = formatearMoneda(resumen.balance);

  // El rango de fechas va corto ("del 30 jul al 28 ago"): el año sobra y
  // el mes con nombre se lee más rápido que 2026-08-28.
  document.getElementById("identidadCiclo").innerHTML =
    "del <span class=\"cifra-a\">" + formatearDiaYMes(ciclo.fechaInicio) + "</span>" +
    " al <span class=\"cifra-a\">" + formatearDiaYMes(ciclo.fechaFin) + "</span>" +
    " · <span class=\"cifra-a\">" + calcularDiasTotalesDelCiclo(ciclo) + "</span> días" +
    (resumen.esCicloActual ? "" : " · proyectado");

  renderizarPastillasDeCiclos();

  // Las fichas usan el mismo constructor y las mismas clases que las del
  // estudio (htmlDeFicha, en estudio.js): el usuario pidió que la barra
  // hablara el mismo idioma que "lo de abajo". Los colores de las barras
  // son los del semáforo de esta pantalla — verde agua "pagado" para el
  // avance de lo comprometido, ámbar "pendiente" para el variable que ya
  // se consumió — porque aquí el color solo significa estado.
  const proporcionPagada = resumen.comprometido > 0
    ? resumen.comprometidoPagado / resumen.comprometido
    : 0;
  const bolsaVariable = resumen.variableGastado + resumen.variablePorVenir;
  const proporcionGastada = bolsaVariable > 0
    ? resumen.variableGastado / bolsaVariable
    : 0;

  const fichaIngresos = htmlDeFicha("Ingresos", formatearMoneda(resumen.ingreso));

  // La cifra grande es lo que FALTA por pagar, no el total comprometido del
  // ciclo (4 ago 2026). El total es un número de planeación: sirve al abrir
  // el ciclo y al cerrarlo, pero a media quincena ya no dice nada, porque no
  // se mueve aunque el usuario lleve ocho pagos hechos. Lo que falta sí baja
  // con cada pago, que es la pregunta del día a día. El total no se pierde:
  // baja al pie, junto al conteo de pagos.
  //
  // Es además el mismo trato que ya recibía su vecina: "Variable por gastar"
  // muestra lo que queda y manda lo gastado al pie. Las dos fichas envejecen
  // ahora igual durante el ciclo.
  //
  // En un ciclo futuro no hay nada pagado, así que "por pagar" sería otra vez
  // el total y el pie repetiría la misma cifra. Ahí la ficha se queda en el
  // total previsto, sin barra: una barra en cero no informa de nada.
  const fichaComprometido = resumen.esCicloActual
    ? htmlDeFicha("Por pagar", formatearMoneda(resumen.faltaPagar), {
        pie: resumen.pagosHechos + " de " + resumen.pagosTotales + " pagados · de " +
          formatearMoneda(resumen.comprometido),
        barra: { valor: proporcionPagada, color: "var(--bien-a)" },
        titulo: "Lo que todavía tiene que salir de la cuenta este ciclo. Ya pagado: " +
          formatearMoneda(resumen.comprometidoPagado) + " de " + formatearMoneda(resumen.comprometido)
      })
    : htmlDeFicha("Comprometido", formatearMoneda(resumen.comprometido), {
        pie: resumen.pagosTotales + " pagos programados"
      });

  // En un ciclo futuro no hay nada consumido que medir: la ficha se queda
  // en el presupuesto previsto, sin barra ni pie.
  //
  // La etiqueta la pone la categoría de la bolsa ("Comida por gastar"), para
  // que diga qué mide de verdad. Solo cae en "Variable" cuando no hay ninguna
  // categoría marcada y la ficha vuelve a hablar de todas.
  const etiquetaBolsa = resumen.nombreDeLaBolsa || "Variable";
  const fichaVariable = resumen.esCicloActual
    ? htmlDeFicha(etiquetaBolsa + " por gastar", formatearMoneda(resumen.variablePorVenir), {
        pie: formatearMoneda(resumen.variableGastado) + " ya gastado",
        barra: { valor: proporcionGastada, color: "var(--cuidado-a)" },
        titulo: "El presupuesto de " + etiquetaBolsa + " en este ciclo: lo que ya consumió " +
          "más lo que sigue apartado. No cuenta gastos de otras categorías."
      })
    : htmlDeFicha("Presupuesto de " + etiquetaBolsa, formatearMoneda(resumen.variablePorVenir));

  document.getElementById("fichasCiclo").innerHTML =
    fichaIngresos + fichaComprometido + fichaVariable;
}

// La tira de pastillas para moverse por el horizonte: una por ciclo, la
// enfocada rellena. Sustituye a las flechas ‹ › (4 ago 2026): con los
// siete ciclos a la vista, tocar el mes que se quiere ver es un solo paso
// en vez de repetir la flecha, y de paso se ve cuánto horizonte hay.
function renderizarPastillasDeCiclos() {
  const horizonte = obtenerHorizonteDeCiclosSimulacion();

  document.getElementById("pastillasCiclos").innerHTML = horizonte.map(function (ciclo, indice) {
    // El id de un ciclo es "AAAA-MM"; la pastilla muestra solo el mes con
    // nombre, y el id completo queda en el tooltip para distinguir el año.
    const numeroDeMes = Number(ciclo.id.split("-")[1]);
    const enfocada = indice === indiceCicloEnfocadoSimulacion;

    return "<button type=\"button\" class=\"pastilla-ciclo" + (enfocada ? " esta-enfocada" : "") + "\"" +
      " data-indice-ciclo=\"" + indice + "\"" +
      " title=\"Ciclo " + ciclo.id + "\"" +
      (enfocada ? " aria-current=\"true\"" : "") + ">" +
      MESES_ABREVIADOS[numeroDeMes - 1] +
    "</button>";
  }).join("");
}

// ============================================================
// VISTA ANCHA — SIMULACIÓN DE LA PRIMERA PANTALLA
// ============================================================
//
// La primera pantalla no es solo de consulta: se juega con los números para
// armar la estrategia del ciclo. Decisión del usuario: "hago la simulación,
// si me gusta la guardo, si no que se devuelva a lo original" — sin
// historial de escenarios.
//
// Mientras se está simulando existe una copia de trabajo. Todo lo que dibuja
// la primera pantalla lee de ella, así que los totales, la trayectoria y el
// balance al cerrar responden en vivo a cada cambio. Los datos reales no se
// tocan hasta que se guarda.
//
// Guardar aplica los cambios uno por uno sobre los datos reales, en vez de
// escribir la copia completa encima: si algo más cambió en los datos
// mientras se simulaba, sobreescribir el objeto entero lo perdería.

// La simulación NO tiene una copia propia: usa datosSimulados y
// compromisosMaterializadosSimulacion, el motor que ya existía para la
// pestaña de Simulación. Eso es a propósito y no debe deshacerse: ese motor
// es el que sabe repartir un diferimiento a crédito en mensualidades por la
// fecha real de corte de la tarjeta, contar el saldo ocupado de la línea, y
// recordar ediciones sobre compromisos de ciclos proyectados que no existen
// en datos.compromisos.
//
// Hubo un momento en que la primera pantalla llevaba su propia copia de
// trabajo, más simple, que solo entendía monto y fecha. El resultado fue dos
// simulaciones distintas en el mismo archivo y el diferimiento a crédito
// desconectado de la pantalla. Una sola.

// De aquí leen todos los render de la primera pantalla.
function obtenerDatosVisibles() {
  return datosSimulados || leerDatos();
}

function haySimulacionEnCurso() {
  return datosSimulados !== null;
}

// Arranca la simulación desde los datos reales si no estaba abierta. Se
// llama al dibujar la primera pantalla, así que siempre hay simulación viva:
// no hay un "modo consulta" y un "modo simulación", hay una pantalla donde se
// prueba y una barra que aparece cuando algo se movió.
function asegurarSimulacionAbierta() {
  if (datosSimulados === null) {
    datosSimulados = JSON.parse(JSON.stringify(leerDatos()));
    compromisosMaterializadosSimulacion = materializarCompromisosDelHorizonte(datosSimulados);
    indiceCicloEnfocadoSimulacion = 0;
  }
  return datosSimulados;
}

// Vuelve a partir de los datos reales cuando estos cambiaron por fuera de la
// simulación: capturar un ingreso, dar de alta un recurrente, editar una
// categoría desde Ajustes.
//
// Sin esto, la copia se creaba una sola vez y nunca se refrescaba: los datos
// reales cambiaban, Análisis lo mostraba porque lee de ellos directo, y la
// primera pantalla seguía dibujando la copia vieja. Un ingreso recién
// capturado no aparecía y la trayectoria seguía diciendo que no había ninguno.
//
// Solo se rehace si no hay nada sin guardar: con cambios en curso, rehacer los
// borraría. En ese caso se respeta la simulación, y al guardarla o reiniciarla
// se vuelve a sincronizar sola.
function sincronizarSimulacionConLosDatosReales() {
  if (datosSimulados === null) {
    return;
  }
  if (calcularCambiosDeLaSimulacion().total > 0) {
    return;
  }

  const cicloQueSeEstabaViendo = indiceCicloEnfocadoSimulacion;
  datosSimulados = JSON.parse(JSON.stringify(leerDatos()));
  compromisosMaterializadosSimulacion = materializarCompromisosDelHorizonte(datosSimulados);
  // Se conserva el ciclo que el usuario estaba viendo: rehacer la copia es un
  // detalle interno y no debería devolverlo al ciclo actual sin que lo pida.
  indiceCicloEnfocadoSimulacion = cicloQueSeEstabaViendo;
}

function obtenerCicloEnfocado() {
  return obtenerHorizonteDeCiclosSimulacion()[indiceCicloEnfocadoSimulacion];
}

// El balance del ciclo enfocado según el motor de simulación — el único que
// entiende los diferimientos a crédito: un pago diferido deja de salir de su
// ciclo y reaparece como mensualidades en los ciclos que les toca.
//
// Se calcula una vez por dibujado y se reparte a quien lo necesite, en vez de
// que cada parte de la pantalla vuelva a proyectar los siete ciclos.
let proyeccionSimuladaDelDibujado = null;

function recalcularProyeccionSimulada() {
  asegurarSimulacionAbierta();
  proyeccionSimuladaDelDibujado = calcularProyeccionSimuladaCompleta(
    datosSimulados,
    compromisosMaterializadosSimulacion
  );
  return proyeccionSimuladaDelDibujado;
}

function obtenerResultadoSimuladoDelCicloEnfocado() {
  if (proyeccionSimuladaDelDibujado === null) {
    recalcularProyeccionSimulada();
  }
  return proyeccionSimuladaDelDibujado.resultadosPorCiclo[indiceCicloEnfocadoSimulacion];
}

// Los compromisos del ciclo que se está viendo, ya materializados: incluye
// los de ciclos proyectados, que no existen en datos.compromisos.
function obtenerItemsSimuladosDelCicloEnfocado() {
  asegurarSimulacionAbierta();
  const cicloEnfocado = obtenerCicloEnfocado();
  return compromisosMaterializadosSimulacion.filter(function (item) {
    return item.cicloId === cicloEnfocado.id;
  });
}

// Qué se movió respecto a los datos reales.
//
// Los compromisos del ciclo actual se comparan contra los reales, uno por
// uno. Los de ciclos proyectados no existen en los datos, así que ahí lo
// único que se puede consultar es la marca que el motor pone al editarlos
// (modificadoEnSimulacion): son cambios reales de la simulación, pero no
// guardables — no hay compromiso con id sobre el que escribir.
function calcularCambiosDeLaSimulacion() {
  if (!haySimulacionEnCurso()) {
    return { montos: 0, fechas: 0, credito: 0, topes: 0, proyectados: 0, guardables: 0, total: 0 };
  }

  const reales = leerDatos();
  const ciclo = asegurarCicloActual();
  let montos = 0;
  let fechas = 0;
  let credito = 0;
  let proyectados = 0;

  (compromisosMaterializadosSimulacion || []).forEach(function (item) {
    const real = item.id ? reales.compromisos.find(function (c) { return c.id === item.id; }) : null;

    if (!real) {
      if (item.modificadoEnSimulacion) { proyectados++; }
      return;
    }

    if (Number(item.montoEstimado) !== Number(real.montoEstimado)) { montos++; }
    if (item.fechaProgramada !== real.fechaProgramada || item.cicloId !== real.cicloId) { fechas++; }
    // El diferimiento a crédito no existe en los datos reales: cualquier
    // estadoCredito puesto en la simulación es un cambio.
    if (item.estadoCredito) { credito++; }
  });

  const cicloSimulado = datosSimulados.ciclos.find(function (c) { return c.id === ciclo.id; });
  const cicloReal = reales.ciclos.find(function (c) { return c.id === ciclo.id; });
  let topes = 0;
  if (cicloSimulado && cicloReal) {
    const presupuestoSimulado = cicloSimulado.presupuestoSemanal || {};
    const presupuestoReal = cicloReal.presupuestoSemanal || {};
    Object.keys(presupuestoSimulado).forEach(function (categoriaId) {
      if (Number(presupuestoSimulado[categoriaId] || 0) !== Number(presupuestoReal[categoriaId] || 0)) {
        topes++;
      }
    });
  }

  const guardables = montos + fechas + topes;
  return {
    montos: montos,
    fechas: fechas,
    credito: credito,
    topes: topes,
    proyectados: proyectados,
    guardables: guardables,
    total: guardables + credito + proyectados
  };
}

function renderizarBarraDeSimulacion() {
  const barra = document.getElementById("barraSimulacion");
  const cambios = calcularCambiosDeLaSimulacion();

  // Sin cambios no hay nada que guardar ni que descartar: la barra
  // desaparece en vez de quedarse ocupando espacio con dos botones inertes.
  if (cambios.total === 0) {
    barra.innerHTML = "";
    barra.hidden = true;
    return;
  }

  const partes = [];
  if (cambios.montos > 0) { partes.push(cambios.montos + " monto" + (cambios.montos === 1 ? "" : "s")); }
  if (cambios.fechas > 0) { partes.push(cambios.fechas + " movido" + (cambios.fechas === 1 ? "" : "s") + " de fecha"); }
  if (cambios.credito > 0) { partes.push(cambios.credito + " a crédito"); }
  if (cambios.topes > 0) { partes.push(cambios.topes + " presupuesto" + (cambios.topes === 1 ? "" : "s")); }
  if (cambios.proyectados > 0) { partes.push(cambios.proyectados + " en ciclos futuros"); }

  // Lo que se puede escribir sobre los datos reales es solo lo del ciclo
  // actual. Un diferimiento a crédito y los cambios en ciclos proyectados
  // sirven para decidir, pero no hay compromiso real sobre el que guardarlos
  // — decirlo aquí evita que Guardar prometa más de lo que hace.
  const notaNoGuardable = (cambios.credito > 0 || cambios.proyectados > 0)
    ? "<span class=\"nota-simulacion\">El crédito y los ciclos futuros solo se " +
      "usan para proyectar: no se guardan.</span>"
    : "";

  barra.hidden = false;
  barra.innerHTML =
    "<span class=\"aviso-simulacion\">Probando: " + partes.join(", ") + "</span>" +
    notaNoGuardable +
    "<button type=\"button\" id=\"botonDescartarSimulacion\">Reiniciar</button>" +
    "<button type=\"button\" id=\"botonGuardarSimulacion\"" +
      (cambios.guardables === 0 ? " disabled" : "") + ">Guardar</button>";

  document.getElementById("botonDescartarSimulacion").addEventListener("click", reiniciarSimulacion);
  document.getElementById("botonGuardarSimulacion").addEventListener("click", guardarSimulacion);
}

// Escribe los cambios de la simulación sobre los datos reales. Es el único
// punto de la app donde una simulación toca datos de verdad, así que pide
// confirmación.
function guardarSimulacion() {
  const cambios = calcularCambiosDeLaSimulacion();
  if (cambios.guardables === 0) {
    return;
  }

  if (!confirm("Vas a guardar " + cambios.guardables + " cambio(s) sobre tus pagos reales. ¿Continuar?")) {
    return;
  }

  const datos = leerDatos();
  const ciclo = asegurarCicloActual();

  // Solo los compromisos que existen de verdad (los que traen id). Los de
  // ciclos proyectados no tienen dónde guardarse.
  compromisosMaterializadosSimulacion.forEach(function (item) {
    if (!item.id) { return; }
    const real = datos.compromisos.find(function (c) { return c.id === item.id; });
    if (!real) { return; }

    real.montoEstimado = Number(item.montoEstimado);

    if (item.fechaProgramada !== real.fechaProgramada) {
      real.fechaProgramada = item.fechaProgramada;
      // Mover la fecha puede sacar el pago de su ciclo. Si el cicloId no se
      // recalcula, el pago sigue contando en el ciclo viejo aunque su fecha
      // diga otra cosa — el mismo error que ya se corrigió en ingresos.
      real.cicloId = calcularIdDeCicloParaFecha(crearFechaLocal(item.fechaProgramada));
    } else if (item.cicloId !== real.cicloId) {
      // Se movió de ciclo con el selector, sin tocar la fecha.
      real.cicloId = item.cicloId;
    }
  });

  const cicloSimulado = datosSimulados.ciclos.find(function (c) { return c.id === ciclo.id; });
  const cicloReal = datos.ciclos.find(function (c) { return c.id === ciclo.id; });
  if (cicloSimulado && cicloReal) {
    cicloReal.presupuestoSemanal = Object.assign({}, cicloSimulado.presupuestoSemanal);
  }

  guardarDatos(datos);
  // La simulación se rearma desde los datos ya guardados, así que lo que
  // queda en pantalla es exactamente lo que se grabó.
  reiniciarSimulacion();
  mostrarMensaje("Cambios guardados.");
}

// Mover un pago a otra fecha (posponerlo o adelantarlo).
function cambiarFechaSimulada(idSimulado, nuevaFecha) {
  if (!nuevaFecha) {
    return;
  }

  asegurarSimulacionAbierta();
  const item = compromisosMaterializadosSimulacion.find(function (m) { return m.idSimulado === idSimulado; });
  if (!item) { return; }

  item.fechaProgramada = nuevaFecha;
  item.cicloId = calcularIdDeCicloParaFecha(crearFechaLocal(nuevaFecha));
  item.modificadoEnSimulacion = true;
  renderizarTodo();
}

// ============================================================
// VISTA ANCHA — TRAYECTORIA
// ============================================================
//
// La misma pregunta que responde el semáforo, pero como recorrido: cuánto
// dinero queda cada día del ciclo si el ritmo no cambia, y en qué fecha se
// acaba. Reusa calcularTrayectoriaDelSemaforo, que ya calcula el acumulado
// día por día con las reglas de SPEC.md — aquí solo se le resta al ingreso
// para pasar de "cuánto he gastado" a "cuánto me queda", que es la lectura
// que el usuario pidió.

const ALTO_GRAFICA_TRAYECTORIA = 54;

// Banda de abajo, reservada para los números de día. Va fuera del alto del
// trazo y no encima: escribiendo los números sobre el área de la curva, la
// línea los cruza justo cuando el ciclo va mal, que es cuando más se miran.
const ALTO_EJE_TRAYECTORIA = 15;

// Cada cuántos días se escribe una referencia bajo la curva. Todos los días
// serían treinta números pegados e ilegibles; de cinco en cinco alcanza
// para ubicarse, que es lo único que se le pide al eje.
const CADA_CUANTOS_DIAS_UNA_MARCA = 5;

// El primer día en que el dinero restante se vuelve negativo. null si el
// ciclo cierra sin quedarse sin dinero.
function calcularDiaEnQueSeAcabaElDinero(trayectoria, ingresos) {
  const diaSinDinero = trayectoria.find(function (dia) { return dia.acumulado > ingresos; });
  return diaSinDinero || null;
}

// Qué se paga cada día del ciclo. Es el tercer renglón del globo: la curva
// dice cuánto baja el dinero ese día, y esto dice de qué.
//
// Se incluyen los ya pagados: si el 12 de agosto salió el Agua, ese día el
// dinero bajó y el globo tiene que poder explicarlo. Los diferidos a crédito
// no, porque dejaron de salir de este ciclo — la misma regla con la que el
// muro los atenúa y los saca del total de su categoría.
function calcularPagosPorDiaDelCicloEnfocado() {
  const pagosPorFecha = {};

  obtenerItemsSimuladosDelCicloEnfocado().forEach(function (pago) {
    const monto = Number(pago.pagado ? pago.montoReal : pago.montoEstimado);
    if (pago.estadoCredito || !(monto > 0)) {
      return;
    }
    if (!pagosPorFecha[pago.fechaProgramada]) {
      pagosPorFecha[pago.fechaProgramada] = [];
    }
    pagosPorFecha[pago.fechaProgramada].push(pago);
  });

  return pagosPorFecha;
}

// Los nombres de lo que se paga un día, como una sola frase y sin montos.
// El monto ya está contado en la caída de la línea; repetirlo pago por pago
// convertiría un globo de tres renglones en una tabla.
//
// Si todo lo del día es del mismo destinatario, el destinatario va una sola
// vez al final: "Agua, Luz, Totalplay Zafiro" en lugar de repetir "Zafiro"
// tres veces. En cuanto hay dos destinatarios distintos cada nombre carga el
// suyo, porque ahí la repetición sí está diciendo algo.
function frasearPagosDelDia(pagos, datos) {
  const destinatarios = pagos.map(function (pago) {
    return resolverDestinatarioDeCompromiso(pago, datos) || "";
  });

  const todosDelMismo = destinatarios.every(function (destinatario) {
    return destinatario === destinatarios[0];
  });

  if (todosDelMismo && destinatarios[0]) {
    return pagos.map(function (pago) { return pago.nombre; }).join(", ") + " " + destinatarios[0];
  }

  return pagos.map(function (pago, indice) {
    return pago.nombre + (destinatarios[indice] ? " " + destinatarios[indice] : "");
  }).join(", ");
}

function renderizarTrayectoriaDeLaPrimeraPantalla() {
  const datos = obtenerDatosVisibles();
  // La curva día por día solo tiene sentido en el ciclo en curso: en uno
  // futuro no hay "hoy" dentro, ni gasto variable real con el que medir un
  // ritmo. Ahí el veredicto es el balance proyectado, que ya está arriba.
  const esCicloActual = indiceCicloEnfocadoSimulacion === 0;
  const banda = document.getElementById("bandaTrayectoria");
  banda.hidden = !esCicloActual;
  if (!esCicloActual) {
    return;
  }

  const ciclo = obtenerCicloEnfocado();
  const ingresos = calcularIngresosDelCiclo(ciclo, datos);
  const veredicto = document.getElementById("veredictoTrayectoria");
  const contenedor = document.getElementById("graficaTrayectoria");

  // Sin ingreso capturado no hay contra qué comparar — mismo criterio "gris"
  // que ya usa el semáforo: no es que el ciclo vaya mal, es que todavía no
  // hay nada que calcular.
  if (ingresos <= 0) {
    veredicto.textContent = "Captura un ingreso de este ciclo para ver la trayectoria.";
    contenedor.innerHTML = "";
    return;
  }

  const resultado = obtenerResultadoSimuladoDelCicloEnfocado();
  const mensualidadesDeTarjeta = Object.keys(resultado.contribucionesTarjeta || {})
    .reduce(function (suma, tarjetaId) { return suma + resultado.contribucionesTarjeta[tarjetaId]; }, 0);

  const trayectoria = calcularTrayectoriaDelSemaforo(ciclo, datos, mensualidadesDeTarjeta);
  const diaSinDinero = calcularDiaEnQueSeAcabaElDinero(trayectoria, ingresos);
  const restanteAlCerrar = ingresos - trayectoria[trayectoria.length - 1].acumulado;

  if (diaSinDinero) {
    const fecha = crearFechaLocal(diaSinDinero.fechaISO);
    const diasQueFaltanParaCerrar = trayectoria.length -
      trayectoria.findIndex(function (dia) { return dia.fechaISO === diaSinDinero.fechaISO; }) - 1;
    veredicto.innerHTML = "Te quedas sin dinero el <strong>" + fecha.getDate() + " de " +
      NOMBRES_DE_MESES[fecha.getMonth()].toLowerCase() + "</strong>" +
      (diasQueFaltanParaCerrar > 0
        ? ", a " + diasQueFaltanParaCerrar + " día" + (diasQueFaltanParaCerrar === 1 ? "" : "s") + " de cerrar."
        : ", justo al cerrar.");
  } else {
    veredicto.innerHTML = "El ciclo cierra con <strong>" + formatearMoneda(restanteAlCerrar) +
      "</strong> si el ritmo no cambia.";
  }

  const dibujo = construirSVGDeTrayectoria(trayectoria, ingresos, contenedor.clientWidth);
  contenedor.innerHTML = dibujo.svg + "<div class=\"globo-trayectoria\" hidden></div>";

  conectarGloboDeLaTrayectoria(contenedor, dibujo.puntos, datos);
}

// El globo que aparece al pasar el cursor por la curva.
//
// Se escucha el movimiento sobre todo el contenedor y se calcula qué día
// cae bajo el cursor, en vez de poner una zona sensible por día: treinta
// nodos invisibles encima de una franja de 54px no dibujan mejor y hay que
// mantenerlos alineados con la curva.
//
// Tres renglones, en el orden en que se pregunta: qué día es, cuánto queda
// ese día, y qué se paga. El tercero se omite si ese día no se paga nada —
// un renglón vacío se lee como un dato faltante, no como un día libre.
function conectarGloboDeLaTrayectoria(contenedor, puntos, datos) {
  const globo = contenedor.querySelector(".globo-trayectoria");
  const guia = contenedor.querySelector(".guia-trayectoria");
  const puntoGuia = contenedor.querySelector(".punto-guia-trayectoria");
  const pagosPorFecha = calcularPagosPorDiaDelCicloEnfocado();

  function esconderGlobo() {
    globo.hidden = true;
    guia.setAttribute("visibility", "hidden");
    puntoGuia.setAttribute("visibility", "hidden");
  }

  contenedor.addEventListener("mousemove", function (evento) {
    const rect = contenedor.getBoundingClientRect();
    if (rect.width === 0) { return; }

    // El SVG se dibujó en píxeles reales del contenedor, así que la posición
    // del cursor dentro de él ya está en las mismas unidades que la curva.
    const posicion = (evento.clientX - rect.left) / rect.width;
    const indice = Math.min(
      Math.max(Math.round(posicion * (puntos.length - 1)), 0),
      puntos.length - 1
    );
    const punto = puntos[indice];
    const fecha = crearFechaLocal(punto.fechaISO);
    const pagosDelDia = pagosPorFecha[punto.fechaISO] || [];

    const tercerRenglon = pagosDelDia.length > 0
      ? "<span class=\"pagos-del-globo\">" +
          escaparHTML(frasearPagosDelDia(pagosDelDia, datos)) + "</span>"
      : "";

    globo.innerHTML =
      "<span class=\"dia-del-globo\">" + fecha.getDate() + " de " +
        NOMBRES_DE_MESES[fecha.getMonth()].toLowerCase() + "</span>" +
      "<span class=\"restante-del-globo\">" + formatearMoneda(punto.restante) + "</span>" +
      tercerRenglon;

    globo.hidden = false;

    // El globo se centra en el día señalado y se frena en los bordes, para
    // que en el primer y el último día no se salga del contenedor.
    const mitadDelGlobo = globo.offsetWidth / 2;
    const izquierda = Math.min(Math.max(punto.x, mitadDelGlobo), rect.width - mitadDelGlobo);
    globo.style.left = izquierda + "px";

    guia.setAttribute("x1", punto.x.toFixed(2));
    guia.setAttribute("x2", punto.x.toFixed(2));
    guia.setAttribute("visibility", "visible");
    puntoGuia.setAttribute("cx", punto.x.toFixed(2));
    puntoGuia.setAttribute("cy", punto.y.toFixed(2));
    puntoGuia.setAttribute("visibility", "visible");
  });

  contenedor.addEventListener("mouseleave", esconderGlobo);
}

// La gráfica se dibuja en píxeles reales, con el ancho medido del
// contenedor, y no en un viewBox estirado: estirando un viewBox angosto al
// ancho de la pantalla, el punteado de la línea proyectada se deforma con él
// y la curva se ve como una hilera de guiones sueltos en vez de una línea.
// Al cambiar el tamaño de la ventana se vuelve a generar.
//
// Devuelve el SVG y además la geometría de cada día —dónde quedó cada punto
// y cuánto vale— porque el globo del cursor necesita exactamente eso para
// saber qué día está señalando. Calcularlo dos veces abriría la puerta a que
// el globo y la curva no coincidan.
function construirSVGDeTrayectoria(trayectoria, ingresos, anchoEnPixeles) {
  const ancho = Math.max(anchoEnPixeles || 0, 120);
  const restantes = trayectoria.map(function (dia) { return ingresos - dia.acumulado; });
  const maximo = Math.max.apply(null, restantes.concat([ingresos]));
  const minimo = Math.min.apply(null, restantes.concat([0]));
  const alcance = (maximo - minimo) || 1;
  const altoTotal = ALTO_GRAFICA_TRAYECTORIA + ALTO_EJE_TRAYECTORIA;

  function coordenadaX(indice) {
    return (indice / Math.max(trayectoria.length - 1, 1)) * ancho;
  }
  function coordenadaY(valor) {
    // Se deja un pixel de aire arriba y abajo para que el trazo no se corte.
    return 1 + ((maximo - valor) / alcance) * (ALTO_GRAFICA_TRAYECTORIA - 2);
  }

  const indiceDeHoy = trayectoria.reduce(function (ultimo, dia, indice) {
    return dia.esFuturo ? ultimo : indice;
  }, 0);

  // Lo ya ocurrido y lo proyectado son dos trazos distintos, unidos por el
  // punto de hoy para que la línea no se vea partida.
  const puntosReales = restantes.slice(0, indiceDeHoy + 1).map(function (valor, indice) {
    return coordenadaX(indice).toFixed(2) + "," + coordenadaY(valor).toFixed(2);
  }).join(" ");

  const puntosProyectados = restantes.slice(indiceDeHoy).map(function (valor, posicion) {
    return coordenadaX(indiceDeHoy + posicion).toFixed(2) + "," + coordenadaY(valor).toFixed(2);
  }).join(" ");

  const yDelCero = coordenadaY(0);
  const xDeHoy = coordenadaX(indiceDeHoy);

  // Marca del día en que el dinero se acaba, si ocurre.
  let marcaQuiebre = "";
  const indiceQuiebre = restantes.findIndex(function (valor) { return valor < 0; });
  if (indiceQuiebre !== -1) {
    marcaQuiebre = "<circle class=\"punto-quiebre\" cx=\"" + coordenadaX(indiceQuiebre).toFixed(2) +
      "\" cy=\"" + coordenadaY(restantes[indiceQuiebre]).toFixed(2) + "\" r=\"1.6\"/>";
  }

  // El primer día del ciclo la parte real es un solo punto, y un polyline de
  // un punto no dibuja nada: se marca con un círculo para que "hoy" siempre
  // se vea sobre la curva.
  const puntoDeHoy = "<circle class=\"punto-hoy\" cx=\"" + xDeHoy.toFixed(2) +
    "\" cy=\"" + coordenadaY(restantes[indiceDeHoy]).toFixed(2) + "\" r=\"2.5\"/>";

  // Los números de día bajo la curva. Solo eso: sin rayitas de tick ni línea
  // de eje, que a este tamaño se leen como una segunda curva.
  //
  // Un ciclo cruza de mes (6 de agosto a 5 de septiembre), así que el número
  // solo no basta cuando reinicia: al primer día del ciclo y al primero de
  // cada mes nuevo se les agrega el mes abreviado, y a los demás no. Es la
  // cantidad mínima de texto que evita leer "5" como el 5 de agosto.
  let mesDeLaMarcaAnterior = -1;
  const marcasDeDia = trayectoria.map(function (dia, indice) {
    const esUltimo = indice === trayectoria.length - 1;
    if (indice % CADA_CUANTOS_DIAS_UNA_MARCA !== 0 && !esUltimo) {
      return "";
    }
    // El último día se salta si le cae encima a la marca anterior; vale más
    // el ritmo parejo del eje que cerrar con el número exacto del cierre.
    if (esUltimo && (trayectoria.length - 1) % CADA_CUANTOS_DIAS_UNA_MARCA < 2) {
      return "";
    }

    const fecha = crearFechaLocal(dia.fechaISO);
    const cambioDeMes = fecha.getMonth() !== mesDeLaMarcaAnterior;
    mesDeLaMarcaAnterior = fecha.getMonth();

    const texto = cambioDeMes
      ? fecha.getDate() + " " + NOMBRES_DE_MESES[fecha.getMonth()].toLowerCase().slice(0, 3)
      : String(fecha.getDate());

    // Las marcas de los extremos se recargan hacia adentro para que no se
    // salgan del contenedor; las de en medio van centradas en su día.
    const anclaje = indice === 0
      ? "start"
      : (esUltimo ? "end" : "middle");

    return "<text class=\"marca-dia-trayectoria\" x=\"" + coordenadaX(indice).toFixed(2) +
      "\" y=\"" + (ALTO_GRAFICA_TRAYECTORIA + 11) + "\" text-anchor=\"" + anclaje + "\">" +
      escaparHTML(texto) + "</text>";
  }).join("");

  // La guía que sigue al cursor. Nace escondida y solo el hover la mueve:
  // es un punto y una línea, no un punto por día — la curva tiene que
  // seguirse viendo como una curva cuando nadie la está señalando.
  const guiaDelCursor =
    "<line class=\"guia-trayectoria\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"" +
      ALTO_GRAFICA_TRAYECTORIA + "\" visibility=\"hidden\"/>" +
    "<circle class=\"punto-guia-trayectoria\" cx=\"0\" cy=\"0\" r=\"3\" visibility=\"hidden\"/>";

  const svg = "<svg viewBox=\"0 0 " + ancho + " " + altoTotal + "\" " +
    "role=\"img\" aria-label=\"Dinero restante día por día en el ciclo\">" +
    "<line class=\"linea-cero\" x1=\"0\" y1=\"" + yDelCero.toFixed(2) +
      "\" x2=\"" + ancho + "\" y2=\"" + yDelCero.toFixed(2) + "\"/>" +
    "<line class=\"marca-hoy\" x1=\"" + xDeHoy.toFixed(2) + "\" y1=\"0\" x2=\"" + xDeHoy.toFixed(2) +
      "\" y2=\"" + ALTO_GRAFICA_TRAYECTORIA + "\"/>" +
    marcasDeDia +
    "<polyline class=\"linea-real\" points=\"" + puntosReales + "\"/>" +
    "<polyline class=\"linea-proyectada\" points=\"" + puntosProyectados + "\"/>" +
    puntoDeHoy +
    marcaQuiebre +
    guiaDelCursor +
  "</svg>";

  const puntos = trayectoria.map(function (dia, indice) {
    return {
      fechaISO: dia.fechaISO,
      restante: restantes[indice],
      x: coordenadaX(indice),
      y: coordenadaY(restantes[indice])
    };
  });

  return { svg: svg, puntos: puntos };
}

// ============================================================
// VISTA ANCHA — CAJÓN DE CALENDARIO (cerrado)
// ============================================================
//
// Cerrado muestra los próximos días con algo pendiente. El despliegue
// completo (mes a la izquierda, día elegido a la derecha, con las mismas
// filas del muro) es la siguiente pieza y todavía no está construido.

const DIAS_A_MOSTRAR_EN_EL_CAJON = 7;

// Qué día está elegido en el calendario y qué mes se está viendo. Viven en
// variables de módulo, no en los datos: son estado de la pantalla en este
// momento, no algo que deba sobrevivir a un respaldo.
let diaElegidoDelCajon = null;   // "AAAA-MM-DD"
let mesVisibleDelCajon = null;   // Date con día 1 del mes que se muestra

function cajonEstaAbierto() {
  return document.getElementById("cajonCalendario").classList.contains("abierto");
}

function abrirCajonDeCalendario() {
  const cajon = document.getElementById("cajonCalendario");
  const asa = document.getElementById("asaCajon");

  // Se abre en el día de hoy si no había nada elegido antes.
  if (diaElegidoDelCajon === null) {
    diaElegidoDelCajon = formatearFechaISO(truncarAMedianoche(new Date()));
  }
  const elegido = crearFechaLocal(diaElegidoDelCajon);
  mesVisibleDelCajon = new Date(elegido.getFullYear(), elegido.getMonth(), 1);

  cajon.classList.add("abierto");
  document.getElementById("primeraPantalla").classList.add("con-cajon-abierto");
  document.getElementById("cuerpoCajon").hidden = false;
  asa.setAttribute("aria-expanded", "true");
  document.getElementById("pistaCajon").textContent =
    "Toca un día para ver y marcar sus pagos · toca aquí para minimizar";

  renderizarMesDelCajon();
  renderizarDiaElegidoDelCajon();
}

function cerrarCajonDeCalendario() {
  const cajon = document.getElementById("cajonCalendario");
  const asa = document.getElementById("asaCajon");

  cajon.classList.remove("abierto");
  document.getElementById("primeraPantalla").classList.remove("con-cajon-abierto");
  document.getElementById("cuerpoCajon").hidden = true;
  asa.setAttribute("aria-expanded", "false");
  document.getElementById("pistaCajon").textContent =
    "Próximos 7 días · toca para ver el mes completo";

  // El muro vuelve a la pantalla con toda la altura disponible, así que su
  // acomodo se rehace desde cero para ese espacio.
  renderizarMuroDePagos();
}

function alternarCajonDeCalendario() {
  if (cajonEstaAbierto()) {
    cerrarCajonDeCalendario();
    return;
  }
  // Al abrir no se reacomoda el muro: queda oculto detrás del cajón, así
  // que medirlo contra la altura sobrante sería trabajo tirado.
  abrirCajonDeCalendario();
}

function cambiarMesDelCajon(cuantosMeses) {
  mesVisibleDelCajon = new Date(
    mesVisibleDelCajon.getFullYear(),
    mesVisibleDelCajon.getMonth() + cuantosMeses,
    1
  );
  renderizarMesDelCajon();
}

// Todos los compromisos de una fecha, sin importar de qué ciclo sean: el
// calendario se mueve por meses y un mes cruza dos ciclos.
function obtenerCompromisosDeLaFecha(fechaISO, datos) {
  return datos.compromisos
    .filter(function (compromiso) { return compromiso.fechaProgramada === fechaISO; })
    .sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; });
}

function renderizarMesDelCajon() {
  const datos = obtenerDatosVisibles();
  const ciclo = asegurarCicloActual();
  const anio = mesVisibleDelCajon.getFullYear();
  const mes = mesVisibleDelCajon.getMonth();

  document.getElementById("nombreMesCajon").textContent =
    NOMBRES_DE_MESES[mes] + " " + anio;

  // La rejilla arranca en domingo, como el calendario de Análisis, para que
  // las dos vistas se lean igual.
  const primerDiaDelMes = new Date(anio, mes, 1);
  const huecosIniciales = primerDiaDelMes.getDay();
  const diasDelMes = diasEnElMes(anio, mes);
  const hoyISO = formatearFechaISO(truncarAMedianoche(new Date()));

  let html = DIAS_SEMANA_ABREVIADOS.map(function (dia) {
    return "<div class=\"encabezado-dia-semana\">" + dia + "</div>";
  }).join("");

  for (let i = 0; i < huecosIniciales; i++) {
    html += "<div class=\"celda-dia fuera-del-mes\"></div>";
  }

  for (let dia = 1; dia <= diasDelMes; dia++) {
    const fechaISO = formatearFechaISO(new Date(anio, mes, dia));
    const compromisos = obtenerCompromisosDeLaFecha(fechaISO, datos);

    // Un punto por compromiso, con su estado. Es la misma lectura que en el
    // muro, así que no hace falta leyenda.
    const puntos = compromisos.map(function (compromiso) {
      return "<span class=\"punto-estado " + calcularEstadoDePago(compromiso) + "\"></span>";
    }).join("");

    const dentroDelCiclo = fechaISO >= ciclo.fechaInicio && fechaISO <= ciclo.fechaFin;
    const clases = ["celda-dia"];
    if (fechaISO === diaElegidoDelCajon) { clases.push("elegida"); }
    if (fechaISO === hoyISO) { clases.push("es-hoy"); }
    if (!dentroDelCiclo) { clases.push("fuera-del-ciclo"); }

    html += "<button type=\"button\" class=\"" + clases.join(" ") + "\" data-fecha=\"" + fechaISO + "\">" +
      "<span class=\"numero-dia\">" + dia + "</span>" +
      "<span class=\"puntos-del-dia\">" + puntos + "</span>" +
    "</button>";
  }

  const rejilla = document.getElementById("rejillaMesCajon");
  rejilla.innerHTML = html;

  rejilla.querySelectorAll("[data-fecha]").forEach(function (celda) {
    celda.addEventListener("click", function () {
      diaElegidoDelCajon = celda.getAttribute("data-fecha");
      renderizarMesDelCajon();
      renderizarDiaElegidoDelCajon();
    });
  });
}

// El día elegido muestra sus pagos con las mismas filas del muro: mismo
// punto de estado, mismo nombre, mismo monto alineado. Así lo que se aprende
// a leer en el muro sirve igual aquí.
function renderizarDiaElegidoDelCajon() {
  const datos = obtenerDatosVisibles();
  const compromisos = obtenerCompromisosDeLaFecha(diaElegidoDelCajon, datos);
  const fecha = crearFechaLocal(diaElegidoDelCajon);

  const total = compromisos.reduce(function (suma, compromiso) {
    return suma + Number(compromiso.pagado ? compromiso.montoReal : compromiso.montoEstimado);
  }, 0);

  document.getElementById("encabezadoDiaCajon").innerHTML =
    "<span class=\"fecha-dia-elegido\">" +
      DIAS_SEMANA_COMPLETOS[fecha.getDay()] + " " + fecha.getDate() + " de " +
      NOMBRES_DE_MESES[fecha.getMonth()].toLowerCase() +
    "</span>" +
    (compromisos.length > 0
      ? "<span class=\"total-dia-elegido\">" + formatearMoneda(total) + "</span>"
      : "");

  const contenedor = document.getElementById("contenidoDiaCajon");

  if (compromisos.length === 0) {
    contenedor.innerHTML = "<p class=\"dia-sin-nada\">Nada programado este día.</p>";
    return;
  }

  // Se agrupan por categoría para que el día se lea con la misma estructura
  // del muro, no como una lista plana.
  const porCategoria = {};
  compromisos.forEach(function (compromiso) {
    const categoriaId = resolverCategoriaDeCompromiso(compromiso, datos);
    const categoria = datos.config.categorias.find(function (c) { return c.id === categoriaId; });
    const nombre = categoria
      ? categoria.nombre
      : (compromiso.origen === "tarjeta" ? "Tarjetas" : compromiso.origen === "deuda" ? "Deudas" : "Sin categoría");

    if (!porCategoria[nombre]) { porCategoria[nombre] = []; }
    porCategoria[nombre].push(compromiso);
  });

  contenedor.innerHTML = Object.keys(porCategoria).map(function (nombre) {
    const grupos = [{ titulo: null, pagos: porCategoria[nombre] }];
    return htmlDeRecuadroDelMuro({
      tipo: "pagos",
      nombre: nombre,
      grupos: grupos,
      destinatariosVisibles: calcularDestinatariosVisiblesDelRecuadro(grupos, datos)
    }, false, true);
  }).join("");

  // Posponer o adelantar un pago: entra a la simulación como cualquier otro
  // cambio, así que se ve en el muro y en el balance antes de guardarlo.
  contenedor.querySelectorAll("[data-fecha-de]").forEach(function (campo) {
    campo.addEventListener("change", function () {
      cambiarFechaSimulada(campo.getAttribute("data-fecha-de"), campo.value);
    });
  });

  // Marcar pagado desde aquí: es la razón de que el calendario sea
  // desplegable y no solo consultable.
  contenedor.querySelectorAll(".boton-marcar-pagado").forEach(function (boton) {
    boton.addEventListener("click", function () {
      // Un pago es un hecho, no una hipótesis: se escribe en los datos
      // reales. Con cambios de simulación encima, guardarlo dejaría la copia
      // de trabajo desfasada de la realidad, así que primero hay que
      // resolver la simulación.
      if (haySimulacionEnCurso() && calcularCambiosDeLaSimulacion().total > 0) {
        alert("Tienes cambios sin guardar en la simulación. Guárdalos o reinicia antes de marcar un pago.");
        return;
      }
      confirmarPagoDeCompromiso(
        boton.getAttribute("data-compromiso-id"),
        boton.closest(".confirmacion-en-cajon")
      );
    });
  });
}

function renderizarCajonDeCalendario() {
  const datos = obtenerDatosVisibles();
  const ciclo = asegurarCicloActual();
  const contenedor = document.getElementById("proximosDiasCajon");

  // Si está desplegado, lo que hay que refrescar es el mes y el día, no la
  // tira cerrada: un pago marcado desde el cajón tiene que verse ahí mismo.
  if (cajonEstaAbierto()) {
    renderizarMesDelCajon();
    renderizarDiaElegidoDelCajon();
  }

  // Siete días consecutivos desde hoy, uno por celda — no "los siete
  // próximos días que tienen algo". Los días vacíos también se muestran:
  // saber que el jueves no cae nada es información, y además mantiene la
  // tira estable en vez de reacomodarse cada vez que se paga algo.
  const hoy = truncarAMedianoche(new Date());

  contenedor.innerHTML = "";
  for (let desplazamiento = 0; desplazamiento < DIAS_A_MOSTRAR_EN_EL_CAJON; desplazamiento++) {
    const fecha = sumarDias(hoy, desplazamiento);
    const fechaISO = formatearFechaISO(fecha);
    const compromisos = obtenerCompromisosDeLaFecha(fechaISO, datos);

    const total = compromisos.reduce(function (suma, compromiso) {
      return suma + Number(compromiso.pagado ? compromiso.montoReal : compromiso.montoEstimado);
    }, 0);

    const puntos = compromisos.map(function (compromiso) {
      return "<span class=\"punto-estado " + calcularEstadoDePago(compromiso) + "\"></span>";
    }).join("");

    const clases = ["celda-proxima"];
    if (desplazamiento === 0) { clases.push("es-hoy"); }
    if (compromisos.length === 0) { clases.push("sin-nada"); }

    contenedor.insertAdjacentHTML("beforeend",
      "<button type=\"button\" class=\"" + clases.join(" ") + "\" data-fecha=\"" + fechaISO + "\">" +
        "<span class=\"dia-semana\">" + DIAS_SEMANA_ABREVIADOS[fecha.getDay()] + "</span>" +
        "<span class=\"numero-grande\">" + fecha.getDate() + "</span>" +
        "<span class=\"puntos-del-dia\">" + puntos + "</span>" +
        "<span class=\"monto-del-dia\">" + (compromisos.length > 0 ? formatearMoneda(total) : "—") + "</span>" +
      "</button>");
  }

  // Tocar un día de la tira abre el cajón ya puesto en ese día.
  contenedor.querySelectorAll("[data-fecha]").forEach(function (celda) {
    celda.addEventListener("click", function () {
      diaElegidoDelCajon = celda.getAttribute("data-fecha");
      abrirCajonDeCalendario();
    });
  });
}
