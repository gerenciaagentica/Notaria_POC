import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import {
  loadStore,
  saveStore,
  CategoriaTramiteNoSQL,
  ReglaDocumentoNoSQL,
  UnidadConstructora,
  ProyectoConstructoraNoSQL
} from './store';
import {
  calcularLiquidacionNotarial,
  evaluarVigenciaDocumento,
  generarTextoMinutaNotaria33
} from './agents';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// 1. HEALTH & ESTADO DE ARQUITECTURA (GEMINI 3.8 FLASH + POSTGRESQL 18 + NOSQL)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    motor: 'Motor Notarial Agéntico v1.0',
    modelo_primario: process.env.GEMINI_MODEL_PRIMARY || 'gemini-3.8-flash (Multimodal Vision Nativa · Cero OCR)',
    modelo_contraste_linderos: process.env.GEMINI_MODEL_CONTRAST || 'gemini-3.1-pro-vision (Consenso Independiente)',
    base_datos_transaccional: 'PostgreSQL 18 (uuidv7 + AIO + RLS por Notaría)',
    base_datos_dinamica: 'Cloud Firestore NoSQL / JSONB Dinámico'
  });
});

// 2. OBTENER TODO EL STORE (CATÁLOGO NOSQL, CASOS, CONSTRUCTORAS)
app.get('/api/state', (_req, res) => {
  const store = loadStore();
  const casoActivo = store.casos[0];
  const minutaTexto = casoActivo ? generarTextoMinutaNotaria33(casoActivo) : '';
  const liquidacion = casoActivo
    ? calcularLiquidacionNotarial(casoActivo.negocio.valor_venta, casoActivo.negocio.avaluo_catastral)
    : null;

  res.json({
    ...store,
    minuta_generada_actual: minutaTexto,
    liquidacion_actual: liquidacion
  });
});

