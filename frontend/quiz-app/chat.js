/* ==========================================================================
   chat.js  -  Messages between students and teachers (and between classmates)
   --------------------------------------------------------------------------
   WHO CAN TALK TO WHO
     student  <->  the teachers whose class the student joined
     student  <->  classmates (students who share at least one teacher)
     teacher  <->  the students in their class
     admin        has no chat (but reads the REPORTS tab, see section 6)
   (If a student is removed from a class, the two cannot write to each other anymore.
    The old messages stay saved, and come back if the student joins again.)

   WHAT YOU CAN DO WITH A MESSAGE
     - Three dots next to every message: React, Reply, Forward, Copy, and
       Report (a message someone sent you) or Unsend (a message you sent).
     - HOLD a message (about half a second, finger or mouse) = the quick reactions bar.
       One reaction per person per message. Tap the same emoji again to take it away.
     - Reply: the new message shows a small quote of the old one. Tap the quote to jump to it.
     - Forward: sends a copy (marked "Forwarded") to another person you may chat with.
     - Report: the admin sees it under Reports and can dismiss it or remove the message.
     - Unsend: the text is erased for both sides ("Message unsent" stays in the chat).

   WHERE IT SHOWS UP
     - Menu (burger): a "Messages" button for the student and the teacher, with the number of unread messages.
     - The burger button itself shows the same number (together with the teacher's requests, or the admin's reports).
     - Opening "Messages" shows the people on the left and the conversation on the right.
       On a phone you see the people first, then the conversation, with a Back button.

   HOW IT WORKS
     - app.js calls renderChat() when the "chat" tab is open, and chatNotifyNew() on every redraw.
     - Buttons use data-chat="open | back | send | menu | emoji | reply | ..." (this file listens to them, not app.js).
     - The little menus and boxes (options, reactions, forward, report) are drawn in one
       floating layer (#chat-layer) that is outside the page, so a redraw does not close them by accident.
     - While you type, a redraw (for example a new message from the other tab) does NOT wipe the box:
       renderChat() only updates the people and the messages when the same conversation is already open.
       An unsent text (and the message you are replying to) is remembered for each person.

   BACKEND
     This demo saves messages in the browser (database.messages and database.reports, see db.js).
     To use a real backend, replace ONLY the functions in "1. Data" (chatStoreSend, chatStoreMarkRead,
     chatStoreReact, chatStoreUnsend, chatStoreReport and the reading of database.messages).
     The endpoints in backend/CHAT-API.md cover send / open / mark read / list / unread. Replies,
     reactions, forwarding and reports need a few more fields and endpoints (see "Message fields" in db.js).

   Needs: utils.js (escapeHtml), db.js (database, saveDatabase, makeId, getDisplayName, prettifyName), toast.js (showToast),
   and these from app.js (used only when a function runs, so chat.js loads BEFORE app.js):
   currentUser, isAdmin, isTeacher, isStudent, view, mainContent, quizInProgress, refreshFromStorage,
   updateMenuBadge, renderPage.
   ========================================================================== */


/* ---------- 0. Settings and memory ---------- */

const CHAT_MAX_LENGTH = 500;          // the longest message (the backend checks the same number)
const CHAT_WIDE_SCREEN = "(min-width: 720px)";
const CHAT_HOLD_TIME = 450;           // how long to hold a message to open the reactions (milliseconds)
const CHAT_HOLD_MOVE = 10;            // if the finger moves more than this (pixels) it is a scroll, not a hold

/* thumbs up, heart, laughing, surprised, sad, folded hands */
const CHAT_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];

const CHAT_REPORT_REASONS = [
  "Spam",
  "Bullying or harassment",
  "Inappropriate content",
  "Sharing quiz answers",
  "Something else"
];

const chatDrafts = {};                // username -> the text that was typed but not sent yet
const chatReplies = {};               // username -> id of the message the person is replying to
let chatPeer = null;                  // the username of the person whose conversation is open (null = none)
let chatShownPeer = null;             // the conversation that is drawn on the screen right now
let chatKnownUnread = null;           // ids of the unread messages we already know about (for the pop-up)
let chatHoldAt = 0;                   // when a hold last opened the reactions (to ignore the click that follows it)


/* ---------- 1. Data (the only part that reads and writes messages) ---------- */

/* Save a new message. Gives back the message, or null if this person may not write to that one.
   extra = { replyTo: id of the message being answered, forwarded: true } (both optional) */
function chatStoreSend(to, text, extra = {}) {
  if (!refreshFromStorage()) return null;     // newest data first (another tab may have changed it)
  if (!chatCanTalkTo(to)) return null;
  const message = { id: makeId(), from: currentUser.username, to, text, time: Date.now(), read: false };
  if (extra.replyTo && chatMessageBelongsTo(chatFindMessage(extra.replyTo), to)) message.replyTo = extra.replyTo;
  if (extra.forwarded) message.forwarded = true;
  database.messages.push(message);
  saveDatabase(database);
  return message;
}

