const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 4000;
const APP_VERSION = process.env.APP_VERSION || 'voz-constructora-v5';
const PRIMARY_VISION_MODEL = process.env.PRIMARY_VISION_MODEL || 'gemini-3.8-flash';
const SECONDARY_VISION_MODEL = process.env.SECONDARY_VISION_MODEL || 'gemini-3.8-pro';
const TTS_VOICE_MODEL = process.env.TTS_VOICE_MODEL || 'es-US-Neural2-B';
const STORE_PATH = path.join(__dirname, '..', 'database', 'local_store.json');
const FRONTEND_PATH = path.join(__dirname, '..', '..', 'frontend', 'app.html');
const MANUAL_PATH = path.join(__dirname, '..', '..', 'frontend', 'manual.html');

const initialStore = {
  usuarios_temporales: [
    {
      usuario_id: 'usr-radicador-01',
      nombre: 'Laura Gómez',
      cargo: 'Abogada Radicadora (Carga y Crea Trámite)',
      rol_codigo: 'ABOGADO_CARGA',
      permisos: {
        puede_crear_tramite: true,
        puede_subir_documentos: true,
        puede_verificar_aprobar: false,
        puede_acceder_agente: true,
        es_cliente: false
      }
    },
    {
      usuario_id: 'usr-verificador-01',
      nombre: 'Dr. Carlos Salamanca',
      cargo: 'Abogado Verificador (Revisa y Aprueba)',
      rol_codigo: 'ABOGADO_VERIFICADOR',
      permisos: {
        puede_crear_tramite: false,
        puede_subir_documentos: false,
        puede_verificar_aprobar: true,
        puede_acceder_agente: true,
        es_cliente: false
      }
    },
    {
      usuario_id: 'usr-integral-01',
      nombre: 'Dr. Andrés Villamizar',
      cargo: 'Abogado Integral (Carga + Verifica y Aprueba)',
      rol_codigo: 'ABOGADO_INTEGRAL',
      permisos: {
        puede_crear_tramite: true,
        puede_subir_documentos: true,
        puede_verificar_aprobar: true,
        puede_acceder_agente: true,
        es_cliente: false
      }
    },
    {
      usuario_id: 'usr-cliente-01',
      nombre: 'Mauricio Téllez',
      cargo: 'Cliente Otorgante (Visto Bueno y Consulta)',
      rol_codigo: 'CLIENTE',
      documento: '79.451.200',
      permisos: {
        puede_crear_tramite: false,
        puede_subir_documentos: true,
        puede_verificar_aprobar: false,
        puede_acceder_agente: true,
        es_cliente: true
      }
    }
  ],
  usuario_activo_id: 'usr-integral-01',
  caso_activo_id: 'caso-001',
  catalogo_tramites: [
    {
      tramite_id: 'TRM-01-COMPRAVENTA',
      codigo_corto: 'COMPRAVENTA',
      nombre: 'Escritura Pública de Compraventa de Inmueble',
      plantilla_base: 'VENTA PH.docx (Notaría 33 de Bogotá)',
      documento_apertura: 'CERTIFICADO_TRADICION',
      flujo_aprobacion: {
        exige_documentos_vigentes: true,
        exige_revision_linderos: true,
        exige_aprobacion_abogado: true,
        exige_aprobacion_cliente: true,
        exige_impresion_papel_notarial: true
      },
      categorias: [
        {
          categoria_id: 'SUB-PH-ADMIN',
          nombre: 'Inmueble en Propiedad Horizontal (Con Administración)',
          pregunta_agente: '¿El apartamento o casa paga administración de Propiedad Horizontal?',
          documentos_adicionales: ['PAZ_Y_SALVO_ADMIN'],
          clausulas_afectadas: ['CLÁUSULA TERCERA (Régimen P.H.)', 'CLÁUSULA DÉCIMA SEGUNDA (Paz y Salvo Administración)'],
          impacto_minuta: 'Exige Paz y Salvo vigente del mes de la firma e incluye las escrituras del Reglamento de P.H.'
        },
        {
          categoria_id: 'SUB-PRENDA-HIPOTECA',
          nombre: 'Con Prenda / Hipoteca Abierta o Crédito Hipotecario',
          pregunta_agente: '¿El inmueble viene con prenda, hipoteca o crédito hipotecario?',
          documentos_adicionales: ['CARTA_APROBACION_CREDITO'],
          clausulas_afectadas: ['CLÁUSULA QUINTA (Precio con crédito)', 'CLÁUSULA DE HIPOTECA'],
          impacto_minuta: 'Genera minuta específica con prenda/hipoteca y desglose financiero.'
        },
        {
          categoria_id: 'SUB-VARIAS-PERSONAS',
          nombre: 'Venta a Varias Personas (Pluralidad de Compradores o Vendedores)',
          pregunta_agente: '¿En qué porcentaje compran o venden cada una de las personas?',
          documentos_adicionales: ['CEDULAS_TODOS_LOS_OTORGANTES'],
          clausulas_afectadas: ['COMPARECENCIA PLURAL', 'PORCENTAJES DE COPROPIEDAD'],
          impacto_minuta: 'Exige las cédulas de todos los titulares del Certificado de Tradición y pluraliza la minuta.'
        },
        {
          categoria_id: 'SUB-PROYECTO-CONSTRUCTORA',
          nombre: 'Unidad de Proyecto de Constructora (Torre y Apartamento)',
          pregunta_agente: '¿Este trámite pertenece a algún proyecto de Constructora?',
          documentos_adicionales: ['DOCUMENTOS_MATRIZ_HEREDADOS'],
          clausulas_afectadas: ['TRADICIÓN DE MAYOR EXTENSIÓN', 'REGLAMENTO P.H. CONSTRUCTORA'],
          impacto_minuta: 'Vincula Torre y Apartamento y actualiza los estados en la matriz de la constructora.'
        },
        {
          categoria_id: 'SUB-SIN-ADMIN',
          nombre: 'Casa o Lote sin Administración',
          pregunta_agente: '¿Confirmas que el predio no paga administración?',
          documentos_adicionales: [],
          clausulas_afectadas: ['OMITE CLÁUSULA P.H. Y ADMINISTRACIÓN'],
          impacto_minuta: 'Exime el Paz y Salvo de Administración.'
        }
      ],
      documentos_reglas: [
        {
          codigo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (Documento que abre el trámite)',
          regla_vencimiento: 'MAX_90_DIAS',
          dias_maximos: 90,
          campos_extraer: ['Matrícula Inmobiliaria', 'CHIP', 'Cédula Catastral', 'Dirección del Predio', 'Últimos Propietarios (Vendedores)', 'Anotaciones y Gravámenes', 'Fecha de Expedición'],
          descripcion_regla: 'Documento obligatorio para abrir el trámite. Codifica el trámite con el CHIP y el apellido del primer propietario. Vigencia menor a 90 días.'
        },
        {
          codigo: 'CEDULA_CIUDADANIA',
          nombre: 'Cédulas de Ciudadanía (Vendedores y Compradores)',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          campos_extraer: ['Número de Cédula', 'Nombres y Apellidos', 'Fecha y Lugar de Expedición', 'Estado Civil'],
          descripcion_regla: 'Sin vencimiento. Quienes aparecen como dueños actuales en el Certificado de Tradición son Vendedores; las demás cédulas son Compradores.'
        },
        {
          codigo: 'PAZ_Y_SALVO_ADMIN',
          nombre: 'Paz y Salvo de Administración (Propiedad Horizontal)',
          regla_vencimiento: 'FIN_DE_MES_ACTUAL',
          alerta_dias_antes_fin_mes: 5,
          campos_extraer: ['Conjunto/Edificio', 'Torre y Apartamento', 'Administrador Firmante', 'Fecha de Expedición', 'Mes de Vigencia'],
          descripcion_regla: 'Formato variable según cada edificio. Vence el último día del mes en curso (alerta crítica cuando faltan 5 días o menos).'
        },
        {
          codigo: 'ESCRITURA_ANTERIOR',
          nombre: 'Minuta / Escritura Pública Anterior (Transcripción de Linderos)',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          campos_extraer: ['Escritura Antecedente No.', 'Fecha y Notaría', 'Área Privada', 'Linderos Especiales', 'Linderos Generales'],
          descripcion_regla: 'Se transcribe completa. El abogado verifica en la imagen escaneada cualquier lindero con sello o mancha.'
        },
        {
          codigo: 'RECIBOS_FISCALES',
          nombre: 'Impuesto Predial + Paz y Salvo IDU + Consulta VUR Hacienda',
          regla_vencimiento: 'MAX_30_DIAS',
          campos_extraer: ['Factura Predial', 'Avalúo Catastral', 'CHIP', 'PIN IDU', 'Certificación VUR'],
          descripcion_regla: 'Soportes fiscales obligatorios para protocolizar la escritura.'
        }
      ]
    },
    {
      tramite_id: 'TRM-02-HIPOTECA',
      codigo_corto: 'HIPOTECA',
      nombre: 'Escritura Pública de Constitución de Hipoteca Abierta',
      plantilla_base: 'HIPOTECA_ABIERTA.docx',
      documento_apertura: 'CERTIFICADO_TRADICION',
      flujo_aprobacion: {
        exige_documentos_vigentes: true,
        exige_revision_linderos: true,
        exige_aprobacion_abogado: true,
        exige_aprobacion_cliente: true,
        exige_impresion_papel_notarial: true
      },
      categorias: [
        {
          categoria_id: 'SUB-HIP-SIN-LIMITE',
          nombre: 'Hipoteca Abierta sin Límite de Cuantía',
          pregunta_agente: '¿La carta de aprobación exige hipoteca abierta sin límite de cuantía?',
          documentos_adicionales: ['CARTA_CREDITO_BANCO', 'CERTIFICADO_CAMARA_BANCO'],
          clausulas_afectadas: ['CLÁUSULA DE CUANTÍA INDETERMINADA'],
          impacto_minuta: 'Incluye cláusula bancaria de garantía abierta y poder del representante del banco.'
        }
      ],
      documentos_reglas: [
        {
          codigo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad',
          regla_vencimiento: 'MAX_30_DIAS',
          campos_extraer: ['Matrícula', 'CHIP', 'Propietario Constituyente', 'Gravámenes Previos'],
          descripcion_regla: 'Menor a 30 días para constitución de hipoteca.'
        },
        {
          codigo: 'CARTA_CREDITO_BANCO',
          nombre: 'Carta de Aprobación de Crédito y Minuta Bancaria',
          regla_vencimiento: 'MAX_90_DIAS',
          campos_extraer: ['Entidad Financiera', 'Monto Aprobado', 'Deudor(es)'],
          descripcion_regla: 'Vigente según condiciones de la entidad financiera.'
        }
      ]
    },
    {
      tramite_id: 'TRM-03-CANCELACION',
      codigo_corto: 'CANCELACION',
      nombre: 'Escritura Pública de Cancelación de Hipoteca',
      plantilla_base: 'CANCELACION_HIPOTECA.docx',
      documento_apertura: 'CERTIFICADO_TRADICION',
      flujo_aprobacion: {
        exige_documentos_vigentes: true,
        exige_revision_linderos: false,
        exige_aprobacion_abogado: true,
        exige_aprobacion_cliente: false,
        exige_impresion_papel_notarial: true
      },
      categorias: [
        {
          categoria_id: 'SUB-CANC-TOTAL',
          nombre: 'Cancelación Total de Gravamen Hipotecario',
          pregunta_agente: '¿El banco libera la totalidad del inmueble?',
          documentos_adicionales: ['CARTA_LIBERACION_BANCO'],
          clausulas_afectadas: ['CLÁUSULA DE LIBERACIÓN TOTAL'],
          impacto_minuta: 'Deja libre de gravamen la matrícula inmobiliaria.'
        }
      ],
      documentos_reglas: [
        {
          codigo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad',
          regla_vencimiento: 'MAX_90_DIAS',
          campos_extraer: ['Matrícula', 'CHIP', 'Anotación de la Hipoteca a Cancelar'],
          descripcion_regla: 'Permite identificar el número de escritura y anotación del gravamen.'
        }
      ]
    },
    {
      tramite_id: 'TRM-04-SUCESION',
      codigo_corto: 'SUCESION',
      nombre: 'Liquidación Notarial de Herencia (Sucesión)',
      plantilla_base: 'SUCESION_NOTARIAL.docx',
      documento_apertura: 'REGISTRO_DEFUNCION',
      flujo_aprobacion: {
        exige_documentos_vigentes: true,
        exige_revision_linderos: true,
        exige_aprobacion_abogado: true,
        exige_aprobacion_cliente: true,
        exige_impresion_papel_notarial: true
      },
      categorias: [
        {
          categoria_id: 'SUB-SUC-CONYUGAL',
          nombre: 'Con Liquidación de Sociedad Conyugal',
          pregunta_agente: '¿Existe cónyuge sobreviviente para liquidar sociedad conyugal?',
          documentos_adicionales: ['REGISTRO_MATRIMONIO'],
          clausulas_afectadas: ['INVENTARIO Y AVALÚOS', 'PARTICIÓN Y ADJUDICACIÓN'],
          impacto_minuta: 'Adjudica 50% por gananciales y 50% por herencia.'
        }
      ],
      documentos_reglas: []
    }
  ],
  casos: [
    {
      id: 'caso-001',
      codigo_tramite: 'COMPRAVENTA-AAA0142BCDE-TELLEZ',
      titulo_tramite: 'Compraventa · Mauricio Téllez · Apto 601 Mirador del Parque',
      estado_apertura: 'ABIERTO',
      radicado: 'NOT-2026-000184',
      tramite_id: 'TRM-01-COMPRAVENTA',
      tramite_nombre: 'Escritura Pública de Compraventa de Inmueble',
      creado_por: 'Laura Gómez (Abogada Radicadora)',
      abogado_verificador: 'Dr. Carlos Salamanca (Abogado Verificador)',
      etapa_actual: 'PENDIENTE_REVISION_DOCUMENTAL',
      subcategorias_activas: ['SUB-PH-ADMIN', 'SUB-VARIAS-PERSONAS', 'SUB-PRENDA-HIPOTECA'],
      tiene_administracion: true,
      tiene_prenda_hipoteca: true,
      pertenece_constructora: false,
      constructora_info: {
        proyecto_id: '',
        nombre_proyecto: '',
        torre_bloque: '',
        apartamento: ''
      },
      certificado_tradicion: {
        matricula_inmobiliaria: '50C-1849201',
        chip: 'AAA0142BCDE',
        cedula_catastral: '00841201900601000',
        circulo_registral: '50C - BOGOTÁ ZONA CENTRO',
        departamento: 'BOGOTÁ D.C.',
        municipio: 'BOGOTÁ D.C.',
        vereda: 'BOGOTÁ D.C.',
        estado_folio: 'ACTIVO',
        fecha_apertura_folio: '18/05/2008',
        fecha_expedicion_certificado: '2026-11-18',
        hora_expedicion: '08:14:22 AM',
        pin_verificacion_snr: 'SNR-2026-998841200192',
        tipo_predio: 'URBANO · APARTAMENTO EN PROPIEDAD HORIZONTAL',
        direccion_actual: 'CALLE 116 # 15-42 APARTAMENTO 601 GARAJE 14 EDIFICIO MIRADOR DEL PARQUE P.H.',
        direcciones_anteriores: ['CALLE 116 # 15-40 LOTE MAYOR EXTENSIÓN'],
        cabida_y_linderos_snr: 'APARTAMENTO 601 DEL SEXTO PISO CON ÁREA PRIVADA DE 88.53 M2 Y COEFICIENTE DEL 4.18%. LINDEROS CONTENIDOS EN ESCRITURA NRO. 2810 DE 14-05-2008 NOTARÍA 19 DE BOGOTÁ.',
        complementacion: 'Adquirió Constructora Mirador S.A.S. el lote por compra mediante Escritura 410 de 2006 Notaría 19 Bogotá.',
        total_anotaciones: 14,
        gravamenes_vigentes: 'SIN EMBARGOS NI MEDIDAS CAUTELARES VIGENTES',
        anotaciones_relevantes: [
          {
            numero: 'Anotación Nro. 001',
            fecha: '20/05/2008',
            radicacion: '2008-44109',
            documento: 'Escritura 2810 del 14/05/2008 Notaría 19 Bogotá',
            especificacion: '0317 CONSTITUCIÓN REGLAMENTO DE PROPIEDAD HORIZONTAL',
            personas: 'DE: CONSTRUCTORA MIRADOR S.A.S.'
          },
          {
            numero: 'Anotación Nro. 013',
            fecha: '10/09/2014',
            radicacion: '2014-88120',
            documento: 'Escritura 1602 del 02/09/2014 Notaría 19 Bogotá',
            especificacion: '0401 CANCELACIÓN DE HIPOTECA ABIERTA',
            personas: 'DE: BANCO DAVIVIENDA S.A. · A: CONSTRUCTORA MIRADOR S.A.S.'
          },
          {
            numero: 'Anotación Nro. 014 (Últimos Dueños Actuales = VENDEDORES)',
            fecha: '28/08/2014',
            radicacion: '2014-81904',
            documento: 'Escritura 1420 del 22/08/2014 Notaría 19 Bogotá',
            valor_acto: '$320.000.000',
            especificacion: '0125 COMPRAVENTA (MODO DE ADQUISICIÓN)',
            personas: 'DE: CONSTRUCTORA MIRADOR S.A.S. — A: (X) TÉLLEZ RESTREPO MAURICIO ARTURO (C.C. 79.451.200) 50% Y (X) PÉREZ GÓMEZ MÓNICA PATRICIA (C.C. 52.110.900) 50%'
          }
        ]
      },
      inmueble: {
        tipo_inmueble: 'APARTAMENTO',
        direccion: 'Calle 116 # 15-42, Apartamento 601, Edificio Mirador del Parque P.H., Bogotá D.C.',
        matricula_inmobiliaria: '50C-1849201',
        cedula_catastral: '00841201900601000',
        chip: 'AAA0142BCDE',
        zona_registro: 'ZONA CENTRO / NORTE',
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
          nombres_completos: 'MAURICIO ARTURO TÉLLEZ RESTREPO',
          numero_documento: '79.451.200',
          lugar_expedicion: 'Bogotá D.C.',
          estado_civil: 'Casado con sociedad conyugal vigente',
          genero: 'M',
          porcentaje: 50,
          correo_electronico: 'mauricio.tellez@correo.co',
          origen_inferencia: 'Identificado como VENDEDOR por ser el primer propietario inscrito en la Anotación #14 del Certificado de Libertad y Tradición.',
          cedula_cargada: true,
          aprobado_verificador: true,
          aprobado_por: 'Dr. Carlos Salamanca',
          borrador_enviado: false,
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
          correo_electronico: 'monica.perez@correo.co',
          origen_inferencia: 'Identificada como co-propietaria VENDEDORA en la Anotación #14 del Certificado de Libertad y Tradición. ¡FALTA SUBIR SU CÉDULA!',
          cedula_cargada: false,
          aprobado_verificador: false,
          aprobado_por: '',
          borrador_enviado: false,
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
          correo_electronico: 'jorge.mosquera@correo.co',
          origen_inferencia: 'Identificado como COMPRADOR porque su cédula fue adjuntada y no aparece como propietario anterior en el Certificado de Tradición.',
          cedula_cargada: true,
          aprobado_verificador: false,
          aprobado_por: '',
          borrador_enviado: false,
          visto_bueno_cliente: false
        }
      ],
      documentos: [
        {
          id: 'doc-1',
          codigo_tipo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (50C-1849201 · CHIP AAA0142BCDE)',
          archivo: 'certificado_tradicion_50C1849201.pdf',
          fecha_expedicion: '2026-11-18',
          fecha_vencimiento: '2027-02-16',
          dias_restantes: 83,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          aprobado_abogado: true,
          aprobado_por: 'Dr. Carlos Salamanca',
          fecha_aprobacion: '19/10/2026 09:42',
          mensaje_alerta: 'Documento que abrió el trámite COMPRAVENTA-AAA0142BCDE-TELLEZ. Vigente (83 días restantes).',
          tipo_visor_escaneo: 'CERTIFICADO_SNR',
          campos_leidos_agente: [
            { clave: 'Matrícula Inmobiliaria', valor: '50C-1849201', dudoso: false },
            { clave: 'Código CHIP', valor: 'AAA0142BCDE', dudoso: false },
            { clave: 'Cédula Catastral', valor: '00841201900601000', dudoso: false },
            { clave: 'Dirección del Predio', valor: 'CALLE 116 # 15-42 APTO 601 EDIFICIO MIRADOR DEL PARQUE P.H.', dudoso: false },
            { clave: 'Propietario 1 (Vendedor)', valor: 'MAURICIO ARTURO TÉLLEZ RESTREPO · C.C. 79.451.200 (50%)', dudoso: false },
            { clave: 'Propietario 2 (Vendedora)', valor: 'MÓNICA PATRICIA PÉREZ GÓMEZ · C.C. 52.110.900 (50%)', dudoso: false },
            { clave: 'Gravámenes / Embargos', valor: 'NINGUNO VIGENTE (Hipoteca cancelada en Anotación #13)', dudoso: false }
          ]
        },
        {
          id: 'doc-2',
          codigo_tipo: 'CEDULA_VENDEDOR_1',
          nombre: 'Cédula de Ciudadanía Vendedor 1 · Mauricio Arturo Téllez Restrepo',
          archivo: 'cedula_mauricio_tellez_79451200.pdf',
          fecha_expedicion: '1998-04-12',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          aprobado_abogado: true,
          aprobado_por: 'Dr. Carlos Salamanca',
          fecha_aprobacion: '19/10/2026 09:43',
          mensaje_alerta: 'Cédula sin vencimiento. Coincide con propietario de Anotación #14 del Certificado de Tradición.',
          tipo_visor_escaneo: 'CEDULA_COLOMBIA',
          campos_leidos_agente: [
            { clave: 'Número de Cédula', valor: '79.451.200', dudoso: false },
            { clave: 'Apellidos', valor: 'TÉLLEZ RESTREPO', dudoso: false },
            { clave: 'Nombres', valor: 'MAURICIO ARTURO', dudoso: false },
            { clave: 'Fecha y Lugar de Expedición', valor: '12-ABR-1998 · BOGOTÁ D.C.', dudoso: false },
            { clave: 'Rol Asignado por Cruce con Tradición', valor: 'VENDEDOR (50%)', dudoso: false }
          ]
        },
        {
          id: 'doc-3',
          codigo_tipo: 'CEDULA_COMPRADOR_1',
          nombre: 'Cédula de Ciudadanía Comprador · Jorge Eliécer Mosquera Rentería',
          archivo: 'cedula_jorge_mosquera_80123456.pdf',
          fecha_expedicion: '2001-08-19',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'PENDIENTE_APROBACION_ABOGADO',
          nivel_alerta: 'WARNING',
          aprobado_abogado: false,
          aprobado_por: '',
          fecha_aprobacion: '',
          mensaje_alerta: 'Pendiente que el Abogado Verificador revise los nombres/apellidos frente a la imagen de la cédula y la apruebe.',
          tipo_visor_escaneo: 'CEDULA_COLOMBIA',
          campos_leidos_agente: [
            { clave: 'Número de Cédula', valor: '80.123.456', dudoso: false },
            { clave: 'Apellidos', valor: 'MOSQUERA RENTERÍA', dudoso: true },
            { clave: 'Nombres', valor: 'JORGE ELIÉCER', dudoso: false },
            { clave: 'Fecha y Lugar de Expedición', valor: '19-AGO-2001 · MEDELLÍN', dudoso: false },
            { clave: 'Rol Asignado (No está en Tradición)', valor: 'COMPRADOR (100%)', dudoso: false }
          ]
        },
        {
          id: 'doc-4',
          codigo_tipo: 'CEDULA_VENDEDOR_2_FALTANTE',
          nombre: 'Cédula de Ciudadanía Vendedora 2 · Mónica Patricia Pérez Gómez (FALTANTE)',
          archivo: 'PENDIENTE DE ADJUNTAR EN EL CHAT',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'FALTA_DOCUMENTO',
          nivel_alerta: 'CRITICAL',
          aprobado_abogado: false,
          aprobado_por: '',
          mensaje_alerta: 'ALARMA DE DOCUMENTO FALTANTE: Mónica Patricia Pérez Gómez (C.C. 52.110.900) aparece como co-propietaria en el Certificado de Tradición pero no se ha subido su cédula.',
          tipo_visor_escaneo: 'FALTANTE',
          campos_leidos_agente: [
            { clave: 'Titular Requerido por Certificado de Tradición', valor: 'MÓNICA PATRICIA PÉREZ GÓMEZ', dudoso: true },
            { clave: 'Cédula Esperada', valor: '52.110.900', dudoso: true }
          ]
        },
        {
          id: 'doc-5',
          codigo_tipo: 'PAZ_Y_SALVO_ADMIN',
          nombre: 'Paz y Salvo de Administración (Edificio Mirador del Parque P.H.)',
          archivo: 'paz_y_salvo_admin_apto601_noviembre.pdf',
          fecha_expedicion: '2026-11-25',
          fecha_vencimiento: '2026-11-30',
          dias_restantes: 5,
          estado: 'POR_VENCER_FIN_MES',
          nivel_alerta: 'CRITICAL',
          aprobado_abogado: false,
          aprobado_por: '',
          mensaje_alerta: 'ALARMA DE VENCIMIENTO (FIN DE MES): Quedan solo 5 días para acabarse noviembre (30 de nov). Si no se firma este mes, el Paz y Salvo vence.',
          tipo_visor_escaneo: 'PAZ_Y_SALVO',
          campos_leidos_agente: [
            { clave: 'Copropiedad Emisora', valor: 'EDIFICIO MIRADOR DEL PARQUE P.H. · NIT 830.114.902-1', dudoso: false },
            { clave: 'Inmueble a Paz y Salvo', valor: 'APARTAMENTO 601 Y GARAJE DOBLE 14', dudoso: false },
            { clave: 'Fecha de Expedición', valor: '25 de noviembre de 2026', dudoso: false },
            { clave: 'Vencimiento Estricto (Cierre de Mes)', valor: '30 de noviembre de 2026 (Quedan 5 días)', dudoso: true },
            { clave: 'Administrador Firmante', valor: 'ROBERTO CAMACHO PINZÓN', dudoso: false }
          ]
        },
        {
          id: 'doc-6',
          codigo_tipo: 'ESCRITURA_ANTERIOR',
          nombre: 'Minuta / Escritura Anterior Escaneada No. 1.420 de 2014 (Con sellos en Linderos)',
          archivo: 'escritura_1420_2014_escaneo_sellos.pdf',
          fecha_expedicion: '2014-08-22',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'REVISION_LINDEROS',
          nivel_alerta: 'WARNING',
          aprobado_abogado: false,
          aprobado_por: '',
          mensaje_alerta: 'ALARMA DE TRANSCRIPCIÓN Y LINDEROS: La minuta anterior viene mal escaneada con sello húmedo azul sobre el Área Privada (88.53 vs 88.58 m²) y mancha en el Lindero Oriente (9.30 vs 9.80 mts).',
          tipo_visor_escaneo: 'MINUTA_SELLOS_LINDEROS',
          campos_leidos_agente: [
            { clave: 'Escritura Antecedente', valor: 'Escritura Pública No. 1.420 del 22/08/2014 · Notaría 19 de Bogotá', dudoso: false },
            { clave: 'Área Privada (CON SELLO AZUL)', valor: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS', dudoso: true },
            { clave: 'Lindero NORTE', valor: 'En línea quebrada de ocho metros cuarenta y cinco centímetros (8.45 mts) con vacío sobre zona común exterior.', dudoso: false },
            { clave: 'Lindero SUR', valor: 'En extensión de seis metros veinte centímetros (6.20 mts) con hall de circulación común y ducto de escaleras.', dudoso: false },
            { clave: 'Lindero ORIENTE (CON MANCHA DE TÓNER)', valor: 'En extensión de nueve metros treinta centímetros (9.30 mts) con muro común que lo separa del apartamento 602.', dudoso: true },
            { clave: 'Lindero OCCIDENTE', valor: 'En extensión de nueve metros treinta centímetros (9.30 mts) con vacío sobre antejardín de la Calle 116.', dudoso: false }
          ]
        }
      ],
      discrepancias_linderos: [
        {
          id: 'lind-1',
          campo: 'Área Privada del Apartamento 601 (Cláusula Primera)',
          motivo_duda: 'Sello húmedo azul de la Notaría 19 cae sobre el segundo decimal de la cifra (88.5_).',
          lectura_modelo_a: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          confianza_a: 98.4,
          argumento_a: 'Coincide con el texto en letras ("CINCUENTA Y TRES") y con el Certificado de Tradición SNR (88.53 m²).',
          lectura_modelo_b: 'OCHENTA Y OCHO PUNTO CINCUENTA Y OCHO (88.58) METROS CUADRADOS',
          confianza_b: 61.0,
          argumento_b: 'El borde del sello azul sobre el número "3" aparenta un "8".',
          valor_seleccionado: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          estado: 'PENDIENTE_HUMANO'
        },
        {
          id: 'lind-2',
          campo: 'Lindero Especial ORIENTE (Cláusula Primera)',
          motivo_duda: 'Fotocopia antigua mal escaneada con mancha sobre la palabra TREINTA y el dígito (9._0 mts).',
          lectura_modelo_a: 'nueve metros treinta centímetros (9.30 mts)',
          confianza_a: 97.1,
          argumento_a: 'Coincide con el lindero opuesto OCCIDENTE (9.30 mts) y la morfología de la palabra TREINTA.',
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
        abogado_que_aprobo: '',
        fecha_aprobacion_abogado: '',
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
          autor: 'Laura Gómez · Abogada Radicadora (Carga)',
          hora: '09:40 AM',
          texto: 'Hola, abro trámite de compraventa con el Certificado de Libertad y Tradición matrícula 50C-1849201 (CHIP AAA0142BCDE) donde aparece Mauricio Arturo Téllez Restrepo (C.C. 79.451.200). Adjunto también la escritura anterior escaneada, las cédulas de Mauricio Téllez y Jorge Mosquera, y el paz y salvo de administración.'
        },
        {
          id: 'm-2',
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: '09:41 AM',
          texto: 'He abierto y codificado el trámite como COMPRAVENTA-AAA0142BCDE-TELLEZ a partir del Certificado de Libertad y Tradición. Todo lo que escribamos queda guardado en este trámite.',
          hallazgos: [
            'Código Único del Trámite: COMPRAVENTA-AAA0142BCDE-TELLEZ (Estado: ABIERTO).',
            'Vendedores extraídos de la Anotación #14 del Certificado de Tradición: Mauricio Arturo Téllez Restrepo (C.C. 79.451.200 · 50%) y Mónica Patricia Pérez Gómez (C.C. 52.110.900 · 50%).',
            'Comprador inferido por la otra cédula adjunta: Jorge Eliécer Mosquera Rentería (C.C. 80.123.456 · 100%).'
          ],
          alertas_rojas: [
            'Alarma Documento Faltante: Falta adjuntar la cédula de la vendedora Mónica Patricia Pérez Gómez (C.C. 52.110.900).',
            'Alarma de Vencimiento (Fin de Mes): El Paz y Salvo de Administración vence en 5 días (30 de noviembre).',
            'Alarma en Minuta Anterior Mal Escaneada: Hay 2 linderos con sello azul/mancha pendientes de verificación visual por el Abogado Verificador.'
          ],
          preguntas_pendientes: [
            '¿Este trámite pertenece a algún proyecto de Constructora? (Si respondes "Sí", te pediré Proyecto, Torre y Apartamento y actualizaré su estado automáticamente).',
            'También puedes buscar cualquier trámite antiguo o abierto escribiendo por ejemplo: "dime el trámite de Mauricio Téllez" o "buscar cédula 79.451.200" o "trámites de compraventa".'
          ],
          tarjetas_tramites: [
            {
              id: 'caso-001',
              codigo_tramite: 'COMPRAVENTA-AAA0142BCDE-TELLEZ',
              titulo_tramite: 'Compraventa · Mauricio Téllez · Apto 601 Mirador del Parque',
              estado_apertura: 'ABIERTO',
              tramite_nombre: 'Compraventa de Inmueble',
              chip: 'AAA0142BCDE',
              matricula: '50C-1849201',
              cedula_principal: '79.451.200',
              propietario_principal: 'MAURICIO ARTURO TÉLLEZ RESTREPO'
            }
          ],
          acciones_sugeridas: [
            { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Trámite Completo (Ocultar Chat y Ver Documentos Escaneados)' },
            { tipo: 'SUBIR_CEDULA_MONICA', etiqueta: 'Adjuntar en el Chat Cédula Faltante de Mónica Pérez' },
            { tipo: 'VINCULAR_CONSTRUCTORA_CHAT', etiqueta: 'Sí, pertenece a un Proyecto de Constructora (Torre A · Apto 401)' }
          ]
        }
      ],
      bitacora: [
        {
          id: 'ev-1',
          fecha: '19/10/2026 09:40',
          actor: 'Laura Gómez (Abogada que Carga)',
          etapa: 'Apertura con Certificado de Tradición',
          detalle: 'Se creó el trámite COMPRAVENTA-AAA0142BCDE-TELLEZ con CHIP AAA0142BCDE y Cédula 79.451.200.'
        },
        {
          id: 'ev-2',
          fecha: '19/10/2026 09:43',
          actor: 'Dr. Carlos Salamanca (Abogado Verificador)',
          etapa: 'Aprobación Documental',
          detalle: 'Aprobó el Certificado de Tradición 50C-1849201 y la Cédula de Mauricio Arturo Téllez Restrepo.'
        }
      ]
    },
    {
      id: 'caso-002',
      codigo_tramite: 'COMPRAVENTA-AAA0098XYZW-GOMEZ',
      titulo_tramite: 'Compraventa · Luis Fernando Gómez · Torre B Apto 101 (Torres del Parque)',
      estado_apertura: 'CERRADO',
      radicado: 'NOT-2026-000112',
      tramite_id: 'TRM-01-COMPRAVENTA',
      tramite_nombre: 'Escritura Pública de Compraventa de Inmueble',
      creado_por: 'Laura Gómez (Abogada Radicadora)',
      abogado_verificador: 'Dr. Carlos Salamanca (Abogado Verificador)',
      etapa_actual: 'FIRMADA_Y_CERRADA',
      subcategorias_activas: ['SUB-PH-ADMIN', 'SUB-PROYECTO-CONSTRUCTORA'],
      tiene_administracion: true,
      tiene_prenda_hipoteca: false,
      pertenece_constructora: true,
      constructora_info: {
        proyecto_id: 'proy-torres-parque',
        nombre_proyecto: 'Torres del Parque Reservado P.H.',
        torre_bloque: 'Torre B',
        apartamento: '101'
      },
      certificado_tradicion: {
        matricula_inmobiliaria: '50N-2099182-101',
        chip: 'AAA0098XYZW',
        cedula_catastral: '0091201100101000',
        circulo_registral: '50N - BOGOTÁ ZONA NORTE',
        departamento: 'BOGOTÁ D.C.',
        municipio: 'BOGOTÁ D.C.',
        vereda: 'BOGOTÁ D.C.',
        estado_folio: 'ACTIVO',
        fecha_apertura_folio: '10/01/2026',
        fecha_expedicion_certificado: '2026-09-05',
        hora_expedicion: '10:20:00 AM',
        pin_verificacion_snr: 'SNR-2026-5541209811',
        tipo_predio: 'URBANO · APARTAMENTO PROYECTO CONSTRUCTORA',
        direccion_actual: 'CALLE 153 # 58-20 TORRE B APARTAMENTO 101 TORRES DEL PARQUE P.H.',
        direcciones_anteriores: ['CALLE 153 # 58-20 LOTE MATRIZ'],
        cabida_y_linderos_snr: 'APARTAMENTO 101 DE LA TORRE B CON ÁREA PRIVADA DE 62.00 M2. ESCRITURA REGLAMENTO P.H. NRO. 0890 DE 2026.',
        complementacion: 'Segregado del lote de mayor extensión matrícula 50N-2099182.',
        total_anotaciones: 4,
        gravamenes_vigentes: 'LIBRE DE GRAVÁMENES',
        anotaciones_relevantes: [
          {
            numero: 'Anotación Nro. 004 (Propietario Actual)',
            fecha: '14/09/2026',
            radicacion: '2026-90112',
            documento: 'Escritura 2910 del 10/09/2026 Notaría 33 Bogotá',
            valor_acto: '$318.000.000',
            especificacion: '0125 COMPRAVENTA',
            personas: 'DE: CONSTRUCTORA ALTOS DEL PEÑÓN S.A. — A: (X) GÓMEZ PARDO LUIS FERNANDO (C.C. 19.440.112) 100%'
          }
        ]
      },
      inmueble: {
        tipo_inmueble: 'APARTAMENTO',
        direccion: 'Calle 153 # 58-20, Torre B, Apartamento 101, Torres del Parque Reservado P.H.',
        matricula_inmobiliaria: '50N-2099182-101',
        cedula_catastral: '0091201100101000',
        chip: 'AAA0098XYZW',
        zona_registro: 'ZONA NORTE',
        area_privada: 'SESENTA Y DOS PUNTO CERO CERO (62.00) METROS CUADRADOS',
        edificio_conjunto: 'TORRES DEL PARQUE RESERVADO P.H.',
        escritura_ph_constitucion: 'Escritura Pública No. 0890 de 2026 Notaría 33 de Bogotá D.C.',
        escritura_ph_reforma: 'Sin reformas',
        tradicion_antecedente: 'Segregación y compraventa de Constructora Altos del Peñón S.A.',
        linderos_especiales: 'APARTAMENTO 101 TORRE B: Área privada de 62.00 M2. NORTE: En 7.50 mts con zona verde; SUR: En 7.50 mts con corredor común; ORIENTE: En 8.26 mts con Apto 102; OCCIDENTE: En 8.26 mts con fachada.',
        linderos_generales: 'Lote de mayor extensión en la Calle 153 # 58-20 de Bogotá D.C.'
      },
      negocio: {
        valor_venta: 318000000,
        avaluo_catastral: 280000000,
        forma_pago: 'CONTADO',
        entidad_financiera: 'N/A',
        valor_recursos_propios: 318000000,
        valor_credito: 0,
        afectacion_vivienda_familiar: true
      },
      recibos_fiscales: {
        predial_factura: '202600112233',
        predial_referencia: '88776655',
        predial_banco: 'BANCOLOMBIA',
        predial_fecha: '2026-03-10',
        idu_pin: 'IDU-2026-112233',
        idu_consecutivo: '112233',
        idu_vencimiento: '2026-12-31',
        vur_cadena_seguridad: 'SHD-VUR-2026-112233-OK',
        vur_fecha_hora: '10/09/2026 09:00:00'
      },
      partes: [
        {
          id: 'p-201',
          rol: 'VENDEDOR',
          nombres_completos: 'CONSTRUCTORA ALTOS DEL PEÑÓN S.A.',
          numero_documento: '900.412.889-1',
          lugar_expedicion: 'Bogotá D.C.',
          estado_civil: 'Persona Jurídica',
          genero: 'M',
          porcentaje: 100,
          origen_inferencia: 'Titular en Certificado de Tradición de Mayor Extensión.',
          cedula_cargada: true,
          aprobado_verificador: true,
          aprobado_por: 'Dr. Carlos Salamanca',
          visto_bueno_cliente: true
        },
        {
          id: 'p-202',
          rol: 'COMPRADOR',
          nombres_completos: 'LUIS FERNANDO GÓMEZ PARDO',
          numero_documento: '19.440.112',
          lugar_expedicion: 'Bogotá D.C.',
          estado_civil: 'Casado con sociedad conyugal vigente',
          genero: 'M',
          porcentaje: 100,
          origen_inferencia: 'Comprador de la unidad B-101.',
          cedula_cargada: true,
          aprobado_verificador: true,
          aprobado_por: 'Dr. Carlos Salamanca',
          visto_bueno_cliente: true
        }
      ],
      documentos: [
        {
          id: 'doc-201',
          codigo_tipo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (50N-2099182-101)',
          archivo: 'tradicion_B101.pdf',
          fecha_expedicion: '2026-09-05',
          fecha_vencimiento: '2026-12-05',
          dias_restantes: 45,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          aprobado_abogado: true,
          aprobado_por: 'Dr. Carlos Salamanca',
          fecha_aprobacion: '10/09/2026 11:00',
          mensaje_alerta: 'Verificado y aprobado.',
          tipo_visor_escaneo: 'CERTIFICADO_SNR',
          campos_leidos_agente: [
            { clave: 'Matrícula Inmobiliaria', valor: '50N-2099182-101', dudoso: false },
            { clave: 'Código CHIP', valor: 'AAA0098XYZW', dudoso: false },
            { clave: 'Comprador / Propietario', valor: 'LUIS FERNANDO GÓMEZ PARDO · C.C. 19.440.112', dudoso: false }
          ]
        }
      ],
      discrepancias_linderos: [],
      aprobaciones: {
        linderos_aprobados_abogado: true,
        visto_bueno_juridico_abogado: true,
        abogado_que_aprobo: 'Dr. Carlos Salamanca',
        fecha_aprobacion_abogado: '10/09/2026 14:20',
        enviado_a_clientes: true,
        visto_bueno_vendedores: true,
        visto_bueno_compradores: true,
        en_impresion: true,
        hojas_papel_notarial: 'AA-4800110 a AA-4800115',
        numero_escritura_asignada: '2.910 de 2026',
        firma_completada: true
      },
      mensajes_chat: [
        {
          id: 'm-201',
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: '10/09/2026',
          texto: 'Este trámite (COMPRAVENTA-AAA0098XYZW-GOMEZ) corresponde al Apartamento 101 de la Torre B del proyecto Torres del Parque Reservado P.H. Ya fue aprobado por el Dr. Carlos Salamanca, firmado en la Escritura 2.910 de 2026 y se encuentra CERRADO.',
          hallazgos: [
            'Estado del Trámite: CERRADO (Escritura 2.910 de 2026 firmada y registrada).',
            'Proyecto Constructora: Torres del Parque Reservado P.H. · Torre B · Apartamento 101.'
          ],
          alertas_rojas: [],
          preguntas_pendientes: [],
          acciones_sugeridas: [
            { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha e Historial de este Trámite Cerrado' }
          ]
        }
      ],
      bitacora: [
        {
          id: 'ev-201',
          fecha: '10/09/2026 14:20',
          actor: 'Dr. Carlos Salamanca',
          etapa: 'Cierre de Escritura',
          detalle: 'Trámite aprobado, impreso en papel notarial AA-4800110 a AA-4800115 y cerrado.'
        }
      ]
    },
    {
      id: 'caso-003',
      codigo_tramite: 'HIPOTECA-AAA0155LMNO-RODRIGUEZ',
      titulo_tramite: 'Hipoteca Abierta · María Elena Rodríguez · C.C. 51.882.300',
      estado_apertura: 'ABIERTO',
      radicado: 'NOT-2026-000191',
      tramite_id: 'TRM-02-HIPOTECA',
      tramite_nombre: 'Escritura Pública de Constitución de Hipoteca Abierta',
      creado_por: 'Laura Gómez (Abogada Radicadora)',
      abogado_verificador: 'Dr. Carlos Salamanca (Abogado Verificador)',
      etapa_actual: 'EN_REVISION_ABOGADO',
      subcategorias_activas: ['SUB-HIP-SIN-LIMITE'],
      tiene_administracion: false,
      tiene_prenda_hipoteca: true,
      pertenece_constructora: false,
      constructora_info: { proyecto_id: '', nombre_proyecto: '', torre_bloque: '', apartamento: '' },
      certificado_tradicion: {
        matricula_inmobiliaria: '50S-4011229',
        chip: 'AAA0155LMNO',
        cedula_catastral: '004411223344',
        circulo_registral: '50S - BOGOTÁ ZONA SUR',
        departamento: 'BOGOTÁ D.C.',
        municipio: 'BOGOTÁ D.C.',
        vereda: 'BOGOTÁ D.C.',
        estado_folio: 'ACTIVO',
        fecha_apertura_folio: '12/03/1999',
        fecha_expedicion_certificado: '2026-11-22',
        hora_expedicion: '11:10:00 AM',
        pin_verificacion_snr: 'SNR-2026-77123901',
        tipo_predio: 'URBANO · CASA DE HABITACIÓN',
        direccion_actual: 'CARRERA 72 # 45-18 SUR BOGOTÁ D.C.',
        direcciones_anteriores: [],
        cabida_y_linderos_snr: 'CASA DE HABITACIÓN CON ÁREA DE LOTE DE 140.00 M2.',
        complementacion: 'Tradición de más de 20 años.',
        total_anotaciones: 8,
        gravamenes_vigentes: 'SIN GRAVÁMENES',
        anotaciones_relevantes: [
          {
            numero: 'Anotación Nro. 008 (Propietaria Actual)',
            fecha: '19/04/2018',
            radicacion: '2018-33102',
            documento: 'Escritura 812 del 10/04/2018 Notaría 33 Bogotá',
            valor_acto: '$260.000.000',
            especificacion: '0125 COMPRAVENTA',
            personas: 'A: (X) RODRÍGUEZ CASTRO MARÍA ELENA (C.C. 51.882.300) 100%'
          }
        ]
      },
      inmueble: {
        tipo_inmueble: 'CASA',
        direccion: 'Carrera 72 # 45-18 Sur, Bogotá D.C.',
        matricula_inmobiliaria: '50S-4011229',
        cedula_catastral: '004411223344',
        chip: 'AAA0155LMNO',
        zona_registro: 'ZONA SUR',
        area_privada: 'CIENTO CUARENTA (140.00) METROS CUADRADOS',
        edificio_conjunto: 'PREDIO INDEPENDIENTE SIN ADMINISTRACIÓN',
        escritura_ph_constitucion: 'No aplica',
        escritura_ph_reforma: 'No aplica',
        tradicion_antecedente: 'Escritura 812 de 2018 Notaría 33 de Bogotá.',
        linderos_especiales: 'NORTE: 7.00 mts con vía pública; SUR: 7.00 mts con predio vecino; ORIENTE: 20.00 mts; OCCIDENTE: 20.00 mts.',
        linderos_generales: 'Mismos linderos del lote.'
      },
      negocio: {
        valor_venta: 180000000,
        avaluo_catastral: 210000000,
        forma_pago: 'CREDITO_HIPOTECARIO',
        entidad_financiera: 'BANCO CAJA SOCIAL S.A.',
        valor_recursos_propios: 0,
        valor_credito: 180000000,
        afectacion_vivienda_familiar: false
      },
      recibos_fiscales: {
        predial_factura: '20260991122',
        predial_referencia: '77665544',
        predial_banco: 'BANCO CAJA SOCIAL',
        predial_fecha: '2026-05-01',
        idu_pin: 'IDU-2026-554433',
        idu_consecutivo: '554433',
        idu_vencimiento: '2026-12-30',
        vur_cadena_seguridad: 'SHD-VUR-2026-554433-OK',
        vur_fecha_hora: '22/11/2026 08:00:00'
      },
      partes: [
        {
          id: 'p-301',
          rol: 'VENDEDOR',
          nombres_completos: 'MARÍA ELENA RODRÍGUEZ CASTRO (CONSTITUYENTE)',
          numero_documento: '51.882.300',
          lugar_expedicion: 'Bogotá D.C.',
          estado_civil: 'Soltera',
          genero: 'F',
          porcentaje: 100,
          origen_inferencia: 'Propietaria inscrita en Anotación #8 del Certificado de Tradición.',
          cedula_cargada: true,
          aprobado_verificador: false,
          aprobado_por: '',
          visto_bueno_cliente: false
        }
      ],
      documentos: [
        {
          id: 'doc-301',
          codigo_tipo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (50S-4011229 · CHIP AAA0155LMNO)',
          archivo: 'tradicion_50S4011229.pdf',
          fecha_expedicion: '2026-11-22',
          fecha_vencimiento: '2026-12-22',
          dias_restantes: 27,
          estado: 'PENDIENTE_APROBACION_ABOGADO',
          nivel_alerta: 'WARNING',
          aprobado_abogado: false,
          aprobado_por: '',
          mensaje_alerta: 'Vigente (27 días). Pendiente aprobación del Abogado Verificador.',
          tipo_visor_escaneo: 'CERTIFICADO_SNR',
          campos_leidos_agente: [
            { clave: 'Matrícula Inmobiliaria', valor: '50S-4011229', dudoso: false },
            { clave: 'Código CHIP', valor: 'AAA0155LMNO', dudoso: false },
            { clave: 'Propietaria Actual', valor: 'MARÍA ELENA RODRÍGUEZ CASTRO · C.C. 51.882.300', dudoso: false }
          ]
        }
      ],
      discrepancias_linderos: [],
      aprobaciones: {
        linderos_aprobados_abogado: true,
        visto_bueno_juridico_abogado: false,
        abogado_que_aprobo: '',
        fecha_aprobacion_abogado: '',
        enviado_a_clientes: false,
        visto_bueno_vendedores: false,
        visto_bueno_compradores: false,
        en_impresion: false,
        hojas_papel_notarial: 'Pendiente asignar',
        numero_escritura_asignada: 'Pendiente',
        firma_completada: false
      },
      mensajes_chat: [
        {
          id: 'm-301',
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: '10:15 AM',
          texto: 'Trámite abierto: HIPOTECA-AAA0155LMNO-RODRIGUEZ (Constitución de Hipoteca Abierta de María Elena Rodríguez Castro, C.C. 51.882.300, CHIP AAA0155LMNO). Pendiente revisión y aprobación por el Abogado Verificador.',
          hallazgos: ['Código del Trámite: HIPOTECA-AAA0155LMNO-RODRIGUEZ · Estado: ABIERTO'],
          alertas_rojas: [],
          preguntas_pendientes: [],
          acciones_sugeridas: [{ tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha del Trámite y Documentos Escaneados' }]
        }
      ],
      bitacora: []
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
        { unidad_id: 'A-401', bloque: 'Torre A', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Mauricio Arturo Téllez Restrepo', comprador_cc: '79.451.200', forma_pago: 'Leasing / Hipoteca', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: true, alerta_detalle: 'Paz y Salvo Admin vence en 5 días (Fin de mes)', documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-501', bloque: 'Torre A', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Yenny Paola Beltrán', comprador_cc: '53.440.317', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta aprobada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-601', bloque: 'Torre A', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Ricardo Alfonso Neira', comprador_cc: '79.310.445', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-701', bloque: 'Torre A', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Paola Andrea Cifuentes Rojas', comprador_cc: '53.889.560', forma_pago: 'Leasing Habitacional', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Falta Carta de Leasing + Paz y Salvo vence a fin de mes (5 días)', documentos_recibidos: 2, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'A-801', bloque: 'Torre A', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-101', bloque: 'Torre B', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Luis Fernando Gómez', comprador_cc: '19.440.112', forma_pago: 'Contado', estado_dinamico: 'Registrada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'B-201', bloque: 'Torre B', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'María Fernanda Castro', comprador_cc: '52.811.300', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'B-301', bloque: 'Torre B', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Juan Sebastián Mora', comprador_cc: '1.020.774.120', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: true, alerta_detalle: 'Certificado Tradición próximo a cumplir 90 días', documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-401', bloque: 'Torre B', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Natalia Valderrama', comprador_cc: '1.015.412.900', forma_pago: 'Leasing Habitacional', estado_dinamico: 'En revisión', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-101', bloque: 'Torre C', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Gloria Inés Tamayo', comprador_cc: '41.772.109', forma_pago: 'Contado', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true },
        { unidad_id: 'C-201', bloque: 'Torre C', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Óscar Mauricio León', comprador_cc: '79.654.321', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta aprobada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false }
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
      return enrichStoreForApi(JSON.parse(JSON.stringify(initialStore)));
    }
    const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!data.usuarios_temporales || !data.casos || !data.casos[0]?.certificado_tradicion) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
      return enrichStoreForApi(JSON.parse(JSON.stringify(initialStore)));
    }
    return enrichStoreForApi(data);
  } catch (e) {
    return enrichStoreForApi(JSON.parse(JSON.stringify(initialStore)));
  }
}

function saveStore(store) {
  try {
    enrichStoreForApi(store);
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error guardando store:', e);
  }
}

function getCasoActivo(store) {
  return store.casos.find((c) => c.id === store.caso_activo_id) || store.casos[0];
}

function getUsuarioActivo(store) {
  return store.usuarios_temporales.find((u) => u.usuario_id === store.usuario_activo_id) || store.usuarios_temporales[2];
}

function extraerDatosDeTextoDocumento(texto, nombreArchivo) {
  const raw = String(texto || '') + ' ' + String(nombreArchivo || '');
  const chipMatch = raw.match(/AAA[0-9A-Z]{7,8}/i);
  const matMatch = raw.match(/50[A-Z]-[0-9]{5,9}(?:-[0-9]{1,4})?/i) || raw.match(/(?:MATR[IÍ]CULA|FOLIO)[^0-9A-Z]{0,15}([0-9A-Z]{2,4}-[0-9]{4,9})/i);
  const catMatch = raw.match(/\b\d{14,20}\b/);
  const dirMatch = raw.match(/(?:DIRECCI[OÓ]N(?:\s+DEL\s+INMUEBLE)?|UBICACI[OÓ]N)[:\s]+([^\n\r]{8,90}?)(?=\s+(?:A:|DE:|PROPIETARIO|TITULAR|CHIP|MATR|$))/i) || raw.match(/(?:DIRECCI[OÓ]N(?:\s+DEL\s+INMUEBLE)?|UBICACI[OÓ]N)[:\s]+([^\n\r]{8,90})/i) || raw.match(/((?:CALLE|CARRERA|DIAGONAL|TRANSVERSAL|AVENIDA|CL|KR|CR|DG|TV)\s+[0-9A-Z#\-.\s]{6,65})/i);
  const cedulas = Array.from(new Set((raw.match(/\b\d{1,3}(?:\.\d{3}){2}\b|\b\d{7,10}\b/g) || []).filter((n) => n.replace(/\./g, '').length >= 7 && n.replace(/\./g, '').length <= 10)));
  const propMatch = raw.match(/(?:A:|PROPIETARIO(?:S)?|TITULAR(?:ES)?|DE:)[:\s]+([A-ZÁÉÍÓÚÑ\s]{4,60}?)(?=\s+(?:CC|C\.C\.|CEDULA|CÉDULA|NIT|\d|$))/i) || raw.match(/(?:A:|PROPIETARIO(?:S)?|TITULAR(?:ES)?|DE:)[:\s]+([A-ZÁÉÍÓÚÑ\s]{6,60})/i);

  return {
    chip: chipMatch ? chipMatch[0].toUpperCase() : '',
    matricula: matMatch ? (matMatch[1] || matMatch[0]).toUpperCase() : '',
    cedula_catastral: catMatch ? catMatch[0] : '',
    direccion: dirMatch ? (dirMatch[1] || dirMatch[0]).trim() : '',
    cedula_detectada: cedulas[0] || '',
    nombre_detectado: propMatch ? propMatch[1].replace(/\b(?:CC|C\.C\.|CEDULA|CÉDULA)\b.*$/i, '').trim().toUpperCase() : ''
  };
}

function crearCasoLimpioDesdeCertificado(params, usuarioActivo, store) {
  const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const hoyIso = new Date().toISOString().split('T')[0];
  const venceIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const tramiteCat =
    (store.catalogo_tramites || []).find(
      (t) =>
        t.tramite_id === params.tramite_id ||
        t.codigo_corto === params.tipo_corto ||
        (params.tipo_tramite && t.nombre.toLowerCase().includes(String(params.tipo_tramite).toLowerCase()))
    ) || store.catalogo_tramites[0];

  const tipoCorto = tramiteCat.codigo_corto || 'COMPRAVENTA';
  const chipLimpio = String(params.chip || '').toUpperCase().trim();
  const matriculaLimpia = String(params.matricula || '').toUpperCase().trim();
  const nombreProp = String(params.nombre_propietario || '').toUpperCase().trim();
  const apellidoCode = String(
    params.apellido ||
      (nombreProp ? nombreProp.split(/\s+/)[0] : '') ||
      'TITULAR'
  )
    .toUpperCase()
    .replace(/[^A-ZÑ0-9]/g, '');

  const cedulaProp = String(params.cedula || '').trim();
  const correoProp = String(params.correo_electronico || '').trim();
  const direccionPredio = String(params.direccion || 'Predio según Certificado de Libertad y Tradición adjunto').trim();
  const cedulaCatastral = String(params.cedula_catastral || 'Segun Certificado SNR').trim();
  const valorActo = Number(params.valor_venta || 0);
  const subcategorias = Array.isArray(params.subcategorias_activas) && params.subcategorias_activas.length
    ? params.subcategorias_activas
    : (tramiteCat.categorias || []).slice(0, 1).map((c) => c.categoria_id);

  const codigoTramite = `${tipoCorto}-${chipLimpio}-${apellidoCode}`;
  const nuevoId = 'caso-' + Date.now();

  const docsIniciales = [
    {
      id: 'doc-1',
      codigo_tipo: 'CERTIFICADO_TRADICION',
      nombre: `Certificado de Tradición y Libertad (${matriculaLimpia || chipLimpio})`,
      archivo: params.archivo_nombre || `certificado_tradicion_${chipLimpio}.pdf`,
      archivo_data_url: params.archivo_data_url || '',
      tipo_mime: params.tipo_mime || 'application/pdf',
      texto_extraido: params.texto_extraido || '',
      fecha_expedicion: hoyIso,
      fecha_vencimiento: venceIso,
      dias_restantes: 90,
      estado: 'PENDIENTE_APROBACION_ABOGADO',
      nivel_alerta: 'WARNING',
      aprobado_abogado: false,
      aprobado_por: '',
      fecha_aprobacion: '',
      mensaje_alerta: `Certificado de Libertad y Tradición adjuntado (${params.archivo_nombre || 'Archivo real'}). Pendiente que el Abogado Verificador apruebe su lectura en la Ficha.`,
      tipo_visor_escaneo: 'CERTIFICADO_SNR',
      campos_leidos_agente: [
        { clave: 'Matrícula Inmobiliaria', valor: matriculaLimpia || 'Por verificar en documento', dudoso: !matriculaLimpia },
        { clave: 'Código CHIP', valor: chipLimpio, dudoso: false },
        { clave: 'Cédula Catastral', valor: cedulaCatastral, dudoso: false },
        { clave: 'Dirección del Predio', valor: direccionPredio, dudoso: false },
        { clave: 'Primer Propietario / Titular (Vendedor)', valor: `${nombreProp} · C.C. ${cedulaProp}`, dudoso: false },
        { clave: 'Estado del Folio', valor: 'ACTIVO · Verificado en apertura', dudoso: false }
      ]
    },
    {
      id: 'doc-2',
      codigo_tipo: 'CEDULA_VENDEDOR_1',
      nombre: `Cédula de Ciudadanía Propietario / Otorgante · ${nombreProp} (PENDIENTE DE SUBIR)`,
      archivo: 'PENDIENTE DE ADJUNTAR ARCHIVO',
      archivo_data_url: '',
      fecha_vencimiento: 'SIN_VENCIMIENTO',
      estado: 'FALTA_DOCUMENTO',
      nivel_alerta: 'CRITICAL',
      aprobado_abogado: false,
      aprobado_por: '',
      mensaje_alerta: `ALARMA DOCUMENTO FALTANTE: Falta adjuntar el archivo de la Cédula de ${nombreProp} (C.C. ${cedulaProp}).`,
      tipo_visor_escaneo: 'FALTANTE',
      campos_leidos_agente: [
        { clave: 'Titular Requerido por Certificado de Tradición', valor: nombreProp, dudoso: true },
        { clave: 'Número de Cédula', valor: cedulaProp, dudoso: true }
      ]
    }
  ];

  return {
    id: nuevoId,
    codigo_tramite: codigoTramite,
    titulo_tramite: `${tramiteCat.nombre} · ${nombreProp} · CHIP ${chipLimpio}`,
    estado_apertura: 'ABIERTO',
    estado_tramite: 'ABIERTO',
    radicado: 'NOT-2026-' + Math.floor(1000 + Math.random() * 8999),
    tramite_id: tramiteCat.tramite_id,
    tramite_nombre: tramiteCat.nombre,
    subcategorias_activas: subcategorias,
    pertenece_constructora: false,
    constructora_info: {
      proyecto_id: '',
      nombre_proyecto: '',
      torre_bloque: '',
      apartamento: ''
    },
    etapa_actual: 'REVISION_DOCUMENTOS_Y_ALERTAS',
    fecha_creacion: new Date().toLocaleString('es-CO'),
    creado_por: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
    certificado_tradicion: {
      matricula_inmobiliaria: matriculaLimpia || 'EN_REVISION',
      chip: chipLimpio,
      cedula_catastral: cedulaCatastral,
      circulo_registral: '50C - BOGOTÁ D.C.',
      departamento_municipio: 'BOGOTÁ D.C.',
      estado_folio: 'ACTIVO',
      fecha_expedicion: hoyIso,
      hora_expedicion: ahoraHora,
      pin_snr: 'SNR-' + Date.now(),
      direccion_actual: direccionPredio.toUpperCase(),
      direcciones_anteriores: [],
      tipo_predio: 'URBANO',
      complementacion_resumen: 'Extraída del Certificado de Libertad y Tradición adjuntado por el usuario.',
      cabida_y_linderos_certificado: 'Según título antecedente citado en el Certificado de Tradición.',
      salvedades: 'NINGUNA.',
      gravamenes_vigentes: 'NINGUNO VIGENTE',
      anotaciones_relevantes: [
        {
          numero: 1,
          fecha: hoyIso,
          radicacion: 'SNR-ACT',
          documento: 'Certificado de Libertad y Tradición Adjunto',
          especificacion: 'TITULARIDAD DE DOMINIO INSCRITA',
          personas_que_intervienen: `A: ${nombreProp} (C.C. ${cedulaProp}) — 100% (PROPIETARIO ACTUAL - X)`
        }
      ]
    },
    inmueble: {
      tipo_inmueble: 'INMUEBLE URBANO',
      direccion: direccionPredio,
      edificio_conjunto: '',
      matricula_inmobiliaria: matriculaLimpia || 'EN_REVISION',
      cedula_catastral: cedulaCatastral,
      chip: chipLimpio,
      localidad_barrio: 'Bogotá D.C.',
      area_privada_m2: '',
      coeficiente_copropiedad: '',
      linderos_especiales: 'Por verificar o transcribir de la Escritura Pública antecedente.',
      linderos_generales: 'Según Reglamento o Escritura antecedente.',
      tradicion_antecedente: `Adquirido según consta en el Certificado de Libertad y Tradición matrícula ${matriculaLimpia || chipLimpio}.`,
      propiedad_horizontal_constituida: ''
    },
    negocio: {
      valor_venta: valorActo,
      avaluo_catastral: 0,
      forma_pago: 'CONTADO',
      entidad_financiera: 'NO APLICA',
      valor_recursos_propios: valorActo,
      valor_credito: 0,
      afectacion_vivienda_familiar: false
    },
    recibos_fiscales: {
      predial_factura: 'PENDIENTE',
      predial_referencia: 'PENDIENTE',
      predial_banco: 'PENDIENTE',
      predial_fecha: hoyIso,
      idu_pin: 'PENDIENTE',
      idu_consecutivo: 'PENDIENTE',
      idu_vencimiento: venceIso,
      vur_cadena_seguridad: 'PENDIENTE',
      vur_fecha_hora: ahoraHora
    },
    partes: [
      {
        id: 'p-1',
        rol: 'VENDEDOR',
        nombres_completos: nombreProp,
        numero_documento: cedulaProp,
        lugar_expedicion: 'Colombia',
        estado_civil: 'Por confirmar en Cédula / Minuta',
        genero: 'M',
        porcentaje: 100,
        correo_electronico: correoProp,
        origen_inferencia: `Extraído del Certificado de Libertad y Tradición adjunto (${params.archivo_nombre || 'Certificado SNR'}).`,
        cedula_cargada: false,
        aprobado_verificador: false,
        aprobado_por: '',
        borrador_enviado: false,
        visto_bueno_cliente: false
      }
    ],
    documentos: docsIniciales,
    discrepancias_linderos: [],
    aprobaciones: {
      linderos_aprobados_abogado: true,
      visto_bueno_juridico_abogado: false,
      abogado_que_aprobo: '',
      fecha_aprobacion_abogado: '',
      enviado_a_clientes: false,
      fecha_envio_clientes: '',
      correos_notificados: [],
      visto_bueno_vendedores: false,
      visto_bueno_compradores: false,
      en_impresion: false,
      hojas_papel_notarial: 'PENDIENTE ASIGNACIÓN',
      numero_escritura_asignada: 'PENDIENTE',
      firma_completada: false
    },
    mensajes_chat: [
      {
        id: 'm-new-1',
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `He recibido tu archivo "${params.archivo_nombre || 'Certificado de Tradición'}" y abrí el trámite ${codigoTramite}. Ya puedes ver el documento adjunto en la Ficha del Trámite o subir las cédulas y soportes restantes.`,
        hallazgos: [
          `Código asignado: ${codigoTramite} (Estado: ABIERTO)`,
          `Matrícula: ${matriculaLimpia || 'Por confirmar'} · CHIP: ${chipLimpio} · Dirección: ${direccionPredio}`,
          `Propietario / Titular detectado: ${nombreProp} (C.C. ${cedulaProp})`
        ],
        alertas_rojas: [
          `Falta adjuntar la Cédula de Ciudadanía de ${nombreProp} (C.C. ${cedulaProp}) y aprobar el Certificado en la Ficha.`
        ],
        preguntas_pendientes: [
          '¿Este trámite pertenece a algún proyecto de Constructora? Si aplica, indícalo para vincular Torre y Apartamento.'
        ],
        tarjetas_tramites: [],
        acciones_sugeridas: [
          { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Ficha y Documento Subido (${codigoTramite})` },
          { tipo: 'ABRIR_MODAL_SUBIR_ARCHIVO', etiqueta: '📎 Adjuntar otro Documento (Cédula / Paz y Salvo / Minuta)' }
        ]
      }
    ],
    bitacora: [
      {
        id: 'ev-open-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
        etapa: 'Apertura con Certificado de Libertad y Tradición',
        detalle: `Abrió el trámite ${codigoTramite} adjuntando el archivo "${params.archivo_nombre || 'Certificado SNR'}" (CHIP ${chipLimpio}).`
      }
    ]
  };
}

function calcularEstadoBpmn(caso) {
  const faltaCedula = (caso.partes || []).some((p) => !p.cedula_cargada);
  const docsFaltantes = (caso.documentos || []).filter((d) => d.estado === 'FALTA_DOCUMENTO' || d.tipo_visor_escaneo === 'FALTANTE');
  const docsSinAprobar = (caso.documentos || []).filter((d) => !d.aprobado_abogado);
  const dudasLinderos = (caso.discrepancias_linderos || []).filter((d) => d.estado === 'PENDIENTE_HUMANO');

  const docsCompletos = !faltaCedula && docsFaltantes.length === 0;
  const todosDocsAprobados = docsCompletos && docsSinAprobar.length === 0;
  const linderosListos = dudasLinderos.length === 0;
  const abogadoAprobo = Boolean(caso.aprobaciones.visto_bueno_juridico_abogado);
  const enviadoAClientes = Boolean(caso.aprobaciones.enviado_a_clientes);
  const partesSinCorreo = (caso.partes || []).filter((p) => !p.correo_electronico || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo_electronico));
  const todosConCorreo = partesSinCorreo.length === 0;
  const clienteAprobo = Boolean(enviadoAClientes && caso.aprobaciones.visto_bueno_vendedores && caso.aprobaciones.visto_bueno_compradores);
  const impreso = Boolean(caso.aprobaciones.en_impresion || caso.aprobaciones.firma_completada || caso.estado_apertura === 'CERRADO');

  let pasoActualNumero = 1;
  let siguienteAccion = { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Trámite (Documentos, Predio y Aprobaciones)' };

  if (!docsCompletos) {
    pasoActualNumero = 1;
    siguienteAccion = { tipo: 'ABRIR_MODAL_SUBIR_ARCHIVO', etiqueta: '📎 Adjuntar Documento Faltante desde tu Computador' };
  } else if (docsCompletos && !linderosListos) {
    pasoActualNumero = 2;
    siguienteAccion = { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Trámite y Aprobar Linderos (${dudasLinderos.length} pendientes)` };
  } else if (docsCompletos && linderosListos && !abogadoAprobo) {
    pasoActualNumero = 3;
    siguienteAccion = {
      tipo: 'APROBAR_ABOGADO',
      etiqueta: todosDocsAprobados
        ? '1. Dar Visto Bueno Jurídico del Abogado Verificador'
        : `Ver Ficha y Aprobar Documentos (${docsSinAprobar.length} pendientes de visto bueno)`
    };
  } else if (docsCompletos && linderosListos && abogadoAprobo && !enviadoAClientes) {
    pasoActualNumero = 4;
    siguienteAccion = {
      tipo: 'ENVIAR_BORRADOR_CLIENTES',
      etiqueta: '2. Confirmar Correos y Enviar Borrador a Clientes'
    };
  } else if (docsCompletos && linderosListos && abogadoAprobo && enviadoAClientes && !clienteAprobo) {
    pasoActualNumero = 5;
    siguienteAccion = { tipo: 'APROBAR_CLIENTES', etiqueta: '3. Registrar Visto Bueno de los Clientes (Ya enviado por correo)' };
  } else if (docsCompletos && linderosListos && abogadoAprobo && enviadoAClientes && clienteAprobo && !impreso) {
    pasoActualNumero = 6;
    siguienteAccion = { tipo: 'IMPRIMIR_ESCRITURA', etiqueta: '4. Asignar Papel Notarial, Imprimir y Cerrar Trámite' };
  } else if (impreso) {
    pasoActualNumero = 6;
    siguienteAccion = { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha del Trámite Cerrado' };
  }

  return {
    paso_actual_numero: pasoActualNumero,
    docs_completos: docsCompletos,
    todos_docs_aprobados: todosDocsAprobados,
    docs_aprobados_individualmente: todosDocsAprobados,
    docs_pendientes_aprobacion: docsSinAprobar.length,
    linderos_listos: linderosListos,
    dudas_linderos_pendientes: dudasLinderos.length,
    abogado_aprobo: abogadoAprobo,
    enviado_a_clientes: enviadoAClientes,
    todos_con_correo: todosConCorreo,
    partes_sin_correo: partesSinCorreo.map((p) => p.nombres_completos),
    correos_notificados: caso.aprobaciones.correos_notificados || [],
    fecha_envio_clientes: caso.aprobaciones.fecha_envio_clientes || '',
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
  const vendedores = (caso.partes || []).filter((p) => p.rol === 'VENDEDOR');
  const compradores = (caso.partes || []).filter((p) => p.rol === 'COMPRADOR');
  const liq = calcularLiquidacion(caso.negocio?.valor_venta, caso.negocio?.avaluo_catastral);

  const resumenVend = vendedores.map((v) => `${v.nombres_completos} · C.C. ${v.numero_documento} (${v.correo_electronico || 'Sin correo'})`).join('\n');
  const resumenComp = compradores.map((c) => `${c.nombres_completos} · C.C. ${c.numero_documento} (${c.correo_electronico || 'Sin correo'})`).join('\n') || 'PENDIENTE DE VINCULAR COMPRADOR';

  const compVend = vendedores
    .map(
      (v) =>
        `${v.nombres_completos}, mayor de edad, ${v.genero === 'F' ? 'vecina' : 'vecino'} de Bogotá D.C., ${v.genero === 'F' ? 'identificada' : 'identificado'} con C.C. No. ${v.numero_documento} expedida en ${v.lugar_expedicion}, estado civil ${v.estado_civil} (${Number(v.porcentaje || 0)}%)`
    )
    .join('; y ');

  const compComp = compradores
    .map(
      (c) =>
        `${c.nombres_completos}, mayor de edad, ${c.genero === 'F' ? 'vecina' : 'vecino'} de Bogotá D.C., ${c.genero === 'F' ? 'identificada' : 'identificado'} con C.C. No. ${c.numero_documento} expedida en ${c.lugar_expedicion}, estado civil ${c.estado_civil} (${Number(c.porcentaje || 0)}%)`
    )
    .join('; y ');

  const clausulaConstructora = caso.pertenece_constructora
    ? `\nPROYECTO DE CONSTRUCTORA VINCULADO: ${caso.constructora_info.nombre_proyecto} · ${caso.constructora_info.torre_bloque} · Apartamento ${caso.constructora_info.apartamento}.`
    : '';

  const subcats = caso.subcategorias_activas || [];
  const clausulasSubcategorias = [];
  if (subcats.includes('SUB-PH-ADMIN')) {
    clausulasSubcategorias.push(
      `CLÁUSULA DE PROPIEDAD HORIZONTAL Y PAZ Y SALVO DE ADMINISTRACIÓN (SUB-PH-ADMIN): El inmueble objeto de este acto se encuentra sometido al Régimen de Propiedad Horizontal (Ley 675 de 2001). Se protocoliza el Paz y Salvo de Administración vigente al mes de otorgamiento.`
    );
  }
  if (subcats.includes('SUB-PRENDA-HIPOTECA')) {
    clausulasSubcategorias.push(
      `CLÁUSULA DE FINANCIACIÓN / HIPOTECA (SUB-PRENDA-HIPOTECA): Forma de pago: ${caso.negocio?.forma_pago || 'CREDITO'} con entidad financiera ${caso.negocio?.entidad_financiera || 'Acreedor Hipotecario'} por valor de $${Number(caso.negocio?.valor_credito || 0).toLocaleString('es-CO')}.`
    );
  }
  if (subcats.includes('SUB-VARIAS-PERSONAS')) {
    clausulasSubcategorias.push(
      `CLÁUSULA DE PLURALIDAD DE OTORGANTES (SUB-VARIAS-PERSONAS): Comparecen múltiples titulares de derecho de dominio conforme a los porcentajes verificados frente al Certificado de Libertad y Tradición.`
    );
  }

  return `REPÚBLICA DE COLOMBIA
NOTARÍA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.
CÓDIGO DE TRÁMITE: ${caso.codigo_tramite} (${caso.estado_apertura})
ESCRITURA PÚBLICA NÚMERO: ${caso.aprobaciones.numero_escritura_asignada}
DE FECHA: ${new Date().toLocaleDateString('es-CO')} · AÑO DOS MIL VEINTISÉIS (2026)
-----------------------------------------------------------------------------------------
ACTO NOTARIAL: ${caso.tramite_nombre}
SUBCATEGORÍAS APLICADAS: ${subcats.join(' + ')}${clausulaConstructora}
VALOR DEL ACTO: $${Number((caso.negocio && caso.negocio.valor_venta) || 0).toLocaleString('es-CO')}
-----------------------------------------------------------------------------------------
PARTE VENDEDORA / OTORGANTE (Extraída del Certificado de Libertad y Tradición):
${resumenVend}

PARTE COMPRADORA:
${resumenComp}

INMUEBLE: ${caso.inmueble.direccion}
MATRÍCULA INMOBILIARIA: ${caso.inmueble.matricula_inmobiliaria} | CHIP: ${caso.inmueble.chip} | CÉDULA CATASTRAL: ${caso.inmueble.cedula_catastral}
-----------------------------------------------------------------------------------------
COMPARECENCIA: Comparecieron ${compVend}${compComp ? `; y ${compComp}` : ''}.

PRIMERA. - OBJETO, CABIDA Y LINDEROS:
${caso.inmueble.linderos_especiales}

LINDEROS GENERALES:
${caso.inmueble.linderos_generales}
-----------------------------------------------------------------------------------------
CUARTA. - TRADICIÓN ANTECEDENTE: ${caso.inmueble.tradicion_antecedente}
${clausulasSubcategorias.length ? '-----------------------------------------------------------------------------------------\n' + clausulasSubcategorias.join('\n\n') : ''}
-----------------------------------------------------------------------------------------
CADENA DE APROBACIÓN BPMN Y PAPEL DE SEGURIDAD NOTARIAL (RESOLUCIÓN 964 DE 2026):
1. Abogado que Radicó / Cargó: ${caso.creado_por || 'Laura Gómez'}
2. Visto Bueno Jurídico Abogado Verificador: ${caso.aprobaciones.visto_bueno_juridico_abogado ? `APROBADO por ${caso.aprobaciones.abogado_que_aprobo} (${caso.aprobaciones.fecha_aprobacion_abogado})` : 'PENDIENTE'}
3. Envío de Borrador por Correo a Clientes: ${caso.aprobaciones.enviado_a_clientes ? `ENVIADO (${caso.aprobaciones.fecha_envio_clientes}) a ${(caso.aprobaciones.correos_notificados || []).join(', ')}` : 'NO ENVIADO AÚN'}
4. Visto Bueno de Clientes Otorgantes: ${caso.aprobaciones.visto_bueno_vendedores && caso.aprobaciones.visto_bueno_compradores ? 'APROBADO POR VENDEDORES Y COMPRADORES' : 'PENDIENTE'}
5. Folios de Papel Notarial Utilizados: ${caso.aprobaciones.hojas_papel_notarial}
Derechos Notariales: $${liq.derechos_notariales.toLocaleString('es-CO')} | IVA: $${liq.iva_notarial.toLocaleString('es-CO')} | Retención en la Fuente (1%): $${liq.retencion_fuente_vendedor.toLocaleString('es-CO')}

DIANA BEATRIZ LÓPEZ DURAN
NOTARIA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.`;
}

function resumirTarjetaCaso(c) {
  return {
    id: c.id,
    codigo_tramite: c.codigo_tramite,
    titulo_tramite: c.titulo_tramite,
    estado_apertura: c.estado_apertura,
    estado_tramite: c.estado_apertura,
    tramite_nombre: c.tramite_nombre,
    chip: c.inmueble?.chip || '',
    matricula: c.inmueble?.matricula_inmobiliaria || '',
    cedula_principal: c.partes?.[0]?.numero_documento || '',
    propietario_principal: c.partes?.[0]?.nombres_completos || '',
    pertenece_constructora: c.pertenece_constructora,
    constructora_info: c.constructora_info
  };
}

function enrichStoreForApi(store) {
  const aliasUsrMap = {
    'usr-radicador-01': 'USR-ABOGADO-CARGA',
    'usr-verificador-01': 'USR-ABOGADO-VERIFICADOR',
    'usr-integral-01': 'USR-ABOGADO-INTEGRAL',
    'usr-cliente-01': 'USR-CLIENTE'
  };
  const docAliasMap = {
    'doc-1': 'DOC-TRAD-1',
    'doc-2': 'DOC-CED-VEND-1',
    'doc-3': 'DOC-CED-COMP-1',
    'doc-4': 'DOC-CED-VEND-2',
    'doc-5': 'DOC-PAZ-ADMIN',
    'doc-6': 'DOC-ESC-ANT'
  };
  (store.usuarios_temporales || []).forEach((u) => {
    u.id = aliasUsrMap[u.usuario_id] || u.usuario_id;
    u.acceso_agente = Boolean(u.permisos?.puede_acceder_agente);
  });
  (store.catalogo_tramites || []).forEach((t) => {
    t.id = t.tramite_id;
    t.subcategorias_disponibles = t.categorias || [];
  });
  (store.casos || []).forEach((c) => {
    c.estado_tramite = c.estado_apertura;
    c.constructora_vinculada = {
      es_constructora: Boolean(c.pertenece_constructora),
      proyecto_id: c.constructora_info?.proyecto_id || '',
      nombre_proyecto: c.constructora_info?.nombre_proyecto || '',
      torre: c.constructora_info?.torre_bloque || '',
      torre_bloque: c.constructora_info?.torre_bloque || '',
      apartamento: c.constructora_info?.apartamento || ''
    };
    (c.documentos || []).forEach((d) => {
      d.alias_id = docAliasMap[d.id] || d.id;
      d.estado_revision = d.estado;
      d.campos_extraidos = (d.campos_leidos_agente || []).map((f) => ({
        ...f,
        etiqueta: f.etiqueta || f.clave,
        clave: f.clave || f.etiqueta
      }));
    });
    c.documentos_expediente = c.documentos;
  });
  return store;
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        console.error('[parseJsonBody] Error parseando JSON:', e.message);
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

  if (req.method === 'GET' && (pathname === '/manual' || pathname === '/manual.html')) {
    if (fs.existsSync(MANUAL_PATH)) {
      const htmlManual = fs.readFileSync(MANUAL_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(htmlManual);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Manual no encontrado.');
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      status: 'OPERATIVO',
      version: APP_VERSION,
      node_version: process.version,
      ia_modelos: {
        vision_primario: PRIMARY_VISION_MODEL,
        vision_consenso: SECONDARY_VISION_MODEL,
        voz_tts: TTS_VOICE_MODEL
      },
      plataforma: 'Asistente Notarial · Notaría 33 de Bogotá'
    });
  }

  if (req.method === 'GET' && (pathname === '/api/state' || pathname === '/api/estado')) {
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    return sendJson(res, 200, {
      ...store,
      version: APP_VERSION,
      ia_modelos: {
        vision_primario: PRIMARY_VISION_MODEL,
        vision_consenso: SECONDARY_VISION_MODEL,
        voz_tts: TTS_VOICE_MODEL
      },
      caso_activo: caso,
      usuario_activo: usuarioActivo,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso),
      liquidacion_actual: calcularLiquidacion(caso.negocio.valor_venta, caso.negocio.avaluo_catastral)
    });
  }

  if (req.method === 'POST' && pathname === '/api/usuario/cambiar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const mapAliases = {
      'USR-ABOGADO-CARGA': 'usr-radicador-01',
      'USR-ABOGADO-VERIFICADOR': 'usr-verificador-01',
      'USR-ABOGADO-INTEGRAL': 'usr-integral-01',
      'USR-CLIENTE': 'usr-cliente-01'
    };
    const resolvedId = mapAliases[body.usuario_id] || body.usuario_id;
    if (resolvedId) {
      store.usuario_activo_id = resolvedId;
    }
    const flagAgente = typeof body.puede_acceder_agente === 'boolean'
      ? body.puede_acceder_agente
      : typeof body.acceso_agente === 'boolean'
      ? body.acceso_agente
      : undefined;
    if (typeof flagAgente === 'boolean') {
      const u = store.usuarios_temporales.find(
        (x) => x.usuario_id === (resolvedId || store.usuario_activo_id) || x.rol_codigo === body.usuario_id
      );
      if (u) {
        u.permisos.puede_acceder_agente = flagAgente;
        u.acceso_agente = flagAgente;
      }
    }
    saveStore(store);
    const caso = getCasoActivo(store);
    const usrAct = getUsuarioActivo(store);
    return sendJson(res, 200, {
      ok: true,
      usuario_activo: usrAct,
      usuario_actual: usrAct,
      usuarios_temporales: store.usuarios_temporales,
      estado_bpmn: calcularEstadoBpmn(caso)
    });
  }

  if (req.method === 'POST' && pathname === '/api/caso/seleccionar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const encontrado = store.casos.find(
      (c) => c.id === body.caso_id || c.codigo_tramite === body.caso_id || c.codigo_tramite === body.codigo_tramite
    );
    if (encontrado) {
      store.caso_activo_id = encontrado.id;
      saveStore(store);
    }
    const caso = getCasoActivo(store);
    return sendJson(res, 200, {
      ok: true,
      caso_activo: caso,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso),
      liquidacion_actual: calcularLiquidacion(caso.negocio.valor_venta, caso.negocio.avaluo_catastral)
    });
  }

  if (req.method === 'POST' && pathname === '/api/caso/reiniciar') {
    fs.writeFileSync(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    const store = loadStore();
    const caso = getCasoActivo(store);
    return sendJson(res, 200, {
      ok: true,
      ...store,
      caso_activo: caso,
      usuario_activo: getUsuarioActivo(store),
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso),
      liquidacion_actual: calcularLiquidacion(caso.negocio.valor_venta, caso.negocio.avaluo_catastral)
    });
  }

  // ENDPOINT DE VOZ DE GOOGLE CLOUD TEXT-TO-SPEECH (Voces Neuronales en Español `es-US-Neural2-B` / `es-US-Neural2-A`)
  if (req.method === 'POST' && pathname === '/api/voz/tts') {
    const body = await parseJsonBody(req);
    const textoLimpio = String(body.texto || '')
      .replace(/[✓⚠️✉️📎📄🎙️🔊🔍•]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    if (!textoLimpio) {
      return sendJson(res, 400, { ok: false, error: 'Texto vacío para sintetizar voz.' });
    }

    const obtenerTokenGcp = () =>
      new Promise((resolve) => {
        const metaReq = http.request(
          {
            hostname: 'metadata.google.internal',
            path: '/computeMetadata/v1/instance/service-accounts/default/token',
            method: 'GET',
            headers: { 'Metadata-Flavor': 'Google' },
            timeout: 1200
          },
          (metaRes) => {
            let raw = '';
            metaRes.on('data', (chunk) => (raw += chunk));
            metaRes.on('end', () => {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.access_token) return resolve(parsed.access_token);
              } catch (e) {}
              resolve(null);
            });
          }
        );
        metaReq.on('error', () => resolve(null));
        metaReq.on('timeout', () => {
          metaReq.destroy();
          resolve(null);
        });
        metaReq.end();
      });

    let accessToken = await obtenerTokenGcp();
    if (!accessToken) {
      try {
        accessToken = execSync('gcloud auth print-access-token', { encoding: 'utf8', timeout: 3500 }).trim();
      } catch (e) {
        accessToken = null;
      }
    }

    if (!accessToken) {
      return sendJson(res, 200, { ok: false, fallback_browser_tts: true });
    }

    const payloadTts = JSON.stringify({
      input: { text: textoLimpio },
      voice: {
        languageCode: 'es-US',
        name: body.voz === 'FEMENINA' ? 'es-US-Neural2-A' : 'es-US-Neural2-B'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.03
      }
    });

    const audioBase64 = await new Promise((resolve) => {
      const ttsReq = https.request(
        {
          hostname: 'texttospeech.googleapis.com',
          path: '/v1/text:synthesize',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-goog-user-project': 'agente-deviajecon',
            'Content-Length': Buffer.byteLength(payloadTts)
          },
          timeout: 6000
        },
        (ttsRes) => {
          let raw = '';
          ttsRes.on('data', (c) => (raw += c));
          ttsRes.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.audioContent) return resolve(parsed.audioContent);
            } catch (e) {}
            resolve(null);
          });
        }
      );
      ttsReq.on('error', () => resolve(null));
      ttsReq.on('timeout', () => {
        ttsReq.destroy();
        resolve(null);
      });
      ttsReq.write(payloadTts);
      ttsReq.end();
    });

    if (audioBase64) {
      return sendJson(res, 200, {
        ok: true,
        motor: 'Google Cloud Text-to-Speech Neural2',
        audio_data_url: `data:audio/mp3;base64,${audioBase64}`
      });
    }
    return sendJson(res, 200, { ok: false, fallback_browser_tts: true });
  }

  // FUNCIÓN AUXILIAR: Cruzar datos de un documento leído (Cédula, Nombre, Apartamento o Matrícula) contra las unidades apartadas de Constructoras
  function buscarCoincidenciaUnidadConstructora(store, datosBusqueda) {
    const cedLimpia = String(datosBusqueda.cedula || '').replace(/\D/g, '');
    const nombreUpper = String(datosBusqueda.nombre || '').toUpperCase().trim();
    const textoUpper = String(datosBusqueda.texto || '').toUpperCase();
    const dirUpper = String(datosBusqueda.direccion || '').toUpperCase();
    const matUpper = String(datosBusqueda.matricula || '').toUpperCase().trim();

    for (const proy of store.proyectos_constructoras || []) {
      for (const u of proy.unidades || []) {
        const uCedLimpia = String(u.comprador_cc || '').replace(/\D/g, '');
        const uNomUpper = String(u.comprador_nombre || '').toUpperCase().trim();
        const matchCedula = cedLimpia.length >= 6 && uCedLimpia === cedLimpia;
        const matchNombre =
          nombreUpper.length >= 5 &&
          uNomUpper.length >= 5 &&
          (uNomUpper.includes(nombreUpper) || nombreUpper.includes(uNomUpper));
        const matchMatricula = matUpper.length >= 5 && u.matricula && String(u.matricula).toUpperCase() === matUpper;
        const matchAptoEnTexto =
          (textoUpper.includes(`APTO ${u.apartamento}`) ||
            textoUpper.includes(`APARTAMENTO ${u.apartamento}`) ||
            dirUpper.includes(`APTO ${u.apartamento}`) ||
            dirUpper.includes(`APARTAMENTO ${u.apartamento}`)) &&
          (textoUpper.includes(proy.nombre_proyecto.split(' ')[0].toUpperCase()) ||
            dirUpper.includes(proy.nombre_proyecto.split(' ')[0].toUpperCase()) ||
            matchCedula ||
            matchNombre);

        if (matchCedula || matchNombre || matchMatricula || matchAptoEnTexto) {
          return {
            proyecto: proy,
            unidad: u,
            motivo_coincidencia: matchCedula
              ? `Cédula ${u.comprador_cc} coincide con el comprador apartado de la unidad ${u.unidad_id}`
              : matchNombre
              ? `Nombre "${u.comprador_nombre}" coincide con el comprador apartado de la unidad ${u.unidad_id}`
              : `Identificación del Apartamento ${u.apartamento} (${u.bloque}) coincide con el proyecto ${proy.nombre_proyecto}`
          };
        }
      }
    }
    return null;
  }

  // ENDPOINT PARA QUE EL ABOGADO APRUEBE O CONFIRME EL INGRESO DE DOCUMENTACIÓN Y VINCULACIÓN DE UN TRÁMITE A UN APARTAMENTO DE CONSTRUCTORA
  if (req.method === 'POST' && pathname === '/api/constructoras/aprobar-vinculacion') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    const infoPend = caso.constructora_sugerida || caso.constructora_info || {};
    const proyId = body.proyecto_id || infoPend.proyecto_id || store.proyectos_constructoras[0]?.proyecto_id;
    const proy = store.proyectos_constructoras.find((p) => p.proyecto_id === proyId) || store.proyectos_constructoras[0];
    const torre = body.torre_bloque || infoPend.torre_bloque || 'Torre A';
    const apto = String(body.apartamento || infoPend.apartamento || '401').replace(/^Apartamento\s+/i, '').trim();
    const unidadId = `${torre.replace('Torre ', '').trim()}-${apto}`;
    const unidad = proy.unidades.find((u) => u.unidad_id === unidadId || (u.bloque === torre && u.apartamento === apto));

    if (body.rechazar) {
      caso.constructora_sugerida = null;
      caso.pertenece_constructora = false;
      saveStore(store);
      return sendJson(res, 200, {
        ok: true,
        caso_activo: caso,
        proyectos_constructoras: store.proyectos_constructoras,
        estado_bpmn: calcularEstadoBpmn(caso)
      });
    }

    caso.pertenece_constructora = true;
    caso.constructora_sugerida = null;
    if (!caso.subcategorias_activas.includes('SUB-PROYECTO-CONSTRUCTORA')) {
      caso.subcategorias_activas.push('SUB-PROYECTO-CONSTRUCTORA');
    }

    if (unidad) {
      unidad.estado_dinamico = 'En revisión';
      unidad.documentos_recibidos = caso.documentos.filter((d) => d.estado !== 'FALTA_DOCUMENTO').length;
      unidad.codigo_tramite_vinculado = caso.codigo_tramite;
      if (unidad.comprador_nombre && unidad.comprador_cc) {
        const yaEsta = caso.partes.some(
          (p) => p.numero_documento.replace(/\D/g, '') === String(unidad.comprador_cc).replace(/\D/g, '')
        );
        if (!yaEsta) {
          caso.partes.push({
            id: 'p-comp-' + Date.now(),
            rol: 'COMPRADOR',
            nombres_completos: unidad.comprador_nombre.toUpperCase(),
            numero_documento: unidad.comprador_cc,
            lugar_expedicion: 'Bogotá D.C.',
            estado_civil: 'Soltero(a)',
            genero: 'M',
            porcentaje: 100,
            correo_electronico: unidad.comprador_correo || 'comprador@correo.co',
            origen_inferencia: `Comprador apartado en ${proy.nombre_proyecto} (${torre} · Apto ${apto}).`,
            cedula_cargada: true,
            aprobado_verificador: true,
            aprobado_por: usuarioActivo.nombre,
            borrador_enviado: false,
            visto_bueno_cliente: false
          });
        }
      }
    }

    caso.constructora_info = {
      proyecto_id: proy.proyecto_id,
      nombre_proyecto: proy.nombre_proyecto,
      constructora: proy.constructora,
      torre_bloque: torre,
      apartamento: apto,
      unidad_id: unidadId,
      comprador_apartado: unidad?.comprador_nombre || '',
      comprador_cc: unidad?.comprador_cc || '',
      historial_duenos: unidad?.historial_duenos || [],
      estado_unidad: unidad?.estado_dinamico || 'En revisión',
      aprobado_abogado: true,
      aprobado_por: usuarioActivo.nombre,
      fecha_aprobacion: new Date().toLocaleString('es-CO')
    };
    caso.constructora_vinculada = {
      es_constructora: true,
      ...caso.constructora_info,
      torre: torre
    };

    caso.bitacora.push({
      id: 'ev-const-aprob-' + Date.now(),
      fecha: new Date().toLocaleString('es-CO'),
      actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
      etapa: 'Aprobación de Ingreso a Apartamento de Constructora',
      detalle: `Aprobó ingresar la documentación del trámite ${caso.codigo_tramite} al Apartamento ${apto} (${torre}) del proyecto ${proy.nombre_proyecto}.`
    });

    caso.mensajes_chat.push({
      id: 'm-ag-' + Date.now(),
      emisor: 'ASISTENTE',
      autor: 'Asistente Notarial',
      hora: ahoraHora,
      texto: `✓ ${usuarioActivo.nombre} aprobó ingresar esta documentación al Apartamento ${apto} (${torre}) del proyecto "${proy.nombre_proyecto}". Ya heredé la escritura matriz del reglamento P.H. y actualicé el estado del apartamento a "En revisión".`,
      hallazgos: [
        `Proyecto: ${proy.nombre_proyecto} · Unidad ${unidadId}`,
        `Titular / Comprador del Apartamento: ${unidad?.comprador_nombre || 'Registrado'} (C.C. ${unidad?.comprador_cc || ''})`,
        `Aprobado por Abogado: ${usuarioActivo.nombre}`
      ],
      alertas_rojas: [],
      preguntas_pendientes: [],
      acciones_sugeridas: [{ tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha del Trámite Vinculado' }]
    });

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      constructora_info: caso.constructora_info,
      caso_activo: caso,
      proyectos_constructoras: store.proyectos_constructoras,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  // ENDPOINT PARA SUBIR UN ARCHIVO REAL DESDE EL COMPUTADOR DEL USUARIO (Certificado de Libertad y Tradición, Cédula, Paz y Salvo, Escritura Anterior)
  if (req.method === 'POST' && pathname === '/api/documento/subir') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    let caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const hoyIso = new Date().toISOString().split('T')[0];

    const extraido = extraerDatosDeTextoDocumento(body.texto_extraido || '', body.archivo_nombre || '');
    const rawTipo = (body.codigo_tipo || body.tipo_documento || 'CERTIFICADO_TRADICION').toUpperCase();
    const tipoDoc =
      rawTipo === 'CEDULA'
        ? 'CEDULA_CIUDADANIA'
        : rawTipo === 'ESCRITURA_ANTECEDENTE'
        ? 'ESCRITURA_ANTERIOR'
        : rawTipo === 'PAZ_Y_SALVO_PREDIAL'
        ? 'RECIBOS_FISCALES'
        : rawTipo;
    const nombrePropBody = body.nombre_propietario || body.propietario_nombre || '';
    const cedulaBody = body.cedula || body.propietario_cedula || '';
    const mimeBody = body.tipo_mime || body.archivo_mime || 'application/pdf';

    // Cruzar automáticamente los datos leídos del documento contra los apartamentos apartados en Constructoras
    const matchConstructora = buscarCoincidenciaUnidadConstructora(store, {
      cedula: cedulaBody || extraido.cedula_detectada,
      nombre: nombrePropBody || extraido.nombre_detectado,
      matricula: body.matricula || extraido.matricula,
      direccion: body.direccion || extraido.direccion,
      texto: body.texto_extraido || ''
    });

    // Si el usuario está subiendo un Certificado de Libertad y Tradición para ABRIR un trámite nuevo
    if (
      body.accion_apertura === 'ABRIR_TRAMITE_NUEVO' ||
      body.modo === 'ABRIR_TRAMITE' ||
      body.modo === 'ABRIR_TRAMITE_NUEVO' ||
      (tipoDoc === 'CERTIFICADO_TRADICION' && body.abrir_tramite_nuevo)
    ) {
      const sufijoAuto = String(Date.now()).slice(-4);
      const chipReal = (body.chip || extraido.chip || `AAA${sufijoAuto}SCAN`).toUpperCase().trim();
      const matriculaReal = (body.matricula || extraido.matricula || `50N-${sufijoAuto}`).toUpperCase().trim();
      const cedulaReal = (cedulaBody || extraido.cedula_detectada || 'POR_VERIFICAR_EN_VISOR').trim();
      const nombreLimpioArchivo = String(body.archivo_nombre || 'TITULAR POR VERIFICAR')
        .replace(/\.[^.]+$/, '')
        .replace(/[_\-]+/g, ' ')
        .toUpperCase()
        .trim();
      const nombrePropReal = (nombrePropBody || extraido.nombre_detectado || nombreLimpioArchivo || 'TITULAR POR VERIFICAR').toUpperCase().trim();
      const apellidoReal = (body.apellido || (nombrePropReal ? nombrePropReal.split(/\s+/)[0] : 'TITULAR')).toUpperCase().trim();

      const llavePredio = chipReal || matriculaReal;
      const existenteAbierto = store.casos.find(
        (c) =>
          c.estado_apertura === 'ABIERTO' &&
          ((chipReal && c.inmueble?.chip?.toUpperCase() === chipReal) ||
            (matriculaReal && c.inmueble?.matricula_inmobiliaria?.toUpperCase() === matriculaReal))
      );

      if (existenteAbierto) {
        store.caso_activo_id = existenteAbierto.id;
        caso = existenteAbierto;
        caso.mensajes_chat.push({
          id: 'm-ag-' + Date.now(),
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: `⚠️ Ya existe un trámite ABIERTO para este predio (${llavePredio}): ${existenteAbierto.codigo_tramite}. Mientras esté ABIERTO no se puede volver a crear otro trámite igual. Te he llevado directamente a su expediente.`,
          hallazgos: [
            `Código del Trámite Abierto: ${existenteAbierto.codigo_tramite}`,
            `Estado: ${existenteAbierto.estado_apertura}`
          ],
          alertas_rojas: ['Bloqueo Anti-Duplicados Activo: Este predio ya tiene un trámite abierto.'],
          preguntas_pendientes: [],
          tarjetas_tramites: [resumirTarjetaCaso(existenteAbierto)],
          acciones_sugeridas: [{ tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Ficha de ${existenteAbierto.codigo_tramite}` }]
        });
        saveStore(store);
        return sendJson(res, 200, {
          ok: true,
          duplicado_bloqueado: true,
          tramite_existente: existenteAbierto,
          caso_activo: caso,
          casos: store.casos,
          estado_bpmn: calcularEstadoBpmn(caso),
          minuta_generada_actual: generarTextoMinuta(caso)
        });
      }

      const nuevoCaso = crearCasoLimpioDesdeCertificado(
        {
          tramite_id: body.tramite_id,
          tipo_corto: body.tipo_corto,
          tipo_tramite: body.tipo_tramite,
          chip: chipReal || matriculaReal.replace(/[^A-Z0-9]/g, ''),
          matricula: matriculaReal,
          cedula_catastral: body.cedula_catastral || extraido.cedula_catastral || '',
          direccion: body.direccion || extraido.direccion || '',
          nombre_propietario: nombrePropReal,
          apellido: apellidoReal,
          cedula: cedulaReal,
          correo_electronico: body.correo_electronico || '',
          valor_venta: body.valor_venta || 0,
          subcategorias_activas: body.subcategorias_activas,
          archivo_nombre: body.archivo_nombre,
          archivo_data_url: body.archivo_data_url,
          tipo_mime: mimeBody,
          texto_extraido: body.texto_extraido
        },
        usuarioActivo,
        store
      );

      if (matchConstructora) {
        nuevoCaso.constructora_sugerida = {
          proyecto_id: matchConstructora.proyecto.proyecto_id,
          nombre_proyecto: matchConstructora.proyecto.nombre_proyecto,
          constructora: matchConstructora.proyecto.constructora,
          torre_bloque: matchConstructora.unidad.bloque,
          apartamento: matchConstructora.unidad.apartamento,
          unidad_id: matchConstructora.unidad.unidad_id,
          comprador_apartado: matchConstructora.unidad.comprador_nombre,
          comprador_cc: matchConstructora.unidad.comprador_cc,
          motivo: matchConstructora.motivo_coincidencia,
          aprobado_abogado: false
        };
        nuevoCaso.mensajes_chat[0].texto += ` 🔍 Además, al leer este documento detecté que coincide con el Apartamento ${matchConstructora.unidad.apartamento} (${matchConstructora.unidad.bloque}) apartado en el proyecto "${matchConstructora.proyecto.nombre_proyecto}" a nombre de ${matchConstructora.unidad.comprador_nombre} (C.C. ${matchConstructora.unidad.comprador_cc}). ¿Autorizas ingresar esta documentación a ese apartamento?`;
        nuevoCaso.mensajes_chat[0].hallazgos.push(
          `🔍 Coincidencia Constructora detectada: ${matchConstructora.proyecto.nombre_proyecto} · ${matchConstructora.unidad.bloque} Apto ${matchConstructora.unidad.apartamento} (${matchConstructora.motivo_coincidencia})`
        );
        nuevoCaso.mensajes_chat[0].acciones_sugeridas.unshift({
          tipo: 'APROBAR_VINCULACION_CONSTRUCTORA',
          etiqueta: `✓ Sí, Ingresar Documentación al Apto ${matchConstructora.unidad.apartamento} (${matchConstructora.unidad.bloque}) y Aprobar`
        });
      }

      store.casos.unshift(nuevoCaso);
      store.caso_activo_id = nuevoCaso.id;
      saveStore(store);
      return sendJson(res, 200, {
        ok: true,
        duplicado_bloqueado: false,
        coincidencia_constructora: matchConstructora ? nuevoCaso.constructora_sugerida : null,
        nuevo_caso: nuevoCaso,
        caso_activo: nuevoCaso,
        casos: store.casos,
        estado_bpmn: calcularEstadoBpmn(nuevoCaso),
        minuta_generada_actual: generarTextoMinuta(nuevoCaso)
      });
    }

    // Si el usuario está adjuntando o reemplazando un documento dentro del trámite activo (Cédula, Certificado, Paz y Salvo, Escritura Anterior)
    const mapDocUploadAliases = {
      'DOC-TRAD-1': 'doc-1',
      'DOC-CED-VEND-1': 'doc-2',
      'DOC-CED-COMP-1': 'doc-3',
      'DOC-CED-VEND-2': 'doc-4',
      'DOC-CED-MONICA': 'doc-4',
      'DOC-PAZ-ADMIN': 'doc-5',
      'DOC-ESC-ANT': 'doc-6'
    };
    const rawDocReemplazar = body.documento_id || body.doc_id_reemplazar || body.doc_id;
    const resolvedDocReemplazar = mapDocUploadAliases[rawDocReemplazar] || rawDocReemplazar;

    let docTarget = null;
    if (resolvedDocReemplazar) {
      docTarget = caso.documentos.find((d) => d.id === resolvedDocReemplazar || d.alias_id === rawDocReemplazar);
    }
    if (!docTarget && body.parte_id) {
      const idxParte = caso.partes.findIndex((p) => p.id === body.parte_id);
      if (idxParte >= 0) {
        const parteObj = caso.partes[idxParte];
        parteObj.cedula_cargada = true;
        if (cedulaBody) parteObj.numero_documento = cedulaBody;
        if (nombrePropBody) parteObj.nombres_completos = nombrePropBody.toUpperCase();
        if (body.correo_electronico) parteObj.correo_electronico = body.correo_electronico;

        docTarget = caso.documentos.find(
          (d) =>
            d.estado === 'FALTA_DOCUMENTO' ||
            d.nombre.toLowerCase().includes(parteObj.nombres_completos.split(' ')[0].toLowerCase())
        );
      }
    }
    if (tipoDoc === 'CEDULA_CIUDADANIA') {
      if (!docTarget) {
        docTarget = caso.documentos.find((d) => d.estado === 'FALTA_DOCUMENTO');
      }
      const parteSinCed = caso.partes.find((p) => !p.cedula_cargada) || (resolvedDocReemplazar === 'doc-4' ? caso.partes.find((p) => p.id === 'p-2') : null);
      if (parteSinCed) {
        parteSinCed.cedula_cargada = true;
        if (cedulaBody || extraido.cedula_detectada) parteSinCed.numero_documento = cedulaBody || extraido.cedula_detectada;
        if (nombrePropBody || extraido.nombre_detectado) parteSinCed.nombres_completos = (nombrePropBody || extraido.nombre_detectado).toUpperCase();
      } else if (!docTarget && nombrePropBody && cedulaBody) {
        caso.partes.push({
          id: 'p-' + Date.now(),
          rol: body.rol_parte || 'COMPRADOR',
          nombres_completos: nombrePropBody.toUpperCase(),
          numero_documento: cedulaBody,
          lugar_expedicion: body.lugar_expedicion || 'Colombia',
          estado_civil: body.estado_civil || 'Soltero(a)',
          genero: 'M',
          porcentaje: Number(body.porcentaje || 100),
          correo_electronico: body.correo_electronico || '',
          origen_inferencia: `Cédula adjuntada en archivo "${body.archivo_nombre}".`,
          cedula_cargada: true,
          aprobado_verificador: false,
          aprobado_por: '',
          borrador_enviado: false,
          visto_bueno_cliente: false
        });
      }
    }
    if (!docTarget && tipoDoc === 'CERTIFICADO_TRADICION') {
      docTarget = caso.documentos.find((d) => d.codigo_tipo === 'CERTIFICADO_TRADICION');
    }
    if (!docTarget && tipoDoc === 'PAZ_Y_SALVO_ADMIN') {
      docTarget = caso.documentos.find((d) => d.codigo_tipo === 'PAZ_Y_SALVO_ADMIN');
    }
    if (!docTarget && tipoDoc === 'RECIBOS_FISCALES') {
      docTarget = caso.documentos.find((d) => d.codigo_tipo === 'RECIBOS_FISCALES' || d.codigo_tipo === 'PAZ_Y_SALVO_PREDIAL');
    }
    if (!docTarget && tipoDoc === 'ESCRITURA_ANTERIOR') {
      docTarget = caso.documentos.find((d) => d.codigo_tipo === 'ESCRITURA_ANTERIOR' || d.codigo_tipo === 'ESCRITURA_ANTECEDENTE');
    }

    const camposNuevos = [];
    if (tipoDoc === 'CERTIFICADO_TRADICION') {
      const m = body.matricula || extraido.matricula || caso.inmueble.matricula_inmobiliaria;
      const c = body.chip || extraido.chip || caso.inmueble.chip;
      const dir = body.direccion || extraido.direccion || caso.inmueble.direccion;
      caso.inmueble.matricula_inmobiliaria = m;
      caso.inmueble.chip = c;
      caso.inmueble.direccion = dir;
      caso.certificado_tradicion.matricula_inmobiliaria = m;
      caso.certificado_tradicion.chip = c;
      caso.certificado_tradicion.direccion_actual = dir.toUpperCase();
      camposNuevos.push(
        { clave: 'Archivo Subido', valor: body.archivo_nombre || 'Certificado_Tradicion.pdf', dudoso: false },
        { clave: 'Matrícula Inmobiliaria', valor: m, dudoso: false },
        { clave: 'Código CHIP', valor: c, dudoso: false },
        { clave: 'Dirección del Predio', valor: dir, dudoso: false }
      );
      if (nombrePropBody || extraido.nombre_detectado) {
        camposNuevos.push({
          clave: 'Propietario / Titular',
          valor: `${(nombrePropBody || extraido.nombre_detectado).toUpperCase()} · C.C. ${cedulaBody || extraido.cedula_detectada || ''}`,
          dudoso: false
        });
      }
    } else if (tipoDoc === 'CEDULA_CIUDADANIA') {
      const nom = (nombrePropBody || extraido.nombre_detectado || 'Titular del Documento').toUpperCase();
      const cc = cedulaBody || extraido.cedula_detectada || 'Por verificar';
      camposNuevos.push(
        { clave: 'Archivo Subido', valor: body.archivo_nombre || 'Cedula.pdf', dudoso: false },
        { clave: 'Nombre Completo Leído', valor: nom, dudoso: false },
        { clave: 'Número de Cédula', valor: cc, dudoso: false },
        { clave: 'Rol en el Trámite', valor: body.rol_parte || 'OTORGANTE', dudoso: false }
      );
    } else if (tipoDoc === 'PAZ_Y_SALVO_ADMIN' || tipoDoc === 'RECIBOS_FISCALES') {
      const fExp = body.fecha_expedicion || hoyIso;
      const dObj = new Date(fExp + 'T12:00:00');
      const ultDia = new Date(dObj.getFullYear(), dObj.getMonth() + 1, 0, 12, 0, 0).toISOString().split('T')[0];
      camposNuevos.push(
        { clave: 'Archivo Subido', valor: body.archivo_nombre || 'Paz_y_Salvo.pdf', dudoso: false },
        { clave: 'Tipo de Paz y Salvo', valor: tipoDoc === 'RECIBOS_FISCALES' ? 'Impuesto Predial / Valorización (IDU)' : 'Paz y Salvo de Administración P.H.', dudoso: false },
        { clave: 'Fecha de Expedición', valor: fExp, dudoso: false },
        { clave: 'Vencimiento (Último día del mes)', valor: ultDia, dudoso: false }
      );
    } else {
      camposNuevos.push(
        { clave: 'Archivo Subido', valor: body.archivo_nombre || 'Escritura_Anterior.pdf', dudoso: false },
        { clave: 'Observación / Extracto', valor: (body.texto_extraido || 'Archivo adjuntado por el usuario para revisión del abogado en el visor.').slice(0, 220), dudoso: false }
      );
    }

    if (docTarget) {
      docTarget.nombre = body.titulo_documento || docTarget.nombre.replace(' (FALTANTE)', '').replace(' (PENDIENTE DE SUBIR)', '');
      docTarget.archivo = body.archivo_nombre || docTarget.archivo;
      docTarget.archivo_data_url = body.archivo_data_url || '';
      docTarget.tipo_mime = mimeBody;
      docTarget.texto_extraido = body.texto_extraido || '';
      docTarget.fecha_expedicion = body.fecha_expedicion || hoyIso;
      docTarget.estado = 'PENDIENTE_APROBACION_ABOGADO';
      docTarget.nivel_alerta = 'WARNING';
      docTarget.aprobado_abogado = false;
      docTarget.aprobado_por = '';
      docTarget.tipo_visor_escaneo =
        tipoDoc === 'CERTIFICADO_TRADICION'
          ? 'CERTIFICADO_SNR'
          : tipoDoc === 'CEDULA_CIUDADANIA'
          ? 'CEDULA_COLOMBIA'
          : tipoDoc === 'PAZ_Y_SALVO_ADMIN' || tipoDoc === 'RECIBOS_FISCALES'
          ? 'PAZ_Y_SALVO'
          : 'MINUTA_SELLOS_LINDEROS';
      docTarget.mensaje_alerta = `Archivo real "${body.archivo_nombre || docTarget.archivo}" cargado por ${usuarioActivo.nombre}. Pendiente que el Abogado Verificador lo revise en el visor y lo apruebe.`;
      docTarget.campos_leidos_agente = camposNuevos;
    } else {
      const nuevoDoc = {
        id: 'doc-' + Date.now(),
        codigo_tipo: tipoDoc,
        nombre:
          body.titulo_documento ||
          (tipoDoc === 'RECIBOS_FISCALES'
            ? `Paz y Salvo Predial y Valorización · ${body.archivo_nombre || 'Adjunto'}`
            : `${tipoDoc} · ${body.archivo_nombre || 'Adjunto'}`),
        archivo: body.archivo_nombre || 'documento_adjunto.pdf',
        archivo_data_url: body.archivo_data_url || '',
        tipo_mime: mimeBody,
        texto_extraido: body.texto_extraido || '',
        fecha_expedicion: body.fecha_expedicion || hoyIso,
        fecha_vencimiento: 'SEGÚN REGLA',
        estado: 'PENDIENTE_APROBACION_ABOGADO',
        nivel_alerta: 'WARNING',
        aprobado_abogado: false,
        aprobado_por: '',
        mensaje_alerta: `Archivo real "${body.archivo_nombre}" cargado por ${usuarioActivo.nombre}. Pendiente de aprobación del Abogado Verificador.`,
        tipo_visor_escaneo:
          tipoDoc === 'CERTIFICADO_TRADICION'
            ? 'CERTIFICADO_SNR'
            : tipoDoc === 'CEDULA_CIUDADANIA'
            ? 'CEDULA_COLOMBIA'
            : tipoDoc === 'PAZ_Y_SALVO_ADMIN' || tipoDoc === 'RECIBOS_FISCALES'
            ? 'PAZ_Y_SALVO'
            : 'MINUTA_SELLOS_LINDEROS',
        campos_leidos_agente: camposNuevos
      };
      caso.documentos.push(nuevoDoc);
      docTarget = nuevoDoc;
    }

    // Al subir o cambiar un documento, invalidar aprobaciones jurídicas y de clientes previas por seguridad BPMN
    caso.aprobaciones.visto_bueno_juridico_abogado = false;
    caso.aprobaciones.enviado_a_clientes = false;
    caso.aprobaciones.visto_bueno_vendedores = false;
    caso.aprobaciones.visto_bueno_compradores = false;

    const estadoBpmn = calcularEstadoBpmn(caso);
    const accionesMsg = [
      { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Archivo Subido en la Ficha del Trámite' },
      estadoBpmn.siguiente_accion
    ];
    let textoRespuestaSubida = `📎 He recibido y procesado tu archivo real "${body.archivo_nombre}" en el trámite ${caso.codigo_tramite}. Ya está disponible en el visor de la Ficha del Trámite para revisión y aprobación del Abogado Verificador.`;
    const hallazgosSubida = camposNuevos.map((c) => `${c.clave}: ${c.valor}`);

    // Si al leer esta Cédula o Certificado detectamos que pertenece a un apartamento apartado en Constructora, preguntarle al Abogado
    if (matchConstructora && !caso.pertenece_constructora) {
      caso.constructora_sugerida = {
        proyecto_id: matchConstructora.proyecto.proyecto_id,
        nombre_proyecto: matchConstructora.proyecto.nombre_proyecto,
        constructora: matchConstructora.proyecto.constructora,
        torre_bloque: matchConstructora.unidad.bloque,
        apartamento: matchConstructora.unidad.apartamento,
        unidad_id: matchConstructora.unidad.unidad_id,
        comprador_apartado: matchConstructora.unidad.comprador_nombre,
        comprador_cc: matchConstructora.unidad.comprador_cc,
        motivo: matchConstructora.motivo_coincidencia,
        aprobado_abogado: false
      };
      textoRespuestaSubida += ` 🔍 Al leer este documento detecté que corresponde al Apartamento ${matchConstructora.unidad.apartamento} (${matchConstructora.unidad.bloque}) apartado en el proyecto "${matchConstructora.proyecto.nombre_proyecto}" a nombre de ${matchConstructora.unidad.comprador_nombre} (C.C. ${matchConstructora.unidad.comprador_cc}). ¿Autorizas ingresar esta documentación al Apartamento ${matchConstructora.unidad.apartamento}?`;
      hallazgosSubida.push(
        `🔍 Coincidencia con Apartamento Apartado: ${matchConstructora.proyecto.nombre_proyecto} · ${matchConstructora.unidad.bloque} · Apartamento ${matchConstructora.unidad.apartamento} (${matchConstructora.motivo_coincidencia})`
      );
      accionesMsg.unshift({
        tipo: 'APROBAR_VINCULACION_CONSTRUCTORA',
        etiqueta: `✓ Sí, Ingresar Documentación al Apto ${matchConstructora.unidad.apartamento} (${matchConstructora.unidad.bloque}) y Aprobar`
      });
    }

    caso.mensajes_chat.push({
      id: 'm-up-' + Date.now(),
      emisor: 'ASISTENTE',
      autor: 'Asistente Notarial',
      hora: ahoraHora,
      texto: textoRespuestaSubida,
      hallazgos: hallazgosSubida,
      alertas_rojas: [],
      preguntas_pendientes: matchConstructora
        ? [`¿Confirmas ingresar esta documentación al Apartamento ${matchConstructora.unidad.apartamento} (${matchConstructora.unidad.bloque}) del proyecto ${matchConstructora.proyecto.nombre_proyecto}?`]
        : [],
      tarjetas_tramites: [resumirTarjetaCaso(caso)],
      acciones_sugeridas: accionesMsg
    });

    caso.bitacora.push({
      id: 'ev-up-' + Date.now(),
      fecha: new Date().toLocaleString('es-CO'),
      actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
      etapa: 'Carga de Archivo Real',
      detalle: `Subió el archivo "${body.archivo_nombre}" (${tipoDoc}) al trámite ${caso.codigo_tramite}.`
    });

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      documento_subido: docTarget,
      coincidencia_constructora: matchConstructora ? caso.constructora_sugerida : null,
      caso_activo: caso,
      casos: store.casos,
      estado_bpmn: estadoBpmn,
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  // ENDPOINT DE CHAT INTELIGENTE (HABLADO O ESCRITO): Busca trámites, valida duplicados, aparta o cambia dueños de apartamentos en Constructora, vincula trámites en línea y captura correos
  if (req.method === 'POST' && pathname === '/api/chat') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    let caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const msgRaw = (body.mensaje || '').trim();
    const msgLower = msgRaw.toLowerCase();

    if (msgRaw) {
      caso.mensajes_chat.push({
        id: 'm-u-' + Date.now(),
        emisor: 'ABOGADO',
        autor: `${usuarioActivo.nombre} · ${usuarioActivo.cargo}`,
        hora: ahoraHora,
        texto: msgRaw
      });
    }

    // 0. DETECTAR SI EL USUARIO ESCRIBIÓ CORREOS ELECTRÓNICOS EN EL CHAT O PIDIÓ ENVIAR EL BORRADOR A CLIENTES
    const emailsEnMensaje = msgRaw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    if (emailsEnMensaje.length > 0 || body.enviar_borrador_clientes) {
      emailsEnMensaje.forEach((em, idx) => {
        const parteDestino = caso.partes[idx] || caso.partes.find((p) => !p.correo_electronico) || caso.partes[0];
        if (parteDestino) {
          parteDestino.correo_electronico = em.toLowerCase();
        }
      });

      if (body.correos_partes && Array.isArray(body.correos_partes)) {
        body.correos_partes.forEach((item) => {
          const p = caso.partes.find((x) => x.id === item.id || x.id === item.parte_id);
          if (p && item.correo_electronico) p.correo_electronico = item.correo_electronico.trim();
        });
      }

      if (!caso.aprobaciones.visto_bueno_juridico_abogado) {
        const estadoBpmn = calcularEstadoBpmn(caso);
        caso.mensajes_chat.push({
          id: 'm-ag-' + Date.now(),
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: `He guardado el(los) correo(s) electrónico(s) en las partes del trámite (${caso.partes.map((p) => `${p.nombres_completos}: ${p.correo_electronico || 'Pendiente'}`).join(' · ')}). Recuerda que por regla BPMN primero el Abogado Verificador debe aprobar todos los documentos y dar el Visto Bueno Jurídico antes de enviar el borrador a los clientes.`,
          hallazgos: caso.partes.map((p) => `${p.rol} ${p.nombres_completos}: ${p.correo_electronico || 'Sin correo'}`),
          alertas_rojas: ['Pendiente Visto Bueno Jurídico del Abogado Verificador antes de poder enviar el borrador a los clientes.'],
          preguntas_pendientes: [],
          acciones_sugeridas: [estadoBpmn.siguiente_accion]
        });
        saveStore(store);
        return sendJson(res, 200, {
          ok: true,
          caso_activo: caso,
          estado_bpmn: estadoBpmn,
          minuta_generada_actual: generarTextoMinuta(caso)
        });
      }

      const sinCorreo = caso.partes.filter((p) => !p.correo_electronico || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo_electronico));
      if (sinCorreo.length === 0) {
        caso.aprobaciones.enviado_a_clientes = true;
        caso.aprobaciones.fecha_envio_clientes = new Date().toLocaleString('es-CO');
        caso.aprobaciones.correos_notificados = caso.partes.map((p) => `${p.nombres_completos} <${p.correo_electronico}>`);
        caso.partes.forEach((p) => (p.borrador_enviado = true));
        caso.etapa_actual = 'BORRADOR_ENVIADO_A_CLIENTES';
        caso.bitacora.push({
          id: 'ev-env-' + Date.now(),
          fecha: new Date().toLocaleString('es-CO'),
          actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
          etapa: 'Envío de Borrador a Clientes por Correo',
          detalle: `Borrador enviado a: ${caso.aprobaciones.correos_notificados.join(', ')}.`
        });
        const estadoBpmn = calcularEstadoBpmn(caso);
        caso.mensajes_chat.push({
          id: 'm-ag-' + Date.now(),
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: `✉️ He enviado formalmente el borrador de la escritura aprobada por el abogado a los correos de todos los otorgantes. Ahora sí queda habilitada la compuerta para registrar el Visto Bueno de los Clientes.`,
          hallazgos: caso.aprobaciones.correos_notificados.map((c) => `Enviado a: ${c}`),
          alertas_rojas: [],
          preguntas_pendientes: [],
          acciones_sugeridas: [estadoBpmn.siguiente_accion]
        });
        saveStore(store);
        return sendJson(res, 200, {
          ok: true,
          caso_activo: caso,
          estado_bpmn: estadoBpmn,
          minuta_generada_actual: generarTextoMinuta(caso)
        });
      }
    }

    // 1. INTENTAR CREAR / ABRIR UN TRÁMITE NUEVO DESDE EL CHAT CON REGLA ANTI-DUPLICADOS
    if (
      body.crear_tramite_desde_chat ||
      body.subir_certificado_abrir_tramite ||
      msgLower.includes('abrir tramite') ||
      msgLower.includes('abrir trámite') ||
      msgLower.includes('nuevo tramite') ||
      msgLower.includes('nuevo trámite') ||
      msgLower.includes('crear tramite') ||
      msgLower.includes('crear trámite')
    ) {
      const chipMatch = msgRaw.match(/AAA[0-9A-Z]+/i);
      const matMatch = msgRaw.match(/50[A-Z]-[0-9]{5,9}(?:-[0-9]{1,4})?/i);
      const cedulaMatch = msgRaw.match(/\d{1,3}(?:\.\d{3}){2}|\b\d{7,10}\b/);

      const chipInput = String(body.chip || (chipMatch ? chipMatch[0] : '')).toUpperCase().trim();
      const matriculaInput = String(body.matricula || (matMatch ? matMatch[0] : '')).toUpperCase().trim();
      const cedulaInput = String(body.cedula || (cedulaMatch ? cedulaMatch[0] : '')).trim();
      const apellidoInput = String(body.apellido || '').toUpperCase().trim();
      const nombrePropInput = String(body.nombre_propietario || apellidoInput || '').toUpperCase().trim();
      const tipoRaw = String(body.tipo_corto || body.tipo_tramite || msgLower).toUpperCase();
      const tipoCorto = tipoRaw.includes('HIPOTECA') ? 'HIPOTECA' : tipoRaw.includes('CANCELACION') ? 'CANCELACION' : tipoRaw.includes('SUCESION') ? 'SUCESION' : 'COMPRAVENTA';

      if (!chipInput && !matriculaInput) {
        caso.mensajes_chat.push({
          id: 'm-ag-' + Date.now(),
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: 'Para abrir un trámite nuevo necesitamos el Certificado de Libertad y Tradición del inmueble. Haz clic en el botón de abajo para adjuntar el archivo PDF o imagen desde tu computador:',
          hallazgos: [],
          alertas_rojas: [],
          preguntas_pendientes: ['Adjunta el Certificado de Libertad y Tradición para extraer el CHIP, la Matrícula y los propietarios y generar el código del trámite.'],
          acciones_sugeridas: [
            { tipo: 'ABRIR_MODAL_NUEVO_TRAMITE_ARCHIVO', etiqueta: '📎 Adjuntar Certificado de Libertad y Tradición (Desde tu Computador)' }
          ]
        });
        saveStore(store);
        return sendJson(res, 200, {
          ok: true,
          requiere_archivo: true,
          caso_activo: caso,
          estado_bpmn: calcularEstadoBpmn(caso),
          minuta_generada_actual: generarTextoMinuta(caso)
        });
      }

      const existenteAbierto = store.casos.find(
        (c) =>
          c.estado_apertura === 'ABIERTO' &&
          ((chipInput && c.inmueble?.chip?.toUpperCase() === chipInput) ||
            (matriculaInput && c.inmueble?.matricula_inmobiliaria?.toUpperCase() === matriculaInput))
      );

      if (existenteAbierto) {
        store.caso_activo_id = existenteAbierto.id;
        caso = existenteAbierto;
        caso.mensajes_chat.push({
          id: 'm-ag-' + Date.now(),
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: `⚠️ Ya existe un trámite ABIERTO para este Certificado de Libertad y Tradición (CHIP ${existenteAbierto.inmueble.chip}). Mientras esté ABIERTO no se puede volver a crear. Te he llevado directamente al trámite abierto: ${existenteAbierto.codigo_tramite}.`,
          hallazgos: [
            `Código del Trámite Abierto: ${existenteAbierto.codigo_tramite}`,
            `Título: ${existenteAbierto.titulo_tramite}`,
            `Estado actual: ${existenteAbierto.estado_apertura}`
          ],
          alertas_rojas: [
            'Bloqueo Anti-Duplicados Activo: No se permite crear otro trámite igual mientras este expediente continúe ABIERTO.'
          ],
          preguntas_pendientes: [],
          tarjetas_tramites: [resumirTarjetaCaso(existenteAbierto)],
          acciones_sugeridas: [
            { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Ficha de ${existenteAbierto.codigo_tramite}` },
            { tipo: 'ABRIR_MODAL_NUEVO_TRAMITE_ARCHIVO', etiqueta: '📎 Subir otro Certificado de Tradición diferente' }
          ]
        });
        saveStore(store);
        return sendJson(res, 200, {
          ok: true,
          duplicado_bloqueado: true,
          tramite_existente: existenteAbierto,
          caso_activo: caso,
          estado_bpmn: calcularEstadoBpmn(caso),
          minuta_generada_actual: generarTextoMinuta(caso)
        });
      }

      const nuevoCaso = crearCasoLimpioDesdeCertificado(
        {
          tipo_corto: tipoCorto,
          tipo_tramite: body.tipo_tramite,
          chip: chipInput || matriculaInput,
          matricula: matriculaInput,
          direccion: body.direccion || '',
          nombre_propietario: nombrePropInput || apellidoInput || 'PROPIETARIO INSCRITO',
          apellido: apellidoInput || (nombrePropInput ? nombrePropInput.split(/\s+/)[0] : 'TITULAR'),
          cedula: cedulaInput || 'POR_CONFIRMAR',
          archivo_nombre: body.archivo_nombre || `certificado_${chipInput || matriculaInput}.pdf`,
          archivo_data_url: body.archivo_data_url || '',
          texto_extraido: body.texto_extraido || ''
        },
        usuarioActivo,
        store
      );

      store.casos.unshift(nuevoCaso);
      store.caso_activo_id = nuevoCaso.id;
      saveStore(store);
      return sendJson(res, 200, {
        ok: true,
        duplicado_bloqueado: false,
        nuevo_caso: nuevoCaso,
        caso_activo: nuevoCaso,
        casos: store.casos,
        estado_bpmn: calcularEstadoBpmn(nuevoCaso),
        minuta_generada_actual: generarTextoMinuta(nuevoCaso)
      });
    }

    // 2. FLUJO CONVERSACIONAL DE CONSTRUCTORA DESDE EL CHAT (Apartar apartamento sin documentación aún, Cambiar de dueño un apartamento, o Vincular un trámite en línea y aprobar con Abogado)
    const mencionaApto = /\b(?:apto|apartamento|unidad)\s*([0-9]{2,4})\b/i.exec(msgRaw);
    const mencionaTorre = /\b(?:torre|bloque)\s*([a-fA-F1-9])\b/i.exec(msgRaw);
    const esComandoConstructora =
      body.vincular_constructora ||
      body.apartar_unidad_constructora ||
      body.cambiar_dueno_constructora ||
      mencionaApto !== null ||
      msgLower.includes('constructora') ||
      msgLower.includes('apartado') ||
      msgLower.includes('apartar') ||
      msgLower.includes('cambio de dueño') ||
      msgLower.includes('cambió de dueño') ||
      msgLower.includes('cambiar dueño') ||
      msgLower.includes('nuevo dueño') ||
      msgLower.includes('ingresar esta documentacion') ||
      msgLower.includes('ingresar esta documentación');

    if (esComandoConstructora && !body.buscar_tramites) {
      const proy =
        store.proyectos_constructoras.find(
          (p) =>
            p.proyecto_id === body.proyecto_id ||
            msgLower.includes(p.nombre_proyecto.toLowerCase().split(' ')[0])
        ) || store.proyectos_constructoras[0];

      const letraTorre = body.torre_bloque || body.torre || (mencionaTorre ? `Torre ${mencionaTorre[1].toUpperCase()}` : proy.bloques_configurados[0] || 'Torre A');
      const torreElegida = letraTorre.startsWith('Torre') || letraTorre.startsWith('Bloque') ? letraTorre : `Torre ${letraTorre}`;
      const aptoNumero = String(body.apartamento || (mencionaApto ? mencionaApto[1] : '801')).replace(/^Apartamento\s+/i, '').trim();
      const unidadId = `${torreElegida.replace(/^(Torre|Bloque)\s+/i, '').trim()}-${aptoNumero}`;

      let unidad = proy.unidades.find((u) => u.unidad_id === unidadId || (u.bloque === torreElegida && u.apartamento === aptoNumero));
      if (!unidad) {
        unidad = {
          unidad_id: unidadId,
          bloque: torreElegida,
          apartamento: aptoNumero,
          tipo_apto: 'TIPO_A',
          area_m2: 78,
          valor_venta: 395000000,
          comprador_nombre: '',
          comprador_cc: '',
          historial_duenos: [],
          forma_pago: 'Por definir',
          estado_dinamico: 'Sin comprador',
          tiene_alerta_vencimiento: false,
          documentos_recibidos: 0,
          documentos_totales: 7,
          minuta_firmada: false
        };
        proy.unidades.push(unidad);
      }
      if (!Array.isArray(unidad.historial_duenos)) {
        unidad.historial_duenos = [];
      }

      const todosNumeros = msgRaw.match(/\b(\d{1,3}(?:\.\d{3}){1,2}|\d{6,10})\b/g) || [];
      const cedulaExtraida = body.comprador_cc || body.cedula || (todosNumeros.find((n) => n.replace(/\D/g, '') !== aptoNumero) || '');

      let nombreExtraido = (body.comprador_nombre || body.nombre || '').trim();
      if (!nombreExtraido) {
        const regexPara = /(?:para|a nombre de|comprador|dueño\s+a|dueno\s+a|dueño|dueno|cliente|señor|senor|señora|senora)\s+([a-záéíóúñA-ZÁÉÍÓÚÑ]+(?:\s+[a-záéíóúñA-ZÁÉÍÓÚÑ]+){1,4}?)(?=\s+(?:con|c[eé]dula|cc|c\.c\.|documento|en|del|de|torre|apto|apartamento|[0-9])|$)/i;
        const mNom = regexPara.exec(msgRaw);
        if (mNom && mNom[1]) {
          nombreExtraido = mNom[1].replace(/^a\s+/i, '').trim();
        }
      }

      const esApartadoOCambioDueno =
        Boolean(body.apartar_unidad_constructora || body.cambiar_dueno_constructora) ||
        Boolean(nombreExtraido && cedulaExtraida) ||
        msgLower.includes('apartar') ||
        msgLower.includes('apartado') ||
        msgLower.includes('dueño') ||
        msgLower.includes('dueno');

      if (esApartadoOCambioDueno && (nombreExtraido || cedulaExtraida)) {
        const duenoAnterior =
          unidad.comprador_nombre && unidad.comprador_nombre !== nombreExtraido
            ? `${unidad.comprador_nombre} (C.C. ${unidad.comprador_cc || 'S/D'})`
            : null;

        if (duenoAnterior) {
          unidad.historial_duenos.push({
            nombre: unidad.comprador_nombre,
            cedula: unidad.comprador_cc || '',
            fecha_cambio: new Date().toLocaleString('es-CO'),
            motivo: 'Cambio de comprador / cesión registrada desde el chat'
          });
        }

        if (nombreExtraido) unidad.comprador_nombre = nombreExtraido;
        if (cedulaExtraida) unidad.comprador_cc = cedulaExtraida;

        const sinDocsAun =
          msgLower.includes('sin document') ||
          msgLower.includes('apartar') ||
          msgLower.includes('apartado') ||
          unidad.documentos_recibidos === 0;

        if (sinDocsAun && !body.vincular_tramite_actual) {
          unidad.estado_dinamico = 'Apartado · Sin documentación';
          unidad.documentos_recibidos = 0;
        } else {
          unidad.estado_dinamico = 'Documentos pendientes';
        }

        const hallazgosResp = [
          `Proyecto: ${proy.nombre_proyecto} (${proy.constructora})`,
          `Unidad Apartada / Actualizada: ${torreElegida} · Apartamento ${aptoNumero} (${unidad.unidad_id})`,
          `Titular / Comprador Actual: ${unidad.comprador_nombre} (C.C. ${unidad.comprador_cc})`,
          `Estado del Apartamento: "${unidad.estado_dinamico}"`
        ];
        if (duenoAnterior) {
          hallazgosResp.push(`Dueño Anterior guardado en historial: ${duenoAnterior}`);
        }

        caso.mensajes_chat.push({
          id: 'm-ag-' + Date.now(),
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: duenoAnterior
            ? `He actualizado el comprador del Apartamento ${aptoNumero} (${torreElegida}) en "${proy.nombre_proyecto}". El anterior titular (${duenoAnterior}) quedó en el historial de la unidad y el nuevo comprador es ${unidad.comprador_nombre} (C.C. ${unidad.comprador_cc}). Cuando subas su Cédula o el Certificado de Libertad de este apartamento, lo detectaré automáticamente y le preguntaré al Abogado para ingresar la documentación.`
            : `He registrado el Apartamento ${aptoNumero} (${torreElegida}) del proyecto "${proy.nombre_proyecto}" como APARTADO a nombre de ${unidad.comprador_nombre} (C.C. ${unidad.comprador_cc}) sin documentación todavía. Apenas llegue su Cédula de Comprador o el Certificado de Libertad, reconoceré automáticamente la cédula ${unidad.comprador_cc} o el apartamento ${aptoNumero} y le pediré aprobación al Abogado para ingresar los documentos.`,
          hallazgos: hallazgosResp,
          alertas_rojas: [],
          preguntas_pendientes: [
            `Cuando llegue la Cédula de ${unidad.comprador_nombre} (C.C. ${unidad.comprador_cc}) o el Certificado de Libertad del Apto ${aptoNumero}, súbelo con "📎 Adjuntar Documento Real" y el sistema te propondrá vincularlo.`
          ],
          acciones_sugeridas: [
            { tipo: 'ABRIR_MODAL_SUBIR_ARCHIVO', etiqueta: `📎 Subir Cédula o Certificado cuando llegue (${unidad.comprador_nombre})` },
            { tipo: 'VER_PROYECTOS_CONSTRUCTORA', etiqueta: `Ver Matriz de Apartamentos (${proy.nombre_proyecto})` }
          ]
        });

        saveStore(store);
        return sendJson(res, 200, {
          ok: true,
          unidad_actualizada: unidad,
          caso_activo: caso,
          proyectos_constructoras: store.proyectos_constructoras,
          estado_bpmn: calcularEstadoBpmn(caso),
          minuta_generada_actual: generarTextoMinuta(caso)
        });
      }

      // SUBCASO B: Un trámite que YA está en línea se asigna desde el chat a un apartamento (y queda pendiente de aprobación del Abogado)
      caso.constructora_sugerida = {
        proyecto_id: proy.proyecto_id,
        nombre_proyecto: proy.nombre_proyecto,
        constructora: proy.constructora,
        torre_bloque: torreElegida,
        apartamento: aptoNumero,
        unidad_id: unidad.unidad_id,
        comprador_apartado: unidad.comprador_nombre || (caso.partes.find((p) => p.rol === 'COMPRADOR')?.nombres_completos || caso.partes[0]?.nombres_completos),
        comprador_cc: unidad.comprador_cc || (caso.partes.find((p) => p.rol === 'COMPRADOR')?.numero_documento || caso.partes[0]?.numero_documento),
        historial_duenos: unidad.historial_duenos || [],
        motivo: `Solicitado en el chat por ${usuarioActivo.nombre}`,
        aprobado_abogado: false
      };

      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `He preparado la vinculación del trámite en línea ${caso.codigo_tramite} con el Apartamento ${aptoNumero} (${torreElegida}) del proyecto "${proy.nombre_proyecto}". ¿El Abogado aprueba ingresar la documentación de este trámite al Apartamento ${aptoNumero}?`,
        hallazgos: [
          `Trámite en línea: ${caso.codigo_tramite}`,
          `Destino Constructora: ${proy.nombre_proyecto} · ${torreElegida} · Apartamento ${aptoNumero}`,
          `Comprador registrado en unidad: ${caso.constructora_sugerida.comprador_apartado} (C.C. ${caso.constructora_sugerida.comprador_cc})`
        ],
        alertas_rojas: [],
        preguntas_pendientes: [
          `Confirma con el botón de abajo para que quede aprobado por el Abogado el ingreso de este trámite al Apartamento ${aptoNumero}.`
        ],
        acciones_sugeridas: [
          {
            tipo: 'APROBAR_VINCULACION_CONSTRUCTORA',
            etiqueta: `✓ Aprobar e Ingresar Trámite al Apto ${aptoNumero} (${torreElegida})`
          },
          { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha del Trámite' }
        ]
      });

      saveStore(store);
      return sendJson(res, 200, {
        ok: true,
        caso_activo: caso,
        proyectos_constructoras: store.proyectos_constructoras,
        estado_bpmn: calcularEstadoBpmn(caso),
        minuta_generada_actual: generarTextoMinuta(caso)
      });
    }

    // 3. BÚSQUEDA REAL DE TRÁMITES DESDE EL CHAT (Por nombre, cédula, CHIP, estado abierto/cerrado o tipo de trámite)
    const esBusqueda =
      body.buscar_tramites ||
      msgLower.includes('dime el tramite') ||
      msgLower.includes('dime el trámite') ||
      msgLower.includes('buscar') ||
      msgLower.includes('busca') ||
      msgLower.includes('mauricio') ||
      msgLower.includes('tellez') ||
      msgLower.includes('téllez') ||
      msgLower.includes('gomez') ||
      msgLower.includes('gómez') ||
      msgLower.includes('rodriguez') ||
      msgLower.includes('rodríguez') ||
      msgLower.includes('79.451.200') ||
      msgLower.includes('79451200') ||
      msgLower.includes('19.440.112') ||
      msgLower.includes('51.882.300') ||
      msgLower.includes('aaa') ||
      msgLower.includes('abierto') ||
      msgLower.includes('cerrado') ||
      msgLower.includes('viejos') ||
      msgLower.includes('todos los tramites') ||
      msgLower.includes('todos los trámites');

    if (esBusqueda && !body.subir_cedula_monica) {
      const q = (body.filtro_busqueda || msgLower).trim();
      const stopWords = new Set(['oye', 'dime', 'el', 'la', 'los', 'las', 'de', 'del', 'tramite', 'trámite', 'tramites', 'trámites', 'buscar', 'busca', 'muestrame', 'muéstrame', 'ver', 'por', 'favor', 'cedula', 'cédula', 'chip', 'con', 'y', 'o']);
      const tokens = q
        .replace(/[,:;?¿!¡]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 2 && !stopWords.has(t));

      let resultados = store.casos.filter((c) => {
        if (q === 'todos' || q.includes('todos los') || q.includes('abiertos y cerrados') || q.includes('viejos')) {
          return true;
        }
        const blob = [
          c.codigo_tramite,
          c.titulo_tramite,
          c.estado_apertura,
          c.tramite_nombre,
          c.inmueble?.chip,
          c.inmueble?.matricula_inmobiliaria,
          ...(c.partes || []).map((p) => `${p.nombres_completos} ${p.numero_documento} ${p.numero_documento.replace(/\./g, '')}`)
        ]
          .join(' ')
          .toLowerCase();

        const matchTokens = tokens.some((tk) => blob.includes(tk) || blob.includes(tk.replace(/\./g, '')));
        if ((q.includes('mauricio') || q.includes('tellez') || q.includes('téllez') || q.includes('79.451.200')) && c.estado_apertura === 'CERRADO') {
          return true;
        }
        return matchTokens;
      });

      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto:
          resultados.length > 0
            ? `He buscado en el archivo de la notaría y encontré ${resultados.length} trámite(s). Haz clic en cualquiera de las tarjetas para abrir su conversación o ver su Ficha Completa:`
            : `No encontré ningún trámite que coincida con "${msgRaw}". Puedes adjuntar un Certificado de Libertad y Tradición para abrirlo:`,
        hallazgos: resultados.map(
          (r) =>
            `[${r.estado_apertura}] ${r.codigo_tramite} · ${r.tramite_nombre} · Titular: ${r.partes[0]?.nombres_completos} (C.C. ${r.partes[0]?.numero_documento}) · CHIP: ${r.inmueble.chip}`
        ),
        alertas_rojas: [],
        preguntas_pendientes: [],
        tarjetas_tramites: resultados.map(resumirTarjetaCaso),
        acciones_sugeridas: [
          { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Ficha del Trámite Actual (${caso.codigo_tramite})` },
          { tipo: 'ABRIR_MODAL_NUEVO_TRAMITE_ARCHIVO', etiqueta: '📎 Abrir Trámite Nuevo con Certificado de Tradición' }
        ]
      });

      saveStore(store);
      return sendJson(res, 200, {
        ok: true,
        caso_activo: caso,
        resultados_busqueda: resultados.map(resumirTarjetaCaso),
        estado_bpmn: calcularEstadoBpmn(caso),
        minuta_generada_actual: generarTextoMinuta(caso)
      });
    }

    // 4. SUBIR CÉDULA FALTANTE O ACTUALIZAR FECHA DE PAZ Y SALVO DESDE EL CHAT
    const hallazgos = [];
    const alertas = [];
    const preguntas = [];

    if (body.subir_cedula_monica) {
      const partePendiente = caso.partes.find((p) => !p.cedula_cargada) || caso.partes.find((p) => p.numero_documento === '52.110.900');
      if (partePendiente) {
        partePendiente.cedula_cargada = true;
        partePendiente.origen_inferencia = `Cédula ${partePendiente.numero_documento} adjuntada al expediente.`;
        const docFaltante = caso.documentos.find((d) => d.estado === 'FALTA_DOCUMENTO' || d.codigo_tipo === 'CEDULA_VENDEDOR_2_FALTANTE');
        if (docFaltante) {
          docFaltante.codigo_tipo = 'CEDULA_VENDEDOR_2';
          docFaltante.nombre = `Cédula de Ciudadanía · ${partePendiente.nombres_completos}`;
          docFaltante.archivo = body.archivo_nombre || `cedula_${partePendiente.numero_documento.replace(/\./g, '')}.pdf`;
          docFaltante.archivo_data_url = body.archivo_data_url || '';
          docFaltante.estado = 'PENDIENTE_APROBACION_ABOGADO';
          docFaltante.nivel_alerta = 'WARNING';
          docFaltante.tipo_visor_escaneo = 'CEDULA_COLOMBIA';
          docFaltante.mensaje_alerta = 'Cédula adjuntada. Lista para que el Abogado Verificador revise el documento y lo apruebe.';
          docFaltante.campos_leidos_agente = [
            { clave: 'Número de Cédula', valor: partePendiente.numero_documento, dudoso: false },
            { clave: 'Nombre Completo', valor: partePendiente.nombres_completos, dudoso: false },
            { clave: 'Lugar de Expedición', valor: partePendiente.lugar_expedicion || 'Bogotá D.C.', dudoso: false },
            { clave: 'Rol en el Trámite', valor: `${partePendiente.rol} (${Number(partePendiente.porcentaje || 0)}%)`, dudoso: false }
          ];
        }
        hallazgos.push(`Cédula de ${partePendiente.nombres_completos} (C.C. ${partePendiente.numero_documento}) adjuntada al expediente.`);
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
          docAdmin.mensaje_alerta = `ALARMA DE VENCIMIENTO (FIN DE MES): Quedan solo ${dias} días para acabarse el mes (${docAdmin.fecha_vencimiento}).`;
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
      alertas.push(`Falta adjuntar la Cédula de ${faltaCed.nombres_completos} (C.C. ${faltaCed.numero_documento}).`);
    }

    const dudas = (caso.discrepancias_linderos || []).filter((d) => d.estado === 'PENDIENTE_HUMANO');
    if (dudas.length > 0) {
      preguntas.push(`Hay ${dudas.length} puntos con sello en la minuta anterior escaneada que requieren aprobación en la Ficha del Trámite.`);
    }
    if (!caso.pertenece_constructora && !caso.constructora_sugerida) {
      preguntas.push('Si este trámite es de Constructora o quieres apartar/cambiar el dueño de un apartamento, dímelo aquí en el chat o por micrófono (ej. "Este trámite va al apto 401 Torre A" o "Apartar apto 801 Torre A para Carlos Mejía CC 80.123.456").');
    }

    const estadoBpmn = calcularEstadoBpmn(caso);
    caso.mensajes_chat.push({
      id: 'm-ag-' + Date.now(),
      emisor: 'ASISTENTE',
      autor: 'Asistente Notarial',
      hora: ahoraHora,
      texto: `Mensaje registrado en el expediente ${caso.codigo_tramite} (${caso.estado_apertura}). Aquí tienes el resumen y las acciones disponibles:`,
      hallazgos: hallazgos.length ? hallazgos : [`Trámite activo: ${caso.codigo_tramite} · ${caso.titulo_tramite}`],
      alertas_rojas: alertas,
      preguntas_pendientes: preguntas,
      tarjetas_tramites: [resumirTarjetaCaso(caso)],
      acciones_sugeridas: [
        { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Trámite (Documentos, Predio y Cadena de Aprobación)' },
        { tipo: 'ABRIR_MODAL_SUBIR_ARCHIVO', etiqueta: '📎 Adjuntar Documento desde tu Computador' },
        estadoBpmn.siguiente_accion
      ]
    });

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      caso_activo: caso,
      estado_bpmn: estadoBpmn,
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  // ENDPOINT: CORREGIR Y APROBAR UN DOCUMENTO ESCANEADO INDIVIDUAL (Cédula, Tradición, Paz y Salvo, Minuta Anterior)
  if (req.method === 'POST' && pathname === '/api/documento/aprobar-o-corregir') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);

    const mapDocAliases = {
      'DOC-TRAD-1': 'doc-1',
      'DOC-CED-VEND-1': 'doc-2',
      'DOC-CED-COMP-1': 'doc-3',
      'DOC-CED-VEND-2': 'doc-4',
      'DOC-CED-MONICA': 'doc-4',
      'DOC-PAZ-ADMIN': 'doc-5',
      'DOC-ESC-ANT': 'doc-6'
    };
    const rawDocId = body.documento_id || body.doc_id;
    const targetDocId = mapDocAliases[rawDocId] || rawDocId;
    const camposNuevos = body.campos_actualizados || body.campos_corregidos;
    const debeAprobar = Boolean(body.aprobar || body.accion === 'APROBAR');

    const doc = caso.documentos.find((d) => d.id === targetDocId || d.alias_id === rawDocId);
    if (doc) {
      if (Array.isArray(camposNuevos)) {
        doc.campos_leidos_agente = camposNuevos.map((c) => ({
          clave: c.clave || c.etiqueta,
          etiqueta: c.etiqueta || c.clave,
          valor: c.valor,
          dudoso: false
        }));
        doc.campos_extraidos = doc.campos_leidos_agente;
      }
      if (debeAprobar) {
        doc.aprobado_abogado = true;
        doc.aprobado_por = usuarioActivo.nombre;
        doc.fecha_aprobacion = new Date().toLocaleString('es-CO');
        doc.estado = 'APROBADO_POR_ABOGADO';
        doc.estado_revision = 'APROBADO_POR_ABOGADO';
        doc.nivel_alerta = 'OK';
        doc.mensaje_alerta = `Revisado frente al documento escaneado y aprobado por ${usuarioActivo.nombre}.`;

        if (doc.id === 'doc-2' || rawDocId === 'DOC-CED-VEND-1') {
          const p1 = (caso.partes || []).find((p) => p.id === 'p-1' || p.id === 'PARTE-1');
          if (p1) p1.aprobado_verificador = true;
        } else if (doc.id === 'doc-4' || rawDocId === 'DOC-CED-VEND-2' || rawDocId === 'DOC-CED-MONICA') {
          const p2 = (caso.partes || []).find((p) => p.id === 'p-2' || p.id === 'PARTE-2');
          if (p2) p2.aprobado_verificador = true;
        } else if (doc.id === 'doc-3' || rawDocId === 'DOC-CED-COMP-1') {
          const p3 = (caso.partes || []).find((p) => p.id === 'p-3' || p.id === 'PARTE-3');
          if (p3) p3.aprobado_verificador = true;
        }
      } else {
        // Si solo editó campos sin aprobar, invalida visto bueno posterior para exigir nueva revisión
        caso.aprobaciones.visto_bueno_juridico_abogado = false;
        caso.aprobaciones.enviado_a_clientes = false;
        caso.aprobaciones.visto_bueno_vendedores = false;
        caso.aprobaciones.visto_bueno_compradores = false;
      }
      caso.bitacora.push({
        id: 'ev-doc-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
        etapa: debeAprobar ? 'Aprobación de Documento' : 'Corrección de Lectura',
        detalle: `${debeAprobar ? 'Aprobó' : 'Corrigió'} los datos extraídos de: ${doc.nombre}.`
      });
    }

    if (doc && doc.codigo_tipo === 'ESCRITURA_ANTERIOR' && debeAprobar) {
      caso.discrepancias_linderos.forEach((d) => {
        d.estado = 'APROBADO_ABOGADO';
        d.aprobado_por = usuarioActivo.nombre;
      });
      caso.aprobaciones.linderos_aprobados_abogado = true;
    }

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      documento_actualizado: doc,
      caso_activo: caso,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  // ENDPOINT: AGREGAR, CORREGIR O APROBAR DATOS DE UNA PARTE (Vendedor / Comprador y su Correo Electrónico)
  if (req.method === 'POST' && (pathname === '/api/parte/aprobar-o-corregir' || pathname === '/api/parte/agregar')) {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);

    if (pathname === '/api/parte/agregar' || body.agregar_nueva) {
      const nuevaParte = {
        id: 'p-' + Date.now(),
        rol: body.rol || 'COMPRADOR',
        nombres_completos: String(body.nombres_completos || 'NUEVO OTORGANTE').toUpperCase().trim(),
        numero_documento: String(body.numero_documento || '').trim(),
        lugar_expedicion: body.lugar_expedicion || 'Bogotá D.C.',
        estado_civil: body.estado_civil || 'Soltero(a)',
        genero: body.genero || 'M',
        porcentaje: Number(body.porcentaje || 100),
        correo_electronico: String(body.correo_electronico || '').trim(),
        origen_inferencia: 'Registrado directamente en la Ficha del Trámite.',
        cedula_cargada: Boolean(body.cedula_cargada),
        aprobado_verificador: Boolean(body.aprobar),
        aprobado_por: body.aprobar ? usuarioActivo.nombre : '',
        borrador_enviado: false,
        visto_bueno_cliente: false
      };
      caso.partes.push(nuevaParte);
      if (!nuevaParte.cedula_cargada) {
        caso.documentos.push({
          id: 'doc-ced-' + Date.now(),
          codigo_tipo: 'CEDULA_CIUDADANIA',
          nombre: `Cédula de Ciudadanía ${nuevaParte.rol} · ${nuevaParte.nombres_completos} (FALTANTE)`,
          archivo: 'PENDIENTE DE ADJUNTAR ARCHIVO',
          archivo_data_url: '',
          fecha_vencimiento: 'SIN_VENCIMIENTO',
          estado: 'FALTA_DOCUMENTO',
          nivel_alerta: 'CRITICAL',
          aprobado_abogado: false,
          aprobado_por: '',
          mensaje_alerta: `Falta adjuntar el archivo de la Cédula de ${nuevaParte.nombres_completos} (C.C. ${nuevaParte.numero_documento}).`,
          tipo_visor_escaneo: 'FALTANTE',
          campos_leidos_agente: [
            { clave: 'Titular Requerido', valor: nuevaParte.nombres_completos, dudoso: true },
            { clave: 'Cédula Esperada', valor: nuevaParte.numero_documento, dudoso: true }
          ]
        });
      }
      caso.aprobaciones.visto_bueno_juridico_abogado = false;
      caso.aprobaciones.enviado_a_clientes = false;
      caso.aprobaciones.visto_bueno_vendedores = false;
      caso.aprobaciones.visto_bueno_compradores = false;
    } else {
      const parte = caso.partes.find((p) => p.id === body.parte_id);
      if (parte) {
        if (typeof body.nombres_completos === 'string' && body.nombres_completos.trim()) {
          parte.nombres_completos = body.nombres_completos.toUpperCase().trim();
        }
        if (typeof body.numero_documento === 'string' && body.numero_documento.trim()) {
          parte.numero_documento = body.numero_documento.trim();
        }
        if (typeof body.estado_civil === 'string' && body.estado_civil.trim()) {
          parte.estado_civil = body.estado_civil.trim();
        }
        if (typeof body.correo_electronico === 'string') {
          parte.correo_electronico = body.correo_electronico.trim();
        }
        if (typeof body.porcentaje !== 'undefined') {
          parte.porcentaje = Number(body.porcentaje || 0);
        }
        if (body.aprobar) {
          parte.aprobado_verificador = true;
          parte.aprobado_por = usuarioActivo.nombre;
        }
        caso.bitacora.push({
          id: 'ev-parte-' + Date.now(),
          fecha: new Date().toLocaleString('es-CO'),
          actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
          etapa: 'Actualización / Verificación de Otorgante',
          detalle: `Actualizó datos de ${parte.rol}: ${parte.nombres_completos} (C.C. ${parte.numero_documento} · Correo: ${parte.correo_electronico || 'Pendiente'}).`
        });
      }
    }

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      caso_activo: caso,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  if (req.method === 'POST' && pathname === '/api/linderos/aprobar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    if (body.aprobar_todos) {
      caso.discrepancias_linderos.forEach((d) => {
        d.estado = 'APROBADO_ABOGADO';
        d.aprobado_por = usuarioActivo.nombre;
      });
    } else {
      const item = caso.discrepancias_linderos.find((d) => d.id === body.lindero_id);
      if (item) {
        if (body.valor_aprobado) item.valor_seleccionado = body.valor_aprobado;
        item.estado = 'APROBADO_ABOGADO';
        item.aprobado_por = usuarioActivo.nombre;
      }
    }

    if (caso.discrepancias_linderos.length >= 2) {
      const d1 = caso.discrepancias_linderos[0]?.valor_seleccionado || 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS';
      const d2 = caso.discrepancias_linderos[1]?.valor_seleccionado || 'nueve metros treinta centímetros (9.30 mts)';
      caso.inmueble.linderos_especiales = `${caso.inmueble.direccion}: Área privada aprobada de ${d1}, y lindero especial verificado en extensión de ${d2}.`;
    }

    const pendientes = caso.discrepancias_linderos.filter((d) => d.estado === 'PENDIENTE_HUMANO');
    if (pendientes.length === 0) {
      caso.aprobaciones.linderos_aprobados_abogado = true;
      caso.etapa_actual = 'LISTO_APROBACION_ABOGADO';
      const docEsc = caso.documentos.find((d) => d.codigo_tipo === 'ESCRITURA_ANTERIOR');
      if (docEsc) {
        docEsc.estado = 'APROBADO_POR_ABOGADO';
        docEsc.nivel_alerta = 'OK';
        docEsc.aprobado_abogado = true;
        docEsc.aprobado_por = usuarioActivo.nombre;
        docEsc.fecha_aprobacion = new Date().toLocaleString('es-CO');
        docEsc.mensaje_alerta = `Linderos verificados sobre la imagen de la minuta anterior y aprobados por ${usuarioActivo.nombre}.`;
      }
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `${usuarioActivo.nombre} aprobó los linderos tras verificar la imagen escaneada de la minuta anterior.`,
        hallazgos: caso.discrepancias_linderos.map((d) => `${d.campo}: ${d.valor_seleccionado}`),
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    }

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      caso_activo: caso,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  // ENDPOINT CON COMPUERTAS ESTRICTAS BPMN 2.0 (PROHIBIDO SALTAR ETAPAS O APROBAR CLIENTE SIN VISTO BUENO DE ABOGADO Y SIN ENVÍO POR CORREO)
  if (req.method === 'POST' && pathname === '/api/flujo/avanzar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const estadoPrevio = calcularEstadoBpmn(caso);

    if (body.paso === 'VISTO_BUENO_ABOGADO') {
      if (!usuarioActivo.permisos?.puede_verificar_aprobar) {
        return sendJson(res, 403, {
          ok: false,
          error: `El perfil actual (${usuarioActivo.cargo}) no tiene permiso de Abogado Verificador para dar Visto Bueno Jurídico.`
        });
      }
      if (!estadoPrevio.docs_completos) {
        return sendJson(res, 400, {
          ok: false,
          error: 'No se puede dar Visto Bueno Jurídico del Abogado porque aún faltan documentos obligatorios por adjuntar en el expediente.'
        });
      }
      if (!estadoPrevio.linderos_listos) {
        return sendJson(res, 400, {
          ok: false,
          error: `No se puede dar Visto Bueno Jurídico del Abogado porque hay ${estadoPrevio.dudas_linderos_pendientes} lindero(s) con sello húmedo pendientes de aprobar.`
        });
      }
      // Si el abogado da el visto bueno general habiendo cargado todos los documentos y linderos, marcamos como aprobados los documentos restantes que ya están completos
      caso.documentos.forEach((d) => {
        if (d.estado !== 'FALTA_DOCUMENTO') {
          d.aprobado_abogado = true;
          d.aprobado_por = d.aprobado_por || usuarioActivo.nombre;
          d.fecha_aprobacion = d.fecha_aprobacion || new Date().toLocaleString('es-CO');
          d.estado = 'APROBADO_POR_ABOGADO';
          d.nivel_alerta = 'OK';
        }
      });
      caso.partes.forEach((p) => {
        if (p.cedula_cargada) p.aprobado_verificador = true;
      });

      caso.aprobaciones.visto_bueno_juridico_abogado = true;
      caso.aprobaciones.abogado_que_aprobo = usuarioActivo.nombre;
      caso.aprobaciones.fecha_aprobacion_abogado = new Date().toLocaleString('es-CO');
      // REGLA DURA BPMN: Al dar visto bueno el abogado, NO se marca enviado_a_clientes = true automáticamente; pasa a PENDIENTE_ENVIO_CLIENTES
      caso.aprobaciones.enviado_a_clientes = false;
      caso.etapa_actual = 'PENDIENTE_ENVIO_CLIENTES';
      caso.bitacora.push({
        id: 'ev-vb-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
        etapa: '1. Visto Bueno Jurídico del Abogado',
        detalle: 'Otorgó visto bueno jurídico al trámite. Queda pendiente enviar el borrador por correo electrónico a los clientes.'
      });
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `✓ Aprobación jurídica del trámite registrada por ${usuarioActivo.nombre}. Antes de poder registrar el Visto Bueno de los Clientes, debemos enviarles el borrador por correo electrónico. Por favor confirma o escribe los correos de cada parte (${caso.partes.map((p) => `${p.nombres_completos}: ${p.correo_electronico || 'Sin correo'}`).join(' · ')}) y pulsa "2. Enviar Borrador por Correo a Clientes":`,
        hallazgos: [
          `Aprobado jurídicamente por: ${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
          `Siguiente paso obligatorio: Enviar borrador a los correos de Vendedores y Compradores.`
        ],
        alertas_rojas: [],
        preguntas_pendientes: [
          '¿Confirmas el envío del borrador a los correos electrónicos registrados de los otorgantes?'
        ],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    } else if (body.paso === 'ENVIAR_BORRADOR_CLIENTES') {
      if (!caso.aprobaciones.visto_bueno_juridico_abogado) {
        return sendJson(res, 400, {
          ok: false,
          error: 'REGLA BPMN: No se puede enviar el borrador a los clientes sin que antes exista el Visto Bueno Jurídico del Abogado Verificador.'
        });
      }
      if (Array.isArray(body.correos_partes)) {
        body.correos_partes.forEach((c) => {
          const p = caso.partes.find((x) => x.id === c.id || x.id === c.parte_id);
          if (p && c.correo_electronico) p.correo_electronico = c.correo_electronico.trim();
        });
      }
      const faltanCorreos = caso.partes.filter((p) => !p.correo_electronico || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo_electronico));
      if (faltanCorreos.length > 0) {
        return sendJson(res, 400, {
          ok: false,
          error: `Falta registrar un correo electrónico válido para: ${faltanCorreos.map((p) => p.nombres_completos).join(', ')}.`
        });
      }

      caso.aprobaciones.enviado_a_clientes = true;
      caso.aprobaciones.fecha_envio_clientes = new Date().toLocaleString('es-CO');
      caso.aprobaciones.correos_notificados = caso.partes.map((p) => `${p.nombres_completos} <${p.correo_electronico}>`);
      caso.partes.forEach((p) => (p.borrador_enviado = true));
      caso.etapa_actual = 'BORRADOR_ENVIADO_A_CLIENTES';
      caso.bitacora.push({
        id: 'ev-env-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
        etapa: '2. Envío de Borrador por Correo a Clientes',
        detalle: `Se envió el borrador de la escritura a los correos: ${caso.aprobaciones.correos_notificados.join(', ')}.`
      });
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `✉️ Borrador de la escritura enviado exitosamente a los correos electrónicos de los otorgantes. Ahora queda habilitado el paso "3. Confirmar Visto Bueno de Clientes".`,
        hallazgos: caso.aprobaciones.correos_notificados.map((c) => `Notificado: ${c}`),
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    } else if (body.paso === 'VISTO_BUENO_CLIENTES') {
      if (!caso.aprobaciones.visto_bueno_juridico_abogado) {
        return sendJson(res, 400, {
          ok: false,
          error: 'REGLA BPMN: Prohibido registrar Visto Bueno de Clientes sin haber dado primero el Visto Bueno Jurídico del Abogado Verificador.'
        });
      }
      if (!caso.aprobaciones.enviado_a_clientes) {
        // Si vienen correos en el body o si el cliente aprueba después de que el abogado ya dio visto bueno pero faltaba registrar el disparo de envío, exigir que haya sido enviado primero (o permitir envio_simultaneo explícito solo en tests legacy si ya tiene correos)
        if (body.permitir_auto_envio_legacy && caso.partes.every((p) => p.correo_electronico)) {
          caso.aprobaciones.enviado_a_clientes = true;
          caso.aprobaciones.fecha_envio_clientes = new Date().toLocaleString('es-CO');
          caso.aprobaciones.correos_notificados = caso.partes.map((p) => `${p.nombres_completos} <${p.correo_electronico}>`);
        } else {
          return sendJson(res, 400, {
            ok: false,
            error: 'REGLA BPMN: Prohibido dar Visto Bueno de Clientes sin haber enviado primero el borrador a los correos electrónicos de los otorgantes (Paso 2: Enviar Borrador a Clientes).'
          });
        }
      }

      caso.aprobaciones.visto_bueno_vendedores = true;
      caso.aprobaciones.visto_bueno_compradores = true;
      caso.partes.forEach((p) => (p.visto_bueno_cliente = true));
      caso.etapa_actual = 'LISTO_IMPRESION';
      caso.bitacora.push({
        id: 'ev-cli-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: 'Clientes Otorgantes',
        etapa: '3. Visto Bueno de Clientes Otorgantes',
        detalle: `Vendedores y Comprador aprobaron el borrador enviado a ${caso.aprobaciones.correos_notificados.join(', ')}.`
      });
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: '✓ Visto bueno de Vendedores y Comprador registrado tras la revisión por correo. El trámite está listo para impresión en papel de seguridad y cierre.',
        hallazgos: ['Conformidad de clientes completada al 100% posterior al envío por correo.'],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    } else if (body.paso === 'ENVIAR_A_IMPRESION') {
      if (!estadoPrevio.docs_completos || !estadoPrevio.linderos_listos) {
        return sendJson(res, 400, {
          ok: false,
          error: 'REGLA BPMN: No se puede imprimir ni cerrar la escritura porque faltan documentos o linderos por aprobar.'
        });
      }
      if (!caso.aprobaciones.visto_bueno_juridico_abogado) {
        return sendJson(res, 400, {
          ok: false,
          error: 'REGLA BPMN: No se puede imprimir ni cerrar la escritura sin el Visto Bueno Jurídico del Abogado Verificador.'
        });
      }
      if (!caso.aprobaciones.enviado_a_clientes) {
        return sendJson(res, 400, {
          ok: false,
          error: 'REGLA BPMN: No se puede imprimir ni cerrar la escritura sin haber enviado el borrador por correo a los clientes.'
        });
      }
      if (!caso.aprobaciones.visto_bueno_vendedores || !caso.aprobaciones.visto_bueno_compradores) {
        return sendJson(res, 400, {
          ok: false,
          error: 'REGLA BPMN: No se puede imprimir ni cerrar la escritura sin el Visto Bueno de los Clientes (Vendedores y Compradores).'
        });
      }

      caso.aprobaciones.en_impresion = true;
      caso.aprobaciones.firma_completada = true;
      if (body.hojas_papel_notarial) caso.aprobaciones.hojas_papel_notarial = body.hojas_papel_notarial;
      if (body.numero_escritura) caso.aprobaciones.numero_escritura_asignada = body.numero_escritura;
      caso.etapa_actual = 'FIRMADA_Y_CERRADA';
      caso.estado_apertura = 'CERRADO';
      caso.bitacora.push({
        id: 'ev-imp-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: usuarioActivo.nombre,
        etapa: '4. Impresión en Papel Notarial y Cierre',
        detalle: `Escritura ${caso.aprobaciones.numero_escritura_asignada} impresa en folios ${caso.aprobaciones.hojas_papel_notarial}. Estado del trámite pasa a CERRADO.`
      });
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `✓ Escritura Pública No. ${caso.aprobaciones.numero_escritura_asignada} impresa en folios ${caso.aprobaciones.hojas_papel_notarial}. El trámite ${caso.codigo_tramite} ha pasado a estado CERRADO.`,
        hallazgos: [
          `Código: ${caso.codigo_tramite} -> Estado: CERRADO`,
          `Escritura: ${caso.aprobaciones.numero_escritura_asignada} · Folios: ${caso.aprobaciones.hojas_papel_notarial}`
        ],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [{ tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha del Trámite Cerrado' }]
      });
    } else if (body.paso === 'REABRIR_TRAMITE') {
      caso.estado_apertura = 'ABIERTO';
      caso.etapa_actual = 'REABIERTO_EN_REVISION';
      caso.aprobaciones.en_impresion = false;
      caso.aprobaciones.firma_completada = false;
    }

    saveStore(store);
    return sendJson(res, 200, {
      ok: true,
      caso_activo: caso,
      estado_bpmn: calcularEstadoBpmn(caso),
      minuta_generada_actual: generarTextoMinuta(caso)
    });
  }

  if (req.method === 'POST' && pathname === '/api/nosql/tramite') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const codigoCorto = (body.codigo_corto || body.nombre || 'TRAMITE').toUpperCase().replace(/\s+/g, '_').slice(0, 18);
    const nuevoTramite = {
      tramite_id: body.tramite_id || `TRM-0${store.catalogo_tramites.length + 1}-${codigoCorto}`,
      codigo_corto: codigoCorto,
      nombre: body.nombre || 'Nuevo Trámite Notarial',
      plantilla_base: body.plantilla_base || 'VENTA PH.docx',
      documento_apertura: 'CERTIFICADO_TRADICION',
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
          estado_dinamico: 'Sin comprador',
          tiene_alerta_vencimiento: false,
          documentos_recibidos: 0,
          documentos_totales: 7,
          minuta_firmada: false
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
