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

  const redirectsButton = document.getElementById("redirects-proxy-button");
  const redirectsFrame = document.getElementById("redirects-proxy-frame");
  const redirectsResult = document.getElementById("redirects-proxy-result");
  if (redirectsButton && redirectsFrame && redirectsResult) {
    redirectsButton.addEventListener("click", () => {
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const worker = "https://navy.ulisesdrojasc2.workers.dev";
      const target = new URL("https://udrojasc.github.io/Navy/test/fixtures/redirects/index.html");
      target.searchParams.set("token", token);
      const proxyUrl = worker + "/p/" + sessionId + "/https/" +
        encodeURIComponent(target.host) + target.pathname + target.search;
      redirectsButton.disabled = true;
      redirectsResult.textContent = "Ejecutando redirecciones 301, 302, 307 y 308…";
      let finished = false, timeoutId;
      const finish = message => {
        if (finished) return;
        finished = true; window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        redirectsButton.disabled = false; redirectsResult.textContent = message;
      };
      const onMessage = event => {
        if (event.source !== redirectsFrame.contentWindow || !event.data ||
            event.data.type !== "navy-redirects-result" || event.data.token !== token) return;
        const results = event.data.results || [];
        const lines = ["Redirecciones entre dominios: " +
          (results.length === 4 && results.every(item => item.httpStatus === 200 &&
            item.reachedFinal && item.redirectStatus === item.status &&
            item.visitedHosts.includes("example.com")) && !event.data.error ? "correcto" : "ERROR")];
        for (const item of results) {
          const passed = item.httpStatus === 200 && item.reachedFinal &&
            item.redirectStatus === item.status && item.visitedHosts.includes("example.com");
          lines.push("HTTP " + item.status + ": " + (passed ? "correcto" : "ERROR") +
            " — destino final: " + (item.reachedFinal ? "alcanzado" : "no alcanzado") +
            " — example.com: " + (item.visitedHosts.includes("example.com") ? "sí" : "no"));
        }
        lines.push("Pruebas completadas: " + results.length + "/4");
        if (event.data.error) lines.push("Error: " + event.data.error);
        finish(lines.join("\\n"));
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() =>
        finish("Redirecciones: ERROR — no se recibió confirmación en 30 segundos."), 30000);
      redirectsFrame.src = proxyUrl;
    });
  }


});
