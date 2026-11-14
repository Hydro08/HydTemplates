/* ==========================================================================
   questions.js  -  The questions of the standalone one-quiz mode (see quiz.js)
   --------------------------------------------------------------------------
   Edit this file to change that quiz. No other file needs to change.

   NOTE: the dashboard (app.js) does NOT use this file. Questions there are
   added by the admin on the page and saved in the database (db.js).

   Each question has:
     text    the question
     choices 2 to 5 possible answers
     answer  the position of the correct choice (0 = first choice, 1 = second...)
   ========================================================================== */

/* Settings for the quiz */
const QUIZ_SETTINGS = {
  title: "General Knowledge Quiz",
  timePerQuestion: 20,       // seconds for each question. Use 0 for no timer.
  shuffleQuestions: true,    // true = questions appear in random order
  shuffleChoices: true,      // true = choices appear in random order
  passPercent: 60            // the score (in %) needed to pass
};

/* The questions. To add one, copy a { ... } block and change it. */
const QUESTIONS = [
  { text: "What is the capital of the Philippines?",
    choices: ["Cebu City", "Manila", "Davao City", "Quezon City"], answer: 1 },

  { text: "Which planet is closest to the Sun?",
    choices: ["Venus", "Earth", "Mercury", "Mars"], answer: 2 },

  { text: "Who is known as the national hero of the Philippines?",
    choices: ["José Rizal", "Andres Bonifacio", "Emilio Aguinaldo", "Apolinario Mabini"], answer: 0 },

  { text: "What is 12 × 12?",
    choices: ["124", "132", "144", "156"], answer: 2 },

  { text: "What does HTML stand for?",
    choices: ["HyperText Markup Language", "High Tech Modern Language", "HyperText Machine Link", "Home Tool Markup Language"], answer: 0 },

  { text: "What is the chemical formula of water?",
    choices: ["CO2", "H2O", "O2", "NaCl"], answer: 1 },

  { text: "Which is the largest ocean on Earth?",
    choices: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"], answer: 3 },

  { text: "In what year did the Philippines declare independence from Spain?",
    choices: ["1896", "1898", "1946", "1935"], answer: 1 },

  { text: "Which gas do plants take in from the air for photosynthesis?",
    choices: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },

  { text: "What is CSS used for on a website?",
    choices: ["Storing data", "Styling the page", "Running a server", "Sending email"], answer: 1 }
];
