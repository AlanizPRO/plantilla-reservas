// Formulario de reserva: lo usan el cliente (desde el enlace) y el equipo (reserva por teléfono o en persona).
import { useState } from 'react'
import { dinero, type Pasajero, type Salida } from './datos'
import type { DatosReserva } from './reservar'
import { T } from './textos'

export function FormReserva({ salida, moneda, publico, enviando, onEnviar }: {
  salida: Salida; moneda: string; publico?: boolean; enviando: boolean; onEnviar: (d: DatosReserva) => void
}) {
  const [titular, setTitular] = useState({ nombre: '', telefono: '', documento: '', emergencia: '', nota: '' })
  // El primer pasajero es el titular; su nombre se copia solo.
  const [otros, setOtros] = useState<Pasajero[]>([])
  const [titularNino, setTitularNino] = useState(false)
  const [error, setError] = useState('')
  const quedan = Math.max(0, salida.cupo - salida.ocupados)
  const pasajeros: Pasajero[] = [{ nombre: titular.nombre, documento: titular.documento, nino: titularNino }, ...otros]
  const ninos = pasajeros.filter((p) => p.nino).length
  const total = (pasajeros.length - ninos) * salida.precioAdulto + ninos * salida.precioNino
  const hayNino = salida.precioNino > 0 && salida.precioNino !== salida.precioAdulto
  const poner = (k: keyof typeof titular, v: string) => setTitular((x) => ({ ...x, [k]: v }))
  const ponerOtro = (i: number, p: Partial<Pasajero>) => setOtros((x) => x.map((y, j) => (j === i ? { ...y, ...p } : y)))

  function enviar() {
    if (!titular.nombre.trim()) { setError('Escribe el nombre de quien reserva.'); return }
    if (publico && titular.telefono.replace(/\D/g, '').length < 8) { setError('Escribe tu WhatsApp para confirmarte la reserva.'); return }
    if (otros.some((p) => !p.nombre.trim())) { setError(`Escribe el nombre de cada ${T.persona} o quita los que sobran.`); return }
    if (pasajeros.length > quedan) { setError(quedan ? `Solo quedan ${quedan} lugares.` : 'Ya no quedan lugares.'); return }
    setError('')
    onEnviar({ titular, pasajeros: pasajeros.map((p) => ({ ...p, nombre: p.nombre.trim() })) })
  }

  return (
    <div className="pantalla" style={{ gap: 12 }}>
      <div className="campos">
        <label className="campo" htmlFor="r-nombre">Nombre completo *<input id="r-nombre" value={titular.nombre} onChange={(e) => poner('nombre', e.target.value)} autoComplete="name" /></label>
        <label className="campo" htmlFor="r-tel">WhatsApp {publico ? '*' : ''}<input id="r-tel" type="tel" inputMode="tel" value={titular.telefono} onChange={(e) => poner('telefono', e.target.value)} autoComplete="tel" placeholder="Ej. 8888 8888" /></label>
        <label className="campo" htmlFor="r-doc">Cédula o pasaporte<input id="r-doc" value={titular.documento} onChange={(e) => poner('documento', e.target.value)} /></label>
        <label className="campo" htmlFor="r-emer">Contacto de emergencia<input id="r-emer" value={titular.emergencia} onChange={(e) => poner('emergencia', e.target.value)} placeholder="Nombre y teléfono" /></label>
      </div>
      {hayNino && <label className="check"><input type="checkbox" checked={titularNino} onChange={(e) => setTitularNino(e.target.checked)} />Quien reserva es niño</label>}

      <div className="panel" style={{ gap: 10 }}>
        <h3>{T.Personas}: {pasajeros.length}</h3>
        <p className="suave chico">Tú ya cuentas. Agrega a los que van contigo.</p>
        {otros.map((p, i) => (
          <div key={i} className="fila" style={{ alignItems: 'flex-end' }}>
            <label className="campo" style={{ flex: 2, minWidth: 140 }} htmlFor={`r-p${i}`}>{T.Persona} {i + 2}
              <input id={`r-p${i}`} value={p.nombre} onChange={(e) => ponerOtro(i, { nombre: e.target.value })} placeholder="Nombre" /></label>
            <label className="campo" style={{ flex: 1, minWidth: 110 }} htmlFor={`r-d${i}`}>Cédula
              <input id={`r-d${i}`} value={p.documento ?? ''} onChange={(e) => ponerOtro(i, { documento: e.target.value })} /></label>
            {hayNino && <label className="check"><input type="checkbox" checked={!!p.nino} onChange={(e) => ponerOtro(i, { nino: e.target.checked })} />Niño</label>}
            <button className="btn btn-borde btn-chico" aria-label={`Quitar ${T.persona} ${i + 2}`} onClick={() => setOtros((x) => x.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {pasajeros.length < Math.min(quedan, 20) && (
          <button className="btn btn-borde" onClick={() => setOtros((x) => [...x, { nombre: '', documento: '', nino: false }])}>+ Agregar {T.persona}</button>
        )}
      </div>

      <label className="campo" htmlFor="r-nota">Nota (opcional)<textarea id="r-nota" value={titular.nota} onChange={(e) => poner('nota', e.target.value)} placeholder="Ej. alergias, dónde nos recogen, preguntas" /></label>

      <div className="panel destacado" style={{ gap: 4 }}>
        <span>Total: <b>{dinero(total, moneda)}</b></span>
        {salida.anticipoPct > 0 && salida.anticipoPct < 100 && <small className="suave">Para apartar: {dinero(Math.ceil((total * salida.anticipoPct) / 100), moneda)} ({salida.anticipoPct}%)</small>}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-principal btn-ancho" disabled={enviando} onClick={enviar}>{enviando ? 'Reservando…' : publico ? 'Reservar' : 'Guardar reserva'}</button>
    </div>
  )
}
