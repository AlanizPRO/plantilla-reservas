// Palabras de cada negocio: "tour / salida / pasajero", "viaje / fecha / pasajero", "evento / función / asistente"…
// Las escribe la Super App en src/cliente.json → "textos".
import { cliente } from './cliente'

const BASE = {
  servicio: 'tour', servicios: 'tours', servicioFemenino: false,
  salida: 'salida', salidas: 'salidas', salidaFemenino: true,
  persona: 'pasajero', personas: 'pasajeros', personaFemenino: false,
  guia: 'guía',
}
const t = { ...BASE, ...((cliente as { textos?: Partial<typeof BASE> }).textos ?? {}) }
const may = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export const T = {
  ...t,
  Servicio: may(t.servicio),
  Servicios: may(t.servicios),
  Salida: may(t.salida),
  Salidas: may(t.salidas),
  Persona: may(t.persona),
  Personas: may(t.personas),
  Guia: may(t.guia),
  nuevoServicio: `${t.servicioFemenino ? 'Nueva' : 'Nuevo'} ${t.servicio}`,
  nuevaSalida: `${t.salidaFemenino ? 'Nueva' : 'Nuevo'} ${t.salida}`,
  /** "las próximas salidas" / "los próximos eventos" */
  proximas: `${t.salidaFemenino ? 'Próximas' : 'Próximos'} ${t.salidas}`,
}
