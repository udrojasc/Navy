document.addEventListener("DOMContentLoaded", async () => {
  const set = (id, message) => { document.getElementById(id).textContent = message; };
  set("js-check", "JavaScript: correcto");
  set("css-check", getComputedStyle(document.body).backgroundImage !== "none"
    ? "CSS: correcto" : "CSS: no detectado");

  const image = document.getElementById("test-image");
  const checkImage = () => {
    set("image-check", image.naturalWidth > 0
      ? "Imagen: cargada correctamente"
      : "Imagen: ERROR al cargar");
  };
  image.addEventListener("load", checkImage);
  image.addEventListener("error", () => set("image-check", "Imagen: ERROR al cargar"));
  // La imagen puede terminar de cargar antes de que DOMContentLoaded ejecute este script.
  if (image.complete) checkImage();

  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    set("fetch-check", "Fetch: correcto — " + data.message);
  } catch (error) {
    set("fetch-check", "Fetch: ERROR — " + error.message);
  }
  document.getElementById("run-button").addEventListener("click", () => {
    set("js-check", "JavaScript: botón interactivo correcto ✓");
  });
});