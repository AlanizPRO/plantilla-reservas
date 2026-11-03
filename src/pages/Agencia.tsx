import type { User } from 'firebase/auth'
import { orderBy, query, Timestamp, where } from 'firebase/firestore'
import { useMemo, useState, type ReactNode } from 'react'
import { Barra, Encabezado, type Pestana } from '../componentes'
import { col, useAjustesConEstado, useLista, type Ajustes as TAjustes, type Reserva, type Salida, type Tour } from '../datos'
import { ICONOS } from '../iconos'
import { salir } from '../sesion'
import { T } from '../textos'
import Ajustes from './Ajustes'
import Equipo from './Equipo'
import Inicio from './Inicio'
import Salidas from './Salidas'
import Tours from './Tours'

type Vista = 'inicio' | 'salidas' | 'tours' | 'mas' | 'equipo' | 'ajustes'
export type RolEquipo = 'admin' | 'vendedor' | 'guia'

// Lo que comparten todas las pantallas.
export type Contexto = {
  rol: RolEquipo; admin: boolean; uid: string; nombre: string; telefono: string
  ajustes: TAjustes; tours: Tour[]; salidas: Salida[]; reservas: Reserva[]
}

// Se cargan las salidas desde hace 60 días: lo viejo queda en el respaldo de Excel.
const desde = () => Timestamp.fromDate(new Date(Date.now() - 60 * 86400_000))

export default function Agencia({ usuario, rol, nombre, telefono, botonTema }: { usuario: User; rol: RolEquipo; nombre: string; telefono: string; botonTema: ReactNode }) {
  const admin = rol === 'admin'
  const [vista, setVista] = useState<Vista>(rol === 'guia' ? 'salidas' : 'inicio')
  const [accion, setAccion] = useState('')
  const [ajustes, ajustesCargados] = useAjustesConEstado()
  const inicio = useMemo(desde, [])
  const tours = useLista<Tour>(query(col('tours'), orderBy('nombre'))) ?? []
  const salidas = useLista<Salida>(query(col('salidas'), where('fecha', '>=', inicio), orderBy('fecha'))) ?? []
  const reservas = useLista<Reserva>(query(col('reservas'), where('fecha', '>=', inicio))) ?? []
  const pendientes = reservas.filter((r) => r.estado === 'pendiente').length

  const ctx: Contexto = { rol, admin, uid: usuario.uid, nombre: nombre || usuario.displayName || '', telefono: admin ? ajustes.telefono : telefono || ajustes.telefono, ajustes, tours, salidas, reservas }
  const ir = (v: string, a = '') => { setVista(v as Vista); setAccion(a); scrollTo(0, 0) }
  const pestanas: Pestana[] = [
    ...(rol !== 'guia' ? [{ id: 'inicio', nombre: 'Inicio', icono: 'inicio', punto: pendientes > 0 }] : []),
    { id: 'salidas', nombre: T.Salidas, icono: 'salidas' },
    ...(admin ? [{ id: 'tours', nombre: T.Servicios, icono: 'tours' }] : []),
    { id: 'mas', nombre: 'Más', icono: 'mas' },
  ]
  const actual = ['equipo', 'ajustes'].includes(vista) ? 'mas' : vista
  const catalogo = `${location.origin}/salidas`

  return (
    <>
      <div className="app">
        <Encabezado subtitulo={admin ? 'Dueño' : `${rol === 'guia' ? T.Guia : 'Vendedor'} · ${ctx.nombre.split(' ')[0]}`} derecha={botonTema} />
        <main>
          {vista === 'inicio' && <Inicio ctx={ctx} onIr={ir} />}
          {vista === 'salidas' && <Salidas key={accion} ctx={ctx} accion={accion} />}
          {vista === 'tours' && admin && <Tours key={accion} ctx={ctx} nuevo={accion === 'nuevo'} />}
          {vista === 'equipo' && admin && <Equipo />}
          {vista === 'ajustes' && admin && <Ajustes key={ajustesCargados ? 'cargado' : 'inicial'} ajustes={ajustes} />}
          {vista === 'mas' && (
            <section className="pantalla">
              <h1>Más</h1>
              <div className="lista">
                {rol !== 'guia' && <Opcion icono="enlace" titulo={`Página de ${T.salidas}`} texto="Para Facebook, Instagram o WhatsApp: ahí reservan solos" onClick={() => open(catalogo, '_blank')} />}
                {admin && <Opcion icono="equipo" titulo="Equipo" texto={`Invitar vendedores y ${T.guia}s`} onClick={() => ir('equipo')} />}
                {admin && <Opcion icono="ajustes" titulo="Ajustes" texto="Datos de la agencia, pagos y política" onClick={() => ir('ajustes')} />}
              </div>
              <p className="suave chico">Entraste como <b>{usuario.email}</b>{admin ? ' (dueño)' : ''}.</p>
              <button className="btn btn-borde" onClick={salir}>Cerrar sesión</button>
            </section>
          )}
        </main>
      </div>
      <Barra pestanas={pestanas} actual={actual} onIr={(v) => ir(v)} />
    </>
  )
}

function Opcion({ icono, titulo, texto, onClick }: { icono: string; titulo: string; texto: string; onClick: () => void }) {
  return (
    <button className="fila-item" onClick={onClick}>
      <span className="ini" style={{ background: 'var(--principal)' }}>{ICONOS[icono]}</span>
      <div><b>{titulo}</b><small>{texto}</small></div>
      <span aria-hidden="true">›</span>
    </button>
  )
}
