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
          "Eco del texto: " + (data.messageEchoed ? "correcto" : "ERROR"),
          "Bytes binarios enviados: " + (data.binaryBytesSent ?? "no enviado"),
          "Eco binario: " + (data.binaryEchoed ? "correcto" : "ERROR"),
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
        finish("WebSocket: ERROR\nEtapa alcanzada: " + lastStage +
          "\nDetalle: tiempo de espera agotado (15 segundos).\n" + diagnostic);
      }, 15000);
      frame.src = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
        "/https/udrojasc.github.io/Navy/test/fixtures/websocket/index.html?test=" + Date.now();
      document.body.appendChild(frame);
    });
  }


  const websocketExternalButton = document.getElementById("websocket-external-button");
  if (websocketExternalButton) {
    websocketExternalButton.addEventListener("click", () => {
      const output = document.getElementById("websocket-external-result");
      websocketExternalButton.disabled = true;
      output.textContent = "Conectando desde el navegador al servidor WebSocket externo a través de Navy…";
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
        websocketExternalButton.disabled = false;
      };
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow || !event.data ||
            event.data.channel !== "NAVY_WS_EXTERNAL_TEST_22") return;
        const data = event.data;
        if (data.kind === "fixture-ready") {
          lastStage = "fixture externo cargado dentro de la página proxificada";
          output.textContent = "Prueba 22: fixture cargado; preparando WebSocket externo…";
          return;
        }
        if (data.kind === "connecting") {
          lastStage = "el navegador creó el WebSocket: " + (data.socketUrl || "URL ausente");
          output.textContent = "Prueba 22: handshake hacia echo.websocket.org a través de Navy…";
          return;
        }
        if (data.kind === "error" || data.kind === "timeout") {
          (async () => {
            let diagnostic = "Diagnóstico del puente: no disponible";
            try {
              const statusUrl = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
                "/https/navy.ulisesdrojasc2.workers.dev/__navy_test/websocket-status";
              const response = await fetch(statusUrl, { cache: "no-store" });
              const status = await response.json();
              diagnostic = "Diagnóstico del puente: " + JSON.stringify(status.bridge || status);
            } catch (error) {
              diagnostic = "Diagnóstico del puente: consulta fallida — " + error.message;
            }
            finish([
            "Prueba 22 — WebSocket externo: ERROR",
            "Etapa: " + lastStage,
            "Detalle: " + (data.detail || "Tiempo de espera agotado."),
            "Conexión establecida: " + (data.connected ? "sí" : "no"),
            "Eco de texto: " + (data.textEcho ? "correcto" : "no recibido"),
            "Eco binario: " + (data.binaryEcho ? "correcto" : "no recibido"),
            "Estado del socket: " + (data.readyState ?? "desconocido"),
            "URL del WebSocket: " + (data.socketUrl || "ausente"),
            "Destino externo: " + (data.targetUrl || "wss://echo.websocket.org/raw"),
            "Solicitud pasó por Navy: " + (data.viaNavy ? "sí" : "no"),
            diagnostic
          ].join("\n"));
          })();
          return;
        }
        if (data.kind === "closed") {
          const passed = data.connected && data.textEcho && data.binaryEcho &&
            data.closeCode === 1000 && data.wasClean && data.bootstrapMapped && data.viaNavy;
          finish([
            "Prueba 22 — WebSocket externo: " + (passed ? "correcta" : "ERROR"),
            "Conexión establecida: " + (data.connected ? "sí" : "no"),
            "Handshake externo: " + (data.connected ? "correcto" : "ERROR"),
            "Mensaje de texto ida y vuelta: " + (data.textEcho ? "correcto" : "ERROR"),
            "Mensaje binario ida y vuelta: " + (data.binaryEcho ? "correcto" : "ERROR"),
            "Cierre limpio: " + (data.wasClean ? "sí" : "no"),
            "Código de cierre: " + data.closeCode,
            "Motivo de cierre: " + (data.closeReason || "ninguno"),
            "Evento error recibido: " + (data.socketError ? "sí" : "no"),
            "URL del WebSocket: " + (data.socketUrl || "ausente"),
            "Destino externo: " + (data.targetUrl || "wss://echo.websocket.org/raw"),
            "Reescritura del bootstrap: " + (data.bootstrapMapped ? "correcta" : "ERROR"),
            "Solicitud pasó por Navy: " + (data.viaNavy ? "sí" : "no"),
            "Resultado: " + (passed
              ? "Navy transportó texto y binarios entre el navegador y un servidor WebSocket externo."
              : "No se cumplieron todas las condiciones.")
          ].join("\n"));
        }
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish("Prueba 22 — WebSocket externo: ERROR\nEtapa: " + lastStage +
          "\nDetalle: el fixture no completó la prueba en 18 segundos.");
      }, 18000);
      frame.src = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
        "/https/udrojasc.github.io/Navy/test/fixtures/websocket-external/index.html?test=" + Date.now();
      document.body.appendChild(frame);
    });
  }


  const websocketStabilityButton = document.getElementById("websocket-stability-button");
  if (websocketStabilityButton) {
    websocketStabilityButton.addEventListener("click", () => {
      const output = document.getElementById("websocket-stability-result");
      websocketStabilityButton.disabled = true;
      output.textContent = "Iniciando conexión WebSocket externa; la prueba durará aproximadamente 3 minutos…";
      const sessionId = crypto.randomUUID();
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;";
      let finished = false, timeoutId, lastStage = "cargando fixture de estabilidad";
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.removeEventListener("message", onMessage);
        if (timeoutId) window.clearTimeout(timeoutId);
        frame.remove();
        output.textContent = message;
        websocketStabilityButton.disabled = false;
      };
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow || !event.data ||
            event.data.channel !== "NAVY_WS_STABILITY_TEST_23") return;
        const data = event.data;
        if (data.kind === "fixture-ready") { lastStage = "fixture cargado"; return; }
        if (data.kind === "connecting") {
          lastStage = "WebSocket abierto: " + (data.socketUrl || "URL no disponible");
          output.textContent = "Prueba 23 en curso…\nConexión establecida. Intercambiando texto y binarios durante 3 minutos.";
          return;
        }
        if (data.kind === "progress") {
          const seconds = Math.floor(data.elapsedMs / 1000);
          output.textContent = [
            "Prueba 23 — Estabilidad WebSocket: EN CURSO",
            "Tiempo transcurrido: " + Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") + " / 3:00",
            "Ciclos completos: " + data.completedCycles + " / " + data.expectedCycles,
            "Ecos de texto: " + data.completedCycles,
            "Ecos binarios: " + data.completedCycles,
            "Latencia media: " + data.averageLatencyMs + " ms",
            "Latencia máxima: " + data.maxLatencyMs + " ms",
            "Destino: wss://echo.websocket.org/",
            "Solicitud pasó por Navy: " + (data.viaNavy ? "sí" : "no")
          ].join("\n");
          return;
        }
        if (data.kind === "closed" || data.kind === "error" || data.kind === "timeout") {
          const passed = data.kind === "closed" && data.connected && !data.socketError &&
            data.wasClean && data.closeCode === 1000 && data.elapsedMs >= 180000 &&
            data.completedCycles >= 30 && data.bootstrapMapped && data.viaNavy;
          finish([
            "Prueba 23 — Estabilidad WebSocket: " + (passed ? "CORRECTA" : "ERROR"),
            "Conexión establecida: " + (data.connected ? "sí" : "no"),
            "Duración: " + (data.elapsedMs / 1000).toFixed(1) + " s",
            "Ciclos completos: " + data.completedCycles + " / " + data.expectedCycles,
            "Ciclos fallidos: " + data.failedCycles,
            "Ecos de texto: " + data.textEchoes,
            "Ecos binarios: " + data.binaryEchoes,
            "Latencia media: " + (data.averageLatencyMs ?? "sin datos") + " ms",
            "Latencia máxima: " + (data.maxLatencyMs ?? "sin datos") + " ms",
            "Cierre limpio: " + (data.wasClean ? "sí" : "no"),
            "Código de cierre: " + (data.closeCode ?? "sin cierre"),
            "Motivo: " + (data.closeReason || "ninguno"),
            "Evento error: " + (data.socketError ? "sí" : "no"),
            "Reescritura del bootstrap: " + (data.bootstrapMapped ? "correcta" : "no confirmada"),
            "Solicitud pasó por Navy: " + (data.viaNavy ? "sí" : "no"),
            "Detalle: " + (data.detail || "ninguno")
          ].join("\n"));
        }
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish("Prueba 23 — Estabilidad WebSocket: ERROR\nEtapa: " + lastStage +
          "\nDetalle: el fixture no terminó dentro del límite de 215 segundos.");
      }, 215000);
      frame.src = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
        "/https/udrojasc.github.io/Navy/test/fixtures/websocket-stability/index.html?test=" + Date.now();
      document.body.appendChild(frame);
    });
  }

  
  const securityBoundaryButton = document.getElementById("security-boundary-button");
  if (securityBoundaryButton) {
    securityBoundaryButton.addEventListener("click", async () => {
      const output = document.getElementById("security-boundary-result");
      securityBoundaryButton.disabled = true;
      output.textContent = "Comprobando el bloqueo de destinos no autorizados y redes privadas…";
      const sessionId = crypto.randomUUID();
      const cases = [
        { label: "Dominio fuera de ALLOWED_HOSTS", target: "https://www.google.com/" },
        { label: "Dirección loopback (127.0.0.1)", target: "http://127.0.0.1/" },
        { label: "Dirección privada LAN (192.168.1.1)", target: "http://192.168.1.1/" }
      ];
      const results = [];
      try {
        for (const item of cases) {
          const target = new URL(item.target);
          const proxyUrl = "https://navy.ulisesdrojasc2.workers.dev/p/" + sessionId +
            "/" + target.protocol.slice(0, -1) + "/" + encodeURIComponent(target.host) +
            target.pathname + target.search;
          try {
            const response = await fetch(proxyUrl, { cache: "no-store" });
            let body = {};
            try { body = await response.json(); } catch (_) {}
            const passed = response.status === 403 && body.error === "Destino no autorizado.";
            results.push({
              label: item.label, status: response.status, passed: passed,
              detail: body.error || body.detail || "Respuesta sin mensaje JSON esperado"
            });
          } catch (error) {
            results.push({ label: item.label, status: "sin respuesta", passed: false, detail: error.message });
          }
        }
        const passedCount = results.filter(item => item.passed).length;
        output.textContent = [
          "Prueba 25 — Seguridad de destinos: " + (passedCount === cases.length ? "CORRECTA" : "ERROR"),
          "Comprobaciones superadas: " + passedCount + " / " + cases.length,
          "",
          ...results.flatMap((item, index) => [
            (index + 1) + ". " + item.label + ": " + (item.passed ? "BLOQUEADO correctamente" : "ERROR"),
            "   HTTP: " + item.status,
            "   Respuesta: " + item.detail
          ])
        ].join("\n");
      } finally {
        securityBoundaryButton.disabled = false;
      }
    });
  }

  const websocketStabilityDirectButton = document.getElementById("websocket-stability-direct-button");
  if (websocketStabilityDirectButton) {
    websocketStabilityDirectButton.addEventListener("click", () => {
      const output = document.getElementById("websocket-stability-direct-result");
      websocketStabilityDirectButton.disabled = true;
      output.textContent = "Conectando directamente a echo.websocket.org, sin Navy. La prueba durará aproximadamente 3 minutos…";
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;";
      let finished = false, timeoutId, lastStage = "cargando fixture directo";
      const finish = (message) => {
        if (finished) return;
        finished = true;
        window.removeEventListener("message", onMessage);
        if (timeoutId) window.clearTimeout(timeoutId);
        frame.remove();
        output.textContent = message;
        websocketStabilityDirectButton.disabled = false;
      };
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow || !event.data ||
            event.data.channel !== "NAVY_WS_STABILITY_TEST_23") return;
        const data = event.data;
        if (data.kind === "fixture-ready") {
          lastStage = "fixture cargado directamente desde GitHub Pages";
          return;
        }
        if (data.kind === "connecting") {
          lastStage = "el navegador creó el WebSocket directo: " + (data.socketUrl || "URL no disponible");
          output.textContent = "Prueba 24 en curso…\nConexión directa establecida. Intercambiando texto y binarios durante 3 minutos.";
          return;
        }
        if (data.kind === "progress") {
          const seconds = Math.floor(data.elapsedMs / 1000);
          output.textContent = [
            "Prueba 24 — Estabilidad directa: EN CURSO",
            "Tiempo transcurrido: " + Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") + " / 3:00",
            "Ciclos completos: " + data.completedCycles + " / " + data.expectedCycles,
            "Ecos de texto y binarios: " + data.completedCycles + " de cada tipo",
            "Latencia media: " + data.averageLatencyMs + " ms",
            "Latencia máxima: " + data.maxLatencyMs + " ms",
            "Destino: wss://echo.websocket.org/",
            "Conexión directa, sin Navy: " + (!data.viaNavy ? "sí" : "ERROR")
          ].join("\n");
          return;
        }
        if (data.kind === "closed" || data.kind === "error" || data.kind === "timeout") {
          const passed = data.kind === "closed" && data.connected && !data.socketError &&
            data.wasClean && data.closeCode === 1000 && data.elapsedMs >= 180000 &&
            data.completedCycles >= 30 && !data.viaNavy && !data.bootstrapMapped;
          finish([
            "Prueba 24 — Estabilidad directa: " + (passed ? "CORRECTA" : "ERROR"),
            "Conexión establecida: " + (data.connected ? "sí" : "no"),
            "Duración: " + (data.elapsedMs / 1000).toFixed(1) + " s",
            "Ciclos completos: " + data.completedCycles + " / " + data.expectedCycles,
            "Ciclos fallidos: " + data.failedCycles,
            "Ecos de texto: " + data.textEchoes,
            "Ecos binarios: " + data.binaryEchoes,
            "Latencia media: " + (data.averageLatencyMs ?? "sin datos") + " ms",
            "Latencia máxima: " + (data.maxLatencyMs ?? "sin datos") + " ms",
            "Cierre limpio: " + (data.wasClean ? "sí" : "no"),
            "Código de cierre: " + (data.closeCode ?? "sin cierre"),
            "Motivo: " + (data.closeReason || "ninguno"),
            "Evento error: " + (data.socketError ? "sí" : "no"),
            "Bootstrap de Navy: " + (data.bootstrapMapped ? "detectado inesperadamente" : "ausente, correcto"),
            "Solicitud pasó por Navy: " + (data.viaNavy ? "sí (inesperado)" : "no, conexión directa"),
            "Detalle: " + (data.detail || "ninguno")
          ].join("\n"));
        }
      };
      window.addEventListener("message", onMessage);
      timeoutId = window.setTimeout(() => {
        finish("Prueba 24 — Estabilidad directa: ERROR\nEtapa: " + lastStage +
          "\nDetalle: el fixture no terminó dentro del límite de 215 segundos.");
      }, 215000);
      frame.src = "https://udrojasc.github.io/Navy/test/fixtures/websocket-stability/index.html?direct=" + Date.now();
      document.body.appendChild(frame);
    });
  }

});