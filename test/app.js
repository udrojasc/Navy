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

  const headTestButton = document.getElementById("head-test-button");
  if (headTestButton) {
    headTestButton.addEventListener("click", async () => {
      const output = document.getElementById("head-test-result");
      headTestButton.disabled = true;
      output.textContent = "Ejecutando solicitudes HEAD y GET…";
      const sessionId = crypto.randomUUID();
      const base = "https://navy.ulisesdrojasc2.workers.dev/p/" +
        sessionId + "/https/example.com/";
      try {
        const head = await fetch(base, { method: "HEAD", cache: "no-store" });
        const headBody = await head.text();
        const get = await fetch(base, { method: "GET", cache: "no-store" });
        const getBody = await get.text();
        const headType = head.headers.get("content-type") || "";
        const getType = get.headers.get("content-type") || "";
        const passed = head.status === 200 && get.status === 200 &&
          headBody.length === 0 && getBody.length > 0 &&
          headType.toLowerCase() === getType.toLowerCase();
        output.textContent = [
          "Método HEAD: " + (passed ? "correcto" : "ERROR"),
          "HEAD HTTP: " + head.status,
          "GET HTTP: " + get.status,
          "Cuerpo HEAD: " + headBody.length + " caracteres (esperado: 0)",
          "Cuerpo GET: " + getBody.length + " caracteres (esperado: mayor que 0)",
          "Content-Type HEAD: " + (headType || "ausente"),
          "Content-Type GET: " + (getType || "ausente"),
          "Solicitudes pasaron por Navy: " + (head.url.includes("/p/" + sessionId + "/") && get.url.includes("/p/" + sessionId + "/") ? "sí" : "no"),
          "Resultado: " + (passed ? "HEAD devolvió cabeceras sin cuerpo y mantuvo el estado de GET." : "No se cumplieron todas las condiciones."),
          "Error: ninguno"
        ].join("\\n");
      } catch (error) {
        output.textContent = "Método HEAD: ERROR\\nDetalle: " + error.message;
      } finally {
        headTestButton.disabled = false;
      }
    });
  }

});
