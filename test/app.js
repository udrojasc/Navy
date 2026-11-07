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


  const sendBeaconButton = document.getElementById("send-beacon-proxy-button");
  const sendBeaconFrame = document.getElementById("send-beacon-proxy-frame");
  const sendBeaconResult = document.getElementById("send-beacon-proxy-result");

  if (sendBeaconButton && sendBeaconFrame && sendBeaconResult) {
    sendBeaconButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/send-beacon/index.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;

      sendBeaconButton.disabled = true;
      sendBeaconResult.textContent = "Ejecutando sendBeacon() mediante Navy…";
      let finished = false;
      let timeoutId;
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        sendBeaconButton.disabled = false;
        sendBeaconResult.textContent = message;
      };
      const onMessage = (event) => {
        if (event.source !== sendBeaconFrame.contentWindow || !event.data ||
            event.data.type !== "navy-send-beacon-result" || event.data.token !== token) return;
        const result = event.data;
        const proxied = !!result.resourceUrl &&
          result.resourceUrl.includes("/p/" + sessionId + "/") &&
          result.resourceUrl.includes("/__navy_test/echo");
        const accepted = result.accepted === true;
        const passed = result.supported && accepted && proxied;
        finish([
          "sendBeacon(): " + (passed ? "correcto" : "ERROR"),
          "API disponible: " + (result.supported ? "sí" : "no"),
          "Navegador aceptó el envío: " + (accepted ? "sí" : "no"),
          "Solicitud registrada en Performance: " + (result.resourceUrl ? "sí" : "no"),
          "Solicitud dirigida a Navy: " + (proxied ? "sí" : "no"),
          "Tipo de recurso: " + (result.initiatorType || "no disponible"),
          "URL de solicitud: " + (result.resourceUrl || result.beaconUrl || "—"),
          "Entrega confirmada por el servidor: no verificable mediante sendBeacon()",
          "Error: " + (result.error || "ninguno")
        ].join("\n"));
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish(sendBeaconResult.textContent + "\nERROR: no se recibió confirmación en 20 segundos.\nURL: " + proxyUrl);
      }, 20000);
      sendBeaconFrame.src = proxyUrl;
    });
  }

});
