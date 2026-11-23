
import { auth, db } from "./configure.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let habits = [];
let authMode = "login";
let selectedEmoji = "📚";
let calendarDate = new Date();
let weeklyChart = null;
let monthlyChart = null;
let loading = false;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const dateOffset = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

function userHabitsRef() {
  if (!currentUser) throw new Error("Please login first.");
  return collection(db, "users", currentUser.uid, "habits");
}

function showAuthMessage(message, success = false) {
  $("authError").textContent = message;
  $("authError").classList.toggle("success", success);
}

function showHabitMessage(message) {
  $("habitError").textContent = message;
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2500);
}

function setLoading(value) {
  loading = value;
  $("authSubmit").disabled = value;
  $("authSubmit").textContent = value
    ? "Please wait..."
    : authMode === "login"
      ? "Login to Account →"
      : "Create My Account →";
}

// AUTH MODE

function setAuthMode(mode) {
  authMode = mode;

  const signup = mode === "signup";

  $("nameGroup").classList.toggle("hidden", !signup);
  $("forgotPassword").style.display = signup ? "none" : "block";

  $("authTitle").textContent = signup ? "Create your account" : "Welcome back!";
  $("authSubtitle").textContent = signup
    ? "Start building better habits today."
    : "Sign in to continue your journey.";

  $("loginTab").classList.toggle("active", !signup);
  $("signupTab").classList.toggle("active", signup);

  $("authSwitch").innerHTML = signup
    ? 'Already have an account? <button type="button" id="switchLogin">Login</button>'
    : 'Don\'t have an account? <button type="button" id="switchSignup">Sign up</button>';

  $("authSubmit").textContent = signup
    ? "Create My Account →"
    : "Login to Account →";

  $("authPassword").value = "";
  $("authName").value = "";
  $("authPassword").type = "password";
  $("togglePassword").textContent = "Show";

  showAuthMessage("");
  bindSwitchButton();
}

function bindSwitchButton() {
  const button = $(authMode === "signup" ? "switchLogin" : "switchSignup");

  if (button) {
    button.addEventListener("click", () => {
      setAuthMode(authMode === "signup" ? "login" : "signup");
    });
  }
}

$("loginTab").addEventListener("click", () => setAuthMode("login"));
$("signupTab").addEventListener("click", () => setAuthMode("signup"));

$("togglePassword").addEventListener("click", () => {
  const input = $("authPassword");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("togglePassword").textContent = show ? "Hide" : "Show";
});

// SIGNUP AND LOGIN

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (loading) return;

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  const name = $("authName").value.trim();

  showAuthMessage("");

  if (authMode === "signup" && !name) {
    showAuthMessage("Please enter your full name.");
    return;
  }

  if (password.length < 6) {
    showAuthMessage("Password must contain at least 6 characters.");
    return;
  }

  setLoading(true);

  try {
    if (authMode === "signup") {
      const result = await createUserWithEmailAndPassword(
        auth, email, password
      );

      await updateProfile(result.user, {
        displayName: name
      });

      currentUser = result.user;

      showToast("Account created successfully!");

    } else {
      const result = await signInWithEmailAndPassword(
        auth, email, password
      );

      currentUser = result.user;
      showToast("Welcome back!");
    }

  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "This email is already registered.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Please choose a stronger password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/network-request-failed": "Check your internet connection."
    };

    showAuthMessage(messages[error.code] || error.message);

  } finally {
    setLoading(false);
  }
});

// FORGOT PASSWORD

$("forgotPassword").addEventListener("click", async () => {
  const email = $("authEmail").value.trim();

  if (!email) {
    showAuthMessage("Enter your email address first.");
    $("authEmail").focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMessage("Password reset email sent. Check your inbox.", true);
  } catch (error) {
    showAuthMessage(error.code === "auth/user-not-found"
      ? "No account found with this email."
      : error.message);
  }
});

// AUTH STATE

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    $("authScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    const displayName = user.displayName || user.email.split("@")[0];

    $("profileName").textContent = displayName;
    $("profileEmail").textContent = user.email;
    $("profileAvatar").textContent = displayName.charAt(0).toUpperCase();

    try {
      await loadHabits();
      renderAll();
    } catch (error) {
      showToast("Unable to load habits: " + error.message);
    }

  } else {
    habits = [];

    if (weeklyChart) weeklyChart.destroy();
    if (monthlyChart) monthlyChart.destroy();

    $("appScreen").classList.add("hidden");
    $("authScreen").classList.remove("hidden");

    $("authForm").reset();
    setAuthMode("login");
  }
});

// LOGOUT

$("logoutBtn").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to logout?")) return;

  try {
    await signOut(auth);
    showToast("Logged out successfully.");
  } catch (error) {
    showToast(error.message);
  }
});

// FIRESTORE LOAD

