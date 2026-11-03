import { dinero, fechaCorta, libres, saldo } from '../datos'
import { venceEl } from '../reservar'
import { T } from '../textos'
import type { Contexto } from './Agencia'

export default function Inicio({ ctx, onIr }: { ctx: Contexto; onIr: (v: string, accion?: string) => void }) {
  const ahora = Date.now()
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const semana = +hoy + 7 * 86400_000
  const proximas = ctx.salidas.filter((s) => s.fecha.toMillis() >= +hoy && s.estado !== 'cancelada')
  const activas = ctx.reservas.filter((r) => r.estado !== 'cancelada')
  const estaSemana = activas.filter((r) => r.fecha.toMillis() >= +hoy && r.fecha.toMillis() < semana).reduce((n, r) => n + r.personas, 0)
  const porCobrar = activas.filter((r) => r.fecha.toMillis() >= +hoy).reduce((n, r) => n + saldo(r), 0)
  const sinAnticipo = activas.filter((r) => r.estado === 'pendiente').sort((a, b) => (a.creada?.toMillis() ?? 0) - (b.creada?.toMillis() ?? 0))
  const m = ctx.ajustes.moneda

  return (
    <section className="pantalla">
      <div><h1>Hola{ctx.nombre ? `, ${ctx.nombre.split(' ')[0]}` : ''}</h1><p className="suave">{ctx.ajustes.nombre}</p></div>
      <div className="stats">
        <button className="stat" onClick={() => onIr('salidas')} style={{ textAlign: 'left' }}><b>{proximas.length}</b><span>{T.proximas}</span></button>
        <button className="stat" onClick={() => onIr('salidas')} style={{ textAlign: 'left' }}><b>{estaSemana}</b><span>{T.Personas} esta semana</span></button>
        <div className="stat"><b style={{ fontSize: '1.05rem' }}>{dinero(porCobrar, m)}</b><span>Por cobrar</span></div>
      </div>

      {sinAnticipo.length > 0 && (
        <div className="panel">
          <h3>Reservas sin anticipo</h3>
          <p className="suave chico">Recuérdales por WhatsApp. Si se pasa el plazo, puedes cancelar y el cupo se libera.</p>
          <div className="lista">
            {sinAnticipo.slice(0, 8).map((r) => {
              const vencida = +venceEl(r, ctx.ajustes.horasParaPagar) < ahora
              return (
                <button key={r.id} className="fila-item" onClick={() => onIr('salidas', `reserva:${r.salidaId}:${r.id}`)}>
                  <span className="ini">{r.personas}</span>
                  <div><b>{r.titular.nombre}</b><small>{r.tourNombre} · {fechaCorta(r.fecha.toDate())} · {dinero(r.total, m)}</small></div>
                  <span className={`pill ${vencida ? 'p-rosa' : 'p-amarillo'}`}>{vencida ? 'Venció el plazo' : 'Esperando'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="fila" style={{ justifyContent: 'space-between' }}><h3>{T.proximas}</h3>
          {ctx.admin && <button className="btn btn-principal btn-chico" onClick={() => onIr('salidas', 'nueva')}>+ {T.Salida}</button>}</div>
        {proximas.length === 0 && <p className="suave">{ctx.admin ? (ctx.tours.length ? `Crea ${T.salidaFemenino ? 'la primera' : 'el primero'} con "+ ${T.Salida}".` : `Primero agrega tus ${T.servicios} con foto y precio.`) : `No hay ${T.salidas} próximas.`}</p>}
        <div className="lista">
          {proximas.slice(0, 6).map((s) => (
            <button key={s.id} className="fila-item" onClick={() => onIr('salidas', `salida:${s.id}`)}>
              {s.tour.miniatura ? <img className="mini" src={s.tour.miniatura} alt="" /> : <span className="ini">{s.fecha.toDate().getDate()}</span>}
              <div><b>{s.tour.nombre}</b><small>{fechaCorta(s.fecha.toDate())} · {s.ocupados} de {s.cupo}{s.ocupados < s.minimo ? ` · faltan ${s.minimo - s.ocupados} para el mínimo` : ''}</small>
                <div className="barra-cupo"><span style={{ width: `${Math.min(100, (s.ocupados / Math.max(1, s.cupo)) * 100)}%` }} /></div></div>
              <span className={`pill ${libres(s) === 0 ? 'p-rosa' : 'p-verde'}`}>{libres(s) === 0 ? 'Lleno' : `${libres(s)} libres`}</span>
            </button>
          ))}
        </div>
      </div>

      {ctx.admin && ctx.tours.length === 0 && (
        <div className="panel destacado">
          <h3>Primeros pasos</h3>
          <p className="suave">1. Pon el teléfono, los datos de pago y tu política en Ajustes. 2. Agrega tus {T.servicios} con foto y precio. 3. Crea las {T.salidas} con fecha y cupo. 4. Comparte la página de {T.salidas} en tus redes.</p>
          <button className="btn btn-acento" onClick={() => onIr('tours', 'nuevo')}>{T.nuevoServicio}</button>
        </div>
      )}
    </section>
  )
}
