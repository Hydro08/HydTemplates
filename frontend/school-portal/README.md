# School Portal template

Sign in / sign up, a verified profile, and a class schedule. This is a **template**: the pages below show a sensible default,
and **you (the person using the template) decide how it works for your school.**

Open it with a local server (VS Code Live Server, XAMPP, or `python -m http.server 8000`), not by double-clicking the file.
`DEMO_MODE` in `shared/js/config.js` is `true` by default (no backend: the account, a hashed password and the profile are kept in the browser, so Sign in only works with the account made in Sign up; you can sign in with the username or the Student ID).

## Verification

After signing up or signing in, a user whose profile is not complete is sent to `profile.html`. They cannot enter the portal until every required field is filled in.
The required fields are listed in `profile.html`, `profile.js` and `demo-profile.js` (`PROFILE_FIELDS`), and in `backend/php-sqlite/api/profile.php`.

## Student ID: you decide

Right now the Student ID is **generated automatically (random)** when the account is created, for example `2026-48213`
(current year + 5 random digits). The student never types it, and it is shown read-only on the profile page.

This is only a default. Decide what fits your school and change one function:

| Where            | What to change                                                       |
|------------------|----------------------------------------------------------------------|
| Demo mode        | `generateStudentId()` in `frontend/school-portal/demo-profile.js`    |
| PHP + SQLite     | `random_student_id()` in `backend/php-sqlite/config/helpers.php`     |

Ideas: sequential numbers (`2026-00001`, `2026-00002`...), a prefix per course or year level, IDs issued by the school that the
student enters at sign up and you check against a list, or a format that matches your school's real IDs.
Whatever you choose, keep every ID **unique** (the database has a unique index on `users.student_id`).

## Username

The student does not type a username when signing up. It is **made automatically** from the year, the surname and a random 5-digit number (10000 to 99999),
for example `2026Pogi32198` (surname without spaces). It is shown read-only on the profile page, in the Name section after the Middle name,
and after signing up the sign in form is filled with it. The student signs in with this username and the password they chose.
If the backend says the username is taken (409), another random number is tried (up to 5 times).
Change `generateUsername()` in `frontend/school-portal/demo-profile.js` if you want another rule. The username only has letters and numbers, as the backends require.

## Address (Philippines)

Province, City / Municipality and Barangay are suggestion fields: type a letter and every place that starts with it appears.
Each field stays **locked** until the one before it is chosen (Province -> City / Municipality -> Barangay -> Street and ZIP),
and changing a field clears and locks the ones after it. Metro Manila is listed as "Metro Manila (NCR)".

The places come from the free public **PSGC API** (Philippine Statistics Authority data) at `PH_API_BASE` in `shared/js/config.js`.
- Needs an internet connection. If the list cannot be loaded, the address fields turn into plain text fields and a note is shown, so the form still works.
- It is a third-party service. To avoid depending on it, host the same JSON yourself and point `PH_API_BASE` to it. Paths (each returns an array of `{code, name}`):
  `/provinces/`, `/provinces/{code}/cities-municipalities/`, `/regions/130000000/cities-municipalities/` (Metro Manila), `/cities-municipalities/{code}/barangays/`.
- The PHP backend only checks that the address fields are filled in and not too long. It does not check them against the PSGC list.
- The code is in `locations.js`.

## Name, gender and civil status

Sign up asks for **Surname, First name and Middle name** (middle name is optional) instead of one full-name box.
The profile page has a Name section where the student can **edit** the three parts, plus **Gender** and **Civil status**.
The full name shown in the portal is made as `First Middle Surname` and follows the edited name.
To change the choices, edit the `<select>` lists in `profile.html` and the matching lists in `profile.js` and the backend `profile` file.

## Course / Strand

The field is called `section` in the code and database, but the page asks for **Course / Strand**. Type a letter and the matching courses
and strands are suggested (for example `In` -> Information Technology; you can also type a code such as `BSIT` or `STEM`).
A student can still type something that is not on the list. Edit the list in `courses.js` (`COURSES`).

## Phone numbers (all countries)

Every phone field (student, father, mother, guardian) has a flag + country code picker (default Philippines +63).
Click the flag to search by country name or code. Pasting `+63 917...` or `0917...` also works.
The first digit of the number is filled in for you (Philippines: `9`, so you type the other 9 digits), and the box stops at the right length for the country (Philippines: 10 digits).
The first digit and the length per country are in `PHONE_SPECS` in `phone.js`; countries that are not listed accept 6 digits up to the international maximum.
The value saved is the full number, e.g. `+63 9171234567`. The flag images come from flagcdn.com (needs internet).
The code is in `phone.js`; to add a phone field, give any `<input type="tel">` the `data-phone` attribute.

Required errors (red) disappear by themselves after 3 seconds (`ERROR_MS` in `profile.js`).
The Guardian fields are required like Father and Mother; to make them optional, remove them from `PROFILE_FIELDS` in `demo-profile.js` and the `required` attributes in `profile.html`.

## Files

