(function () {
  const token = new URLSearchParams(location.search).get("token");
  const report = (data) => parent.postMessage(Object.assign({type:"navy-relative-assets",token:token},data),"*");
  window.addEventListener("message", function (event) {
    if (event.source !== parent || !event.data || event.data.type !== "navy-relative-navigate" || event.data.token !== token) return;
    const link = document.getElementById("relative-navigation");
    if (link) link.click();
  });
  window.addEventListener("DOMContentLoaded", function () {
    const image = document.getElementById("relative-image");
    const cssLoaded = getComputedStyle(document.body).getPropertyValue("--navy-relative-css").trim() === "loaded";
    const imageLoaded = Boolean(image && image.complete && image.naturalWidth > 0);
    const cssUrl = document.querySelector('link[rel="stylesheet"]').href;
    const scriptUrl = document.currentScript && document.currentScript.src;
    const imageUrl = image ? image.currentSrc : "";
    const link = document.getElementById("relative-navigation");
    const destination = new URL(link.href);
    destination.searchParams.set("token", token);
    link.href = destination.href;
    report({
      cssLoaded: cssLoaded,
      imageLoaded: imageLoaded,
      cssUrl: cssUrl,
      scriptUrl: scriptUrl,
      imageUrl: imageUrl,
      linkUrl: link.href,
      allResourcesThroughProxy: [cssUrl, scriptUrl, imageUrl].every(function (url) {
        return url.includes("/p/") && url.includes("/https/udrojasc.github.io/");
      })
    });
  });
})();