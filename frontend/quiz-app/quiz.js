/* ==========================================================================
   quiz.js  -  Standalone one-quiz mode (questions come from questions.js)
   --------------------------------------------------------------------------
   NOTE: index.html and dashboard.html do NOT load this file. It is a small
   separate quiz with one question at a time, a timer and a score screen.
   To use it, make an HTML page that has the ids listed in the "Page
   elements" section below, and load these scripts in this order:
       ../../shared/js/utils.js, questions.js, quiz.js

   Needs: escapeHtml() from shared/js/utils.js, and QUESTIONS and
   QUIZ_SETTINGS from questions.js.

   Parts of this file:
     1. Page elements and variables
     2. Preparing the questions
     3. Best score
     4. Showing and starting
     5. Showing one question
     6. Timer
     7. Answering and next question
     8. Result screen
     9. Start-up
   ========================================================================== */


/* ---------- 1. Page elements and variables ---------- */

/* Shortcut: getById("start-button") is the same as document.getElementById("start-button") */
const getById = id => document.getElementById(id);

/* The three screens. Only one is visible at a time. */
const startScreen  = getById("start-screen");
const quizScreen   = getById("quiz-screen");
const resultScreen = getById("result-screen");

/* Where the best score is saved in the browser */
const BEST_SCORE_KEY = "quizApp.best";

/* State of the quiz that is running now */
let questions = [];      // the questions of this round (already mixed)
let questionNumber = 0;  // position of the current question (0 = first)
let score = 0;           // correct answers so far
let answers = [];        // one entry per answered question: { picked, correct }
let locked = false;      // true after answering, so a second click does nothing
let timerId = null;      // id of the running timer
let secondsLeft = 0;     // seconds left for the current question


/* ---------- 2. Preparing the questions ---------- */

/* Return a mixed copy of a list (the original list is not changed) */
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* Make a fresh copy of the questions for this round.
   Each choice becomes { label, isAnswer } so we still know the right one after mixing.
   Mixing never changes questions.js. */
function prepareQuestions() {
  let list = QUESTIONS.map(question => ({
    text: question.text,
    choices: question.choices.map((label, position) => ({
      label: label,
      isAnswer: position === question.answer
    }))
  }));

  if (QUIZ_SETTINGS.shuffleChoices) {
    list = list.map(question => ({ ...question, choices: shuffle(question.choices) }));
  }
  if (QUIZ_SETTINGS.shuffleQuestions) {
    list = shuffle(list);
  }
  return list;
}


/* ---------- 3. Best score ---------- */

function readBestScore() {
  try {
    return JSON.parse(localStorage.getItem(BEST_SCORE_KEY));
  } catch (error) {
    return null;
  }
}

/* Save the score only if it is better than the saved one */
function saveBestScore(percent) {
  try {
    const best = readBestScore();
    if (!best || percent > best.percent) {
      localStorage.setItem(BEST_SCORE_KEY, JSON.stringify({ percent }));
    }
  } catch (error) {
    /* storage is blocked: skip it */
  }
  showBestScore();
}

function showBestScore() {
  const best = readBestScore();
  getById("best-score").textContent = best ? `Best score: ${best.percent}%` : "";
}


/* ---------- 4. Showing and starting ---------- */

/* Show one screen and hide the other two */
function showScreen(screenToShow) {
  [startScreen, quizScreen, resultScreen].forEach(screen => {
    screen.hidden = screen !== screenToShow;
  });
}

function startQuiz() {
  questions = prepareQuestions();
  questionNumber = 0;
  score = 0;
  answers = [];
  showScreen(quizScreen);
  showQuestion();
}


/* ---------- 5. Showing one question ---------- */

function showQuestion() {
  const question = questions[questionNumber];
  locked = false;

  /* Progress text and progress bar */
  getById("progress-text").textContent = `Question ${questionNumber + 1} of ${questions.length}`;
  const percentDone = Math.round((questionNumber / questions.length) * 100);
  getById("progress-bar-fill").style.width = percentDone + "%";
  document.querySelector(".progress-bar").setAttribute("aria-valuenow", percentDone);

  /* The question, an empty message, and a hidden Next button */
  getById("question-text").textContent = question.text;
  getById("answer-message").textContent = "";
  getById("answer-message").className = "message";
  getById("next-button").hidden = true;
  getById("next-button").textContent = questionNumber === questions.length - 1 ? "See result" : "Next question";

  /* One button per choice. data-position tells us which one was clicked. */
  getById("choices").innerHTML = question.choices.map((choice, position) =>
    `<button type="button" class="choice-button" data-position="${position}">${escapeHtml(choice.label)}</button>`
  ).join("");

  startTimer();
}


