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
        const url = worker + "/p/" + session + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/redirect?status=" + status;
        const response = await fetch(url, { method: "GET", redirect: "follow" });
        const data = await response.json();
        const passed = response.ok && data.ok && data.reachedFinal &&
          data.redirectStatus === status && data.finalMethod === "GET";
        results.push({
          status: status,
          passed: passed,
          finalMethod: data.finalMethod || "—",
          reachedFinal: Boolean(data.reachedFinal),
          detail: passed ? "Destino final alcanzado" : (data.error || "Respuesta inesperada")
        });
        if (!passed) throw new Error("Falló la redirección " + status + ": " + JSON.stringify(data));
      }
      redirectResult.textContent = [
        "Redirecciones: correcto",
        ...results.map(function (item) {
          return item.status + ": " + (item.passed ? "correcto" : "ERROR") +
            " — " + item.detail + " (método final: " + item.finalMethod + ")";
        })
      ].join("\n");
    } catch (error) {
      redirectResult.textContent = "Redirecciones: ERROR — " + error.message +
        (results.length ? "\nPruebas completadas:\n" + JSON.stringify(results, null, 2) : "");
    } finally {
      redirectButton.disabled = false;
    }
  });

  document.getElementById("run-button").addEventListener("click", () => {
    set("js-check", "JavaScript: botón interactivo correcto ✓");
  });
});