/* Everything the other person wrote to me in this conversation is now read. Gives back true if something changed. */
function chatStoreMarkRead(peer) {
  if (!refreshFromStorage()) return false;
  let changed = false;
  database.messages.forEach(message => {
    if (message.to === currentUser.username && message.from === peer && !message.read) {
      message.read = true;
      changed = true;
    }
  });
  if (changed) saveDatabase(database);
  return changed;
}

/* React to a message with an emoji. The same emoji again takes the reaction away. Gives back true if saved. */
function chatStoreReact(messageId, emoji) {
  if (!refreshFromStorage() || !CHAT_REACTIONS.includes(emoji)) return false;
  const message = chatFindMessage(messageId);
  const other = message ? chatOtherSide(message) : null;
  if (!message || message.deleted || !other || !chatCanTalkTo(other)) return false;

  const reactions = Object.assign({}, message.reactions);
  if (reactions[currentUser.username] === emoji) delete reactions[currentUser.username];
  else reactions[currentUser.username] = emoji;

  if (Object.keys(reactions).length) message.reactions = reactions;
  else delete message.reactions;
  saveDatabase(database);
  return true;
}

/* Unsend one of MY messages: the text is erased, a small "Message unsent" stays. Gives back true if done. */
function chatStoreUnsend(messageId) {
  if (!refreshFromStorage()) return false;
  const message = chatFindMessage(messageId);
  if (!message || message.from !== currentUser.username || message.deleted) return false;
  chatEraseMessage(message);
  saveDatabase(database);
  return true;
}

/* Report a message that somebody sent ME. Gives back "ok", "again" (already reported by me) or null (not allowed). */
function chatStoreReport(messageId, reason) {
  if (!refreshFromStorage()) return null;
  const message = chatFindMessage(messageId);
  if (!message || message.deleted || message.to !== currentUser.username) return null;
  if (!Array.isArray(database.reports)) database.reports = [];
  if (database.reports.some(report => report.messageId === messageId && report.reporter === currentUser.username)) return "again";
  database.reports.push({
    id: makeId(),
    messageId,
    reporter: currentUser.username,
    reported: message.from,
    text: message.text,            // a copy, so the admin still sees it if the message is unsent later
    reason,
    time: Date.now(),
    status: "open"                 // "open", "dismissed" or "removed"
  });
  saveDatabase(database);
  return "ok";
}

/* The admin looked at a report. action = "dismiss" (nothing wrong) or "remove" (erase the message). */
function chatStoreReview(reportId, action) {
  if (!isAdmin || !refreshFromStorage()) return false;
  const report = (database.reports || []).find(item => item.id === reportId);
  if (!report || report.status !== "open") return false;
  if (action === "remove") {
    const message = chatFindMessage(report.messageId);
    if (message && !message.deleted) {
      chatEraseMessage(message);
      message.removed = true;      // the chat says "removed by admin" instead of "unsent"
    }
    /* every other open report about this same message is done too */
    database.reports.forEach(item => {
      if (item.messageId === report.messageId && item.status === "open") item.status = "removed";
    });
  } else {
    report.status = "dismissed";
  }
  saveDatabase(database);
  return true;
}

/* Erase the content of a message but keep the row (so the order and the replies still make sense) */
function chatEraseMessage(message) {
  message.deleted = true;
  message.text = "";
  delete message.reactions;
  delete message.replyTo;
  delete message.forwarded;
}


/* ---------- 2. Helpers to find things ---------- */

/* The classmates of the logged in student: other students who share at least one teacher */
function chatClassmates() {
  const mine = currentUser.teachers || [];
  return database.users.filter(user =>
    user.role === "student" && user.username !== currentUser.username &&
    (user.teachers || []).some(name => mine.includes(name)));
}

/* May the logged in person write to this username? (the rule at the top of this file) */
function chatCanTalkTo(username) {
  const other = database.users.find(user => user.username === username);
  if (!other || other.username === currentUser.username) return false;
  if (isTeacher) return other.role === "student" && (other.teachers || []).includes(currentUser.username);
  if (isStudent) {
    const mine = currentUser.teachers || [];
    if (other.role === "teacher") return mine.includes(other.username);
    if (other.role === "student") return (other.teachers || []).some(name => mine.includes(name));
  }
  return false;
}

/* The people this person can chat with */
function getChatPeers() {
  if (isTeacher) {
    return database.users.filter(user => user.role === "student" && (user.teachers || []).includes(currentUser.username));
  }
  if (isStudent) {
    const teachers = database.users.filter(user => user.role === "teacher" && (currentUser.teachers || []).includes(user.username));
    return teachers.concat(chatClassmates());
  }
  return [];
}