async function loadHabits() {
  const snapshot = await getDocs(userHabitsRef());

  habits = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

// CREATE HABIT

async function addHabit(name, emoji, category) {
  if (!currentUser) return;

  try {
    const habitData = {
      name,
      emoji,
      category,
      completed: [],
      created: today(),
      createdAt: serverTimestamp()
    };

    const result = await addDoc(userHabitsRef(), habitData);

    habits.push({
      id: result.id,
      name,
      emoji,
      category,
      completed: [],
      created: today()
    });

    renderAll();
    showToast("Habit saved to your account!");
  } catch (error) {
    showToast("Unable to save: " + error.message);
  }
}

// COMPLETE / UNCOMPLETE HABIT

async function toggleHabit(id) {
  const habit = habits.find(h => h.id === id);
  if (!habit) return;

  const completed = [...(habit.completed || [])];
  const date = today();

  const index = completed.indexOf(date);

  if (index >= 0) completed.splice(index, 1);
  else completed.push(date);

  try {
    await updateDoc(
      doc(db, "users", currentUser.uid, "habits", id),
      { completed }
    );

    habit.completed = completed;
    renderAll();

  } catch (error) {
    showToast("Unable to update habit: " + error.message);
  }
}

// DELETE HABIT

async function deleteHabit(id) {
  if (!confirm("Delete this habit permanently?")) return;

  try {
    await deleteDoc(
      doc(db, "users", currentUser.uid, "habits", id)
    );

    habits = habits.filter(h => h.id !== id);
    renderAll();
    showToast("Habit deleted successfully.");

  } catch (error) {
    showToast("Unable to delete: " + error.message);
  }
}

// STREAK

function isDone(habit, date) {
  return (habit.completed || []).includes(date);
}

function getStreak(habit) {
  let d = new Date();
  let streak = 0;

  if (!isDone(habit, today())) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    if (!isDone(habit, key)) break;

    streak++;
    d.setDate(d.getDate() - 1);

    if (streak > 3650) break;
  }

  return streak;
}

function getBestStreak() {
  return Math.max(0, ...habits.map(getStreak));
}

// DASHBOARD

function renderDashboard() {
  const date = today();
  const total = habits.length;
  const completed = habits.filter(h => isDone(h, date)).length;
  const percent = total ? Math.round(completed / total * 100) : 0;

  $("totalHabits").textContent = total;
  $("completedToday").textContent = completed;
  $("todayProgress").textContent = percent + "%";
  $("bestStreak").textContent = getBestStreak();

  $("circlePercent").textContent = percent + "%";
  $("circleCount").textContent = `${completed} / ${total}`;
  $("progressBar").style.width = percent + "%";

  $("progressCircle").style.background =
    `conic-gradient(var(--green) ${percent}%, var(--soft) ${percent}%)`;

  $("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  $("todayBadge").textContent = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });

  const container = $("todayHabits");
  container.innerHTML = "";

  $("emptyToday").style.display = total ? "none" : "block";

  habits.forEach(habit => {
    const done = isDone(habit, date);

    const row = document.createElement("div");
    row.className = "habit-row";

    const icon = document.createElement("div");
    icon.className = "habit-icon";
    icon.textContent = habit.emoji;

    const details = document.createElement("div");
    details.className = "habit-details";

    const name = document.createElement("strong");
    name.textContent = habit.name;

    const category = document.createElement("small");
    category.textContent = habit.category;

    details.append(name, category);

    const check = document.createElement("button");
    check.className = "check-btn" + (done ? " checked" : "");
    check.textContent = "✓";
    check.addEventListener("click", () => toggleHabit(habit.id));

    row.append(icon, details, check);
    container.appendChild(row);
  });
}

// ALL HABITS

function renderHabits() {
  const container = $("allHabits");
  container.innerHTML = "";

  if (!habits.length) {
    container.innerHTML = `
      <div class="panel" style="grid-column:1/-1;text-align:center;padding:40px">
        <h3>No habits created yet</h3>
        <p style="color:var(--muted);margin-top:10px;font-size:12px">
          Click Add Habit to begin your journey.
        </p>
      </div>`;
    return;
  }

  habits.forEach(habit => {
    const card = document.createElement("div");
    card.className = "all-habit-card";

    const top = document.createElement("div");
    top.className = "card-top";

    const icon = document.createElement("div");
    icon.className = "habit-icon";
    icon.textContent = habit.emoji;

    const info = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = habit.name;

    const category = document.createElement("small");
    category.textContent = habit.category;

    info.append(heading, category);
    top.append(icon, info);

    const check = document.createElement("button");
    check.className = "check-btn" + (isDone(habit, today()) ? " checked" : "");
    check.textContent = "✓";
    check.addEventListener("click", () => toggleHabit(habit.id));

    top.append(check);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const streak = document.createElement("span");
    streak.style.fontSize = "11px";
    streak.style.color = "var(--muted)";
    streak.textContent = `🔥 ${getStreak(habit)} day streak`;

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteHabit(habit.id));

    actions.append(streak, del);
    card.append(top, actions);
    container.appendChild(card);
  });
}

