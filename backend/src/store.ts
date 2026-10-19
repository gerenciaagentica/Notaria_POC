import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(__dirname, '..', 'database', 'local_store.json');

export interface ReglaDocumentoNoSQL {
  codigo: string;
  nombre: string;
  estilo_estructura: 'FIJO' | 'VARIABLE';
  regla_vencimiento: 'SIN_VENCIMIENTO' | 'MAX_30_DIAS' | 'MAX_90_DIAS' | 'FIN_DE_MES_ACTUAL';
  dias_maximos?: number;
  alerta_dias_antes_fin_mes?: number;
  obligatorio_base: boolean;
  descargable_bot_gubernamental: boolean;
  campos_extraer: string[];
  descripcion_regla: string;
}

export interface CategoriaTramiteNoSQL {
  categoria_id: string;
  nombre: string;
  pregunta_agente: string;
  regla_activacion_automatica: string;
  documentos_adicionales: string[];
  clausulas_afectadas: string[];
  impacto_minuta: string;
}

export interface TramiteCatalogoNoSQL {
  tramite_id: string;
  nombre: string;
  plantilla_base: string;
  descripcion: string;
  categorias: CategoriaTramiteNoSQL[];
  documentos_reglas: ReglaDocumentoNoSQL[];
}

export interface DiscrepanciaLindero {
  id: string;
  campo: string;
  parrafo: string;
  motivo_duda: string;
  lectura_modelo_a: string; // Gemini 3.8 Flash Vision (Sin OCR)
  confianza_a: number;
  argumento_a: string;
  lectura_modelo_b: string; // Gemini 3.1 Pro Vision / Contraste
  confianza_b: number;
  argumento_b: string;
  valor_seleccionado: string;
  estado: 'PENDIENTE_HUMANO' | 'APROBADO_ABOGADO';
  aprobado_por?: string;
  recorte_texto_original: string;
}

export interface ParteCaso {
  id: string;
  rol: 'VENDEDOR' | 'COMPRADOR';
  nombres_completos: string;
  numero_documento: string;
  lugar_expedicion: string;
  estado_civil: string;
  genero: 'M' | 'F';
  porcentaje: number;
  origen_inferencia: string;
  cedula_cargada: boolean;
  visto_bueno_cliente: boolean;
  fecha_visto_bueno?: string;
  es_pep: boolean;
}

export interface DocumentoCaso {
  id: string;
  codigo_tipo: string;
  nombre: string;
  estilo: 'FIJO' | 'VARIABLE';
  archivo: string;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;
  regla_aplicada: string;
  dias_restantes?: number;
  estado: 'VERIFICADO' | 'POR_VENCER_FIN_MES' | 'VENCIDO' | 'FALTA_DOCUMENTO' | 'REVISION_LINDEROS';
  nivel_alerta: 'OK' | 'WARNING' | 'CRITICAL';
  mensaje_alerta: string;
  datos_extraidos: Record<string, any>;
}

