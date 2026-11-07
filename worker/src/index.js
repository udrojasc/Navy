const MAX_REDIRECTS = 8;
const DEFAULT_BODY_LIMIT = 8 * 1024 * 1024;
const COOKIE_KEY = "navy.cookies.v1";

function json(data, status, extraHeaders) {
  const headers = new Headers(extraHeaders || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { status: status || 200, headers });
}

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") ||
      "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-XSRF-Token, Range, If-None-Match, If-Modified-Since",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, ETag, Last-Modified",
    "Vary": "Origin"
  };
}

function parseProxyPath(url) {
  const parts = url.pathname.split("/");
  if (parts[1] !== "p" || !/^[0-9a-f-]{36}$/i.test(parts[2] || "") ||
      !["http", "https", "ws", "wss"].includes(parts[3]) || !parts[4]) return null;

  let host;
  try { host = decodeURIComponent(parts[4]); } catch (_) { return null; }

  const remainder = parts.slice(5).join("/");
  let target;
  try {
    target = new URL(parts[3] + "://" + host + "/" + remainder + url.search);
  } catch (_) { return null; }

  if (target.username || target.password) return null;
  target.hash = "";
  return { sessionId: parts[2], target: target };
}

function isPrivateIPv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || !parts.every(function (x) {
    return /^\d+$/.test(x) && Number(x) <= 255;
  })) return false;
  const a = Number(parts[0]), b = Number(parts[1]);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19));
}

function isAllowedTarget(target, env) {
  if (!(target instanceof URL) || !["http:", "https:", "ws:", "wss:"].includes(target.protocol)) return false;
  const host = target.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host.endsWith(".home.arpa") || host.startsWith("[") || isPrivateIPv4(host)) return false;

  const patterns = String(env.ALLOWED_HOSTS || "").split(",")
    .map(function (item) { return item.trim().toLowerCase(); }).filter(Boolean);

  return patterns.some(function (pattern) {
    pattern = pattern.replace(/\.$/, "");
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === pattern;
  });
}

function proxyUrl(target, origin, sessionId) {
  return origin + "/p/" + sessionId + "/" + target.protocol.slice(0, -1) + "/" +
    encodeURIComponent(target.host) + target.pathname + target.search + target.hash;
}

function originalUrlFromProxy(value) {
  try {
    const route = parseProxyPath(new URL(value));
    return route ? route.target : null;
  } catch (_) { return null; }
}

function makeBootstrap(sessionId, initialBase, workerOrigin) {
  const config = JSON.stringify({
    sessionId: sessionId, initialBase: initialBase, workerOrigin: workerOrigin
  }).replace(/</g, "\\u003c");
  return "<script>(function(cfg){'use strict';" +
    "var sid=cfg.sessionId,origin=cfg.workerOrigin,base=cfg.initialBase,prefix='/p/'+sid+'/';" +
    "function mapUrl(value){try{var raw=value instanceof Request?value.url:String(value);" +
    "var u=new URL(raw,base);if(u.protocol!=='http:'&&u.protocol!=='https:')return raw;" +
    "if(u.origin===origin){if(u.pathname.indexOf(prefix)===0)return u.href;u=new URL(u.pathname+u.search+u.hash,base);}" +
    "return origin+prefix+u.protocol.slice(0,-1)+'/'+encodeURIComponent(u.host)+u.pathname+u.search+u.hash;" +
    "}catch(e){return value;}}" +
    "window.__NAVY_SET_BASE__=function(v){try{base=new URL(v,base).href;}catch(e){}};" +
    "var nativeFetch=window.fetch.bind(window);" +
    "window.fetch=function(input,init){try{" +
    "var isRequest=input instanceof Request,req=isRequest?new Request(input,init||{}):null;" +
    "var raw=req?req.url:input,mapped=mapUrl(raw);" +
    "if(typeof mapped!=='string')return nativeFetch(input,init);" +
    "var source=req;" +
    "if(!source){source=new Request(mapped,init||{});}" +
    "else if(mapped===source.url)return nativeFetch(source);" +
    "var options={method:source.method,headers:source.headers,mode:'cors',credentials:'omit',cache:source.cache," +
    "redirect:'follow',referrerPolicy:'strict-origin-when-cross-origin',signal:source.signal};" +
    "if(source.method!=='GET'&&source.method!=='HEAD'&&source.body){options.body=source.body;options.duplex='half';}" +
    "return nativeFetch(new Request(mapped,options));}catch(e){return Promise.reject(e);}};" +
    "var xhrOpen=XMLHttpRequest.prototype.open;" +
    "XMLHttpRequest.prototype.open=function(method,url,async,user,password){" +
    "var result=xhrOpen.call(this,method,mapUrl(url),async!==false,user,password);" +
    "try{Object.defineProperty(this,'withCredentials',{configurable:true,get:function(){return false;},set:function(){}});}catch(e){}" +
    "return result;};" +
    "if(navigator.sendBeacon){var beacon=navigator.sendBeacon.bind(navigator);" +
    "navigator.sendBeacon=function(url,data){return beacon(mapUrl(url),data);};}" +
    "var NativeWebSocket=window.WebSocket;" +
    "function mapWebSocketUrl(value){try{var raw=value instanceof URL?value.href:String(value);" +
    "var u=new URL(raw,base);if(u.protocol==='http:')u.protocol='ws:';else if(u.protocol==='https:')u.protocol='wss:';" +
    "if(u.protocol!=='ws:'&&u.protocol!=='wss:')return raw;" +
    "var worker=new URL(origin);if(u.host===worker.host&&u.pathname.indexOf(prefix)===0)return u.href;" +
    "worker.protocol='wss:';worker.pathname=prefix+u.protocol.slice(0,-1)+'/'+encodeURIComponent(u.host)+u.pathname;" +
    "worker.search=u.search;worker.hash='';return worker.href;}catch(e){return value;}}" +
    "function NavyWebSocket(url,protocols){var mapped=mapWebSocketUrl(url);" +
    "return protocols===undefined?new NativeWebSocket(mapped):new NativeWebSocket(mapped,protocols);}" +
    "NavyWebSocket.prototype=NativeWebSocket.prototype;Object.setPrototypeOf(NavyWebSocket,NativeWebSocket);" +
    "window.WebSocket=NavyWebSocket;" +
    "})(" + config + ");</script>";
}

