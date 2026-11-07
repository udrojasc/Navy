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

  const rangeTestButton = document.getElementById("range-test-button");
  if (rangeTestButton) {
    rangeTestButton.addEventListener("click", async () => {
      const output = document.getElementById("range-test-result");
      rangeTestButton.disabled = true;
      output.textContent = "Solicitando bytes 100–199 a httpbin.org…";
      const sessionId = crypto.randomUUID();
      const url = "https://navy.ulisesdrojasc2.workers.dev/p/" +
        sessionId + "/https/httpbin.org/range/1024";
      try {
        const response = await fetch(url, {
          headers: { "Range": "bytes=100-199", "Accept": "application/octet-stream" },
          cache: "no-store"
        });
        const body = await response.arrayBuffer();
        const contentRange = response.headers.get("content-range") || "ausente";
        const contentLength = response.headers.get("content-length") || "ausente";
        const passed = response.status === 206 && body.byteLength === 100 &&
          /^bytes 100-199\/1024$/i.test(contentRange);
        output.textContent = [
          "Solicitudes Range: " + (passed ? "correcto" : "ERROR"),
          "Respuesta HTTP: " + response.status,
          "Cabecera Range enviada: bytes=100-199",
          "Content-Range recibido: " + contentRange,
          "Content-Length recibido: " + contentLength,
          "Bytes recibidos: " + body.byteLength + " (esperado: 100)",
          "Solicitud pasó por Navy: " + (response.url.includes("/p/" + sessionId + "/https/httpbin.org/") ? "sí" : "no"),
          "Resultado: " + (passed ? "Navy conservó la solicitud parcial y la respuesta 206." : "No se cumplieron todas las condiciones."),
          "Error: ninguno"
        ].join("\n");
      } catch (error) {
        output.textContent = "Solicitudes Range: ERROR\nDetalle: " + error.message;
      } finally {
        rangeTestButton.disabled = false;
      }
    });
  }

});