export interface CasoNotarial {
  id: string;
  radicado: string;
  tramite_id: string;
  tramite_nombre: string;
  abogado_asignado: string;
  etapa_actual:
    | 'SOLICITADO'
    | 'DOCUMENTOS_INCOMPLETOS'
    | 'EN_VERIFICACION'
    | 'REVISION_LINDEROS'
    | 'MINUTA_GENERADA'
    | 'VISTO_BUENO_CLIENTES'
    | 'EN_IMPRESION'
    | 'FIRMADA_Y_REGISTRADA';
  categorias_activas: string[];
  tiene_administracion: boolean;
  tiene_prenda_hipoteca: boolean;
  inmueble: {
    tipo_inmueble: 'APARTAMENTO' | 'CASA' | 'LOTE';
    direccion: string;
    matricula_inmobiliaria: string;
    cedula_catastral: string;
    chip: string;
    zona_registro: string;
    area_privada: string;
    edificio_conjunto: string;
    escritura_ph_constitucion: string;
    escritura_ph_reforma: string;
    tradicion_antecedente: string;
    linderos_especiales: string;
    linderos_generales: string;
  };
  negocio: {
    valor_venta: number;
    avaluo_catastral: number;
    forma_pago: 'CONTADO' | 'CREDITO_HIPOTECARIO' | 'LEASING_HABITACIONAL';
    entidad_financiera?: string;
    valor_recursos_propios?: number;
    valor_credito?: number;
    afectacion_vivienda_familiar: boolean;
  };
  recibos_fiscales: {
    predial_factura: string;
    predial_referencia: string;
    predial_banco: string;
    predial_fecha: string;
    idu_pin: string;
    idu_consecutivo: string;
    idu_vencimiento: string;
    vur_cadena_seguridad: string;
    vur_fecha_hora: string;
  };
  partes: ParteCaso[];
  documentos: DocumentoCaso[];
  discrepancias_linderos: DiscrepanciaLindero[];
  aprobaciones: {
    linderos_aprobados_abogado: boolean;
    visto_bueno_juridico_abogado: boolean;
    visto_bueno_jefe: boolean;
    enviado_a_clientes: boolean;
    visto_bueno_vendedores: boolean;
    visto_bueno_compradores: boolean;
    en_impresion: boolean;
    hojas_papel_notarial: string;
    numero_escritura_asignada: string;
    firma_completada: boolean;
  };
  mensajes_chat: Array<{
    id: string;
    emisor: 'ABOGADO' | 'AGENTE_GEMINI_3_8' | 'SISTEMA';
    autor: string;
    hora: string;
    texto: string;
    hallazgos?: string[];
    alertas_rojas?: string[];
    preguntas_pendientes?: string[];
  }>;
  bitacora: Array<{
    id: string;
    fecha: string;
    actor: string;
    etapa: string;
    detalle: string;
  }>;
}

export interface UnidadConstructora {
  unidad_id: string;
  bloque: string;
  apartamento: string;
  tipo_apto: string;
  area_m2: number;
  valor_venta: number;
  comprador_nombre?: string;
  comprador_cc?: string;
  forma_pago?: string;
  estado_dinamico: string;
  tiene_alerta_vencimiento: boolean;
  alerta_detalle?: string;
  documentos_recibidos: number;
  documentos_totales: number;
  minuta_firmada: boolean;
  caso_radicado?: string;
}

export interface ProyectoConstructoraNoSQL {
  proyecto_id: string;
  nombre_proyecto: string;
  constructora: string;
  nit: string;
  direccion: string;
  tiene_administracion_ph: boolean;
  bloques_configurados: string[];
  apartamentos_por_bloque: number;
  tipos_apartamento: Array<{ codigo: string; nombre: string; area_m2: number; precio_base: number }>;
  estados_personalizados: string[];
  documentos_matriz_heredables: Array<{ nombre: string; estado: 'VERIFICADO' | 'PENDIENTE'; vigencia: string }>;
  unidades: UnidadConstructora[];
}

export interface StoreStructure {
  catalogo_tramites: TramiteCatalogoNoSQL[];
  casos: CasoNotarial[];
  proyectos_constructoras: ProyectoConstructoraNoSQL[];
}

