import React, { useState, useEffect } from 'react';

type RolVista = 'ABOGADO_COPILOTO' | 'VERIFICADOR_LINDEROS' | 'ADMIN_NOSQL' | 'CONSTRUCTORA' | 'CLIENTE_CELULAR' | 'JEFE_REPARTO';

export default function App() {
  const [vistaActiva, setVistaActiva] = useState<RolVista>('ABOGADO_COPILOTO');
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mensajeInput, setMensajeInput] = useState<string>('');
  const [fechaPazYSalvo, setFechaPazYSalvo] = useState<string>('2026-11-25');
  const [subTabDerecha, setSubTabDerecha] = useState<'EXPEDIENTE' | 'MINUTA_VIVO' | 'LIQUIDACION' | 'BITACORA'>('EXPEDIENTE');

  // Estados para formulario NoSQL Dinámico
  const [nuevaCatId, setNuevaCatId] = useState<string>('');
  const [nuevaCatNombre, setNuevaCatNombre] = useState<string>('');
  const [nuevaCatPregunta, setNuevaCatPregunta] = useState<string>('');
  const [nuevaCatDoc, setNuevaCatDoc] = useState<string>('');
  const [nuevaCatClausula, setNuevaCatClausula] = useState<string>('');

  // Estados para formulario Nueva Regla de Documento NoSQL
  const [docCodigo, setDocCodigo] = useState<string>('');
  const [docNombre, setDocNombre] = useState<string>('');
  const [docEstilo, setDocEstilo] = useState<'FIJO' | 'VARIABLE'>('VARIABLE');
  const [docVigencia, setDocVigencia] = useState<'SIN_VENCIMIENTO' | 'MAX_30_DIAS' | 'MAX_90_DIAS' | 'FIN_DE_MES_ACTUAL'>('FIN_DE_MES_ACTUAL');
  const [docCampos, setDocCampos] = useState<string>('fecha_expedicion, titular, entidad');

  // Estados para Constructoras Dinámicas
  const [proySeleccionadoIdx, setProySeleccionadoIdx] = useState<number>(0);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState<any>(null);
  const [nuevoProyNombre, setNuevoProyNombre] = useState<string>('');
  const [nuevoProyConstructora, setNuevoProyConstructora] = useState<string>('');
  const [nuevoProyBloques, setNuevoProyBloques] = useState<number>(3);
  const [nuevoProyAptos, setNuevoProyAptos] = useState<number>(6);
  const [mostrarModalProy, setMostrarModalProy] = useState<boolean>(false);

  // Estados para Impresión y Papel Notarial
  const [hojasPapelInput, setHojasPapelInput] = useState<string>('AA-4910201 a AA-4910206');
  const [escrituraNumInput, setEscrituraNumInput] = useState<string>('3.418 de 2026');

  const cargarEstado = async () => {
    try {
      const resp = await fetch('/api/state');
      const data = await resp.json();
      setStore(data);
      if (data.proyectos_constructoras?.[0]?.unidades?.[6] && !unidadSeleccionada) {
        setUnidadSeleccionada(data.proyectos_constructoras[0].unidades[6]);
      }
    } catch (err) {
      console.error('Error cargando estado del backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstado();
  }, []);

  const enviarMensajeAgente = async (opcionesExtra?: Record<string, any>) => {
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: mensajeInput,
          ...opcionesExtra
        })
      });
      await resp.json();
      setMensajeInput('');
      await cargarEstado();
    } catch (err) {
      console.error('Error en chat agéntico:', err);
    }
  };

  const aprobarLindero = async (linderoId?: string, valor?: string, aprobarTodos?: boolean) => {
    try {
      await fetch('/api/linderos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lindero_id: linderoId,
          valor_aprobado: valor,
          aprobar_todos: aprobarTodos
        })
      });
      await cargarEstado();
    } catch (err) {
      console.error('Error aprobando lindero:', err);
    }
  };

  const avanzarFlujo = async (paso: string) => {
    try {
      await fetch('/api/flujo/avanzar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paso,
          hojas_papel_notarial: hojasPapelInput,
          numero_escritura: escrituraNumInput
        })
      });
      await cargarEstado();
    } catch (err) {
      console.error('Error avanzando flujo:', err);
    }
  };

  const guardarNuevaCategoriaNoSQL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCatNombre.trim()) return;
    await fetch('/api/nosql/categoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria_id: nuevaCatId || nuevaCatNombre.toUpperCase().replace(/\s+/g, '_'),
        nombre: nuevaCatNombre,
        pregunta_agente: nuevaCatPregunta || `¿Aplica la condición ${nuevaCatNombre}?`,
        regla_activacion_automatica: 'Inferida dinámicamente por Gemini 3.8 Flash al leer los documentos del caso.',
        documentos_adicionales: nuevaCatDoc ? [nuevaCatDoc] : [],
        clausulas_afectadas: [nuevaCatClausula || 'CLÁUSULA ESPECIAL POR CATEGORÍA'],
        impacto_minuta: `Modifica automáticamente la plantilla VENTA PH.docx cuando se activa ${nuevaCatNombre}.`
      })
    });
    setNuevaCatId('');
    setNuevaCatNombre('');
    setNuevaCatPregunta('');
    setNuevaCatDoc('');
    setNuevaCatClausula('');
    await cargarEstado();
  };

  const guardarNuevaReglaDocNoSQL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNombre.trim()) return;
    await fetch('/api/nosql/documento-regla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: docCodigo || docNombre.toUpperCase().replace(/\s+/g, '_'),
        nombre: docNombre,
        estilo_estructura: docEstilo,
        regla_vencimiento: docVigencia,
        dias_maximos: docVigencia === 'MAX_30_DIAS' ? 30 : docVigencia === 'MAX_90_DIAS' ? 90 : undefined,
        alerta_dias_antes_fin_mes: docVigencia === 'FIN_DE_MES_ACTUAL' ? 5 : undefined,
        obligatorio_base: true,
        descargable_bot_gubernamental: false,
        campos_extraer: docCampos.split(',').map((s) => s.trim()).filter(Boolean),
        descripcion_regla: `Documento ${docEstilo} con regla de vigencia ${docVigencia} alimentado dinámicamente en la base NoSQL.`
      })
    });
    setDocCodigo('');
    setDocNombre('');
    await cargarEstado();
  };

  const crearProyectoConstructora = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/constructoras/crear-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_proyecto: nuevoProyNombre || 'Reserva de los Cerros P.H.',
        constructora: nuevoProyConstructora || 'Constructora Colpatria S.A.',
        num_bloques: nuevoProyBloques,
        aptos_por_bloque: nuevoProyAptos
      })
    });
    setMostrarModalProy(false);
    setProySeleccionadoIdx(0);
    await cargarEstado();
  };

  const cambiarEstadoUnidadConstructora = async (proyectoId: string, unidadId: string, nuevoEstado: string) => {
    await fetch('/api/constructoras/actualizar-unidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId,
        unidad_id: unidadId,
        nuevo_estado: nuevoEstado
      })
    });
    await cargarEstado();
  };

  if (loading || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 text-stone-800">
        <div className="p-8 bg-white rounded-2xl shadow border border-stone-200 text-center space-y-2">
          <div className="text-lg font-bold serif">Cargando Motor Notarial Agéntico...</div>
          <div className="text-xs text-stone-500">Gemini 3.8 Flash (Visión Multimodal Sin OCR) + PostgreSQL 18 + Base Dinámica NoSQL</div>
        </div>
      </div>
    );
  }

  const caso = store.casos[0];
  const catalogo = store.catalogo_tramites[0];
  const proyectoActual = store.proyectos_constructoras[proySeleccionadoIdx] || store.proyectos_constructoras[0];
  const liq = store.liquidacion_actual;
  const dudasPendientesCount = caso.discrepancias_linderos.filter((d: any) => d.estado === 'PENDIENTE_HUMANO').length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* BARRA SUPERIOR FIJA DE NAVEGACIÓN ENTRE ROLES Y MÓDULOS */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-950 text-white flex items-center justify-center font-bold text-lg shadow-sm">+</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="serif font-bold text-lg text-stone-900">Notaría 33 del Círculo de Bogotá D.C.</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold border border-purple-300">
                Gemini 3.8 Flash Vision (Sin OCR) · PostgreSQL 18
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Copiloto Conversacional Zero-Form · Cruce Tradición/Cédulas · Consenso Doble IA en Linderos · Constructoras Dinámicas NoSQL
            </p>
          </div>
        </div>

        {/* Selector de Módulos Operativos */}
        <div className="flex flex-wrap gap-1.5 bg-stone-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setVistaActiva('ABOGADO_COPILOTO')}
            className={`px-3 py-2 rounded-lg transition ${
              vistaActiva === 'ABOGADO_COPILOTO' ? 'bg-purple-900 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300'
            }`}
          >
            1. 💬 Chat Agéntico + Expediente
          </button>
          <button
            onClick={() => setVistaActiva('VERIFICADOR_LINDEROS')}
            className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
              vistaActiva === 'VERIFICADOR_LINDEROS' ? 'bg-purple-900 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300'
            }`}
          >
            <span>2. 🔍 Linderos Doble IA</span>
            {dudasPendientesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-400 text-stone-950 rounded-full text-[10px] font-extrabold">{dudasPendientesCount}</span>
            )}
          </button>
          <button
            onClick={() => setVistaActiva('ADMIN_NOSQL')}
            className={`px-3 py-2 rounded-lg transition ${
              vistaActiva === 'ADMIN_NOSQL' ? 'bg-purple-900 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300'
            }`}
          >
            3. ⚙️ Base Dinámica NoSQL (Trámites/Vigencias)
          </button>
          <button
            onClick={() => setVistaActiva('CONSTRUCTORA')}
            className={`px-3 py-2 rounded-lg transition ${
              vistaActiva === 'CONSTRUCTORA' ? 'bg-purple-900 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300'
            }`}
          >
            4. 🏢 Constructoras (Bloques/Estados)
          </button>
          <button
            onClick={() => setVistaActiva('CLIENTE_CELULAR')}
            className={`px-3 py-2 rounded-lg transition ${
              vistaActiva === 'CLIENTE_CELULAR' ? 'bg-purple-900 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300'
            }`}
          >
            5. 📱 Vista Cliente / Visto Bueno
          </button>
          <button
            onClick={() => setVistaActiva('JEFE_REPARTO')}
            className={`px-3 py-2 rounded-lg transition ${
              vistaActiva === 'JEFE_REPARTO' ? 'bg-purple-900 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300'
            }`}
          >
            6. 📊 Tablero Jefe
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {/* =====================================================================
            VISTA 1: COPILOTO DEL ABOGADO (SPLIT-SCREEN: CHAT GUÍA + MINUTA EN VIVO)
           ===================================================================== */}
        {vistaActiva === 'ABOGADO_COPILOTO' && (
          <div className="space-y-4">
            {/* Cinta de Estado del Caso y Circuito de Visto Bueno e Impresión */}
            <div className="bg-white rounded-2xl border border-stone-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-lg text-stone-900">{caso.radicado}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900">{caso.etapa_actual}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900">
                    ⏰ Paz y Salvo Admin: Vence en {caso.documentos[0]?.dias_restantes ?? 5} días (Fin de mes)
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-1">
                  <strong>Inmueble:</strong> {caso.inmueble.direccion} · <strong>Matrícula:</strong> {caso.inmueble.matricula_inmobiliaria} ·{' '}
                  <strong>CHIP:</strong> {caso.inmueble.chip} · <strong>Precio:</strong> ${Number(caso.negocio.valor_venta).toLocaleString('es-CO')}
                </p>
              </div>

              {/* Botones rápidos del flujo hasta Impresión */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() => setVistaActiva('VERIFICADOR_LINDEROS')}
                  className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold shadow-sm"
                >
                  🔍 Revisar Linderos ({dudasPendientesCount} dudas)
                </button>
                <button
                  onClick={() => avanzarFlujo('VISTO_BUENO_ABOGADO')}
                  className={`px-3 py-2 rounded-lg font-bold border ${
                    caso.aprobaciones.visto_bueno_juridico_abogado
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                  }`}
                >
                  {caso.aprobaciones.visto_bueno_juridico_abogado ? '✓ Visto Bueno Abogado OK' : '1. Dar Visto Bueno Abogado'}
                </button>
                <button
                  onClick={() => avanzarFlujo('VISTO_BUENO_CLIENTES')}
                  className={`px-3 py-2 rounded-lg font-bold border ${
                    caso.aprobaciones.visto_bueno_vendedores
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-indigo-900 text-white border-indigo-900 hover:bg-indigo-800'
                  }`}
                >
                  {caso.aprobaciones.visto_bueno_vendedores ? '✓ Visto Bueno Clientes OK' : '2. Simular Visto Bueno Clientes'}
                </button>
                <button
                  onClick={() => avanzarFlujo('ENVIAR_A_IMPRESION')}
                  className={`px-3 py-2 rounded-lg font-bold border ${
                    caso.aprobaciones.en_impresion
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-purple-900 text-white border-purple-900 hover:bg-purple-800'
                  }`}
                >
                  {caso.aprobaciones.en_impresion ? '🖨️ En Impresión (Papel Asignado)' : '3. Pasar a Impresión'}
                </button>
              </div>
            </div>

            {/* Pantalla Dividida: Izquierda Chat Guía (Zero-Form) / Derecha Expediente y Minuta en Vivo */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* COLUMNA IZQUIERDA (5 cols): EL CHAT QUE GUÍA, RECIBE DOCS, CRUZA PARTES Y SACA ALERTAS */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-300 shadow-sm flex flex-col h-[700px] overflow-hidden">
                <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Zero-Form Notary Copilot</span>
                    <h3 className="text-sm font-bold">Agente Recepcionista · Gemini 3.8 Flash Vision</h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-700">
                    Visión Pura · Cero OCR
                  </span>
                </div>

                {/* Controles interactivos de prueba en 1 clic para Mauro */}
                <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-200 text-[11px] space-y-2">
                  <div className="font-bold text-purple-950">⚡ Acciones Rápidas de Simulación del Caso:</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => enviarMensajeAgente({ subir_cedula_monica: true, mensaje: 'Adjunto la cédula faltante de la vendedora Mónica Patricia Pérez (CC 52.110.900).' })}
                      className="px-2.5 py-1 rounded bg-purple-900 text-white font-semibold hover:bg-purple-800"
                    >
                      + Subir Cédula Faltante (Mónica Pérez)
                    </button>
                    <button
                      onClick={() => enviarMensajeAgente({ activar_hipoteca: !caso.tiene_prenda_hipoteca, mensaje: caso.tiene_prenda_hipoteca ? 'Cambiar trámite a venta de contado sin hipoteca.' : 'El apartamento viene con prenda / crédito hipotecario Davivienda.' })}
                      className="px-2.5 py-1 rounded bg-white border border-purple-300 text-purple-900 font-semibold hover:bg-purple-100"
                    >
                      {caso.tiene_prenda_hipoteca ? 'Quitar Categoría Prenda/Hipoteca' : 'Activar Categoría Con Prenda/Hipoteca'}
                    </button>
                    <button
                      onClick={() => enviarMensajeAgente({ tiene_admin: !caso.tiene_administracion, mensaje: caso.tiene_administracion ? 'Es una casa sin administración.' : 'Es un apartamento con administración PH.' })}
                      className="px-2.5 py-1 rounded bg-white border border-purple-300 text-purple-900 font-semibold hover:bg-purple-100"
                    >
                      {caso.tiene_administracion ? 'Cambiar a Sin Administración' : 'Activar Con Administración (Paz y Salvo)'}
                    </button>
                  </div>

                  {/* Probador de la Regla de Fin de Mes del Paz y Salvo */}
                  <div className="flex items-center gap-2 pt-1 border-t border-purple-200/70">
                    <span className="font-semibold text-stone-700">Probar Fecha Paz y Salvo Admin:</span>
                    <input
                      type="date"
                      value={fechaPazYSalvo}
                      onChange={(e) => setFechaPazYSalvo(e.target.value)}
                      className="border border-stone-300 rounded px-2 py-0.5 text-xs bg-white"
                    />
                    <button
                      onClick={() =>
                        enviarMensajeAgente({
                          fecha_paz_y_salvo: fechaPazYSalvo,
                          fecha_actual_simulacion: '2026-11-25',
                          mensaje: `Capturé nuevo Paz y Salvo de Administración con fecha ${fechaPazYSalvo} (evaluando contra el 25 de noviembre).`
                        })
                      }
                      className="px-2.5 py-0.5 rounded bg-amber-600 text-white font-bold hover:bg-amber-700"
                    >
                      Evaluar Vencimiento
                    </button>
                  </div>
                </div>

                {/* Historial de Mensajes del Chat */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-50 text-xs">
                  {caso.mensajes_chat.map((m: any) => (
                    <div key={m.id} className={`flex ${m.emisor === 'ABOGADO' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-[92%] shadow-sm space-y-2 ${
                          m.emisor === 'ABOGADO'
                            ? 'bg-purple-900 text-white rounded-tr-none'
                            : 'bg-white border border-stone-200 text-stone-800 rounded-tl-none'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-current/10 pb-1">
                          <span className="font-bold text-[11px]">{m.autor}</span>
                          <span className="text-[10px] opacity-70">{m.hora}</span>
                        </div>
                        <p className="leading-relaxed">{m.texto}</p>

                        {m.hallazgos && m.hallazgos.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-1">
                            <div className="font-bold text-[11px]">🧠 Inferencia y Cruce Documental:</div>
                            {m.hallazgos.map((h: string, i: number) => (
                              <p key={i} className="text-[11px] leading-snug">• {h}</p>
                            ))}
                          </div>
                        )}

                        {m.alertas_rojas && m.alertas_rojas.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-950 space-y-1">
                            <div className="font-bold text-[11px]">🚨 Pendientes y Alertas de Vencimiento:</div>
                            {m.alertas_rojas.map((a: string, i: number) => (
                              <p key={i} className="text-[11px] leading-snug font-medium">• {a}</p>
                            ))}
                          </div>
                        )}

                        {m.preguntas_pendientes && m.preguntas_pendientes.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                            <div className="font-bold text-[11px]">❓ Preguntas del Agente al Abogado:</div>
                            {m.preguntas_pendientes.map((q: string, i: number) => (
                              <p key={i} className="text-[11px] leading-snug">• {q}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Caja de Entrada del Chat */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!mensajeInput.trim()) return;
                    enviarMensajeAgente();
                  }}
                  className="p-3 bg-white border-t border-stone-200 flex gap-2"
                >
                  <input
                    type="text"
                    value={mensajeInput}
                    onChange={(e) => setMensajeInput(e.target.value)}
                    placeholder="Escribe al agente (ej. 'Ya subí la cédula de Mónica' o 'Es venta con prenda')..."
                    className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-800"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs rounded-xl"
                  >
                    Enviar
                  </button>
                </form>
              </div>

              {/* COLUMNA DERECHA (7 cols): EXPEDIENTE DINÁMICO, CRUCE DE PARTES, MINUTA EN VIVO Y SEGUIMIENTO DE IMPRESIÓN */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-300 shadow-sm flex flex-col h-[700px] overflow-hidden">
                {/* Sub-pestañas derechas */}
                <div className="px-5 pt-3 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1 text-xs font-bold">
                    <button
                      onClick={() => setSubTabDerecha('EXPEDIENTE')}
                      className={`px-3.5 py-2 rounded-t-lg border-b-2 ${
                        subTabDerecha === 'EXPEDIENTE'
                          ? 'bg-white text-purple-900 border-purple-900'
                          : 'text-stone-600 border-transparent hover:text-stone-900'
                      }`}
                    >
                      📑 Partes Inferidas, Documentos e Impresión
                    </button>
                    <button
                      onClick={() => setSubTabDerecha('MINUTA_VIVO')}
                      className={`px-3.5 py-2 rounded-t-lg border-b-2 ${
                        subTabDerecha === 'MINUTA_VIVO'
                          ? 'bg-white text-purple-900 border-purple-900'
                          : 'text-stone-600 border-transparent hover:text-stone-900'
                      }`}
                    >
                      📜 Minuta VENTA PH.docx en Vivo
                    </button>
                    <button
                      onClick={() => setSubTabDerecha('LIQUIDACION')}
                      className={`px-3.5 py-2 rounded-t-lg border-b-2 ${
                        subTabDerecha === 'LIQUIDACION'
                          ? 'bg-white text-purple-900 border-purple-900'
                          : 'text-stone-600 border-transparent hover:text-stone-900'
                      }`}
                    >
                      🧮 Liquidación Res. 964/2026
                    </button>
                    <button
                      onClick={() => setSubTabDerecha('BITACORA')}
                      className={`px-3.5 py-2 rounded-t-lg border-b-2 ${
                        subTabDerecha === 'BITACORA'
                          ? 'bg-white text-purple-900 border-purple-900'
                          : 'text-stone-600 border-transparent hover:text-stone-900'
                      }`}
                    >
                      🛡️ Bitácora PostgreSQL 18 ({caso.bitacora.length})
                    </button>
                  </div>
                </div>

                {/* CONTENIDO SUB-PESTAÑA 1: EXPEDIENTE, CRUCE VENDEDOR/COMPRADOR, DOCUMENTOS E IMPRESIÓN */}
                {subTabDerecha === 'EXPEDIENTE' && (
                  <div className="flex-1 p-5 overflow-y-auto space-y-5 text-xs">
                    {/* Categorías Dinámicas Activadas */}
                    <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
                      <div className="font-bold text-purple-950 flex items-center justify-between">
                        <span>Categorías del Trámite Detectadas Dinámicamente (Afectan Proceso y Minuta Final):</span>
                        <span className="text-[10px] bg-purple-900 text-white px-2 py-0.5 rounded">Alimentado desde NoSQL</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {caso.categorias_activas.map((cat: string) => (
                          <span key={cat} className="px-2.5 py-1 rounded-full bg-white border border-purple-300 text-purple-900 font-bold text-[11px]">
                            ✓ {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Inferencia Automática Vendedores vs Compradores (Certificado de Tradición vs Cédulas) */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-stone-900 text-sm">
                        1. Inferencia Automática de Otorgantes (Últimos dueños en Tradición = Vendedores · Otras Cédulas = Compradores)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {caso.partes.map((p: any) => (
                          <div
                            key={p.id}
                            className={`p-3 rounded-xl border ${
                              p.cedula_cargada ? 'bg-white border-stone-200' : 'bg-red-50 border-red-300'
                            } space-y-1`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  p.rol === 'VENDEDOR' ? 'bg-indigo-100 text-indigo-900' : 'bg-teal-100 text-teal-900'
                                }`}
                              >
                                {p.rol} ({p.porcentaje}%)
                              </span>
                              <span
                                className={`font-bold text-[10px] ${
                                  p.cedula_cargada ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {p.cedula_cargada ? '✓ Cédula OK' : '❌ FALTA CÉDULA'}
                              </span>
                            </div>
                            <div className="font-bold text-stone-900">{p.nombres_completos}</div>
                            <div className="mono text-[11px] text-stone-600">C.C. {p.numero_documento} ({p.lugar_expedicion})</div>
                            <p className="text-[10px] text-stone-500 leading-snug">{p.origen_inferencia}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Lista de Documentos del Trámite con Vencimientos y Alertas */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-stone-900 text-sm">
                        2. Documentos del Trámite (Fijos vs. Variables · Control de Fecha Límite y Fin de Mes)
                      </h4>
                      <div className="space-y-2">
                        {caso.documentos.map((doc: any) => (
                          <div
                            key={doc.id}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                              doc.nivel_alerta === 'CRITICAL'
                                ? 'bg-red-50/70 border-red-300'
                                : doc.nivel_alerta === 'WARNING'
                                ? 'bg-amber-50/70 border-amber-300'
                                : 'bg-white border-stone-200'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-stone-900">{doc.nombre}</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                    doc.estilo === 'FIJO'
                                      ? 'bg-stone-200 text-stone-700'
                                      : 'bg-purple-100 text-purple-900'
                                  }`}
                                >
                                  ESTILO: {doc.estilo}
                                </span>
                                {doc.fecha_vencimiento && (
                                  <span className="text-[10px] mono text-stone-500">
                                    Vence: {doc.fecha_vencimiento}
                                  </span>
                                )}
                              </div>
                              <p
                                className={`text-[11px] font-medium ${
                                  doc.nivel_alerta === 'CRITICAL'
                                    ? 'text-red-800'
                                    : doc.nivel_alerta === 'WARNING'
                                    ? 'text-amber-900'
                                    : 'text-stone-600'
                                }`}
                              >
                                {doc.mensaje_alerta}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {doc.codigo_tipo === 'ESCRITURA_ANTERIOR' && (
                                <button
                                  onClick={() => setVistaActiva('VERIFICADOR_LINDEROS')}
                                  className="px-2.5 py-1 rounded-lg bg-purple-900 text-white font-bold text-[11px]"
                                >
                                  Auditar Linderos
                                </button>
                              )}
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  doc.nivel_alerta === 'CRITICAL'
                                    ? 'bg-red-200 text-red-950'
                                    : doc.nivel_alerta === 'WARNING'
                                    ? 'bg-amber-200 text-amber-950'
                                    : 'bg-emerald-100 text-emerald-900'
                                }`}
                              >
                                {doc.estado}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Circuito de Visto Bueno (Abogado -> Clientes) y Seguimiento de Impresión en Papel Notarial */}
                    <div className="p-4 rounded-xl border-2 border-stone-300 bg-stone-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-stone-900 text-sm">
                          3. Circuito de Aprobación, Visto Bueno de Clientes y Seguimiento de Impresión
                        </h4>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-teal-100 text-teal-900">
                          Etapa: {caso.etapa_actual}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                          <div className="font-bold text-stone-800">Paso 1: Visto Bueno Abogado</div>
                          <div className={`text-xs font-bold mt-1 ${caso.aprobaciones.visto_bueno_juridico_abogado ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {caso.aprobaciones.visto_bueno_juridico_abogado ? '✓ Aprobado por Abogado' : '⏳ Pendiente Aprobación'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                          <div className="font-bold text-stone-800">Paso 2: Visto Bueno Clientes</div>
                          <div className={`text-xs font-bold mt-1 ${caso.aprobaciones.visto_bueno_vendedores ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {caso.aprobaciones.visto_bueno_vendedores ? '✓ Aprobado por Vendedor y Comprador' : '⏳ Esperando Visto Bueno Móvil'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                          <div className="font-bold text-stone-800">Paso 3: Impresión y Firma</div>
                          <div className={`text-xs font-bold mt-1 ${caso.aprobaciones.firma_completada ? 'text-emerald-700' : caso.aprobaciones.en_impresion ? 'text-purple-800' : 'text-stone-500'}`}>
                            {caso.aprobaciones.firma_completada ? '✓ Escritura Impresa y Firmada' : caso.aprobaciones.en_impresion ? '🖨️ Imprimiendo en Papel Notarial' : '⏳ En espera'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-semibold text-stone-600 block">Folios Papel de Seguridad Notarial:</label>
                          <input
                            type="text"
                            value={hojasPapelInput}
                            onChange={(e) => setHojasPapelInput(e.target.value)}
                            className="w-full border border-stone-300 rounded px-2 py-1 mono text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-stone-600 block">Número de Escritura Pública:</label>
                          <input
                            type="text"
                            value={escrituraNumInput}
                            onChange={(e) => setEscrituraNumInput(e.target.value)}
                            className="w-full border border-stone-300 rounded px-2 py-1 mono text-xs bg-white"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => avanzarFlujo('COMPLETAR_FIRMA')}
                            className="w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs"
                          >
                            ✓ Registrar Impresión y Firma Final
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTENIDO SUB-PESTAÑA 2: MINUTA OFICIAL VENTA PH.DOCX EN VIVO */}
                {subTabDerecha === 'MINUTA_VIVO' && (
                  <div className="flex-1 p-5 overflow-y-auto bg-stone-100">
                    <div className="bg-white border-2 border-stone-300 rounded-xl p-6 shadow-sm max-w-3xl mx-auto">
                      <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4 text-xs">
                        <span className="font-bold text-purple-900">📄 Plantilla Dinámica Oficial: VENTA PH.docx (Notaría 33 de Bogotá)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold">
                          Sincronizada en tiempo real con Categorías y Linderos
                        </span>
                      </div>
                      <pre className="mono text-[11px] whitespace-pre-wrap leading-relaxed text-stone-800">
                        {store.minuta_generada_actual}
                      </pre>
                    </div>
                  </div>
                )}

                {/* CONTENIDO SUB-PESTAÑA 3: LIQUIDACIÓN NOTARIAL RESOLUCIÓN 964 DE 2026 */}
                {subTabDerecha === 'LIQUIDACION' && liq && (
                  <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="text-stone-500">Base de Liquidación (Mayor entre Precio de Venta y Avalúo Catastral)</div>
                        <div className="text-xl font-bold text-stone-900 mono mt-0.5">
                          ${Number(liq.base_liquidacion).toLocaleString('es-CO')}
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-900 font-bold">
                        Resolución 964 del 20 de enero de 2026
                      </span>
                    </div>

                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-stone-300 text-stone-500 uppercase text-[10px]">
                          <th className="py-2">Concepto</th>
                          <th className="py-2">Regla</th>
                          <th className="py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        <tr>
                          <td className="py-2.5 font-semibold">Derechos Notariales</td>
                          <td className="py-2.5 text-stone-500">Tarifa Escrituración Compraventa</td>
                          <td className="py-2.5 text-right mono font-semibold">${Number(liq.derechos_notariales).toLocaleString('es-CO')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold">IVA sobre Derechos Notariales</td>
                          <td className="py-2.5 text-stone-500">19%</td>
                          <td className="py-2.5 text-right mono font-semibold">${Number(liq.iva_notarial).toLocaleString('es-CO')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold">Superintendencia de Notariado y Registro + Fondo Cuenta Especial</td>
                          <td className="py-2.5 text-stone-500">Recaudo legal fijo</td>
                          <td className="py-2.5 text-right mono font-semibold">${Number(liq.superintendencia + liq.cuenta_especial).toLocaleString('es-CO')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-indigo-900">Retención en la Fuente (A cargo de la Parte Vendedora)</td>
                          <td className="py-2.5 text-stone-500">1.0% sobre enajenación de activo fijo</td>
                          <td className="py-2.5 text-right mono font-bold text-indigo-900">${Number(liq.retencion_fuente_vendedor).toLocaleString('es-CO')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-teal-900">Boleta Fiscal (Beneficencia) + Derechos de Registro (Externo)</td>
                          <td className="py-2.5 text-stone-500">1.5% estimado registro</td>
                          <td className="py-2.5 text-right mono font-bold text-teal-900">${Number(liq.boleta_rentas_externo + liq.derechos_registro_externo).toLocaleString('es-CO')}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                        <div className="text-[11px] font-bold text-indigo-900 uppercase">Total Parte Vendedora (50% Gastos + Retefuente)</div>
                        <div className="text-lg font-bold mono text-indigo-950 mt-1">${Number(liq.total_vendedor).toLocaleString('es-CO')}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                        <div className="text-[11px] font-bold text-teal-900 uppercase">Total Parte Compradora (50% Gastos + Beneficencia y Registro)</div>
                        <div className="text-lg font-bold mono text-teal-950 mt-1">${Number(liq.total_comprador).toLocaleString('es-CO')}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTENIDO SUB-PESTAÑA 4: BITÁCORA INMUTABLE POSTGRESQL 18 */}
                {subTabDerecha === 'BITACORA' && (
                  <div className="flex-1 p-5 overflow-y-auto space-y-2.5 text-xs">
                    {caso.bitacora.map((b: any) => (
                      <div key={b.id} className="p-3 rounded-xl border border-stone-200 bg-stone-50 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-stone-900">{b.actor} · <span className="text-purple-800">{b.etapa}</span></div>
                          <p className="text-stone-600 mt-0.5">{b.detalle}</p>
                        </div>
                        <span className="mono text-[10px] text-stone-400 shrink-0">{b.fecha}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VISTA 2: AUDITORÍA VISUAL DE LINDEROS SIDE-BY-SIDE (DOBLE IA SIN OCR)
           ===================================================================== */}
        {vistaActiva === 'VERIFICADOR_LINDEROS' && (
          <div className="bg-white rounded-2xl border border-stone-300 shadow-md overflow-hidden">
            <div className="bg-stone-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
                  Consenso Multimodal Sin OCR · Escrituras Antiguas Mal Escaneadas y con Sellos
                </span>
                <h2 className="text-lg font-bold">
                  Verificación Minuciosa de Linderos (Modelo 1: Gemini 3.8 Flash Vision vs. Modelo 2: Gemini 3.1 Pro Vision)
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => aprobarLindero(undefined, undefined, true)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow"
                >
                  ✓ Confirmar Todos los Linderos y Actualizar Minuta
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-200">
              {/* Mitad Izquierda: Facsímil de la Escritura Escaneada con Sellos y Manchas */}
              <div className="p-6 bg-stone-100 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800">
                    📷 Imagen Escaneada Original: <code>escritura_1420_2014_escaneo_sellos.pdf</code>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-semibold">
                    Filtro Separación de Sellos Activo (400 DPI)
                  </span>
                </div>

                <div
                  className="bg-[#f7f2e4] border-2 border-stone-400 rounded-xl p-6 shadow-inner mono text-xs leading-relaxed text-stone-800 space-y-3"
                  style={{ transform: 'rotate(-0.35deg)' }}
                >
                  <div className="text-[10px] text-stone-500 border-b border-stone-300 pb-2 flex justify-between">
                    <span>PAPEL DE SEGURIDAD NOTARIAL · NOTARÍA 19 DEL CÍRCULO DE BOGOTÁ</span>
                    <span>ESCRITURA No. 1.420 DE 2014</span>
                  </div>
                  <p>
                    <strong>APARTAMENTO SEISCIENTOS UNO (601):</strong> Tiene su acceso por el hall del sexto piso, consta de sala-comedor, tres alcobas, cocina, zona de ropas y dos baños. Tiene un área privada de{' '}
                    <span className="bg-amber-300 border-2 border-amber-700 px-1.5 py-0.5 font-extrabold text-stone-950 rounded">
                      OCHENTA Y OCHO PUNTO CINCUENTA Y [SELLO AZUL: 88.53 / 88.58]
                    </span>{' '}
                    METROS CUADRADOS, coeficiente de copropiedad del 4.18% y se comprende dentro de los siguientes linderos especiales:
                  </p>
                  <p>
                    <strong>POR EL NORTE:</strong> En línea quebrada de{' '}
                    <span className="bg-emerald-200/80 px-1 rounded">ocho metros cuarenta y cinco centímetros (8.45 mts)</span> con vacío sobre zona común exterior.
                  </p>
                  <p>
                    <strong>POR EL SUR:</strong> En extensión de{' '}
                    <span className="bg-emerald-200/80 px-1 rounded">seis metros veinte centímetros (6.20 mts)</span> con hall de circulación común y ducto de escaleras.
                  </p>
                  <p>
                    <strong>POR EL ORIENTE:</strong> En extensión de{' '}
                    <span className="bg-red-300 border-2 border-red-700 px-1.5 py-0.5 font-extrabold text-stone-950 rounded">
                      NUEVE METROS [MANCHA TÓNER: TREINTA / OCHENTA] CENTÍMETROS (9.30 / 9.80 mts)
                    </span>{' '}
                    con muro común que lo separa del apartamento seiscientos dos (602).
                  </p>
                  <p>
                    <strong>POR EL OCCIDENTE:</strong> En extensión de{' '}
                    <span className="bg-emerald-200/80 px-1 rounded">nueve metros treinta centímetros (9.30 mts)</span> con vacío sobre antejardín de la Calle 116. <strong>NADIR:</strong> Con placa que lo separa del quinto piso. <strong>CENIT:</strong> Con placa de cubierta del séptimo piso.
                  </p>
                  <div
                    className="inline-block border-2 border-blue-900/50 text-blue-900/60 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest"
                    style={{ transform: 'rotate(-5deg)' }}
                  >
                    SELLO HÚMEDO NOTARÍA 19 BOGOTÁ · COPIA DEL ORIGINAL
                  </div>
                </div>
              </div>

              {/* Mitad Derecha: Tarjetas de Resolución de Dudas del Abogado */}
              <div className="p-6 space-y-5">
                {caso.discrepancias_linderos.map((d: any, index: number) => (
                  <div
                    key={d.id}
                    className={`p-4 rounded-xl border-2 space-y-3 text-xs ${
                      d.estado === 'APROBADO_ABOGADO'
                        ? 'border-emerald-400 bg-emerald-50/40'
                        : 'border-amber-400 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">
                        Duda #{index + 1}: {d.campo}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          d.estado === 'APROBADO_ABOGADO'
                            ? 'bg-emerald-200 text-emerald-950'
                            : 'bg-amber-300 text-stone-950'
                        }`}
                      >
                        {d.estado === 'APROBADO_ABOGADO' ? `✓ Verificado por ${d.aprobado_por}` : '⚠️ Requiere Verificación del Abogado'}
                      </span>
                    </div>

                    <p className="text-stone-700 font-medium">
                      <strong>Causa detectada en la imagen:</strong> {d.motivo_duda}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => aprobarLindero(d.id, d.lectura_modelo_a)}
                        className="cursor-pointer p-3 rounded-xl border-2 border-purple-800 bg-purple-50 hover:bg-purple-100 transition space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-950">🧠 Modelo 1: Gemini 3.8 Flash Vision</span>
                          <span className="px-1.5 py-0.5 bg-purple-900 text-white rounded text-[10px] font-bold">
                            {d.confianza_a}% certeza
                          </span>
                        </div>
                        <div className="mono font-bold text-stone-900 text-xs">{d.lectura_modelo_a}</div>
                        <p className="text-[11px] text-purple-900 leading-snug">{d.argumento_a}</p>
                        <div className="pt-1 text-[11px] font-bold text-purple-800 underline">
                          Clic para aprobar esta lectura
                        </div>
                      </div>

                      <div
                        onClick={() => aprobarLindero(d.id, d.lectura_modelo_b)}
                        className="cursor-pointer p-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 transition space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-800">👁️ Modelo 2: Contraste Independiente</span>
                          <span className="px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded text-[10px] font-bold">
                            {d.confianza_b}% certeza
                          </span>
                        </div>
                        <div className="mono font-bold text-stone-900 text-xs">{d.lectura_modelo_b}</div>
                        <p className="text-[11px] text-stone-600 leading-snug">{d.argumento_b}</p>
                        <div className="pt-1 text-[11px] font-semibold text-stone-600 underline">
                          Clic para elegir esta lectura
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-semibold text-stone-700">Valor final en Minuta:</span>
                      <input
                        type="text"
                        value={d.valor_seleccionado}
                        onChange={(e) => aprobarLindero(d.id, e.target.value)}
                        className="flex-1 border border-stone-300 rounded-lg px-2.5 py-1 mono text-xs bg-white"
                      />
                      <button
                        onClick={() => aprobarLindero(d.id, d.valor_seleccionado)}
                        className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-bold"
                      >
                        Aprobar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VISTA 3: CONFIGURADOR DINÁMICO NOSQL (TRÁMITES, CATEGORÍAS, VENCIMIENTOS)
           ===================================================================== */}
        {vistaActiva === 'ADMIN_NOSQL' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-stone-300 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-4 mb-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                    Alimentación Dinámica desde la Aplicación hacia Base NoSQL (Cloud Firestore / PostgreSQL 18 JSONB)
                  </span>
                  <h2 className="text-xl font-bold text-stone-900">
                    Parametrizador de Trámites, Categorías Modificadoras, Documentos y Reglas de Vencimiento
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COLUMNA 1: CATEGORÍAS DINÁMICAS DEL TRÁMITE */}
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-stone-900">
                    1. Categorías que alteran el Trámite y la Minuta ({catalogo.categorias.length} activas)
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {catalogo.categorias.map((c: any) => (
                      <div key={c.categoria_id} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-950">{c.nombre}</span>
                          <span className="mono text-[10px] px-2 py-0.5 bg-purple-100 text-purple-900 rounded">{c.categoria_id}</span>
                        </div>
                        <p className="text-stone-600"><strong>Pregunta del Agente:</strong> {c.pregunta_agente}</p>
                        <p className="text-stone-600"><strong>Impacto en Minuta:</strong> {c.impacto_minuta}</p>
                      </div>
                    ))}
                  </div>

                  {/* Formulario para agregar nueva categoría en caliente */}
                  <form onSubmit={guardarNuevaCategoriaNoSQL} className="p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 space-y-3 text-xs">
                    <div className="font-bold text-purple-950">+ Agregar Nueva Categoría Dinámica al Trámite</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Nombre (ej. Venta con Usufructo o Apoderado)"
                        value={nuevaCatNombre}
                        onChange={(e) => setNuevaCatNombre(e.target.value)}
                        className="border border-stone-300 rounded-lg px-3 py-2 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Documento exigido (ej. PODER_ESPECIAL)"
                        value={nuevaCatDoc}
                        onChange={(e) => setNuevaCatDoc(e.target.value)}
                        className="border border-stone-300 rounded-lg px-3 py-2 bg-white"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Pregunta que debe hacer el Agente al Abogado..."
                      value={nuevaCatPregunta}
                      onChange={(e) => setNuevaCatPregunta(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Cláusula que modifica en la Minuta (ej. CLÁUSULA DE RESERVA DE USUFRUCTO)"
                      value={nuevaCatClausula}
                      onChange={(e) => setNuevaCatClausula(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                    <button type="submit" className="px-4 py-2 bg-purple-900 text-white font-bold rounded-lg">
                      Guardar Categoría en Base NoSQL
                    </button>
                  </form>
                </div>

                {/* COLUMNA 2: DOCUMENTOS, ESTILO (FIJO/VARIABLE), VENCIMIENTOS Y CAMPOS A EXTRAER */}
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-stone-900">
                    2. Reglas de Documentos, Vencimientos y Campos a Extraer ({catalogo.documentos_reglas.length} configurados)
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {catalogo.documentos_reglas.map((d: any) => (
                      <div key={d.codigo} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-stone-900">{d.nombre}</span>
                          <div className="flex gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-stone-200 text-stone-800 font-bold text-[10px]">
                              {d.estilo_estructura}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                              {d.regla_vencimiento}
                            </span>
                          </div>
                        </div>
                        <p className="text-stone-600">{d.descripcion_regla}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {d.campos_extraer.map((campo: string) => (
                            <span key={campo} className="mono text-[10px] px-2 py-0.5 bg-white border border-stone-300 rounded">
                              {campo}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Formulario para agregar nuevo documento y su regla de vencimiento */}
                  <form onSubmit={guardarNuevaReglaDocNoSQL} className="p-4 rounded-xl border-2 border-teal-200 bg-teal-50/50 space-y-3 text-xs">
                    <div className="font-bold text-teal-950">+ Configurar Nuevo Documento, Vencimiento y Extracción IA</div>
                    <input
                      type="text"
                      placeholder="Nombre del Documento (ej. Paz y Salvo Administración / Carta Leasing)"
                      value={docNombre}
                      onChange={(e) => setDocNombre(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-stone-600 mb-1">¿El formato cambia o es fijo?</label>
                        <select
                          value={docEstilo}
                          onChange={(e) => setDocEstilo(e.target.value as any)}
                          className="w-full border border-stone-300 rounded-lg px-2.5 py-2 bg-white font-semibold"
                        >
                          <option value="FIJO">FIJO (Ej. Cédula, Tradición)</option>
                          <option value="VARIABLE">VARIABLE (Ej. Paz y Salvo Admin, Minuta)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-stone-600 mb-1">Regla de Vencimiento y Alerta:</label>
                        <select
                          value={docVigencia}
                          onChange={(e) => setDocVigencia(e.target.value as any)}
                          className="w-full border border-stone-300 rounded-lg px-2.5 py-2 bg-white font-semibold"
                        >
                          <option value="FIN_DE_MES_ACTUAL">Vence el último día del mes (Alerta &le; 5 días)</option>
                          <option value="MAX_90_DIAS">Menor a 3 meses (90 días)</option>
                          <option value="MAX_30_DIAS">Menor a 30 días</option>
                          <option value="SIN_VENCIMIENTO">Sin vencimiento (Permanente)</option>
                        </select>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Campos que debe extraer Gemini 3.8 (separados por coma)"
                      value={docCampos}
                      onChange={(e) => setDocCampos(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white mono"
                    />
                    <button type="submit" className="px-4 py-2 bg-teal-900 text-white font-bold rounded-lg">
                      Guardar Regla de Documento en NoSQL
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VISTA 4: PORTAL DINÁMICO DE CONSTRUCTORAS (BLOQUES, APTOS, ESTADOS)
           ===================================================================== */}
        {vistaActiva === 'CONSTRUCTORA' && proyectoActual && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-stone-300 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold serif text-stone-900">{proyectoActual.nombre_proyecto}</h2>
                  <select
                    value={proySeleccionadoIdx}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setProySeleccionadoIdx(idx);
                      setUnidadSeleccionada(store.proyectos_constructoras[idx]?.unidades?.[0] || null);
                    }}
                    className="border border-stone-300 rounded-lg px-3 py-1 text-xs font-bold bg-stone-50"
                  >
                    {store.proyectos_constructoras.map((p: any, idx: number) => (
                      <option key={p.proyecto_id} value={idx}>
                        Cambiar Proyecto: {p.nombre_proyecto}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-stone-600 mt-1">
                  {proyectoActual.constructora} · NIT {proyectoActual.nit} · {proyectoActual.direccion} ·{' '}
                  <strong>{proyectoActual.bloques_configurados.length} bloques/torres</strong> ·{' '}
                  <strong>{proyectoActual.unidades.length} apartamentos</strong>
                </p>
              </div>
              <button
                onClick={() => setMostrarModalProy(!mostrarModalProy)}
                className="px-4 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold shadow-sm"
              >
                + Crear Nuevo Proyecto Dinámico de Constructora
              </button>
            </div>

            {/* Modal / Panel para crear un Proyecto de Constructora con N bloques y M apartamentos */}
            {mostrarModalProy && (
              <form
                onSubmit={crearProyectoConstructora}
                className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-5 space-y-4 text-xs shadow-sm"
              >
                <div className="font-bold text-sm text-purple-950">
                  Crear Proyecto Inmobiliario Dinámico en Base NoSQL (Bloques, Apartamentos por Bloque, Tipos y Estados)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Nombre del Proyecto:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Parque Central Reservado"
                      value={nuevoProyNombre}
                      onChange={(e) => setNuevoProyNombre(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Constructora:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Constructora Bolívar S.A."
                      value={nuevoProyConstructora}
                      onChange={(e) => setNuevoProyConstructora(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Cantidad de Bloques / Torres:</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={nuevoProyBloques}
                      onChange={(e) => setNuevoProyBloques(Number(e.target.value))}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Apartamentos por Bloque:</label>
                    <input
                      type="number"
                      min={2}
                      max={16}
                      value={nuevoProyAptos}
                      onChange={(e) => setNuevoProyAptos(Number(e.target.value))}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarModalProy(false)}
                    className="px-4 py-2 rounded-lg border border-stone-300 bg-white font-semibold"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-5 py-2 rounded-lg bg-purple-900 text-white font-bold">
                    Generar Matriz de Bloques y Apartamentos
                  </button>
                </div>
              </form>
            )}

            {/* KPIs del Proyecto (Fiel al Mockup 31-constructora-unidad.png) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-[11px] uppercase text-stone-500 font-bold">Unidades Vendidas</div>
                <div className="text-3xl font-extrabold text-purple-900 mt-1">
                  {proyectoActual.unidades.filter((u: any) => u.estado_dinamico !== 'Sin comprador').length}/{proyectoActual.unidades.length}
                </div>
                <div className="text-xs text-stone-500 mt-1">En proceso de escrituración</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-[11px] uppercase text-stone-500 font-bold">Minutas Firmadas / Registradas</div>
                <div className="text-3xl font-extrabold text-emerald-700 mt-1">
                  {proyectoActual.unidades.filter((u: any) => u.minuta_firmada).length}
                </div>
                <div className="text-xs text-stone-500 mt-1">Otorgadas en la Notaría</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-[11px] uppercase text-stone-500 font-bold">Frenadas por Documentos / Alertas</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">
                  {proyectoActual.unidades.filter((u: any) => u.estado_dinamico === 'Documentos pendientes' || u.tiene_alerta_vencimiento).length}
                </div>
                <div className="text-xs text-stone-500 mt-1">Faltan soportes o vencen a fin de mes</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-[11px] uppercase text-stone-500 font-bold">Disponibles (Sin Comprador)</div>
                <div className="text-3xl font-extrabold text-stone-800 mt-1">
                  {proyectoActual.unidades.filter((u: any) => u.estado_dinamico === 'Sin comprador').length}
                </div>
                <div className="text-xs text-stone-500 mt-1">Listas para vincular comprador</div>
              </div>
            </div>

            {/* Matriz Visual por Torres/Bloques + Panel de Detalle de la Unidad Seleccionada */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Grilla de Bloques/Torres (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-300 p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-base serif text-stone-900">Plano de Ventas y Estados por Torre / Bloque</h3>
                  <p className="text-xs text-stone-500">Haz clic en cualquier apartamento para gestionar sus documentos, alertas y estado de firma.</p>
                </div>

                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${proyectoActual.bloques_configurados.length}, minmax(0, 1fr))`
                  }}
                >
                  {proyectoActual.bloques_configurados.map((bloque: string) => (
                    <div key={bloque} className="space-y-2">
                      <div className="text-center font-bold text-xs uppercase tracking-wider text-stone-600 py-1 bg-stone-100 rounded-lg">
                        {bloque}
                      </div>
                      {proyectoActual.unidades
                        .filter((u: any) => u.bloque === bloque)
                        .slice()
                        .reverse()
                        .map((u: any) => {
                          let bgClass = 'bg-stone-100 border-stone-300 text-stone-700';
                          if (u.estado_dinamico === 'Registrada' || u.estado_dinamico === 'Firmada') {
                            bgClass = 'bg-emerald-800 border-emerald-900 text-white';
                          } else if (u.estado_dinamico === 'Minuta lista / Visto bueno' || u.estado_dinamico === 'En impresión') {
                            bgClass = 'bg-purple-900 border-purple-950 text-white';
                          } else if (u.estado_dinamico === 'En verificación IA') {
                            bgClass = 'bg-indigo-100 border-indigo-300 text-indigo-950';
                          } else if (u.estado_dinamico === 'Documentos pendientes') {
                            bgClass = 'bg-amber-100 border-amber-400 text-amber-950';
                          }
                          const isSelected = unidadSeleccionada?.unidad_id === u.unidad_id;
                          return (
                            <button
                              key={u.unidad_id}
                              onClick={() => setUnidadSeleccionada(u)}
                              className={`w-full p-2.5 rounded-xl border-2 text-center transition relative ${bgClass} ${
                                isSelected ? 'ring-2 ring-offset-2 ring-purple-900' : ''
                              }`}
                            >
                              {u.tiene_alerta_vencimiento && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                              )}
                              <div className="font-bold text-xs">{u.apartamento}</div>
                              <div className="text-[10px] opacity-80">{u.area_m2} m²</div>
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Detalle Lateral del Apartamento Seleccionado (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-300 p-5 shadow-sm space-y-4 text-xs">
                {unidadSeleccionada ? (
                  <>
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-purple-800">{unidadSeleccionada.bloque}</span>
                        <h3 className="text-lg font-bold serif text-stone-900">
                          Apartamento {unidadSeleccionada.unidad_id}
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold">
                        {unidadSeleccionada.estado_dinamico}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase">Área Privada</div>
                        <div className="font-bold text-stone-900">{unidadSeleccionada.area_m2} m² ({unidadSeleccionada.tipo_apto})</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase">Valor Unidad</div>
                        <div className="font-bold text-stone-900 mono">${Number(unidadSeleccionada.valor_venta).toLocaleString('es-CO')}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase">Comprador Asignado</div>
                        <div className="font-bold text-stone-900">{unidadSeleccionada.comprador_nombre || 'Sin asignar'}</div>
                        <div className="text-[10px] text-stone-500">{unidadSeleccionada.comprador_cc ? `C.C. ${unidadSeleccionada.comprador_cc}` : ''}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase">Modalidad / Categoría</div>
                        <div className="font-bold text-stone-900">{unidadSeleccionada.forma_pago || 'Por definir'}</div>
                      </div>
                    </div>

                    {unidadSeleccionada.tiene_alerta_vencimiento && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 font-semibold">
                        🚨 Alerta Activa: {unidadSeleccionada.alerta_detalle}
                      </div>
                    )}

                    {/* Cambio de Estado Dinámico */}
                    <div>
                      <label className="block font-bold text-stone-800 mb-1">
                        Cambiar Estado Dinámico del Trámite de este Apartamento:
                      </label>
                      <select
                        value={unidadSeleccionada.estado_dinamico}
                        onChange={(e) => {
                          const nuevo = e.target.value;
                          setUnidadSeleccionada({ ...unidadSeleccionada, estado_dinamico: nuevo });
                          cambiarEstadoUnidadConstructora(proyectoActual.proyecto_id, unidadSeleccionada.unidad_id, nuevo);
                        }}
                        className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white font-bold text-purple-950"
                      >
                        {proyectoActual.estados_personalizados.map((est: string) => (
                          <option key={est} value={est}>
                            {est}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Checklist de Documentos Heredados del Proyecto Matriz + Individuales */}
                    <div className="space-y-2 pt-2">
                      <div className="font-bold text-stone-900">
                        Checklist de Escrituración ({unidadSeleccionada.documentos_recibidos} de {unidadSeleccionada.documentos_totales} documentos listos)
                      </div>
                      {proyectoActual.documentos_matriz_heredables.map((dm: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-stone-900">{dm.nombre}</div>
                            <div className="text-[10px] text-emerald-800">Heredado automáticamente del Proyecto Matriz · {dm.vigencia}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-950 font-bold text-[10px]">Heredado OK</span>
                        </div>
                      ))}
                      <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
                        <span>Cédula del Comprador + Carta Aprobación Crédito/Leasing</span>
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">
                          {unidadSeleccionada.documentos_recibidos >= 5 ? 'Cargado' : 'Pendiente'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
                        <span>Paz y Salvo de Administración (Mes de Firma)</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          Regla Fin de Mes
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setVistaActiva('ABOGADO_COPILOTO')}
                      className="w-full py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold shadow-sm"
                    >
                      Abrir Caso en el Copiloto del Abogado
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VISTA 5: PORTAL CLIENTE / CELULAR (390px) - AVISOS Y VISTO BUENO
           ===================================================================== */}
        {vistaActiva === 'CLIENTE_CELULAR' && (
          <div className="flex flex-col items-center py-4">
            <div className="w-[395px] bg-stone-950 rounded-[42px] p-3.5 shadow-2xl border-4 border-stone-800">
              <div className="bg-[#f7f6f2] rounded-[32px] overflow-hidden min-h-[700px] flex flex-col">
                <div className="bg-white px-5 py-3.5 border-b border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-purple-950 text-white flex items-center justify-center font-bold text-xs">+</span>
                    <span className="serif font-bold text-sm text-stone-900">Notaría 33 Bogotá</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-900 text-white text-[10px] font-bold">
                    🔔 2 Avisos
                  </span>
                </div>

                <div className="p-5 space-y-4 text-xs flex-1 overflow-y-auto">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-purple-900">Portal del Cliente (Vendedor / Comprador)</span>
                    <h3 className="text-lg font-bold text-stone-900">{caso.radicado}</h3>
                    <p className="text-stone-600">{caso.inmueble.direccion}</p>
                  </div>

                  {/* Alerta Fin de Mes en el Celular del Cliente */}
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-950 space-y-1">
                    <div className="font-bold">🚨 Alerta de Vencimiento (5 días):</div>
                    <p className="text-[11px]">
                      El Paz y Salvo de Administración vence el <strong>30 de noviembre</strong>. Debemos dar Visto Bueno y firmar antes de fin de mes.
                    </p>
                  </div>

                  {/* Acción 1: Subir Cédula Faltante */}
                  <div className="p-4 rounded-xl bg-white border border-stone-200 space-y-2">
                    <div className="font-bold text-stone-900">1. Documentos de Identidad</div>
                    <p className="text-stone-600 text-[11px]">
                      Estado de la Cédula de Mónica Patricia Pérez (C.C. 52.110.900):{' '}
                      <strong>{caso.partes[1]?.cedula_cargada ? '✓ Cargada y Verificada' : '❌ Pendiente por subir'}</strong>
                    </p>
                    {!caso.partes[1]?.cedula_cargada && (
                      <button
                        onClick={() => enviarMensajeAgente({ subir_cedula_monica: true, mensaje: 'Cliente subió desde el celular la cédula de Mónica Pérez.' })}
                        className="w-full py-2 rounded-lg bg-purple-900 text-white font-bold"
                      >
                        📷 Subir Foto / PDF de Cédula Ahora
                      </button>
                    )}
                  </div>

                  {/* Acción 2: Visto Bueno Digital del Borrador de la Minuta */}
                  <div className="p-4 rounded-xl bg-white border-2 border-purple-800 space-y-2.5">
                    <div className="font-bold text-purple-950">2. Visto Bueno del Borrador de la Escritura</div>
                    <p className="text-stone-600 text-[11px]">
                      El abogado ya revisó los linderos y liquidación. Confirma que tus nombres, número de cédula, estado civil, declaración PEP y precio de venta (${Number(caso.negocio.valor_venta).toLocaleString('es-CO')}) son correctos para pasar a impresión en papel notarial.
                    </p>
                    <button
                      onClick={() => avanzarFlujo('VISTO_BUENO_CLIENTES')}
                      className={`w-full py-2.5 rounded-xl font-bold ${
                        caso.aprobaciones.visto_bueno_vendedores
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow'
                      }`}
                    >
                      {caso.aprobaciones.visto_bueno_vendedores
                        ? '✓ Visto Bueno Otorgado · Listo para Impresión'
                        : '✓ Doy Visto Bueno al Borrador para Impresión'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VISTA 6: TABLERO DEL JEFE JURÍDICO Y REPARTO (MOCKUP 09-JEFE.PNG)
           ===================================================================== */}
        {vistaActiva === 'JEFE_REPARTO' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-xs font-bold uppercase text-stone-500">Casos Activos</div>
                <div className="text-3xl font-extrabold text-purple-900 mt-1">18</div>
                <div className="text-xs text-stone-500 mt-1">Tiempo promedio: 1.8 horas por minuta</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-xs font-bold uppercase text-stone-500">Alertas Fin de Mes (Paz y Salvo)</div>
                <div className="text-3xl font-extrabold text-red-700 mt-1">4</div>
                <div className="text-xs text-stone-500 mt-1">Quedan &le; 5 días para cierre de mes</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-xs font-bold uppercase text-stone-500">Precisión Consenso Doble IA</div>
                <div className="text-3xl font-extrabold text-emerald-700 mt-1">97.4%</div>
                <div className="text-xs text-stone-500 mt-1">Gemini 3.8 Flash Vision + Contraste</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="text-xs font-bold uppercase text-stone-500">En Cola de Impresión Hoy</div>
                <div className="text-3xl font-extrabold text-teal-800 mt-1">9</div>
                <div className="text-xs text-stone-500 mt-1">Con visto bueno de abogado y clientes</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-300 p-6 shadow-sm space-y-3 text-xs">
              <h3 className="text-base font-bold serif text-stone-900">Reparto y Control de SLAs por Abogado</h3>
              <div className="divide-y divide-stone-200">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-stone-900">{caso.radicado}</span> · {caso.tramite_nombre}
                    <p className="text-stone-500">Abogado: {caso.abogado_asignado} · Etapa: {caso.etapa_actual}</p>
                  </div>
                  <button
                    onClick={() => setVistaActiva('ABOGADO_COPILOTO')}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 font-bold hover:bg-stone-100"
                  >
                    Inspeccionar Caso
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
