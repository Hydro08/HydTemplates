/* The menu (burger button, top left). Shared by portal.html and profile.html.
   Links to the page you are already on just close the menu (the Profile link must not reload the form). */
const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const menuBackdrop = document.getElementById("menuBackdrop");

function openMenu() {
  sideMenu.removeAttribute("inert");
  sideMenu.setAttribute("aria-hidden", "false");
  sideMenu.classList.add("open");
  menuBackdrop.hidden = false;
  menuBtn.setAttribute("aria-expanded", "true");
  document.documentElement.classList.add("menu-open");   // the page behind stays still
  document.getElementById("menuClose").focus();
}
function closeMenu() {
  if (!sideMenu.classList.contains("open")) return;
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden", "true");
  sideMenu.setAttribute("inert", "");
  menuBackdrop.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  document.documentElement.classList.remove("menu-open");
}
menuBtn.addEventListener("click", openMenu);
menuBackdrop.addEventListener("click", closeMenu);
document.getElementById("menuClose").addEventListener("click", () => { closeMenu(); menuBtn.focus(); });
sideMenu.addEventListener("click", e => {
  const a = e.target.closest("a[href]");
  if (!a || a.pathname !== location.pathname) return;
  if (!a.hash) e.preventDefault();   // same page, no section: do not reload
  closeMenu();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && sideMenu.classList.contains("open")) { closeMenu(); menuBtn.focus(); } });
