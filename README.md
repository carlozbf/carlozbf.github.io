# ⚡ PartidoExpress - Sistema de Pedidos Móvil (Sin Backend)

Este es un sistema de pedidos responsivo para móviles, desarrollado con **HTML5, CSS3 moderno (Vanilla CSS con diseño Glassmorphism)** y **JavaScript (ES6)**. Está diseñado para funcionar completamente sin un servidor Node.js (Static Hosting) y cuenta con roles integrados para **Clientes** y **Administrador**.

Soporta hasta 20 clientes (con mesas predefinidas y nombres personalizados) y se sincroniza en tiempo real de dos formas diferentes.

---

## 🚀 Cómo Ejecutar el Proyecto

### Opción A: Usando Go / Golang (Recomendado - Sin Dependencias Externas)
Si tienes Go instalado en tu sistema, esta es la forma más rápida y limpia, ya que no requiere instalar nada adicional:
1. Abre tu terminal (PowerShell o CMD) en la carpeta del proyecto.
2. Ejecuta:
   ```bash
   go run server.go
   ```
3. Se abrirá automáticamente tu navegador en **`http://localhost:8080`** y servirá la página.

### Opción B: Usando Node.js
Si prefieres Node:
1. Abre tu terminal en la carpeta del proyecto.
2. Instala la dependencia del servidor de desarrollo ejecutable:
   ```bash
   npm install
   ```
3. Inicia el servidor:
   ```bash
   npm start
   ```
4. Visita **`http://localhost:8080`** en tu navegador.

### Opción C: Abrir Directamente (Sin Servidor)
1. Haz doble clic en el archivo `index.html`.
   * *Nota importante: Debido a las políticas de seguridad del navegador (CORS) para archivos locales `file://`, la carga dinámica de `config.json` y la comunicación WebSocket de Supabase se bloquearán en navegadores basados en Chromium (Chrome/Edge). Para usar Supabase, debes usar la Opción A o la Opción B.*

---

## 🔄 Cómo funciona la Sincronización en Tiempo Real

### Modo 1: Simulación Local (Por defecto)
Ideal para demostraciones rápidas, desarrollo y pruebas en el mismo computador/móvil.
* **Tecnología**: `localStorage` + `BroadcastChannel` API.
* **Funcionamiento**: Si abres la página web en dos pestañas diferentes (una en modo **Cliente** y otra en modo **Admin**), al enviar un pedido en la pestaña de Cliente, la pestaña de Admin recibirá el pedido instantáneamente, emitirá una **notificación auditiva** sintetizada mediante la API de Audio Web y actualizará las estadísticas en pantalla en tiempo real.

### Modo 2: Sincronización Real con Base de Datos en la Nube (Gratis con Supabase)
Si deseas desplegar la aplicación a producción (por ejemplo, en GitHub Pages) para que tus clientes puedan pedir desde sus propios celulares en tiempo real y tú recibas todo en tu pantalla de administración:
1. Regístrate en [Supabase](https://supabase.com) (es gratis).
2. Crea un nuevo proyecto.
3. Ve a la sección **SQL Editor** en tu panel de Supabase y ejecuta el siguiente script para crear la tabla de pedidos y habilitar la replicación en tiempo real:
   ```sql
   -- Crear tabla de pedidos
   CREATE TABLE orders (
     id uuid default gen_random_uuid() primary key,
     client_name text not null,
     items jsonb not null,
     total decimal(10,2) not null,
     status text not null default 'pending',
     created_at timestamp with time zone default timezone('utc'::text, now()) not null
   );

   -- Habilitar réplica en tiempo real (Realtime) para la tabla de pedidos
   ALTER PUBLICATION supabase_realtime ADD TABLE orders;
   ```
4. Abre **PartidoExpress**, ve a la esquina superior derecha, cambia al rol **Admin**, haz clic en el botón **⚙️ Nube** y:
   * Ingresa tu **Supabase Project URL** (ej. `https://your-project-id.supabase.co`).
   * Ingresa tu **Supabase Anon API Key** (la encuentras en Project Settings > API).
   * Marca la casilla **"Habilitar base de datos en la nube"**.
   * Haz clic en **Guardar y Aplicar**.
5. ¡Listo! La aplicación se recargará automáticamente y a partir de ese momento, cualquier cliente que abra la web en cualquier celular en el mundo podrá enviar pedidos en tiempo real directamente a tu panel de administración.

### Modo 3: Redirección de pedidos a WhatsApp (Ideal para negocios reales sin servidor)
Si deseas recibir los pedidos directamente en tu chat de WhatsApp, puedes habilitar esta opción.
1. Cambia al rol **Admin**, haz clic en el botón **⚙️ Nube** (Ajustes).
2. En la sección **Pedidos por WhatsApp**:
   * Introduce tu número de teléfono con el código de país (ej. `573001234567` para Colombia, `34600123456` para España) sin el símbolo `+` ni espacios.
   * Activa la casilla **"Habilitar redirección a WhatsApp"**.
3. Haz clic en **Guardar y Aplicar**.
4. ¡Listo! A partir de ahora, cuando un cliente confirme su carrito de compras en su celular:
   * Se registrará el pedido en el panel local (para descontar el stock).
   * Se abrirá automáticamente WhatsApp con un mensaje pre-formateado con la lista de productos, cantidades, mesa/nombre y total listo para enviar al administrador con un solo clic.

---

## 🎨 Características Visuales y Funcionalidades Premium

* **Diseño Glassmorphism**: Interfaz estética y oscura con tarjetas semitransparentes, difuminado de fondo, y efectos neón adaptados a cada producto (Ámbar para Cerveza, Naranja para Papas, Azul para Agua).
* **Control de Stock Dinámico**: El stock de productos cargado desde `products.json` disminuye dinámicamente cuando un cliente realiza un pedido. El panel de administración permite al administrador reabastecer el inventario en cualquier momento.
* **Sonidos de Notificación**: Sonidos generados mediante código usando la **Web Audio API** del navegador (sin necesidad de cargar archivos `.mp3` externos).
  * Sonido alegre doble para el Admin cuando entra un pedido.
  * Sonido ascendente corto para el Cliente cuando su pedido cambia a *Preparando* o *Entregado*.
* **Control de Identidad**: Permite seleccionar entre las Mesas 1 a 20 de manera predeterminada o introducir un nombre personalizado.