/* "Teacher", "Classmate" or "Student": what the other person is to ME */
function chatRoleLabel(user) {
  if (user.role === "teacher") return "Teacher";
  return isStudent ? "Classmate" : "Student";
}

/* A name for a username, even if that account is gone */
function chatNameOf(username) {
  const user = database.users.find(item => item.username === username);
  return user ? getDisplayName(user) : prettifyName(username);
}

function chatFindMessage(id) {
  return id ? database.messages.find(message => message.id === id) : undefined;
}

/* The other person of a message that I sent or received (null if the message is not mine) */
function chatOtherSide(message) {
  const me = currentUser.username;
  if (message.from === me) return message.to;
  if (message.to === me) return message.from;
  return null;
}

/* Is this message part of the conversation between me and this person? */
function chatMessageBelongsTo(message, peer) {
  return !!message && chatOtherSide(message) === peer;
}

/* All the messages between me and one person, oldest first */
function getChatThread(peer) {
  const me = currentUser.username;
  return database.messages
    .filter(message => (message.from === me && message.to === peer) || (message.from === peer && message.to === me))
    .sort((first, second) => first.time - second.time);
}

/* How many messages from this person I did not read yet */
function chatUnreadFrom(peer) {
  return database.messages.filter(message =>
    message.to === currentUser.username && message.from === peer && !message.read).length;
}

/* How many unread messages I have in total (only from people I can still chat with) */
function chatUnreadCount() {
  if (!isTeacher && !isStudent) return 0;
  return getChatPeers().reduce((total, peer) => total + chatUnreadFrom(peer.username), 0);
}

/* "10:42 AM" */
function chatFormatTime(milliseconds) {
  return new Date(milliseconds).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* "Today", "Yesterday" or "Nov 11" (with the year when it is not this year) */
function chatDayLabel(milliseconds) {
  const day = new Date(milliseconds);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Today";
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  const options = { month: "short", day: "numeric" };
  if (day.getFullYear() !== today.getFullYear()) options.year = "numeric";
  return day.toLocaleDateString([], options);
}

/* What a message says when it is shown small (the list of people, the reply quote, the Forward box) */
function chatSnippet(message) {
  if (!message) return "Message not available";
  if (message.deleted) return message.removed ? "Message removed" : "Message unsent";
  const flat = message.text.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 80)}\u2026` : flat;
}


/* ---------- 3. Drawing ---------- */

/* The "Messages" button of the menu (admin never gets it). count = unread messages. */
function chatTabButton() {
  const count = chatUnreadCount();
  const countTag = count ? ` <span class="tab-count">${count}</span>` : "";
  return `<button type="button" data-view="chat"${view === "chat" ? ' aria-current="page"' : ""}>Messages${countTag}</button>`;
}

/* The list of people on the left: the newest conversation first, people without messages A to Z */
function buildChatPeople(peers) {
  const me = currentUser.username;
  const rows = peers.map(peer => {
    const thread = getChatThread(peer.username);
    return { peer, last: thread[thread.length - 1], unread: chatUnreadFrom(peer.username) };
  }).sort((first, second) => {
    const firstTime = first.last ? first.last.time : 0;
    const secondTime = second.last ? second.last.time : 0;
    if (firstTime !== secondTime) return secondTime - firstTime;
    return getDisplayName(first.peer).localeCompare(getDisplayName(second.peer));
  });

  return rows.map(({ peer, last, unread }) => {
    const preview = last ? `${last.from === me ? "You: " : ""}${chatSnippet(last)}` : "No messages yet";
    const time = last ? chatFormatTime(last.time) : "";
    const countTag = unread ? `<span class="tab-count">${unread}</span>` : "";
    const current = peer.username === chatPeer ? ' aria-current="true"' : "";
    /* A student sees who is a teacher and who is a classmate */
    const roleTag = isStudent ? `<span class="chat-role">${escapeHtml(chatRoleLabel(peer))}</span>` : "";
    return `
      <li>
        <button type="button" class="chat-person" data-chat="open" data-value="${escapeHtml(peer.username)}"${current}>
          <span class="chat-person-top"><strong>${escapeHtml(getDisplayName(peer))}${roleTag}</strong><span class="chat-person-time">${escapeHtml(time)}</span></span>
          <span class="chat-person-bottom"><span class="chat-person-preview">${escapeHtml(preview)}</span>${countTag}</span>
        </button>
      </li>`;
  }).join("");
}

/* The three dots (a small picture, so it looks the same everywhere) */
const CHAT_DOTS_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>`;

/* The small quote of the message that was answered (tap it to jump to that message) */
function buildChatQuote(message) {
  if (!message.replyTo) return "";
  const original = chatFindMessage(message.replyTo);
  const who = original ? (original.from === currentUser.username ? "You" : chatNameOf(original.from)) : "Message";
  const gone = !original || original.deleted;
  return `
    <button type="button" class="chat-quote${gone ? " gone" : ""}" data-chat="jump" data-id="${escapeHtml(message.replyTo)}">
      <strong>${escapeHtml(who)}</strong>
      <span>${escapeHtml(chatSnippet(original))}</span>
    </button>`;
}

