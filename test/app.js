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


  const postForm = document.getElementById("navy-post-form");
  if (postForm) {
    postForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("navy-post-button");
      const result = document.getElementById("navy-post-result");
      button.disabled = true;
      result.textContent = "Enviando formulario mediante POST a Navy…";
      try {
        const formData = new FormData(postForm);
        const body = new URLSearchParams();
        for (const [key, value] of formData.entries()) body.append(key, value);
        const response = await fetch("https://navy.ulisesdrojasc2.workers.dev/__navy_test/echo", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: body.toString(),
          cache: "no-store"
        });
        const data = await response.json();
        const passed = response.ok && data.ok === true &&
          data.method === "POST" &&
          data.fields.nombre === formData.get("nombre") &&
          data.fields.mensaje === formData.get("mensaje") &&
          data.bodyLength <= 16 * 1024;
        result.textContent = [
          "Formulario y POST: " + (passed ? "correcto" : "ERROR"),
          "HTTP recibido: " + response.status,
          "Método recibido: " + (data.method || "—"),
          "Tipo de contenido: " + (data.contentType || "—"),
          "Bytes recibidos: " + (data.bodyLength ?? "—"),
          "Campos recibidos:",
          JSON.stringify(data.fields || data, null, 2),
          passed
            ? "Navy recibió los campos del formulario y los devolvió sin almacenarlos."
            : "No se confirmó la recepción correcta de todos los campos."
        ].join("\n");
      } catch (error) {
        result.textContent = "Formulario y POST: ERROR\n" + error.message;
      } finally {
        button.disabled = false;
      }
    });
  }

});
