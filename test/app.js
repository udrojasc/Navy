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




  const fetchDynamicButton = document.getElementById("fetch-dynamic-proxy-button");
  const fetchDynamicFrame = document.getElementById("fetch-dynamic-proxy-frame");
  const fetchDynamicResult = document.getElementById("fetch-dynamic-proxy-result");

  if (fetchDynamicButton && fetchDynamicFrame && fetchDynamicResult) {
    fetchDynamicButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/fetch-dynamic/index.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      fetchDynamicButton.disabled = true;
      fetchDynamicResult.textContent = "Ejecutando fetch() dinámico mediante Navy…";
      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        fetchDynamicButton.disabled = false;
        fetchDynamicResult.textContent = message;
      };
      const onMessage = (event) => {
        if (event.source !== fetchDynamicFrame.contentWindow || !event.data ||
            event.data.type !== "navy-fetch-dynamic-result" || event.data.token !== token) return;
        const result = event.data;
        const proxied = !!result.responseUrl && result.responseUrl.includes("/p/") &&
          result.responseUrl.includes("dynamic-data.json");
        const validJson = result.data &&
          result.data.id === "NAVY_FETCH_DYNAMIC_12" &&
          result.data.value === 1207 &&
          result.data.message === "Fetch dinámico recibido correctamente por Navy.";
        const passed = result.ok && result.status === 200 &&
          String(result.contentType || "").toLowerCase().includes("application/json") &&
          proxied && validJson && !!result.nonce;
        finish([
          "Fetch dinámico: " + (passed ? "correcto" : "ERROR"),
          "Respuesta HTTP: " + (result.status || "—"),
          "Content-Type JSON: " + (result.contentType.toLowerCase().includes("application/json") ? "sí" : "no"),
          "Solicitud fetch pasó por Navy: " + (proxied ? "sí" : "no"),
          "Identificador: " + (result.data && result.data.id || "—"),
          "Valor recibido: " + (result.data && result.data.value !== undefined ? result.data.value : "—"),
          "Nonce de solicitud: " + (result.nonce || "—"),
          "URL de respuesta: " + (result.responseUrl || "—"),
          "Error: " + (result.error || "ninguno")
        ].join("\n"));
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish(fetchDynamicResult.textContent + "\nERROR: no se recibió confirmación en 20 segundos.\nURL: " + proxyUrl);
      }, 20000);
      fetchDynamicFrame.src = proxyUrl;
    });
  }


});