/* The emojis under a message, with a number when more than one person used the same one */
function buildChatReactions(message) {
  const reactions = message.reactions || {};
  const counts = {};
  Object.keys(reactions).forEach(username => {
    counts[reactions[username]] = (counts[reactions[username]] || 0) + 1;
  });
  const emojis = Object.keys(counts);
  if (!emojis.length) return "";
  const mine = reactions[currentUser.username];
  return `<div class="chat-reactions">${emojis.map(emoji => `
    <button type="button" class="chat-reaction${emoji === mine ? " mine" : ""}" data-chat="chip" data-id="${message.id}" data-value="${emoji}"
            aria-label="${emoji} ${counts[emoji]}">${emoji}${counts[emoji] > 1 ? `<span class="chat-reaction-count">${counts[emoji]}</span>` : ""}</button>`).join("")}</div>`;
}

/* The messages of one conversation, with a small heading when the day changes */
function buildChatMessages(peer) {
  const thread = getChatThread(peer);
  if (!thread.length) return `<p class="muted chat-empty">No messages yet. Say hello!</p>`;

  const me = currentUser.username;
  let lastDay = "";
  return thread.map(message => {
    const day = new Date(message.time).toDateString();
    const heading = day !== lastDay ? `<p class="chat-day">${escapeHtml(chatDayLabel(message.time))}</p>` : "";
    lastDay = day;
    const side = message.from === me ? "mine" : "theirs";
    const time = `<span class="chat-time">${escapeHtml(chatFormatTime(message.time))}</span>`;

    /* An unsent (or removed) message: just a gray note, no menu */
    if (message.deleted) {
      return `${heading}
      <div class="chat-row ${side}" data-id="${message.id}">
        <div class="chat-bubble unsent">${message.removed ? "Message removed by admin" : "Message unsent"}</div>
        ${time}
      </div>`;
    }

    const forwarded = message.forwarded ? `<span class="chat-forwarded">Forwarded</span>` : "";
    const dots = `<button type="button" class="chat-dots" data-chat="menu" data-id="${message.id}" aria-haspopup="menu" aria-label="Message options">${CHAT_DOTS_ICON}</button>`;
    return `${heading}
      <div class="chat-row ${side}" data-id="${message.id}">
        <div class="chat-line">
          ${dots}
          <div class="chat-bubble" data-id="${message.id}">${forwarded}${buildChatQuote(message)}${escapeHtml(message.text)}</div>
        </div>
        ${buildChatReactions(message)}
        ${time}
      </div>`;
  }).join("");
}

/* The bar above the typing box: "Replying to ..." with a cancel button. Empty when not replying. */
function buildChatReplyBar(peer) {
  const original = chatFindMessage(chatReplies[peer]);
  if (!chatMessageBelongsTo(original, peer) || original.deleted) {
    delete chatReplies[peer];
    return "";
  }
  const who = original.from === currentUser.username ? "yourself" : chatNameOf(original.from);
  return `
    <div class="chat-reply-text"><strong>Replying to ${escapeHtml(who)}</strong><span>${escapeHtml(chatSnippet(original))}</span></div>
    <button type="button" class="chat-icon-btn" data-chat="cancel-reply" aria-label="Cancel reply">\u2715</button>`;
}

/* Show or hide the reply bar of the open conversation */
function chatUpdateReplyBar() {
  const bar = document.getElementById("chat-reply-bar");
  if (!bar || !chatPeer) return;
  const html = buildChatReplyBar(chatPeer);
  bar.innerHTML = html;
  bar.hidden = !html;
}

/* The right side: the name of the person, the messages and the box to type in (or a hint if nobody is chosen) */
function buildChatThread(peerUser) {
  if (!peerUser) return `<p class="muted chat-placeholder">Choose someone to start chatting.</p>`;
  const replyHtml = buildChatReplyBar(peerUser.username);
  return `
    <div class="chat-thread-head">
      <button type="button" class="btn ghost chat-back" data-chat="back" aria-label="Back to the list of chats">\u2190</button>
      <strong class="chat-peer-name">${escapeHtml(getDisplayName(peerUser))}</strong>
      <span class="muted">${chatRoleLabel(peerUser)}</span>
    </div>
    <div class="chat-messages" id="chat-messages" role="log" aria-live="polite">${buildChatMessages(peerUser.username)}</div>
    <div class="chat-reply-bar" id="chat-reply-bar"${replyHtml ? "" : " hidden"}>${replyHtml}</div>
    <div class="chat-compose">
      <textarea id="chat-input" rows="1" maxlength="${CHAT_MAX_LENGTH}" placeholder="Type a message" aria-label="Message"></textarea>
      <button type="button" class="btn" data-chat="send">Send</button>
    </div>`;
}

