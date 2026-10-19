import { CasoNotarial } from './store';

function numeroALetrasMillones(valor: number): string {
  const millones = Math.floor(valor / 1000000);
  const resto = Math.floor((valor % 1000000) / 1000);
  if (resto > 0) {
    return `${millones} MILLONES ${resto} MIL PESOS MONEDA LEGAL COLOMBIANA`;
  }
  return `${millones} MILLONES DE PESOS MONEDA LEGAL COLOMBIANA`;
}

export function calcularLiquidacionNotarial(valorVenta: number, avaluoCatastral: number) {
  const base = Math.max(Number(valorVenta || 0), Number(avaluoCatastral || 0));
  const derechosNotariales = Math.round(base * 0.0027);
  const iva = Math.round(derechosNotariales * 0.19);
  const superintendencia = 15600;
  const cuentaEspecial = 15600;
  const retencionFuente = Math.round(base * 0.01);
  const boletaRentas = Math.round(base * 0.01);
  const derechosRegistro = Math.round(base * 0.005);

  const totalNotaria = derechosNotariales + iva + superintendencia + cuentaEspecial + retencionFuente;
  const totalVendedor = Math.round((derechosNotariales + iva + superintendencia + cuentaEspecial) / 2) + retencionFuente;
  const totalComprador = Math.round((derechosNotariales + iva + superintendencia + cuentaEspecial) / 2) + boletaRentas + derechosRegistro;

  return {
    base_liquidacion: base,
    derechos_notariales: derechosNotariales,
    iva_notarial: iva,
    superintendencia,
    cuenta_especial: cuentaEspecial,
    retencion_fuente_vendedor: retencionFuente,
    boleta_rentas_externo: boletaRentas,
    derechos_registro_externo: derechosRegistro,
    total_notaria: totalNotaria,
    total_vendedor: totalVendedor,
    total_comprador: totalComprador,
    gran_total: totalVendedor + totalComprador
  };
}

export function evaluarVigenciaDocumento(
  regla: 'SIN_VENCIMIENTO' | 'MAX_30_DIAS' | 'MAX_90_DIAS' | 'FIN_DE_MES_ACTUAL',
  fechaExpedicionStr: string,
  fechaActualReferenciaStr?: string
) {
  if (regla === 'SIN_VENCIMIENTO') {
    return {
      estado: 'VERIFICADO' as const,
      nivel_alerta: 'OK' as const,
      dias_restantes: 9999,
      fecha_vencimiento: 'PERMANENTE',
      mensaje_alerta: 'Documento fijo sin vencimiento. Siempre conserva el mismo formato.'
    };
  }

  const fechaExp = new Date(fechaExpedicionStr + 'T12:00:00');
  const hoy = fechaActualReferenciaStr ? new Date(fechaActualReferenciaStr + 'T12:00:00') : new Date();

  if (regla === 'FIN_DE_MES_ACTUAL') {
    const ultimoDiaMes = new Date(fechaExp.getFullYear(), fechaExp.getMonth() + 1, 0, 12, 0, 0);
    const diffMs = ultimoDiaMes.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const fechaVencStr = ultimoDiaMes.toISOString().split('T')[0];

    if (hoy.getMonth() !== fechaExp.getMonth() || hoy.getFullYear() !== fechaExp.getFullYear() || diasRestantes < 0) {
      return {
        estado: 'VENCIDO' as const,
        nivel_alerta: 'CRITICAL' as const,
        dias_restantes: diasRestantes,
        fecha_vencimiento: fechaVencStr,
        mensaje_alerta: `⛔ BLOQUEO DE FIRMA: El Paz y Salvo corresponde a un mes vencido (${fechaVencStr}). Para firmar la minuta debe aportarse el Paz y Salvo del mes actual.`
      };
    }

    if (diasRestantes <= 5) {
      return {
        estado: 'POR_VENCER_FIN_MES' as const,
        nivel_alerta: 'CRITICAL' as const,
        dias_restantes: diasRestantes,
        fecha_vencimiento: fechaVencStr,
        mensaje_alerta: `🚨 ALERTA CRÍTICA DE FIN DE MES: Quedan solo ${diasRestantes} días para acabarse el mes (${fechaVencStr}). Si no se firma antes del fin de mes, el Paz y Salvo perderá validez.`
      };
    }

    return {
      estado: 'VERIFICADO' as const,
      nivel_alerta: 'OK' as const,
      dias_restantes: diasRestantes,
      fecha_vencimiento: fechaVencStr,
      mensaje_alerta: `Vigente durante el mes actual (Vence el ${fechaVencStr}, quedan ${diasRestantes} días).`
    };
  }

  const maxDias = regla === 'MAX_30_DIAS' ? 30 : 90;
  const fechaVenc = new Date(fechaExp.getTime() + maxDias * 24 * 60 * 60 * 1000);
  const diasRestantes = Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  const fechaVencStr = fechaVenc.toISOString().split('T')[0];

  if (diasRestantes < 0) {
    return {
      estado: 'VENCIDO' as const,
      nivel_alerta: 'CRITICAL' as const,
      dias_restantes: diasRestantes,
      fecha_vencimiento: fechaVencStr,
      mensaje_alerta: `⛔ CERTIFICADO VENCIDO: Superó el límite de ${maxDias} días (venció el ${fechaVencStr}).`
    };
  }

  if (diasRestantes <= 5) {
    return {
      estado: 'POR_VENCER_FIN_MES' as const,
      nivel_alerta: 'WARNING' as const,
      dias_restantes: diasRestantes,
      fecha_vencimiento: fechaVencStr,
      mensaje_alerta: `⚠️ Próximo a vencer: Quedan ${diasRestantes} días de vigencia.`
    };
  }

  return {
    estado: 'VERIFICADO' as const,
    nivel_alerta: 'OK' as const,
    dias_restantes: diasRestantes,
    fecha_vencimiento: fechaVencStr,
    mensaje_alerta: `Vigente (${diasRestantes} días restantes sobre regla de ${maxDias} días).`
  };
}

