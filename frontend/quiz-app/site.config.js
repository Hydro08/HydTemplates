/* ==========================================================================
   site.config.js  -  THE PLACE TO CUSTOMIZE THE SITE
   --------------------------------------------------------------------------
   Change the title, the default colors, the buttons and the links of the site here.
   You do not need to touch any other file. Save, then refresh the page.

   Used by: logo.js (title), theme.js (colors + color circle), site-links.js (buttons and links
   beside the title). Loaded BEFORE them in index.html and dashboard.html.
   ========================================================================== */

const SITE_CONFIG = {

  /* ----- TEXT: the big title at the top of every page ----- */
  title: "Quizzlet",

  /* ----- COLORS: the starting colors for everybody (now black and white) -----
     Write a color like "#fef3c7", or null to keep the normal color.
       background  the page background          text   all the text
       button      buttons (Add, Save...)        link   links (breadcrumbs, "See more"...)
       shadow      the shadow of the title (optional, null = automatic)
     Cards and lines follow background and text, so you only need the first four. */
  colors: {
    background: "#ffffff",
    text: "#000000",
    button: "#000000",
    link: "#000000",
    shadow: null      // the 3D shadow of the title. null = automatic gray that follows the colors
  },

  /* ----- COLOR CIRCLE (top right, next to the name) -----
     true  = every user can pick their own colors (saved in their browser)
     false = hide the circle, everybody sees the colors above */
  allowColorPicker: true,

  /* The ready-made choices inside the color circle. Add, remove or rename as you like. */
  presets: [
    { name: "Black & White", background: "#ffffff", text: "#000000", button: "#000000", link: "#000000" },   // the default
    { name: "Inverted",      background: "#000000", text: "#ffffff", button: "#ffffff", link: "#ffffff" },
    { name: "Ocean",         background: "#e0f2fe", text: "#0c4a6e", button: "#0369a1", link: "#0369a1" },
    { name: "Sepia",         background: "#f5ecd9", text: "#4a3728", button: "#b45309", link: "#92400e" },
    { name: "Forest",        background: "#ecfdf5", text: "#064e3b", button: "#047857", link: "#047857" },
    { name: "Lavender",      background: "#f3e8ff", text: "#3b0764", button: "#7e22ce", link: "#7e22ce" },
    { name: "Rose",          background: "#fff1f2", text: "#881337", button: "#be123c", link: "#be123c" },
    { name: "Midnight",      background: "#0f172a", text: "#e2e8f0", button: "#38bdf8", link: "#38bdf8" },
    { name: "Sunset",        background: "#fff7ed", text: "#7c2d12", button: "#ea580c", link: "#c2410c" },
    { name: "Mint",          background: "#f0fdfa", text: "#134e4a", button: "#0d9488", link: "#0f766e" },
    { name: "Graphite",      background: "#1f2937", text: "#f3f4f6", button: "#f59e0b", link: "#fbbf24" },
    { name: "Berry Night",   background: "#2e1065", text: "#f3e8ff", button: "#e879f9", link: "#e879f9" }
  ],

  /* ----- BUTTON "Back to templates" (beside the title) -----
     "auto" = shows only when the site is opened from the Hyd Templates dashboard (a downloaded copy hides it)
     true   = always show it (set url to where it should go)
     false  = never show it */
  backToTemplates: {
    show: "auto",
    text: "\u2190 Back to templates",
    url: "../../index.html"
  },

  /* ----- YOUR OWN BUTTONS AND LINKS (beside the title) -----
     Each one: text (what it says), url (where it goes), style ("button" or "link"),
     newTab (true = opens in a new tab). Remove the // to turn the examples on. */
  headerLinks: [
    // { text: "My school website", url: "https://example.com", style: "button", newTab: true },
    // { text: "Contact us", url: "mailto:teacher@example.com", style: "link", newTab: false }
  ]
};