- `index.html`, `auth.js`, `auth.css`: sign in / sign up
- `portal.html`, `portal.js`, `portal.css`: dashboard (announcements, class schedule)
- `profile.html`, `profile.js`, `profile.css`, `locations.js`, `phone.js`, `courses.js`: profile form
- `admin.html`, `admin.js`, `admin.css`: admin page
- `theme.js`, `theme.css`: color circle (palette)
- `session.js`: the signed-in user, sign out, session check
- `demo-profile.js`: demo-mode storage and the demo Student ID

## Passwords

- **Sign up rules** (`PASSWORD_RULES` in `password.js`): at least 8 characters, an uppercase letter, a number and a special character. A live checklist shows which rules are met.
- **Change password** is on the Profile page (`profile.html`, "Account security", code in `change-password.js`). It asks for the current password, the new one (same rules) and a confirmation.
- **Menu**: the burger button (`menu.js`, `menu.css`) opens Dashboard, Enrollment, Schedule, Grades, Calendar events, Profile and Sign out. `portal.html` is one page; the menu links use `#dashboard`, `#enrollment`, `#schedule`, `#grades` and `#calendar`. Enrollment, grades and events use sample data in `portal.js`.
- **Demo mode** saves the account with a salted PBKDF2 hash in `localStorage` (`password.js`). It is a preview only: it is not real security.
- **Real backend**: the browser check is only for convenience, so the server enforces the same rules on `/register` and `/change-password`
  (the bundled PHP + SQLite, PHP + MySQL, Node + Express and Flask backends already do this).
  The Profile form sends `POST {API_BASE_URL}/change-password` with `{ "current_password", "new_password" }` and expects `{ "message" }` on errors
  (403 when the current password is wrong, 422 when the new password is too weak). If you write your own backend, add the same endpoint.

## Admin page

`admin.html` (with `admin.js`, `admin.css`) is only for the admin. In demo mode the admin signs in at the normal Sign in page with `DEMO_ADMIN` in `shared/js/config.js`
(default `admin` / `Admin@12345`: change or remove it before you share the template). Students who open `admin.html` are sent to `portal.html`, and the admin is sent to `admin.html` after signing in.
- **Overview**: number of students, verified, not verified and announcements.
- **Students**: search, filter by status and delete an account (demo mode reads the accounts saved in this browser).
- **Announcements**: post or remove the announcements shown on the students' dashboard (`portal.html`).
- **Real backend**: `/login` must return `"role": "admin"` for admin accounts. The backends add a `users.role` column (default `student`). Make an admin by signing up, then run `UPDATE users SET role = 'admin' WHERE username = 'yourname';`. All four backends have `GET /api/admin-students` and `DELETE /api/admin-students?username=...`.

## Color circle (palette)

The circle next to the name (portal, profile and admin pages) opens the same palette as the Quiz App: ready-made color sets plus background, text, button and link colors, saved per user in the browser.
Starting colors, the preset list and `allowColorPicker` are at the top of `theme.js` (`PORTAL_THEME`).

## "Back to templates"

The pill shows only on the sign in / sign up page (`index.html`), and only when the template is opened from the Hyd Templates dashboard.

## Calendar

The Calendar events view is a month grid. Dates with an event have a dot; click a date to open a modal with that day's events. Edit the `events` list in `portal.js`.

## Username and Student ID

The Student ID uses the same number as the username: `2026Pogi32198` gets the Student ID `2026-32198`. In demo mode this is done in `studentIdFromUsername()` (`demo-profile.js`); the backends do the same when the account is created (an old account keeps the ID it already has). If the ID is already taken, sign up makes a new username and tries again.

## Reset password

On the Sign in form, "Forgot password?" opens the reset form **on the same page**: no new page opens, only the address changes to `index.html#reset-password` (the Back button works). The same password rules as sign up apply (8+ characters, uppercase, number, special character) with the live checklist.
- Demo mode: type a username or Student ID made in this browser, then choose a new password (no email is sent).
- Real backend (you add these two endpoints; the frontend already calls them, see the comment above "Reset password" in `auth.js`):
  - `POST /forgot-password` with `{ identifier }`: send an email with the link `index.html?token=THE_TOKEN#reset-password`. Always answer 200 with the same message.
  - `POST /reset-password` with `{ token, password }`: check the token (one use, short expiry) and the password rules, then answer 200. Answer 400 or 410 for a wrong or expired token.
- The address uses `#reset-password` so it also works on a plain static server. If your server can rewrite `/reset-password` to `index.html`, you can change `RESET_HASH` and the link in your email.

"Account security" (change password) is now shown on the profile page only after the account is verified, not during verification.

## Home address and Province address

The Contact section has two addresses. **Home address** is the normal one (province, city / municipality, barangay, ZIP, street). Under **Province address** there is a "Same as home address" box, checked by default: the Province address fields are hidden and copy the home address. Uncheck it and the student types a different Province address (the same place lists as the home address). The saved profile has the extra fields `prov_province`, `prov_city`, `prov_barangay`, `prov_street` and `prov_zip` (see `PROFILE_FIELDS` in `demo-profile.js`). A profile without them is not complete, so a student who was verified before this change fills in the box once more.
