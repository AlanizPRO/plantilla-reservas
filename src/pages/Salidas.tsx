import { deleteDoc, doc, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { useState } from 'react'
import { Hoja, Vacio } from '../componentes'
import {
  aInputFecha, anticipoDe, col, deInputFecha, dinero, enlaceWhatsApp, ESTADOS_RESERVA, ESTADOS_SALIDA, fechaCorta, fechaLarga,
  libres, mensajeError, saldo, useDoc, useLista, type EstadoSalida, type LineaCosto, type Reserva, type Salida,
} from '../datos'
import { db } from '../firebase'
import { FormReserva } from '../formReserva'
import { ICONOS } from '../iconos'
import { cancelarReserva, crearReserva, registrarPago, SinCupo, venceEl } from '../reservar'
import { T } from '../textos'
import type { Contexto } from './Agencia'

const enlaceSalida = (id: string) => `${location.origin}/s/${id}`
const enlaceReserva = (codigo: string) => `${location.origin}/r/${codigo}`

// accion: '' | 'nueva' | 'salida:ID' | 'reserva:SALIDA:RESERVA'
export default function Salidas({ ctx, accion }: { ctx: Contexto; accion: string }) {
  const [tipo, a, b] = accion.split(':')
  const [abierta, setAbierta] = useState<string | null>(tipo === 'salida' || tipo === 'reserva' ? a : null)
  const [form, setForm] = useState<Salida | 'nueva' | null>(tipo === 'nueva' && ctx.admin ? 'nueva' : null)
  const [verPasadas, setVerPasadas] = useState(false)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const salida = abierta ? ctx.salidas.find((s) => s.id === abierta) : undefined

  if (salida) return <DetalleSalida ctx={ctx} s={salida} reservaInicial={tipo === 'reserva' ? b : undefined} onVolver={() => setAbierta(null)} />

  const mias = (s: Salida) => ctx.rol !== 'guia' || !s.guiaUid || s.guiaUid === ctx.uid
  const proximas = ctx.salidas.filter((s) => s.fecha.toMillis() >= +hoy && mias(s))
  const pasadas = ctx.salidas.filter((s) => s.fecha.toMillis() < +hoy && mias(s)).reverse()
  const lista = verPasadas ? pasadas : proximas

  return (
    <section className="pantalla">
      <div className="top">
        <div><h1>{T.Salidas}</h1><p className="suave">{ctx.rol === 'guia' ? `Las ${T.salidas} que te tocan.` : `Fechas con cupo. Comparte el enlace y reservan solos.`}</p></div>
        {ctx.admin && <button className="btn btn-principal" onClick={() => setForm('nueva')} disabled={!ctx.tours.length}>+ {T.Salida}</button>}
      </div>
      {ctx.admin && !ctx.tours.length && <p className="aviso">Primero agrega un {T.servicio} en la pestaña {T.Servicios}.</p>}
      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={!verPasadas} onClick={() => setVerPasadas(false)}>{T.proximas} ({proximas.length})</button>
        <button className="tab" role="tab" aria-selected={verPasadas} onClick={() => setVerPasadas(true)}>Pasadas</button>
      </div>
      {lista.length === 0 && <Vacio>{verPasadas ? `No hay ${T.salidas} en los últimos 60 días.` : `No hay ${T.salidas} próximas.`}</Vacio>}
      <div className="lista">
        {lista.map((s) => {
          const [est, color] = ESTADOS_SALIDA[s.estado]
          return (
            <button key={s.id} className="fila-item" onClick={() => setAbierta(s.id)}>
              {s.tour.miniatura ? <img className="mini" src={s.tour.miniatura} alt="" /> : <span className="ini">{s.fecha.toDate().getDate()}</span>}
              <div><b>{s.tour.nombre}</b>
                <small>{fechaLarga(s.fecha.toDate())} · {s.ocupados} de {s.cupo}{s.guiaNombre ? ` · ${T.guia}: ${s.guiaNombre.split(' ')[0]}` : ''}</small>
                <div className="barra-cupo"><span style={{ width: `${Math.min(100, (s.ocupados / Math.max(1, s.cupo)) * 100)}%` }} /></div></div>
              <span className={`pill ${s.estado === 'abierta' && libres(s) === 0 ? 'p-rosa' : color}`}>{s.estado === 'abierta' && libres(s) === 0 ? 'Lleno' : est}</span>
            </button>
          )
        })}
      </div>
      {form && <FormSalida ctx={ctx} s={form === 'nueva' ? undefined : form} onCerrar={(id) => { setForm(null); if (id) setAbierta(id) }} />}
    </section>
  )
}

// ---------- Crear o editar una salida (solo el dueño) ----------
type Guia = { id: string; nombre: string; rol: string; activo?: boolean }

function FormSalida({ ctx, s, onCerrar }: { ctx: Contexto; s?: Salida; onCerrar: (id?: string) => void }) {
  const guias = (useLista<Guia>(query(col('usuarios'), where('rol', '==', 'guia'))) ?? []).filter((g) => g.activo !== false)
  const activos = ctx.tours.filter((t) => t.activo !== false || t.id === s?.tourId)
  const manana = new Date(); manana.setDate(manana.getDate() + 1)
  const [f, setF] = useState({
    tourId: s?.tourId ?? activos[0]?.id ?? '',
    fecha: aInputFecha(s ? s.fecha.toDate() : manana),
    cupo: String(s?.cupo ?? 20), minimo: String(s?.minimo ?? 0),
    precioAdulto: String(s?.precioAdulto ?? activos[0]?.precioAdulto ?? ''),
    precioNino: String(s?.precioNino ?? activos[0]?.precioNino ?? 0),
    anticipoPct: String(s?.anticipoPct ?? ctx.ajustes.anticipoPct),
    guiaUid: s?.guiaUid ?? '', nota: s?.nota ?? '',
  })
  const [publica, setPublica] = useState(s?.publica ?? true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const poner = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  function elegirTour(id: string) {
    const t = ctx.tours.find((x) => x.id === id)
    setF((x) => ({ ...x, tourId: id, ...(t ? { precioAdulto: String(t.precioAdulto), precioNino: String(t.precioNino || 0) } : {}) }))
  }

  async function guardar() {
    const t = ctx.tours.find((x) => x.id === f.tourId)
    if (!t) { setError(`Elige el ${T.servicio}.`); return }
    if (!f.fecha) { setError('Elige la fecha.'); return }
    const cupo = Math.round(Number(f.cupo))
    if (!(cupo > 0)) { setError('El cupo debe ser mayor que cero.'); return }
    if (s && cupo < s.ocupados) { setError(`Ya hay ${s.ocupados} reservados: el cupo no puede ser menor.`); return }
    if (!(Number(f.precioAdulto) > 0)) { setError('Escribe el precio por persona.'); return }
    setGuardando(true); setError('')
    const g = guias.find((x) => x.id === f.guiaUid)
    const datos = {
      tourId: t.id,
      tour: {
        nombre: t.nombre, destino: t.destino ?? '', descripcion: t.descripcion ?? '', incluye: t.incluye ?? '', llevar: t.llevar ?? '',
        puntoSalida: t.puntoSalida ?? '', horaSalida: t.horaSalida ?? '', duracion: t.duracion ?? '', miniatura: t.miniatura ?? '', fotos: t.fotos ?? [],
      },
      fecha: Timestamp.fromDate(deInputFecha(f.fecha)), cupo, minimo: Math.max(0, Math.round(Number(f.minimo) || 0)),
      precioAdulto: Number(f.precioAdulto), precioNino: Number(f.precioNino) || Number(f.precioAdulto),
      anticipoPct: Math.min(100, Math.max(0, Math.round(Number(f.anticipoPct) || 0))),
      publica, guiaUid: g?.id ?? '', guiaNombre: g?.nombre ?? '', nota: f.nota.trim(),
    }
    try {
      if (s) { await updateDoc(doc(db, 'salidas', s.id), datos); onCerrar() }
      else {
        const ref = doc(col('salidas'))
        await setDoc(ref, { ...datos, ocupados: 0, estado: 'abierta', ultimaReserva: '', creada: serverTimestamp() })
        onCerrar(ref.id)
      }
    } catch (e) { setError(mensajeError(e)); setGuardando(false) }
  }

  return (
    <Hoja titulo={s ? `Editar ${T.salida}` : T.nuevaSalida} onCerrar={() => onCerrar()}>
      <div className="campos">
        <label className="campo" htmlFor="s-tour">{T.Servicio} *
          <select id="s-tour" value={f.tourId} onChange={(e) => elegirTour(e.target.value)} disabled={!!s && s.ocupados > 0}>
            {activos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select></label>
        <label className="campo" htmlFor="s-fecha">Fecha *<input id="s-fecha" type="date" value={f.fecha} onChange={(e) => poner('fecha', e.target.value)} /></label>
        <label className="campo" htmlFor="s-cupo">Cupo (lugares) *<input id="s-cupo" type="number" inputMode="numeric" min={1} value={f.cupo} onChange={(e) => poner('cupo', e.target.value)} /></label>
        <label className="campo" htmlFor="s-min">Mínimo para salir<input id="s-min" type="number" inputMode="numeric" min={0} value={f.minimo} onChange={(e) => poner('minimo', e.target.value)} /></label>
        <label className="campo" htmlFor="s-pa">Precio por persona *<input id="s-pa" type="number" inputMode="decimal" min={0} value={f.precioAdulto} onChange={(e) => poner('precioAdulto', e.target.value)} /></label>
        <label className="campo" htmlFor="s-pn">Precio niño<input id="s-pn" type="number" inputMode="decimal" min={0} value={f.precioNino} onChange={(e) => poner('precioNino', e.target.value)} /></label>
        <label className="campo" htmlFor="s-ant">Anticipo para apartar (%)<input id="s-ant" type="number" inputMode="numeric" min={0} max={100} value={f.anticipoPct} onChange={(e) => poner('anticipoPct', e.target.value)} /></label>
        <label className="campo" htmlFor="s-guia">{T.Guia}
          <select id="s-guia" value={f.guiaUid} onChange={(e) => poner('guiaUid', e.target.value)}>
            <option value="">Sin asignar</option>
            {guias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select></label>
      </div>
      <label className="campo" htmlFor="s-nota">Nota para el cliente<textarea id="s-nota" value={f.nota} onChange={(e) => poner('nota', e.target.value)} placeholder="Ej. Salimos puntual. Llevar efectivo para el ferry." /></label>
      <label className="check"><input type="checkbox" checked={publica} onChange={(e) => setPublica(e.target.checked)} />Publicada: sale en la página de {T.salidas} y se puede reservar por enlace</label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-principal" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
    </Hoja>
  )
}

// ---------- Detalle de una salida ----------
function DetalleSalida({ ctx, s, reservaInicial, onVolver }: { ctx: Contexto; s: Salida; reservaInicial?: string; onVolver: () => void }) {
  const [verReserva, setVerReserva] = useState<string | null>(reservaInicial ?? null)
  const [nueva, setNueva] = useState(false)
  const [editar, setEditar] = useState(false)
  const [vista, setVista] = useState<'reservas' | 'lista' | 'cuentas'>(ctx.rol === 'guia' ? 'lista' : 'reservas')
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState('')
  const m = ctx.ajustes.moneda
  const todas = ctx.reservas.filter((r) => r.salidaId === s.id)
  const activas = todas.filter((r) => r.estado !== 'cancelada')
  const vendido = activas.reduce((n, r) => n + r.total, 0)
  const cobrado = activas.reduce((n, r) => n + (r.pagado || 0), 0)
  const reserva = verReserva ? todas.find((r) => r.id === verReserva) : undefined
  const [est, color] = ESTADOS_SALIDA[s.estado]
  const textoCompartir = `${s.tour.nombre} · ${fechaLarga(s.fecha.toDate())}\n${dinero(s.precioAdulto, m)} por persona. Quedan ${libres(s)} lugares.\nReserva aquí: ${enlaceSalida(s.id)}`

  async function cambiarEstado(estado: EstadoSalida) {
    const textos: Partial<Record<EstadoSalida, string>> = {
      cancelada: `¿Cancelar esta ${T.salida}? No se borran las reservas: avísales y devuelve lo pagado.`,
      cerrada: 'Ya no se podrán hacer reservas nuevas. ¿Cerrar?',
    }
    if (textos[estado] && !confirm(textos[estado])) return
    try { await updateDoc(doc(db, 'salidas', s.id), { estado }) } catch (e) { setError(mensajeError(e)) }
  }
  async function borrar() {
    if (todas.length) { setError('Tiene reservas: mejor cancélala.'); return }
    if (!confirm(`¿Borrar esta ${T.salida}?`)) return
    try { await deleteDoc(doc(db, 'salidas', s.id)); onVolver() } catch (e) { setError(mensajeError(e)) }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(enlaceSalida(s.id)); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { prompt('Copia el enlace:', enlaceSalida(s.id)) }
  }

  return (
    <section className="pantalla">
      <div className="fila no-imprimir"><button className="btn btn-borde btn-chico" onClick={onVolver}>‹ {T.Salidas}</button></div>
      <div className="top">
        <div><h1>{s.tour.nombre}</h1>
          <p className="suave">{fechaLarga(s.fecha.toDate())}{s.tour.horaSalida ? ` · ${s.tour.horaSalida}` : ''}{s.tour.puntoSalida ? ` · ${s.tour.puntoSalida}` : ''}</p>
          {s.guiaNombre && <p className="chico">{T.Guia}: <b>{s.guiaNombre}</b></p>}</div>
        <span className={`pill ${color}`}>{est}{!s.publica ? ' · privada' : ''}</span>
      </div>

      <div className="stats">
        <div className="stat"><b>{s.ocupados}/{s.cupo}</b><span>{T.personas}</span></div>
        <div className="stat"><b>{libres(s)}</b><span>libres</span></div>
        {ctx.rol !== 'guia' && <div className="stat"><b style={{ fontSize: '1.05rem' }}>{dinero(vendido - cobrado, m)}</b><span>por cobrar</span></div>}
      </div>
      <div className="barra-cupo"><span style={{ width: `${Math.min(100, (s.ocupados / Math.max(1, s.cupo)) * 100)}%` }} /></div>
      {s.minimo > 0 && s.ocupados < s.minimo && <p className="aviso">Faltan {s.minimo - s.ocupados} {T.personas} para el mínimo ({s.minimo}).</p>}
      {error && <p className="error">{error}</p>}

      {ctx.rol !== 'guia' && s.estado === 'abierta' && (
        <div className="fila no-imprimir">
          <button className="btn btn-principal" onClick={() => setNueva(true)} disabled={libres(s) === 0}>+ Reserva</button>
          {s.publica && <a className="btn btn-whatsapp" href={enlaceWhatsApp('', textoCompartir)} target="_blank" rel="noreferrer">{ICONOS.whatsapp}Compartir</a>}
          {s.publica && <button className="btn btn-borde" onClick={copiar}>{ICONOS.enlace}{copiado ? 'Copiado' : 'Copiar enlace'}</button>}
        </div>
      )}

      <div className="tabs no-imprimir" role="tablist">
        {ctx.rol !== 'guia' && <button className="tab" role="tab" aria-selected={vista === 'reservas'} onClick={() => setVista('reservas')}>Reservas ({activas.length})</button>}
        <button className="tab" role="tab" aria-selected={vista === 'lista'} onClick={() => setVista('lista')}>Lista de {T.personas}</button>
        {ctx.admin && <button className="tab" role="tab" aria-selected={vista === 'cuentas'} onClick={() => setVista('cuentas')}>Costos</button>}
      </div>

      {vista === 'reservas' && <ListaReservas ctx={ctx} reservas={todas} onAbrir={setVerReserva} />}
      {vista === 'lista' && <Manifiesto ctx={ctx} s={s} reservas={activas} />}
      {vista === 'cuentas' && ctx.admin && <Costos s={s} vendido={vendido} cobrado={cobrado} moneda={m} />}

      {ctx.admin && (
        <div className="panel no-imprimir">
          <h3>Esta {T.salida}</h3>
          <div className="fila">
            <button className="btn btn-borde btn-chico" onClick={() => setEditar(true)}>Editar</button>
            {s.estado === 'abierta' && <button className="btn btn-borde btn-chico" onClick={() => cambiarEstado('cerrada')}>Cerrar reservas</button>}
            {(s.estado === 'cerrada' || s.estado === 'cancelada') && <button className="btn btn-borde btn-chico" onClick={() => cambiarEstado('abierta')}>Volver a abrir</button>}
            {s.estado !== 'realizada' && s.estado !== 'cancelada' && <button className="btn btn-acento btn-chico" onClick={() => cambiarEstado('realizada')}>Marcar realizada</button>}
            {s.estado !== 'cancelada' && s.estado !== 'realizada' && <button className="btn btn-rosa btn-chico" onClick={() => cambiarEstado('cancelada')}>Cancelar {T.salida}</button>}
            {!todas.length && <button className="btn btn-rosa btn-chico" onClick={borrar}>Borrar</button>}
          </div>
        </div>
      )}

      {nueva && <NuevaReserva ctx={ctx} s={s} onCerrar={(id) => { setNueva(false); if (id) setVerReserva(id) }} />}
      {editar && <FormSalida ctx={ctx} s={s} onCerrar={() => setEditar(false)} />}
      {reserva && <DetalleReserva ctx={ctx} s={s} r={reserva} onCerrar={() => setVerReserva(null)} />}
    </section>
  )
}

function ListaReservas({ ctx, reservas, onAbrir }: { ctx: Contexto; reservas: Reserva[]; onAbrir: (id: string) => void }) {
  if (!reservas.length) return <Vacio>Todavía no hay reservas. Comparte el enlace por WhatsApp o en tus redes.</Vacio>
  const orden = [...reservas].sort((a, b) => Number(a.estado === 'cancelada') - Number(b.estado === 'cancelada') || (a.creada?.toMillis() ?? 0) - (b.creada?.toMillis() ?? 0))
  const m = ctx.ajustes.moneda
  return (
    <div className="lista">
      {orden.map((r) => {
        const [est, color] = ESTADOS_RESERVA[r.estado]
        return (
          <button key={r.id} className="fila-item" onClick={() => onAbrir(r.id)} style={r.estado === 'cancelada' ? { opacity: 0.6 } : undefined}>
            <span className="ini">{r.personas}</span>
            <div><b>{r.titular.nombre}</b><small>{dinero(r.total, m)}{saldo(r) > 0 && r.estado !== 'cancelada' ? ` · debe ${dinero(saldo(r), m)}` : ''} · {r.origen === 'enlace' ? 'por enlace' : r.vendedorNombre?.split(' ')[0] ?? 'equipo'}</small></div>
            <span className={`pill ${color}`}>{est}</span>
          </button>
        )
      })}
    </div>
  )
}

// Lista para el día del viaje: el guía marca quién subió. Se puede imprimir.
function Manifiesto({ ctx, s, reservas }: { ctx: Contexto; s: Salida; reservas: Reserva[] }) {
  const [error, setError] = useState('')
  const total = reservas.reduce((n, r) => n + r.pasajeros.length, 0)
  const subieron = reservas.reduce((n, r) => n + (r.abordo?.length ?? 0), 0)
  async function marcar(r: Reserva, i: number) {
    const abordo = r.abordo?.includes(i) ? r.abordo.filter((x) => x !== i) : [...(r.abordo ?? []), i]
    try { await updateDoc(doc(db, 'reservas', r.id), { abordo }) } catch (e) { setError(mensajeError(e)) }
  }
  const aviso = (r: Reserva) => `Hola ${r.titular.nombre.split(' ')[0]}, te escribimos de ${ctx.ajustes.nombre} por el ${T.servicio} ${s.tour.nombre} del ${fechaLarga(s.fecha.toDate())}.${s.tour.horaSalida ? ` Salimos a las ${s.tour.horaSalida}` : ''}${s.tour.puntoSalida ? ` desde ${s.tour.puntoSalida}` : ''}. Tu reserva: ${enlaceReserva(r.id)}`
  if (!reservas.length) return <Vacio>No hay {T.personas} todavía.</Vacio>
  return (
    <>
      <div className="fila no-imprimir" style={{ justifyContent: 'space-between' }}>
        <span><b>{subieron}</b> de {total} a bordo</span>
        <button className="btn btn-borde btn-chico" onClick={() => print()}>{ICONOS.imprimir}Imprimir lista</button>
      </div>
      {error && <p className="error">{error}</p>}
      <table className="tabla">
        <thead><tr><th>{T.Persona}</th><th>Cédula</th><th>Contacto</th><th>Subió</th></tr></thead>
        <tbody>
          {reservas.flatMap((r) => r.pasajeros.map((p, i) => (
            <tr key={`${r.id}-${i}`}>
              <td>{p.nombre}{p.nino ? ' (niño)' : ''}{i === 0 && r.titular.nota ? <><br /><small className="suave">{r.titular.nota}</small></> : null}</td>
              <td>{p.documento || '—'}</td>
              <td>{i === 0 ? <>{r.titular.telefono || '—'}{r.titular.emergencia ? <><br /><small className="suave">Emergencia: {r.titular.emergencia}</small></> : null}</> : <small className="suave">con {r.titular.nombre.split(' ')[0]}</small>}
                {ctx.rol !== 'guia' && saldo(r) > 0 && i === 0 && <><br /><small className="error" style={{ padding: 0 }}>Debe {dinero(saldo(r), ctx.ajustes.moneda)}</small></>}</td>
              <td><input type="checkbox" aria-label={`${p.nombre} subió`} checked={!!r.abordo?.includes(i)} onChange={() => marcar(r, i)} style={{ width: 22, height: 22 }} /></td>
            </tr>
          )))}
        </tbody>
      </table>
      {ctx.rol !== 'guia' && (
        <div className="panel no-imprimir">
          <h3>Avisar a todos</h3>
          <p className="suave chico">WhatsApp no deja mandar a muchos de un solo. Toca cada nombre: se abre el mensaje listo con la hora, el punto y su enlace.</p>
          <div className="fila">
            {reservas.filter((r) => r.titular.telefono).map((r) => (
              <a key={r.id} className="btn btn-whatsapp btn-chico" href={enlaceWhatsApp(r.titular.telefono, aviso(r))} target="_blank" rel="noreferrer">{ICONOS.whatsapp}{r.titular.nombre.split(' ')[0]}</a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// Costos de la salida: ganancia real (solo el dueño).
function Costos({ s, vendido, cobrado, moneda }: { s: Salida; vendido: number; cobrado: number; moneda: string }) {
  const guardado = useDoc<{ id: string; lineas: LineaCosto[] }>(`costos/${s.id}`)
  if (guardado === undefined) return <p className="suave">Cargando…</p>
  return <FormCostos s={s} inicial={guardado?.lineas ?? []} vendido={vendido} cobrado={cobrado} moneda={moneda} />
}

const SUGERIDOS = ['Transporte', 'Guía', 'Comida', 'Entradas', 'Hospedaje', 'Combustible']

function FormCostos({ s, inicial, vendido, cobrado, moneda }: { s: Salida; inicial: LineaCosto[]; vendido: number; cobrado: number; moneda: string }) {
  const [lineas, setLineas] = useState<{ concepto: string; monto: string }[]>(
    inicial.length ? inicial.map((l) => ({ concepto: l.concepto, monto: String(l.monto) })) : [{ concepto: 'Transporte', monto: '' }, { concepto: 'Guía', monto: '' }],
  )
  const [estado, setEstado] = useState('')
  const total = lineas.reduce((n, l) => n + (Number(l.monto) || 0), 0)
  const ganancia = vendido - total
  const poner = (i: number, k: 'concepto' | 'monto', v: string) => { setLineas((x) => x.map((l, j) => (j === i ? { ...l, [k]: v } : l))); setEstado('') }
  async function guardar() {
    setEstado('guardando')
    try {
      await setDoc(doc(db, 'costos', s.id), { lineas: lineas.filter((l) => l.concepto.trim() || Number(l.monto)).map((l) => ({ concepto: l.concepto.trim(), monto: Number(l.monto) || 0 })), salidaId: s.id, tourNombre: s.tour.nombre, fecha: s.fecha })
      setEstado('ok')
    } catch (e) { setEstado(mensajeError(e)) }
  }
  const faltan = SUGERIDOS.filter((c) => !lineas.some((l) => l.concepto === c))
  return (
    <div className="panel">
      <p className="suave chico">Lo que te cuesta esta {T.salida}. Solo tú lo ves.</p>
      {lineas.map((l, i) => (
        <div key={i} className="fila" style={{ flexWrap: 'nowrap' }}>
          <label className="campo" style={{ flex: 2, minWidth: 0 }} htmlFor={`c-c${i}`}><span hidden>Concepto</span><input id={`c-c${i}`} value={l.concepto} onChange={(e) => poner(i, 'concepto', e.target.value)} placeholder="Concepto" /></label>
          <label className="campo" style={{ flex: 1, minWidth: 0 }} htmlFor={`c-m${i}`}><span hidden>Monto</span><input id={`c-m${i}`} type="number" inputMode="decimal" value={l.monto} onChange={(e) => poner(i, 'monto', e.target.value)} placeholder="0" /></label>
          <button className="btn btn-borde btn-chico" aria-label="Quitar" onClick={() => setLineas((x) => x.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="fila">
        {faltan.slice(0, 4).map((c) => <button key={c} className="btn btn-borde btn-chico" onClick={() => setLineas((x) => [...x, { concepto: c, monto: '' }])}>+ {c}</button>)}
        <button className="btn btn-borde btn-chico" onClick={() => setLineas((x) => [...x, { concepto: '', monto: '' }])}>+ Otro</button>
      </div>
      <table className="tabla">
        <tbody>
          <tr><td>Vendido</td><td>{dinero(vendido, moneda)}</td></tr>
          <tr><td>Cobrado hasta hoy</td><td>{dinero(cobrado, moneda)}</td></tr>
          <tr><td>Costos</td><td>− {dinero(total, moneda)}</td></tr>
        </tbody>
        <tfoot><tr className="total"><td>Ganancia</td><td style={{ color: ganancia < 0 ? 'var(--rosa, #c0392b)' : undefined }}>{dinero(ganancia, moneda)}</td></tr></tfoot>
      </table>
      {s.ocupados > 0 && total > 0 && <p className="suave chico">Cada {T.persona} te cuesta {dinero(total / s.ocupados, moneda)}. Con el cupo lleno serían {dinero(total / s.cupo, moneda)}.</p>}
      {estado === 'ok' && <p className="ok">Guardado.</p>}
      {estado && estado !== 'ok' && estado !== 'guardando' && <p className="error">{estado}</p>}
      <button className="btn btn-principal" disabled={estado === 'guardando'} onClick={guardar}>{estado === 'guardando' ? 'Guardando…' : 'Guardar costos'}</button>
    </div>
  )
}

// ---------- Reservas ----------
function NuevaReserva({ ctx, s, onCerrar }: { ctx: Contexto; s: Salida; onCerrar: (id?: string) => void }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <Hoja titulo={`Reserva · ${s.tour.nombre}`} onCerrar={() => onCerrar()}>
      <p className="suave chico">Para cuando te escriben o te pagan en persona. Quedan {libres(s)} lugares.</p>
      {error && <p className="error">{error}</p>}
      <FormReserva salida={s} moneda={ctx.ajustes.moneda} enviando={enviando} onEnviar={async (d) => {
        setEnviando(true); setError('')
        try { onCerrar(await crearReserva(s.id, d, { uid: ctx.uid, nombre: ctx.nombre })) } catch (e) {
          setError(e instanceof SinCupo || (e instanceof Error && !(e as { code?: string }).code) ? (e as Error).message : mensajeError(e)); setEnviando(false)
        }
      }} />
    </Hoja>
  )
}

const METODOS = ['Transferencia', 'Efectivo', 'Tarjeta', 'Otro']

function DetalleReserva({ ctx, s, r, onCerrar }: { ctx: Contexto; s: Salida; r: Reserva; onCerrar: () => void }) {
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState(METODOS[0])
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const m = ctx.ajustes.moneda
  const debe = saldo(r)
  const anticipo = anticipoDe(r, s.anticipoPct)
  const vence = venceEl(r, ctx.ajustes.horasParaPagar)
  const [est, color] = ESTADOS_RESERVA[r.estado]
  const puedeCobrar = ctx.rol !== 'guia' && r.estado !== 'cancelada'
  const recordatorio = r.estado === 'pendiente'
    ? `Hola ${r.titular.nombre.split(' ')[0]}, gracias por reservar ${s.tour.nombre} (${fechaLarga(s.fecha.toDate())}). Para apartar tus ${r.personas} lugares envía ${dinero(anticipo, m)} antes del ${vence.toLocaleString('es-NI', { weekday: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.${ctx.ajustes.datosPago ? `\n${ctx.ajustes.datosPago}` : ''}\nTu reserva: ${enlaceReserva(r.id)}`
    : `Hola ${r.titular.nombre.split(' ')[0]}, te escribimos de ${ctx.ajustes.nombre}. Tu reserva para ${s.tour.nombre} (${fechaLarga(s.fecha.toDate())})${debe > 0 ? `: saldo pendiente ${dinero(debe, m)}` : ' está pagada'}.\n${enlaceReserva(r.id)}`

  async function cobrar() {
    const n = Number(monto)
    if (!(n > 0)) { setError('Escribe el monto.'); return }
    setTrabajando(true); setError('')
    try { await registrarPago(r, { monto: n, metodo, por: ctx.nombre }, s.anticipoPct); setMonto('') } catch (e) { setError(mensajeError(e)) } finally { setTrabajando(false) }
  }
  async function cancelar() {
    if (!confirm(`¿Cancelar la reserva de ${r.titular.nombre}? Se liberan ${r.personas} lugares.${r.pagado ? ` Ya pagó ${dinero(r.pagado, m)}: acuérdate de devolverlo o dejarlo a cuenta.` : ''}`)) return
    setTrabajando(true)
    try { await cancelarReserva(r); onCerrar() } catch (e) { setError(mensajeError(e)); setTrabajando(false) }
  }

  return (
    <Hoja titulo={r.titular.nombre} onCerrar={onCerrar}>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <span className={`pill ${color}`}>{est}</span>
        <small className="suave">{r.origen === 'enlace' ? 'Reservó por enlace' : `La hizo ${r.vendedorNombre ?? 'el equipo'}`}{r.creada ? ` · ${fechaCorta(r.creada.toDate())}` : ''}</small>
      </div>
      <div className="panel" style={{ gap: 4 }}>
        {r.titular.telefono && <span>WhatsApp: <b>{r.titular.telefono}</b></span>}
        {r.titular.documento && <span>Cédula: {r.titular.documento}</span>}
        {r.titular.emergencia && <span>Emergencia: {r.titular.emergencia}</span>}
        {r.titular.nota && <span className="suave" style={{ whiteSpace: 'pre-wrap' }}>{r.titular.nota}</span>}
        <span>{T.Personas}: {r.pasajeros.map((p) => p.nombre + (p.nino ? ' (niño)' : '')).join(', ')}</span>
      </div>
      {ctx.rol !== 'guia' && (
        <table className="tabla">
          <tbody>
            <tr><td>Total ({r.adultos} adulto{r.adultos === 1 ? '' : 's'}{r.ninos ? `, ${r.ninos} niño${r.ninos === 1 ? '' : 's'}` : ''})</td><td>{dinero(r.total, m)}</td></tr>
            {(r.pagos ?? []).map((p, i) => <tr key={i}><td className="suave">{new Date(p.fecha).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' })} · {p.metodo} · {p.por.split(' ')[0]}</td><td>− {dinero(p.monto, m)}</td></tr>)}
          </tbody>
          <tfoot><tr className="total"><td>Saldo</td><td>{dinero(debe, m)}</td></tr></tfoot>
        </table>
      )}
      {r.estado === 'pendiente' && <p className={+vence < Date.now() ? 'error' : 'aviso'}>Anticipo para apartar: {dinero(anticipo, m)}. {+vence < Date.now() ? 'Ya venció el plazo.' : `Plazo: ${vence.toLocaleString('es-NI', { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`}</p>}
      {puedeCobrar && debe > 0 && (
        <div className="panel">
          <h3>Registrar pago</h3>
          <div className="fila">
            {r.estado === 'pendiente' && anticipo < debe && <button className="btn btn-borde btn-chico" onClick={() => setMonto(String(anticipo))}>Anticipo {dinero(anticipo, m)}</button>}
            <button className="btn btn-borde btn-chico" onClick={() => setMonto(String(debe))}>Todo {dinero(debe, m)}</button>
          </div>
          <div className="campos">
            <label className="campo" htmlFor="p-monto">Monto<input id="p-monto" type="number" inputMode="decimal" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
            <label className="campo" htmlFor="p-metodo">Cómo pagó<select id="p-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <button className="btn btn-acento" disabled={trabajando} onClick={cobrar}>Guardar pago</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="fila">
        {ctx.rol !== 'guia' && r.titular.telefono && <a className="btn btn-whatsapp" href={enlaceWhatsApp(r.titular.telefono, recordatorio)} target="_blank" rel="noreferrer">{ICONOS.whatsapp}{r.estado === 'pendiente' ? 'Recordar anticipo' : 'Escribirle'}</a>}
        <a className="btn btn-borde" href={enlaceReserva(r.id)} target="_blank" rel="noreferrer">{ICONOS.enlace}Ver lo que ve el cliente</a>
        {puedeCobrar && <button className="btn btn-rosa" disabled={trabajando} onClick={cancelar}>Cancelar reserva</button>}
      </div>
    </Hoja>
  )
}