function resolveUrl(raw, base, origin, sessionId) {
  if (!raw || /^\s*(?:data:|blob:|javascript:|mailto:|tel:|about:|#)/i.test(raw)) return raw;
  try {
    const target = new URL(raw, base);
    if (!["http:", "https:"].includes(target.protocol)) return raw;
    return proxyUrl(target, origin, sessionId);
  } catch (_) { return raw; }
}

function rewriteSrcset(value, base, origin, sessionId) {
  let output = "", index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,]/.test(value[index])) output += value[index++];
    if (index >= value.length) break;
    const start = index;
    const dataUrl = value.slice(index, index + 5).toLowerCase() === "data:";
    while (index < value.length && !/\s/.test(value[index]) &&
      (dataUrl || value[index] !== ",")) index++;
    output += resolveUrl(value.slice(start, index), base, origin, sessionId);
    while (index < value.length && value[index] !== ",") output += value[index++];
    if (index < value.length) output += value[index++];
  }
  return output;
}

function rewriteCss(value, base, origin, sessionId) {
  let css = value.replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi,
    function (whole, quote, quoted, unquoted) {
      const raw = (quoted !== undefined ? quoted : unquoted || "").trim();
      if (!raw) return whole;
      return "url(" + (quote || "") +
        resolveUrl(raw, base, origin, sessionId) + (quote || "") + ")";
    });
  css = css.replace(/(@import\s+)(["'])([^"']+)(["'])/gi,
    function (whole, prefix, open, raw, close) {
      return prefix + open + resolveUrl(raw, base, origin, sessionId) + close;
    });
  return css;
}

function sanitizeResponseHeaders(source) {
  const headers = new Headers(source);
  [
    "set-cookie", "set-cookie2", "content-security-policy",
    "content-security-policy-report-only", "x-frame-options",
    "content-length", "content-encoding", "transfer-encoding",
    "connection", "keep-alive", "alt-svc", "strict-transport-security",
    "cross-origin-opener-policy", "cross-origin-embedder-policy",
    "cross-origin-resource-policy", "x-navy-final-url"
  ].forEach(function (name) { headers.delete(name); });
  return headers;
}

