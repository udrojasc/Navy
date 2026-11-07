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


  const corsTestButton = document.getElementById("cors-test-button");
  if (corsTestButton) {
    corsTestButton.addEventListener("click", async () => {
      const output = document.getElementById("cors-test-result");
      corsTestButton.disabled = true;
      output.textContent = "Ejecutando POST con cabecera personalizada y preflight automático…";
      const sessionId = crypto.randomUUID();
      const url = "https://navy.ulisesdrojasc2.workers.dev/p/" +
        sessionId + "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/echo";
      const marker = "NAVY_CORS_PREFLIGHT_20";
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Navy-Test": marker
          },
          body: new URLSearchParams({ test: marker }),
          cache: "no-store"
        });
        const data = await response.json();
        const allowOrigin = response.headers.get("access-control-allow-origin") || "ausente";
        const passed = response.status === 200 && data.ok === true &&
          data.method === "POST" && data.fields && data.fields.test === marker &&
          allowOrigin === "*" && response.url.includes("/p/" + sessionId + "/https/navy.ulisesdrojasc2.workers.dev/");
        output.textContent = [
          "CORS y preflight: " + (passed ? "correcto" : "ERROR"),
          "Respuesta POST HTTP: " + response.status,
          "Preflight OPTIONS: " + (response.status === 200 ? "superado (el navegador permitió el POST con X-Navy-Test)" : "no confirmado"),
          "Access-Control-Allow-Origin: " + allowOrigin,
          "Método recibido por el servidor: " + (data.method || "ausente"),
          "Cabecera personalizada aceptada: " + (data.ok ? "sí" : "no verificable"),
          "Cuerpo recibido correctamente: " + (data.fields && data.fields.test === marker ? "sí" : "no"),
          "Solicitud pasó por Navy: " + (response.url.includes("/p/" + sessionId + "/https/navy.ulisesdrojasc2.workers.dev/") ? "sí" : "no"),
          "Resultado: " + (passed ? "El preflight automático y la solicitud POST CORS funcionaron." : "No se cumplieron todas las condiciones."),
          "Error: ninguno"
        ].join("\n");
      } catch (error) {
        output.textContent = "CORS y preflight: ERROR\nDetalle: " + error.message;
      } finally {
        corsTestButton.disabled = false;
      }
    });
  }

});