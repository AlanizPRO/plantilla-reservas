import {
  collection, doc, onSnapshot, query, type DocumentData, type Query, type Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { cliente } from './cliente'
import { db } from './firebase'

// ---------- Tipos ----------
export type Tour = {
  id: string; nombre: string; destino: string; descripcion?: string; incluye?: string; llevar?: string
  puntoSalida?: string; horaSalida?: string; duracion?: string; precioAdulto: number; precioNino: number
  miniatura?: string; fotos?: string[]; activo?: boolean
}
// Copia del tour dentro de la salida: así el cliente ve todo con una sola lectura y no cambia si luego se edita el tour.
export type DatosTour = Pick<Tour, 'nombre' | 'destino' | 'descripcion' | 'incluye' | 'llevar' | 'puntoSalida' | 'horaSalida' | 'duracion' | 'miniatura' | 'fotos'>
export type EstadoSalida = 'abierta' | 'cerrada' | 'cancelada' | 'realizada'
export type Salida = {
  id: string; tourId: string; tour: DatosTour; fecha: Timestamp; cupo: number; ocupados: number; minimo: number
  precioAdulto: number; precioNino: number; anticipoPct: number; estado: EstadoSalida; publica: boolean
  guiaUid?: string; guiaNombre?: string; nota?: string; ultimaReserva?: string
}
export type Foto = { id: string; datos: string; tourId?: string }
export type Pasajero = { nombre: string; documento?: string; nino?: boolean }
export type Pago = { monto: number; metodo: string; fecha: number; por: string }
export type EstadoReserva = 'pendiente' | 'apartada' | 'pagada' | 'cancelada'
export type Reserva = {
  id: string; salidaId: string; tourNombre: string; fecha: Timestamp
  titular: { nombre: string; telefono: string; documento?: string; emergencia?: string; nota?: string }
  pasajeros: Pasajero[]; adultos: number; ninos: number; personas: number; total: number
  pagos: Pago[]; pagado: number; estado: EstadoReserva; origen: 'enlace' | 'equipo'
  vendedorUid?: string; vendedorNombre?: string; abordo?: number[]; creada?: Timestamp
}
export type LineaCosto = { concepto: string; monto: number }
export type Ajustes = {
  nombre: string; telefono: string; direccion: string; moneda: string
  anticipoPct: number; horasParaPagar: number; datosPago: string; politica: string
}

export const AJUSTES_INICIALES: Ajustes = {
  nombre: cliente.nombreApp,
  telefono: '',
  direccion: cliente.ciudad ?? '',
  moneda: cliente.venta.moneda,
  anticipoPct: cliente.venta.anticipoPct,
  horasParaPagar: cliente.venta.horasParaPagar,
  datosPago: '',
  politica: '',
}

export const ESTADOS_RESERVA: Record<EstadoReserva, [string, string]> = {
  pendiente: ['Sin anticipo', 'p-amarillo'],
  apartada: ['Con anticipo', 'p-principal'],
  pagada: ['Pagada', 'p-verde'],
  cancelada: ['Cancelada', 'p-rosa'],
}
export const ESTADOS_SALIDA: Record<EstadoSalida, [string, string]> = {
  abierta: ['Abierta', 'p-verde'],
  cerrada: ['Cerrada', 'p-gris'],
  cancelada: ['Cancelada', 'p-rosa'],
  realizada: ['Realizada', 'p-principal'],
}

// ---------- Lecturas en vivo ----------
export function useLista<T>(q: Query<DocumentData> | null, deps: unknown[] = []) {
  const [lista, setLista] = useState<T[] | null>(null)
  useEffect(() => {
    if (!q) { setLista([]); return }
    return onSnapshot(q, (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as T)), (e) => {
      console.error(e); setLista([])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return lista
}

export function useDoc<T>(ruta: string | null) {
  const [dato, setDato] = useState<T | null | undefined>(undefined)
  useEffect(() => {
    if (!ruta) { setDato(null); return }
    return onSnapshot(doc(db, ruta), (s) => setDato(s.exists() ? ({ id: s.id, ...s.data() } as T) : null), () => setDato(null))
  }, [ruta])
  return dato
}

export function useAjustesConEstado(): [Ajustes, boolean] {
  const [estado, setEstado] = useState<[Ajustes, boolean]>([AJUSTES_INICIALES, false])
  useEffect(() => onSnapshot(doc(db, 'ajustes', 'general'), (s) => {
    setEstado([s.exists() ? { ...AJUSTES_INICIALES, ...s.data() } : AJUSTES_INICIALES, true])
  }, () => setEstado([AJUSTES_INICIALES, true])), [])
  return estado
}
export const useAjustes = () => useAjustesConEstado()[0]

export const col = (nombre: string) => collection(db, nombre)
export const todos = (nombre: string) => query(col(nombre))

// ---------- Textos y números ----------
export const dinero = (n: number, moneda: string) => `${moneda} ${Math.round(n).toLocaleString('es-NI')}`
export const libres = (s: Pick<Salida, 'cupo' | 'ocupados'>) => Math.max(0, s.cupo - s.ocupados)
export const saldo = (r: Pick<Reserva, 'total' | 'pagado'>) => Math.max(0, r.total - (r.pagado || 0))
export const anticipoDe = (r: Pick<Reserva, 'total'>, pct: number) => Math.ceil((r.total * pct) / 100)
export const estadoPorPago = (total: number, pagado: number, pct: number): EstadoReserva =>
  pagado >= total ? 'pagada' : pagado >= Math.ceil((total * pct) / 100) && pagado > 0 ? 'apartada' : 'pendiente'

export function codigoAzar(largo = 6, letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  return Array.from(crypto.getRandomValues(new Uint32Array(largo)), (n) => letras[n % letras.length]).join('')
}
// Código largo para enlaces públicos: imposible de adivinar.
export const codigoEnlace = () => codigoAzar(20, 'abcdefghijkmnpqrstuvwxyz23456789')
export const fechaCorta = (d: Date) => d.toLocaleDateString('es-NI', { day: 'numeric', month: 'short' })
export const fechaLarga = (d: Date) => d.toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' })
/** "2026-11-15" para un input de fecha, en hora local. */
export const aInputFecha = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const deInputFecha = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) }
export const sumarDias = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ---------- WhatsApp ----------
export function enlaceWhatsApp(telefono: string | undefined, texto: string) {
  let n = (telefono ?? '').replace(/\D/g, '')
  if (n.length === 8) n = `505${n}` // número de Nicaragua sin código de país
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`
}

export function mensajeError(e: unknown) {
  const codigo = (e as { code?: string })?.code ?? ''
  if (codigo.includes('permission-denied')) return 'No tienes permiso para hacer eso.'
  if (codigo.includes('unavailable')) return 'Sin conexión. Se guardará cuando vuelva la señal.'
  if (codigo.includes('popup-closed')) return 'Se cerró la ventana de Google antes de terminar.'
  if (codigo.includes('resource-exhausted') || codigo.includes('invalid-argument')) return 'La foto es demasiado grande. Prueba con otra.'
  return 'Algo salió mal. Intenta de nuevo.'
}

export const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