function rewriteHtml(response, route, finalUrl, requestUrl) {
  const headers = sanitizeResponseHeaders(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", "*");
  const context = { baseUrl: finalUrl };
  const bootstrap = makeBootstrap(route.sessionId, finalUrl, requestUrl.origin);
  const origin = requestUrl.origin;

  const elementHandler = {
    element: function (element) {
      const tag = element.tagName.toLowerCase();
      if (tag === "meta" && (element.getAttribute("http-equiv") || "").toLowerCase() === "content-security-policy") {
        element.remove();
        return;
      }
      if (tag === "base") {
        const href = element.getAttribute("href");
        if (href) {
          try {
            context.baseUrl = new URL(href, context.baseUrl).href;
            element.setAttribute("href", proxyUrl(new URL(context.baseUrl), origin, route.sessionId));
            element.after("<script>window.__NAVY_SET_BASE__&&window.__NAVY_SET_BASE__(" +
              JSON.stringify(context.baseUrl).replace(/</g, "\\u003c") + ");</script>", { html: true });
          } catch (_) { element.remove(); }
        } else { element.remove(); }
        return;
      }

      [
        "href", "src", "action", "formaction", "poster", "data", "cite",
        "background", "longdesc", "manifest", "xlink:href"
      ].forEach(function (attribute) {
        const value = element.getAttribute(attribute);
        if (value !== null) {
          element.setAttribute(attribute, resolveUrl(value, context.baseUrl, origin, route.sessionId));
        }
      });

      const srcset = element.getAttribute("srcset");
      if (srcset !== null) {
        element.setAttribute("srcset", rewriteSrcset(srcset, context.baseUrl, origin, route.sessionId));
      }

      const style = element.getAttribute("style");
      if (style !== null) {
        element.setAttribute("style", rewriteCss(style, context.baseUrl, origin, route.sessionId));
      }

      if (tag === "meta" &&
          (element.getAttribute("http-equiv") || "").toLowerCase() === "refresh") {
        const content = element.getAttribute("content") || "";
        const match = content.match(/^(\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*)(.*)$/i);
        if (match) {
          const raw = match[2].replace(/^["']|["']$/g, "");
          element.setAttribute("content", match[1] +
            resolveUrl(raw, context.baseUrl, origin, route.sessionId));
        }
      }
    }
  };

  return new HTMLRewriter()
    .on("head", {
      element: function (element) { element.prepend(bootstrap, { html: true }); }
    })
    .on("*", elementHandler)
    .on("style", {
      text: function (text) {
        text.replace(rewriteCss(text.text, context.baseUrl, origin, route.sessionId));
      }
    })
    .transform(new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isWebSocketRequest = (request.headers.get("upgrade") || "").toLowerCase() === "websocket";

    // Endpoint de diagnóstico: recibe datos de prueba y los devuelve sin almacenarlos.
    if (url.pathname === "/__navy_test/echo") {
      if (request.method !== "POST") {
        return json({ error: "Este endpoint de prueba solo acepta POST." }, 405, {
          ...corsHeaders(request), "Allow": "POST, OPTIONS"
        });
      }
      const testLimit = 16 * 1024;
      const declaredLength = Number(request.headers.get("content-length") || 0);
      if (declaredLength > testLimit) {
        return json({ error: "La prueba admite como máximo 16 KB." }, 413, corsHeaders(request));
      }
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).length > testLimit) {
        return json({ error: "La prueba admite como máximo 16 KB." }, 413, corsHeaders(request));
      }
      const contentType = request.headers.get("content-type") || "";
      const fields = {};
      try {
        const params = new URLSearchParams(rawBody);
        for (const [key, value] of params.entries()) fields[key] = value;
      } catch (_) {}
      return json({
        ok: true,
        message: "El POST llegó correctamente al endpoint de prueba.",
        method: request.method,
        contentType: contentType,
        bodyLength: new TextEncoder().encode(rawBody).length,
        receivedBody: rawBody,
        fields: fields
      }, 200, corsHeaders(request));
    }

    // Endpoint de diagnóstico de cookies: permite comprobar persistencia dentro de una sesión Navy.
    if (url.pathname === "/__navy_test/cookie") {
      const mode = url.searchParams.get("mode") || "read";
      if (mode === "set") {
        return json({ ok: true, message: "Cookie de prueba emitida." }, 200, {
          ...corsHeaders(request),
          "Set-Cookie": "navy_session_test=navy-cookie-ok; Path=/__navy_test/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"
        });
      }
      if (mode === "read") {
        const cookieHeader = request.headers.get("cookie") || "";
        const found = cookieHeader.split(";").map(function (part) { return part.trim(); })
          .find(function (part) { return part.startsWith("navy_session_test="); });
        return json({
          ok: true,
          cookieReceived: Boolean(found),
          cookieValue: found ? found.slice("navy_session_test=".length) : null,
          message: found ? "La cookie llegó al servidor." : "No se recibió la cookie."
        }, 200, corsHeaders(request));
      }
      return json({ error: "Usa mode=set o mode=read." }, 400, corsHeaders(request));
    }

    if (isWebSocketRequest && request.method !== "GET") {
      return new Response("WebSocket requiere el método GET.", { status: 405 });
    }
    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method)) {
      return json({ error: "Método HTTP no soportado." }, 405, { ...corsHeaders(request), "Allow": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS" });
    }

    if (request.method === "OPTIONS" &&
        request.headers.has("Access-Control-Request-Method")) {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "Navy Proxy",
        version: "1.0.0",
        allowlistConfigured: Boolean(String(env.ALLOWED_HOSTS || "").trim()),
        durableObjects: Boolean(env.SESSIONS)
      }, 200, corsHeaders(request));
    }

    const route = parseProxyPath(url);
    if (!route) return json({
      error: "Ruta no válida.",
      usage: "/p/<session-id>/https/<host>/<path> (también ws/wss para WebSocket)",
      debug: {
        method: request.method,
        pathname: url.pathname,
        segments: url.pathname.split("/").slice(1)
      }
    }, 404, corsHeaders(request));

    const targetIsWebSocket = route.target.protocol === "ws:" || route.target.protocol === "wss:";
    if (targetIsWebSocket !== isWebSocketRequest) {
      return new Response("El esquema de la ruta y el tipo de solicitud no coinciden.", { status: 400 });
    }

    if (!isAllowedTarget(route.target, env)) {
      return json({
        error: "Destino no autorizado.",
        detail: "Añade el hostname exacto a ALLOWED_HOSTS en wrangler.jsonc. No se permiten direcciones privadas."
      }, 403, corsHeaders(request));
    }

    const bodyLimit = Math.max(1024, Number(env.MAX_BODY_BYTES) || DEFAULT_BODY_LIMIT);
    if (Number(request.headers.get("content-length") || 0) > bodyLimit) {
      return json({ error: "El cuerpo supera el límite permitido de " + bodyLimit + " bytes." },
        413, corsHeaders(request));
    }
    if (!env.SESSIONS) {
      return json({ error: "Falta configurar el binding SESSIONS de Durable Objects." },
        500, corsHeaders(request));
    }

    const id = env.SESSIONS.idFromName(route.sessionId);
    const session = env.SESSIONS.get(id);

    let upstream;
    try {
      if (isWebSocketRequest) {
        // Cloudflare requiere que el handshake original llegue intacto al Durable Object.
        upstream = await session.fetch(request);
      } else {
        const headers = new Headers(request.headers);
        headers.set("X-Navy-Target", route.target.href);

        const referer = originalUrlFromProxy(request.headers.get("referer") || "");
        if (referer) headers.set("X-Navy-Referer", referer.href);

        const internalRequest = new Request("https://navy-session.internal/request", {
          method: request.method,
          headers: headers,
          body: (request.method === "GET" || request.method === "HEAD") ? undefined : request.body,
          redirect: "manual"
        });
        upstream = await session.fetch(internalRequest);
      }
    } catch (error) {
      return json({
        error: "No se pudo completar la petición al destino.",
        detail: error && error.message ? error.message : "Error de red del Worker."
      }, 502, corsHeaders(request));
    }

    // La respuesta 101 conserva el WebSocket entregado por el Durable Object.
    if (isWebSocketRequest) return upstream;

    // Si una redirección HTTP llega hasta el Worker exterior, reescribir Location
    // para que el navegador continúe dentro de la misma sesión Navy.
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get("Location");
      if (location) {
        try {
          const destination = new URL(location, route.target);
          if (["http:", "https:"].includes(destination.protocol) && isAllowedTarget(destination, env)) {
            const redirectHeaders = new Headers(upstream.headers);
            redirectHeaders.set("Location", proxyUrl(destination, url.origin, route.sessionId));
            upstream = new Response(upstream.body, {
              status: upstream.status,
              statusText: upstream.statusText,
              headers: redirectHeaders
            });
          }
        } catch (_) {}
      }
    }

    const finalUrl = upstream.headers.get("X-Navy-Final-URL") || route.target.href;
    const outHeaders = sanitizeResponseHeaders(upstream.headers);
    Object.entries(corsHeaders(request)).forEach(function (entry) {
      outHeaders.set(entry[0], entry[1]);
    });

    const contentType = (outHeaders.get("content-type") || "").toLowerCase();
    const fetchMode = request.headers.get("sec-fetch-mode") || "";
    const acceptHeader = request.headers.get("accept") || "";
    const isDocumentNavigation = fetchMode === "navigate" || acceptHeader.includes("text/html");
    if (contentType.includes("text/html") && upstream.body && isDocumentNavigation) {
      try {
        const transformed = rewriteHtml(upstream, route, finalUrl, url);
        const finalHeaders = new Headers(transformed.headers);
        Object.entries(corsHeaders(request)).forEach(function (entry) {
          finalHeaders.set(entry[0], entry[1]);
        });
        return new Response(transformed.body, {
          status: transformed.status,
          statusText: transformed.statusText,
          headers: finalHeaders
        });
      } catch (error) {
        return json({
          error: "No se pudo reescribir el documento HTML.",
          detail: error && error.message ? error.message : "Error de HTMLRewriter."
        }, 502, corsHeaders(request));
      }
    }

    if (contentType.includes("text/css") && upstream.body) {
      const css = await upstream.text();
      const rewrittenCss = rewriteCss(css, finalUrl, url.origin, route.sessionId);
      return new Response(rewrittenCss, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: outHeaders
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders
    });
  }
};

