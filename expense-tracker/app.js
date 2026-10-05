const STORAGE_KEY = "spendwise-personal-v1";
const COLORS = ["#688b65", "#e7ae77", "#c2b9dd", "#8fb5aa", "#d98a78", "#8b9bb8", "#d4c36d"];
const CATEGORIES = {
  "Food & Drink": { icon: "☕", bg: "#f7eee3", fg: "#b6854e" },
  Home: { icon: "⌂", bg: "#edf0e4", fg: "#67805a" },
  Transport: { icon: "↗", bg: "#e8eff1", fg: "#628893" },
  Shopping: { icon: "◇", bg: "#f1eaf5", fg: "#9276a2" },
  Health: { icon: "✚", bg: "#f8ece8", fg: "#bc796b" },
  Fun: { icon: "✳", bg: "#f8f2df", fg: "#aa9252" },
  Other: { icon: "·", bg: "#edf0eb", fg: "#788476" },
  Income: { icon: "↙", bg: "#eaf2e9", fg: "#648567" }
};

let data = loadData();
let showAllTransactions = false;
let editingId = null;
const $ = (selector) => document.querySelector(selector);
const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const monthSelect = $("#monthSelect");
const transactionDialog = $("#transactionDialog");
const settingsDialog = $("#settingsDialog");
const transactionForm = $("#transactionForm");
const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const monthKey = (date) => date.slice(0, 7);
const selectedMonth = () => monthSelect.value;
const money = (value) => currency.format(Number(value) || 0);
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function blankData() {
  return { transactions: [], salary: {}, budgets: {} };
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.transactions)) return blankData();
    return {
      transactions: saved.transactions,
      salary: saved.salary && typeof saved.salary === "object" ? saved.salary : {},
      budgets: saved.budgets && typeof saved.budgets === "object" ? saved.budgets : {}
    };
  } catch {
    return blankData();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function buildMonthOptions() {
  const now = new Date();
  monthSelect.innerHTML = Array.from({ length: 18 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return `<option value="${key}">${date.toLocaleDateString("en-CA", { month: "long", year: "numeric" })}</option>`;
  }).join("");
}

function ensureMonthOption(key) {
  if ([...monthSelect.options].some((option) => option.value === key)) return;
  const label = new Date(`${key}-02`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  monthSelect.add(new Option(label, key));
}

function monthTransactions() {
  return data.transactions.filter((item) => monthKey(item.date) === selectedMonth());
}

function monthlySalary() {
  return Number(data.salary[selectedMonth()] || 0);
}

function monthlyBudgets() {
  return data.budgets[selectedMonth()] || {};
}

function renderSummary(items) {
  const incomeItems = items.filter((item) => item.type === "income");
  const expenses = items.filter((item) => item.type === "expense");
  const otherIncome = incomeItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const income = monthlySalary() + otherIncome;
  const spent = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const remaining = income - spent;
  const percent = income ? Math.max(0, Math.round((remaining / income) * 100)) : 0;
  const [year, month] = selectedMonth().split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  const daysLeft = isCurrent ? Math.max(1, daysInMonth - now.getDate() + 1) : daysInMonth;
  const leftBar = income ? Math.min(100, Math.max(0, spent / income * 100)) : 0;
  $("#leftValue").textContent = money(remaining);
  $("#leftPercent").textContent = `${percent}%`;
  $("#leftBar").style.width = `${leftBar}%`;
  $("#spentLabel").textContent = money(spent);
  $("#incomeLabel").textContent = money(income);
  $("#incomeValue").textContent = money(income);
  $("#incomeCount").textContent = incomeItems.length;
  $("#spentValue").textContent = money(spent);
  $("#transactionCount").textContent = expenses.length;
  $("#weeklyValue").textContent = money(Math.max(0, remaining) / Math.max(1, daysLeft / 7));
  $("#weekDates").textContent = isCurrent ? `THROUGH ${new Date(year, month - 1, daysInMonth).toLocaleDateString("en-CA", { month: "short", day: "numeric" }).toUpperCase()}` : "FULL MONTH PLAN";
}

function renderSpending(items) {
  const totals = new Map();
  items.filter((item) => item.type === "expense").forEach((item) => totals.set(item.category, (totals.get(item.category) || 0) + Number(item.amount)));
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, amount]) => sum + amount, 0);
  let angle = 0;
  const stops = sorted.map(([, amount], index) => {
    const start = angle;
    angle += total ? amount / total * 360 : 0;
    return `${COLORS[index % COLORS.length]} ${start}deg ${angle}deg`;
  });
  $("#donut").style.background = total ? `conic-gradient(${stops.join(",")})` : "conic-gradient(#e7e9e3 0deg 360deg)";
  $("#donutTotal").textContent = money(total);
  $("#legend").innerHTML = sorted.slice(0, 5).map(([name, amount], index) => `<div class="legend-row"><i style="--c:${COLORS[index % COLORS.length]}"></i><span>${esc(name)}</span><b>${Math.round(amount / total * 100)}%</b></div>`).join("") || `<div class="empty-state">Add an expense to see your spending breakdown.</div>`;
  const [topName, topAmount] = sorted[0] || ["Nothing yet", 0];
  $("#insightTitle").textContent = sorted.length ? `${topName} is your biggest category` : "Your overview starts with you";
  $("#insightText").textContent = sorted.length ? `${money(topAmount)} recorded · ${Math.round(topAmount / total * 100)}% of your spending` : "Add expenses to see a useful monthly snapshot.";
}

