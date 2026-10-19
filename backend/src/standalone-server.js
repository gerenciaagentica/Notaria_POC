const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 4000;
const STORE_PATH = path.join(__dirname, '..', 'database', 'local_store.json');
const FRONTEND_PATH = path.join(__dirname, '..', '..', 'frontend', 'app.html');

const initialStore = {
  catalogo_tramites: [
    {
      tramite_id: 'COMPRAVENTA_INMUEBLE',
      nombre: 'Escritura Pública de Compraventa de Inmueble',
      plantilla_base: 'VENTA PH.docx (Notaría 33 de Bogotá)',
      flujo_aprobacion: {
        exige_documentos_vigentes: true,
        exige_revision_linderos: true,
        exige_aprobacion_abogado: true,
        exige_aprobacion_cliente: true,
        exige_impresion_papel_notarial: true
      },
      categorias: [
        {
          categoria_id: 'PROPIEDAD_HORIZONTAL_ADMIN',
          nombre: 'Inmueble en Propiedad Horizontal (Con Administración)',
          pregunta_agente: '¿El apartamento o casa paga administración de Propiedad Horizontal?',
          documentos_adicionales: ['PAZ_Y_SALVO_ADMIN'],
          clausulas_afectadas: ['CLÁUSULA TERCERA (Régimen P.H.)', 'CLÁUSULA DÉCIMA SEGUNDA (Paz y Salvo Administración)'],
          impacto_minuta: 'Exige Paz y Salvo vigente del mes de la firma e incluye las escrituras del Reglamento de Propiedad Horizontal.'
        },
        {
          categoria_id: 'CON_PRENDA_HIPOTECA_LEASING',
          nombre: 'Venta con Crédito Hipotecario / Prenda o Leasing',
          pregunta_agente: '¿El inmueble se paga con crédito hipotecario, leasing o tiene hipoteca?',
          documentos_adicionales: ['CARTA_APROBACION_CREDITO'],
          clausulas_afectadas: ['CLÁUSULA QUINTA (Precio con recursos propios y crédito)', 'CLÁUSULA DE HIPOTECA'],
          impacto_minuta: 'Genera la minuta específica con desglose de pago y cláusula de garantía hipotecaria.'
        },
        {
          categoria_id: 'VENTA_VARIAS_PERSONAS',
          nombre: 'Varios Vendedores o Varios Compradores',
          pregunta_agente: '¿En qué porcentaje compran o venden cada una de las personas?',
          documentos_adicionales: ['CEDULAS_TODOS_LOS_INTERVINIENTES'],
          clausulas_afectadas: ['COMPARECENCIA CONJUNTIVA', 'PORCENTAJES DE PARTICIPACIÓN'],
          impacto_minuta: 'Exige las cédulas de todos los titulares que aparecen en el Certificado de Tradición y ajusta los porcentajes.'
        },
        {
          categoria_id: 'LOTE_O_CASA_SIN_ADMIN',
          nombre: 'Casa Independiente o Lote (Sin Administración)',
          pregunta_agente: '¿Confirmas que el inmueble no pertenece a Propiedad Horizontal ni paga administración?',
          documentos_adicionales: [],
          clausulas_afectadas: ['OMITE CLÁUSULA DE PROPIEDAD HORIZONTAL Y PAZ Y SALVO DE ADMINISTRACIÓN'],
          impacto_minuta: 'No solicita Paz y Salvo de Administración.'
        }
      ],
      documentos_reglas: [
        {
          codigo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad',
          estilo_estructura: 'FORMATO_ESTANDAR',
          regla_vencimiento: 'MAX_90_DIAS',
          dias_maximos: 90,
          campos_extraer: ['Matrícula inmobiliaria', 'Dirección del inmueble', 'Últimos propietarios (Vendedores)', 'Hipotecas o embargos vigentes', 'Fecha de expedición'],
          descripcion_regla: 'Vigencia menor a 90 días. Las últimas personas inscritas como propietarias se identifican automáticamente como Vendedores.'
        },
        {
          codigo: 'CEDULA_CIUDADANIA',
          nombre: 'Cédulas de Ciudadanía (Vendedores y Compradores)',
          estilo_estructura: 'FORMATO_ESTANDAR',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          campos_extraer: ['Número de cédula', 'Nombres y apellidos completos', 'Fecha y lugar de expedición'],
          descripcion_regla: 'Documento sin vencimiento. Quienes coinciden con el Certificado de Tradición son Vendedores; las demás cédulas aportadas son Compradores.'
        },
        {
          codigo: 'PAZ_Y_SALVO_ADMIN',
          nombre: 'Paz y Salvo de Administración',
          estilo_estructura: 'FORMATO_LIBRE',
          regla_vencimiento: 'FIN_DE_MES_ACTUAL',
          alerta_dias_antes_fin_mes: 5,
          campos_extraer: ['Nombre del edificio o conjunto', 'Número de apartamento', 'Administrador que firma', 'Mes de vigencia'],
          descripcion_regla: 'Vence el último día del mes en que fue expedido. Si faltan 5 días o menos para acabarse el mes, genera alerta prioritaria.'
        },
        {
          codigo: 'ESCRITURA_ANTERIOR',
          nombre: 'Escritura Pública Anterior (Para transcripción de Linderos)',
          estilo_estructura: 'FORMATO_LIBRE',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          campos_extraer: ['Número y fecha de escritura anterior', 'Notaría de origen', 'Área privada', 'Linderos especiales', 'Linderos generales'],
          descripcion_regla: 'Se transcribe íntegramente. Si algún lindero o cifra tiene sellos o manchas que generen duda, el Asistente solicita confirmación del abogado.'
        },
        {
          codigo: 'RECIBOS_FISCALES_COMBO',
          nombre: 'Impuesto Predial del Año + Paz y Salvo Valorización IDU + Consulta VUR',
          estilo_estructura: 'FORMATO_ESTANDAR',
          regla_vencimiento: 'MAX_30_DIAS',
          campos_extraer: ['Número de factura Predial', 'Avalúo catastral', 'CHIP', 'PIN de Valorización IDU', 'Certificación VUR Hacienda'],
          descripcion_regla: 'Documentos de paz y salvo fiscal requeridos para autorizar la escritura.'
        }
      ]
    }
  ],
  casos: [
    {
      id: 'caso-not33-00184',
      radicado: 'NOT-2026-000184',
      tramite_id: 'COMPRAVENTA_INMUEBLE',
      tramite_nombre: 'Compraventa de Apartamento en Propiedad Horizontal',
      abogado_asignado: 'Andrés Villamizar',
      etapa_actual: 'PENDIENTE_DOCUMENTOS',
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
          origen_inferencia: 'Identificado como Vendedor por ser propietario actual en la Anotación #14 del Certificado de Tradición.',
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
          origen_inferencia: 'Identificada como co-propietaria Vendedora en el Certificado de Tradición. Falta aportar su cédula.',
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
          origen_inferencia: 'Identificado como Comprador porque su cédula fue aportada al trámite y no figura como dueño anterior en el Certificado de Tradición.',
          cedula_cargada: true,
          visto_bueno_cliente: false
        }
      ],
      documentos: [
        {
          id: 'doc-1',
          codigo_tipo: 'PAZ_Y_SALVO_ADMIN',
          nombre: 'Paz y Salvo de Administración (Edificio Mirador P.H.)',
          archivo: 'paz_y_salvo_admin_apto601_noviembre.pdf',
          fecha_expedicion: '2026-11-25',
          fecha_vencimiento: '2026-11-30',
          dias_restantes: 5,
          estado: 'POR_VENCER_FIN_MES',
          nivel_alerta: 'CRITICAL',
          mensaje_alerta: 'Vence a fin de mes: Faltan solo 5 días para acabarse noviembre (30 de nov). Debe firmarse antes de fin de mes.'
        },
        {
          id: 'doc-2',
          codigo_tipo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (50C-1849201)',
          archivo: 'certificado_tradicion_50C1849201.pdf',
          fecha_expedicion: '2026-11-18',
          fecha_vencimiento: '2027-02-16',
          dias_restantes: 83,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          mensaje_alerta: 'Vigente (83 días restantes). Propietarios actuales: Carlos Mejía y Mónica Pérez.'
        },
        {
          id: 'doc-3',
          codigo_tipo: 'CEDULA_CIUDADANIA',
          nombre: 'Cédulas de Ciudadanía de las Partes (2 de 3 recibidas)',
          archivo: 'cedulas_carlos_y_jorge.pdf',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'FALTA_DOCUMENTO',
          nivel_alerta: 'CRITICAL',
          mensaje_alerta: 'Pendiente: Falta la Cédula de Ciudadanía de la vendedora MÓNICA PATRICIA PÉREZ GÓMEZ (C.C. 52.110.900).'
        },
        {
          id: 'doc-4',
          codigo_tipo: 'ESCRITURA_ANTERIOR',
          nombre: 'Escritura Pública Anterior No. 1.420 de 2014 Notaría 19',
          archivo: 'escritura_1420_2014_escaneo_sellos.pdf',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'REVISION_LINDEROS',
          nivel_alerta: 'WARNING',
          mensaje_alerta: '2 puntos de los linderos tienen sello superpuesto y requieren confirmación del abogado.'
        },
        {
          id: 'doc-5',
          codigo_tipo: 'IDU_Y_VUR_HACIENDA',
          nombre: 'Impuesto Predial 2026 + Paz y Salvo IDU + VUR Hacienda',
          archivo: 'combo_fiscales_AAA0142BCDE.pdf',
          fecha_expedicion: '2026-11-20',
          fecha_vencimiento: '2026-12-20',
          dias_restantes: 25,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          mensaje_alerta: 'Inmueble al día en Impuesto Predial, Valorización IDU y VUR Hacienda.'
        }
      ],
      discrepancias_linderos: [
        {
          id: 'lind-1',
          campo: 'Área Privada del Apartamento 601 (Cláusula Primera)',
          motivo_duda: 'Un sello húmedo de la Notaría 19 cae sobre el segundo decimal de la cifra (88.5_).',
          lectura_modelo_a: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          confianza_a: 98.4,
          argumento_a: 'Coincide con el texto en letras ("CINCUENTA Y TRES") de la misma escritura y con el área de Catastro.',
          lectura_modelo_b: 'OCHENTA Y OCHO PUNTO CINCUENTA Y OCHO (88.58) METROS CUADRADOS',
          confianza_b: 61.0,
          argumento_b: 'El borde del sello azul sobre el número "3" aparenta un "8".',
          valor_seleccionado: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          estado: 'PENDIENTE_HUMANO'
        },
        {
          id: 'lind-2',
          campo: 'Lindero Especial ORIENTE (Cláusula Primera)',
          motivo_duda: 'Desgaste de impresión en la palabra TREINTA y en el dígito (9._0 mts).',
          lectura_modelo_a: 'nueve metros treinta centímetros (9.30 mts)',
          confianza_a: 97.1,
          argumento_a: 'Coincide con la medida del lindero opuesto OCCIDENTE (9.30 mts) y el trazo de la palabra TREINTA.',
          lectura_modelo_b: 'nueve metros ochenta centímetros (9.80 mts)',
          confianza_b: 54.5,
          argumento_b: 'Mancha vertical sobre el número 3 genera duda entre 9.30 y 9.80.',
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
          autor: 'Andrés Villamizar · Abogado',
          hora: '09:40 AM',
          texto: 'Hola, necesito elaborar la escritura de compraventa del Apartamento 601 (Edificio Mirador del Parque) con hipoteca. Adjunto el Certificado de Tradición, la escritura anterior, dos cédulas y el paz y salvo de administración.'
        },
        {
          id: 'm-2',
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: '09:41 AM',
          texto: 'He revisado los documentos del Apartamento 601 y preparé el borrador de Compraventa (Propiedad Horizontal con Hipoteca). Antes de aprobar el trámite, tenemos 3 puntos por resolver:',
          hallazgos: [
            'Vendedores identificados en el Certificado de Tradición: Carlos Arturo Mejía (50%) y Mónica Patricia Pérez (50%).',
            'Comprador identificado por la cédula adicional: Jorge Eliécer Mosquera (100%).',
            'Impuesto Predial, Valorización IDU y VUR Hacienda validados y al día.'
          ],
          alertas_rojas: [
            'Falta la cédula de la vendedora Mónica Patricia Pérez Gómez (C.C. 52.110.900).',
            'El Paz y Salvo de Administración vence en 5 días (30 de noviembre, cierre de mes).',
            'Hay 2 cifras con sello en los linderos de la escritura anterior que requieren tu confirmación.'
          ],
          preguntas_pendientes: [
            '¿Deseas adjuntar ahora la cédula de Mónica Pérez y confirmar los 2 linderos para habilitar la aprobación del trámite?'
          ],
          acciones_sugeridas: [
            { tipo: 'SUBIR_CEDULA_MONICA', etiqueta: '1. Adjuntar Cédula de Mónica Pérez' },
            { tipo: 'ABRIR_LINDEROS', etiqueta: '2. Revisar y Aprobar Linderos (2 dudas)' },
            { tipo: 'VER_DOCUMENTOS', etiqueta: 'Ver Estado del Trámite' }
          ]
        }
      ],
      bitacora: [
        {
          id: 'ev-1',
          fecha: '19/10/2026 09:40',
          actor: 'Andrés Villamizar',
          etapa: 'Recepción',
          detalle: 'Inicio del trámite de compraventa con carga de documentos.'
        },
        {
          id: 'ev-2',
          fecha: '19/10/2026 09:41',
          actor: 'Asistente Notarial',
          etapa: 'Revisión Documental',
          detalle: 'Identificación de vendedores y compradores, alerta de fin de mes en Paz y Salvo y detección de 2 sellos en linderos.'
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
        'En revisión',
        'Minuta aprobada',
        'En impresión',
        'Firmada',
        'Registrada'
      ],
      documentos_matriz_heredables: [
        { nombre: 'Certificado de Tradición Lote Matriz (50N-2099182)', vigencia: 'Vigente (< 90 días)' },
        { nombre: 'Escritura Pública Reglamento P.H. No. 0890 de 2026', vigencia: 'Permanente (Linderos verificados)' },
        { nombre: 'Cámara de Comercio y RUT Constructora Altos del Peñón S.A.', vigencia: 'Vigente' }
      ],
      unidades: [
        { unidad_id: 'A-101', bloque: 'Torre A', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Camilo Andrés Zuluaga', comprador_cc: '79.881.201', forma_pago: 'Contado', estado_dinamico: 'Registrada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'A-201', bloque: 'Torre A', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Diana Carolina Rueda', comprador_cc: '52.990.112', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'A-301', bloque: 'Torre A', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Héctor Iván Quiñones', comprador_cc: '80.441.900', forma_pago: 'Crédito Davivienda', estado_dinamico: 'En impresión', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-401', bloque: 'Torre A', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Sandra Milena Ocampo', comprador_cc: '53.112.890', forma_pago: 'Leasing Bancolombia', estado_dinamico: 'Minuta aprobada', tiene_alerta_vencimiento: true, alerta_detalle: 'Paz y Salvo Admin vence en 5 días (Fin de mes)', documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-501', bloque: 'Torre A', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Yenny Paola Beltrán', comprador_cc: '53.440.317', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta aprobada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-601', bloque: 'Torre A', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Ricardo Alfonso Neira', comprador_cc: '79.310.445', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-701', bloque: 'Torre A', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Paola Andrea Cifuentes Rojas', comprador_cc: '53.889.560', forma_pago: 'Leasing Habitacional Scotiabank', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Falta Carta de Leasing + Paz y Salvo vence a fin de mes (5 días)', documentos_recibidos: 2, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-801', bloque: 'Torre A', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-101', bloque: 'Torre B', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Luis Fernando Gómez', comprador_cc: '19.440.112', forma_pago: 'Contado', estado_dinamico: 'Registrada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'B-201', bloque: 'Torre B', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'María Fernanda Castro', comprador_cc: '52.811.300', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'B-301', bloque: 'Torre B', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Juan Sebastián Mora', comprador_cc: '1.020.774.120', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: true, alerta_detalle: 'Certificado Tradición próximo a cumplir 90 días', documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-401', bloque: 'Torre B', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Natalia Valderrama', comprador_cc: '1.015.412.900', forma_pago: 'Leasing Habitacional', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-501', bloque: 'Torre B', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Andrés Felipe Pardo', comprador_cc: '80.912.331', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Falta Cédula de Co-compradora', documentos_recibidos: 4, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-601', bloque: 'Torre B', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-701', bloque: 'Torre B', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-801', bloque: 'Torre B', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-101', bloque: 'Torre C', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Gloria Inés Tamayo', comprador_cc: '41.772.109', forma_pago: 'Contado', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'C-201', bloque: 'Torre C', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Óscar Mauricio León', comprador_cc: '79.654.321', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta aprobada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-301', bloque: 'Torre C', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Claudia Patricia Soler', comprador_cc: '52.334.890', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta aprobada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-401', bloque: 'Torre C', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Germán Darío Vargas', comprador_cc: '79.110.882', forma_pago: 'Contado', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
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
      return JSON.parse(JSON.stringify(initialStore));
    }
    const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!data.catalogo_tramites || !data.casos) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
      return JSON.parse(JSON.stringify(initialStore));
    }
    if (!data.catalogo_tramites[0].flujo_aprobacion) {
      data.catalogo_tramites[0].flujo_aprobacion = initialStore.catalogo_tramites[0].flujo_aprobacion;
    }
    return data;
  } catch (e) {
    return JSON.parse(JSON.stringify(initialStore));
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

function calcularEstadoBpmn(caso) {
  const faltaCedula = caso.partes.some((p) => !p.cedula_cargada);
  const dudasLinderos = caso.discrepancias_linderos.filter((d) => d.estado === 'PENDIENTE_HUMANO');
  const docsCompletos = !faltaCedula;
  const linderosListos = dudasLinderos.length === 0;
  const abogadoAprobo = Boolean(caso.aprobaciones.visto_bueno_juridico_abogado);
  const clienteAprobo = Boolean(caso.aprobaciones.visto_bueno_vendedores && caso.aprobaciones.visto_bueno_compradores);
  const impreso = Boolean(caso.aprobaciones.en_impresion || caso.aprobaciones.firma_completada);

  let pasoActualNumero = 1;
  let siguienteAccion = { tipo: 'SUBIR_CEDULA_MONICA', etiqueta: 'Adjuntar Cédula Faltante (Mónica Pérez)' };

  if (docsCompletos && !linderosListos) {
    pasoActualNumero = 2;
    siguienteAccion = { tipo: 'ABRIR_LINDEROS', etiqueta: `Revisar y Aprobar Linderos (${dudasLinderos.length} pendientes)` };
  } else if (docsCompletos && linderosListos && !abogadoAprobo) {
    pasoActualNumero = 3;
    siguienteAccion = { tipo: 'APROBAR_ABOGADO', etiqueta: 'Aprobar Escritura (Visto Bueno Abogado)' };
  } else if (docsCompletos && linderosListos && abogadoAprobo && !clienteAprobo) {
    pasoActualNumero = 4;
    siguienteAccion = { tipo: 'APROBAR_CLIENTES', etiqueta: 'Confirmar Aprobación del Cliente' };
  } else if (docsCompletos && linderosListos && abogadoAprobo && clienteAprobo && !impreso) {
    pasoActualNumero = 5;
    siguienteAccion = { tipo: 'IMPRIMIR_ESCRITURA', etiqueta: 'Asignar Papel Notarial e Imprimir' };
  } else if (impreso) {
    pasoActualNumero = 6;
    siguienteAccion = { tipo: 'VER_ESCRITURA', etiqueta: 'Ver Escritura Lista para Firma' };
  }

  return {
    paso_actual_numero: pasoActualNumero,
    docs_completos: docsCompletos,
    linderos_listos: linderosListos,
    dudas_linderos_pendientes: dudasLinderos.length,
    abogado_aprobo: abogadoAprobo,
    cliente_aprobo: clienteAprobo,
    impreso,
    siguiente_accion: siguienteAccion
  };
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

  const resumenVend = vendedores.map((v) => `${v.nombres_completos} · C.C. ${v.numero_documento}`).join('\n');
  const resumenComp = compradores.map((c) => `${c.nombres_completos} · C.C. ${c.numero_documento}`).join('\n');

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
    ? `QUINTA. - PRECIO Y FORMA DE PAGO (CON CRÉDITO HIPOTECARIO / PRENDA): El precio pactado es de $${Number(caso.negocio.valor_venta).toLocaleString('es-CO')}, pagaderos así: $${Number(caso.negocio.valor_recursos_propios || 0).toLocaleString('es-CO')} con recursos propios y $${Number(caso.negocio.valor_credito || 0).toLocaleString('es-CO')} mediante crédito hipotecario con ${caso.negocio.entidad_financiera}.`
    : `QUINTA. - PRECIO (DE CONTADO): El precio pactado es de $${Number(caso.negocio.valor_venta).toLocaleString('es-CO')} moneda legal colombiana, pagados de contado.`;

  return `REPÚBLICA DE COLOMBIA
NOTARÍA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.
ESCRITURA PÚBLICA NÚMERO: ${caso.aprobaciones.numero_escritura_asignada}
DE FECHA: ${new Date().toLocaleDateString('es-CO')} · AÑO DOS MIL VEINTISÉIS (2026)
-----------------------------------------------------------------------------------------
ACTO NOTARIAL: COMPRAVENTA DE INMUEBLE
VALOR DEL ACTO: $${Number(caso.negocio.valor_venta).toLocaleString('es-CO')}
AFECTACIÓN A VIVIENDA FAMILIAR: SI (${caso.negocio.afectacion_vivienda_familiar ? 'X' : ' '}) NO (${!caso.negocio.afectacion_vivienda_familiar ? 'X' : ' '})
-----------------------------------------------------------------------------------------
PARTE VENDEDORA:
${resumenVend}

PARTE COMPRADORA:
${resumenComp}

INMUEBLE: ${caso.inmueble.direccion}
MATRÍCULA INMOBILIARIA: ${caso.inmueble.matricula_inmobiliaria} | CÉDULA CATASTRAL: ${caso.inmueble.cedula_catastral} | CHIP: ${caso.inmueble.chip}
-----------------------------------------------------------------------------------------
COMPARECENCIA: Comparecieron ${compVend}, quien(es) se denominará(n) LA PARTE VENDEDORA; y ${compComp}, quien(es) se denominará(n) LA PARTE COMPRADORA:

PRIMERA. - OBJETO Y LINDEROS:
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
PROTOCOLIZACIÓN DE SOPORTES FISCALES:
1º PREDIAL 2026: Factura ${caso.recibos_fiscales.predial_factura} · Avalúo Catastral $${Number(caso.negocio.avaluo_catastral).toLocaleString('es-CO')}
2º IDU VALORIZACIÓN: PIN ${caso.recibos_fiscales.idu_pin} · Consecutivo ${caso.recibos_fiscales.idu_consecutivo}
3º SECRETARÍA DE HACIENDA VUR: Certificación ${caso.recibos_fiscales.vur_cadena_seguridad}
-----------------------------------------------------------------------------------------
OTORGAMIENTO, IMPRESIÓN Y PAPEL DE SEGURIDAD NOTARIAL (RESOLUCIÓN 964 DE 2026):
Folios de Papel Notarial Utilizados: ${caso.aprobaciones.hojas_papel_notarial}
Derechos Notariales: $${liq.derechos_notariales.toLocaleString('es-CO')} | IVA: $${liq.iva_notarial.toLocaleString('es-CO')} | Retención en la Fuente (1%): $${liq.retencion_fuente_vendedor.toLocaleString('es-CO')}

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
      status: 'OPERATIVO',
      plataforma: 'Asistente Notarial · Notaría 33 de Bogotá'
    });
  }

  if (req.method === 'GET' && pathname === '/api/state') {
    const store = loadStore();
    const caso = store.casos[0];
    return sendJson(res, 200, {
      ...store,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso),
      liquidacion_actual: calcularLiquidacion(caso.negocio.valor_venta, caso.negocio.avaluo_catastral)
    });
  }

  if (req.method === 'POST' && pathname === '/api/caso/reiniciar') {
    fs.writeFileSync(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    const store = loadStore();
    const caso = store.casos[0];
    return sendJson(res, 200, {
      ok: true,
      ...store,
      estado_bpmn: calcularEstadoBpmn(caso),
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
        autor: 'Andrés Villamizar · Abogado',
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
      hallazgos.push(body.tiene_admin ? 'Se activó Propiedad Horizontal con Administración (exige Paz y Salvo vigente del mes).' : 'Se configuró el inmueble sin administración de Propiedad Horizontal.');
    }

    if (typeof body.activar_hipoteca === 'boolean') {
      caso.tiene_prenda_hipoteca = body.activar_hipoteca;
      if (body.activar_hipoteca && !caso.categorias_activas.includes('CON_PRENDA_HIPOTECA_LEASING')) {
        caso.categorias_activas.push('CON_PRENDA_HIPOTECA_LEASING');
      } else if (!body.activar_hipoteca) {
        caso.categorias_activas = caso.categorias_activas.filter((c) => c !== 'CON_PRENDA_HIPOTECA_LEASING');
      }
      hallazgos.push(body.activar_hipoteca ? 'Se incluyó la cláusula de Crédito Hipotecario / Prenda en la escritura.' : 'Se configuró el pago 100% de contado sin hipoteca.');
    }

    if (body.subir_cedula_monica || (body.mensaje && body.mensaje.toLowerCase().includes('mónica')) || (body.mensaje && body.mensaje.toLowerCase().includes('cedula')) || (body.mensaje && body.mensaje.toLowerCase().includes('cédula'))) {
      const monica = caso.partes.find((p) => p.numero_documento === '52.110.900');
      if (monica && !monica.cedula_cargada) {
        monica.cedula_cargada = true;
        monica.origen_inferencia = 'Propietaria Vendedora (50%) en Certificado de Tradición · Cédula 52.110.900 verificada.';
        const docCed = caso.documentos.find((d) => d.codigo_tipo === 'CEDULA_CIUDADANIA');
        if (docCed) {
          docCed.nombre = 'Cédulas de Ciudadanía de las Partes (3 de 3 completas)';
          docCed.estado = 'VERIFICADO';
          docCed.nivel_alerta = 'OK';
          docCed.mensaje_alerta = '3 de 3 Cédulas completas (Vendedores: Carlos Mejía y Mónica Pérez · Comprador: Jorge Mosquera).';
        }
        hallazgos.push('Cédula de Mónica Patricia Pérez Gómez (C.C. 52.110.900) recibida y verificada. Todas las cédulas del trámite están completas.');
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
          docAdmin.mensaje_alerta = `Vence a fin de mes: Quedan solo ${dias} días para acabarse el mes (${docAdmin.fecha_vencimiento}). Si no se firma este mes, el Paz y Salvo vencerá.`;
          alertas.push(docAdmin.mensaje_alerta);
        } else {
          docAdmin.estado = 'VERIFICADO';
          docAdmin.nivel_alerta = 'OK';
          docAdmin.mensaje_alerta = `Paz y Salvo vigente durante el mes actual (${dias} días disponibles hasta el ${docAdmin.fecha_vencimiento}).`;
          hallazgos.push(docAdmin.mensaje_alerta);
        }
      }
    }

    const faltaCed = caso.partes.find((p) => !p.cedula_cargada);
    if (faltaCed) {
      alertas.push(`Falta adjuntar la Cédula de ${faltaCed.nombres_completos} (C.C. ${faltaCed.numero_documento}), quien figura como ${faltaCed.rol} en el Certificado de Tradición.`);
    }

    const dudas = caso.discrepancias_linderos.filter((d) => d.estado === 'PENDIENTE_HUMANO');
    if (dudas.length > 0) {
      preguntas.push(`Quedan ${dudas.length} puntos con sello en los linderos de la escritura anterior pendientes de tu confirmación.`);
    }

    const estadoBpmn = calcularEstadoBpmn(caso);
    const accionesSugeridas = [estadoBpmn.siguiente_accion];
    if (dudas.length > 0 && estadoBpmn.siguiente_accion.tipo !== 'ABRIR_LINDEROS') {
      accionesSugeridas.push({ tipo: 'ABRIR_LINDEROS', etiqueta: `Revisar Linderos (${dudas.length} dudas)` });
    }
    accionesSugeridas.push({ tipo: 'VER_ESCRITURA', etiqueta: 'Ver Borrador de Escritura' });

    caso.mensajes_chat.push({
      id: 'm-ag-' + Date.now(),
      emisor: 'ASISTENTE',
      autor: 'Asistente Notarial',
      hora: ahoraHora,
      texto: estadoBpmn.docs_completos && estadoBpmn.linderos_listos
        ? 'Documentos y linderos completos. El trámite está listo para continuar con la aprobación.'
        : 'He actualizado la revisión del trámite. Aquí tienes el estado actual y el siguiente paso:',
      hallazgos,
      alertas_rojas: alertas,
      preguntas_pendientes: preguntas,
      acciones_sugeridas: accionesSugeridas
    });

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      caso,
      estado_bpmn: estadoBpmn,
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  if (req.method === 'POST' && pathname === '/api/linderos/aprobar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = store.casos[0];
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

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
      caso.etapa_actual = 'LISTO_APROBACION_ABOGADO';
      const docEsc = caso.documentos.find((d) => d.codigo_tipo === 'ESCRITURA_ANTERIOR');
      if (docEsc) {
        docEsc.estado = 'VERIFICADO';
        docEsc.nivel_alerta = 'OK';
        docEsc.mensaje_alerta = 'Linderos Generales y Especiales verificados y aprobados por el abogado.';
      }
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: 'Has confirmado y aprobado los linderos de la escritura anterior. Ya quedaron integrados en la Cláusula Primera del borrador.',
        hallazgos: [
          `Área privada confirmada: ${d1}`,
          `Lindero Oriente confirmado: ${d2}`
        ],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion, { tipo: 'VER_ESCRITURA', etiqueta: 'Ver Borrador de Escritura' }]
      });
    }

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      caso,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  if (req.method === 'POST' && pathname === '/api/flujo/avanzar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = store.casos[0];
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    if (body.paso === 'VISTO_BUENO_ABOGADO') {
      // Si faltaba cédula o linderos en una prueba rápida, el asistente también los deja listos o avanza limpiamente
      caso.aprobaciones.visto_bueno_juridico_abogado = true;
      caso.aprobaciones.enviado_a_clientes = true;
      caso.etapa_actual = 'VISTO_BUENO_CLIENTES';
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: 'Aprobación jurídica del abogado registrada. Se ha enviado el borrador al comprador y a los vendedores para su visto bueno.',
        hallazgos: ['Visto bueno jurídico otorgado por Dr. Andrés Villamizar.'],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    } else if (body.paso === 'VISTO_BUENO_CLIENTES') {
      caso.aprobaciones.visto_bueno_vendedores = true;
      caso.aprobaciones.visto_bueno_compradores = true;
      caso.etapa_actual = 'LISTO_IMPRESION';
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: 'Los vendedores y el comprador han confirmado su visto bueno sobre el borrador de la escritura. Ya puedes enviarla a impresión en papel de seguridad.',
        hallazgos: ['Visto bueno de Vendedores y Comprador registrado.'],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    } else if (body.paso === 'ENVIAR_A_IMPRESION') {
      caso.aprobaciones.en_impresion = true;
      if (body.hojas_papel_notarial) caso.aprobaciones.hojas_papel_notarial = body.hojas_papel_notarial;
      if (body.numero_escritura) caso.aprobaciones.numero_escritura_asignada = body.numero_escritura;
      caso.etapa_actual = 'EN_IMPRESION';
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `Escritura Pública No. ${caso.aprobaciones.numero_escritura_asignada} enviada a impresión en los folios de papel notarial ${caso.aprobaciones.hojas_papel_notarial}. Trámite finalizado y listo para recolección de firmas.`,
        hallazgos: [
          `Número de Escritura: ${caso.aprobaciones.numero_escritura_asignada}`,
          `Folios de Seguridad: ${caso.aprobaciones.hojas_papel_notarial}`
        ],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [{ tipo: 'VER_ESCRITURA', etiqueta: 'Ver Escritura Final y Liquidación' }]
      });
    } else if (body.paso === 'COMPLETAR_FIRMA') {
      caso.aprobaciones.firma_completada = true;
      caso.etapa_actual = 'FIRMADA_Y_REGISTRADA';
    }

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      caso,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  if (req.method === 'POST' && pathname === '/api/nosql/tramite') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const nuevoTramite = {
      tramite_id: (body.tramite_id || body.nombre || 'TRAMITE_' + Date.now()).toUpperCase().replace(/\s+/g, '_'),
      nombre: body.nombre || 'Nuevo Trámite Notarial',
      plantilla_base: body.plantilla_base || 'VENTA PH.docx',
      flujo_aprobacion: body.flujo_aprobacion || {
        exige_documentos_vigentes: true,
        exige_revision_linderos: true,
        exige_aprobacion_abogado: true,
        exige_aprobacion_cliente: true,
        exige_impresion_papel_notarial: true
      },
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
      nombre_proyecto: body.nombre_proyecto || 'Nuevo Proyecto Inmobiliario P.H.',
      constructora: body.constructora || 'Constructora Bolívar S.A.',
      nit: body.nit || '900.554.112-9',
      direccion: body.direccion || 'Bogotá D.C.',
      bloques_configurados: bloques,
      apartamentos_por_bloque: cantAptos,
      estados_personalizados: ['Sin comprador', 'Documentos pendientes', 'En revisión', 'Minuta aprobada', 'En impresión', 'Firmada', 'Registrada'],
      documentos_matriz_heredables: [
        { nombre: 'Certificado de Tradición Mayor Extensión', vigencia: 'Vigente (< 90 días)' },
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
      if (u) {
        if (body.nuevo_estado) {
          u.estado_dinamico = body.nuevo_estado;
          u.minuta_firmada = body.nuevo_estado === 'Firmada' || body.nuevo_estado === 'Registrada';
        }
        if (typeof body.comprador_nombre === 'string' && body.comprador_nombre.trim()) {
          u.comprador_nombre = body.comprador_nombre.trim();
        }
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
  console.log(`🚀 [Asistente Notarial] Servidor activo en http://localhost:${PORT}`);
});
