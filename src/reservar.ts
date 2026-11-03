// Crear y cancelar reservas, cuidando el cupo: dos personas no pueden tomar el último lugar a la vez.
import { doc, runTransaction, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { codigoEnlace, estadoPorPago, type Pago, type Pasajero, type Reserva, type Salida } from './datos'
import { db } from './firebase'

export type DatosReserva = {
  titular: { nombre: string; telefono: string; documento?: string; emergencia?: string; nota?: string }
  pasajeros: Pasajero[]
}

export class SinCupo extends Error {}

export async function crearReserva(salidaId: string, datos: DatosReserva, equipo?: { uid: string; nombre: string }) {
  const codigo = codigoEnlace()
  const ninos = datos.pasajeros.filter((p) => p.nino).length
  const adultos = datos.pasajeros.length - ninos
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'salidas', salidaId)
    const s = await tx.get(ref)
    if (!s.exists()) throw new Error('Esta salida ya no existe.')
    const salida = s.data() as Omit<Salida, 'id'>
    if (salida.estado !== 'abierta') throw new Error('Esta salida ya no recibe reservas.')
    const quedan = salida.cupo - salida.ocupados
    if (datos.pasajeros.length > quedan) throw new SinCupo(quedan > 0 ? `Solo quedan ${quedan} lugares.` : 'Ya no quedan lugares.')
    const reserva = {
      salidaId, tourNombre: salida.tour.nombre, fecha: salida.fecha,
      titular: {
        nombre: datos.titular.nombre.trim().slice(0, 120), telefono: datos.titular.telefono.trim().slice(0, 30),
        documento: (datos.titular.documento ?? '').trim().slice(0, 40), emergencia: (datos.titular.emergencia ?? '').trim().slice(0, 120),
        nota: (datos.titular.nota ?? '').trim().slice(0, 500),
      },
      pasajeros: datos.pasajeros.map((p) => ({ nombre: p.nombre.trim().slice(0, 120), documento: (p.documento ?? '').trim().slice(0, 40), nino: !!p.nino })),
      adultos, ninos, personas: adultos + ninos,
      total: adultos * salida.precioAdulto + ninos * salida.precioNino,
      pagos: [], pagado: 0, estado: 'pendiente', origen: equipo ? 'equipo' : 'enlace', abordo: [], creada: serverTimestamp(),
      ...(equipo ? { vendedorUid: equipo.uid, vendedorNombre: equipo.nombre } : {}),
    }
    tx.set(doc(db, 'reservas', codigo), reserva)
    tx.update(ref, { ocupados: salida.ocupados + reserva.personas, ultimaReserva: codigo })
  })
  return codigo
}

// Cancelar libera los lugares en la salida.
export async function cancelarReserva(r: Reserva) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'salidas', r.salidaId)
    const s = await tx.get(ref)
    tx.update(doc(db, 'reservas', r.id), { estado: 'cancelada' })
    if (s.exists() && r.estado !== 'cancelada') tx.update(ref, { ocupados: Math.max(0, (s.data().ocupados ?? 0) - r.personas) })
  })
}

export async function registrarPago(r: Reserva, pago: Omit<Pago, 'fecha'>, anticipoPct: number) {
  const pagos = [...(r.pagos ?? []), { ...pago, fecha: Date.now() }]
  const pagado = pagos.reduce((s, p) => s + p.monto, 0)
  const lote = writeBatch(db)
  lote.update(doc(db, 'reservas', r.id), { pagos, pagado, estado: estadoPorPago(r.total, pagado, anticipoPct) })
  await lote.commit()
}

export const venceEl = (r: Pick<Reserva, 'creada'>, horas: number) => new Date((r.creada ?? Timestamp.now()).toMillis() + horas * 3600_000)
