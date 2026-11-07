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



  const cssImportButton = document.getElementById("css-import-proxy-button");
  const cssImportFrame = document.getElementById("css-import-proxy-frame");
  const cssImportResult = document.getElementById("css-import-proxy-result");

  if (cssImportButton && cssImportFrame && cssImportResult) {
    cssImportButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/css-import/index.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      cssImportButton.disabled = true;
      cssImportResult.textContent = "Cargando hojas CSS importadas mediante Navy…";
      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        cssImportButton.disabled = false;
        cssImportResult.textContent = message;
      };
      const onMessage = (event) => {
        if (event.source !== cssImportFrame.contentWindow || !event.data ||
            event.data.type !== "navy-css-import-result" || event.data.token !== token) return;
        const result = event.data;
        const expectedFiles = ["level-one.css", "level-two.css", "level-three.css"];
        const rewritten = expectedFiles.every(file =>
          result.stylesheets.some(url => url.includes("/p/") && url.includes(file))
        );
        const allThreeLoaded = result.loaded &&
          result.values.levelOne === "loaded" &&
          result.values.levelTwo === "loaded" &&
          result.values.levelThree === "loaded";
        const passed = allThreeLoaded && rewritten;
        finish([
          "CSS anidado mediante @import: " + (passed ? "correcto" : "ERROR"),
          "Hojas CSS detectadas: " + result.stylesheets.length,
          "Tres niveles de CSS aplicados: " + (allThreeLoaded ? "sí" : "no"),
          "Las tres rutas fueron reescritas por Navy: " + (rewritten ? "sí" : "no"),
          "Nivel 1: " + (result.values.levelOne || "no aplicado"),
          "Nivel 2: " + (result.values.levelTwo || "no aplicado"),
          "Nivel 3: " + (result.values.levelThree || "no aplicado"),
          "Hojas CSS solicitadas:\n" + (result.stylesheets.join("\n") || "ninguna")
        ].join("\n"));
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish(cssImportResult.textContent + "\nERROR: no se recibió confirmación en 20 segundos.\nURL: " + proxyUrl);
      }, 20000);
      cssImportFrame.src = proxyUrl;
    });
  }


});
