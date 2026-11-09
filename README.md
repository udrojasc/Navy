# Navy

Navy es un prototipo de inspección de páginas web en un iframe, pensado para pruebas de desarrollo y accesibilidad en sitios autorizados.

## Arquitectura

- Frontend estático: GitHub Pages, publicado desde index.html.
- Backend: Cloudflare Worker en worker/src/index.js.
- Sesiones: Durable Objects con almacenamiento SQLite.
- Reescritura: HTMLRewriter para HTML, atributos de recursos, navegación, estilos y CSS.
- Peticiones dinámicas: interceptores de fetch, XMLHttpRequest y sendBeacon.
- Cookies: jar del lado del servidor, separado por UUID de sesión y dominio.

## Abrir la interfaz

https://udrojasc.github.io/Navy/

En el campo URL del Worker introduce el endpoint que Wrangler devuelve tras desplegar. La interfaz permite comprobar /health y cargar una página cuyo dominio esté autorizado.

## Desplegar el backend

Consulta worker/README.md. En resumen:

~~~bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
~~~

La lista ALLOWED_HOSTS de worker/wrangler.jsonc está limitada inicialmente a example.com. Añade solo los dominios que tengas autorización para probar, incluyendo hosts de API y CDN utilizados por el sitio.

## Seguridad y compatibilidad

Navy no es un proxy público de propósito general. Rechaza destinos no incluidos en la lista permitida y bloquea IP privadas y nombres locales.

**Modo actual de uso individual:** el iframe habilita `allow-same-origin` para que aplicaciones complejas puedan utilizar `localStorage`, `sessionStorage` y APIs de almacenamiento que fallan en un origen opaco. También permite que las ventanas emergentes de autenticación escapen del sandbox. Como todas las sesiones proxificadas comparten el hostname del Worker, sus documentos comparten origen y pueden acceder a almacenamiento del navegador bajo ese origen. No cargues sitios no confiables en este modo y no lo expongas a varios usuarios.

El prototipo mantiene cookies upstream del lado del servidor, pero todavía no virtualiza completamente la API JavaScript `document.cookie` ni reproduce las cookies originales del navegador para cada dominio. WebSockets, Service Workers, DRM, CAPTCHA y otras integraciones muy ligadas al origen original pueden seguir teniendo limitaciones.

Usa el sistema únicamente para sitios que controles o para los que tengas autorización expresa. Antes de convertirlo en un servicio multiusuario, añade autenticación, cuotas, límites de concurrencia y aislamiento por usuario, idealmente asignando un origen independiente a cada sesión.