function renderBudgets(items) {
  const spentByCategory = new Map();
  items.filter((item) => item.type === "expense").forEach((item) => spentByCategory.set(item.category, (spentByCategory.get(item.category) || 0) + Number(item.amount)));
  const budgets = monthlyBudgets();
  const planned = Object.keys(CATEGORIES).filter((name) => name !== "Income" && Number(budgets[name]) > 0);
  const visible = planned.length ? planned : [...spentByCategory.keys()];
  if (!visible.length) {
    $("#budgetList").innerHTML = `<div class="budget-empty"><b>No budgets set yet</b><span>Set category limits to compare your plan with what you spend.</span><button class="text-button" type="button" id="emptyBudgetEdit">SET MY BUDGETS <span>↗</span></button></div>`;
    $("#emptyBudgetEdit").addEventListener("click", openSettings);
    return;
  }
  const ordered = visible.sort((a, b) => (spentByCategory.get(b) || 0) - (spentByCategory.get(a) || 0)).slice(0, 5);
  $("#budgetList").innerHTML = ordered.map((name) => {
    const info = CATEGORIES[name] || CATEGORIES.Other;
    const limit = Number(budgets[name] || 0);
    const spent = spentByCategory.get(name) || 0;
    const pct = limit ? Math.min(100, spent / limit * 100) : 0;
    const over = limit > 0 && spent > limit;
    return `<div class="budget-row ${over ? "over" : ""}"><span class="budget-emoji">${info.icon}</span><div class="budget-info"><b>${esc(name)}</b><small>${limit ? (over ? "Over your limit" : `${Math.round(pct)}% of monthly limit`) : "No limit set"}</small></div><div class="budget-amount"><b>${money(spent)}</b> <small>${limit ? `/ ${money(limit)}` : "spent"}</small></div><div class="budget-track"><i style="width:${pct}%"></i></div></div>`;
  }).join("");
}

function visibleTransactions() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const category = $("#categoryFilter").value;
  return monthTransactions().filter((item) => (category === "all" || item.category === category) && (!query || `${item.description} ${item.category} ${item.note || ""}`.toLowerCase().includes(query))).sort((a, b) => b.date.localeCompare(a.date));
}