// 3. CHAT AGÉNTICO DEL ABOGADO (INTERPRETA TRÁMITE, CRUZA TRADICIÓN VS CÉDULAS, EVALÚA VENCIMIENTOS)
app.post('/api/chat', upload.array('archivos'), (req, res) => {
  const store = loadStore();
  const caso = store.casos[0];
  const { mensaje, fecha_paz_y_salvo, fecha_actual_simulacion, subir_cedula_monica, activar_hipoteca, tiene_admin } = req.body;

  const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  if (mensaje) {
    caso.mensajes_chat.push({
      id: 'msg-u-' + Date.now(),
      emisor: 'ABOGADO',
      autor: 'Dr. Andrés Villamizar (Abogado)',
      hora: ahoraHora,
      texto: mensaje
    });
  }

  const hallazgos: string[] = [];
  const alertasRojas: string[] = [];
  const preguntas: string[] = [];

  // Actualizar si tiene administración o prenda/hipoteca desde el chat o controles
  if (typeof tiene_admin === 'boolean') {
    caso.tiene_administracion = tiene_admin;
    if (tiene_admin && !caso.categorias_activas.includes('PROPIEDAD_HORIZONTAL_ADMIN')) {
      caso.categorias_activas.push('PROPIEDAD_HORIZONTAL_ADMIN');
    } else if (!tiene_admin) {
      caso.categorias_activas = caso.categorias_activas.filter((c) => c !== 'PROPIEDAD_HORIZONTAL_ADMIN');
    }
  }

  if (typeof activar_hipoteca === 'boolean') {
    caso.tiene_prenda_hipoteca = activar_hipoteca;
    if (activar_hipoteca && !caso.categorias_activas.includes('CON_PRENDA_HIPOTECA_LEASING')) {
      caso.categorias_activas.push('CON_PRENDA_HIPOTECA_LEASING');
    } else if (!activar_hipoteca) {
      caso.categorias_activas = caso.categorias_activas.filter((c) => c !== 'CON_PRENDA_HIPOTECA_LEASING');
    }
  }

  // Simular carga de la cédula faltante de Mónica Pérez
  if (subir_cedula_monica || (mensaje && mensaje.toLowerCase().includes('mónica')) || (mensaje && mensaje.toLowerCase().includes('monica')) || (mensaje && mensaje.toLowerCase().includes('cédula'))) {
    const monica = caso.partes.find((p) => p.numero_documento === '52.110.900');
    if (monica && !monica.cedula_cargada) {
      monica.cedula_cargada = true;
      monica.origen_inferencia = 'Confirmada como VENDEDORA (50%) en Certificado de Tradición + Cédula 52.110.900 verificada por Gemini 3.8 Flash Vision.';
      const docCedulas = caso.documentos.find((d) => d.codigo_tipo === 'CEDULA_CIUDADANIA');
      if (docCedulas) {
        docCedulas.nombre = 'Cédulas de Ciudadanía de las Partes (3 de 3 completas)';
        docCedulas.estado = 'VERIFICADO';
        docCedulas.nivel_alerta = 'OK';
        docCedulas.mensaje_alerta = '✓ 3 de 3 Cédulas verificadas (Vendedores: Carlos Mejía y Mónica Pérez · Comprador: Jorge Mosquera). Sin vencimiento.';
      }
      hallazgos.push('✓ Cédula de MÓNICA PATRICIA PÉREZ GÓMEZ (C.C. 52.110.900) leída con Gemini 3.8 Flash Vision: extraídos nombres, fecha/lugar de expedición (Bogotá D.C.) y sexo (F). Expediente de identificación 100% completo.');
      caso.bitacora.unshift({
        id: 'ev-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: 'Gemini 3.8 Flash Vision',
        etapa: caso.etapa_actual,
        detalle: 'Se cargó y verificó la cédula faltante de la vendedora Mónica Patricia Pérez Gómez (C.C. 52.110.900).'
      });
    }
  }

  // Evaluar fecha dinámica del Paz y Salvo de Administración (Regla Fin de Mes)
  if (fecha_paz_y_salvo) {
    const docAdmin = caso.documentos.find((d) => d.codigo_tipo === 'PAZ_Y_SALVO_ADMIN');
    if (docAdmin) {
      docAdmin.fecha_expedicion = fecha_paz_y_salvo;
      const evalRes = evaluarVigenciaDocumento('FIN_DE_MES_ACTUAL', fecha_paz_y_salvo, fecha_actual_simulacion || fecha_paz_y_salvo);
      docAdmin.fecha_vencimiento = evalRes.fecha_vencimiento;
      docAdmin.dias_restantes = evalRes.dias_restantes;
      docAdmin.estado = evalRes.estado;
      docAdmin.nivel_alerta = evalRes.nivel_alerta;
      docAdmin.mensaje_alerta = evalRes.mensaje_alerta;
      if (evalRes.nivel_alerta === 'CRITICAL') {
        alertasRojas.push(evalRes.mensaje_alerta);
      } else {
        hallazgos.push(`✓ Paz y Salvo de Administración validado: ${evalRes.mensaje_alerta}`);
      }
    }
  }

  // Verificar estado general de documentos y linderos para responder en el chat
  const cedulaFaltante = caso.partes.find((p) => !p.cedula_cargada);
  if (cedulaFaltante) {
    alertasRojas.push(`❌ Falta cargar la Cédula de ${cedulaFaltante.nombres_completos} (C.C. ${cedulaFaltante.numero_documento}), quien figura como ${cedulaFaltante.rol} en el Certificado de Tradición.`);
  }

  const docAdminActual = caso.documentos.find((d) => d.codigo_tipo === 'PAZ_Y_SALVO_ADMIN');
  if (caso.tiene_administracion && docAdminActual && docAdminActual.nivel_alerta === 'CRITICAL') {
    alertasRojas.push(docAdminActual.mensaje_alerta);
  }

  const dudasPendientes = caso.discrepancias_linderos.filter((d) => d.estado === 'PENDIENTE_HUMANO');
  if (dudasPendientes.length > 0) {
    preguntas.push(`Quedan ${dudasPendientes.length} fragmentos con sello/mancha en los Linderos de la Escritura Anterior para tu aprobación en el visor Side-by-Side.`);
  } else {
    hallazgos.push('✓ Todos los linderos de la escritura anterior están verificados y aprobados por el abogado.');
  }

  if (hallazgos.length === 0) {
    hallazgos.push(
      `Trámite activo: ${caso.tramite_nombre} (${caso.categorias_activas.join(', ')}).`,
      `Vendedores inferidos por última anotación del Certificado de Tradición: Carlos Arturo Mejía y Mónica Patricia Pérez.`,
      `Comprador inferido por cédula adicional: Jorge Eliécer Mosquera.`
    );
  }

  caso.mensajes_chat.push({
    id: 'msg-ag-' + Date.now(),
    emisor: 'AGENTE_GEMINI_3_8',
    autor: 'Agente Notarial · Gemini 3.8 Flash (Visión Multimodal)',
    hora: ahoraHora,
    texto: 'He actualizado el análisis del expediente cruzando tu base dinámica NoSQL y las reglas de vencimiento:',
    hallazgos,
    alertas_rojas: alertasRojas,
    preguntas_pendientes: preguntas
  });

  saveStore(store);
  res.json({
    ok: true,
    caso,
    minuta_generada_actual: generarTextoMinutaNotaria33(caso),
    liquidacion_actual: calcularLiquidacionNotarial(caso.negocio.valor_venta, caso.negocio.avaluo_catastral)
  });
});

