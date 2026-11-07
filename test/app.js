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
  const websocketTestButton = document.getElementById("websocket-test-button");
  if (websocketTestButton) {
    websocketTestButton.addEventListener("click", () => {
      const output = document.getElementById("websocket-test-result");
      websocketTestButton.disabled = true;
      output.textContent = "Abriendo una página proxificada que intentará conectar mediante WebSocket…";
      const sessionId = crypto.randomUUID();
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;";
      let finished = false;
      let timeoutId;
      let lastStage = "cargando la página proxificada";
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.removeEventListener("message", onMessage);
        if (timeoutId) window.clearTimeout(timeoutId);
        frame.remove();
        output.textContent = message;
        websocketTestButton.disabled = false;
      };
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow || !event.data || event.data.channel !== "NAVY_WS_TEST_21") return;
        const data = event.data;
        if (data.kind === "fixture-ready") {
          lastStage = "fixture HTML cargado dentro de la página proxificada";
          output.textContent = "WebSocket: fixture cargado; preparando conexión…";
          return;
        }
        if (data.kind === "connecting") {
          lastStage = "el navegador creó el WebSocket: " + (data.socketUrl || "URL ausente");
          output.textContent = "WebSocket: conexión iniciada a través de Navy…";
          return;
        }
        if (data.kind === "error") {
          finish([
            "WebSocket: ERROR",
            "Etapa: " + lastStage,
            "Detalle: " + (data.detail || "El navegador emitió un evento error."),
            "URL: " + (data.socketUrl || "ausente"),
            "Estado del socket: " + (data.readyState ?? "desconocido")
          ].join("\n"));
          return;
        }
        if (data.kind === "closed") {
          const passed = data.connected && data.textEcho && data.binaryEcho && data.closeCode === 1000 && data.wasClean && data.bootstrapMapped && data.viaNavy;
          finish([
            "WebSocket: " + (passed ? "correcto" : "ERROR"),
            "Conexión establecida: " + (data.connected ? "sí" : "no"),
            "Mensaje de texto ida y vuelta: " + (data.textEcho ? "correcto" : "ERROR"),
            "Mensaje binario ida y vuelta: " + (data.binaryEcho ? "correcto" : "ERROR"),
            "Cierre limpio: " + (data.wasClean ? "sí" : "no"),
            "Código de cierre: " + data.closeCode,
            "Motivo de cierre: " + (data.closeReason || "ninguno"),
            "Evento error recibido: " + (data.socketError ? "sí" : "no"),
            "URL del WebSocket: " + (data.socketUrl || "ausente"),
            "Reescritura WebSocket del bootstrap: " + (data.bootstrapMapped ? "correcta" : "no confirmada"),
            "Solicitud pasó por Navy: " + (data.viaNavy ? "sí" : "no"),
            "Resultado: " + (passed ? "Navy estableció el túnel y transportó texto y binarios en ambos sentidos." : "No se cumplieron todas las condiciones.")
          ].join("\n"));
        }
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish("WebSocket: ERROR\nEtapa alcanzada: " + lastStage + "\nDetalle: tiempo de espera agotado (15 segundos).");
      }, 15000);
      frame.src = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
        "/https/udrojasc.github.io/Navy/test/fixtures/websocket/index.html?test=" + Date.now();
      document.body.appendChild(frame);
    });
  }

});