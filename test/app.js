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



  const binaryTestButton = document.getElementById("binary-test-button");
  if (binaryTestButton) {
    binaryTestButton.addEventListener("click", async () => {
      const output = document.getElementById("binary-test-result");
      binaryTestButton.disabled = true;
      output.textContent = "Descargando archivo binario de 256 bytes…";
      const sessionId = crypto.randomUUID();
      const url = "https://navy.ulisesdrojasc2.workers.dev/p/" +
        sessionId + "/https/httpbin.org/bytes/256";
      try {
        const response = await fetch(url, {
          headers: { "Accept": "application/octet-stream" },
          cache: "no-store"
        });
        const body = new Uint8Array(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "ausente";
        const uniqueBytes = new Set(body).size;
        const passed = response.status === 200 && body.byteLength === 256 &&
          contentType.toLowerCase().includes("application/octet-stream") &&
          uniqueBytes > 100;
        output.textContent = [
          "Archivos binarios: " + (passed ? "correcto" : "ERROR"),
          "Respuesta HTTP: " + response.status,
          "Content-Type: " + contentType,
          "Bytes recibidos: " + body.byteLength + " (esperado: 256)",
          "Valores de byte distintos: " + uniqueBytes,
          "Solicitud pasó por Navy: " + (response.url.includes("/p/" + sessionId + "/https/httpbin.org/") ? "sí" : "no"),
          "Resultado: " + (passed ? "Navy transmitió el archivo binario sin alterar su longitud ni convertirlo en texto." : "No se cumplieron todas las condiciones."),
          "Error: ninguno"
        ].join("\n");
      } catch (error) {
        output.textContent = "Archivos binarios: ERROR\nDetalle: " + error.message;
      } finally {
        binaryTestButton.disabled = false;
      }
    });
  }

});
