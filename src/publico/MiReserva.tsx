import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Logo } from '../componentes'
import { anticipoDe, dinero, enlaceWhatsApp, ESTADOS_RESERVA, fechaLarga, saldo, useAjustes, type Reserva, type Salida } from '../datos'
import { db } from '../firebase'
import { ICONOS } from '../iconos'
import { venceEl } from '../reservar'
import { T } from '../textos'

// El cliente abre /r/CODIGO: ve su reserva, cuánto debe y cómo pagar.
export default function MiReserva({ codigo }: { codigo: string }) {
  const ajustes = useAjustes()
  const [r, setR] = useState<Reserva | null | undefined>(undefined)
  const [s, setS] = useState<Salida | null>(null)

  useEffect(() => {
    getDoc(doc(db, 'reservas', codigo)).then(async (d) => {
      if (!d.exists()) { setR(null); return }
      const reserva = { id: d.id, ...d.data() } as Reserva
      setR(reserva)
      const sd = await getDoc(doc(db, 'salidas', reserva.salidaId))
      if (sd.exists()) setS({ id: sd.id, ...sd.data() } as Salida)
    }).catch(() => setR(null))
  }, [codigo])

  if (r === undefined) return <div className="entrada"><p className="suave">Cargando…</p></div>
  if (r === null) return <div className="entrada"><div className="panel"><Logo /><h2>No encontramos esta reserva</h2><p className="suave">Revisa el enlace o escríbenos.</p></div></div>

  const m = ajustes.moneda
  const debe = saldo(r)
  const pct = s?.anticipoPct ?? ajustes.anticipoPct
  const anticipo = Math.max(0, anticipoDe(r, pct) - (r.pagado || 0))
  const vence = venceEl(r, ajustes.horasParaPagar)
  const [est, color] = ESTADOS_RESERVA[r.estado]
  const comprobante = `Hola, les envío el comprobante de mi reserva para ${r.tourNombre} (${fechaLarga(r.fecha.toDate())}) a nombre de ${r.titular.nombre}. ${location.href}`

  return (
    <div className="app publico">
      <header className="marca"><Logo /><div><h3>{ajustes.nombre}</h3><small className="suave">Tu reserva</small></div></header>
      <div className="panel">
        <div className="fila" style={{ justifyContent: 'space-between' }}><h2>{r.tourNombre}</h2><span className={`pill ${color}`}>{est}</span></div>
        <p><b>{fechaLarga(r.fecha.toDate())}</b>{s?.tour.horaSalida ? ` · sale a las ${s.tour.horaSalida}` : ''}</p>
        {s?.tour.puntoSalida && <p>Punto de salida: <b>{s.tour.puntoSalida}</b></p>}
        {s?.estado === 'cancelada' && <p className="error">Esta {T.salida} se canceló. Te vamos a contactar.</p>}
        <p className="suave">{T.Personas}: {r.pasajeros.map((p) => p.nombre).join(', ')}</p>
      </div>

      {r.estado === 'cancelada' ? <p className="error">Esta reserva está cancelada.</p> : (
        <div className="panel">
          <table className="tabla">
            <tbody>
              <tr><td>Total</td><td>{dinero(r.total, m)}</td></tr>
              <tr><td>Pagado</td><td>{dinero(r.pagado || 0, m)}</td></tr>
            </tbody>
            <tfoot><tr className="total"><td>Saldo</td><td>{dinero(debe, m)}</td></tr></tfoot>
          </table>
          {r.estado === 'pendiente' && anticipo > 0 && (
            <p className="aviso">Para apartar tus lugares envía <b>{dinero(anticipo, m)}</b> antes del {vence.toLocaleString('es-NI', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}<br />Si no, el cupo se puede liberar.</p>
          )}
          {r.estado === 'apartada' && <p className="ok">¡Tus lugares están apartados! El saldo se paga antes de salir.</p>}
          {r.estado === 'pagada' && <p className="ok">¡Todo pagado! Nos vemos en el viaje.</p>}
          {debe > 0 && ajustes.datosPago && <div><h3>Cómo pagar</h3><p style={{ whiteSpace: 'pre-wrap' }}>{ajustes.datosPago}</p></div>}
          {debe > 0 && ajustes.telefono && <a className="btn btn-whatsapp" href={enlaceWhatsApp(ajustes.telefono, comprobante)} target="_blank" rel="noreferrer">{ICONOS.whatsapp}Enviar comprobante</a>}
        </div>
      )}

      {s?.tour.llevar && <div className="panel"><h3>Qué llevar</h3><p style={{ whiteSpace: 'pre-wrap' }}>{s.tour.llevar}</p></div>}
      {s?.tour.incluye && <div className="panel"><h3>Incluye</h3><p style={{ whiteSpace: 'pre-wrap' }}>{s.tour.incluye}</p></div>}
      {ajustes.politica && <p className="suave chico" style={{ whiteSpace: 'pre-wrap' }}>{ajustes.politica}</p>}
      <p className="suave chico">Guarda este enlace: aquí ves tu reserva cuando quieras.</p>
      {ajustes.telefono && <a className="btn btn-borde" href={enlaceWhatsApp(ajustes.telefono, `Hola, tengo una pregunta sobre mi reserva: ${location.href}`)} target="_blank" rel="noreferrer">{ICONOS.whatsapp}Escribirnos</a>}
    </div>
  )
}
