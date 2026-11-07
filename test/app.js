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

  const jsonButton = document.getElementById("json-proxy-button");
  const jsonFrame = document.getElementById("json-proxy-frame");
  const jsonResult = document.getElementById("json-proxy-result");

  if (jsonButton && jsonFrame && jsonResult) {
    jsonButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/external-test-json.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      jsonButton.disabled = true;
      jsonResult.textContent = "Abriendo la página de prueba a través de Navy…";

      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        jsonButton.disabled = false;
        jsonResult.textContent = message;
      };

      const onMessage = (event) => {
        if (event.source !== jsonFrame.contentWindow || !event.data ||
            event.data.type !== "navy-json-proxy-test" || event.data.token !== token) return;

        const result = event.data;
        finish([
          "JSON externo a través de Navy: " + (result.passed ? "correcto" : "ERROR"),
          "HTTP recibido: " + (result.httpStatus ?? "—"),
          "Content-Type: " + (result.contentType ?? "—"),
          "Identificador: " + (result.testId ?? "—"),
          "Valor esperado: " + (result.expectedValue ?? "—"),
          "Mensaje: " + (result.message ?? result.error ?? "—"),
          "URL de respuesta: " + (result.responseUrl ?? "—")
        ].join("\\n"));
      };

      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish("JSON externo a través de Navy: ERROR\\nNo se recibió el resultado en 20 segundos.\\nURL solicitada: " + proxyUrl);
      }, 20000);

      jsonFrame.src = proxyUrl;
    });
  }

});
