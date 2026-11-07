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

  const relativeButton = document.getElementById("relative-proxy-button");
  const relativeFrame = document.getElementById("relative-proxy-frame");
  const relativeResult = document.getElementById("relative-proxy-result");

  if (relativeButton && relativeFrame && relativeResult) {
    relativeButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/relative/nested/page.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      relativeButton.disabled = true;
      relativeResult.textContent = "Abriendo la página anidada a través de Navy…";

      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        relativeButton.disabled = false;
        relativeResult.textContent = message;
      };

      const onMessage = (event) => {
        if (event.source !== relativeFrame.contentWindow || !event.data || event.data.token !== token) return;

        if (event.data.type === "navy-relative-assets") {
          const result = event.data;
          const resourcesPassed = result.cssLoaded && result.imageLoaded && result.allResourcesThroughProxy &&
            result.cssUrl && result.cssUrl.includes("/p/") &&
            result.scriptUrl && result.scriptUrl.includes("/p/") &&
            result.imageUrl && result.imageUrl.includes("/p/");

          relativeResult.textContent = [
            "Rutas relativas — recursos: " + (resourcesPassed ? "correcto" : "ERROR"),
            "CSS relativo cargado: " + (result.cssLoaded ? "sí" : "no"),
            "JavaScript relativo ejecutado: sí",
            "Imagen relativa cargada: " + (result.imageLoaded ? "sí" : "no"),
            "Todos los recursos pasaron por Navy: " + (result.allResourcesThroughProxy ? "sí" : "no"),
            "URL CSS: " + result.cssUrl,
            "URL JavaScript: " + result.scriptUrl,
            "URL imagen: " + result.imageUrl,
            "Navegación relativa: " + (resourcesPassed ? "en curso…" : "no ejecutada")
          ].join("\n");

          if (!resourcesPassed) {
            finish(relativeResult.textContent);
            return;
          }
          relativeFrame.contentWindow.postMessage({type:"navy-relative-navigate",token:token},"*");
          return;
        }

        if (event.data.type === "navy-relative-destination") {
          finish(relativeResult.textContent.replace(
            "Navegación relativa: en curso…",
            "Navegación relativa: " + (event.data.passed ? "correcto" : "ERROR") +
              "\\nURL final: " + event.data.finalUrl
          ));
        }
      };

      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish(relativeResult.textContent + "\\nERROR: no se recibió la confirmación final en 25 segundos.\\nURL inicial: " + proxyUrl);
      }, 25000);
      relativeFrame.src = proxyUrl;
    });
  }


  const srcsetButton = document.getElementById("srcset-proxy-button");
  const srcsetFrame = document.getElementById("srcset-proxy-frame");
  const srcsetResult = document.getElementById("srcset-proxy-result");

  if (srcsetButton && srcsetFrame && srcsetResult) {
    srcsetButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/srcset/index.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      srcsetButton.disabled = true;
      srcsetResult.textContent = "Cargando página e imágenes responsivas mediante Navy…";

      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        srcsetButton.disabled = false;
        srcsetResult.textContent = message;
      };
      const onMessage = (event) => {
        if (event.source !== srcsetFrame.contentWindow || !event.data ||
            event.data.type !== "navy-srcset-result" || event.data.token !== token) return;
        const result = event.data;
        const rewritten = result.srcset && result.srcset.split(",").length === 2 &&
          (result.srcset.match(/\/p\//g) || []).length === 2;
        const selected = result.currentSrc && result.currentSrc.includes("/p/") &&
          result.currentSrc.includes("udrojasc.github.io");
        const passed = result.loaded && rewritten && selected;
        finish([
          "Imágenes responsivas (srcset): " + (passed ? "correcto" : "ERROR"),
          "Imagen seleccionada cargada: " + (result.loaded ? "sí" : "no"),
          "Ancho natural detectado: " + (result.naturalWidth || "—"),
          "Dos alternativas reescritas por Navy: " + (rewritten ? "sí" : "no"),
          "Imagen elegida mediante Navy: " + (selected ? "sí" : "no"),
          "URL seleccionada: " + (result.currentSrc || "—"),
          "srcset recibido: " + (result.srcset || "—")
        ].join("\n"));
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish(srcsetResult.textContent + "\nERROR: no se recibió confirmación en 20 segundos.\nURL: " + proxyUrl);
      }, 20000);
      srcsetFrame.src = proxyUrl;
    });
  }

});