// 4. APROBAR O EDITAR UN LINDERO EN EL VISOR SIDE-BY-SIDE (CONSENSO DOBLE IA)
app.post('/api/linderos/aprobar', (req, res) => {
  const store = loadStore();
  const caso = store.casos[0];
  const { lindero_id, valor_aprobado, aprobar_todos } = req.body;

  if (aprobar_todos) {
    caso.discrepancias_linderos.forEach((d) => {
      d.estado = 'APROBADO_ABOGADO';
      d.aprobado_por = caso.abogado_asignado;
    });
  } else {
    const item = caso.discrepancias_linderos.find((d) => d.id === lindero_id);
    if (item) {
      if (valor_aprobado) {
        item.valor_seleccionado = valor_aprobado;
      }
      item.estado = 'APROBADO_ABOGADO';
      item.aprobado_por = caso.abogado_asignado;
    }
  }

  // Actualizar texto de linderos especiales con los valores aprobados por el abogado
  const d1 = caso.discrepancias_linderos[0]?.valor_seleccionado || 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS';
  const d2 = caso.discrepancias_linderos[1]?.valor_seleccionado || 'nueve metros treinta centímetros (9.30 mts)';

  caso.inmueble.area_privada = d1;
  caso.inmueble.linderos_especiales = `APARTAMENTO SEISCIENTOS UNO (601): Tiene su acceso por el hall del sexto piso, consta de sala-comedor, tres alcobas, cocina, zona de ropas y dos baños. Tiene un área privada de ${d1}, coeficiente de copropiedad del 4.18% y se comprende dentro de los siguientes linderos especiales: POR EL NORTE: En línea quebrada de ocho metros cuarenta y cinco centímetros (8.45 mts) con vacío sobre zona común exterior. POR EL SUR: En extensión de seis metros veinte centímetros (6.20 mts) con hall de circulación común y ducto de escaleras. POR EL ORIENTE: En extensión de ${d2} con muro común que lo separa del apartamento seiscientos dos (602). POR EL OCCIDENTE: En extensión de nueve metros treinta centímetros (9.30 mts) con vacío sobre antejardín de la Calle 116. NADIR: Con placa que lo separa del quinto piso. CENIT: Con placa de cubierta del séptimo piso. Le corresponde el Garaje Doble No. 14 del Sótano 1.`;

  const pendientes = caso.discrepancias_linderos.filter((d) => d.estado === 'PENDIENTE_HUMANO');
  if (pendientes.length === 0) {
    caso.aprobaciones.linderos_aprobados_abogado = true;
    caso.etapa_actual = 'MINUTA_GENERADA';
    const docEsc = caso.documentos.find((d) => d.codigo_tipo === 'ESCRITURA_ANTERIOR');
    if (docEsc) {
      docEsc.estado = 'VERIFICADO';
      docEsc.nivel_alerta = 'OK';
      docEsc.mensaje_alerta = '✓ Linderos Generales y Especiales 100% verificados por Consenso Doble IA y aprobados por el abogado.';
    }
  }

  caso.bitacora.unshift({
    id: 'ev-' + Date.now(),
    fecha: new Date().toLocaleString('es-CO'),
    actor: `Abogado · ${caso.abogado_asignado}`,
    etapa: caso.etapa_actual,
    detalle: `Verificación visual de linderos sobre imagen original completada (${caso.discrepancias_linderos.length - pendientes.length}/${caso.discrepancias_linderos.length} confirmados).`
  });

  saveStore(store);
  res.json({
    ok: true,
    caso,
    minuta_generada_actual: generarTextoMinutaNotaria33(caso)
  });
});