/* Scroll the messages down to the newest one */
function chatScrollToBottom() {
  const box = document.getElementById("chat-messages");
  if (box) box.scrollTop = box.scrollHeight;
}

/* Make the typing box taller while the text grows (up to a limit) */
function chatAutosize(input) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

/* Draw the Messages tab. app.js calls this when view is "chat".
   keepAtBottom = true after sending, so the newest message is in sight. */
function renderChat(keepAtBottom = false) {
  const peers = getChatPeers();

  /* Nobody to chat with yet */
  if (!peers.length) {
    chatPeer = null;
    chatShownPeer = null;
    chatCloseLayer();
    const hint = isTeacher
      ? "No students are in your class yet. Approve a student under Requests and you can write to them here."
      : "You can chat with your teacher and your classmates here once you joined a class.";
    mainContent.innerHTML = `<section class="card"><h2>Messages</h2><p class="muted">${hint}</p></section>`;
    return;
  }

  /* The open person must still be somebody we can chat with. With only one person, open that chat right away. */
  if (chatPeer && !peers.some(peer => peer.username === chatPeer)) chatPeer = null;
  if (!chatPeer && peers.length === 1) chatPeer = peers[0].username;

  /* Looking at a conversation = reading it (not while the tab is hidden) */
  if (chatPeer && !document.hidden && chatUnreadFrom(chatPeer)) {
    if (chatStoreMarkRead(chatPeer)) updateMenuBadge();
  }

  const peerUser = chatPeer ? database.users.find(user => user.username === chatPeer) : null;
  const shell = mainContent.querySelector(".chat-shell");

  /* The same conversation is already on the screen: only update the people and the messages.
     The typing box, its text and the cursor are not touched. */
  if (shell && chatShownPeer === chatPeer) {
    shell.querySelector(".chat-people").innerHTML = buildChatPeople(getChatPeers());
    const box = document.getElementById("chat-messages");
    if (box && peerUser) {
      const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      const oldScroll = box.scrollTop;
      box.innerHTML = buildChatMessages(chatPeer);
      if (keepAtBottom || wasAtBottom) chatScrollToBottom();
      else box.scrollTop = oldScroll;
      chatUpdateReplyBar();
    }
    return;
  }

  /* A different conversation (or the first time): draw everything */
  chatShownPeer = chatPeer;
  chatCloseLayer();
  mainContent.innerHTML = `
    <section class="card chat-card">
      <h2>Messages</h2>
      <div class="chat-shell${peers.length === 1 ? " chat-single" : ""}" data-open="${chatPeer ? "true" : "false"}">
        <ul class="chat-people">${buildChatPeople(peers)}</ul>
        <div class="chat-thread">${buildChatThread(peerUser)}</div>
      </div>
    </section>`;

  const input = document.getElementById("chat-input");
  if (input) {
    input.value = chatDrafts[chatPeer] || "";
    chatAutosize(input);
    if (window.matchMedia(CHAT_WIDE_SCREEN).matches) input.focus();   // on a phone the keyboard would hide the messages
  }
  chatScrollToBottom();
}

/* A small pop-up when a NEW message arrives while you are not reading that conversation.
   app.js calls this at the start of every redraw. The first call only learns what is unread already. */
function chatNotifyNew() {
  if (!isTeacher && !isStudent) return;
  const me = currentUser.username;
  const unread = database.messages.filter(message =>
    message.to === me && !message.read && chatCanTalkTo(message.from));

  if (chatKnownUnread) {
    const reading = view === "chat" && !document.hidden;
    const fresh = unread.filter(message =>
      !chatKnownUnread.has(message.id) && !(reading && message.from === chatPeer));
    if (fresh.length) {
      const sender = database.users.find(user => user.username === fresh[fresh.length - 1].from);
      showToast(`New message from ${sender ? getDisplayName(sender) : "your class"}.`, "success");
    }
  }
  chatKnownUnread = new Set(unread.map(message => message.id));
}


/* ---------- 4. The floating layer: options menu, reactions bar, Forward box, Report box ---------- */

/* The one place where all the little menus and boxes are drawn (outside the page, on top of everything) */
function chatLayer() {
  let layer = document.getElementById("chat-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "chat-layer";
    document.body.append(layer);
  }
  return layer;
}

function chatCloseLayer() {
  const layer = document.getElementById("chat-layer");
  if (layer) layer.innerHTML = "";
}

