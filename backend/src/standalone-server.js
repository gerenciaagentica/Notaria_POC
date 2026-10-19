const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 4000;
const STORE_PATH = path.join(__dirname, '..', 'database', 'local_store.json');
const FRONTEND_PATH = path.join(__dirname, '..', '..', 'frontend', 'app.html');

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
          origen_inferencia: 'Identificado como VENDEDOR por ser el primer propietario inscrito en la Anotación #14 del Certificado de Libertad y Tradición.',
          cedula_cargada: true,
          aprobado_verificador: true,
          aprobado_por: 'Dr. Carlos Salamanca',
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
          origen_inferencia: 'Identificada como co-propietaria VENDEDORA en la Anotación #14 del Certificado de Libertad y Tradición. ¡FALTA SUBIR SU CÉDULA!',
          cedula_cargada: false,
          aprobado_verificador: false,
          aprobado_por: '',
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
          origen_inferencia: 'Identificado como COMPRADOR porque su cédula fue adjuntada y no aparece como propietario anterior en el Certificado de Tradición.',
          cedula_cargada: true,
          aprobado_verificador: false,
          aprobado_por: '',
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

function calcularEstadoBpmn(caso) {
  const faltaCedula = caso.partes.some((p) => !p.cedula_cargada);
  const dudasLinderos = (caso.discrepancias_linderos || []).filter((d) => d.estado === 'PENDIENTE_HUMANO');
  const docsCompletos = !faltaCedula;
  const linderosListos = dudasLinderos.length === 0;
  const abogadoAprobo = Boolean(caso.aprobaciones.visto_bueno_juridico_abogado);
  const clienteAprobo = Boolean(caso.aprobaciones.visto_bueno_vendedores && caso.aprobaciones.visto_bueno_compradores);
  const impreso = Boolean(caso.aprobaciones.en_impresion || caso.aprobaciones.firma_completada || caso.estado_apertura === 'CERRADO');

  let pasoActualNumero = 1;
  let siguienteAccion = { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Trámite (Documentos, Predio y Aprobaciones)' };

  if (!docsCompletos) {
    pasoActualNumero = 1;
    siguienteAccion = { tipo: 'SUBIR_CEDULA_MONICA', etiqueta: 'Adjuntar Cédula Faltante (Mónica Pérez)' };
  } else if (docsCompletos && !linderosListos) {
    pasoActualNumero = 2;
    siguienteAccion = { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Trámite y Aprobar Linderos (${dudasLinderos.length} con sello)` };
  } else if (docsCompletos && linderosListos && !abogadoAprobo) {
    pasoActualNumero = 3;
    siguienteAccion = { tipo: 'APROBAR_ABOGADO', etiqueta: 'Dar Visto Bueno de Abogado Verificador' };
  } else if (docsCompletos && linderosListos && abogadoAprobo && !clienteAprobo) {
    pasoActualNumero = 4;
    siguienteAccion = { tipo: 'APROBAR_CLIENTES', etiqueta: 'Registrar Visto Bueno del Cliente' };
  } else if (docsCompletos && linderosListos && abogadoAprobo && clienteAprobo && !impreso) {
    pasoActualNumero = 5;
    siguienteAccion = { tipo: 'IMPRIMIR_ESCRITURA', etiqueta: 'Asignar Papel Notarial, Imprimir y Cerrar Trámite' };
  } else if (impreso) {
    pasoActualNumero = 6;
    siguienteAccion = { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha del Trámite Cerrado' };
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
  const resumenComp = compradores.map((c) => `${c.nombres_completos} · C.C. ${c.numero_documento}`).join('\n') || 'NO APLICA';

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

  const clausulaConstructora = caso.pertenece_constructora
    ? `\nPROYECTO DE CONSTRUCTORA VINCULADO: ${caso.constructora_info.nombre_proyecto} · ${caso.constructora_info.torre_bloque} · Apartamento ${caso.constructora_info.apartamento}.`
    : '';

  return `REPÚBLICA DE COLOMBIA
NOTARÍA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.
CÓDIGO DE TRÁMITE: ${caso.codigo_tramite} (${caso.estado_apertura})
ESCRITURA PÚBLICA NÚMERO: ${caso.aprobaciones.numero_escritura_asignada}
DE FECHA: ${new Date().toLocaleDateString('es-CO')} · AÑO DOS MIL VEINTISÉIS (2026)
-----------------------------------------------------------------------------------------
ACTO NOTARIAL: ${caso.tramite_nombre}
SUBCATEGORÍAS APLICADAS: ${(caso.subcategorias_activas || []).join(' + ')}${clausulaConstructora}
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
-----------------------------------------------------------------------------------------
APROBACIÓN Y PAPEL DE SEGURIDAD NOTARIAL (RESOLUCIÓN 964 DE 2026):
Abogado que Cargó el Trámite: ${caso.creado_por || 'Laura Gómez'}
Abogado Verificador que Aprobó: ${caso.aprobaciones.abogado_que_aprobo || 'Pendiente de aprobación'}
Folios de Papel Notarial Utilizados: ${caso.aprobaciones.hojas_papel_notarial}
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

  if (req.method === 'GET' && (pathname === '/api/state' || pathname === '/api/estado')) {
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    return sendJson(res, 200, {
      ...store,
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
    const encontrado = store.casos.find((c) => c.id === body.caso_id || c.codigo_tramite === body.codigo_tramite);
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

  // ENDPOINT DE CHAT INTELIGENTE: Busca trámites por cédula/CHIP/nombre, valida duplicados abiertos, crea trámites con Certificado de Tradición y vincula Constructoras
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
      const chipInput = (body.chip || (msgRaw.match(/AAA[0-9A-Z]+/i) || [])[0] || 'AAA0142BCDE').toUpperCase();
      const cedulaInput = (body.cedula || (msgRaw.match(/\d{2}\.?\d{3}\.?\d{3}/) || [])[0] || '79.451.200').trim();
      const apellidoInput = (body.apellido || (msgLower.includes('ramirez') || msgLower.includes('ramírez') ? 'RAMIREZ' : msgLower.includes('lopez') || msgLower.includes('lópe') ? 'LOPEZ' : 'TELLEZ')).toUpperCase();
      const tipoRaw = (body.tipo_corto || body.tipo_tramite || msgLower).toUpperCase();
      const tipoCorto = tipoRaw.includes('HIPOTECA') ? 'HIPOTECA' : tipoRaw.includes('CANCELACION') ? 'CANCELACION' : 'COMPRAVENTA';

      // Verificar si ya existe un trámite ABIERTO con ese mismo CHIP o con esa misma Cédula y Tipo
      const existenteAbierto = store.casos.find(
        (c) =>
          c.estado_apertura === 'ABIERTO' &&
          (c.inmueble?.chip?.toUpperCase() === chipInput ||
            (body.forzar_duplicado_check && c.partes.some((p) => p.numero_documento.replace(/\./g, '') === cedulaInput.replace(/\./g, ''))))
      );

      if (existenteAbierto && !body.forzar_nuevo_distinto) {
        store.caso_activo_id = existenteAbierto.id;
        caso = existenteAbierto;
        caso.mensajes_chat.push({
          id: 'm-ag-' + Date.now(),
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: `⚠️ Ya existe un trámite ABIERTO para este Certificado de Libertad y Tradición (CHIP ${existenteAbierto.inmueble.chip} / Cédula ${cedulaInput}). Mientras esté ABIERTO no se puede duplicar. Te he llevado directamente al trámite abierto: ${existenteAbierto.codigo_tramite}.`,
          hallazgos: [
            `Código del Trámite Abierto: ${existenteAbierto.codigo_tramite}`,
            `Título: ${existenteAbierto.titulo_tramite}`,
            `Estado actual: ${existenteAbierto.estado_apertura} (${existenteAbierto.etapa_actual})`
          ],
          alertas_rojas: [
            'Bloqueo Anti-Duplicados Activo: No se permite crear otro trámite igual mientras este expediente continúe ABIERTO.'
          ],
          preguntas_pendientes: [
            '¿Deseas ver la ficha completa de este trámite o prefieres abrir un trámite con un Certificado de Tradición y CHIP diferente?'
          ],
          tarjetas_tramites: [resumirTarjetaCaso(existenteAbierto)],
          acciones_sugeridas: [
            { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Ficha de ${existenteAbierto.codigo_tramite}` },
            { tipo: 'CREAR_TRAMITE_NUEVO_CHIP', etiqueta: 'Abrir Trámite Nuevo con otro Certificado de Tradición (Ej: CHIP AAA0299BCDE · Ramírez)' }
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

      // Si el CHIP no tiene trámite abierto, crear el nuevo trámite codificado
      const nuevoChip = body.forzar_nuevo_distinto ? body.chip || 'AAA0299BCDE' : chipInput;
      const nuevoApellido = body.forzar_nuevo_distinto ? body.apellido || 'RAMIREZ' : apellidoInput;
      const nuevoNombreProp = body.nombre_propietario || 'CAMILO ANDRÉS RAMÍREZ SOTO';
      const nuevaCedula = body.forzar_nuevo_distinto ? body.cedula || '80.554.321' : cedulaInput;
      const nuevaMatricula = body.matricula || '50N-9944112';
      const nuevoCodigo = `${tipoCorto}-${nuevoChip}-${nuevoApellido}`;
      const nuevoId = 'caso-' + Date.now();

      const nuevoCaso = JSON.parse(JSON.stringify(store.casos[0]));
      nuevoCaso.id = nuevoId;
      nuevoCaso.codigo_tramite = nuevoCodigo;
      nuevoCaso.titulo_tramite = `${tipoCorto === 'HIPOTECA' ? 'Hipoteca' : 'Compraventa'} · ${nuevoNombreProp} · CHIP ${nuevoChip}`;
      nuevoCaso.estado_apertura = 'ABIERTO';
      nuevoCaso.estado_tramite = 'ABIERTO';
      nuevoCaso.radicado = 'NOT-2026-000' + Math.floor(200 + Math.random() * 700);
      nuevoCaso.creado_por = `${usuarioActivo.nombre} (${usuarioActivo.cargo})`;
      nuevoCaso.inmueble.chip = nuevoChip;
      nuevoCaso.inmueble.matricula_inmobiliaria = nuevaMatricula;
      nuevoCaso.inmueble.direccion = body.direccion || 'Carrera 11 # 93-46 Apto 802, Bogotá D.C.';
      nuevoCaso.certificado_tradicion.chip = nuevoChip;
      nuevoCaso.certificado_tradicion.matricula_inmobiliaria = nuevaMatricula;
      nuevoCaso.certificado_tradicion.direccion_actual = nuevoCaso.inmueble.direccion.toUpperCase();
      nuevoCaso.partes[0].nombres_completos = nuevoNombreProp;
      nuevoCaso.partes[0].numero_documento = nuevaCedula;
      nuevoCaso.mensajes_chat = [
        {
          id: 'm-new-1',
          emisor: 'ASISTENTE',
          autor: 'Asistente Notarial',
          hora: ahoraHora,
          texto: `He creado y abierto el nuevo trámite a partir del Certificado de Libertad y Tradición (${nuevaMatricula}). Código asignado: ${nuevoCodigo}.`,
          hallazgos: [
            `Código único generado: ${nuevoCodigo} (Estado: ABIERTO)`,
            `Primer propietario en Certificado de Tradición (Vendedor): ${nuevoNombreProp} (C.C. ${nuevaCedula}).`,
            `Creado por: ${usuarioActivo.nombre}.`
          ],
          alertas_rojas: [
            'Recuerda adjuntar las cédulas de todos los intervinientes y el Paz y Salvo de Administración si aplica.'
          ],
          preguntas_pendientes: [
            '¿Este trámite pertenece a algún proyecto de Constructora? (Indica Sí para guardar Torre y Apartamento).'
          ],
          tarjetas_tramites: [resumirTarjetaCaso(nuevoCaso)],
          acciones_sugeridas: [
            { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Ficha Completa de ${nuevoCodigo}` },
            { tipo: 'VINCULAR_CONSTRUCTORA_CHAT', etiqueta: 'Sí, pertenece a un Proyecto de Constructora' }
          ]
        }
      ];

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

    // 2. BÚSQUEDA DE TRÁMITES DESDE EL CHAT (Por nombre, cédula, CHIP, estado abierto/cerrado o tipo de trámite)
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
      msgLower.includes('aaa0') ||
      msgLower.includes('abierto') ||
      msgLower.includes('cerrado') ||
      msgLower.includes('viejos') ||
      msgLower.includes('todos los tramites') ||
      msgLower.includes('todos los trámites');

    if (esBusqueda && !body.subir_cedula_monica && !body.vincular_constructora) {
      const q = (body.filtro_busqueda || msgLower).trim();
      let resultados = store.casos.filter((c) => {
        const blob = [
          c.codigo_tramite,
          c.titulo_tramite,
          c.estado_apertura,
          c.tramite_nombre,
          c.inmueble?.chip,
          c.inmueble?.matricula_inmobiliaria,
          ...c.partes.map((p) => `${p.nombres_completos} ${p.numero_documento} ${p.numero_documento.replace(/\./g, '')}`)
        ]
          .join(' ')
          .toLowerCase();

        if (q.includes('mauricio') || q.includes('tellez') || q.includes('téllez') || q.includes('79.451.200') || q.includes('79451200')) {
          return (
            blob.includes('téllez') ||
            blob.includes('tellez') ||
            blob.includes('79.451.200') ||
            c.codigo_tramite === 'COMPRAVENTA-AAA0098XYZW-GOMEZ'
          );
        }
        if (q.includes('gomez') || q.includes('gómez') || q.includes('19.440.112') || q.includes('cerrado')) {
          return blob.includes('gómez') || blob.includes('gomez') || c.estado_apertura === 'CERRADO';
        }
        if (q.includes('rodriguez') || q.includes('rodríguez') || q.includes('hipoteca') || q.includes('51.882.300')) {
          return blob.includes('rodríguez') || blob.includes('hipoteca');
        }
        if (q.includes('compraventa')) {
          return blob.includes('compraventa');
        }
        return true;
      });

      if (resultados.length === 0) resultados = store.casos;

      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `He buscado en el archivo de la notaría y encontré ${resultados.length} trámite(s). Haz clic en cualquiera de las tarjetas de abajo para abrir su conversación o ver su Ficha Completa (allí ves si está ABIERTO o CERRADO, su código CHIP y sus documentos escaneados):`,
        hallazgos: resultados.map(
          (r) =>
            `[${r.estado_apertura}] ${r.codigo_tramite} · ${r.tramite_nombre} · Titular: ${r.partes[0]?.nombres_completos} (C.C. ${r.partes[0]?.numero_documento}) · CHIP: ${r.inmueble.chip}`
        ),
        alertas_rojas: [],
        preguntas_pendientes: [],
        tarjetas_tramites: resultados.map(resumirTarjetaCaso),
        acciones_sugeridas: [
          { tipo: 'VER_FICHA_TRAMITE', etiqueta: `Ver Ficha del Trámite Actual (${caso.codigo_tramite})` }
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

    // 3. VINCULACIÓN CON PROYECTO DE CONSTRUCTORA DESDE EL CHAT (Pregunta del Agente: ¿Es de constructora? -> Pide Torre y Apto y actualiza estados)
    if (
      body.vincular_constructora ||
      msgLower.includes('constructora') ||
      msgLower.includes('torre') ||
      (msgLower.includes('si') && msgLower.includes('apto'))
    ) {
      const proy = store.proyectos_constructoras[0];
      const torreElegida = body.torre_bloque || body.torre || 'Torre A';
      const aptoRaw = body.apartamento || '401';
      const aptoNumero = aptoRaw.replace(/^Apartamento\s+/i, '').trim();
      const unidadId = `${torreElegida.replace('Torre ', '').trim()}-${aptoNumero}`;

      caso.pertenece_constructora = true;
      if (!caso.subcategorias_activas.includes('SUB-PROYECTO-CONSTRUCTORA')) {
        caso.subcategorias_activas.push('SUB-PROYECTO-CONSTRUCTORA');
      }
      caso.constructora_info = {
        proyecto_id: body.proyecto_id || proy.proyecto_id,
        nombre_proyecto: proy.nombre_proyecto,
        torre_bloque: torreElegida,
        apartamento: aptoRaw
      };
      caso.constructora_vinculada = {
        es_constructora: true,
        proyecto_id: body.proyecto_id || proy.proyecto_id,
        nombre_proyecto: proy.nombre_proyecto,
        torre: torreElegida,
        torre_bloque: torreElegida,
        apartamento: aptoRaw
      };

      const unidad = proy.unidades.find((u) => u.unidad_id === unidadId) || proy.unidades[3];
      if (unidad) {
        unidad.estado_dinamico = 'En revisión';
        unidad.comprador_nombre = caso.partes[0]?.nombres_completos || 'Mauricio Arturo Téllez Restrepo';
        unidad.comprador_cc = caso.partes[0]?.numero_documento || '79.451.200';
      }

      caso.bitacora.push({
        id: 'ev-const-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: usuarioActivo.nombre,
        etapa: 'Vinculación Constructora',
        detalle: `Trámite vinculado a ${proy.nombre_proyecto} · ${torreElegida} · Apartamento ${aptoNumero}. Documentos matriz heredados.`
      });

      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `He vinculado este trámite (${caso.codigo_tramite}) al proyecto de constructora "${proy.nombre_proyecto}", ${torreElegida}, Apartamento ${aptoNumero}. Heredé automáticamente el Reglamento de P.H. y el Certificado de Mayor Extensión, y actualicé el estado de la unidad ${unidadId} en el tablero de la constructora.`,
        hallazgos: [
          `Proyecto: ${proy.nombre_proyecto} (${proy.constructora})`,
          `Ubicación guardada: ${torreElegida} · Apartamento ${aptoNumero} (Unidad ${unidadId})`,
          `Estado actualizado en Constructora: "En revisión"`
        ],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [
          { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Ficha del Trámite (Con Proyecto y Documentos)' }
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

    // 4. SUBIR CÉDULA FALTANTE O ACTUALIZAR FECHA DE PAZ Y SALVO DESDE EL CHAT
    const hallazgos = [];
    const alertas = [];
    const preguntas = [];

    if (body.subir_cedula_monica || msgLower.includes('mónica') || msgLower.includes('monica') || msgLower.includes('cedula') || msgLower.includes('cédula')) {
      const monica = caso.partes.find((p) => p.numero_documento === '52.110.900');
      if (monica && !monica.cedula_cargada) {
        monica.cedula_cargada = true;
        monica.origen_inferencia = 'Co-propietaria VENDEDORA (50%) en Certificado de Tradición · Cédula 52.110.900 adjuntada en el chat.';
        const docFaltante = caso.documentos.find((d) => d.codigo_tipo === 'CEDULA_VENDEDOR_2_FALTANTE');
        if (docFaltante) {
          docFaltante.codigo_tipo = 'CEDULA_VENDEDOR_2';
          docFaltante.nombre = 'Cédula de Ciudadanía Vendedora 2 · Mónica Patricia Pérez Gómez';
          docFaltante.archivo = 'cedula_monica_perez_52110900.pdf';
          docFaltante.estado = 'PENDIENTE_APROBACION_ABOGADO';
          docFaltante.nivel_alerta = 'WARNING';
          docFaltante.tipo_visor_escaneo = 'CEDULA_COLOMBIA';
          docFaltante.mensaje_alerta = 'Cédula adjuntada desde el chat. Lista para que el Abogado Verificador revise la imagen escaneada y la apruebe.';
          docFaltante.campos_leidos_agente = [
            { clave: 'Número de Cédula', valor: '52.110.900', dudoso: false },
            { clave: 'Apellidos', valor: 'PÉREZ GÓMEZ', dudoso: false },
            { clave: 'Nombres', valor: 'MÓNICA PATRICIA', dudoso: false },
            { clave: 'Fecha y Lugar de Expedición', valor: '04-JUN-1999 · BOGOTÁ D.C.', dudoso: false },
            { clave: 'Rol Asignado por Tradición', valor: 'VENDEDORA (50%)', dudoso: false }
          ];
        }
        hallazgos.push('Cédula de Mónica Patricia Pérez Gómez (C.C. 52.110.900) recibida desde el chat y extraída. Ahora el Abogado Verificador puede ver la imagen escaneada en la Ficha del Trámite y aprobarla.');
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
    if (!caso.pertenece_constructora) {
      preguntas.push('¿Este trámite pertenece a algún proyecto de Constructora? (Si dices Sí, guardo Torre y Apartamento).');
    }

    const estadoBpmn = calcularEstadoBpmn(caso);
    caso.mensajes_chat.push({
      id: 'm-ag-' + Date.now(),
      emisor: 'ASISTENTE',
      autor: 'Asistente Notarial',
      hora: ahoraHora,
      texto: `Mensaje registrado en el expediente ${caso.codigo_tramite} (${caso.estado_apertura}). Aquí tienes el resumen y las acciones directas:`,
      hallazgos: hallazgos.length ? hallazgos : [`Trámite activo: ${caso.codigo_tramite} · ${caso.titulo_tramite}`],
      alertas_rojas: alertas,
      preguntas_pendientes: preguntas,
      tarjetas_tramites: [resumirTarjetaCaso(caso)],
      acciones_sugeridas: [
        { tipo: 'VER_FICHA_TRAMITE', etiqueta: 'Ver Trámite (Ocultar Chat y Ver Documentos Escaneados)' },
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

        // Sincronizar aprobación de la parte (Vendedor/Comprador) asociada a esta cédula
        if (doc.id === 'doc-2' || rawDocId === 'DOC-CED-VEND-1') {
          const p1 = (caso.partes || []).find((p) => p.id === 'p-1' || p.id === 'PARTE-1');
          if (p1) p1.aprobado_verificador = true;
        } else if (doc.id === 'doc-4' || rawDocId === 'DOC-CED-VEND-2') {
          const p2 = (caso.partes || []).find((p) => p.id === 'p-2' || p.id === 'PARTE-2');
          if (p2) p2.aprobado_verificador = true;
        } else if (doc.id === 'doc-3' || rawDocId === 'DOC-CED-COMP-1') {
          const p3 = (caso.partes || []).find((p) => p.id === 'p-3' || p.id === 'PARTE-3');
          if (p3) p3.aprobado_verificador = true;
        }
      }
      caso.bitacora.push({
        id: 'ev-doc-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
        etapa: debeAprobar ? 'Aprobación de Documento' : 'Corrección de Lectura',
        detalle: `${debeAprobar ? 'Aprobó' : 'Corrigió'} los datos extraídos de: ${doc.nombre}.`
      });
    }

    // Si se aprobó el documento de Escritura Anterior, también marcar sus linderos como aprobados
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

  // ENDPOINT: CORREGIR O APROBAR DATOS DE UNA PARTE (Vendedor / Comprador)
  if (req.method === 'POST' && pathname === '/api/parte/aprobar-o-corregir') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    const parte = caso.partes.find((p) => p.id === body.parte_id);
    if (parte) {
      if (body.nombres_completos) parte.nombres_completos = body.nombres_completos;
      if (body.numero_documento) parte.numero_documento = body.numero_documento;
      if (body.estado_civil) parte.estado_civil = body.estado_civil;
      if (body.aprobar) {
        parte.aprobado_verificador = true;
        parte.aprobado_por = usuarioActivo.nombre;
      }
      caso.bitacora.push({
        id: 'ev-parte-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
        etapa: 'Verificación de Otorgante',
        detalle: `Verificó y aprobó datos de ${parte.rol}: ${parte.nombres_completos} (C.C. ${parte.numero_documento}).`
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

    const d1 = caso.discrepancias_linderos[0]?.valor_seleccionado || 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS';
    const d2 = caso.discrepancias_linderos[1]?.valor_seleccionado || 'nueve metros treinta centímetros (9.30 mts)';
    caso.inmueble.linderos_especiales = `APARTAMENTO SEISCIENTOS UNO (601): Tiene su acceso por el hall del sexto piso, consta de sala-comedor, tres alcobas, cocina, zona de ropas y dos baños. Tiene un área privada de ${d1}, coeficiente de copropiedad del 4.18% y se comprende dentro de los siguientes linderos especiales: POR EL NORTE: En línea quebrada de ocho metros cuarenta y cinco centímetros (8.45 mts) con vacío sobre zona común exterior. POR EL SUR: En extensión de seis metros veinte centímetros (6.20 mts) con hall de circulación común y ducto de escaleras. POR EL ORIENTE: En extensión de ${d2} con muro común que lo separa del apartamento seiscientos dos (602). POR EL OCCIDENTE: En extensión de nueve metros treinta centímetros (9.30 mts) con vacío sobre antejardín de la Calle 116. NADIR: Con placa que lo separa del quinto piso. CENIT: Con placa de cubierta del séptimo piso.`;

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
        hallazgos: [`Área privada aprobada: ${d1}`, `Lindero Oriente aprobado: ${d2}`],
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

  if (req.method === 'POST' && pathname === '/api/flujo/avanzar') {
    const body = await parseJsonBody(req);
    const store = loadStore();
    const caso = getCasoActivo(store);
    const usuarioActivo = getUsuarioActivo(store);
    const ahoraHora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    if (body.paso === 'VISTO_BUENO_ABOGADO') {
      caso.aprobaciones.visto_bueno_juridico_abogado = true;
      caso.aprobaciones.abogado_que_aprobo = usuarioActivo.nombre;
      caso.aprobaciones.fecha_aprobacion_abogado = new Date().toLocaleString('es-CO');
      caso.aprobaciones.enviado_a_clientes = true;
      caso.etapa_actual = 'VISTO_BUENO_CLIENTES';
      caso.bitacora.push({
        id: 'ev-vb-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: `${usuarioActivo.nombre} (${usuarioActivo.cargo})`,
        etapa: 'Aprobación Jurídica del Trámite',
        detalle: 'Otorgó visto bueno jurídico al trámite y habilitó revisión de los otorgantes.'
      });
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `Aprobación jurídica del trámite registrada por ${usuarioActivo.nombre}. El borrador queda habilitado para visto bueno del cliente.`,
        hallazgos: [`Aprobado por: ${usuarioActivo.nombre} (${usuarioActivo.cargo})`],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    } else if (body.paso === 'VISTO_BUENO_CLIENTES') {
      caso.aprobaciones.visto_bueno_vendedores = true;
      caso.aprobaciones.visto_bueno_compradores = true;
      caso.partes.forEach((p) => (p.visto_bueno_cliente = true));
      caso.etapa_actual = 'LISTO_IMPRESION';
      caso.bitacora.push({
        id: 'ev-cli-' + Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        actor: 'Clientes Otorgantes',
        etapa: 'Visto Bueno Cliente',
        detalle: 'Vendedores y Comprador aprobaron el texto de la minuta.'
      });
      const estadoBpmn = calcularEstadoBpmn(caso);
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: 'Visto bueno de Vendedores y Comprador registrado. El trámite está listo para impresión en papel de seguridad y cierre.',
        hallazgos: ['Conformidad de clientes completada al 100%.'],
        alertas_rojas: [],
        preguntas_pendientes: [],
        acciones_sugeridas: [estadoBpmn.siguiente_accion]
      });
    } else if (body.paso === 'ENVIAR_A_IMPRESION') {
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
        etapa: 'Impresión y Cierre del Trámite',
        detalle: `Escritura ${caso.aprobaciones.numero_escritura_asignada} impresa en folios ${caso.aprobaciones.hojas_papel_notarial}. Estado del trámite pasa a CERRADO.`
      });
      caso.mensajes_chat.push({
        id: 'm-ag-' + Date.now(),
        emisor: 'ASISTENTE',
        autor: 'Asistente Notarial',
        hora: ahoraHora,
        texto: `Escritura Pública No. ${caso.aprobaciones.numero_escritura_asignada} impresa en folios ${caso.aprobaciones.hojas_papel_notarial}. El trámite ${caso.codigo_tramite} ha pasado a estado CERRADO.`,
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
