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


  const xhrDynamicButton = document.getElementById("xhr-dynamic-proxy-button");
  const xhrDynamicFrame = document.getElementById("xhr-dynamic-proxy-frame");
  const xhrDynamicResult = document.getElementById("xhr-dynamic-proxy-result");

  if (xhrDynamicButton && xhrDynamicFrame && xhrDynamicResult) {
    xhrDynamicButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/xhr-dynamic/index.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      xhrDynamicButton.disabled = true;
      xhrDynamicResult.textContent = "Ejecutando XMLHttpRequest mediante Navy…";
      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        xhrDynamicButton.disabled = false;
        xhrDynamicResult.textContent = message;
      };
      const onMessage = (event) => {
        if (event.source !== xhrDynamicFrame.contentWindow || !event.data ||
            event.data.type !== "navy-xhr-dynamic-result" || event.data.token !== token) return;
        const result = event.data;
        const proxied = !!result.responseUrl && result.responseUrl.includes("/p/") &&
          result.responseUrl.includes("dynamic-data.json");
        const validJson = result.data &&
          result.data.id === "NAVY_XHR_DYNAMIC_13" &&
          result.data.value === 1308 &&
          result.data.message === "XMLHttpRequest dinámico recibido correctamente por Navy.";
        const contentTypeJson = String(result.contentType || "").toLowerCase().includes("application/json");
        const passed = result.status === 200 && contentTypeJson && proxied && validJson && !!result.nonce;
        finish([
          "XMLHttpRequest dinámico: " + (passed ? "correcto" : "ERROR"),
          "Respuesta HTTP: " + (result.status || "—"),
          "Content-Type JSON: " + (contentTypeJson ? "sí" : "no"),
          "Solicitud XMLHttpRequest pasó por Navy: " + (proxied ? "sí" : "no"),
          "Identificador: " + (result.data && result.data.id || "—"),
          "Valor recibido: " + (result.data && result.data.value !== undefined ? result.data.value : "—"),
          "Nonce de solicitud: " + (result.nonce || "—"),
          "URL de respuesta: " + (result.responseUrl || "—"),
          "Error: " + (result.error || "ninguno")
        ].join("\n"));
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish(xhrDynamicResult.textContent + "\nERROR: no se recibió confirmación en 20 segundos.\nURL: " + proxyUrl);
      }, 20000);
      xhrDynamicFrame.src = proxyUrl;
    });
  }

});