function renderTransactions() {
  const items = visibleTransactions();
  const shown = showAllTransactions ? items : items.slice(0, 8);
  $("#transactionRows").innerHTML = shown.map((item) => {
    const info = CATEGORIES[item.category] || CATEGORIES.Other;
    const date = new Date(`${item.date}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const amount = `${item.type === "income" ? "+" : "−"}${money(Number(item.amount))}`;
    return `<div class="transaction-row"><div class="merchant"><span class="merchant-icon" style="--bg:${info.bg};--fg:${info.fg}">${info.icon}</span><span><b>${esc(item.description)}</b><small>${esc(item.note || (item.type === "income" ? "Other income" : item.category))}</small></span></div><span><i class="category-chip">${esc(item.category)}</i></span><span>${date}</span><b class="amount ${item.type}">${amount}</b><span class="transaction-actions"><button type="button" data-edit="${esc(item.id)}" aria-label="Edit ${esc(item.description)}">Edit</button><button type="button" data-delete="${esc(item.id)}" aria-label="Delete ${esc(item.description)}">Delete</button></span></div>`;
  }).join("") || `<div class="empty-state">No transactions for this month yet. Add your salary or first expense to begin.</div>`;
  $("#allTransactions").hidden = items.length <= 8;
  $("#allTransactions").innerHTML = showAllTransactions ? `SHOW LESS <span>⌃</span>` : `VIEW ALL <span>↗</span>`;
  $("#transactionRows").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openTransaction(button.dataset.edit)));
  $("#transactionRows").querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteTransaction(button.dataset.delete)));
}

function render() {
  const items = monthTransactions();
  renderSummary(items);
  renderSpending(items);
  renderBudgets(items);
  renderTransactions();
}

function buildCategoryFilter() {
  $("#categoryFilter").innerHTML = `<option value="all">All categories</option>` + Object.keys(CATEGORIES).map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
}

function openTransaction(id = null) {
  editingId = id;
  transactionForm.reset();
  transactionForm.elements.date.value = todayKey();
  $("#transactionDialogTitle").textContent = id ? "Edit transaction" : "Add transaction";
  $("#saveTransaction").innerHTML = id ? `Save changes <span>↗</span>` : `Save transaction <span>↗</span>`;
  if (id) {
    const item = data.transactions.find((entry) => entry.id === id);
    if (!item) return;
    transactionForm.elements.description.value = item.description;
    transactionForm.elements.amount.value = item.amount;
    transactionForm.elements.type.value = item.type;
    transactionForm.elements.date.value = item.date;
    transactionForm.elements.note.value = item.note || "";
    transactionForm.elements.category.value = item.type === "income" ? "Food & Drink" : item.category;
  }
  updateCategoryField();
  transactionDialog.showModal();
}

function updateCategoryField() {
  $("#categoryField").hidden = transactionForm.elements.type.value === "income";
}

function deleteTransaction(id) {
  const item = data.transactions.find((entry) => entry.id === id);
  if (!item || !window.confirm(`Delete “${item.description}”?`)) return;
  data.transactions = data.transactions.filter((entry) => entry.id !== id);
  persist();
  render();
}

function openSettings() {
  $("#salaryInput").value = data.salary[selectedMonth()] ?? "";
  const budgets = monthlyBudgets();
  $("#budgetInputs").innerHTML = Object.keys(CATEGORIES).filter((name) => name !== "Income").map((name) => `<label>${esc(name)}<span>$</span><input name="budget-${esc(name)}" type="number" min="0" step="0.01" placeholder="No limit" value="${budgets[name] ?? ""}"></label>`).join("");
  settingsDialog.showModal();
}

function exportCsv() {
  const rows = [["Date", "Description", "Type", "Category", "Amount (CAD)", "Note"], ...monthTransactions().map((item) => [item.date, item.description, item.type, item.category, Number(item.amount).toFixed(2), item.note || ""])];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `spendwise-${selectedMonth()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

buildMonthOptions();
buildCategoryFilter();
monthSelect.addEventListener("change", () => { showAllTransactions = false; render(); });
$("#searchInput").addEventListener("input", () => { showAllTransactions = false; renderTransactions(); });
$("#categoryFilter").addEventListener("change", () => { showAllTransactions = false; renderTransactions(); });
$("#exportBtn").addEventListener("click", exportCsv);
$("#openForm").addEventListener("click", () => openTransaction());
transactionForm.elements.type.addEventListener("change", updateCategoryField);
$("#closeForm").addEventListener("click", () => transactionDialog.close());
$("#cancelForm").addEventListener("click", () => transactionDialog.close());
$("#transactionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  const type = values.get("type");
  const item = { id: editingId || crypto.randomUUID(), description: values.get("description").trim(), amount: Number(values.get("amount")), type, category: type === "income" ? "Income" : values.get("category"), date: values.get("date"), note: values.get("note").trim() };
  if (editingId) data.transactions = data.transactions.map((entry) => entry.id === editingId ? item : entry);
  else data.transactions.push(item);
  persist();
  ensureMonthOption(monthKey(item.date));
  monthSelect.value = monthKey(item.date);
  showAllTransactions = false;
  transactionDialog.close();
  render();
});
$("#settingsBtn").addEventListener("click", openSettings);
$("#editPlanBtn").addEventListener("click", openSettings);
$("#closeSettings").addEventListener("click", () => settingsDialog.close());
$("#cancelSettings").addEventListener("click", () => settingsDialog.close());
$("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  data.salary[selectedMonth()] = Number(values.get("salary") || 0);
  data.budgets[selectedMonth()] = Object.fromEntries(Object.keys(CATEGORIES).filter((name) => name !== "Income").map((name) => [`${name}`, Number(values.get(`budget-${name}`) || 0)]));
  persist();
  settingsDialog.close();
  render();
});
$("#allTransactions").addEventListener("click", () => { showAllTransactions = !showAllTransactions; renderTransactions(); });
$("#resetData").addEventListener("click", () => {
  if (!window.confirm("This will permanently clear your salary plans, budgets, and transactions saved in this browser. Continue?")) return;
  data = blankData();
  persist();
  showAllTransactions = false;
  render();
});
render();
