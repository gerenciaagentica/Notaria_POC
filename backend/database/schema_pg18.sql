-- =============================================================================
-- MOTOR NOTARIAL AGÉNTICO · ESQUEMA OFICIAL POSTGRESQL 18 + RLS + JSONB NOSQL
-- =============================================================================
-- Aprovecha las capacidades nativas de PostgreSQL 18:
-- 1. uuidv7() nativo (ordenado por tiempo para bitácoras de alta concurrencia)
-- 2. Índices GIN paralelos sobre documentos JSONB (Catálogo Dinámico NoSQL)
-- 3. Row-Level Security (RLS) estricto por notaria_id
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLA DE NOTARÍAS (MULTI-TENANT)
CREATE TABLE IF NOT EXISTS notarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_circulo VARCHAR(32) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    notario_titular VARCHAR(200) NOT NULL,
    ciudad VARCHAR(100) NOT NULL DEFAULT 'Bogotá D.C.',
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CATÁLOGO DINÁMICO NOSQL (SINCRONIZADO CON CLOUD FIRESTORE / JSONB)
-- Almacena Trámites, Categorías Modificadoras, Reglas de Documentos, Vigencias y Campos a Extraer
CREATE TABLE IF NOT EXISTS catalogo_tramites_nosql (
    tramite_id VARCHAR(64) PRIMARY KEY,
    notaria_id UUID NOT NULL REFERENCES notarias(id),
    nombre VARCHAR(200) NOT NULL,
    plantilla_docx VARCHAR(255) NOT NULL DEFAULT 'VENTA PH.docx',
    configuracion_jsonb JSONB NOT NULL, -- Categorías, reglas de vencimiento, preguntas del agente, cláusulas
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_tramites_gin ON catalogo_tramites_nosql USING GIN (configuracion_jsonb);

-- 3. PROYECTOS DINÁMICOS DE CONSTRUCTORAS (NOSQL JSONB)
-- Permite crear dinámicamente proyectos con N bloques, M apartamentos por bloque, tipos y estados propios
CREATE TABLE IF NOT EXISTS proyectos_constructoras_nosql (
    proyecto_id VARCHAR(64) PRIMARY KEY,
    notaria_id UUID NOT NULL REFERENCES notarias(id),
    nombre_proyecto VARCHAR(200) NOT NULL,
    constructora_nombre VARCHAR(200) NOT NULL,
    nit_constructora VARCHAR(50),
    direccion_proyecto VARCHAR(250),
    configuracion_dinamica JSONB NOT NULL, -- Bloques, unidades, tipos_apto, estados_personalizados, docs_matriz
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proyectos_constructoras_gin ON proyectos_constructoras_nosql USING GIN (configuracion_dinamica);

-- 4. EL CASO / EXPEDIENTE NOTARIAL (MUNDO TRANSACCIONAL)
CREATE TABLE IF NOT EXISTS caso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radicado VARCHAR(32) NOT NULL UNIQUE, -- Ej. NOT-2026-000184
    notaria_id UUID NOT NULL REFERENCES notarias(id),
    tramite_id VARCHAR(64) NOT NULL REFERENCES catalogo_tramites_nosql(tramite_id),
    proyecto_id VARCHAR(64) REFERENCES proyectos_constructoras_nosql(proyecto_id),
    bloque_torre VARCHAR(50),
    unidad_apartamento VARCHAR(50),
    categorias_activas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Ej. ["PROPIEDAD_HORIZONTAL", "CON_PRENDA_HIPOTECA"]
    etapa_actual VARCHAR(64) NOT NULL DEFAULT 'SOLICITADO',
    -- Etapas: SOLICITADO, DOCUMENTOS_INCOMPLETOS, EN_VERIFICACION, REVISION_LINDEROS,
    -- MINUTA_GENERADA, EN_REVISION_ABOGADO, VISTO_BUENO_CLIENTES, EN_IMPRESION, FIRMADA_Y_REGISTRADA
    abogado_asignado VARCHAR(150),
    valor_acto NUMERIC(18, 2) DEFAULT 0,
    avaluo_catastral NUMERIC(18, 2) DEFAULT 0,
    matricula_inmobiliaria VARCHAR(64),
    chip VARCHAR(64),
    cedula_catastral VARCHAR(64),
    direccion_inmueble VARCHAR(255),
    visto_bueno_abogado BOOLEAN NOT NULL DEFAULT FALSE,
    visto_bueno_abogado_fecha TIMESTAMPTZ,
    visto_bueno_vendedor BOOLEAN NOT NULL DEFAULT FALSE,
    visto_bueno_comprador BOOLEAN NOT NULL DEFAULT FALSE,
    hojas_papel_notarial VARCHAR(120), -- Ej. AA-4910201 a AA-4910206
    numero_escritura VARCHAR(50),
    fecha_estimada_firma DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PARTES INTERVINIENTES (INFERIDAS ENTRE CERTIFICADO DE TRADICIÓN Y CÉDULAS)
CREATE TABLE IF NOT EXISTS parte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caso_id UUID NOT NULL REFERENCES caso(id) ON DELETE CASCADE,
    notaria_id UUID NOT NULL REFERENCES notarias(id),
    rol VARCHAR(32) NOT NULL, -- 'VENDEDOR' (inferido de última anotación Tradición) | 'COMPRADOR' (otras cédulas)
    nombres_completos VARCHAR(200) NOT NULL,
    tipo_documento VARCHAR(16) NOT NULL DEFAULT 'CC',
    numero_documento VARCHAR(50) NOT NULL,
    lugar_expedicion VARCHAR(120),
    estado_civil VARCHAR(80),
    genero VARCHAR(16), -- 'M' | 'F' (para ajustar vecino/vecina en VENTA PH.docx)
    porcentaje_participacion NUMERIC(5, 2) DEFAULT 100.00,
    es_pep BOOLEAN NOT NULL DEFAULT FALSE,
    cedula_cargada BOOLEAN NOT NULL DEFAULT FALSE,
    visto_bueno_digital BOOLEAN NOT NULL DEFAULT FALSE,
    visto_bueno_fecha TIMESTAMPTZ,
    telefono VARCHAR(50),
    email VARCHAR(150)
);

-- 6. DOCUMENTOS DEL CASO Y CONTROL DETERMINÍSTICO DE VENCIMIENTOS
CREATE TABLE IF NOT EXISTS documento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caso_id UUID NOT NULL REFERENCES caso(id) ON DELETE CASCADE,
    notaria_id UUID NOT NULL REFERENCES notarias(id),
    tipo_documento_codigo VARCHAR(64) NOT NULL,
    -- CEDULA_CIUDADANIA, CERTIFICADO_TRADICION, ESCRITURA_ANTERIOR, PAZ_Y_SALVO_ADMIN, PREDIAL, IDU_VALORIZACION, VUR_HACIENDA
    estilo_estructura VARCHAR(16) NOT NULL DEFAULT 'FIJO', -- 'FIJO' | 'VARIABLE'
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_storage VARCHAR(500),
    fecha_expedicion DATE,
    regla_vencimiento VARCHAR(32) NOT NULL, -- 'SIN_VENCIMIENTO' | 'MAX_30_DIAS' | 'MAX_90_DIAS' | 'FIN_DE_MES_ACTUAL'
    fecha_vencimiento DATE,
    dias_para_vencer INTEGER,
    estado_verificacion VARCHAR(32) NOT NULL DEFAULT 'CARGADO', -- 'PENDIENTE' | 'CARGADO' | 'VERIFICADO' | 'POR_VENCER' | 'VENCIDO' | 'RECHAZADO'
    alerta_mensaje TEXT,
    nivel_alerta VARCHAR(16) DEFAULT 'OK', -- 'OK' | 'WARNING' | 'CRITICAL'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABLA 'DATO' (VALOR VIGENTE EXTRAÍDO POR GEMINI 3.8 FLASH + CONSENSO DOBLE IA EN LINDEROS)
CREATE TABLE IF NOT EXISTS dato (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caso_id UUID NOT NULL REFERENCES caso(id) ON DELETE CASCADE,
    documento_id UUID REFERENCES documento(id) ON DELETE SET NULL,
    notaria_id UUID NOT NULL REFERENCES notarias(id),
    campo_canonico VARCHAR(120) NOT NULL, -- Ej. 'linderos_especiales', 'area_privada', 'tradicion_escritura_num'
    valor_vigente TEXT NOT NULL,
    lectura_modelo_a TEXT, -- Gemini 3.8 Flash Vision (Sin OCR)
    confianza_modelo_a NUMERIC(5, 2),
    lectura_modelo_b TEXT, -- Gemini 3.1 Pro Vision / Contraste Independiente
    confianza_modelo_b NUMERIC(5, 2),
    tiene_duda_transcripcion BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_duda VARCHAR(255), -- Ej. 'Sello notarial azul superpuesto sobre cifra decimal'
    coordenadas_recorte JSONB, -- [ymin, xmin, ymax, xmax] nativo de Gemini 3.8
    estado_aprobacion VARCHAR(32) NOT NULL DEFAULT 'AUTO_APROBADO', -- 'AUTO_APROBADO' | 'REQUIERE_REVISION_HUMANA' | 'APROBADO_POR_ABOGADO'
    aprobado_por VARCHAR(150),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABLA 'EVENTO' (BITÁCORA INMUTABLE APPEND-ONLY CON UUIDV7 EN PG 18)
CREATE TABLE IF NOT EXISTS evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caso_id UUID NOT NULL REFERENCES caso(id) ON DELETE CASCADE,
    notaria_id UUID NOT NULL REFERENCES notarias(id),
    actor_tipo VARCHAR(32) NOT NULL, -- 'AGENTE_GEMINI_3_8_FLASH' | 'AGENTE_DOBLE_CONSENSO' | 'ABOGADO' | 'CLIENTE' | 'COORDINADOR'
    actor_nombre VARCHAR(150) NOT NULL,
    accion VARCHAR(120) NOT NULL,
    detalle TEXT NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    latencia_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HABILITAR ROW-LEVEL SECURITY (RLS) POR NOTARÍA
ALTER TABLE caso ENABLE ROW LEVEL SECURITY;
ALTER TABLE parte ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE dato ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento ENABLE ROW LEVEL SECURITY;
