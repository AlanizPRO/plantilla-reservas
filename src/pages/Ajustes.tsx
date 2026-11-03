import { doc, setDoc } from 'firebase/firestore'
import { useState } from 'react'
import { mensajeError, type Ajustes as TAjustes } from '../datos'
import { db } from '../firebase'
import { T } from '../textos'
import BotonRespaldo from './BotonRespaldo'

export default function Ajustes({ ajustes }: { ajustes: TAjustes }) {
  const [a, setA] = useState<TAjustes>(ajustes)
  const [estado, setEstado] = useState<'' | 'guardando' | 'ok' | string>('')
  const poner = <K extends keyof TAjustes>(k: K, v: TAjustes[K]) => { setA((x) => ({ ...x, [k]: v })); setEstado('') }

  async function guardar() {
    setEstado('guardando')
    try {
      await setDoc(doc(db, 'ajustes', 'general'), {
        ...a, nombre: a.nombre.trim(),
        anticipoPct: Math.min(100, Math.max(0, Math.round(Number(a.anticipoPct) || 0))),
        horasParaPagar: Math.max(1, Math.round(Number(a.horasParaPagar) || 24)),
      })
      setEstado('ok')
    } catch (e) { setEstado(mensajeError(e)) }
  }

  return (
    <section className="pantalla">
      <div><h1>Ajustes</h1><p className="suave">Estos datos los ve el cliente al reservar y en su enlace.</p></div>
      <div className="panel">
        <h3>La agencia</h3>
        <div className="campos">
          <label className="campo" htmlFor="a-nombre">Nombre<input id="a-nombre" value={a.nombre} onChange={(e) => poner('nombre', e.target.value)} /></label>
          <label className="campo" htmlFor="a-tel">WhatsApp de reservas<input id="a-tel" type="tel" inputMode="tel" value={a.telefono} onChange={(e) => poner('telefono', e.target.value)} /></label>
          <label className="campo" htmlFor="a-moneda">Moneda<input id="a-moneda" value={a.moneda} onChange={(e) => poner('moneda', e.target.value)} placeholder="C$ o US$" /></label>
        </div>
        <label className="campo" htmlFor="a-dir">Dirección<input id="a-dir" value={a.direccion} onChange={(e) => poner('direccion', e.target.value)} /></label>
      </div>
      <div className="panel">
        <h3>Pagos</h3>
        <div className="campos">
          <label className="campo" htmlFor="a-ant">Anticipo para apartar (%)<input id="a-ant" type="number" inputMode="numeric" min={0} max={100} value={a.anticipoPct} onChange={(e) => poner('anticipoPct', Number(e.target.value))} /></label>
          <label className="campo" htmlFor="a-horas">Horas para pagar el anticipo<input id="a-horas" type="number" inputMode="numeric" min={1} value={a.horasParaPagar} onChange={(e) => poner('horasParaPagar', Number(e.target.value))} /></label>
        </div>
        <label className="campo" htmlFor="a-pago">Datos para pagar (banco, cuenta, a nombre de)<textarea id="a-pago" value={a.datosPago} onChange={(e) => poner('datosPago', e.target.value)} placeholder="Ej. BAC córdobas 123456789 a nombre de Juan Pérez" /></label>
        <label className="campo" htmlFor="a-pol">Política de cancelación<textarea id="a-pol" value={a.politica} onChange={(e) => poner('politica', e.target.value)} placeholder="Ej. Si cancelas con 72 horas o más, te devolvemos el anticipo. Si la salida no llega al mínimo, se reprograma o se devuelve todo." /></label>
      </div>
      {estado === 'ok' && <p className="ok">Guardado.</p>}
      {estado && estado !== 'ok' && estado !== 'guardando' && <p className="error">{estado}</p>}
      <button className="btn btn-principal" disabled={estado === 'guardando'} onClick={guardar}>{estado === 'guardando' ? 'Guardando…' : 'Guardar'}</button>
      <BotonRespaldo hojas={[
        { coleccion: 'tours', nombre: T.Servicios }, { coleccion: 'salidas', nombre: T.Salidas }, { coleccion: 'reservas', nombre: 'Reservas' },
        { coleccion: 'costos', nombre: 'Costos' }, { coleccion: 'usuarios', nombre: 'Equipo' },
      ]} />
    </section>
  )
}
