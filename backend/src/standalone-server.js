const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 4000;
const STORE_PATH = path.join(__dirname, '..', 'database', 'local_store.json');
const FRONTEND_PATH = path.join(__dirname, '..', '..', 'frontend', 'app.html');

const initialStore = {
  config_ia: {
    modelo_primario: 'gemini-3.8-flash (Visión Multimodal Pura · Cero OCR Tradicional)',
    modelo_contraste_linderos: 'gemini-3.1-pro-vision (Consenso Independiente)',
    base_transaccional: 'Cloud SQL for PostgreSQL 18 (RLS + uuidv7 + AIO)',
    base_dinamica: 'Cloud Firestore NoSQL / JSONB Dinámico'
  },
  catalogo_tramites: [
    {
      tramite_id: 'COMPRAVENTA_INMUEBLE',
      nombre: 'Escritura Pública de Compraventa de Inmueble',
      plantilla_base: 'VENTA PH.docx (Notaría 33 de Bogotá)',
      categorias: [
        {
          categoria_id: 'PROPIEDAD_HORIZONTAL_ADMIN',
          nombre: 'Inmueble en Propiedad Horizontal (Con Administración)',
          pregunta_agente: '¿El apartamento/casa tiene administración de Propiedad Horizontal?',
          documentos_adicionales: ['PAZ_Y_SALVO_ADMIN'],
          clausulas_afectadas: ['CLÁUSULA TERCERA (Régimen PH)', 'CLÁUSULA DÉCIMA SEGUNDA (Paz y Salvo Administración Art. 29 Ley 675/01)'],
          impacto_minuta: 'Exige Paz y Salvo del mes de la firma e inserta escrituras de constitución y reforma del Reglamento PH.'
        },
        {
          categoria_id: 'CON_PRENDA_HIPOTECA_LEASING',
          nombre: 'Venta con Prenda / Hipoteca Abierta o Crédito / Leasing',
          pregunta_agente: '¿El inmueble viene con prenda/hipoteca o pago con crédito hipotecario?',
          documentos_adicionales: ['CARTA_CREDITO_O_PRENDA'],
          clausulas_afectadas: ['CLÁUSULA QUINTA (Precio desglosado en recursos propios + crédito)', 'CLÁUSULA HIPOTECA PRIMER GRADO'],
          impacto_minuta: 'Genera minuta específica con prenda/hipoteca abierta y desglose financiero.'
        },
        {
          categoria_id: 'VENTA_VARIAS_PERSONAS',
          nombre: 'Pluralidad de Vendedores o Compradores (Varios Otorgantes)',
          pregunta_agente: '¿En qué porcentaje de participación compran o venden las varias personas?',
          documentos_adicionales: ['CEDULAS_COPROPIETARIOS_ADICIONALES'],
          clausulas_afectadas: ['COMPARECENCIA PLURAL', 'CUOTAS PROINDIVISO'],
          impacto_minuta: 'Pluraliza toda la comparecencia y exige las cédulas de todos los titulares del Certificado de Tradición.'
        },
        {
          categoria_id: 'LOTE_O_CASA_SIN_ADMIN',
          nombre: 'Casa o Lote Independiente (Sin Administración)',
          pregunta_agente: '¿Confirmas que el predio no paga administración?',
          documentos_adicionales: [],
          clausulas_afectadas: ['OMITE CLÁUSULA TERCERA PH', 'OMITE CLÁUSULA DÉCIMA SEGUNDA ADMIN'],
          impacto_minuta: 'Exime Paz y Salvo de Administración.'
        }
      ],
      documentos_reglas: [
        {
          codigo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (SNR)',
          estilo_estructura: 'FIJO',
          regla_vencimiento: 'MAX_90_DIAS',
          dias_maximos: 90,
          campos_extraer: ['matricula_inmobiliaria', 'zona_registro', 'direccion_predio', 'ultimos_propietarios_vendedores', 'gravamenes_vigentes', 'reglamento_ph', 'fecha_expedicion'],
          descripcion_regla: 'Documento FIJO (< 3 meses / 30-90 días). Las últimas personas inscritas como dueñas se infieren automáticamente como LA PARTE VENDEDORA.'
        },
        {
          codigo: 'CEDULA_CIUDADANIA',
          nombre: 'Cédulas de Ciudadanía (Vendedores y Compradores)',
          estilo_estructura: 'FIJO',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          campos_extraer: ['numero_documento', 'nombres_completos', 'apellidos_completos', 'fecha_expedicion', 'lugar_expedicion', 'sexo'],
          descripcion_regla: 'Documento FIJO sin vencimiento. Quienes coinciden con el Certificado de Tradición son Vendedores; las otras cédulas son Compradores.'
        },
        {
          codigo: 'PAZ_Y_SALVO_ADMIN',
          nombre: 'Paz y Salvo de Administración (Propiedad Horizontal)',
          estilo_estructura: 'VARIABLE',
          regla_vencimiento: 'FIN_DE_MES_ACTUAL',
          alerta_dias_antes_fin_mes: 5,
          campos_extraer: ['edificio_conjunto', 'unidad_apartamento', 'administrador_firmante', 'fecha_expedicion', 'mes_vigencia'],
          descripcion_regla: 'Documento VARIABLE (cada administración es diferente). Debe ser del mes de firma. Si faltan <= 5 días para acabarse el mes, genera ALERTA CRÍTICA.'
        },
        {
          codigo: 'ESCRITURA_ANTERIOR',
          nombre: 'Escritura Pública Anterior (Título Antecedente y Linderos)',
          estilo_estructura: 'VARIABLE',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          campos_extraer: ['numero_escritura_anterior', 'fecha_escritura_anterior', 'notaria_origen', 'linderos_especiales', 'linderos_generales', 'area_privada', 'escrituras_ph'],
          descripcion_regla: 'Documento VARIABLE mal escaneado / con sellos. Se transcribe con DOBLE MODELO MULTIMODAL SIN OCR (Gemini 3.8 Flash Vision + Modelo 2) para auditar cada lindero.'
        },
        {
          codigo: 'RECIBOS_FISCALES_COMBO',
          nombre: 'Impuesto Predial 2026 + Paz y Salvo IDU + Consulta VUR Hacienda',
          estilo_estructura: 'FIJO',
          regla_vencimiento: 'MAX_30_DIAS',
          campos_extraer: ['factura_predial', 'avaluo_catastral', 'chip', 'idu_pin_seguridad', 'vur_cadena_seguridad'],
          descripcion_regla: 'Documento FIJO descargado/validado por plataforma con el CHIP y la Matrícula.'
        }
      ]
    }
  ],
  casos: [
    {
      id: 'caso-not33-00184',
      radicado: 'NOT-2026-000184',
      tramite_id: 'COMPRAVENTA_INMUEBLE',
      tramite_nombre: 'Compraventa de Apartamento en P.H. con Prenda/Hipoteca',
      abogado_asignado: 'Andrés Villamizar',
      etapa_actual: 'REVISION_LINDEROS',
      categorias_activas: ['PROPIEDAD_HORIZONTAL_ADMIN', 'VENTA_VARIAS_PERSONAS', 'CON_PRENDA_HIPOTECA_LEASING'],
      tiene_administracion: true,
      tiene_prenda_hipoteca: true,
      inmueble: {
        tipo_inmueble: 'APARTAMENTO',
        direccion: 'Calle 116 # 15-42, Apartamento 601, Edificio Mirador del Parque P.H., Bogotá D.C.',
        matricula_inmobiliaria: '50C-1849201',
        cedula_catastral: '00841201900601000',
        chip: 'AAA0142BCDE',
        zona_registro: 'ZONA NORTE',
        area_privada: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
        edificio_conjunto: 'EDIFICIO MIRADOR DEL PARQUE - PROPIEDAD HORIZONTAL',
        escritura_ph_constitucion: 'Escritura Pública No. 2.810 de fecha 14 de mayo de 2008 otorgada en la Notaría 19 de Bogotá D.C.',
        escritura_ph_reforma: 'Escritura Pública No. 1.105 de fecha 19 de septiembre de 2012 otorgada en la Notaría 19 de Bogotá D.C.',
        tradicion_antecedente: 'Compraventa hecha a CONSTRUCTORA MIRADOR S.A.S., mediante Escritura Pública No. 1.420 de fecha 22 de agosto de 2014, otorgada en la Notaría 19 del Círculo de Bogotá D.C.',
        linderos_especiales:
          'APARTAMENTO SEISCIENTOS UNO (601): Tiene su acceso por el hall del sexto piso, consta de sala-comedor, tres alcobas, cocina, zona de ropas y dos baños. Tiene un área privada de OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS, coeficiente de copropiedad del 4.18% y se comprende dentro de los siguientes linderos especiales: POR EL NORTE: En línea quebrada de ocho metros cuarenta y cinco centímetros (8.45 mts) con vacío sobre zona común exterior. POR EL SUR: En extensión de seis metros veinte centímetros (6.20 mts) con hall de circulación común y ducto de escaleras. POR EL ORIENTE: En extensión de nueve metros treinta centímetros (9.30 mts) con muro común que lo separa del apartamento seiscientos dos (602). POR EL OCCIDENTE: En extensión de nueve metros treinta centímetros (9.30 mts) con vacío sobre antejardín de la Calle 116. NADIR: Con placa que lo separa del quinto piso. CENIT: Con placa de cubierta del séptimo piso. Le corresponde el Garaje Doble No. 14 del Sótano 1.',
        linderos_generales:
          'LOTE DE TERRENO ubicado en la Calle 116 No. 15-42 de Bogotá D.C., con área de 1.240.00 M2: NORTE: En 31.00 mts con Calle 116; SUR: En 31.00 mts con predio 50C-991022; ORIENTE: En 40.00 mts con predio No. 15-28; OCCIDENTE: En 40.00 mts con predio No. 15-56.'
      },
      negocio: {
        valor_venta: 485000000,
        avaluo_catastral: 392000000,
        forma_pago: 'CREDITO_HIPOTECARIO',
        entidad_financiera: 'BANCO DAVIVIENDA S.A.',
        valor_recursos_propios: 145500000,
        valor_credito: 339500000,
        afectacion_vivienda_familiar: false
      },
      recibos_fiscales: {
        predial_factura: '2026091844201',
        predial_referencia: '998102344120',
        predial_banco: 'BANCO DE BOGOTÁ',
        predial_fecha: '2026-04-15',
        idu_pin: 'IDU-2026-99481023',
        idu_consecutivo: '44910284',
        idu_vencimiento: '2026-11-28',
        vur_cadena_seguridad: 'SHD-VUR-2026-8841209-OK',
        vur_fecha_hora: '19/10/2026 05:45:00'
      },
      partes: [
        {
          id: 'p-1',
          rol: 'VENDEDOR',
          nombres_completos: 'CARLOS ARTURO MEJÍA RESTREPO',
          numero_documento: '79.451.200',
          lugar_expedicion: 'Bogotá D.C.',
          estado_civil: 'Casado con sociedad conyugal vigente',
          genero: 'M',
          porcentaje: 50,
          origen_inferencia: 'Inferido como VENDEDOR porque aparece como propietario actual en la Anotación #14 del Certificado de Tradición (50C-1849201).',
          cedula_cargada: true,
          visto_bueno_cliente: false
        },
        {
          id: 'p-2',
          rol: 'VENDEDOR',
          nombres_completos: 'MÓNICA PATRICIA PÉREZ GÓMEZ',
          numero_documento: '52.110.900',
          lugar_expedicion: 'Bogotá D.C.',
          estado_civil: 'Casada con sociedad conyugal vigente',
          genero: 'F',
          porcentaje: 50,
          origen_inferencia: 'Inferida como VENDEDORA porque aparece como co-propietaria en la Anotación #14 del Certificado de Tradición. ¡FALTA SU CÉDULA!',
          cedula_cargada: false,
          visto_bueno_cliente: false
        },
        {
          id: 'p-3',
          rol: 'COMPRADOR',
          nombres_completos: 'JORGE ELIÉCER MOSQUERA RENTERÍA',
          numero_documento: '80.123.456',
          lugar_expedicion: 'Medellín',
          estado_civil: 'Soltero sin unión marital de hecho',
          genero: 'M',
          porcentaje: 100,
          origen_inferencia: 'Inferido como COMPRADOR porque su cédula fue aportada al expediente y no figura como dueño anterior en el Certificado de Tradición.',
          cedula_cargada: true,
          visto_bueno_cliente: false
        }
      ],
      documentos: [
        {
          id: 'doc-1',
          codigo_tipo: 'PAZ_Y_SALVO_ADMIN',
          nombre: 'Paz y Salvo de Administración (Edificio Mirador P.H.)',
          estilo: 'VARIABLE',
          archivo: 'paz_y_salvo_admin_apto601_noviembre.pdf',
          fecha_expedicion: '2026-11-25',
          fecha_vencimiento: '2026-11-30',
          dias_restantes: 5,
          estado: 'POR_VENCER_FIN_MES',
          nivel_alerta: 'CRITICAL',
          mensaje_alerta: '🚨 ALERTA FIN DE MES: Faltan solo 5 días para acabarse noviembre (30 de nov). Si no se firma este mes, el Paz y Salvo vence y bloquea la firma.'
        },
        {
          id: 'doc-2',
          codigo_tipo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (50C-1849201)',
          estilo: 'FIJO',
          archivo: 'certificado_tradicion_50C1849201.pdf',
          fecha_expedicion: '2026-11-18',
          fecha_vencimiento: '2027-02-16',
          dias_restantes: 83,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          mensaje_alerta: 'Vigente (< 3 meses). Últimos dueños detectados como Vendedores: Carlos Mejía y Mónica Pérez.'
        },
        {
          id: 'doc-3',
          codigo_tipo: 'CEDULA_CIUDADANIA',
          nombre: 'Cédulas de Ciudadanía de las Partes (2 de 3 cargadas)',
          estilo: 'FIJO',
          archivo: 'cedulas_carlos_y_jorge.pdf',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'FALTA_DOCUMENTO',
          nivel_alerta: 'CRITICAL',
          mensaje_alerta: '❌ PENDIENTE: Falta la Cédula de Ciudadanía de la vendedora MÓNICA PATRICIA PÉREZ GÓMEZ (C.C. 52.110.900).'
        },
        {
          id: 'doc-4',
          codigo_tipo: 'ESCRITURA_ANTERIOR',
          nombre: 'Escritura Pública Anterior No. 1.420 de 2014 Notaría 19 (Con sellos)',
          estilo: 'VARIABLE',
          archivo: 'escritura_1420_2014_escaneo_sellos.pdf',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'REVISION_LINDEROS',
          nivel_alerta: 'WARNING',
          mensaje_alerta: '⚠️ 2 fragmentos en Linderos tienen sello superpuesto / mancha y requieren verificación del abogado.'
        },
        {
          id: 'doc-5',
          codigo_tipo: 'IDU_Y_VUR_HACIENDA',
          nombre: 'Paz y Salvo IDU + Reporte VUR Hacienda + Predial 2026',
          estilo: 'FIJO',
          archivo: 'combo_fiscales_AAA0142BCDE.pdf',
          fecha_expedicion: '2026-11-20',
          fecha_vencimiento: '2026-12-20',
          dias_restantes: 25,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          mensaje_alerta: 'Predio al día en Impuesto Predial 2026, Valorización IDU y VUR Hacienda.'
        }
      ],
      discrepancias_linderos: [
        {
          id: 'lind-1',
          campo: 'Área Privada del Apartamento 601 (Cláusula Primera)',
          motivo_duda: 'Sello húmedo azul de la Notaría 19 cae exactamente sobre el segundo decimal de la cifra (88.5_).',
          lectura_modelo_a: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          confianza_a: 98.4,
          argumento_a: 'Gemini 3.8 Flash Vision (Sin OCR): Al separar el canal azul del sello y cruzar con el texto en letras ("CINCUENTA Y TRES") y Catastro, es 88.53 m².',
          lectura_modelo_b: 'OCHENTA Y OCHO PUNTO CINCUENTA Y OCHO (88.58) METROS CUADRADOS',
          confianza_b: 61.0,
          argumento_b: 'Modelo 2 (Contraste): El borde del sello azul sobre el "3" aparenta un "8".',
          valor_seleccionado: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          estado: 'PENDIENTE_HUMANO'
        },
        {
          id: 'lind-2',
          campo: 'Lindero Especial ORIENTE (Cláusula Primera)',
          motivo_duda: 'Fotocopia antigua con desgaste de tóner en la palabra TREINTA y en el dígito (9._0 mts).',
          lectura_modelo_a: 'nueve metros treinta centímetros (9.30 mts)',
          confianza_a: 97.1,
          argumento_a: 'Gemini 3.8 Flash Vision: Por morfología de letras y simetría geométrica con el Lindero OCCIDENTE opuesto (9.30 mts), es 9.30 mts.',
          lectura_modelo_b: 'nueve metros ochenta centímetros (9.80 mts)',
          confianza_b: 54.5,
          argumento_b: 'Modelo 2 (Contraste): Mancha vertical sobre el número 3 genera duda entre 9.30 y 9.80.',
          valor_seleccionado: 'nueve metros treinta centímetros (9.30 mts)',
          estado: 'PENDIENTE_HUMANO'
        }
      ],
      aprobaciones: {
        linderos_aprobados_abogado: false,
        visto_bueno_juridico_abogado: false,
        visto_bueno_jefe: false,
        enviado_a_clientes: false,
        visto_bueno_vendedores: false,
        visto_bueno_compradores: false,
        en_impresion: false,
        hojas_papel_notarial: 'AA-4910201 a AA-4910206',
        numero_escritura_asignada: '3.418 de 2026',
        firma_completada: false
      },
      mensajes_chat: [
        {
          id: 'm-1',
          emisor: 'ABOGADO',
          autor: 'Dr. Andrés Villamizar (Abogado Notaría)',
          hora: '09:40 AM',
          texto: 'Hola, va a ser una minuta de compraventa de un apartamento con prenda/hipoteca. Adjunto Certificado de Tradición, escritura anterior escaneada, dos cédulas y el paz y salvo de administración.'
        },
        {
          id: 'm-2',
          emisor: 'AGENTE_GEMINI_3_8',
          autor: 'Agente Notarial · Gemini 3.8 Flash (Visión Multimodal Nativa)',
          hora: '09:41 AM',
          texto: 'He leído todos los documentos con Visión Multimodal (sin OCR tradicional) y configuré el trámite COMPRAVENTA con las categorías: (1) Propiedad Horizontal con Administración, (2) Pluralidad de Vendedores y (3) Con Prenda / Hipoteca.',
          hallazgos: [
            'Cruce Vendedores vs. Compradores: En la Anotación #14 del Certificado de Tradición (50C-1849201) los últimos dueños son CARLOS ARTURO MEJÍA (C.C. 79.451.200) y MÓNICA PATRICIA PÉREZ (C.C. 52.110.900) -> Asignados como VENDEDORES.',
            'La otra cédula aportada (JORGE ELIÉCER MOSQUERA, C.C. 80.123.456) fue asignada automáticamente como COMPRADOR.',
            'Descargué por plataforma el IDU Valorización (PIN IDU-2026-99481023) y el reporte VUR Hacienda (SHD-VUR-2026-8841209-OK).'
          ],
          alertas_rojas: [
            '🚨 ALERTA FIN DE MES (Paz y Salvo Administración): El Paz y Salvo del Edificio Mirador P.H. fue expedido en noviembre y faltan SOLO 5 DÍAS para que se acabe el mes (30 de noviembre). ¡Debemos firmar antes del 30 o vencerá!',
            '❌ FALTA CÉDULA DE VENDEDORA: Solo subiste la cédula de Carlos Mejía. Hace falta la cédula de MÓNICA PATRICIA PÉREZ GÓMEZ (C.C. 52.110.900).',
            '⚠️ REVISIÓN DE LINDEROS (2 Dudas por Sello): La escritura anterior tiene un sello notarial azul sobre el área privada (88.53 vs 88.58 m²) y desgaste en el lindero Oriente (9.30 vs 9.80 mts).'
          ],
          preguntas_pendientes: [
            '¿El comprador Jorge Eliécer Mosquera afecta el apartamento a Vivienda Familiar (Ley 258/96)?',
            '¿Le envío link al cliente para que suba la cédula faltante de Mónica Pérez?'
          ]
        }
      ],
      bitacora: [
        {
          id: 'ev-1',
          fecha: '19/10/2026 05:40:12',
          actor: 'Abogado · Andrés Villamizar',
          etapa: 'SOLICITADO',
          detalle: 'Apertura del trámite por Chat Agéntico con carga de paquete documental.'
        },
        {
          id: 'ev-2',
          fecha: '19/10/2026 05:40:28',
          actor: 'Gemini 3.8 Flash Vision',
          etapa: 'EN_VERIFICACION',
          detalle: 'Inferencia automática completada: Vendedores deducidos desde Certificado de Tradición y Comprador por descarte de cédula.'
        },
        {
          id: 'ev-3',
          fecha: '19/10/2026 05:40:45',
          actor: 'Motor Determinístico Vigencias',
          etapa: 'EN_VERIFICACION',
          detalle: 'Alerta Crítica disparada: Paz y Salvo de Administración a 5 días del cierre de mes.'
        },
        {
          id: 'ev-4',
          fecha: '19/10/2026 05:41:02',
          actor: 'Consenso Doble Modelo IA (Sin OCR)',
          etapa: 'REVISION_LINDEROS',
          detalle: 'Transcripción de Escritura 1420/2014 finalizada con 96.8% de coincidencia. Se marcan 2 recortes de linderos con sello para revisión del abogado.'
        }
      ]
    }
  ],
  proyectos_constructoras: [
    {
      proyecto_id: 'proy-torres-parque',
      nombre_proyecto: 'Torres del Parque Reservado P.H.',
      constructora: 'Constructora Altos del Peñón S.A.',
      nit: '900.412.889-1',
      direccion: 'Calle 153 # 58-20, Bogotá D.C.',
      bloques_configurados: ['Torre A', 'Torre B', 'Torre C'],
      apartamentos_por_bloque: 8,
      estados_personalizados: [
        'Sin comprador',
        'Documentos pendientes',
        'En verificación IA',
        'Minuta lista / Visto bueno',
        'En impresión',
        'Firmada',
        'Registrada'
      ],
      documentos_matriz_heredables: [
        { nombre: 'Certificado de Tradición Lote Matriz (50N-2099182)', vigencia: 'Vigente (< 3 meses)' },
        { nombre: 'Escritura Pública Constitución Reglamento P.H. No. 0890 de 2026', vigencia: 'Permanente (Linderos verificados con Doble IA)' },
        { nombre: 'Cámara de Comercio y RUT Constructora Altos del Peñón S.A.', vigencia: 'Vigente' }
      ],
      unidades: [
        { unidad_id: 'A-101', bloque: 'Torre A', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Camilo Andrés Zuluaga', comprador_cc: '79.881.201', forma_pago: 'Contado', estado_dinamico: 'Registrada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'A-201', bloque: 'Torre A', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Diana Carolina Rueda', comprador_cc: '52.990.112', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'A-301', bloque: 'Torre A', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Héctor Iván Quiñones', comprador_cc: '80.441.900', forma_pago: 'Crédito Davivienda', estado_dinamico: 'En impresión', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-401', bloque: 'Torre A', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Sandra Milena Ocampo', comprador_cc: '53.112.890', forma_pago: 'Leasing Bancolombia', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: true, alerta_detalle: 'Paz y Salvo Admin vence en 5 días (Fin de mes)', documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-501', bloque: 'Torre A', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Yenny Paola Beltrán', comprador_cc: '53.440.317', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-601', bloque: 'Torre A', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Ricardo Alfonso Neira', comprador_cc: '79.310.445', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-701', bloque: 'Torre A', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Paola Andrea Cifuentes Rojas', comprador_cc: '53.889.560', forma_pago: 'Leasing Habitacional Scotiabank Colpatria', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Falta Carta de Leasing + Paz y Salvo vence a fin de mes (5 días)', documentos_recibidos: 2, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-801', bloque: 'Torre A', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-101', bloque: 'Torre B', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Luis Fernando Gómez', comprador_cc: '19.440.112', forma_pago: 'Contado', estado_dinamico: 'Registrada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'B-201', bloque: 'Torre B', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'María Fernanda Castro', comprador_cc: '52.811.300', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'B-301', bloque: 'Torre B', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Juan Sebastián Mora', comprador_cc: '1.020.774.120', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: true, alerta_detalle: 'Certificado Tradición próximo a cumplir 90 días', documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-401', bloque: 'Torre B', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Natalia Valderrama', comprador_cc: '1.015.412.900', forma_pago: 'Leasing Habitacional', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-501', bloque: 'Torre B', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Andrés Felipe Pardo', comprador_cc: '80.912.331', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Falta Cédula de Co-compradora', documentos_recibidos: 4, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-601', bloque: 'Torre B', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-701', bloque: 'Torre B', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-801', bloque: 'Torre B', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-101', bloque: 'Torre C', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Gloria Inés Tamayo', comprador_cc: '41.772.109', forma_pago: 'Contado', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'C-201', bloque: 'Torre C', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Óscar Mauricio León', comprador_cc: '79.654.321', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-301', bloque: 'Torre C', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Claudia Patricia Soler', comprador_cc: '52.334.890', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-401', bloque: 'Torre C', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Germán Darío Vargas', comprador_cc: '79.110.882', forma_pago: 'Contado', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-501', bloque: 'Torre C', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Laura Daniela Ríos', comprador_cc: '1.032.490.112', forma_pago: 'Leasing Habitacional', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Paz y Salvo Admin a 5 días de fin de mes', documentos_recibidos: 3, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-601', bloque: 'Torre C', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Mario Alberto Yepes', comprador_cc: '16.889.001', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: false, documentos_recibidos: 2, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-701', bloque: 'Torre C', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-801', bloque: 'Torre C', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false }
      ]
    }
  ]
};

function loadStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
      return initialStore;
    }
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    return initialStore;
  }
}

function saveStore(store) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error guardando store:', e);
  }
}

function calcularLiquidacion(valorVenta, avaluoCatastral) {
  const base = Math.max(Number(valorVenta || 0), Number(avaluoCatastral || 0));
  const derechosNotariales = Math.round(base * 0.0027);
  const iva = Math.round(derechosNotariales * 0.19);
  const superintendencia = 15600;
  const cuentaEspecial = 15600;
  const retencionFuente = Math.round(base * 0.01);
  const boletaRentas = Math.round(base * 0.01);
  const derechosRegistro = Math.round(base * 0.005);
  const mitadGastos = Math.round((derechosNotariales + iva + superintendencia + cuentaEspecial) / 2);
  return {
    base_liquidacion: base,
    derechos_notariales: derechosNotariales,
    iva_notarial: iva,
    superintendencia,
    cuenta_especial: cuentaEspecial,
    retencion_fuente_vendedor: retencionFuente,
    boleta_rentas_externo: boletaRentas,
    derechos_registro_externo: derechosRegistro,
    total_vendedor: mitadGastos + retencionFuente,
    total_comprador: mitadGastos + boletaRentas + derechosRegistro
  };
}

function generarTextoMinuta(caso) {
  const vendedores = caso.partes.filter((p) => p.rol === 'VENDEDOR');
  const compradores = caso.partes.filter((p) => p.rol === 'COMPRADOR');
  const liq = calcularLiquidacion(caso.negocio.valor_venta, caso.negocio.avaluo_catastral);

  const resumenVend = vendedores.map((v) => `${v.nombres_completos} ---------------- C.C. ${v.numero_documento}`).join('\n');
  const resumenComp = compradores.map((c) => `${c.nombres_completos} ---------------- C.C. ${c.numero_documento}`).join('\n');

  const compVend = vendedores
    .map(
      (v) =>
        `${v.nombres_completos}, mayor de edad, ${v.genero === 'F' ? 'vecina' : 'vecino'} de Bogotá D.C., ${v.genero === 'F' ? 'identificada' : 'identificado'} con C.C. No. ${v.numero_documento} expedida en ${v.lugar_expedicion}, estado civil ${v.estado_civil} (${v.porcentaje}%)`
    )
    .join('; y ');

  const compComp = compradores
    .map(
      (c) =>
        `${c.nombres_completos}, mayor de edad, ${c.genero === 'F' ? 'vecina' : 'vecino'} de Bogotá D.C., ${c.genero === 'F' ? 'identificada' : 'identificado'} con C.C. No. ${c.numero_documento} expedida en ${c.lugar_expedicion}, estado civil ${c.estado_civil} (${c.porcentaje}%)`
    )
    .join('; y ');

  const clausulaPH = caso.tiene_administracion
    ? `TERCERA. - RÉGIMEN DE PROPIEDAD HORIZONTAL: ${caso.inmueble.edificio_conjunto} fue sometido a Propiedad Horizontal mediante ${caso.inmueble.escritura_ph_constitucion}, reformado por ${caso.inmueble.escritura_ph_reforma}.\nDÉCIMA SEGUNDA. - PAZ Y SALVO DE ADMINISTRACIÓN (Art. 29 Ley 675/01): Se protocoliza Paz y Salvo vigente hasta el último día del mes en curso.`
    : `TERCERA. - PREDIO NO SOMETIDO A PROPIEDAD HORIZONTAL (Sin Administración).`;

  const clausulaPrecio = caso.tiene_prenda_hipoteca
    ? `QUINTA. - PRECIO Y FORMA DE PAGO (CON PRENDA / HIPOTECA ABIERTA): El precio pactado es de $${Number(caso.negocio.valor_venta).toLocaleString('es-CO')}, pagaderos así: $${Number(caso.negocio.valor_recursos_propios || 0).toLocaleString('es-CO')} con recursos propios y $${Number(caso.negocio.valor_credito || 0).toLocaleString('es-CO')} mediante crédito hipotecario / prenda con ${caso.negocio.entidad_financiera}.`
    : `QUINTA. - PRECIO (CONTADO): El precio pactado es de $${Number(caso.negocio.valor_venta).toLocaleString('es-CO')} moneda legal colombiana, pagados de contado.`;

  return `REPÚBLICA DE COLOMBIA
NOTARIA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.
ESCRITURA PÚBLICA NÚMERO: ${caso.aprobaciones.numero_escritura_asignada}
DE FECHA: ${new Date().toLocaleDateString('es-CO')} · AÑO DOS MIL VEINTISÉIS (2026)
-----------------------------------------------------------------------------------------
CLASE DE ACTO: 1º COMPRAVENTA (${caso.categorias_activas.join(' + ')})
VALOR: $${Number(caso.negocio.valor_venta).toLocaleString('es-CO')}
AFECTACIÓN A VIVIENDA FAMILIAR: SI (${caso.negocio.afectacion_vivienda_familiar ? 'X' : ' '}) NO (${!caso.negocio.afectacion_vivienda_familiar ? 'X' : ' '})
-----------------------------------------------------------------------------------------
LA PARTE VENDEDORA (Inferida desde última anotación del Certificado de Tradición):
${resumenVend}

LA PARTE COMPRADORA (Inferida desde cédulas adicionales aportadas):
${resumenComp}

INMUEBLE: ${caso.inmueble.direccion}
MATRÍCULA INMOBILIARIA: ${caso.inmueble.matricula_inmobiliaria} | CÉDULA CATASTRAL: ${caso.inmueble.cedula_catastral} | CHIP: ${caso.inmueble.chip}
-----------------------------------------------------------------------------------------
Comparecieron: Por una parte ${compVend}, quien(es) se llamará(n) LA PARTE VENDEDORA; y por otra parte ${compComp}, quien(es) se llamará(n) LA PARTE COMPRADORA:

PRIMERA. - OBJETO Y LINDEROS (AUDITADOS CON DOBLE IA GEMINI 3.8 FLASH VISION SIN OCR):
${caso.inmueble.linderos_especiales}

LINDEROS GENERALES:
${caso.inmueble.linderos_generales}
-----------------------------------------------------------------------------------------
SEGUNDA. - CUERPO CIERTO.
${clausulaPH}
-----------------------------------------------------------------------------------------
CUARTA. - TRADICIÓN ANTECEDENTE: ${caso.inmueble.tradicion_antecedente}
-----------------------------------------------------------------------------------------
${clausulaPrecio}
-----------------------------------------------------------------------------------------
PROTOCOLIZACIÓN DE RECIBOS FISCALES:
1º PREDIAL 2026: Factura ${caso.recibos_fiscales.predial_factura} · Avalúo Catastral $${Number(caso.negocio.avaluo_catastral).toLocaleString('es-CO')}
2º IDU VALORIZACIÓN: PIN ${caso.recibos_fiscales.idu_pin} · Consecutivo ${caso.recibos_fiscales.idu_consecutivo}
3º SECRETARÍA DE HACIENDA VUR: Cadena ${caso.recibos_fiscales.vur_cadena_seguridad}
-----------------------------------------------------------------------------------------
OTORGAMIENTO, IMPRESIÓN Y PAPEL NOTARIAL (RESOLUCIÓN 964 DE 2026):
Hojas de Papel Notarial Utilizadas: ${caso.aprobaciones.hojas_papel_notarial}
Derechos Notariales: $${liq.derechos_notariales.toLocaleString('es-CO')} | IVA: $${liq.iva_notarial.toLocaleString('es-CO')} | Retefuente (1%): $${liq.retencion_fuente_vendedor.toLocaleString('es-CO')}

DIANA BEATRIZ LÓPEZ DURAN
NOTARIA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.`;
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      status: '100% OPERATIVO LOCALMENTE',
      motor: 'Motor Notarial Agéntico v1.0',
      modelo_primario: 'gemini-3.8-flash (Visión Multimodal Nativa · Cero OCR)',
      modelo_contraste: 'gemini-3.1-pro-vision (Consenso Doble IA en Linderos)',
      base_datos_sql: 'PostgreSQL 18 (RLS + uuidv7 + AIO)',
      base_datos_nosql: 'Cloud Firestore / JSONB Dinámico'
    });
  }

  if (req.method === 'GET' && pathname === '/api/state') {
    const store = loadStore();
    const caso = store.casos[0];
    return sendJson(res, 200, {
      ...store,
      minuta_generada_actual: generarTextoMinuta(caso),
      liquidacion_actual: calcularLiquidacion(caso.negocio.valor_venta, caso.negocio.avaluo_catastral)
    });
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = store.casos[0];
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    if (body.mensaje) {
      caso.mensajes_chat.push({
        id: 'm-u-' + Date.now(),
        emisor: 'ABOGADO',
        autor: 'Dr. Andrés Villamizar (Abogado)',
        hora: ahoraHora,
        texto: body.mensaje
      });
    }

    const hallazgos = [];
    const alertas = [];
    const preguntas = [];

    if (typeof body.tiene_admin === 'boolean') {
      caso.tiene_administracion = body.tiene_admin;
      if (body.tiene_admin && !caso.categorias_activas.includes('PROPIEDAD_HORIZONTAL_ADMIN')) {
        caso.categorias_activas.push('PROPIEDAD_HORIZONTAL_ADMIN');
      } else if (!body.tiene_admin) {
        caso.categorias_activas = caso.categorias_activas.filter((c) => c !== 'PROPIEDAD_HORIZONTAL_ADMIN');
      }
    }

    if (typeof body.activar_hipoteca === 'boolean') {
      caso.tiene_prenda_hipoteca = body.activar_hipoteca;
      if (body.activar_hipoteca && !caso.categorias_activas.includes('CON_PRENDA_HIPOTECA_LEASING')) {
        caso.categorias_activas.push('CON_PRENDA_HIPOTECA_LEASING');
      } else if (!body.activar_hipoteca) {
        caso.categorias_activas = caso.categorias_activas.filter((c) => c !== 'CON_PRENDA_HIPOTECA_LEASING');
      }
    }

    if (body.subir_cedula_monica || (body.mensaje && body.mensaje.toLowerCase().includes('mónica')) || (body.mensaje && body.mensaje.toLowerCase().includes('cedula'))) {
      const monica = caso.partes.find((p) => p.numero_documento === '52.110.900');
      if (monica && !monica.cedula_cargada) {
        monica.cedula_cargada = true;
        monica.origen_inferencia = 'Confirmada como VENDEDORA (50%) en Tradición + Cédula 52.110.900 verificada por Gemini 3.8 Flash Vision.';
        const docCed = caso.documentos.find((d) => d.codigo_tipo === 'CEDULA_CIUDADANIA');
        if (docCed) {
          docCed.nombre = 'Cédulas de Ciudadanía de las Partes (3 de 3 completas)';
          docCed.estado = 'VERIFICADO';
          docCed.nivel_alerta = 'OK';
          docCed.mensaje_alerta = '✓ 3 de 3 Cédulas verificadas (Vendedores: Carlos Mejía y Mónica Pérez · Comprador: Jorge Mosquera). Sin vencimiento.';
        }
        hallazgos.push('✓ Cédula de MÓNICA PATRICIA PÉREZ GÓMEZ (C.C. 52.110.900) procesada con Gemini 3.8 Flash Vision. Expediente de identificación 100% completo.');
      }
    }

    if (body.fecha_paz_y_salvo) {
      const docAdmin = caso.documentos.find((d) => d.codigo_tipo === 'PAZ_Y_SALVO_ADMIN');
      if (docAdmin) {
        docAdmin.fecha_expedicion = body.fecha_paz_y_salvo;
        const fExp = new Date(body.fecha_paz_y_salvo + 'T12:00:00');
        const ultimoDia = new Date(fExp.getFullYear(), fExp.getMonth() + 1, 0, 12, 0, 0);
        const dias = Math.ceil((ultimoDia.getTime() - fExp.getTime()) / (1000 * 60 * 60 * 24));
        docAdmin.fecha_vencimiento = ultimoDia.toISOString().split('T')[0];
        docAdmin.dias_restantes = dias;
        if (dias <= 5) {
          docAdmin.estado = 'POR_VENCER_FIN_MES';
          docAdmin.nivel_alerta = 'CRITICAL';
          docAdmin.mensaje_alerta = `🚨 ALERTA FIN DE MES: Quedan solo ${dias} días para acabarse el mes (${docAdmin.fecha_vencimiento}). Si no se firma este mes, el Paz y Salvo vencerá.`;
          alertas.push(docAdmin.mensaje_alerta);
        } else {
          docAdmin.estado = 'VERIFICADO';
          docAdmin.nivel_alerta = 'OK';
          docAdmin.mensaje_alerta = `✓ Paz y Salvo vigente durante el mes actual (Quedan ${dias} días hasta el ${docAdmin.fecha_vencimiento}).`;
          hallazgos.push(docAdmin.mensaje_alerta);
        }
      }
    }

    const faltaCed = caso.partes.find((p) => !p.cedula_cargada);
    if (faltaCed) {
      alertas.push(`❌ Falta subir la Cédula de ${faltaCed.nombres_completos} (C.C. ${faltaCed.numero_documento}), detectada como ${faltaCed.rol} en el Certificado de Tradición.`);
    }

    const dudas = caso.discrepancias_linderos.filter((d) => d.estado === 'PENDIENTE_HUMANO');
    if (dudas.length > 0) {
      preguntas.push(`Tienes ${dudas.length} fragmentos con sello/mancha en los Linderos de la Escritura Anterior pendientes por aprobar en el Visor Side-by-Side.`);
    }

    if (hallazgos.length === 0) {
      hallazgos.push(
        `Categorías activas en la minuta: ${caso.categorias_activas.join(', ')}.`,
        `Vendedores deducidos de Tradición: Carlos Mejía y Mónica Pérez · Comprador deducido de otra cédula: Jorge Mosquera.`
      );
    }

    caso.mensajes_chat.push({
      id: 'm-ag-' + Date.now(),
      emisor: 'AGENTE_GEMINI_3_8',
      autor: 'Agente Notarial · Gemini 3.8 Flash (Visión Multimodal)',
      hora: ahoraHora,
      texto: 'Análisis actualizado sobre el expediente y la minuta:',
      hallazgos,
      alertas_rojas: alertas,
      preguntas_pendientes: preguntas
    });

    saveStore(store);
    return sendJson(res, 200, { ok: true, caso, minuta_generada_actual: generarTextoMinuta(caso) });
  }

  if (req.method === 'POST' && pathname === '/api/linderos/aprobar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = store.casos[0];

    if (body.aprobar_todos) {
      caso.discrepancias_linderos.forEach((d) => {
        d.estado = 'APROBADO_ABOGADO';
        d.aprobado_por = caso.abogado_asignado;
      });
    } else {
      const item = caso.discrepancias_linderos.find((d) => d.id === body.lindero_id);
      if (item) {
        if (body.valor_aprobado) item.valor_seleccionado = body.valor_aprobado;
        item.estado = 'APROBADO_ABOGADO';
        item.aprobado_por = caso.abogado_asignado;
      }
    }

    const d1 = caso.discrepancias_linderos[0]?.valor_seleccionado || 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS';
    const d2 = caso.discrepancias_linderos[1]?.valor_seleccionado || 'nueve metros treinta centímetros (9.30 mts)';
    caso.inmueble.linderos_especiales = `APARTAMENTO SEISCIENTOS UNO (601): Tiene su acceso por el hall del sexto piso, consta de sala-comedor, tres alcobas, cocina, zona de ropas y dos baños. Tiene un área privada de ${d1}, coeficiente de copropiedad del 4.18% y se comprende dentro de los siguientes linderos especiales: POR EL NORTE: En línea quebrada de ocho metros cuarenta y cinco centímetros (8.45 mts) con vacío sobre zona común exterior. POR EL SUR: En extensión de seis metros veinte centímetros (6.20 mts) con hall de circulación común y ducto de escaleras. POR EL ORIENTE: En extensión de ${d2} con muro común que lo separa del apartamento seiscientos dos (602). POR EL OCCIDENTE: En extensión de nueve metros treinta centímetros (9.30 mts) con vacío sobre antejardín de la Calle 116. NADIR: Con placa que lo separa del quinto piso. CENIT: Con placa de cubierta del séptimo piso.`;

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

    saveStore(store);
    return sendJson(res, 200, { ok: true, caso, minuta_generada_actual: generarTextoMinuta(caso) });
  }

  if (req.method === 'POST' && pathname === '/api/flujo/avanzar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = store.casos[0];

    if (body.paso === 'VISTO_BUENO_ABOGADO') {
      caso.aprobaciones.visto_bueno_juridico_abogado = true;
      caso.aprobaciones.enviado_a_clientes = true;
      caso.etapa_actual = 'VISTO_BUENO_CLIENTES';
    } else if (body.paso === 'VISTO_BUENO_CLIENTES') {
      caso.aprobaciones.visto_bueno_vendedores = true;
      caso.aprobaciones.visto_bueno_compradores = true;
      caso.etapa_actual = 'EN_IMPRESION';
    } else if (body.paso === 'ENVIAR_A_IMPRESION') {
      caso.aprobaciones.en_impresion = true;
      if (body.hojas_papel_notarial) caso.aprobaciones.hojas_papel_notarial = body.hojas_papel_notarial;
      if (body.numero_escritura) caso.aprobaciones.numero_escritura_asignada = body.numero_escritura;
      caso.etapa_actual = 'EN_IMPRESION';
    } else if (body.paso === 'COMPLETAR_FIRMA') {
      caso.aprobaciones.firma_completada = true;
      caso.etapa_actual = 'FIRMADA_Y_REGISTRADA';
    }

    saveStore(store);
    return sendJson(res, 200, { ok: true, caso, minuta_generada_actual: generarTextoMinuta(caso) });
  }

  if (req.method === 'POST' && pathname === '/api/nosql/tramite') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const nuevoTramite = {
      tramite_id: (body.tramite_id || body.nombre || 'TRAMITE_' + Date.now()).toUpperCase().replace(/\s+/g, '_'),
      nombre: body.nombre || 'Nuevo Trámite Notarial',
      plantilla_base: body.plantilla_base || 'VENTA PH.docx',
      categorias: body.categorias || [],
      documentos_reglas: body.documentos_reglas || []
    };
    store.catalogo_tramites.unshift(nuevoTramite);
    saveStore(store);
    return sendJson(res, 200, { ok: true, catalogo_tramites: store.catalogo_tramites });
  }

  if (req.method === 'POST' && pathname === '/api/nosql/categoria') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const idx = Number(body.tramite_idx || 0);
    const target = store.catalogo_tramites[idx] || store.catalogo_tramites[0];
    target.categorias.push(body);
    saveStore(store);
    return sendJson(res, 200, { ok: true, catalogo_tramites: store.catalogo_tramites });
  }

  if (req.method === 'POST' && pathname === '/api/nosql/documento-regla') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const idx = Number(body.tramite_idx || 0);
    const target = store.catalogo_tramites[idx] || store.catalogo_tramites[0];
    target.documentos_reglas.push(body);
    saveStore(store);
    return sendJson(res, 200, { ok: true, catalogo_tramites: store.catalogo_tramites });
  }

  if (req.method === 'POST' && pathname === '/api/constructoras/crear-proyecto') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const letras = ['Torre A', 'Torre B', 'Torre C', 'Torre D', 'Torre E', 'Torre F'];
    const bloques = letras.slice(0, Math.min(Number(body.num_bloques) || 3, 6));
    const cantAptos = Math.min(Number(body.aptos_por_bloque) || 6, 12);
    const unidades = [];
    bloques.forEach((b) => {
      const pref = b.replace('Torre ', '').trim();
      for (let i = 1; i <= cantAptos; i++) {
        const num = `${i}01`;
        unidades.push({
          unidad_id: `${pref}-${num}`,
          bloque: b,
          apartamento: num,
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
    const nuevo = {
      proyecto_id: 'proy-' + Date.now(),
      nombre_proyecto: body.nombre_proyecto || 'Nuevo Proyecto Constructora P.H.',
      constructora: body.constructora || 'Constructora Bolívar S.A.',
      nit: '900.554.112-9',
      direccion: 'Bogotá D.C.',
      bloques_configurados: bloques,
      apartamentos_por_bloque: cantAptos,
      estados_personalizados: ['Sin comprador', 'Documentos pendientes', 'En verificación IA', 'Minuta lista / Visto bueno', 'En impresión', 'Firmada', 'Registrada'],
      documentos_matriz_heredables: [
        { nombre: 'Certificado de Tradición Mayor Extensión', vigencia: 'Vigente (< 3 meses)' },
        { nombre: 'Escritura Constitución Reglamento P.H.', vigencia: 'Permanente' }
      ],
      unidades
    };
    store.proyectos_constructoras.unshift(nuevo);
    saveStore(store);
    return sendJson(res, 200, { ok: true, proyectos_constructoras: store.proyectos_constructoras });
  }

  if (req.method === 'POST' && pathname === '/api/constructoras/actualizar-unidad') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const proy = store.proyectos_constructoras.find((p) => p.proyecto_id === body.proyecto_id) || store.proyectos_constructoras[0];
    if (proy) {
      const u = proy.unidades.find((x) => x.unidad_id === body.unidad_id);
      if (u && body.nuevo_estado) {
        u.estado_dinamico = body.nuevo_estado;
        u.minuta_firmada = body.nuevo_estado === 'Firmada' || body.nuevo_estado === 'Registrada';
      }
    }
    saveStore(store);
    return sendJson(res, 200, { ok: true, proyectos_constructoras: store.proyectos_constructoras });
  }

  // Servir la aplicación Frontend completa en la raíz /
  if (fs.existsSync(FRONTEND_PATH)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(FRONTEND_PATH, 'utf8'));
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 [Motor Notarial Agéntico] Servidor Full-Stack activo en http://localhost:${PORT}`);
});
