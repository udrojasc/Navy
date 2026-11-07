document.addEventListener("DOMContentLoaded", async () => {
  const set = (id, message) => { document.getElementById(id).textContent = message; };
  set("js-check", "JavaScript: correcto");
  set("css-check", getComputedStyle(document.body).backgroundImage !== "none"
    ? "CSS: correcto" : "CSS: no detectado");

  const image = document.getElementById("test-image");
  const checkImage = () => {
    set("image-check", image.naturalWidth > 0
      ? "Imagen: cargada correctamente"
      : "Imagen: ERROR al cargar");
  };
  image.addEventListener("load", checkImage);
  image.addEventListener("error", () => set("image-check", "Imagen: ERROR al cargar"));
  // La imagen puede terminar de cargar antes de que DOMContentLoaded ejecute este script.
  if (image.complete) checkImage();

  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    set("fetch-check", "Fetch: correcto — " + data.message);
  } catch (error) {
    set("fetch-check", "Fetch: ERROR — " + error.message);
  }

  const postForm = document.getElementById("post-form");
  const postResult = document.getElementById("post-result");
  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("post-button");
    button.disabled = true;
    postResult.textContent = "POST: enviando…";
    try {
      const formData = new FormData(postForm);
      const body = new URLSearchParams();
      for (const [key, value] of formData.entries()) body.append(key, value);
      const endpoint = new URL(
        "/p/550e8400-e29b-41d4-a716-446655440000/https/navy.ulisesdrojasc2.workers.dev/__navy_test/echo",
        "https://navy.ulisesdrojasc2.workers.dev"
      );
      const response = await fetch(endpoint.href, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString()
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "HTTP " + response.status);
      postResult.textContent = [
        "POST: correcto",
        "Método recibido: " + result.method,
        "Tipo de contenido: " + result.contentType,
        "Bytes recibidos: " + result.bodyLength,
        "Campos recibidos:",
        JSON.stringify(result.fields, null, 2)
      ].join("\n");
    } catch (error) {
      postResult.textContent = "POST: ERROR — " + error.message;
    } finally {
      button.disabled = false;
    }
  });

  const cookieButton = document.getElementById("cookie-button");
  const cookieResult = document.getElementById("cookie-result");
  cookieButton.addEventListener("click", async () => {
    cookieButton.disabled = true;
    cookieResult.textContent = "Paso 1/3: creando cookie en la sesión A…";
    const worker = "https://navy.ulisesdrojasc2.workers.dev";
    const sessionA = "550e8400-e29b-41d4-a716-446655440000";
    const sessionB = "650e8400-e29b-41d4-a716-446655440000";
    const proxy = (session, mode) => worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/cookie?mode=" + mode;
    const getJson = async (url) => {
      const response = await fetch(url, { method: "GET" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "HTTP " + response.status);
      return data;
    };
    try {
      await getJson(proxy(sessionA, "set"));
      cookieResult.textContent = "Paso 2/3: comprobando la cookie en la misma sesión…";
      const sameSession = await getJson(proxy(sessionA, "read"));
      cookieResult.textContent = "Paso 3/3: comprobando el aislamiento de la sesión B…";
      const otherSession = await getJson(proxy(sessionB, "read"));
      const sameOk = sameSession.cookieReceived && sameSession.cookieValue === "navy-cookie-ok";
      const isolatedOk = !otherSession.cookieReceived;
      cookieResult.textContent = [
        "Cookies: " + (sameOk && isolatedOk ? "correcto" : "revisar"),
        "Misma sesión: " + (sameOk ? "cookie conservada correctamente" : "no se conservó la cookie"),
        "Sesión diferente: " + (isolatedOk ? "no recibió la cookie (aislamiento correcto)" : "recibió una cookie de otra sesión"),
        "",
        "Respuesta sesión A:", JSON.stringify(sameSession, null, 2),
        "",
        "Respuesta sesión B:", JSON.stringify(otherSession, null, 2)
      ].join("\n");
    } catch (error) {
      cookieResult.textContent = "Cookies: ERROR — " + error.message;
    } finally {
      cookieButton.disabled = false;
    }
  });

  const redirectButton = document.getElementById("redirect-button");
  const redirectResult = document.getElementById("redirect-result");
  redirectButton.addEventListener("click", async () => {
    redirectButton.disabled = true;
    const worker = "https://navy.ulisesdrojasc2.workers.dev";
    const session = "750e8400-e29b-41d4-a716-446655440000";
    const statuses = [301, 302, 307, 308];
    const results = [];
    try {
      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        redirectResult.textContent = "Probando redirección " + status + " (" + (i + 1) + "/4)…";
        const url = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/redirect?status=" + status + "&_navy_check=" + Date.now();
        const response = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store" });
        const responseUrl = response.url;
        const wasRedirected = response.redirected;
        const data = await response.json();
        const passed = response.ok && data.ok && data.reachedFinal &&
          data.redirectStatus === status && data.finalMethod === "GET";
        results.push({
          status: status,
          passed: passed,
          finalMethod: data.finalMethod || "—",
          reachedFinal: Boolean(data.reachedFinal),
          detail: passed ? "Destino final alcanzado" : (data.error || "Respuesta inesperada"),
          responseUrl: responseUrl,
          browserFollowedRedirect: wasRedirected
        });
        if (!passed) throw new Error("Falló la redirección " + status + ": " + JSON.stringify({
          response: data, finalUrl: responseUrl, browserFollowedRedirect: wasRedirected
        }));
      }
      // POST: 301/302 deben cambiar a GET; 307/308 deben conservar POST y el cuerpo.
      const postBody = "nombre=Ulises&mensaje=Prueba+de+redireccion+POST";
      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        redirectResult.textContent = "Probando POST con redirección " + status + " (" + (i + 1) + "/4)…";
        const url = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/redirect?status=" + status + "&_navy_check=" + Date.now();
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: postBody,
          redirect: "follow",
          cache: "no-store"
        });
        const data = await response.json();
        const expectedMethod = (status === 301 || status === 302) ? "GET" : "POST";
        const expectedBody = expectedMethod === "POST" ? postBody : "";
        const passed = response.ok && data.ok && data.reachedFinal &&
          data.redirectStatus === status && data.finalMethod === expectedMethod &&
          data.finalBody === expectedBody;
        results.push({
          status: status,
          test: "POST",
          passed: passed,
          finalMethod: data.finalMethod || "—",
          bodyPreserved: data.finalBody === expectedBody,
          detail: passed ? "Método y cuerpo correctos" : (data.error || "Método o cuerpo incorrecto"),
          responseUrl: response.url
        });
        if (!passed) throw new Error("Falló POST con redirección " + status + ": " + JSON.stringify(data));
      }

      // Salto entre dos dominios incluidos en la allowlist y regreso al destino final.
      redirectResult.textContent = "Probando redirección entre dominios…";
      const crossUrl = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/redirect?status=302&crossDomain=1&_navy_check=" + Date.now();
      const crossResponse = await fetch(crossUrl, { method: "GET", redirect: "follow", cache: "no-store" });
      const crossData = await crossResponse.json();
      const crossPassed = crossResponse.ok && crossData.ok && crossData.reachedFinal &&
        Array.isArray(crossData.visitedHosts) && crossData.visitedHosts.includes("example.com") &&
        crossData.visitedHosts.includes("navy.ulisesdrojasc2.workers.dev");
      results.push({
        status: 302,
        test: "Entre dominios",
        passed: crossPassed,
        visitedHosts: crossData.visitedHosts || [],
        detail: crossPassed ? "Navy cruzó example.com y llegó al destino final" : (crossData.error || "No se completó el salto entre dominios")
      });
      if (!crossPassed) throw new Error("Falló la redirección entre dominios: " + JSON.stringify(crossData));

      // Cabeceras permitidas: Authorization, API key, CSRF/XSRF, Accept y cabecera personalizada conocida.
      redirectResult.textContent = "Probando cabeceras HTTP y autenticación…";
      const headerUrl = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/headers?_navy_check=" + Date.now();
      const headerResponse = await fetch(headerUrl, {
        method: "GET",
        headers: {
          "Authorization": "Bearer navy-test-token",
          "X-API-Key": "navy-test-api-key",
          "X-CSRF-Token": "navy-test-csrf",
          "X-XSRF-Token": "navy-test-xsrf",
          "X-Requested-With": "Navy-Test",
          "Accept": "application/json"
        },
        cache: "no-store"
      });
      const headerData = await headerResponse.json();
      const observed = headerData.headers || {};
      const headersPassed = headerResponse.ok && headerData.ok &&
        observed.authorization === "Bearer navy-test-token" &&
        observed.apiKey === "navy-test-api-key" &&
        observed.csrfToken === "navy-test-csrf" &&
        observed.xsrfToken === "navy-test-xsrf" &&
        observed.requestedWith === "Navy-Test" &&
        observed.accept === "application/json";
      results.push({
        status: 200,
        test: "Cabeceras",
        passed: headersPassed,
        detail: headersPassed ? "Authorization, API key, CSRF/XSRF, Accept y X-Requested-With llegaron correctamente" : "Una o más cabeceras no llegaron",
        observedHeaders: observed
      });
      if (!headersPassed) throw new Error("Falló la prueba de cabeceras: " + JSON.stringify(headerData));

      const postHeaderUrl = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/headers?_navy_check=" + Date.now();
      const postHeaderBody = "campo=valor&origen=prueba";
      const postHeaderResponse = await fetch(postHeaderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "Accept": "application/json",
          "X-Requested-With": "Navy-POST-Test"
        },
        body: postHeaderBody,
        cache: "no-store"
      });
      const postHeaderData = await postHeaderResponse.json();
      const postObserved = postHeaderData.headers || {};
      const postHeadersPassed = postHeaderResponse.ok && postHeaderData.ok &&
        postObserved.contentType === "application/x-www-form-urlencoded;charset=UTF-8" &&
        postObserved.accept === "application/json" &&
        postObserved.requestedWith === "Navy-POST-Test" &&
        postHeaderData.method === "POST" && postHeaderData.body === postHeaderBody;
      results.push({
        status: 200,
        test: "Cabeceras POST",
        passed: postHeadersPassed,
        detail: postHeadersPassed ? "Content-Type, Accept, X-Requested-With y cuerpo POST conservados" : "No se conservaron todas las cabeceras o el cuerpo",
        observedHeaders: postObserved
      });
      if (!postHeadersPassed) throw new Error("Falló la prueba de cabeceras POST: " + JSON.stringify(postHeaderData));

      // Las credenciales se envían al origen inicial, pero deben desaparecer después de cruzar de dominio.
      redirectResult.textContent = "Comprobando protección de credenciales entre dominios…";
      const authCrossUrl = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/redirect?status=302&crossDomain=1&_navy_check=" + Date.now();
      const authCrossResponse = await fetch(authCrossUrl, {
        method: "GET",
        headers: {
          "Authorization": "Bearer navy-test-token",
          "X-API-Key": "navy-test-api-key",
          "X-CSRF-Token": "navy-test-csrf"
        },
        redirect: "follow",
        cache: "no-store"
      });
      const authCrossData = await authCrossResponse.json();
      const observations = authCrossData.headerObservations || [];
      const initialHeaders = observations[0] || {};
      const externalHeaders = observations.find(function (item) { return item.host === "example.com"; }) || {};
      const returnedHeaders = observations[observations.length - 1] || {};
      const authCrossPassed = authCrossResponse.ok && authCrossData.reachedFinal &&
        initialHeaders.authorization === "Bearer navy-test-token" &&
        initialHeaders.apiKey === "navy-test-api-key" &&
        !externalHeaders.authorization && !externalHeaders.apiKey && !externalHeaders.csrfToken &&
        !returnedHeaders.authorization && !returnedHeaders.apiKey && !returnedHeaders.csrfToken;
      results.push({
        status: 302,
        test: "Protección de credenciales",
        passed: authCrossPassed,
        detail: authCrossPassed ? "Credenciales enviadas al origen inicial y eliminadas tras cruzar de dominio" : "Las credenciales no se filtraron o eliminaron como se esperaba",
        visitedHosts: authCrossData.visitedHosts || [],
        headerObservations: observations
      });
      if (!authCrossPassed) throw new Error("Falló la protección de credenciales: " + JSON.stringify(authCrossData));

      // Comprueba que Navy entregue al navegador respuestas HTTP de error sin convertirlas en 200.
      for (const status of [401, 403, 500]) {
        redirectResult.textContent = "Comprobando respuesta HTTP " + status + "…";
        const statusUrl = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/status?code=" + status + "&_navy_check=" + Date.now();
        const statusResponse = await fetch(statusUrl, { method: "GET", cache: "no-store" });
        const statusData = await statusResponse.json();
        const passed = statusResponse.status === status && statusData.simulatedStatus === status;
        results.push({
          status: status,
          test: "Respuesta HTTP",
          passed: passed,
          detail: passed ? "El código HTTP se conservó" : "Se esperaba HTTP " + status + " y se recibió HTTP " + statusResponse.status
        });
        if (!passed) throw new Error("Falló la respuesta HTTP " + status + ": " + JSON.stringify(statusData));
      }

      redirectResult.textContent = [
        "Pruebas HTTP: correcto",
        ...results.map(function (item) {
          return (item.test || "GET") + " " + item.status + ": " +
            (item.passed ? "correcto" : "ERROR") + " — " + item.detail +
            (item.finalMethod ? " (método final: " + item.finalMethod + ")" : "") +
            (item.bodyPreserved !== undefined ? " (cuerpo: " + (item.bodyPreserved ? "correcto" : "ERROR") + ")" : "") +
            (item.visitedHosts ? " (ruta: " + item.visitedHosts.join(" → ") + ")" : "") +
            (item.observedHeaders ? " (cabeceras: " + JSON.stringify(item.observedHeaders) + ")" : "") +
            (item.headerObservations ? " (saltos: " + item.headerObservations.length + ")" : "");
        })
      ].join("\n");
    } catch (error) {
      redirectResult.textContent = "Redirecciones: ERROR — " + error.message +
        (results.length ? "\nPruebas completadas:\n" + JSON.stringify(results, null, 2) : "");
    } finally {
      redirectButton.disabled = false;
    }
  });

  const externalPageButton = document.getElementById("external-page-button");
  const externalPageResult = document.getElementById("external-page-result");
  externalPageButton.addEventListener("click", async () => {
    externalPageButton.disabled = true;
    externalPageResult.textContent = "Solicitando https://example.com a través de Navy…";
    try {
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const session = "850e8400-e29b-41d4-a716-446655440000";
      const url = worker + "/p/" + session + "/https/example.com/?_navy_check=" + Date.now();
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      });
      const html = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const passed = response.status === 200 &&
        contentType.toLowerCase().includes("text/html") &&
        html.includes("Example Domain") &&
        html.length > 100;
      externalPageResult.textContent = [
        "Página externa real: " + (passed ? "correcto" : "ERROR"),
        "Destino: https://example.com/",
        "HTTP recibido: " + response.status,
        "Content-Type: " + (contentType || "(no informado)"),
        "Tamaño recibido: " + html.length + " caracteres",
        "Texto «Example Domain»: " + (html.includes("Example Domain") ? "encontrado" : "no encontrado"),
        "Vista previa: " + html.replace(/\s+/g, " ").slice(0, 220),
        passed
          ? "Navy obtuvo el HTML de un servidor externo real."
          : "La respuesta no coincide con lo esperado. Revisa el estado, tipo de contenido y vista previa."
      ].join("\n");
      if (!passed) throw new Error("La respuesta externa no superó las comprobaciones.");
    } catch (error) {
      externalPageResult.textContent += "\nError: " + error.message;
    } finally {
      externalPageButton.disabled = false;
    }
  });


  const externalCssButton = document.getElementById("external-css-button");
  const externalCssResult = document.getElementById("external-css-result");
  externalCssButton.addEventListener("click", async () => {
    externalCssButton.disabled = true;
    externalCssResult.textContent = "Solicitando CSS externo a través de Navy…";
    const worker = "https://navy.ulisesdrojasc2.workers.dev";
    const session = "860e8400-e29b-41d4-a716-446655440000";
    const source = "https://udrojasc.github.io/Navy/test/fixtures/external-test.css";
    const proxyUrl = worker + "/p/" + session + "/https/udrojasc.github.io/Navy/test/fixtures/external-test.css?_navy_check=" + Date.now();
    try {
      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: { "Accept": "text/css" },
        cache: "no-store"
      });
      const css = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const downloaded = response.status === 200 &&
        contentType.toLowerCase().includes("text/css") &&
        css.includes(".navy-external-css-probe") &&
        css.includes("rgb(1, 2, 3)");
      if (!downloaded) {
        throw new Error("Descarga incorrecta: HTTP " + response.status +
          ", Content-Type " + (contentType || "(no informado)") +
          ", selector " + (css.includes(".navy-external-css-probe") ? "encontrado" : "ausente"));
      }

      const previous = document.getElementById("navy-external-css-link");
      if (previous) previous.remove();
      const link = document.createElement("link");
      link.id = "navy-external-css-link";
      link.rel = "stylesheet";
      link.href = proxyUrl + "&apply=1";
      const loaded = new Promise((resolve, reject) => {
        link.onload = resolve;
        link.onerror = () => reject(new Error("El navegador no pudo aplicar la hoja CSS."));
      });
      document.head.appendChild(link);
      await loaded;

      const probe = document.getElementById("external-css-probe");
      const computed = getComputedStyle(probe);
      const applied = computed.color === "rgb(1, 2, 3)" && computed.fontSize === "23px";
      externalCssResult.textContent = [
        "CSS externo real: " + (applied ? "correcto" : "ERROR"),
        "Origen: " + source,
        "HTTP recibido: " + response.status,
        "Content-Type: " + contentType,
        "Tamaño recibido: " + css.length + " caracteres",
        "Selector esperado: " + (css.includes(".navy-external-css-probe") ? "encontrado" : "no encontrado"),
        "Hoja cargada por el navegador: " + (link.sheet ? "sí" : "no"),
        "Color aplicado: " + computed.color,
        "Tamaño de texto aplicado: " + computed.fontSize,
        applied
          ? "Navy descargó el CSS externo y el navegador aplicó sus reglas."
          : "El CSS llegó, pero sus reglas no se aplicaron como se esperaba."
      ].join("\n");
      if (!applied) throw new Error("Las reglas CSS no se aplicaron correctamente.");
    } catch (error) {
      externalCssResult.textContent += "\nError: " + error.message;
    } finally {
      externalCssButton.disabled = false;
    }
  });


  const externalJsButton = document.getElementById("external-js-button");
  const externalJsResult = document.getElementById("external-js-result");
  externalJsButton.addEventListener("click", async () => {
    externalJsButton.disabled = true;
    externalJsResult.textContent = "Descargando JavaScript externo a través de Navy…";
    const worker = "https://navy.ulisesdrojasc2.workers.dev";
    const session = "870e8400-e29b-41d4-a716-446655440000";
    const source = "https://udrojasc.github.io/Navy/test/fixtures/external-test.js";
    const proxyUrl = worker + "/p/" + session + "/https/udrojasc.github.io/Navy/test/fixtures/external-test.js?_navy_check=" + Date.now();
    try {
      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: { "Accept": "text/javascript, application/javascript" },
        cache: "no-store"
      });
      const scriptText = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const downloaded = response.status === 200 &&
        /javascript|ecmascript/i.test(contentType) &&
        scriptText.includes("NAVY_EXTERNAL_JS_OK") &&
        scriptText.includes("window.NavyExternalScriptTest");
      if (!downloaded) {
        throw new Error("Descarga incorrecta: HTTP " + response.status +
          ", Content-Type " + (contentType || "(no informado)") +
          ", marcador " + (scriptText.includes("NAVY_EXTERNAL_JS_OK") ? "encontrado" : "ausente"));
      }

      const previous = document.getElementById("navy-external-js-script");
      if (previous) previous.remove();
      delete window.NavyExternalScriptTest;
      document.documentElement.removeAttribute("data-navy-external-js");

      const script = document.createElement("script");
      script.id = "navy-external-js-script";
      script.src = proxyUrl + "&execute=1";
      const loaded = new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error("El navegador no pudo cargar/ejecutar el JavaScript externo."));
      });
      document.head.appendChild(script);
      await loaded;

      const result = window.NavyExternalScriptTest;
      const executed = Boolean(result && result.executed === true &&
        result.marker === "NAVY_EXTERNAL_JS_OK" &&
        document.documentElement.getAttribute("data-navy-external-js") === "loaded");
      externalJsResult.textContent = [
        "JavaScript externo real: " + (executed ? "correcto" : "ERROR"),
        "Origen: " + source,
        "HTTP recibido: " + response.status,
        "Content-Type: " + contentType,
        "Tamaño recibido: " + scriptText.length + " caracteres",
        "Código esperado: " + (downloaded ? "encontrado" : "no encontrado"),
        "Script cargado por el navegador: " + (script.isConnected ? "sí" : "no"),
        "Ejecución confirmada: " + (executed ? "sí" : "no"),
        "Resultado: " + (result ? result.message : "sin resultado"),
        executed
          ? "Navy descargó el JavaScript externo y el navegador lo ejecutó."
          : "El archivo llegó, pero no se confirmó su ejecución."
      ].join("\n");
      if (!executed) throw new Error("No se confirmó la ejecución del JavaScript externo.");
    } catch (error) {
      externalJsResult.textContent += "\nError: " + error.message;
    } finally {
      externalJsButton.disabled = false;
    }
  });

  document.getElementById("run-button").addEventListener("click", () => {
    set("js-check", "JavaScript: botón interactivo correcto ✓");
  });
});