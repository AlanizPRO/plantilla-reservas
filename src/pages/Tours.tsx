import { addDoc, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { useState } from 'react'
import { Hoja, Vacio } from '../componentes'
import { col, dinero, mensajeError, type Tour } from '../datos'
import { db } from '../firebase'
import { prepararFoto } from '../fotos'
import { ICONOS } from '../iconos'
import { T } from '../textos'
import type { Contexto } from './Agencia'

export default function Tours({ ctx, nuevo: abrirNuevo }: { ctx: Contexto; nuevo?: boolean }) {
  const [editar, setEditar] = useState<Tour | 'nuevo' | null>(abrirNuevo ? 'nuevo' : null)
  const m = ctx.ajustes.moneda
  return (
    <section className="pantalla">
      <div className="top">
        <div><h1>{T.Servicios}</h1><p className="suave">Lo que ofreces. Cada {T.servicio} puede tener muchas {T.salidas}.</p></div>
        <button className="btn btn-principal" onClick={() => setEditar('nuevo')}>+ Nuevo</button>
      </div>
      {ctx.tours.length === 0 && <Vacio>Todavía no hay {T.servicios}. Toca "+ Nuevo" y agrégalo con foto, precio y qué incluye.</Vacio>}
      <div className="rejilla">
        {ctx.tours.map((t) => (
          <button key={t.id} className="tarjeta" onClick={() => setEditar(t)}>
            {t.miniatura ? <img src={t.miniatura} alt="" /> : <span className="sin-foto">{ICONOS.tours}</span>}
            <b>{t.nombre}</b>
            <small>{dinero(t.precioAdulto, m)}{t.precioNino ? ` · niño ${dinero(t.precioNino, m)}` : ''}</small>
            <span className={`pill ${t.activo === false ? 'p-gris' : 'p-verde'}`}>{t.activo === false ? 'Pausado' : t.destino || 'Activo'}</span>
          </button>
        ))}
      </div>
      {editar && <FormTour ctx={ctx} t={editar === 'nuevo' ? undefined : editar} onCerrar={() => setEditar(null)} />}
    </section>
  )
}

type FotoNueva = { grande: string; miniatura: string }

function FormTour({ ctx, t, onCerrar }: { ctx: Contexto; t?: Tour; onCerrar: () => void }) {
  const [f, setF] = useState({
    nombre: t?.nombre ?? '', destino: t?.destino ?? '', descripcion: t?.descripcion ?? '', incluye: t?.incluye ?? '', llevar: t?.llevar ?? '',
    puntoSalida: t?.puntoSalida ?? '', horaSalida: t?.horaSalida ?? '', duracion: t?.duracion ?? '',
    precioAdulto: t ? String(t.precioAdulto) : '', precioNino: t ? String(t.precioNino || '') : '',
  })
  const [activo, setActivo] = useState(t?.activo !== false)
  const [fotosViejas, setFotosViejas] = useState<string[]>(t?.fotos ?? [])
  const [fotosNuevas, setFotosNuevas] = useState<FotoNueva[]>([])
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const poner = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const usado = !!t && ctx.salidas.some((s) => s.tourId === t.id)

  async function agregarFotos(archivos: FileList | null) {
    if (!archivos?.length) return
    setProcesando(true); setError('')
    try {
      const listas: FotoNueva[] = []
      for (const a of Array.from(archivos).slice(0, 6)) listas.push(await prepararFoto(a))
      setFotosNuevas((x) => [...x, ...listas].slice(0, 6))
    } catch (e) { setError((e as Error).message) } finally { setProcesando(false) }
  }

  async function guardar() {
    if (!f.nombre.trim()) { setError('Ponle nombre.'); return }
    if (!(Number(f.precioAdulto) > 0)) { setError('Escribe el precio por persona.'); return }
    setGuardando(true); setError('')
    try {
      const ref = t ? doc(db, 'tours', t.id) : doc(col('tours'))
      const idsNuevos: string[] = []
      for (const foto of fotosNuevas) idsNuevos.push((await addDoc(col('fotos'), { datos: foto.grande, tourId: ref.id })).id)
      for (const id of (t?.fotos ?? []).filter((x) => !fotosViejas.includes(x))) await deleteDoc(doc(db, 'fotos', id))
      const datos = {
        nombre: f.nombre.trim(), destino: f.destino.trim(), descripcion: f.descripcion.trim(), incluye: f.incluye.trim(), llevar: f.llevar.trim(),
        puntoSalida: f.puntoSalida.trim(), horaSalida: f.horaSalida, duracion: f.duracion.trim(),
        precioAdulto: Number(f.precioAdulto), precioNino: Number(f.precioNino) || 0, activo,
        fotos: [...fotosViejas, ...idsNuevos],
        miniatura: fotosViejas.length ? t?.miniatura ?? '' : fotosNuevas[0]?.miniatura ?? '',
        actualizado: serverTimestamp(),
      }
      if (t) await updateDoc(ref, datos)
      else await setDoc(ref, datos)
      onCerrar()
    } catch (e) { setError(mensajeError(e)); setGuardando(false) }
  }
  async function borrar() {
    if (!t || !confirm(`¿Borrar ${t.nombre}?`)) return
    try {
      for (const id of t.fotos ?? []) await deleteDoc(doc(db, 'fotos', id))
      await deleteDoc(doc(db, 'tours', t.id)); onCerrar()
    } catch (e) { setError(mensajeError(e)) }
  }

  return (
    <Hoja titulo={t ? `Editar ${t.nombre}` : T.nuevoServicio} onCerrar={onCerrar}>
      <div className="fotos-form">
        {fotosViejas.map((id, i) => (
          <div key={id} className="foto-mini"><span className="suave chico">Foto {i + 1}</span>
            <button aria-label="Quitar foto" onClick={() => setFotosViejas((x) => x.filter((y) => y !== id))}>×</button></div>
        ))}
        {fotosNuevas.map((foto, i) => (
          <div key={i} className="foto-mini"><img src={foto.miniatura} alt="" />
            <button aria-label="Quitar foto" onClick={() => setFotosNuevas((x) => x.filter((_, j) => j !== i))}>×</button></div>
        ))}
        {fotosViejas.length + fotosNuevas.length < 6 && (
          <label className="foto-mini agregar" htmlFor="t-fotos">{procesando ? '…' : ICONOS.camara}<span>Foto</span>
            <input id="t-fotos" type="file" accept="image/*" multiple hidden onChange={(e) => { agregarFotos(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
      <div className="campos">
        <label className="campo" htmlFor="t-nombre">Nombre *<input id="t-nombre" value={f.nombre} onChange={(e) => poner('nombre', e.target.value)} placeholder="Ej. Isla de Ometepe full day" /></label>
        <label className="campo" htmlFor="t-destino">Destino<input id="t-destino" value={f.destino} onChange={(e) => poner('destino', e.target.value)} placeholder="Ej. Rivas" /></label>
        <label className="campo" htmlFor="t-adulto">Precio por persona *<input id="t-adulto" type="number" inputMode="decimal" min={0} value={f.precioAdulto} onChange={(e) => poner('precioAdulto', e.target.value)} /></label>
        <label className="campo" htmlFor="t-nino">Precio niño (0 = igual)<input id="t-nino" type="number" inputMode="decimal" min={0} value={f.precioNino} onChange={(e) => poner('precioNino', e.target.value)} /></label>
        <label className="campo" htmlFor="t-punto">Punto de salida<input id="t-punto" value={f.puntoSalida} onChange={(e) => poner('puntoSalida', e.target.value)} placeholder="Ej. Metrocentro, Managua" /></label>
        <label className="campo" htmlFor="t-hora">Hora de salida<input id="t-hora" type="time" value={f.horaSalida} onChange={(e) => poner('horaSalida', e.target.value)} /></label>
        <label className="campo" htmlFor="t-dur">Duración<input id="t-dur" value={f.duracion} onChange={(e) => poner('duracion', e.target.value)} placeholder="Ej. 1 día, 2 días y 1 noche" /></label>
      </div>
      <label className="campo" htmlFor="t-desc">Descripción (la ve el cliente)<textarea id="t-desc" value={f.descripcion} onChange={(e) => poner('descripcion', e.target.value)} /></label>
      <label className="campo" htmlFor="t-inc">Qué incluye<textarea id="t-inc" value={f.incluye} onChange={(e) => poner('incluye', e.target.value)} placeholder="Ej. Transporte, ferry, almuerzo, guía y entradas" /></label>
      <label className="campo" htmlFor="t-llevar">Qué llevar<textarea id="t-llevar" value={f.llevar} onChange={(e) => poner('llevar', e.target.value)} placeholder="Ej. Ropa cómoda, bloqueador, repelente, cédula" /></label>
      <label className="check"><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />Activo (se pueden crear {T.salidas})</label>
      {error && <p className="error">{error}</p>}
      <div className="fila">
        <button className="btn btn-principal" disabled={guardando || procesando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        {t && !usado && <button className="btn btn-rosa" onClick={borrar}>Borrar</button>}
      </div>
    </Hoja>
  )
}