/* Put a small menu next to an element (below it, or above it when there is no room, and never outside the screen) */
function chatShowPopup(html, className, anchor) {
  const layer = chatLayer();
  layer.innerHTML = `
    <div class="chat-backdrop" data-chat="close"></div>
    <div class="chat-pop ${className}" role="menu" style="visibility:hidden">${html}</div>`;
  const popup = layer.querySelector(".chat-pop");
  const box = anchor.getBoundingClientRect();
  const width = popup.offsetWidth;
  const height = popup.offsetHeight;
  const margin = 8;

  const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, margin), window.innerWidth - width - margin);
  const roomBelow = window.innerHeight - box.bottom;
  const top = className === "chat-reactbar"
    ? (box.top - height - 6 >= margin ? box.top - height - 6 : box.bottom + 6)     // reactions: above the message
    : (roomBelow >= height + margin ? box.bottom + 4 : Math.max(box.top - height - 4, margin));  // menu: below the dots
  popup.style.left = `${left}px`;
  popup.style.top = `${Math.max(top, margin)}px`;
  popup.style.visibility = "";

  const first = popup.querySelector("button");
  if (first) first.focus({ preventScroll: true });
}

/* A box in the middle (a bottom sheet on a phone) */
function chatShowSheet(title, bodyHtml) {
  chatLayer().innerHTML = `
    <div class="chat-backdrop dim" data-chat="close"></div>
    <div class="chat-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="chat-sheet-head">
        <strong>${escapeHtml(title)}</strong>
        <button type="button" class="chat-icon-btn" data-chat="close" aria-label="Close">\u2715</button>
      </div>
      <div class="chat-sheet-body">${bodyHtml}</div>
    </div>`;
  const first = chatLayer().querySelector(".chat-sheet-body button");
  if (first) first.focus({ preventScroll: true });
}

/* The three dots menu */
function chatOpenMenu(messageId, anchor) {
  const message = chatFindMessage(messageId);
  if (!message || message.deleted) return;
  const mine = message.from === currentUser.username;
  const items = [
    ["react", "React"],
    ["reply", "Reply"],
    ["forward", "Forward"],
    ["copy", "Copy"],
    mine ? ["unsend", "Unsend", true] : ["report", "Report", true]
  ];
  const html = items.map(([action, label, danger]) => `
    <button type="button" role="menuitem" class="chat-pop-item${danger ? " danger" : ""}" data-chat="${action}" data-id="${message.id}">${label}</button>`).join("");
  chatShowPopup(html, "chat-menu-pop", anchor);
}

/* The quick reactions bar (a hold on a message, or "React" in the menu) */
function chatOpenReactBar(messageId, anchor) {
  const message = chatFindMessage(messageId);
  if (!message || message.deleted) return;
  const mine = (message.reactions || {})[currentUser.username];
  const html = CHAT_REACTIONS.map(emoji => `
    <button type="button" role="menuitem" class="chat-emoji${emoji === mine ? " mine" : ""}" data-chat="emoji" data-id="${message.id}" data-value="${emoji}" aria-label="React ${emoji}">${emoji}</button>`).join("");
  chatShowPopup(html, "chat-reactbar", anchor);
}

/* Forward: choose the person who gets a copy */
function chatOpenForward(messageId) {
  const message = chatFindMessage(messageId);
  if (!message || message.deleted) return;
  const people = getChatPeers().sort((first, second) => getDisplayName(first).localeCompare(getDisplayName(second)));
  const list = people.map(peer => `
    <li><button type="button" class="chat-pick" data-chat="forward-to" data-id="${message.id}" data-value="${escapeHtml(peer.username)}">
      <strong>${escapeHtml(getDisplayName(peer))}</strong><span class="muted">${escapeHtml(chatRoleLabel(peer))}</span>
    </button></li>`).join("");
  chatShowSheet("Forward to", `
    <p class="chat-sheet-preview">${escapeHtml(chatSnippet(message))}</p>
    <ul class="chat-pick-list">${list}</ul>`);
}

/* Report: choose a reason */
function chatOpenReport(messageId) {
  const message = chatFindMessage(messageId);
  if (!message || message.deleted) return;
  const list = CHAT_REPORT_REASONS.map((reason, index) => `
    <li><button type="button" class="chat-pick" data-chat="report-send" data-id="${message.id}" data-value="${index}">${escapeHtml(reason)}</button></li>`).join("");
  chatShowSheet("Report this message", `
    <p class="chat-sheet-preview">${escapeHtml(chatSnippet(message))}</p>
    <p class="muted">Why are you reporting it? The admin will look at it. The other person is not told.</p>
    <ul class="chat-pick-list">${list}</ul>`);
}