/* ---------- 6. Timer ---------- */

function startTimer() {
  stopTimer();
  const timerLabel = getById("timer");

  /* timePerQuestion = 0 means no timer */
  if (!QUIZ_SETTINGS.timePerQuestion) {
    timerLabel.hidden = true;
    return;
  }

  timerLabel.hidden = false;
  secondsLeft = QUIZ_SETTINGS.timePerQuestion;
  showTimer();

  timerId = setInterval(() => {
    secondsLeft--;
    showTimer();
    if (secondsLeft <= 0) {
      stopTimer();
      answerQuestion(null);   // time is up: counts as no answer
    }
  }, 1000);
}

function showTimer() {
  const timerLabel = getById("timer");
  timerLabel.textContent = `${secondsLeft}s`;
  timerLabel.classList.toggle("time-low", secondsLeft <= 5);   // turns red in the last 5 seconds
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}


/* ---------- 7. Answering and next question ---------- */

/* pickedPosition = position of the clicked choice, or null if time ran out */
function answerQuestion(pickedPosition) {
  if (locked) return;   // already answered
  locked = true;
  stopTimer();

  const question = questions[questionNumber];
  const correctPosition = question.choices.findIndex(choice => choice.isAnswer);
  const isCorrect = pickedPosition === correctPosition;

  if (isCorrect) score++;
  answers.push({ picked: pickedPosition, correct: isCorrect });

  /* Lock the buttons and color the right and wrong choice */
  document.querySelectorAll(".choice-button").forEach((button, position) => {
    button.disabled = true;
    if (position === correctPosition) button.classList.add("correct");
    else if (position === pickedPosition) button.classList.add("wrong");
  });

  /* Tell the student how they did */
  const message = getById("answer-message");
  if (isCorrect) {
    message.textContent = "Correct!";
    message.classList.add("success");
  } else if (pickedPosition === null) {
    message.textContent = "Time is up. The correct answer is highlighted.";
    message.classList.add("error");
  } else {
    message.textContent = "Wrong. The correct answer is highlighted.";
    message.classList.add("error");
  }

  getById("next-button").hidden = false;
  getById("next-button").focus();
}

function goToNextQuestion() {
  questionNumber++;
  if (questionNumber < questions.length) showQuestion();
  else showResult();
}


/* ---------- 8. Result screen ---------- */

function showResult() {
  stopTimer();
  const total = questions.length;
  const percent = Math.round((score / total) * 100);

  getById("score-number").textContent = score;
  getById("score-total").textContent = total;
  getById("score-message").textContent = percent >= QUIZ_SETTINGS.passPercent
    ? `${percent}%. You passed!`
    : `${percent}%. You need ${QUIZ_SETTINGS.passPercent}% to pass. Try again.`;

  /* Review: every question with the student's answer, and the right answer if they missed it */
  getById("review-list").innerHTML = questions.map((question, number) => {
    const answer = answers[number];
    const rightAnswer = question.choices.find(choice => choice.isAnswer).label;
    const yourAnswer = answer.picked === null
      ? "No answer (time ran out)"
      : question.choices[answer.picked].label;

    return `<li>
      <strong>${escapeHtml(question.text)}</strong><br>
      <span class="your-answer ${answer.correct ? "success" : "error"}">Your answer: ${escapeHtml(yourAnswer)}</span>
      ${answer.correct ? "" : `<br><span class="muted">Correct answer: ${escapeHtml(rightAnswer)}</span>`}
    </li>`;
  }).join("");

  saveBestScore(percent);
  showScreen(resultScreen);
  getById("progress-bar-fill").style.width = "100%";
}


/* ---------- 9. Start-up ---------- */

/* Fill in the title and the info line on the start screen */
getById("quiz-title").textContent = QUIZ_SETTINGS.title;
getById("quiz-info").textContent =
  `${QUESTIONS.length} questions` +
  (QUIZ_SETTINGS.timePerQuestion ? `, ${QUIZ_SETTINGS.timePerQuestion} seconds each.` : ", no time limit.");

/* Buttons */
getById("start-button").addEventListener("click", startQuiz);
getById("retry-button").addEventListener("click", startQuiz);
getById("next-button").addEventListener("click", goToNextQuestion);

/* One listener for all choice buttons (they are created again for every question) */
getById("choices").addEventListener("click", event => {
  const button = event.target.closest(".choice-button");
  if (button) answerQuestion(Number(button.dataset.position));
});

showBestScore();