export function generarTextoMinutaNotaria33(caso: CasoNotarial): string {
  const vendedores = caso.partes.filter((p) => p.rol === 'VENDEDOR');
  const compradores = caso.partes.filter((p) => p.rol === 'COMPRADOR');
  const liq = calcularLiquidacionNotarial(caso.negocio.valor_venta, caso.negocio.avaluo_catastral);

  const resumenVendedores = vendedores
    .map((v) => `${v.nombres_completos} ---------------- C.C. ${v.numero_documento}`)
    .join('\n');
  const resumenCompradores = compradores
    .map((c) => `${c.nombres_completos} ---------------- C.C. ${c.numero_documento}`)
    .join('\n');

  const comparecenciaVendedores = vendedores
    .map(
      (v) =>
        `${v.nombres_completos}, mayor de edad, ${v.genero === 'F' ? 'vecina' : 'vecino'} y residente en esta ciudad de Bogotá D.C., de nacionalidad colombiana, ${v.genero === 'F' ? 'identificada' : 'identificado'} con la cédula de ciudadanía número ${v.numero_documento} expedida en ${v.lugar_expedicion}, de estado civil ${v.estado_civil}, obrando en su propio nombre (${v.porcentaje}%)`
    )
    .join('; y ');

  const comparecenciaCompradores = compradores
    .map(
      (c) =>
        `${c.nombres_completos}, mayor de edad, ${c.genero === 'F' ? 'vecina' : 'vecino'} y residente en esta ciudad de Bogotá D.C., de nacionalidad colombiana, ${c.genero === 'F' ? 'identificada' : 'identificado'} con la cédula de ciudadanía número ${c.numero_documento} expedida en ${c.lugar_expedicion}, de estado civil ${c.estado_civil}, obrando en este acto en su propio nombre (${c.porcentaje}%)`
    )
    .join('; y ');

  const clausulaTerceraPH = caso.tiene_administracion
    ? `-----------------------------------------------------------------------------------------
TERCERA. - RÉGIMEN DE PROPIEDAD HORIZONTAL: ${caso.inmueble.edificio_conjunto} fue sometido al régimen de propiedad horizontal, en los términos de la ${caso.inmueble.escritura_ph_constitucion}, reformado en los términos de la ${caso.inmueble.escritura_ph_reforma}, debidamente registradas en la Oficina de Instrumentos Públicos correspondiente.`
    : `-----------------------------------------------------------------------------------------
TERCERA. - PREDIO NO SOMETIDO A PROPIEDAD HORIZONTAL: El inmueble objeto del presente contrato corresponde a un predio independiente no sometido al régimen de la Ley 675 de 2001.`;

  const clausulaQuintaPrecio = caso.tiene_prenda_hipoteca
    ? `QUINTA. - PRECIO Y FORMA DE PAGO (CATEGORÍA CON PRENDA / HIPOTECA ABIERTA): Las partes contratantes han pactado como precio o valor para el inmueble objeto de este contrato la cantidad de ${numeroALetrasMillones(caso.negocio.valor_venta)} ($${caso.negocio.valor_venta.toLocaleString('es-CO')}), que LA PARTE COMPRADORA cancela así: a) La suma de $${(caso.negocio.valor_recursos_propios || 0).toLocaleString('es-CO')} con recursos propios entregados a satisfacción; y b) El saldo de $${(caso.negocio.valor_credito || 0).toLocaleString('es-CO')} con el producto de un crédito hipotecario / leasing aprobado a su favor por ${caso.negocio.entidad_financiera || 'LA ENTIDAD FINANCIERA'}, constituyendo hipoteca abierta de primer grado sin límite de cuantía sobre el inmueble objeto de esta escritura.`
    : `QUINTA. - PRECIO. - Las partes contratantes han pactado como precio o valor para el inmueble objeto de este contrato la cantidad de ${numeroALetrasMillones(caso.negocio.valor_venta)} ($${caso.negocio.valor_venta.toLocaleString('es-CO')}) moneda legal colombiana, que LA PARTE VENDEDORA declara recibidos de manos de LA PARTE COMPRADORA, a plena satisfacción.`;

  const docAdmin = caso.documentos.find((d) => d.codigo_tipo === 'PAZ_Y_SALVO_ADMIN');
  const clausulaDecimaSegundaAdmin = caso.tiene_administracion
    ? `-----------------------------------------------------------------------------------------
DÉCIMA SEGUNDA: PAZ Y SALVO DE ADMINISTRACIÓN (Artículo 29 de la Ley 675/01): Se protocoliza con el presente instrumento el Paz y Salvo expedido por la administración de ${caso.inmueble.edificio_conjunto} el día ${docAdmin?.fecha_expedicion || 'N/A'}, vigente hasta el último día del mes en curso (${docAdmin?.fecha_vencimiento || 'Fin de mes'}), acreditando que el inmueble y sus coeficientes se encuentran a paz y salvo por expensas comunes.`
    : '';

  return `REPÚBLICA DE COLOMBIA
NOTARIA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.
ESCRITURA PÚBLICA NÚMERO: ${caso.aprobaciones.numero_escritura_asignada}
DE FECHA: ${new Date().toLocaleDateString('es-CO')}
DEL AÑO DOS MIL VEINTISÉIS (2026).
-----------------------------------------------------------------------------------------
CLASE DE ACTO                                           VALOR
1º. COMPRAVENTA (${caso.categorias_activas.join(' + ')})   $${caso.negocio.valor_venta.toLocaleString('es-CO')}
2º. AFECTACIÓN A VIVIENDA FAMILIAR: SI (${caso.negocio.afectacion_vivienda_familiar ? 'X' : ' '}) NO (${!caso.negocio.afectacion_vivienda_familiar ? 'X' : ' '})
-----------------------------------------------------------------------------------------
PERSONAS QUE INTERVIENEN                                IDENTIFICACIÓN
LA PARTE VENDEDORA:
${resumenVendedores}

LA PARTE COMPRADORA:
${resumenCompradores}

INMUEBLE: ${caso.inmueble.direccion}
MATRÍCULA INMOBILIARIA: ${caso.inmueble.matricula_inmobiliaria}
CÉDULA CATASTRAL: ${caso.inmueble.cedula_catastral}
CHIP: ${caso.inmueble.chip}
-----------------------------------------------------------------------------------------
En la ciudad de Bogotá, D.C., Departamento de Cundinamarca, República de Colombia, ante mí, DIANA BEATRIZ LÓPEZ DURAN, NOTARIA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.; en la fecha se otorga la escritura pública, que se consigna en los siguientes términos:

Comparecieron: Por una parte, ${comparecenciaVendedores}; quien(es) para los efectos legales de esta negociación se llamará(n) LA PARTE VENDEDORA, y por otra parte, ${comparecenciaCompradores}; quien(es) para los efectos legales de esta negociación se llamará(n) LA PARTE COMPRADORA y DECLARARON: Que han celebrado el siguiente contrato de compra-venta que consignan en las siguientes cláusulas:

PRIMERA. - OBJETO Y LINDEROS (VERIFICADOS CON DOBLE IA GEMINI 3.8 FLASH VISION). - LA PARTE VENDEDORA transfiere a título de venta real y efectiva a favor de LA PARTE COMPRADORA, el pleno derecho de dominio, propiedad y posesión sobre el siguiente inmueble:
${caso.inmueble.linderos_especiales}

LINDEROS GENERALES DEL LOTE DE MAYOR EXTENSIÓN:
${caso.inmueble.linderos_generales}

MATRÍCULA INMOBILIARIA: ${caso.inmueble.matricula_inmobiliaria} de la Oficina de Registro de Instrumentos Públicos de Bogotá, D.C., ${caso.inmueble.zona_registro}.
CÉDULA CATASTRAL: ${caso.inmueble.cedula_catastral}.
CHIP: ${caso.inmueble.chip}.
-----------------------------------------------------------------------------------------
SEGUNDA. - CUERPO CIERTO: No obstante la descripción, cabida, medidas y linderos antes indicados, la transferencia del citado inmueble se realiza en su condición de cuerpo cierto.
${clausulaTerceraPH}
-----------------------------------------------------------------------------------------
CUARTA. - TRADICIÓN. - Manifiesta LA PARTE VENDEDORA que adquirió el inmueble objeto de este contrato por ${caso.inmueble.tradicion_antecedente}, debidamente inscrita al folio de matrícula inmobiliaria ${caso.inmueble.matricula_inmobiliaria}.
-----------------------------------------------------------------------------------------
${clausulaQuintaPrecio}
PARÁGRAFO (Art. 61 Ley 2010 de 2019): Enajenantes y adquirente declaran bajo juramento que el precio aquí consignado es real y no es objeto de pactos privados.
-----------------------------------------------------------------------------------------
SEXTA. - SANEAMIENTO. - Garantiza LA PARTE VENDEDORA que el inmueble es de su exclusiva propiedad y se transfiere libre de embargos, pleitos pendientes y demandas civiles.
SÉPTIMA. - PAZ Y SALVO IMPUESTOS Y VALORIZACIÓN.
OCTAVA. - ENTREGA REAL Y MATERIAL.
NOVENA. - GASTOS NOTARIALES Y DE REGISTRO.
DÉCIMA. - DECLARACIÓN DE ORIGEN DE FONDOS LÍCITOS.
${clausulaDecimaSegundaAdmin}
-----------------------------------------------------------------------------------------
LOS COMPARECIENTES PRESENTARON PARA SU PROTOCOLIZACIÓN LOS SIGUIENTES RECIBOS FISCALES:
1º. CERTIFICACIÓN DE PAGO IMPUESTO PREDIAL UNIFICADO AÑO GRAVABLE 2026:
    FACTURA No.: ${caso.recibos_fiscales.predial_factura} | No. REFERENCIA: ${caso.recibos_fiscales.predial_referencia}
    ENTIDAD RECAUDADORA: ${caso.recibos_fiscales.predial_banco} | FECHA: ${caso.recibos_fiscales.predial_fecha}
    AVALÚO CATASTRAL: $${caso.negocio.avaluo_catastral.toLocaleString('es-CO')}
2º. INSTITUTO DE DESARROLLO URBANO (IDU - VALORIZACIÓN ACUERDO 915 DE 2023):
    PIN DE SEGURIDAD: ${caso.recibos_fiscales.idu_pin} | Consecutivo No.: ${caso.recibos_fiscales.idu_consecutivo}
    MATRÍCULA: ${caso.inmueble.matricula_inmobiliaria} | CHIP: ${caso.inmueble.chip} | VENCE: ${caso.recibos_fiscales.idu_vencimiento}
3º. SECRETARÍA DISTRITAL DE HACIENDA - CONSULTADO POR EL VUR:
    CADENA DE SEGURIDAD: ${caso.recibos_fiscales.vur_cadena_seguridad} | FECHA Y HORA: ${caso.recibos_fiscales.vur_fecha_hora}
-----------------------------------------------------------------------------------------
OTORGAMIENTO, AUTORIZACIÓN E IMPRESIÓN EN PAPEL DE SEGURIDAD NOTARIAL:
Se utilizaron las hojas de papel notarial números: ${caso.aprobaciones.hojas_papel_notarial}
RESOLUCIÓN 964 DEL 20 DE ENERO DE 2026:
• DERECHOS NOTARIALES: $${liq.derechos_notariales.toLocaleString('es-CO')}
• IVA (19%): $${liq.iva_notarial.toLocaleString('es-CO')}
• SUPERINTENDENCIA DE NOTARIADO Y REGISTRO: $${liq.superintendencia.toLocaleString('es-CO')}
• CUENTA ESPECIAL PARA EL NOTARIADO: $${liq.cuenta_especial.toLocaleString('es-CO')}
• RETENCIÓN EN LA FUENTE (1%): $${liq.retencion_fuente_vendedor.toLocaleString('es-CO')}

DIANA BEATRIZ LÓPEZ DURAN
NOTARIA TREINTA Y TRES (33) DEL CÍRCULO DE BOGOTÁ D.C.`;
}