/* Copy text to the clipboard (with a fallback for browsers that block the new way) */
function chatCopy(text) {
  const done = () => showToast("Copied.", "success");
  const fallback = () => {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try { document.execCommand("copy"); done(); } catch (error) { showToast("Could not copy."); }
    area.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

/* Scroll to a message (the one a reply quotes) and flash it */
function chatJumpTo(messageId) {
  const row = document.querySelector(`#chat-messages .chat-row[data-id="${messageId}"]`);
  if (!row) {
    showToast("That message is not here anymore.");
    return;
  }
  row.scrollIntoView({ block: "center", behavior: "smooth" });
  row.classList.remove("flash");
  void row.offsetWidth;            // lets the flash start again if it was already running
  row.classList.add("flash");
  setTimeout(() => row.classList.remove("flash"), 1500);
}


/* ---------- 5. Buttons and typing ---------- */

/* The place where app.js draws the page. (Found by its id, so this file can load before app.js.) */
const chatMain = document.getElementById("main-content");

/* Open the conversation with one person */
function chatOpen(username) {
  chatCloseLayer();
  if (chatPeer === username) {            // already open: on a phone just show it again
    renderChat();
    return;
  }
  chatPeer = username;
  renderChat();
}

/* Send what is typed in the box (and the reply, if there is one) */
function chatSend() {
  const input = document.getElementById("chat-input");
  if (!input || !chatPeer) return;

  const text = input.value.trim();
  if (!text) return;
  if (text.length > CHAT_MAX_LENGTH) {
    showToast(`A message can have up to ${CHAT_MAX_LENGTH} characters.`);
    return;
  }

  const message = chatStoreSend(chatPeer, text, { replyTo: chatReplies[chatPeer] });
  if (!message) {
    showToast("You can\u2019t write to this person anymore.");
    renderChat();
    return;
  }

  chatDrafts[chatPeer] = "";
  delete chatReplies[chatPeer];
  input.value = "";
  chatAutosize(input);
  renderChat(true);
  chatUpdateReplyBar();
  input.focus();
}

/* React (from the bar, or by tapping an emoji under a message) */
function chatReact(messageId, emoji) {
  chatCloseLayer();
  if (!chatStoreReact(messageId, emoji)) {
    showToast("You can\u2019t react to this message.");
  }
  renderChat();
}

/* Every button of the chat. The attribute data-chat says what to do, data-id is a message, data-value is a person / emoji / reason. */
function chatHandle(button) {
  const action = button.dataset.chat;
  const id = button.dataset.id;
  const value = button.dataset.value;
  const bubble = id ? document.querySelector(`#chat-messages .chat-bubble[data-id="${id}"]`) : null;

  switch (action) {
    case "open":    chatOpen(value); break;
    case "back":    chatCloseLayer(); chatPeer = null; renderChat(); break;   // a phone: back to the list of people
    case "send":    chatSend(); break;
    case "close":   chatCloseLayer(); break;

    case "menu":    chatOpenMenu(id, button); break;
    case "react":   chatOpenReactBar(id, bubble || button); break;
    case "emoji":   chatReact(id, value); break;
    case "chip":    chatReact(id, value); break;

    case "reply": {
      chatCloseLayer();
      if (!chatPeer) break;
      chatReplies[chatPeer] = id;
      chatUpdateReplyBar();
      const input = document.getElementById("chat-input");
      if (input) input.focus();
      break;
    }
    case "cancel-reply":
      if (chatPeer) delete chatReplies[chatPeer];
      chatUpdateReplyBar();
      break;

    case "forward":    chatOpenForward(id); break;
    case "forward-to": {
      const original = chatFindMessage(id);
      const sent = original && !original.deleted && chatStoreSend(value, original.text, { forwarded: true });
      chatCloseLayer();
      showToast(sent ? `Forwarded to ${chatNameOf(value)}.` : "You can\u2019t forward this message.", sent ? "success" : "error");
      renderChat();
      updateMenuBadge();
      break;
    }

    case "copy": {
      const original = chatFindMessage(id);
      chatCloseLayer();
      if (original && !original.deleted) chatCopy(original.text);
      break;
    }

    case "unsend":
      chatCloseLayer();
      askConfirm({
        title: "Unsend this message?",
        message: "The text is erased for both of you.",
        confirmText: "Unsend",
        danger: true,
        onConfirm: () => {
          if (!chatStoreUnsend(id)) showToast("You can\u2019t unsend this message.");
          renderChat();
        }
      });
      break;

    case "report":      chatOpenReport(id); break;
    case "report-send": {
      const result = chatStoreReport(id, CHAT_REPORT_REASONS[Number(value)] || "Something else");
      chatCloseLayer();
      if (result === "ok") showToast("Thanks. The admin will look at this report.", "success");
      else if (result === "again") showToast("You already reported this message.");
      else showToast("You can\u2019t report this message.");
      break;
    }

    case "jump": chatJumpTo(id); break;

    /* the admin's Reports tab (section 6) */
    case "review": {
      if (chatStoreReview(id, value)) {
        showToast(value === "remove" ? "Message removed." : "Report dismissed.", "success");
      }
      renderPage();
      break;
    }
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-chat]");
  if (!button) return;
  /* A hold just opened the reactions: the finger lifting is not a real click on what is under it */
  if (Date.now() - chatHoldAt < 600 && !button.closest("#chat-layer")) return;
  chatHandle(button);
});

/* Enter sends. Shift + Enter makes a new line. (Not while an IME is still composing a word.)
   Escape closes the little menus and boxes. */
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.querySelector("#chat-layer > *")) {
    chatCloseLayer();
    return;
  }
  if (event.target.id !== "chat-input" || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  chatSend();
});

