/* ==========================================================================
   site-links.js  -  The buttons and links beside the title (top of the dashboard)
   --------------------------------------------------------------------------
   What shows up is written in site.config.js: the "Back to templates" button and
   your own headerLinks. This file only draws them. Needs site.config.js.
   ========================================================================== */

(function () {
  const nav = document.getElementById("site-links");
  if (!nav) return;
  const config = (typeof SITE_CONFIG !== "undefined" && SITE_CONFIG) || {};

  /* Links from the config: skip the ones with no text/url and anything starting with "javascript:" */
  const custom = (config.headerLinks || [])
    .filter(item => item && item.text && item.url && !/^\s*javascript:/i.test(item.url));

  let backLink = null;   // the "Back to templates" item, once we know it should show

  function draw() {
    nav.textContent = "";
    [backLink, ...custom].filter(Boolean).forEach(item => {
      const link = document.createElement("a");
      link.href = item.url;
      link.textContent = item.text;
      link.className = item.style === "link" ? "site-link" : "btn site-link";
      if (item.newTab) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      nav.appendChild(link);
    });
    nav.hidden = !nav.children.length;
  }
  draw();

  /* "Back to templates" */
  const back = config.backToTemplates || { show: "auto" };
  const backItem = {
    text: back.text || "\u2190 Back to templates",
    url: back.url || "../../index.html",
    style: "button",
    newTab: false
  };
  if (back.show === true) {
    backLink = backItem;
    draw();
  } else if (back.show === "auto") {
    /* Only when the Hyd Templates dashboard is next to this folder (templates.json exists) */
    const checkUrl = new URL("../../templates.json", document.currentScript.src).href;
    fetch(checkUrl, { method: "HEAD" })
      .then(res => {
        if (!res.ok) return;
        backItem.url = new URL(backItem.url, document.currentScript.src).href;
        backLink = backItem;
        draw();
      })
      .catch(() => { /* opened from a file or a downloaded copy: no button */ });
  }
})();
