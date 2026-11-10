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
- El frontend actual es de uso individual: habilita `allow-same-origin` y `allow-popups-to-escape-sandbox` para que aplicaciones complejas puedan usar almacenamiento web y abrir flujos de autenticación. Como todas las sesiones comparten el hostname del Worker, las páginas proxificadas comparten origen y almacenamiento del navegador. No cargues sitios no confiables ni expongas esta configuración a varios usuarios. Antes de un despliegue multiusuario, asigna un origen separado por sesión.
- Eliminar CSP/X-Frame-Options solo afecta a la copia entregada por este Worker. Úsalo exclusivamente para pruebas autorizadas.
- La lista permitida es un control del prototipo, no un sistema completo multiusuario. Antes de exponerlo públicamente, añade autenticación, cuotas, límites de concurrencia y aislamiento por usuario.

## Diagnóstico DNS

Sustituye el hostname por el que te entregó Wrangler:

~~~bash
nslookup navy-proxy.<tu-subdominio>.workers.dev
curl -i https://navy-proxy.<tu-subdominio>.workers.dev/health
~~~

Si /health no resuelve, revisa el hostname y que workers.dev esté habilitado. Si /health responde pero la navegación falla, revisa ALLOWED_HOSTS, el DNS del destino y el diagnóstico del Worker.


## Vinculación de Google Sheets mediante QR

Navy incluye un flujo OAuth 2.0 de servidor web para vincular una cuenta Google desde otro dispositivo. La autorización se abre directamente en Google en el teléfono; no se utiliza el iframe/proxy para iniciar sesión. Los tokens se guardan cifrados con AES-GCM en Durable Objects.

### Configuración inicial en Google Cloud

1. Crea o selecciona un proyecto en Google Cloud Console.
2. Habilita **Google Sheets API**.
3. Configura la pantalla de consentimiento OAuth. En modo de pruebas, añade tu cuenta Google como usuario de prueba.
4. Crea un ID de cliente OAuth de tipo **Aplicación web**.
5. En “URI de redirección autorizados”, añade exactamente:

   \`https://navy.ulisesdrojasc2.workers.dev/api/google/oauth/callback\`

6. Conserva el ID de cliente y el secreto. No los añadas al repositorio ni al frontend.

El permiso solicitado es \`openid email https://www.googleapis.com/auth/spreadsheets\`. El último permite leer y editar hojas de cálculo de la cuenta autorizada. El código no recibe la contraseña de Google.

### Configurar secretos en Cloudflare

Desde PowerShell, en la carpeta \`worker\`, genera una clave AES de 32 bytes:

\`\`\`powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$key = [Convert]::ToBase64String($bytes)
$key
\`\`\`

Guarda el resultado temporalmente y configura los tres secretos (Wrangler solicitará el valor de cada uno):

\`\`\`bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_TOKEN_ENCRYPTION_KEY
\`\`\`

Para el tercer secreto pega el valor Base64 generado en PowerShell. No lo compartas ni lo guardes en GitHub.

Las variables no secretas ya están declaradas en \`wrangler.jsonc\`:

- \`GOOGLE_REDIRECT_URI\`: callback OAuth del Worker.
- \`GOOGLE_APP_ORIGINS\`: origen autorizado de GitHub Pages.
- \`GOOGLE_SPREADSHEET_ID\`: hoja que Navy debe probar.

Tras configurar los secretos, vuelve a desplegar:

\`\`\`bash
npx wrangler deploy
\`\`\`

### Uso

1. Abre Navy y despliega el panel izquierdo **Navegar**.
2. En **Cuenta Google**, selecciona **Vincular cuenta con QR**.
3. Escanea el código con tu teléfono.
4. Pulsa “Continuar con Google” y concede el permiso de Sheets.
5. Vuelve a la computadora. Navy detectará la vinculación automáticamente.
6. Pulsa **Probar hoja** para consultar los metadatos de la hoja configurada mediante Google Sheets API.

Los QR caducan a los 10 minutos. La clave que permite consultar el estado se conserva solo en memoria del navegador de escritorio. La cuenta queda guardada en el Durable Object global \`google-account:primary\`; este prototipo sigue siendo de uso individual y no debe exponerse a varios usuarios.

### Consideraciones

- Si la pantalla OAuth es de tipo externo y está en modo de pruebas, Google emite refresh tokens que caducan a los **7 días** cuando se solicitan permisos de Sheets. El usuario podrá volver a vincular la cuenta; para uso continuo habrá que revisar el estado de publicación/verificación o reducir el alcance solicitado.
- Para uso continuo, publica la aplicación OAuth y completa los requisitos de verificación que Google exija para los permisos solicitados.
- Desvincular en Navy elimina la copia cifrada local en Cloudflare. Para revocar el consentimiento, también debes quitar el acceso de Navy desde la configuración de seguridad de tu cuenta Google.
- El QR es una credencial temporal de un solo flujo: no lo compartas. Si caduca, genera otro.