/* Remember the text of each conversation while typing, and grow the box */
chatMain.addEventListener("input", event => {
  if (event.target.id !== "chat-input" || !chatPeer) return;
  chatDrafts[chatPeer] = event.target.value;
  chatAutosize(event.target);
});

/* HOLD a message (finger or mouse) = the reactions bar.
   A finger that moves is a scroll, so it cancels the hold. */
(function setupChatHold() {
  let timer = null;
  let startX = 0;
  let startY = 0;

  function cancel() {
    clearTimeout(timer);
    timer = null;
  }

  document.addEventListener("pointerdown", event => {
    const bubble = event.target.closest("#chat-messages .chat-bubble[data-id]");
    if (!bubble || (event.pointerType === "mouse" && event.button !== 0)) return;
    startX = event.clientX;
    startY = event.clientY;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      chatHoldAt = Date.now();
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (error) { /* not supported */ } }
      chatOpenReactBar(bubble.dataset.id, bubble);
    }, CHAT_HOLD_TIME);
  });

  document.addEventListener("pointermove", event => {
    if (timer && Math.hypot(event.clientX - startX, event.clientY - startY) > CHAT_HOLD_MOVE) cancel();
  });
  document.addEventListener("pointerup", cancel);
  document.addEventListener("pointercancel", cancel);
  document.addEventListener("scroll", () => {
    cancel();
    /* scrolling the messages closes a small menu that is floating next to them */
    if (document.querySelector("#chat-layer .chat-pop")) chatCloseLayer();
  }, true);

  /* The long press of a phone would open the browser's own menu on top of ours */
  document.addEventListener("contextmenu", event => {
    if (event.target.closest("#chat-messages .chat-bubble[data-id]")) event.preventDefault();
  });
})();

/* Coming back to this tab: the messages that arrived meanwhile are read now */
document.addEventListener("visibilitychange", () => {
  if (document.hidden || view !== "chat" || quizInProgress) return;
  renderChat();
  updateMenuBadge();
});


/* ---------- 6. Reports (admin) ---------- */

/* How many reports wait for the admin (the number on the menu button and the burger button) */
function chatOpenReportCount() {
  if (!isAdmin) return 0;
  return (database.reports || []).filter(report => report.status === "open").length;
}

/* "Nov 11, 10:42 AM" */
function chatFormatDateTime(milliseconds) {
  return new Date(milliseconds).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* The Reports tab of the admin: the open reports first, then the ones already reviewed */
function buildReportsPage() {
  const reports = (database.reports || []).slice().sort((first, second) => second.time - first.time);
  const open = reports.filter(report => report.status === "open");
  const reviewed = reports.filter(report => report.status !== "open").slice(0, 20);

  const openRows = open.map(report => `
    <li class="list-item">
      <div class="card-static report-card">
        <div class="report-head"><strong>${escapeHtml(report.reason)}</strong><span class="muted">${escapeHtml(chatFormatDateTime(report.time))}</span></div>
        <p class="muted">Reported by ${escapeHtml(chatNameOf(report.reporter))} &middot; Sent by ${escapeHtml(chatNameOf(report.reported))}</p>
        <blockquote class="report-text">${escapeHtml(report.text)}</blockquote>
        <div class="action-row">
          <button type="button" class="btn ghost" data-chat="review" data-id="${report.id}" data-value="dismiss">Dismiss</button>
          <button type="button" class="btn deny" data-chat="review" data-id="${report.id}" data-value="remove">Remove message</button>
        </div>
      </div>
    </li>`).join("");

  const reviewedRows = reviewed.map(report => `
    <li class="list-item">
      <div class="card-static report-card">
        <div class="report-head"><strong>${escapeHtml(report.reason)}</strong><span class="muted">${report.status === "removed" ? "Message removed" : "Dismissed"}</span></div>
        <p class="muted">${escapeHtml(chatNameOf(report.reporter))} reported ${escapeHtml(chatNameOf(report.reported))} &middot; ${escapeHtml(chatFormatDateTime(report.time))}</p>
      </div>
    </li>`).join("");

  return `
    <section class="card">
      <h2>Reports (${open.length})</h2>
      ${open.length
        ? `<p class="muted">Messages that students or teachers reported. Dismiss a report if nothing is wrong, or remove the message from the chat.</p><ul class="item-list student-list">${openRows}</ul>`
        : `<p class="muted">No reports waiting.</p>`}
    </section>
    ${reviewed.length ? `<section class="card"><h2>Reviewed</h2><ul class="item-list student-list">${reviewedRows}</ul></section>` : ""}`;
}
