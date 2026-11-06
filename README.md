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

Navy no es un proxy público de propósito general. Rechaza destinos no incluidos en la lista permitida y bloquea IP privadas y nombres locales. El iframe se ejecuta en un origen opaco: no se habilita allow-same-origin porque los documentos servidos por un mismo Worker compartirían origen.

El prototipo mantiene cookies upstream del lado del servidor, pero todavía no virtualiza la API JavaScript document.cookie. WebSockets, Service Workers, DRM, CAPTCHA y otras integraciones muy ligadas al origen original no están soportadas en esta versión.

Usa el sistema únicamente para sitios que controles o para los que tengas autorización expresa. Antes de convertirlo en un servicio multiusuario, añade autenticación, cuotas, límites de concurrencia y aislamiento por usuario.