// 5. FLUJO DE VISTO BUENO (ABOGADO -> CLIENTES -> IMPRESIÓN EN PAPEL NOTARIAL -> FIRMA)
app.post('/api/flujo/avanzar', (req, res) => {
  const store = loadStore();
  const caso = store.casos[0];
  const { paso, hojas_papel_notarial, numero_escritura } = req.body;

  if (paso === 'VISTO_BUENO_ABOGADO') {
    caso.aprobaciones.visto_bueno_juridico_abogado = true;
    caso.aprobaciones.visto_bueno_jefe = true;
    caso.aprobaciones.enviado_a_clientes = true;
    caso.etapa_actual = 'VISTO_BUENO_CLIENTES';
    caso.bitacora.unshift({
      id: 'ev-' + Date.now(),
      fecha: new Date().toLocaleString('es-CO'),
      actor: `Abogado · ${caso.abogado_asignado}`,
      etapa: 'VISTO_BUENO_CLIENTES',
      detalle: 'Visto bueno jurídico otorgado. Se envió borrador de la minuta al portal móvil de Vendedores y Comprador.'
    });
  } else if (paso === 'VISTO_BUENO_CLIENTES') {
    caso.aprobaciones.visto_bueno_vendedores = true;
    caso.aprobaciones.visto_bueno_compradores = true;
    caso.partes.forEach((p) => {
      p.visto_bueno_cliente = true;
      p.fecha_visto_bueno = new Date().toLocaleString('es-CO');
    });
    caso.etapa_actual = 'EN_IMPRESION';
    caso.bitacora.unshift({
      id: 'ev-' + Date.now(),
      fecha: new Date().toLocaleString('es-CO'),
      actor: 'Portal Cliente (Vendedores y Comprador)',
      etapa: 'EN_IMPRESION',
      detalle: 'Las partes otorgaron Visto Bueno Digital al borrador de la minuta y diligenciaron declaración PEP. Pasa a cola de impresión.'
    });
  } else if (paso === 'ENVIAR_A_IMPRESION') {
    caso.aprobaciones.en_impresion = true;
    if (hojas_papel_notarial) caso.aprobaciones.hojas_papel_notarial = hojas_papel_notarial;
    if (numero_escritura) caso.aprobaciones.numero_escritura_asignada = numero_escritura;
    caso.etapa_actual = 'EN_IMPRESION';
    caso.bitacora.unshift({
      id: 'ev-' + Date.now(),
      fecha: new Date().toLocaleString('es-CO'),
      actor: 'Módulo de Impresión Notaría 33',
      etapa: 'EN_IMPRESION',
      detalle: `Impresión en papel de seguridad notarial iniciada. Folios asignados: ${caso.aprobaciones.hojas_papel_notarial} · Escritura No. ${caso.aprobaciones.numero_escritura_asignada}.`
    });
  } else if (paso === 'COMPLETAR_FIRMA') {
    caso.aprobaciones.firma_completada = true;
    caso.etapa_actual = 'FIRMADA_Y_REGISTRADA';
    caso.bitacora.unshift({
      id: 'ev-' + Date.now(),
      fecha: new Date().toLocaleString('es-CO'),
      actor: 'Notaria 33 · Dra. Diana Beatriz López Durán',
      etapa: 'FIRMADA_Y_REGISTRADA',
      detalle: 'Toma de huellas índice derecho, firmas de las partes y autorización notarial completadas.'
    });
  }

  saveStore(store);
  res.json({
    ok: true,
    caso,
    minuta_generada_actual: generarTextoMinutaNotaria33(caso)
  });
});

// 6. ALIMENTACIÓN DINÁMICA DE LA BASE NOSQL (AGREGAR CATEGORÍAS O REGLAS DE DOCUMENTOS)
app.post('/api/nosql/categoria', (req, res) => {
  const store = loadStore();
  const tramite = store.catalogo_tramites[0];
  const nuevaCat: CategoriaTramiteNoSQL = req.body;
  tramite.categorias.push(nuevaCat);
  saveStore(store);
  res.json({ ok: true, catalogo_tramites: store.catalogo_tramites });
});

app.post('/api/nosql/documento-regla', (req, res) => {
  const store = loadStore();
  const tramite = store.catalogo_tramites[0];
  const nuevaRegla: ReglaDocumentoNoSQL = req.body;
  const idx = tramite.documentos_reglas.findIndex((d) => d.codigo === nuevaRegla.codigo);
  if (idx >= 0) {
    tramite.documentos_reglas[idx] = nuevaRegla;
  } else {
    tramite.documentos_reglas.push(nuevaRegla);
  }
  saveStore(store);
  res.json({ ok: true, catalogo_tramites: store.catalogo_tramites });
});

