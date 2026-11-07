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


  const cssUrlButton = document.getElementById("css-url-proxy-button");
  const cssUrlFrame = document.getElementById("css-url-proxy-frame");
  const cssUrlResult = document.getElementById("css-url-proxy-result");

  if (cssUrlButton && cssUrlFrame && cssUrlResult) {
    cssUrlButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/css-url/index.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      cssUrlButton.disabled = true;
      cssUrlResult.textContent = "Cargando hoja CSS e imagen mediante Navy…";
      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        cssUrlButton.disabled = false;
        cssUrlResult.textContent = message;
      };
      const onMessage = (event) => {
        if (event.source !== cssUrlFrame.contentWindow || !event.data ||
            event.data.type !== "navy-css-url-result" || event.data.token !== token) return;
        const result = event.data;
        const cssRewritten = result.backgroundImage && result.backgroundImage.includes("/p/") &&
          result.backgroundImage.includes("css-background.svg");
        const imageThroughProxy = result.imageUrl && result.imageUrl.includes("/p/") &&
          result.imageUrl.includes("css-background.svg");
        const passed = result.loaded && cssRewritten && imageThroughProxy;
        finish([
          "Imagen CSS mediante url(): " + (passed ? "correcto" : "ERROR"),
          "Imagen descargada: " + (result.loaded ? "sí" : "no"),
          "Dimensiones: " + (result.width && result.height ? result.width + " × " + result.height : "—"),
          "URL CSS reescrita por Navy: " + (cssRewritten ? "sí" : "no"),
          "Descarga de imagen mediante Navy: " + (imageThroughProxy ? "sí" : "no"),
          "Fondo CSS: " + (result.backgroundImage || "—"),
          "URL de imagen: " + (result.imageUrl || "—")
        ].join("\n"));
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish(cssUrlResult.textContent + "\nERROR: no se recibió confirmación en 20 segundos.\nURL: " + proxyUrl);
      }, 20000);
      cssUrlFrame.src = proxyUrl;
    });
  }

});
