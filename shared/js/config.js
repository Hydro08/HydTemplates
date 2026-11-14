// Change this depending on the backend you use.
// PHP (router.php / XAMPP): "/api"
// Node:  "http://localhost:3000/api"
// Flask: "http://localhost:5000/api"
const API_BASE_URL = "/api";

// true  = template preview only: any username and password is accepted, no backend needed.
// false = use a real backend (login/register/profile at API_BASE_URL).
const DEMO_MODE = true;

// Where the profile page loads Philippine provinces, cities/municipalities and barangays from.
// Default: the free public PSGC API (Philippine Statistics Authority data).
// To host the data yourself, use the same paths: /provinces/, /provinces/{code}/cities-municipalities/,
// /regions/130000000/cities-municipalities/ (Metro Manila) and /cities-municipalities/{code}/barangays/
// Each returns a JSON array of {code, name}.
const PH_API_BASE = "https://psgc.gitlab.io/api";

// DEMO_MODE only: the admin account (opens admin.html). Change it, or remove it, before you share the template.
// With a real backend, the /login response must include "role": "admin" for admin accounts (and the server must check the role on admin endpoints).
const DEMO_ADMIN = { username: "admin", password: "Admin@12345" };
