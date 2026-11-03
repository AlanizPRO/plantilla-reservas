import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Logo } from '../componentes'
import { dinero, enlaceWhatsApp, fechaLarga, libres, mensajeError, useAjustes, type Salida } from '../datos'
import { db } from '../firebase'
import { FormReserva } from '../formReserva'
import { Galeria } from '../galeria'
import { ICONOS } from '../iconos'
import { crearReserva, SinCupo } from '../reservar'
import { T } from '../textos'

// El cliente abre /s/ID, ve el tour y reserva sin cuenta.
export default function Reservar({ salidaId }: { salidaId: string }) {
  const ajustes = useAjustes()
  const [s, setS] = useState<Salida | null | undefined>(undefined)
  const [reservando, setReservando] = useState(false)
  const [mostrar, setMostrar] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDoc(doc(db, 'salidas', salidaId)).then((d) => setS(d.exists() ? ({ id: d.id, ...d.data() } as Salida) : null)).catch(() => setS(null))
  }, [salidaId])

  if (s === undefined) return <div className="entrada"><p className="suave">Cargando…</p></div>
  if (s === null || !s.publica) return (
    <div className="entrada"><div className="panel"><Logo /><h2>No encontramos esta {T.salida}</h2>
      <p className="suave">Revisa el enlace o mira las demás.</p><a className="btn btn-principal" href="/salidas">Ver {T.proximas.toLowerCase()}</a></div></div>
  )

  const quedan = libres(s)
  const pasada = s.fecha.toMillis() < new Date().setHours(0, 0, 0, 0)
  const abierta = s.estado === 'abierta' && quedan > 0 && !pasada
  const m = ajustes.moneda

  return (
    <div className="app publico">
      <header className="marca"><Logo /><div><h3>{ajustes.nombre}</h3><small className="suave"><a href="/salidas">Ver todas las {T.salidas}</a></small></div></header>
      <Galeria ids={s.tour.fotos} miniatura={s.tour.miniatura} />
      <div>
        <h1>{s.tour.nombre}</h1>
        <p><b>{fechaLarga(s.fecha.toDate())}</b>{s.tour.horaSalida ? ` · sale a las ${s.tour.horaSalida}` : ''}{s.tour.duracion ? ` · ${s.tour.duracion}` : ''}</p>
        {s.tour.puntoSalida && <p className="suave">Punto de salida: {s.tour.puntoSalida}</p>}
      </div>
      <div className="stats">
        <div className="stat"><b style={{ fontSize: '1.05rem' }}>{dinero(s.precioAdulto, m)}</b><span>por persona</span></div>
        {s.precioNino > 0 && s.precioNino !== s.precioAdulto && <div className="stat"><b style={{ fontSize: '1.05rem' }}>{dinero(s.precioNino, m)}</b><span>niños</span></div>}
        <div className="stat"><b>{quedan}</b><span>lugares libres</span></div>
      </div>
      {s.tour.descripcion && <p style={{ whiteSpace: 'pre-wrap' }}>{s.tour.descripcion}</p>}
      {s.tour.incluye && <div className="panel"><h3>Incluye</h3><p style={{ whiteSpace: 'pre-wrap' }}>{s.tour.incluye}</p></div>}
      {s.tour.llevar && <div className="panel"><h3>Qué llevar</h3><p style={{ whiteSpace: 'pre-wrap' }}>{s.tour.llevar}</p></div>}
      {s.nota && <p className="aviso">{s.nota}</p>}

      {!abierta && <p className="error">{pasada ? `Esta ${T.salida} ya pasó.` : quedan === 0 ? 'Ya no quedan lugares.' : `Esta ${T.salida} ya no recibe reservas.`} <a href="/salidas">Mira las demás</a>.</p>}
      {abierta && !mostrar && <button className="btn btn-principal btn-ancho" onClick={() => setMostrar(true)}>Reservar mi lugar</button>}
      {abierta && mostrar && (
        <div className="panel">
          <h2>Tus datos</h2>
          {error && <p className="error">{error}</p>}
          <FormReserva salida={s} moneda={m} publico enviando={reservando} onEnviar={async (d) => {
            setReservando(true); setError('')
            try { location.href = `/r/${await crearReserva(s.id, d)}` } catch (e) {
              setError(e instanceof SinCupo ? (e as Error).message : (e as { code?: string }).code ? mensajeError(e) : (e as Error).message); setReservando(false)
            }
          }} />
          {ajustes.politica && <p className="suave chico" style={{ whiteSpace: 'pre-wrap' }}>{ajustes.politica}</p>}
        </div>
      )}
      {ajustes.telefono && <a className="btn btn-whatsapp" href={enlaceWhatsApp(ajustes.telefono, `Hola, tengo una pregunta sobre ${s.tour.nombre} del ${fechaLarga(s.fecha.toDate())}.`)} target="_blank" rel="noreferrer">{ICONOS.whatsapp}Preguntar por WhatsApp</a>}
    </div>
  )
}
