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

  const externalFontButton = document.getElementById("external-font-button");
  const externalFontResult = document.getElementById("external-font-result");
  externalFontButton.addEventListener("click", async () => {
    externalFontButton.disabled = true;
    externalFontResult.textContent = "Solicitando CSS de la fuente externa a través de Navy…";
    const worker = "https://navy.ulisesdrojasc2.workers.dev";
    const session = "890e8400-e29b-41d4-a716-446655440000";
    const source = "https://udrojasc.github.io/Navy/test/fixtures/external-test-font.css";
    const proxyUrl = worker + "/p/" + session +
      "/https/udrojasc.github.io/Navy/test/fixtures/external-test-font.css?_navy_check=" + Date.now();
    const probe = document.getElementById("external-font-probe");

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
        css.includes("fonts.googleapis.com") &&
        css.includes("Roboto+Mono");

      if (!downloaded) {
        throw new Error("CSS de fuente incorrecto: HTTP " + response.status +
          ", Content-Type " + (contentType || "(no informado)") +
          ", referencia a Google Fonts " + (css.includes("fonts.googleapis.com") ? "encontrada" : "ausente"));
      }

      const previous = document.getElementById("navy-external-font-link");
      if (previous) previous.remove();

      const link = document.createElement("link");
      link.id = "navy-external-font-link";
      link.rel = "stylesheet";
      link.href = proxyUrl + "&apply=1";
      const stylesheetLoaded = new Promise((resolve, reject) => {
        link.onload = resolve;
        link.onerror = () => reject(new Error("El navegador no pudo cargar el CSS de la fuente."));
      });
      document.head.appendChild(link);
      await stylesheetLoaded;

      const loadedFaces = await document.fonts.load('400 24px "Roboto Mono"', probe.textContent);
      const familyLoaded = loadedFaces.some(face =>
        face.family.replace(/["']/g, "") === "Roboto Mono" && face.status === "loaded");
      const computed = getComputedStyle(probe);
      const applied = familyLoaded &&
        computed.fontFamily.toLowerCase().includes("roboto mono") &&
        document.fonts.check('400 24px "Roboto Mono"');

      externalFontResult.textContent = [
        "Fuente tipográfica externa: " + (applied ? "correcto" : "ERROR"),
        "Hoja de estilos: " + source,
        "Proveedor: Google Fonts",
        "HTTP recibido para CSS: " + response.status,
        "Content-Type: " + contentType,
        "Tamaño CSS recibido: " + css.length + " caracteres",
        "Hoja cargada por el navegador: " + (link.sheet ? "sí" : "no"),
        "Fuente Roboto Mono descargada: " + (familyLoaded ? "sí" : "no"),
        "Fuente aplicada: " + computed.fontFamily,
        "document.fonts.check: " + (document.fonts.check('400 24px "Roboto Mono"') ? "sí" : "no"),
        applied
          ? "Navy cargó la hoja externa y el navegador descargó y utilizó Roboto Mono."
          : "El CSS llegó, pero no se confirmó la descarga y aplicación de Roboto Mono."
      ].join("\n");

      if (!applied) throw new Error("No se confirmó la carga y aplicación de la fuente externa.");
    } catch (error) {
      externalFontResult.textContent += "\nError: " + error.message;
    } finally {
      externalFontButton.disabled = false;
    }
  });
});