const initialStore: StoreStructure = {
  catalogo_tramites: [
    {
      tramite_id: 'COMPRAVENTA_INMUEBLE',
      nombre: 'Escritura Pública de Compraventa de Inmueble',
      plantilla_base: 'VENTA PH.docx (Notaría 33 de Bogotá)',
      descripcion: 'Trámite de transferencia de dominio con detección dinámica de categorías, cruce automático Vendedor/Comprador y verificación de linderos con Doble IA (Gemini 3.8 Flash Vision).',
      categorias: [
        {
          categoria_id: 'PROPIEDAD_HORIZONTAL_ADMIN',
          nombre: 'Inmueble en Propiedad Horizontal (Con Administración)',
          pregunta_agente: '¿El apartamento/casa está sometido a Propiedad Horizontal y cuenta con administración?',
          regla_activacion_automatica: 'Se activa automáticamente si el Certificado de Tradición menciona Reglamento de Propiedad Horizontal (Ley 675/2001).',
          documentos_adicionales: ['PAZ_Y_SALVO_ADMIN'],
          clausulas_afectadas: ['CLÁUSULA TERCERA (Régimen PH)', 'CLÁUSULA DÉCIMA SEGUNDA (Paz y Salvo Administración Art. 29 Ley 675/01)'],
          impacto_minuta: 'Inserta obligatoriamente el Paz y Salvo de Administración vigente al mes de la firma e inyecta la historia de escrituras del Reglamento de PH.'
        },
        {
          categoria_id: 'CON_PRENDA_HIPOTECA_LEASING',
          nombre: 'Venta con Prenda / Hipoteca Abierta o Crédito / Leasing',
          pregunta_agente: '¿El inmueble viene con prenda/hipoteca o el comprador financia con crédito hipotecario?',
          regla_activacion_automatica: 'Se activa si en Tradición hay Hipoteca vigente o si se aporta Carta de Aprobación de Crédito Hipotecario.',
          documentos_adicionales: ['CARTA_CREDITO_O_PRENDA'],
          clausulas_afectadas: ['CLÁUSULA QUINTA (Precio desglosado en recursos propios + crédito hipotecario)', 'CLÁUSULA CONSTITUCIÓN HIPOTECA PRIMER GRADO'],
          impacto_minuta: 'Genera minuta específica con prenda/hipoteca, desglosando pago con recursos propios y desembolso bancario.'
        },
        {
          categoria_id: 'VENTA_VARIAS_PERSONAS',
          nombre: 'Pluralidad de Vendedores o Compradores (Varios otorgantes)',
          pregunta_agente: '¿En qué porcentaje de copropiedad adquieren o venden las varias personas?',
          regla_activacion_automatica: 'Se activa cuando en la última anotación del Certificado de Tradición hay >1 propietario o se suben >1 cédulas de compradores.',
          documentos_adicionales: ['CEDULAS_COPROPIETARIOS_ADICIONALES'],
          clausulas_afectadas: ['COMPARECENCIA PLURAL', 'ACEPTACIÓN Y CUOTAS PROINDIVISO'],
          impacto_minuta: 'Pluraliza toda la redacción de la minuta y exige el 100% de las cédulas de todos los titulares inscritos.'
        },
        {
          categoria_id: 'LOTE_O_CASA_SIN_ADMIN',
          nombre: 'Casa o Lote Independiente (Sin Administración)',
          pregunta_agente: '¿Confirmas que el predio no paga administración ni pertenece a copropiedad?',
          regla_activacion_automatica: 'Se activa cuando el predio es lote o casa fuera de PH.',
          documentos_adicionales: [],
          clausulas_afectadas: ['OMITE CLÁUSULA TERCERA PH', 'OMITE CLÁUSULA DÉCIMA SEGUNDA ADMIN'],
          impacto_minuta: 'Suprime exigencia de Paz y Salvo de Administración.'
        }
      ],
      documentos_reglas: [
        {
          codigo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (SNR)',
          estilo_estructura: 'FIJO',
          regla_vencimiento: 'MAX_90_DIAS',
          dias_maximos: 30,
          obligatorio_base: true,
          descargable_bot_gubernamental: true,
          campos_extraer: ['matricula_inmobiliaria', 'zona_registro', 'direccion_predio', 'propietarios_ultima_anotacion', 'gravamenes_hipotecas_vigentes', 'reglamento_ph', 'fecha_expedicion'],
          descripcion_regla: 'Documento FIJO. Debe ser menor a 30/90 días según parámetro. Las últimas personas con dominio inscrito se infieren automáticamente como LA PARTE VENDEDORA.'
        },
        {
          codigo: 'CEDULA_CIUDADANIA',
          nombre: 'Cédulas de Ciudadanía (Vendedores y Compradores)',
          estilo_estructura: 'FIJO',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          obligatorio_base: true,
          descargable_bot_gubernamental: false,
          campos_extraer: ['numero_documento', 'nombres_completos', 'apellidos_completos', 'fecha_expedicion', 'lugar_expedicion', 'sexo'],
          descripcion_regla: 'Documento FIJO sin vencimiento. Quienes coinciden con el Certificado de Tradición son Vendedores; las demás cédulas son Compradores.'
        },
        {
          codigo: 'PAZ_Y_SALVO_ADMIN',
          nombre: 'Paz y Salvo de Administración (Propiedad Horizontal)',
          estilo_estructura: 'VARIABLE',
          regla_vencimiento: 'FIN_DE_MES_ACTUAL',
          alerta_dias_antes_fin_mes: 5,
          obligatorio_base: false,
          descargable_bot_gubernamental: false,
          campos_extraer: ['conjunto_edificio', 'unidad_apartamento', 'administrador_firmante', 'fecha_expedicion', 'mes_vigencia'],
          descripcion_regla: 'Documento VARIABLE (cambia en cada edificio). Vence estrictamente el último día del mes en curso. Si faltan <= 5 días para acabarse el mes, dispara ALERTA ROJA porque no se podrá firmar la minuta al cambiar de mes.'
        },
        {
          codigo: 'ESCRITURA_ANTERIOR',
          nombre: 'Escritura Pública de Adquisición Anterior (Título Antecedente)',
          estilo_estructura: 'VARIABLE',
          regla_vencimiento: 'SIN_VENCIMIENTO',
          obligatorio_base: true,
          descargable_bot_gubernamental: false,
          campos_extraer: ['numero_escritura_anterior', 'fecha_escritura_anterior', 'notaria_origen', 'linderos_especiales_literales', 'linderos_generales_literales', 'area_privada', 'coeficiente_ph', 'escrituras_reglamento_ph'],
          descripcion_regla: 'Documento VARIABLE escaneado en condiciones difíciles/con sellos. Se procesa con DOBLE MODELO MULTIMODAL SIN OCR (Gemini 3.8 Flash Vision + Modelo de Contraste) para auditar cada lindero.'
        },
        {
          codigo: 'IMPUESTO_PREDIAL',
          nombre: 'Certificación Pago Impuesto Predial Unificado (Vigencia 2026)',
          estilo_estructura: 'FIJO',
          regla_vencimiento: 'FIN_DE_MES_ACTUAL',
          obligatorio_base: true,
          descargable_bot_gubernamental: true,
          campos_extraer: ['numero_factura', 'numero_referencia', 'entidad_recaudadora', 'fecha_presentacion', 'avaluo_catastral', 'chip', 'cedula_catastral'],
          descripcion_regla: 'Documento FIJO vigencia año gravable actual.'
        },
        {
          codigo: 'IDU_Y_VUR_HACIENDA',
          nombre: 'Certificado IDU Valorización + Reporte VUR Secretaría de Hacienda',
          estilo_estructura: 'FIJO',
          regla_vencimiento: 'MAX_30_DIAS',
          dias_maximos: 30,
          obligatorio_base: true,
          descargable_bot_gubernamental: true,
          campos_extraer: ['idu_pin_seguridad', 'idu_consecutivo', 'idu_fecha_vencimiento', 'vur_cadena_seguridad', 'vur_fecha_hora'],
          descripcion_regla: 'Descargado automáticamente por el Worker de la Notaría usando el CHIP y la Matrícula.'
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
          'LOTE DE TERRENO ubicado en la Calle 116 No. 15-42 de la nomenclatura urbana de Bogotá D.C., con extensión superficiaria de 1.240.00 M2, comprendido entre los siguientes linderos generales: NORTE: En 31.00 mts con la Calle 116; SUR: En 31.00 mts con predio de matrícula 50C-991022; ORIENTE: En 40.00 mts con predio No. 15-28; OCCIDENTE: En 40.00 mts con predio No. 15-56.'
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
        vur_fecha_hora: '18/10/2026 09:42:11'
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
          visto_bueno_cliente: false,
          es_pep: false
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
          visto_bueno_cliente: false,
          es_pep: false
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
          origen_inferencia: 'Inferido como COMPRADOR porque su cédula fue aportada al expediente y no figura como titular anterior en el Certificado de Tradición.',
          cedula_cargada: true,
          visto_bueno_cliente: false,
          es_pep: false
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
          regla_aplicada: 'Vence el último día del mes en curso (Firma obligatoria en el mismo mes)',
          dias_restantes: 5,
          estado: 'POR_VENCER_FIN_MES',
          nivel_alerta: 'CRITICAL',
          mensaje_alerta: '🚨 ALERTA FIN DE MES: Faltan solo 5 días para acabarse el mes (30 de noviembre). Si la minuta no se firma antes del fin de mes, este Paz y Salvo vence automáticamente.',
          datos_extraidos: {
            edificio: 'Edificio Mirador del Parque P.H.',
            unidad: 'Apartamento 601 y Garaje 14',
            administrador: 'Administraciones Integrales S.A.S.',
            mes_cubierto: 'Noviembre 2026'
          }
        },
        {
          id: 'doc-2',
          codigo_tipo: 'CERTIFICADO_TRADICION',
          nombre: 'Certificado de Tradición y Libertad (50C-1849201)',
          estilo: 'FIJO',
          archivo: 'certificado_tradicion_50C1849201.pdf',
          fecha_expedicion: '2026-11-18',
          fecha_vencimiento: '2026-12-18',
          regla_aplicada: 'Vigencia menor a 30 / 90 días',
          dias_restantes: 23,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          mensaje_alerta: 'Vigente (Expedido hace 7 días). Últimos dueños detectados: Carlos Mejía y Mónica Pérez.',
          datos_extraidos: {
            matricula: '50C-1849201',
            propietarios_actuales: ['CARLOS ARTURO MEJÍA RESTREPO (CC 79.451.200)', 'MÓNICA PATRICIA PÉREZ GÓMEZ (CC 52.110.900)'],
            reglamento_ph: 'SI (Anotación 02 y Reforma Anotación 07)'
          }
        },
        {
          id: 'doc-3',
          codigo_tipo: 'CEDULA_CIUDADANIA',
          nombre: 'Cédulas de Ciudadanía de las Partes (2 de 3 cargadas)',
          estilo: 'FIJO',
          archivo: 'cedulas_carlos_y_jorge.pdf',
          regla_aplicada: 'Documento fijo sin vencimiento',
          estado: 'FALTA_DOCUMENTO',
          nivel_alerta: 'CRITICAL',
          mensaje_alerta: '❌ PENDIENTE: Falta la Cédula de Ciudadanía de la co-propietaria vendedora MÓNICA PATRICIA PÉREZ GÓMEZ (C.C. 52.110.900).',
          datos_extraidos: {
            cedulas_leidas: ['79.451.200 (Carlos Mejía - Vendedor)', '80.123.456 (Jorge Mosquera - Comprador)'],
            cedula_faltante: '52.110.900 (Mónica Pérez - Vendedora en Tradición)'
          }
        },
        {
          id: 'doc-4',
          codigo_tipo: 'ESCRITURA_ANTERIOR',
          nombre: 'Escritura Pública Anterior No. 1.420 de 2014 Notaría 19 (Con sellos)',
          estilo: 'VARIABLE',
          archivo: 'escritura_1420_2014_escaneo_sellos.pdf',
          regla_aplicada: 'Consenso Multimodal Sin OCR (Gemini 3.8 Flash Vision + Gemini 3.1 Pro)',
          estado: 'REVISION_LINDEROS',
          nivel_alerta: 'WARNING',
          mensaje_alerta: '⚠️ 2 fragmentos en los Linderos Especiales presentan sello superpuesto / mancha y requieren confirmación del abogado.',
          datos_extraidos: {
            consenso_porcentaje: '96.8%',
            dudas_detectadas: 2
          }
        },
        {
          id: 'doc-5',
          codigo_tipo: 'IDU_Y_VUR_HACIENDA',
          nombre: 'Paz y Salvo IDU + Reporte VUR Hacienda + Predial 2026',
          estilo: 'FIJO',
          archivo: 'combo_fiscales_AAA0142BCDE.pdf',
          fecha_expedicion: '2026-11-20',
          fecha_vencimiento: '2026-12-20',
          regla_aplicada: 'Descarga automatizada por plataforma (CHIP AAA0142BCDE)',
          dias_restantes: 25,
          estado: 'VERIFICADO',
          nivel_alerta: 'OK',
          mensaje_alerta: 'Predio al día en Impuesto Predial 2026, Valorización IDU y Obligaciones VUR Secretaría de Hacienda.',
          datos_extraidos: {
            chip: 'AAA0142BCDE',
            idu_pin: 'IDU-2026-99481023',
            vur_cadena: 'SHD-VUR-2026-8841209-OK'
          }
        }
      ],
      discrepancias_linderos: [
        {
          id: 'lind-1',
          campo: 'Área Privada del Apartamento 601 (Cláusula Primera)',
          parrafo: 'APARTAMENTO SEISCIENTOS UNO (601): ... Tiene un área privada de OCHENTA Y OCHO PUNTO CINCUENTA Y [88.53 / 88.58] METROS CUADRADOS...',
          motivo_duda: 'Sello húmedo azul de la Notaría 19 cae exactamente sobre el segundo decimal de la cifra en números (88.5_).',
          lectura_modelo_a: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          confianza_a: 98.4,
          argumento_a: 'Gemini 3.8 Flash Vision (Sin OCR): Al separar el canal azul del sello y cruzar con el texto en letras ("CINCUENTA Y TRES") y con el Certificado Catastral, el valor exacto es 88.53 m².',
          lectura_modelo_b: 'OCHENTA Y OCHO PUNTO CINCUENTA Y OCHO (88.58) METROS CUADRADOS',
          confianza_b: 61.0,
          argumento_b: 'Modelo B (Contraste): El bucle del sello azul sobre el número "3" aparenta visualmente un "8" a simple vista.',
          valor_seleccionado: 'OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.53) METROS CUADRADOS',
          estado: 'PENDIENTE_HUMANO',
          recorte_texto_original: '...área privada de OCHENTA Y OCHO PUNTO CINCUENTA Y TRES (88.5[SELLO NOTARÍA 19]) METROS CUADRADOS, coeficiente de copropiedad del 4.18%...'
        },
        {
          id: 'lind-2',
          campo: 'Lindero Especial ORIENTE (Cláusula Primera)',
          parrafo: 'POR EL ORIENTE: En extensión de NUEVE METROS [TREINTA / OCHENTA] CENTÍMETROS (9.30 / 9.80 mts) con muro común que lo separa del apartamento 602.',
          motivo_duda: 'Fotocopia antigua con desgaste de tóner en la palabra TREINTA y en el dígito (9._0 mts).',
          lectura_modelo_a: 'nueve metros treinta centímetros (9.30 mts)',
          confianza_a: 97.1,
          argumento_a: 'Gemini 3.8 Flash Vision: Por morfología de caracteres ("TRE-INTA" tiene 7 letras, no 7 de "OCHENTA") y por simetría geométrica con el Lindero OCCIDENTE opuesto (que mide exactamente 9.30 mts), la medida correcta es 9.30 mts.',
          lectura_modelo_b: 'nueve metros ochenta centímetros (9.80 mts)',
          confianza_b: 54.5,
          argumento_b: 'Modelo B (Contraste): Mancha vertical sobre el número 3 genera ambigüedad óptica entre 9.30 y 9.80.',
          valor_seleccionado: 'nueve metros treinta centímetros (9.30 mts)',
          estado: 'PENDIENTE_HUMANO',
          recorte_texto_original: '...POR EL ORIENTE: En extensión de nueve metros tr[mancha]inta centímetros (9.30 mts) con muro común que lo separa del apartamento seiscientos dos (602)...'
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
          texto: 'Hola, va a ser una minuta de compraventa de un apartamento con crédito hipotecario. Te adjunto el Certificado de Tradición, la escritura anterior escaneada, dos cédulas y el paz y salvo de administración que llegó hoy.'
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
            'Descargué automáticamente por plataforma el IDU Valorización (PIN IDU-2026-99481023) y el reporte VUR Hacienda (SHD-VUR-2026-8841209-OK).'
          ],
          alertas_rojas: [
            '🚨 ALERTA FIN DE MES (Paz y Salvo Administración): El Paz y Salvo del Edificio Mirador P.H. fue expedido para noviembre y faltan SOLO 5 DÍAS para que se acabe el mes (30 de noviembre). ¡Debemos firmar antes del día 30 o el documento vencerá!',
            '❌ FALTA DOCUMENTO OBLIGATORIO: Solo subiste la cédula de Carlos Arturo Mejía. Hace falta la cédula de la co-propietaria vendedora MÓNICA PATRICIA PÉREZ GÓMEZ (C.C. 52.110.900).',
            '⚠️ REVISIÓN DE LINDEROS (2 Dudas por Sello): La escritura anterior (Esc. 1420 de 2014) tiene un sello notarial azul sobre el área privada (88.53 vs 88.58 m²) y desgaste en el lindero Oriente (9.30 vs 9.80 mts). Por favor revísalos en la pestaña "Linderos Side-by-Side".'
          ],
          preguntas_pendientes: [
            '¿El comprador Jorge Eliécer Mosquera afecta el apartamento a Vivienda Familiar (Ley 258/96)?',
            '¿Solicito por WhatsApp/enlace la cédula faltante de Mónica Pérez?'
          ]
        }
      ],
      bitacora: [
        {
          id: 'ev-1',
          fecha: '18/10/2026 09:40:12',
          actor: 'Abogado · Andrés Villamizar',
          etapa: 'SOLICITADO',
          detalle: 'Apertura del trámite por Chat Agéntico con carga de paquete documental.'
        },
        {
          id: 'ev-2',
          fecha: '18/10/2026 09:40:28',
          actor: 'Gemini 3.8 Flash Vision',
          etapa: 'EN_VERIFICACION',
          detalle: 'Inferencia automática completada: Vendedores deducidos desde Certificado de Tradición (Carlos Mejía y Mónica Pérez) y Comprador por descarte de cédula (Jorge Mosquera).'
        },
        {
          id: 'ev-3',
          fecha: '18/10/2026 09:40:45',
          actor: 'Motor Determinístico Vigencias',
          etapa: 'EN_VERIFICACION',
          detalle: 'Alerta Crítica disparada: Paz y Salvo de Administración a 5 días del cierre de mes.'
        },
        {
          id: 'ev-4',
          fecha: '18/10/2026 09:41:02',
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
      tiene_administracion_ph: true,
      bloques_configurados: ['Torre A', 'Torre B', 'Torre C'],
      apartamentos_por_bloque: 8,
      tipos_apartamento: [
        { codigo: 'TIPO_A', nombre: 'Apto Tipo A (3 Alcobas + Estudio)', area_m2: 82, precio_base: 432000000 },
        { codigo: 'TIPO_B', nombre: 'Apto Tipo B (2 Alcobas)', area_m2: 74, precio_base: 385000000 },
        { codigo: 'TIPO_C', nombre: 'Apartaestudio Ejecutivo', area_m2: 62, precio_base: 318000000 }
      ],
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
        { nombre: 'Certificado de Tradición Lote Matriz (50N-2099182)', estado: 'VERIFICADO', vigencia: 'Vigente (24 días restantes)' },
        { nombre: 'Escritura Pública Constitución Reglamento P.H. No. 0890 de 2026', estado: 'VERIFICADO', vigencia: 'Permanente (Linderos Generales verificados con Doble IA)' },
        { nombre: 'Cámara de Comercio y RUT Constructora Altos del Peñón S.A.', estado: 'VERIFICADO', vigencia: 'Vigente (21 días restantes)' },
        { nombre: 'Paz y Salvo Predial e IDU Mayor Extensión 2026', estado: 'VERIFICADO', vigencia: 'Vigente 2026' }
      ],
      unidades: [
        { unidad_id: 'A-101', bloque: 'Torre A', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Camilo Andrés Zuluaga', comprador_cc: '79.881.201', forma_pago: 'Contado', estado_dinamico: 'Registrada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true, caso_radicado: 'NOT-2026-000112' },
        { unidad_id: 'A-201', bloque: 'Torre A', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Diana Carolina Rueda', comprador_cc: '52.990.112', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true, caso_radicado: 'NOT-2026-000115' },
        { unidad_id: 'A-301', bloque: 'Torre A', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Héctor Iván Quiñones', comprador_cc: '80.441.900', forma_pago: 'Crédito Davivienda', estado_dinamico: 'En impresión', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000121' },
        { unidad_id: 'A-401', bloque: 'Torre A', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Sandra Milena Ocampo', comprador_cc: '53.112.890', forma_pago: 'Leasing Bancolombia', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: true, alerta_detalle: 'Paz y Salvo Admin vence en 5 días (Fin de mes)', documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000124' },
        { unidad_id: 'A-501', bloque: 'Torre A', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Yenny Paola Beltrán', comprador_cc: '53.440.317', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000130' },
        { unidad_id: 'A-601', bloque: 'Torre A', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Ricardo Alfonso Neira', comprador_cc: '79.310.445', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000139' },
        { unidad_id: 'A-701', bloque: 'Torre A', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Paola Andrea Cifuentes Rojas', comprador_cc: '53.889.560', forma_pago: 'Leasing Habitacional Scotiabank Colpatria', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Falta Carta de Aprobación de Leasing + Paz y Salvo vence a fin de mes', documentos_recibidos: 2, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000142' },
        { unidad_id: 'A-801', bloque: 'Torre A', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-101', bloque: 'Torre B', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Luis Fernando Gómez', comprador_cc: '19.440.112', forma_pago: 'Contado', estado_dinamico: 'Registrada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true, caso_radicado: 'NOT-2026-000114' },
        { unidad_id: 'B-201', bloque: 'Torre B', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'María Fernanda Castro', comprador_cc: '52.811.300', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true, caso_radicado: 'NOT-2026-000119' },
        { unidad_id: 'B-301', bloque: 'Torre B', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Juan Sebastián Mora', comprador_cc: '1.020.774.120', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: true, alerta_detalle: 'Certificado Tradición tiene 28 días (Próximo a vencer)', documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000145' },
        { unidad_id: 'B-401', bloque: 'Torre B', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Natalia Valderrama', comprador_cc: '1.015.412.900', forma_pago: 'Leasing Habitacional', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000148' },
        { unidad_id: 'B-501', bloque: 'Torre B', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Andrés Felipe Pardo', comprador_cc: '80.912.331', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Falta Cédula de Co-compradora', documentos_recibidos: 4, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000150' },
        { unidad_id: 'B-601', bloque: 'Torre B', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-701', bloque: 'Torre B', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'B-801', bloque: 'Torre B', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-101', bloque: 'Torre C', apartamento: '101', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Gloria Inés Tamayo', comprador_cc: '41.772.109', forma_pago: 'Contado', estado_dinamico: 'Firmada', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: true, caso_radicado: 'NOT-2026-000120' },
        { unidad_id: 'C-201', bloque: 'Torre C', apartamento: '201', tipo_apto: 'TIPO_C', area_m2: 62, valor_venta: 318000000, comprador_nombre: 'Óscar Mauricio León', comprador_cc: '79.654.321', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000131' },
        { unidad_id: 'C-301', bloque: 'Torre C', apartamento: '301', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Claudia Patricia Soler', comprador_cc: '52.334.890', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Minuta lista / Visto bueno', tiene_alerta_vencimiento: false, documentos_recibidos: 7, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000134' },
        { unidad_id: 'C-401', bloque: 'Torre C', apartamento: '401', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Germán Darío Vargas', comprador_cc: '79.110.882', forma_pago: 'Contado', estado_dinamico: 'En verificación IA', tiene_alerta_vencimiento: false, documentos_recibidos: 6, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000141' },
        { unidad_id: 'C-501', bloque: 'Torre C', apartamento: '501', tipo_apto: 'TIPO_B', area_m2: 74, valor_venta: 385000000, comprador_nombre: 'Laura Daniela Ríos', comprador_cc: '1.032.490.112', forma_pago: 'Leasing Habitacional', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: true, alerta_detalle: 'Paz y Salvo Admin a 5 días de fin de mes', documentos_recibidos: 3, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000152' },
        { unidad_id: 'C-601', bloque: 'Torre C', apartamento: '601', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, comprador_nombre: 'Mario Alberto Yepes', comprador_cc: '16.889.001', forma_pago: 'Crédito Hipotecario', estado_dinamico: 'Documentos pendientes', tiene_alerta_vencimiento: false, documentos_recibidos: 2, documentos_totales: 7, minuta_firmada: false, caso_radicado: 'NOT-2026-000155' },
        { unidad_id: 'C-701', bloque: 'Torre C', apartamento: '701', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false },
        { unidad_id: 'C-801', bloque: 'Torre C', apartamento: '801', tipo_apto: 'TIPO_A', area_m2: 82, valor_venta: 432000000, estado_dinamico: 'Sin comprador', tiene_alerta_vencimiento: false, documentos_recibidos: 0, documentos_totales: 7, minuta_firmada: false }
      ]
    }
  ]
};

export function loadStore(): StoreStructure {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialStore, null, 2), 'utf-8');
      return initialStore;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as StoreStructure;
  } catch (err) {
    console.error('Error cargando local_store.json, usando store inicial:', err);
    return initialStore;
  }
}

export function saveStore(store: StoreStructure): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando local_store.json:', err);
  }
}