export class SessionStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    let target;
    const isWebSocketRequest = (request.headers.get("upgrade") || "").toLowerCase() === "websocket";
    try {
      const targetHeader = request.headers.get("X-Navy-Target");
      if (targetHeader) {
        target = new URL(targetHeader);
      } else if (isWebSocketRequest) {
        const proxyRoute = parseProxyPath(new URL(request.url));
        if (!proxyRoute) throw new Error("La ruta proxy de WebSocket no es válida.");
        target = proxyRoute.target;
      } else {
        throw new Error("URL de destino ausente o inválida.");
      }
    } catch (error) {
      return json({ error: "URL de destino ausente o inválida.", detail: error.message }, 400);
    }
    if (!isAllowedTarget(target, this.env)) return json({ error: "Destino no autorizado en la sesión." }, 403);
    const sessionTtl = Math.max(300, Number(this.env.SESSION_TTL_SECONDS) || 7200);
    await this.ctx.storage.setAlarm(Date.now() + sessionTtl * 1000);

    // Diagnóstico HTTP: prueba la conexión WebSocket saliente desde el Durable Object
    // sin depender del handshake entrante del navegador.
    if (target.hostname === "navy.ulisesdrojasc2.workers.dev" &&
        target.pathname === "/__navy_test/websocket-diagnostic" && !isWebSocketRequest) {
      const diagnosticUrl = "https://ws.postman-echo.com/raw";
      const startedAt = Date.now();
      try {
        const diagnosticResponse = await fetch(diagnosticUrl, {
          headers: { "Upgrade": "websocket" },
          signal: AbortSignal.timeout(10000)
        });
        const diagnosticSocket = diagnosticResponse.webSocket;
        if (diagnosticSocket) {
          diagnosticSocket.accept({ allowHalfOpen: true });
          diagnosticSocket.close(1000, "diagnostic complete");
        }
        return json({
          ok: Boolean(diagnosticSocket),
          stage: "outbound-handshake-completed",
          target: diagnosticUrl,
          httpStatus: diagnosticResponse.status,
          webSocketReturned: Boolean(diagnosticSocket),
          elapsedMs: Date.now() - startedAt
        }, diagnosticSocket ? 200 : 502);
      } catch (error) {
        return json({
          ok: false,
          stage: "outbound-handshake-failed",
          target: diagnosticUrl,
          errorName: error && error.name ? error.name : "Error",
          error: error && error.message ? error.message : String(error),
          elapsedMs: Date.now() - startedAt
        }, 502);
      }
    }

    if (isWebSocketRequest) {
      if (request.method !== "GET" || !["ws:", "wss:"].includes(target.protocol)) {
        return json({
          error: "Solicitud WebSocket no válida.",
          method: request.method,
          upgrade: request.headers.get("Upgrade") || "ausente",
          targetProtocol: target.protocol
        }, 400);
      }
      return this.handleWebSocket(target, request);
    }

    const limit = Math.max(1024, Number(this.env.MAX_BODY_BYTES) || DEFAULT_BODY_LIMIT);
    if (Number(request.headers.get("content-length") || 0) > limit) {
      return json({ error: "Cuerpo demasiado grande." }, 413);
    }

    let body = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer();
      if (body.byteLength > limit) return json({ error: "Cuerpo demasiado grande." }, 413);
    }

    let method = request.method.toUpperCase();
    const initialOrigin = target.origin;
    let current = target;
    let currentBody = body;
    let upstreamResponse = null;
    const visitedHosts = [];
    const headerObservations = [];
    let stripSensitiveHeaders = false;
    const maxRedirects = Math.min(10, Math.max(0,
      Number(this.env.MAX_REDIRECTS) || MAX_REDIRECTS));

    for (let hop = 0; hop <= maxRedirects; hop++) {
      visitedHosts.push(current.hostname);
      if (!isAllowedTarget(current, this.env)) {
        return json({
          error: "La redirección conduce a un dominio no autorizado.",
          destination: current.hostname
        }, 403);
      }

      const headers = this.buildUpstreamHeaders(request.headers);
      if (method === "GET" || method === "HEAD") {
        headers.delete("content-type");
        headers.delete("content-length");
      }
      if (stripSensitiveHeaders || current.origin !== initialOrigin) {
        ["authorization", "x-api-key", "x-csrf-token", "x-xsrf-token"].forEach(function (name) {
          headers.delete(name);
        });
      }
      const cookieHeader = await this.getCookieHeader(current);
      if (cookieHeader) headers.set("cookie", cookieHeader);
      const referer = request.headers.get("X-Navy-Referer");
      if (referer) headers.set("referer", referer);
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        let sourceOrigin = current.origin;
        if (referer) {
          try { sourceOrigin = new URL(referer).origin; } catch (_) {}
        }
        headers.set("origin", sourceOrigin);
      }
      headerObservations.push({
        host: current.hostname,
        authorization: headers.get("authorization"),
        apiKey: headers.get("x-api-key"),
        csrfToken: headers.get("x-csrf-token"),
        xsrfToken: headers.get("x-xsrf-token"),
        accept: headers.get("accept"),
        contentType: headers.get("content-type"),
        requestedWith: headers.get("x-requested-with")
      });

      // Endpoints locales para probar cabeceras y códigos HTTP sin depender de terceros.
      if (current.hostname === "navy.ulisesdrojasc2.workers.dev" &&
          current.pathname === "/__navy_test/headers") {
        const testBody = currentBody ? new TextDecoder().decode(currentBody) : "";
        upstreamResponse = new Response(JSON.stringify({
          ok: true,
          method: method,
          body: testBody,
          bodyLength: currentBody ? currentBody.byteLength : 0,
          headers: headerObservations[headerObservations.length - 1]
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
        break;
      }

      if (current.hostname === "navy.ulisesdrojasc2.workers.dev" &&
          current.pathname === "/__navy_test/status") {
        const status = Number(current.searchParams.get("code"));
        if (![401, 403, 500].includes(status)) {
          return json({ error: "Usa los códigos 401, 403 o 500." }, 400);
        }
        upstreamResponse = new Response(JSON.stringify({
          ok: false,
          simulatedStatus: status,
          message: "Respuesta HTTP de prueba " + status
        }), {
          status: status,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
        break;
      }

      // Rutas locales de diagnóstico para probar redirecciones sin depender de terceros.
      if (current.hostname === "navy.ulisesdrojasc2.workers.dev" &&
          current.pathname === "/__navy_test/redirect") {
        const status = Number(current.searchParams.get("status"));
        const validStatuses = [301, 302, 307, 308];
        if (!validStatuses.includes(status)) {
          return json({ error: "Código de redirección no válido. Usa 301, 302, 307 o 308." }, 400);
        }
        const crossDomain = current.searchParams.get("crossDomain") === "1";
        const destination = crossDomain
          ? new URL("https://example.com/__navy_test/bridge?status=" + status, current.origin)
          : new URL("/__navy_test/final?status=" + status, current.origin);
        upstreamResponse = new Response(null, {
          status: 200,
          headers: {
            "Location": destination.href,
            "X-Navy-Test-Redirect-Status": String(status)
          }
        });
        // No salir del bucle: la respuesta debe pasar por el manejador común de Location.
      }

      if (!upstreamResponse && current.hostname === "example.com" &&
          current.pathname === "/__navy_test/bridge") {
        const status = Number(current.searchParams.get("status"));
        upstreamResponse = new Response(null, {
          status: 200,
          headers: {
            "Location": "https://navy.ulisesdrojasc2.workers.dev/__navy_test/final?status=" + status,
            "X-Navy-Test-Redirect-Status": String(status)
          }
        });
      }

      if (!upstreamResponse && current.hostname === "navy.ulisesdrojasc2.workers.dev" &&
          current.pathname === "/__navy_test/final") {
        const status = Number(current.searchParams.get("status"));
        const finalBody = currentBody ? new TextDecoder().decode(currentBody) : "";
        upstreamResponse = new Response(JSON.stringify({
          ok: true,
          reachedFinal: true,
          redirectStatus: status,
          finalMethod: method,
          finalPath: current.pathname,
          finalBody: finalBody,
          finalBodyLength: currentBody ? currentBody.byteLength : 0,
          visitedHosts: visitedHosts,
          headerObservations: headerObservations
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
        break;
      }

      // Endpoint local de prueba: evita que el Worker se haga una petición a sí mismo.
      // La cookie se guarda en el Durable Object de esta sesión, igual que una cookie upstream.
      if (current.hostname === "navy.ulisesdrojasc2.workers.dev" &&
          current.pathname === "/__navy_test/cookie" && method === "GET") {
        const mode = current.searchParams.get("mode") || "read";
        if (mode === "set") {
          upstreamResponse = new Response(JSON.stringify({
            ok: true, message: "Cookie de prueba emitida para esta sesión Navy."
          }), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "set-cookie": "navy_session_test=navy-cookie-ok; Path=/__navy_test/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"
            }
          });
          await this.storeSetCookies(upstreamResponse.headers, current);
        } else if (mode === "read") {
          const cookieHeader = await this.getCookieHeader(current);
          const found = cookieHeader.split(";").map(function (part) { return part.trim(); })
            .find(function (part) { return part.startsWith("navy_session_test="); });
          upstreamResponse = new Response(JSON.stringify({
            ok: true,
            cookieReceived: Boolean(found),
            cookieValue: found ? found.slice("navy_session_test=".length) : null,
            message: found ? "La cookie llegó a esta sesión Navy." : "Esta sesión no tiene la cookie."
          }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
        } else {
          return json({ error: "Usa mode=set o mode=read." }, 400);
        }
        break;
      }

      if (!upstreamResponse) {
        try {
          upstreamResponse = await fetch(current.href, {
            method: method,
            headers: headers,
            body: (method === "GET" || method === "HEAD") ? undefined : currentBody,
            redirect: "manual"
          });
        } catch (error) {
          return json({
            error: "Error de conexión con el sitio de destino.",
            destination: current.hostname,
            detail: error && error.message ? error.message : "Fallo DNS o de red."
          }, 502);
        }
      }

      await this.storeSetCookies(upstreamResponse.headers, current);
      const location = upstreamResponse.headers.get("location");
      const simulatedStatus = Number(upstreamResponse.headers.get("X-Navy-Test-Redirect-Status"));
      const redirectStatusForFlow = [301, 302, 303, 307, 308].includes(simulatedStatus)
        ? simulatedStatus : upstreamResponse.status;
      const redirect = [301, 302, 303, 307, 308].includes(redirectStatusForFlow);
      if (!redirect || !location) break;

      if (hop === maxRedirects) {
        return json({ error: "Se alcanzó el máximo de redirecciones (" + maxRedirects + ")." }, 508);
      }

      let next;
      try { next = new URL(location, current); }
      catch (_) { return json({ error: "Cabecera Location inválida." }, 502); }
      if (!isAllowedTarget(next, this.env)) {
        return json({
          error: "Redirección bloqueada: el dominio de destino no está autorizado.",
          destination: next.hostname
        }, 403);
      }

      const redirectStatus = redirectStatusForFlow;
      if (upstreamResponse.body) {
        try { await upstreamResponse.body.cancel(); } catch (_) {}
      }
      // La respuesta del salto anterior ya fue consumida; el siguiente destino
      // debe generar su propia respuesta dentro del bucle.
      upstreamResponse = null;

      if (redirectStatus === 303 ||
          ((redirectStatus === 301 || redirectStatus === 302) && method === "POST")) {
        method = "GET";
        currentBody = null;
      }
      if (next.origin !== initialOrigin) stripSensitiveHeaders = true;
      current = next;
    }

    if (!upstreamResponse) return json({ error: "No se recibió respuesta del destino." }, 502);

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("X-Navy-Final-URL", current.href);
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  }

  async handleWebSocket(target, incoming) {
    const upstreamUrl = new URL(target.href);
    upstreamUrl.protocol = target.protocol === "wss:" ? "https:" : "http:";
    const headers = new Headers({ "Upgrade": "websocket", "Origin": upstreamUrl.origin });
    const protocol = incoming.headers.get("sec-websocket-protocol");
    if (protocol) headers.set("sec-websocket-protocol", protocol);
    const userAgent = incoming.headers.get("user-agent");
    if (userAgent) headers.set("user-agent", userAgent);
    const acceptLanguage = incoming.headers.get("accept-language");
    if (acceptLanguage) headers.set("accept-language", acceptLanguage);
    const cookieHeader = await this.getCookieHeader(upstreamUrl);
    if (cookieHeader) headers.set("cookie", cookieHeader);

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstreamUrl.href, {
        method: "GET",
        headers: headers,
        redirect: "manual",
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      return json({
        error: "No se pudo establecer la conexión WebSocket con el destino.",
        destination: upstreamUrl.hostname,
        detail: error && error.message ? error.message : "Error de conexión WebSocket."
      }, 502);
    }

    const upstreamSocket = upstreamResponse.webSocket;
    if (!upstreamSocket) {
      let detail = "";
      try { detail = (await upstreamResponse.text()).slice(0, 1000); } catch (_) {}
      return json({
        error: "El destino rechazó la actualización a WebSocket.",
        status: upstreamResponse.status,
        detail: detail || "La respuesta no incluyó un canal WebSocket."
      }, 502);
    }

    await this.storeSetCookies(upstreamResponse.headers, upstreamUrl);
    const pair = new WebSocketPair();
    const clientSocket = pair[0], serverSocket = pair[1];
    serverSocket.accept();
    upstreamSocket.binaryType = "arraybuffer";
    upstreamSocket.accept({ allowHalfOpen: true });

    serverSocket.addEventListener("message", function (event) {
      if (upstreamSocket.readyState === WebSocket.OPEN) {
        try { upstreamSocket.send(event.data); }
        catch (_) { try { serverSocket.close(1011, "No se pudo reenviar el mensaje."); } catch (_) {} }
      }
    });
    upstreamSocket.addEventListener("message", function (event) {
      if (serverSocket.readyState === WebSocket.OPEN) {
        try { serverSocket.send(event.data); }
        catch (_) { try { upstreamSocket.close(1011, "No se pudo reenviar el mensaje."); } catch (_) {} }
      }
    });
    serverSocket.addEventListener("close", function (event) {
      try {
        if (upstreamSocket.readyState === WebSocket.OPEN || upstreamSocket.readyState === WebSocket.CONNECTING) {
          upstreamSocket.close(event.code || 1000, String(event.reason || "").slice(0, 123));
        }
      } catch (_) {}
    });
    upstreamSocket.addEventListener("close", function (event) {
      try {
        if (serverSocket.readyState === WebSocket.OPEN || serverSocket.readyState === WebSocket.CONNECTING) {
          serverSocket.close(event.code || 1000, String(event.reason || "").slice(0, 123));
        }
      } catch (_) {}
    });
    serverSocket.addEventListener("error", function () {
      try { if (upstreamSocket.readyState === WebSocket.OPEN) upstreamSocket.close(1011, "Error en el túnel Navy."); } catch (_) {}
    });
    upstreamSocket.addEventListener("error", function () {
      try { if (serverSocket.readyState === WebSocket.OPEN) serverSocket.close(1011, "Error en el destino WebSocket."); } catch (_) {}
    });

    const responseHeaders = new Headers();
    const selectedProtocol = upstreamResponse.headers.get("sec-websocket-protocol");
    if (selectedProtocol) responseHeaders.set("sec-websocket-protocol", selectedProtocol);
    return new Response(null, { status: 101, webSocket: clientSocket, headers: responseHeaders });
  }

  buildUpstreamHeaders(incoming) {
    const allowed = [
      "accept", "accept-language", "content-type", "authorization",
      "range", "if-range", "if-none-match", "if-modified-since",
      "cache-control", "pragma", "user-agent", "x-requested-with",
      "x-csrf-token", "x-xsrf-token", "x-api-key"
    ];
    const headers = new Headers();
    allowed.forEach(function (name) {
      const value = incoming.get(name);
      if (value !== null) headers.set(name, value);
    });
    headers.set("accept-encoding", "identity");
    return headers;
  }

  async getCookieHeader(target) {
    const cookies = await this.ctx.storage.get(COOKIE_KEY) || [];
    const now = Date.now(), host = target.hostname.toLowerCase();
    const path = target.pathname || "/", secure = target.protocol === "https:";
    const matching = cookies.filter(function (cookie) {
      if (cookie.expiresAt && cookie.expiresAt <= now) return false;
      const domain = cookie.domain.toLowerCase();
      const domainMatch = cookie.hostOnly ? host === domain :
        (host === domain || host.endsWith("." + domain));
      const pathMatch = path === cookie.path || (path.startsWith(cookie.path) &&
        (cookie.path.endsWith("/") || path.charAt(cookie.path.length) === "/"));
      return domainMatch && pathMatch && (!cookie.secure || secure);
    }).sort(function (a, b) { return b.path.length - a.path.length; });
    return matching.map(function (cookie) {
      return cookie.name + "=" + cookie.value;
    }).join("; ");
  }

  async storeSetCookies(headers, requestUrl) {
    let setCookies = [];
    try { setCookies = headers.getAll("Set-Cookie"); }
    catch (_) {
      const single = headers.get("Set-Cookie");
      if (single) setCookies = [single];
    }
    if (!setCookies.length) return;

    const additions = [], deletions = [], now = Date.now();
    for (const raw of setCookies) {
      const parts = raw.split(";");
      const first = parts.shift() || "";
      const separator = first.indexOf("=");
      if (separator <= 0) continue;
      const name = first.slice(0, separator).trim();
      const value = first.slice(separator + 1).trim();
      if (!name || /[\s;,]/.test(name)) continue;

      let domain = requestUrl.hostname.toLowerCase();
      let hostOnly = true, path = defaultCookiePath(requestUrl.pathname);
      let secure = false, httpOnly = false, expiresAt = 0, maxAge = null;

      for (const part of parts) {
        const index = part.indexOf("=");
        const key = (index < 0 ? part : part.slice(0, index)).trim().toLowerCase();
        const attributeValue = index < 0 ? "" : part.slice(index + 1).trim();
        if (key === "domain") {
          const candidate = attributeValue.replace(/^\./, "").toLowerCase();
          const publicSuffixes = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "com.br", "com.mx", "co.jp", "co.kr", "com.sg", "com.tr"]);
          if (!candidate || candidate.split(".").length < 2 || publicSuffixes.has(candidate) ||
              !(requestUrl.hostname === candidate || requestUrl.hostname.endsWith("." + candidate))) {
            domain = ""; break;
          }
          domain = candidate;
          hostOnly = false;
        } else if (key === "path" && attributeValue.startsWith("/")) path = attributeValue;
        else if (key === "secure") secure = true;
        else if (key === "httponly") httpOnly = true;
        else if (key === "max-age" && /^-?\d+$/.test(attributeValue)) maxAge = Number(attributeValue);
        else if (key === "expires") {
          const parsed = Date.parse(attributeValue);
          if (Number.isFinite(parsed)) expiresAt = parsed;
        }
      }

      if (!domain) continue;
      if (name.startsWith("__Secure-") && !secure) continue;
      if (name.startsWith("__Host-") && (!secure || !hostOnly || path !== "/")) continue;
      if (maxAge !== null) expiresAt = maxAge <= 0 ? now - 1 : now + maxAge * 1000;
      // Session cookies are retained for a bounded time in this temporary proxy session.
      if (!expiresAt) {
        const ttlSeconds = Math.max(300, Number(this.env.SESSION_TTL_SECONDS) || 7200);
        expiresAt = now + ttlSeconds * 1000;
      }

      const cookie = {
        name: name, value: value, domain: domain, hostOnly: hostOnly,
        path: path, secure: secure, httpOnly: httpOnly, expiresAt: expiresAt || 0
      };
      const key = name + "|" + domain + "|" + path;
      if (expiresAt && expiresAt <= now) deletions.push(key);
      else additions.push({ key: key, cookie: cookie });
    }

    await this.ctx.storage.transaction(async function (txn) {
      const current = await txn.get(COOKIE_KEY) || [];
      const map = new Map();
      current.forEach(function (cookie) {
        map.set(cookie.name + "|" + cookie.domain + "|" + cookie.path, cookie);
      });
      deletions.forEach(function (key) { map.delete(key); });
      additions.forEach(function (entry) { map.set(entry.key, entry.cookie); });
      await txn.put(COOKIE_KEY, Array.from(map.values()).slice(-180));
    });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

function defaultCookiePath(path) {
  if (!path || path.charAt(0) !== "/" || path === "/") return "/";
  const lastSlash = path.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : path.slice(0, lastSlash);
}
