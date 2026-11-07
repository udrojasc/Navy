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
  const websocketEdgeButton = document.getElementById("websocket-edge-button");
  if (websocketEdgeButton) {
    websocketEdgeButton.addEventListener("click", () => {
      const output = document.getElementById("websocket-edge-result");
      websocketEdgeButton.disabled = true;
      output.textContent = "Conectando directamente al Worker, sin Durable Object…";
      const socketUrl = "wss://navy.ulisesdrojasc2.workers.dev/__navy_test/websocket-edge";
      const marker = "NAVY_EDGE_WS_ECHO_23";
      let connected = false, echoed = false, done = false;
      const finish = (message) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        output.textContent = message;
        websocketEdgeButton.disabled = false;
      };
      const timer = window.setTimeout(() => {
        finish("WebSocket directo al Worker: ERROR\nConexión establecida: " + (connected ? "sí" : "no") +
          "\nEco recibido: " + (echoed ? "sí" : "no") + "\nEtapa: tiempo de espera agotado.");
        try { socket.close(); } catch (_) {}
      }, 10000);
      let socket;
      try {
        socket = new WebSocket(socketUrl);
        socket.addEventListener("open", () => {
          connected = true;
          socket.send(marker);
        });
        socket.addEventListener("message", event => {
          echoed = event.data === marker;
          finish([
            "WebSocket directo al Worker: " + (echoed ? "correcto" : "ERROR"),
            "Conexión establecida: sí",
            "Eco de mensaje: " + (echoed ? "correcto" : "ERROR"),
            "URL: " + socket.url
          ].join("\n"));
          try { socket.close(1000, "test complete"); } catch (_) {}
        });
        socket.addEventListener("error", () => {
          finish("WebSocket directo al Worker: ERROR\nConexión establecida: " + (connected ? "sí" : "no") +
            "\nEl navegador emitió un evento error.");
        });
        socket.addEventListener("close", event => {
          if (!done) finish("WebSocket directo al Worker: cerrado antes del eco\nCódigo: " + event.code +
            "\nMotivo: " + (event.reason || "ninguno") + "\nLimpio: " + event.wasClean);
        });
      } catch (error) {
        finish("WebSocket directo al Worker: ERROR\n" + error.message);
      }
    });
  }

  const websocketDiagnosticButton = document.getElementById("websocket-diagnostic-button");
  if (websocketDiagnosticButton) {
    websocketDiagnosticButton.addEventListener("click", async () => {
      const output = document.getElementById("websocket-diagnostic-result");
      websocketDiagnosticButton.disabled = true;
      output.textContent = "Probando conexión WebSocket saliente desde el Durable Object…";
      const sessionId = crypto.randomUUID();
      const url = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
        "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/websocket-diagnostic";
      try {
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();
        output.textContent = [
          "Diagnóstico WebSocket saliente: " + (data.ok ? "correcto" : "ERROR"),
          "Etapa: " + (data.stage || "desconocida"),
          "HTTP: " + (data.httpStatus ?? response.status),
          "Handshake 101: " + (data.webSocketReturned ? "correcto" : "no"),
          "Mensaje enviado: " + (data.messageSent || "no enviado"),
          "Eco del mensaje: " + (data.messageEchoed ? "correcto" : "ERROR"),
          "Respuesta recibida: " + (data.received || "ninguna"),
          "Tiempo: " + (data.elapsedMs ?? "desconocido") + " ms",
          "Destino: " + (data.target || "ausente"),
          "Detalle: " + (data.detail || "ninguno"),
          "Error: " + (data.error || "ninguno"),
          "Error técnico: " + (data.errorName || "ninguno")
        ].join("\n");
      } catch (error) {
        output.textContent = "Diagnóstico WebSocket saliente: ERROR\nDetalle: " + error.message;
      } finally {
        websocketDiagnosticButton.disabled = false;
      }
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
      timeoutId = window.setTimeout(async () => {
        let diagnostic = "Estado del Durable Object: no disponible";
        try {
          const statusUrl = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
            "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/websocket-status";
          const response = await fetch(statusUrl, { cache: "no-store" });
          const data = await response.json();
          diagnostic = "Estado del Durable Object: " + JSON.stringify(data);
        } catch (error) {
          diagnostic = "Estado del Durable Object: consulta fallida — " + error.message;
        }
        finish("WebSocket: ERROR\\nEtapa alcanzada: " + lastStage +
          "\\nDetalle: tiempo de espera agotado (15 segundos).\\n" + diagnostic);
      }, 15000);
      frame.src = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
        "/https/udrojasc.github.io/Navy/test/fixtures/websocket/index.html?test=" + Date.now();
      document.body.appendChild(frame);
    });
  }

});