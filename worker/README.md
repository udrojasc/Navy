# Navy Proxy — Cloudflare Worker

Backend para pruebas web controladas. No es un proxy abierto: por defecto solo permite example.com. Añade únicamente dominios que estés autorizado a probar a ALLOWED_HOSTS.

## Requisitos

- Cuenta de Cloudflare con Workers y Durable Objects habilitados.
- Node.js LTS y npm.
- Wrangler, instalado con npm install -D wrangler.

## 1. Configurar los dominios permitidos

Edita wrangler.jsonc y cambia ALLOWED_HOSTS. Escribe hostnames separados por comas:

~~~jsonc
"vars": {
  "ALLOWED_HOSTS": "example.com,mi-sitio-de-pruebas.com,*.assets-mi-sitio.com",
  "MAX_BODY_BYTES": "8388608",
  "MAX_REDIRECTS": "8"
}
~~~

Los patrones *.dominio.com permiten subdominios, pero no el dominio raíz. Incluye los dominios de API, CDN, imágenes y recursos que necesite la aplicación. No utilices un comodín global.

El Worker bloquea IP privadas y nombres locales. No está pensado para alcanzar localhost, redes corporativas ni servicios de metadata cloud.

## 2. Desplegar

Desde esta carpeta:

~~~bash
npm install
npx wrangler login
npx wrangler deploy
~~~

Wrangler creará el namespace SQLite de SessionStore en la primera publicación. Guarda la URL workers.dev que muestre Wrangler, por ejemplo:

~~~text
https://navy-proxy.<tu-subdominio>.workers.dev
~~~

## 3. Conectar GitHub Pages

Abre Navy y pega la URL de tu Worker en el campo URL del Worker. Se guarda en el navegador. Pulsa Comprobar y después carga un dominio incluido en ALLOWED_HOSTS.

El frontend no puede descubrir automáticamente el hostname workers.dev de tu cuenta porque ese dato pertenece a tu cuenta de Cloudflare.

## 4. Dominio personalizado

En Cloudflare Dashboard abre Workers & Pages → navy-proxy → Settings → Domains & Routes → Add → Custom Domain y asigna un subdominio de una zona que controles, por ejemplo proxy.tudominio.com. Después pega esa URL en Navy.

Cloudflare crea el registro DNS y el certificado TLS del Custom Domain. No es posible configurar ese dominio desde este repositorio: debes ser propietario de la zona en Cloudflare.

## Rutas

- GET /health: estado y bindings.
- /p/<uuid>/https/<host>/<path>: navegación y recursos.
- La sesión se identifica por UUID y guarda cookies upstream en un Durable Object SQLite.

## Alcance y límites

- Reescribe atributos HTML de recursos, enlaces y formularios, srcset, CSS inline, CSS embebido y URLs url()/@import de hojas CSS externas; inserta un interceptor para fetch, XHR y sendBeacon.
- Sigue redirecciones manualmente, validándolas contra la lista permitida, y mantiene cookies en el Durable Object.
- No garantiza compatibilidad con WebSockets, Service Workers, autenticaciones ligadas al dominio original, DRM, CAPTCHA, aplicaciones que validan estrictamente Origin/Host, ni técnicas dinámicas como URLs cifradas u ofuscadas.
- La sesión no comparte cookies originales con el navegador. Las cookies upstream se guardan en el Durable Object por UUID y se aplican a las peticiones según dominio, ruta, Secure y vencimiento. La sesión se elimina después de 2 horas sin actividad (configurable mediante SESSION_TTL_SECONDS). La API JavaScript document.cookie todavía no se emula; sitios que lean cookies desde JavaScript o dependan de tokens CSRF derivados de ellas pueden no completar el inicio de sesión.
- El iframe usa sandbox sin allow-same-origin para evitar que páginas diferentes compartan un origen privilegiado del proxy. Algunas aplicaciones que requieren un origen no opaco pueden necesitar ajustes.
- Eliminar CSP/X-Frame-Options solo afecta a la copia entregada por este Worker. Úsalo exclusivamente para pruebas autorizadas.
- La lista permitida es un control del prototipo, no un sistema completo multiusuario. Antes de exponerlo públicamente, añade autenticación, cuotas, límites de concurrencia y aislamiento por usuario.

## Diagnóstico DNS

Sustituye el hostname por el que te entregó Wrangler:

~~~bash
nslookup navy-proxy.<tu-subdominio>.workers.dev
curl -i https://navy-proxy.<tu-subdominio>.workers.dev/health
~~~

Si /health no resuelve, revisa el hostname y que workers.dev esté habilitado. Si /health responde pero la navegación falla, revisa ALLOWED_HOSTS, el DNS del destino y el diagnóstico del Worker.
