document.addEventListener("DOMContentLoaded", async () => {
  const set = (id, message) => {
    const element = document.getElementById(id);
    if (element) element.textContent = message;
  };

  set("js-check", "JavaScript: correcto");
  set("css-check", getComputedStyle(document.body).backgroundImage !== "none"
    ? "CSS: correcto" : "CSS: no detectado");

  const image = document.getElementById("test-image");
  if (image) {
    const checkImage = () => set("image-check", image.naturalWidth > 0
      ? "Imagen: cargada correctamente"
      : "Imagen: ERROR al cargar");
    image.addEventListener("load", checkImage);
    image.addEventListener("error", () => set("image-check", "Imagen: ERROR al cargar"));
    if (image.complete) checkImage();
  }

  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    set("fetch-check", "Fetch: correcto — " + data.message);
  } catch (error) {
    set("fetch-check", "Fetch: ERROR — " + error.message);
  }

  const runButton = document.getElementById("run-button");
  if (runButton) {
    runButton.addEventListener("click", () => {
      set("js-check", "JavaScript: botón interactivo correcto ✓");
    });
  }
  const externalCookieButton = document.getElementById("cookie-external-button");
  if (externalCookieButton) {
    externalCookieButton.addEventListener("click", async () => {
      const output = document.getElementById("cookie-external-result");
      externalCookieButton.disabled = true;
      output.textContent = "Ejecutando: solicitando cookie a httpbin.org…";
      const sessionId = crypto.randomUUID();
      const cookieName = "navy_external_test";
      const cookieValue = "navy-cookie-" + Date.now();
      const proxyBase = location.origin + "/p/" + sessionId + "/https/httpbin.org";
      try {
        const response = await fetch(proxyBase + "/cookies/set?" +
          encodeURIComponent(cookieName) + "=" + encodeURIComponent(cookieValue), {
            headers: { "Accept": "application/json" }
          });
        const data = await response.json();
        const received = data && data.cookies && data.cookies[cookieName];
        const passed = response.ok && received === cookieValue;
        output.textContent = [
          "Cookies externas: " + (passed ? "correcto" : "ERROR"),
          "Respuesta HTTP: " + response.status,
          "Origen externo: https://httpbin.org",
          "Cookie emitida por el servidor: " + cookieName + "=" + cookieValue,
          "Cookie recibida en la solicitud posterior: " + (received || "no recibida"),
          "Redirección seguida dentro de la misma sesión: " + (response.redirected ? "sí" : "no"),
          "URL final pasó por Navy: " + (response.url.includes("/p/" + sessionId + "/https/httpbin.org/") ? "sí" : "no"),
          "Resultado: " + (passed ? "Navy conservó y reenvió la cookie externa." : "No se pudo confirmar la persistencia de la cookie."),
          "Error: ninguno"
        ].join("\\n");
      } catch (error) {
        output.textContent = "Cookies externas: ERROR\\nDetalle: " + error.message;
      } finally {
        externalCookieButton.disabled = false;
      }
    });
  }

});
