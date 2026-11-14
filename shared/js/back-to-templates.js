/* back-to-templates.js - adds a small "Back to templates" link. Include it ONLY on the authentication (sign in / sign up) page of a template.
   It only shows when the template is opened from the Hyd Templates dashboard
   (it checks that ../../templates.json exists). In a downloaded copy the link
   hides itself, so students never see a broken link. */
(function () {
  const dashboardUrl = new URL("../../index.html", document.currentScript.src).href;
  const checkUrl = new URL("../../templates.json", document.currentScript.src).href;

  fetch(checkUrl, { method: "HEAD" })
    .then(res => {
      if (!res.ok) return;
      const link = document.createElement("a");
      link.href = dashboardUrl;
      link.textContent = "\u2190 Back to templates";
      link.setAttribute("style",
        "position:fixed;left:12px;bottom:12px;z-index:9999;padding:.45rem .85rem;" +
        "border-radius:999px;background:rgba(20,20,20,.82);color:#fff;font:600 .85rem/1 system-ui,sans-serif;" +
        "text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.3)");
      document.body.appendChild(link);
    })
    .catch(() => { /* opened from a file or a downloaded copy: no link */ });
})();
