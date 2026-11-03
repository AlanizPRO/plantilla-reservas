# Plantilla de reservas y salidas

App para negocios que venden lugares en fechas con cupo: agencias de tours, transporte turístico, excursiones, eventos o talleres. El dueño crea sus tours y las salidas con fecha, cupo y precio. El cliente reserva solo desde un enlace, sin cuenta, y ve cuánto debe y cómo pagar. El equipo cobra, avisa por WhatsApp y el día del viaje el guía marca quién subió.

**No se edita a mano.** La Super App crea un repositorio por cliente desde esta plantilla y le escribe `src/cliente.json` con el nombre, los colores, el dueño, las palabras del negocio, la moneda, el anticipo y los datos públicos de Firebase.

## Cómo se usa

1. **Ajustes:** WhatsApp de reservas, datos para pagar (banco y cuenta), política de cancelación, porcentaje de anticipo y horas para pagarlo.
2. **Tours:** nombre, destino, fotos, precio adulto y niño, qué incluye, qué llevar, punto y hora de salida.
3. **Salidas:** tour, fecha, cupo, mínimo para salir, guía y si está publicada. El precio y el anticipo se pueden cambiar por salida.
4. **Vender:**
   - La página `/salidas` muestra todas las salidas abiertas, para Facebook o Instagram.
   - El enlace `/s/…` es de una salida. El cliente pone sus datos y los de sus acompañantes.
   - El cupo se descuenta al instante, y dos personas no pueden tomar el último lugar a la vez.
   - El vendedor también puede reservar desde la app cuando le escriben o le pagan en persona.
5. **Cobrar:**
   - El cliente recibe su enlace `/r/…` con el total, el anticipo, el plazo y los datos de pago.
   - El equipo registra los pagos (anticipo o todo) y la reserva pasa a "Con anticipo" o "Pagada".
   - En Inicio salen las reservas sin anticipo, y las que ya vencieron se pueden cancelar para liberar el cupo.
6. **Día del viaje:**
   - El guía abre la lista de pasajeros, marca quién subió y la puede imprimir.
   - "Avisar a todos" abre un WhatsApp listo para cada titular.
7. **Costos (solo el dueño):** transporte, guía, comida y entradas de cada salida, con la ganancia real y el costo por pasajero.

## Roles

| Rol | Qué hace |
| --- | --- |
| Dueño (`correoAdmin`) | Todo: tours, salidas, costos, equipo y ajustes |
| Vendedor | Reserva, cobra y avisa. No ve costos |
| Guía | Ve sus salidas y la lista de pasajeros, y marca quién subió |

Los vendedores y guías entran con un enlace de invitación (Más → Equipo).

## Palabras de cada negocio

`cliente.json → textos` cambia "tour / salida / pasajero / guía". Por ejemplo, para eventos: "evento / función / asistente / coordinador".

## Funciona en Firebase Spark (gratis)

- No usa Cloud Functions ni Storage. Las fotos se achican en el teléfono y se guardan en Firestore.
- Las reservas usan códigos de 20 letras al azar: se pueden abrir con el enlace, pero no listar.
- Las reglas (`firestore.plantilla.rules`) revisan que una reserva del público tenga el precio correcto, no pase del cupo y suba "ocupados" exactamente en sus personas.
- `scripts/preparar.mjs` pone el correo del dueño en las reglas al compilar.
- `firestore.indexes.json` tiene el índice de la página de salidas y se publica junto con las reglas.

## Lo que necesita el proyecto de Firebase del cliente

1. Authentication → Google habilitado.
2. Firestore creado (modo producción).
3. Una app web registrada (sus datos van en `cliente.json → firebase`).
4. La cuenta `publicador` de Carlos agregada como Editor.

## Publicar

En el repositorio del cliente hacen falta el secreto `FIREBASE_SERVICE_ACCOUNT` y la variable `PUBLICAR_APP = si`. Cada cambio en `main` se publica.

## Datos (Firestore)

| Colección | Qué guarda | Quién lee |
| --- | --- | --- |
| `tours` | ficha, precios, miniatura | equipo |
| `fotos/{id}` | foto grande | cualquiera con el id |
| `salidas` | copia del tour, fecha, cupo, ocupados, precios, guía | equipo; el público solo las publicadas |
| `reservas/{código}` | titular, pasajeros, total, pagos, a bordo | equipo; el cliente con su enlace |
| `costos/{salida}` | gastos de la salida | solo el dueño |
| `invitaciones/{código}`, `usuarios/{uid}` | vendedores y guías | dueño; cada uno lo suyo |
| `ajustes/general` | nombre, WhatsApp, pago, política | cualquiera |