// CALENDAR

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  $("monthLabel").textContent = calendarDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });

  const grid = $("calendarGrid");
  grid.innerHTML = "";

  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(day => {
    const cell = document.createElement("div");
    cell.className = "calendar-day weekday";
    cell.textContent = day;
    grid.appendChild(cell);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= days; day++) {
    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const completed = habits.filter(h => isDone(h, key)).length;

    const cell = document.createElement("div");
    cell.className = "calendar-day";

    if (habits.length && completed === habits.length) cell.classList.add("completed");
    else if (completed > 0) cell.classList.add("partial");

    if (key === today()) cell.classList.add("today");

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    if (completed > 0) {
      const small = document.createElement("small");
      small.textContent = `${completed}/${habits.length} done`;
      cell.appendChild(small);
    }

    grid.appendChild(cell);
  }
}

// ANALYTICS

function renderAnalytics() {
  const totalCompletions = habits.reduce(
    (sum, h) => sum + (h.completed || []).length, 0
  );

  let possible = 0;
  let done = 0;

  for (let i = 0; i < 30; i++) {
    const date = dateOffset(-i);
    const active = habits.filter(h => h.created <= date);

    possible += active.length;
    done += active.filter(h => isDone(h, date)).length;
  }

  $("totalCompletions").textContent = totalCompletions;
  $("averageProgress").textContent =
    (possible ? Math.round(done / possible * 100) : 0) + "%";
}

// CHARTS

function createCharts() {
  if (typeof Chart === "undefined") return;

  const labels = [];
  const weeklyData = [];

  for (let i = 6; i >= 0; i--) {
    const date = dateOffset(-i);
    labels.push(new Date(date + "T12:00:00").toLocaleDateString("en-IN", {
      weekday: "short"
    }));

    weeklyData.push(habits.filter(h => isDone(h, date)).length);
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#9298a3" } },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: "#9298a3" },
        grid: { color: "rgba(130,140,150,.12)" }
      }
    }
  };

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart($("weeklyChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: weeklyData,
        backgroundColor: "#43a77b",
        borderRadius: 6,
        maxBarThickness: 35
      }]
    },
    options
  });

  const monthLabels = [];
  const monthlyData = [];

  for (let i = 29; i >= 0; i--) {
    const date = dateOffset(-i);
    monthLabels.push(date.slice(8,10));
    monthlyData.push(habits.filter(h => isDone(h, date)).length);
  }

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart($("monthlyChart"), {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [{
        data: monthlyData,
        borderColor: "#43a77b",
        backgroundColor: "rgba(67,167,123,.12)",
        fill: true,
        tension: .35,
        pointRadius: 3
      }]
    },
    options
  });
}

// HABIT MODAL

function openHabitModal() {
  $("habitModal").classList.add("show");
  $("habitName").focus();
}

function closeHabitModal() {
  $("habitModal").classList.remove("show");
  $("habitForm").reset();
  showHabitMessage("");

  selectedEmoji = "📚";

  document.querySelectorAll(".emoji").forEach((b, i) => {
    b.classList.toggle("selected", i === 0);
  });
}

$("openModal").addEventListener("click", openHabitModal);
$("closeModal").addEventListener("click", closeHabitModal);

$("habitModal").addEventListener("click", e => {
  if (e.target === $("habitModal")) closeHabitModal();
});

document.querySelectorAll(".emoji").forEach(button => {
  button.addEventListener("click", () => {
    selectedEmoji = button.textContent;

    document.querySelectorAll(".emoji").forEach(b =>
      b.classList.remove("selected")
    );

    button.classList.add("selected");
  });
});

$("habitForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("habitName").value.trim();
  if (!name) return;

  $("habitForm").querySelector(".submit-btn").disabled = true;
  showHabitMessage("");

  try {
    await addHabit(name, selectedEmoji, $("habitCategory").value);
    closeHabitModal();
  } catch (error) {
    showHabitMessage(error.message);
  } finally {
    $("habitForm").querySelector(".submit-btn").disabled = false;
  }
});

// NAVIGATION

function navigate(page) {
  document.querySelectorAll(".page").forEach(p =>
    p.classList.add("hidden")
  );

  $(page + "Page").classList.remove("hidden");

  document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const titles = {
    dashboard: "Dashboard",
    habits: "My Habits",
    calendar: "Calendar",
    analytics: "Analytics"
  };

  $("pageTitle").textContent = titles[page];

  if (page === "calendar") renderCalendar();
  if (page === "analytics") renderAnalytics();

  if (page === "dashboard" || page === "analytics") {
    setTimeout(createCharts, 50);
  }
}

document.querySelectorAll(".nav-item[data-page]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.page));
});

// CALENDAR NAVIGATION

$("prevMonth").addEventListener("click", () => {
  calendarDate.setDate(1);
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});

$("nextMonth").addEventListener("click", () => {
  calendarDate.setDate(1);
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

// THEME

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("themeIcon").textContent = dark ? "☀" : "☾";
  $("themeToggle").lastChild.textContent = dark ? " Light Mode" : " Dark Mode";

  localStorage.setItem("habitflow_theme", dark ? "dark" : "light");
}

applyTheme(localStorage.getItem("habitflow_theme") === "dark");

$("themeToggle").addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark"));
});

// RENDER

function renderAll() {
  renderDashboard();
  renderHabits();
  renderCalendar();
  renderAnalytics();
  createCharts();
}

window.openHabitModal = openHabitModal;