// 7. CREACIÓN Y ACTUALIZACIÓN DINÁMICA DE PROYECTOS DE CONSTRUCTORAS (BLOQUES, APTOS, ESTADOS)
app.post('/api/constructoras/crear-proyecto', (req, res) => {
  const store = loadStore();
  const { nombre_proyecto, constructora, nit, direccion, num_bloques, aptos_por_bloque, estados_personalizados } = req.body;

  const letrasBloques = ['Torre A', 'Torre B', 'Torre C', 'Torre D', 'Torre E', 'Torre F', 'Torre G', 'Torre H'];
  const bloques = letrasBloques.slice(0, Math.min(Number(num_bloques) || 2, 8));
  const cantAptos = Math.min(Number(aptos_por_bloque) || 6, 20);
  const estados: string[] =
    Array.isArray(estados_personalizados) && estados_personalizados.length > 0
      ? estados_personalizados
      : ['Sin comprador', 'Documentos pendientes', 'En verificación IA', 'Minuta lista / Visto bueno', 'En impresión', 'Firmada', 'Registrada'];

  const unidades: UnidadConstructora[] = [];
  bloques.forEach((bloque) => {
    const prefijo = bloque.replace('Torre ', '').trim();
    for (let i = 1; i <= cantAptos; i++) {
      const numApto = `${i}01`;
      unidades.push({
        unidad_id: `${prefijo}-${numApto}`,
        bloque,
        apartamento: numApto,
        tipo_apto: i % 2 === 0 ? 'TIPO_A' : 'TIPO_B',
        area_m2: i % 2 === 0 ? 84 : 68,
        valor_venta: i % 2 === 0 ? 445000000 : 365000000,
        estado_dinamico: i === 1 ? 'Firmada' : i === 2 ? 'Documentos pendientes' : 'Sin comprador',
        tiene_alerta_vencimiento: i === 2,
        alerta_detalle: i === 2 ? 'Paz y Salvo Admin vence en 5 días (Fin de mes)' : undefined,
        documentos_recibidos: i === 1 ? 7 : i === 2 ? 3 : 0,
        documentos_totales: 7,
        minuta_firmada: i === 1
      });
    }
  });

  const nuevoProyecto: ProyectoConstructoraNoSQL = {
    proyecto_id: 'proy-' + Date.now(),
    nombre_proyecto: nombre_proyecto || 'Nuevo Proyecto Constructora P.H.',
    constructora: constructora || 'Constructora Bolívar / Marval S.A.',
    nit: nit || '900.123.456-7',
    direccion: direccion || 'Av. Calle 127 # 19-40, Bogotá D.C.',
    tiene_administracion_ph: true,
    bloques_configurados: bloques,
    apartamentos_por_bloque: cantAptos,
    tipos_apartamento: [
      { codigo: 'TIPO_A', nombre: 'Apto Familiar 3 Alcobas', area_m2: 84, precio_base: 445000000 },
      { codigo: 'TIPO_B', nombre: 'Apto Ejecutivo 2 Alcobas', area_m2: 68, precio_base: 365000000 }
    ],
    estados_personalizados: estados,
    documentos_matriz_heredables: [
      { nombre: 'Certificado de Tradición Mayor Extensión', estado: 'VERIFICADO', vigencia: 'Vigente (29 días restantes)' },
      { nombre: 'Escritura Constitución Reglamento P.H.', estado: 'VERIFICADO', vigencia: 'Permanente' }
    ],
    unidades
  };

  store.proyectos_constructoras.unshift(nuevoProyecto);
  saveStore(store);
  res.json({ ok: true, proyectos_constructoras: store.proyectos_constructoras, nuevo_proyecto: nuevoProyecto });
});

app.post('/api/constructoras/actualizar-unidad', (req, res) => {
  const store = loadStore();
  const { proyecto_id, unidad_id, nuevo_estado, comprador_nombre, comprador_cc, forma_pago, documentos_recibidos } = req.body;
  const proy = store.proyectos_constructoras.find((p) => p.proyecto_id === proyecto_id) || store.proyectos_constructoras[0];
  if (proy) {
    const u = proy.unidades.find((x) => x.unidad_id === unidad_id);
    if (u) {
      if (nuevo_estado) u.estado_dinamico = nuevo_estado;
      if (comprador_nombre !== undefined) u.comprador_nombre = comprador_nombre;
      if (comprador_cc !== undefined) u.comprador_cc = comprador_cc;
      if (forma_pago !== undefined) u.forma_pago = forma_pago;
      if (documentos_recibidos !== undefined) u.documentos_recibidos = Number(documentos_recibidos);
      u.minuta_firmada = u.estado_dinamico === 'Firmada' || u.estado_dinamico === 'Registrada';
    }
  }
  saveStore(store);
  res.json({ ok: true, proyectos_constructoras: store.proyectos_constructoras });
});

app.listen(PORT, () => {
  console.log(`🚀 [Motor Notarial Agéntico] Backend corriendo en http://localhost:${PORT}`);
  console.log(`🧠 Modelos configurados: Gemini 3.8 Flash (Visión Nativa Sin OCR) + PostgreSQL 18 + NoSQL Dinámico`);
});
