# Motor Notarial Agéntico — Zero-Form Notary Copilot (`Notaria_POC`)

Plataforma inteligente para notarías (basada en los flujos de **Notaría 33 de Bogotá — Dra. Diana Beatriz López Durán** y su plantilla oficial `VENTA PH.docx`), diseñada con:

1. **Agente Copiloto Conversacional (Zero-Form):** El abogado arrastra los PDFs (Certificado de Tradición y Libertad, Cédulas, Paz y Salvos, Escritura Anterior) y el agente deduce automáticamente quién es **LA PARTE VENDEDORA** (último propietario en el Certificado de Tradición) y quién es **LA PARTE COMPRADORA** (cédulas restantes), detecta documentos faltantes y dispara alertas de vencimiento.
2. **Doble Modelo IA de Visión Multimodal (Sin OCR Tradicional):**
   * **Modelo 1 (`gemini-3.8-flash` Vision a 400 DPI)** + **Modelo 2 (`gemini-3.1-pro` Vision de contraste)** leen en paralelo las escrituras antiguas con sellos húmedos y los linderos.
   * **Motor Determinista `DiffEngine`:** Compara carácter por carácter ambas lecturas y resalta en pantalla dividida cualquier discrepancia junto al recorte visual del documento original para aprobación humana en un clic.
3. **Configurador Dinámico NoSQL de Trámites, Categorías y Documentos:**
   * Alimentado desde la interfaz para agregar trámites (`COMPRAVENTA_INMUEBLE`, `HIPOTECA`, `CANCELACION`, etc.), categorías dinámicas (Propiedad Horizontal con Administración, Prenda/Hipoteca/Leasing, Pluralidad de Compradores/Vendedores, Casa/Lote sin Administración) y reglas de vencimiento (`FIN_DE_MES_ACTUAL` con alerta crítica a $\le 5$ días del cierre de mes, `<30/90 días`, `SIN_VENCIMIENTO`).
4. **Módulo Dinámico de Constructoras y Proyectos Inmobiliarios (NoSQL):**
   * Creación dinámica de proyectos con $N$ bloques/torres, $M$ apartamentos por bloque, tipologías, documentos maestros heredados y estados de escrituración por unidad.
5. **Flujo Completo hasta Impresión en Papel de Seguridad:**
   * Aprobación del Abogado $\rightarrow$ Visto Bueno Digital del Cliente en Móvil (390px) $\rightarrow$ Cola de Impresión con registro de hojas de papel notarial y liquidación arancelaria Resolución 964 de 2026.

## Arquitectura GCP (`notaria-508802` / `482395810661`)
* **Compute:** Cloud Run (`notaria-copilot` en `us-central1`)
* **IA Multimodal:** Vertex AI (`gemini-3.8-flash` + `gemini-3.1-pro`)
* **Base de Datos Híbrida:**
  * **Cloud Firestore (NoSQL):** Catálogo dinámico de trámites, categorías, reglas de vencimiento y proyectos de constructoras.
  * **Cloud SQL for PostgreSQL 18 (`schema_pg18.sql`):** Tablas transaccionales (`caso`, `parte`, `documento`, `dato`, `evento`) con `uuidv7()`, índices GIN `JSONB` y Row-Level Security (`RLS`) por notaría.
* **Storage:** Cloud Storage (`gs://notaria-508802-expedientes`)
