/**
 * FINPORTFOLIO — Interactive Frontend Controller
 * Handles real-time month countdown, goal velocity, transactions, Chart.js analytics,
 * and Multi-Currency Conversion between INR (₹) and USD ($).
 */

// Global App State
const state = {
  currentMonth: '',      // e.g. "2026-09"
  activeFilter: 'all',   // 'all' | 'income' | 'expense' | 'waste'
  searchQuery: '',
  summaryData: null,
  transactions: [],
  targetIsoDate: null,
  trendChartInstance: null,
  donutChartInstance: null,
  
  // Currency Conversion Settings (1 USD = 83.50 INR)
  currency: localStorage.getItem('finportfolio_currency') || 'INR', // 'INR' | 'USD'
  exchangeRate: 83.50
};

// Preset categories
const CATEGORIES = {
  expense: [
    'Food & Dining',
    'Bills & Utilities',
    'Rent & Housing',
    'Shopping',
    'Entertainment',
    'Travel & Fuel',
    'Health & Medical',
    'Groceries',
    'Impulse / Unnecessary',
    'Personal Care',
    'General / Others'
  ],
  income: [
    'Salary',
    'Freelance / Client',
    'Business Profit',
    'Investment Returns',
    'Gift / Bonus',
    'Cashback / Reward',
    'Other Income'
  ]
};

// Preset Goal options depending on currency
const GOAL_PRESETS = {
  INR: [5000, 10000, 25000, 50000],
  USD: [100, 250, 500, 1000]
};

/* ==========================================================================
   CURRENCY FORMATTING & CONVERSION SYSTEM
   ========================================================================== */

function getCurrencySymbol() {
  return state.currency === 'USD' ? '$' : '₹';
}

// Convert amount stored in base currency (INR) into the currently active display currency
function toActiveCurrency(amountInINR) {
  const val = Number(amountInINR) || 0;
  if (state.currency === 'USD') {
    return val / state.exchangeRate;
  }
  return val;
}

// Convert input value in active currency back to base currency (INR) for database persistence
function toBaseINR(amountInActiveCurrency) {
  const val = Number(amountInActiveCurrency) || 0;
  if (state.currency === 'USD') {
    return val * state.exchangeRate;
  }
  return val;
}

// Format full currency string
function formatMoney(amountInINR) {
  const isUSD = state.currency === 'USD';
  const val = toActiveCurrency(amountInINR);
  
  if (isUSD) {
    return '$' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return '₹' + val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Format compact currency for chart axes and small tags
function formatCompactMoney(amountInINR) {
  const isUSD = state.currency === 'USD';
  const val = Math.abs(toActiveCurrency(amountInINR));
  
  if (isUSD) {
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k';
    return '$' + val.toFixed(0);
  }
  
  if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + ' Cr';
  if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + ' L';
  if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + ' k';
  return '₹' + val.toFixed(0);
}

// Switch currency between INR and USD
function switchCurrency(newCurrency) {
  if (state.currency === newCurrency) return;
  state.currency = newCurrency;
  localStorage.setItem('finportfolio_currency', newCurrency);
  
  // Update toggle button states
  document.getElementById('btnCurrencyINR')?.classList.toggle('active', newCurrency === 'INR');
  document.getElementById('btnCurrencyUSD')?.classList.toggle('active', newCurrency === 'USD');
  
  // Update input labels & symbols
  updateCurrencySymbolDoms();
  renderGoalPresets();
  
  // Re-render UI components with new currency
  if (state.summaryData) {
    updateSummaryUI(state.summaryData);
  }
  renderTransactionsTable();
  fetchCharts();
  
  const symbol = getCurrencySymbol();
  if (newCurrency === 'USD') {
    showToast(`Switched currency to US Dollar ($) • Rate: 1 USD = ₹${state.exchangeRate.toFixed(2)}`, 'info');
  } else {
    showToast(`Switched currency to Indian Rupee (₹)`, 'info');
  }
}

function updateCurrencySymbolDoms() {
  const symbol = getCurrencySymbol();
  document.querySelectorAll('.curr-symbol-label').forEach(el => el.textContent = symbol);
  document.querySelectorAll('.modal-curr-symbol').forEach(el => el.textContent = symbol);
  document.querySelectorAll('.modal-goal-curr-symbol').forEach(el => el.textContent = symbol);
}

function renderGoalPresets() {
  const container = document.getElementById('goalPresetContainer');
  if (!container) return;
  
  const presets = GOAL_PRESETS[state.currency] || GOAL_PRESETS.INR;
  const symbol = getCurrencySymbol();
  
  container.innerHTML = `
    <span class="preset-label">Quick Presets:</span>
    ${presets.map((val, idx) => `
      <button type="button" class="preset-btn ${idx === 1 ? 'active' : ''}" onclick="setGoalPreset(${val})">
        ${symbol}${val.toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN')}
      </button>
    `).join('')}
  `;
}

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle');
  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const yearStr = now.getFullYear();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  state.currentMonth = `${yearStr}-${monthStr}`;

  // Set month filter input
  const monthFilter = document.getElementById('monthFilter');
  if (monthFilter) {
    monthFilter.value = state.currentMonth;
    monthFilter.addEventListener('change', (e) => {
      state.currentMonth = e.target.value;
      refreshDashboard();
    });
  }

  // Setup Currency Switcher UI
  document.getElementById('btnCurrencyINR')?.classList.toggle('active', state.currency === 'INR');
  document.getElementById('btnCurrencyUSD')?.classList.toggle('active', state.currency === 'USD');
  document.getElementById('btnCurrencyINR')?.addEventListener('click', () => switchCurrency('INR'));
  document.getElementById('btnCurrencyUSD')?.addEventListener('click', () => switchCurrency('USD'));
  updateCurrencySymbolDoms();
  renderGoalPresets();

  // Setup Event Listeners
  setupEventListeners();

  // Start Realtime Clocks
  startLiveClock();
  startMonthCountdownTicker();

  // Initial Data Load
  refreshDashboard();
});

function setupEventListeners() {
  // Modal toggles
  document.getElementById('btnOpenExpenseModal')?.addEventListener('click', () => openTxModal('expense'));
  document.getElementById('btnOpenIncomeModal')?.addEventListener('click', () => openTxModal('income'));
  document.getElementById('btnQuickAddTx')?.addEventListener('click', () => openTxModal('expense'));
  document.getElementById('btnCloseTxModal')?.addEventListener('click', closeTxModal);
  document.getElementById('btnCancelTx')?.addEventListener('click', closeTxModal);

  document.getElementById('btnOpenGoalModal')?.addEventListener('click', openGoalModal);
  document.getElementById('btnQuickEditGoal')?.addEventListener('click', openGoalModal);
  document.getElementById('btnCloseGoalModal')?.addEventListener('click', closeGoalModal);
  document.getElementById('btnCancelGoal')?.addEventListener('click', closeGoalModal);

  // Forms
  document.getElementById('txForm')?.addEventListener('submit', handleTxSubmit);
  document.getElementById('goalForm')?.addEventListener('submit', handleGoalSubmit);

  // Filter Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('active');
      state.activeFilter = targetBtn.getAttribute('data-filter');
      renderTransactionsTable();
    });
  });

  // Search input
  const searchInput = document.getElementById('txSearchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      if (btnClearSearch) {
        btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
      }
      renderTransactionsTable();
    });
  }
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      btnClearSearch.style.display = 'none';
      renderTransactionsTable();
    });
  }

  // Waste checkbox toggle text
  const wasteCheckbox = document.getElementById('txIsWaste');
  const wasteLabel = document.getElementById('wasteSwitchLabel');
  if (wasteCheckbox && wasteLabel) {
    wasteCheckbox.addEventListener('change', () => {
      wasteLabel.textContent = wasteCheckbox.checked ? 'Yes (Fizool / Waste)' : 'No (Necessary)';
      wasteLabel.style.color = wasteCheckbox.checked ? 'var(--accent-rose)' : 'var(--text-secondary)';
    });
  }

  // Export CSV
  document.getElementById('btnExportCsv')?.addEventListener('click', () => {
    window.location.href = '/api/export-csv';
    showToast('Exporting CSV transaction report...', 'info');
  });

  // Reset Demo
  document.getElementById('btnResetDemo')?.addEventListener('click', async () => {
    if (confirm('Kya aap sample demo data reset karna chahte hain?')) {
      try {
        const res = await fetch('/api/reset-data', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
          showToast('Data reset to demo records successfully!');
          refreshDashboard();
        }
      } catch (err) {
        showToast('Error resetting data', 'error');
      }
    }
  });

  // Close modals on backdrop click
  window.addEventListener('click', (e) => {
    const txModal = document.getElementById('txModal');
    const goalModal = document.getElementById('goalModal');
    if (e.target === txModal) closeTxModal();
    if (e.target === goalModal) closeGoalModal();
  });
}

/* ==========================================================================
   REAL-TIME CLOCK & COUNTDOWN TICKER
   ========================================================================== */
function startLiveClock() {
  const clockEl = document.getElementById('headerLiveClock');
  const dateEl = document.getElementById('headerLiveDate');

  function update() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }
  update();
  setInterval(update, 1000);
}

function startMonthCountdownTicker() {
  const daysEl = document.getElementById('timerDays');
  const hoursEl = document.getElementById('timerHours');
  const minsEl = document.getElementById('timerMinutes');
  const secsEl = document.getElementById('timerSeconds');

  function updateTicker() {
    const now = new Date();
    let targetDate;
    if (state.targetIsoDate) {
      targetDate = new Date(state.targetIsoDate);
    } else {
      const y = now.getFullYear();
      const m = now.getMonth();
      targetDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
    }

    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minsEl) minsEl.textContent = '00';
      if (secsEl) secsEl.textContent = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(secs).padStart(2, '0');
  }

  updateTicker();
  setInterval(updateTicker, 1000);
}

/* ==========================================================================
   DASHBOARD REFRESH & DATA FETCHING
   ========================================================================== */
async function refreshDashboard() {
  await Promise.all([
    fetchSummary(),
    fetchTransactions(),
    fetchCharts()
  ]);
}

async function fetchSummary() {
  try {
    const res = await fetch(`/api/summary?month=${state.currentMonth}`);
    const data = await res.json();
    if (data.status === 'success') {
      state.summaryData = data;
      state.targetIsoDate = data.month_end_target_iso;
      updateSummaryUI(data);
    }
  } catch (err) {
    console.error('Error fetching summary:', err);
  }
}

function updateSummaryUI(data) {
  // KPI Row
  const kpiNetBalance = document.getElementById('kpiNetBalance');
  if (kpiNetBalance) {
    kpiNetBalance.textContent = formatMoney(data.all_time_balance);
    kpiNetBalance.style.color = data.all_time_balance >= 0 ? '#fff' : 'var(--accent-rose)';
  }

  const kpiMonthIncome = document.getElementById('kpiMonthIncome');
  if (kpiMonthIncome) kpiMonthIncome.textContent = formatMoney(data.total_income);

  const kpiMonthExpense = document.getElementById('kpiMonthExpense');
  if (kpiMonthExpense) kpiMonthExpense.textContent = formatMoney(data.total_expense);

  const kpiWasteAmount = document.getElementById('kpiWasteAmount');
  if (kpiWasteAmount) kpiWasteAmount.textContent = formatMoney(data.total_waste);

  const kpiMonthSavings = document.getElementById('kpiMonthSavings');
  if (kpiMonthSavings) {
    const sign = data.net_savings >= 0 ? '+' : '';
    kpiMonthSavings.textContent = sign + formatMoney(data.net_savings);
    kpiMonthSavings.style.color = data.net_savings >= 0 ? 'var(--accent-cyan)' : 'var(--accent-rose)';
  }

  const kpiSavingsRate = document.getElementById('kpiSavingsRate');
  if (kpiSavingsRate) {
    if (data.total_income > 0) {
      const margin = Math.round((data.net_savings / data.total_income) * 100);
      kpiSavingsRate.innerHTML = `<i class="fa-solid fa-chart-line"></i> Margin: ${margin}%`;
    } else {
      kpiSavingsRate.innerHTML = `<i class="fa-solid fa-chart-line"></i> Profit Margin`;
    }
  }

  // Monthly Goal & Countdown Section
  const goalMonthNameDisplay = document.getElementById('goalMonthNameDisplay');
  if (goalMonthNameDisplay) {
    goalMonthNameDisplay.textContent = `${data.month_name} ${data.year}`;
  }

  const goalTargetAmount = document.getElementById('goalTargetAmount');
  if (goalTargetAmount) goalTargetAmount.textContent = formatMoney(data.goal_target);

  const timerGoalInline = document.getElementById('timerGoalInline');
  if (timerGoalInline) {
    const convertedTarget = toActiveCurrency(data.goal_target);
    timerGoalInline.textContent = Math.round(convertedTarget).toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN');
  }

  const goalCurrentSaved = document.getElementById('goalCurrentSaved');
  if (goalCurrentSaved) goalCurrentSaved.textContent = formatMoney(data.net_savings);

  // Dynamic Goal Remaining Banner
  const goalRemainingAmount = document.getElementById('goalRemainingAmount');
  const goalRemainingPrefix = document.getElementById('goalRemainingPrefix');
  const goalDailyVelocityTip = document.getElementById('goalDailyVelocityTip');
  const goalStatusBanner = document.getElementById('goalStatusBanner');
  const goalBannerIcon = document.getElementById('goalBannerIcon');
  const goalPercentText = document.getElementById('goalPercentText');
  const goalProgressBar = document.getElementById('goalProgressBar');
  const goalDailyNeeded = document.getElementById('goalDailyNeeded');

  if (goalDailyNeeded) {
    goalDailyNeeded.textContent = formatMoney(data.daily_needed);
  }

  if (data.remaining_to_goal > 0) {
    // Still remaining to hit goal
    if (goalStatusBanner) goalStatusBanner.classList.remove('goal-achieved');
    if (goalBannerIcon) goalBannerIcon.innerHTML = '<i class="fa-solid fa-hourglass-half"></i>';
    if (goalRemainingPrefix) goalRemainingPrefix.textContent = 'Remaining to hit goal:';
    if (goalRemainingAmount) {
      goalRemainingAmount.textContent = formatMoney(data.remaining_to_goal);
      goalRemainingAmount.className = 'mono text-glowing text-amber';
    }
    if (goalDailyVelocityTip) {
      goalDailyVelocityTip.textContent = `Earn or save at least ${formatMoney(data.daily_needed)} / day over the next ${data.days_remaining} days to reach your goal!`;
    }
  } else {
    // Goal achieved!
    if (goalStatusBanner) goalStatusBanner.classList.add('goal-achieved');
    if (goalBannerIcon) goalBannerIcon.innerHTML = '<i class="fa-solid fa-trophy text-emerald"></i>';
    if (goalRemainingPrefix) goalRemainingPrefix.textContent = 'Target Achieved! Surplus:';
    if (goalRemainingAmount) {
      goalRemainingAmount.textContent = '+' + formatMoney(data.surplus_achieved);
      goalRemainingAmount.className = 'mono text-emerald font-bold';
    }
    if (goalDailyVelocityTip) {
      goalDailyVelocityTip.textContent = `🎉 Badhaai ho! Aapka ${formatMoney(data.goal_target)} ka monthly savings goal poora ho chuka hai!`;
    }

    // Trigger celebration confetti once
    if (window.confetti && !sessionStorage.getItem(`confetti_fired_${data.month}`)) {
      sessionStorage.setItem(`confetti_fired_${data.month}`, 'true');
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  // Progress Bar
  const displayPercent = Math.max(0, Math.min(100, data.goal_percent));
  if (goalProgressBar) goalProgressBar.style.width = `${displayPercent}%`;
  if (goalPercentText) goalPercentText.textContent = `${data.goal_percent.toFixed(1)}%`;
}

/* ==========================================================================
   TRANSACTIONS MANAGEMENT
   ========================================================================== */
async function fetchTransactions() {
  try {
    const res = await fetch(`/api/transactions?month=${state.currentMonth}&limit=200`);
    const data = await res.json();
    if (data.status === 'success') {
      state.transactions = data.transactions;
      updateFilterCounts();
      renderTransactionsTable();
    }
  } catch (err) {
    console.error('Error fetching transactions:', err);
  }
}

function updateFilterCounts() {
  const allCount = state.transactions.length;
  const incomeCount = state.transactions.filter(t => t.type === 'income').length;
  const expenseCount = state.transactions.filter(t => t.type === 'expense').length;
  const wasteCount = state.transactions.filter(t => t.type === 'expense' && t.is_waste === 1).length;

  const countAll = document.getElementById('countAll');
  const countIncome = document.getElementById('countIncome');
  const countExpense = document.getElementById('countExpense');
  const countWaste = document.getElementById('countWaste');

  if (countAll) countAll.textContent = allCount;
  if (countIncome) countIncome.textContent = incomeCount;
  if (countExpense) countExpense.textContent = expenseCount;
  if (countWaste) countWaste.textContent = wasteCount;
}

function renderTransactionsTable() {
  const tbody = document.getElementById('txTableBody');
  const emptyState = document.getElementById('emptyState');
  const table = document.getElementById('transactionsTable');

  if (!tbody) return;

  // Filter transactions
  let filtered = state.transactions.filter(t => {
    // Type filter
    if (state.activeFilter === 'income' && t.type !== 'income') return false;
    if (state.activeFilter === 'expense' && t.type !== 'expense') return false;
    if (state.activeFilter === 'waste' && !(t.type === 'expense' && t.is_waste === 1)) return false;

    // Search query filter
    if (state.searchQuery) {
      const q = state.searchQuery;
      const party = (t.party || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const notes = (t.notes || '').toLowerCase();
      return party.includes(q) || cat.includes(q) || notes.includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = filtered.map(t => {
    const isInc = t.type === 'income';
    const rowWasteClass = (t.type === 'expense' && t.is_waste === 1) ? 'row-waste' : '';
    const typeIcon = isInc ? 'fa-arrow-down-left' : 'fa-arrow-up-right';
    const typeClass = isInc ? 'income' : 'expense';
    const amountSign = isInc ? '+' : '-';
    const amountColorClass = isInc ? 'text-emerald' : 'text-rose';

    return `
      <tr class="${rowWasteClass}">
        <td>
          <div class="type-indicator ${typeClass}" title="${isInc ? 'Income' : 'Expense'}">
            <i class="fa-solid ${typeIcon}"></i>
          </div>
        </td>
        <td>
          <div class="party-text">${escapeHtml(t.party)}</div>
        </td>
        <td>
          <span class="category-tag">${escapeHtml(t.category)}</span>
        </td>
        <td>
          <div class="datetime-pill">
            <i class="fa-regular fa-clock"></i>
            <span>${t.date} • ${t.time}</span>
          </div>
        </td>
        <td>
          ${t.type === 'expense' && t.is_waste === 1
            ? `<span class="waste-pill"><i class="fa-solid fa-fire"></i> Waste</span>`
            : `<span class="necessary-pill">${isInc ? '—' : 'Essential'}</span>`
          }
        </td>
        <td>
          <span class="notes-text" style="color: var(--text-secondary); font-size: 12.5px;">
            ${escapeHtml(t.notes || '—')}
          </span>
        </td>
        <td class="text-right">
          <span class="amount-text mono ${amountColorClass}">
            ${amountSign}${formatMoney(t.amount)}
          </span>
        </td>
        <td class="text-center">
          <button class="btn-delete-row" title="Delete record" onclick="deleteTransaction(${t.id})">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   CHARTS VISUALIZATION
   ========================================================================== */
async function fetchCharts() {
  try {
    const res = await fetch(`/api/chart-data?month=${state.currentMonth}`);
    const data = await res.json();
    if (data.status === 'success') {
      renderTrendChart(data.trend);
      renderDonutChart(data.categories);
    }
  } catch (err) {
    console.error('Error fetching charts data:', err);
  }
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('cashflowTrendChart')?.getContext('2d');
  if (!ctx) return;

  if (state.trendChartInstance) {
    state.trendChartInstance.destroy();
  }

  // Convert chart datasets to active currency
  const convertedCumulative = trend.cumulative_savings.map(v => toActiveCurrency(v));
  const convertedIncome = trend.income.map(v => toActiveCurrency(v));
  const convertedExpense = trend.expense.map(v => toActiveCurrency(v));

  // Create smooth gradients for lines
  const savingsGrad = ctx.createLinearGradient(0, 0, 0, 260);
  savingsGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
  savingsGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

  state.trendChartInstance = new Chart(ctx, {
    data: {
      labels: trend.labels,
      datasets: [
        {
          type: 'line',
          label: 'Cumulative Savings',
          data: convertedCumulative,
          borderColor: '#06b6d4',
          backgroundColor: savingsGrad,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#06b6d4',
          pointHoverRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Income',
          data: convertedIncome,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderRadius: 4,
          barThickness: 8,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Expense',
          data: convertedExpense,
          backgroundColor: 'rgba(244, 63, 94, 0.75)',
          borderRadius: 4,
          barThickness: 8,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          titleFont: { family: "'Outfit', sans-serif", weight: 'bold' },
          callbacks: {
            label: function(ctx) {
              const val = ctx.parsed.y;
              const sym = getCurrencySymbol();
              const formatted = sym + val.toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
              return `${ctx.dataset.label}: ${formatted}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#64748b', font: { family: "'Outfit', sans-serif", size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: value => {
              const sym = getCurrencySymbol();
              if (Math.abs(value) >= 1000) {
                return sym + (value / 1000).toFixed(1) + 'k';
              }
              return sym + value.toFixed(0);
            }
          }
        }
      }
    }
  });
}

function renderDonutChart(categories) {
  const ctx = document.getElementById('categoryDonutChart')?.getContext('2d');
  const emptyPlaceholder = document.getElementById('noExpensePlaceholder');
  if (!ctx) return;

  if (state.donutChartInstance) {
    state.donutChartInstance.destroy();
  }

  if (!categories.labels || categories.labels.length === 0) {
    if (emptyPlaceholder) emptyPlaceholder.style.display = 'flex';
    return;
  }
  if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';

  const vibrantColors = [
    '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4',
    '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7'
  ];

  // Convert categories values to active currency
  const convertedValues = categories.values.map(v => toActiveCurrency(v));

  state.donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.labels,
      datasets: [{
        data: convertedValues,
        backgroundColor: vibrantColors.slice(0, categories.labels.length),
        borderColor: '#070a12',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(ctx) {
              const label = ctx.label || '';
              const val = ctx.raw;
              const sym = getCurrencySymbol();
              const formatted = sym + val.toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
              return ` ${label}: ${formatted}`;
            }
          }
        }
      }
    }
  });
}

/* ==========================================================================
   TRANSACTION MODAL & SUBMIT
   ========================================================================== */
function openTxModal(type = 'expense') {
  setTxType(type);

  // Prefill date and current time
  const now = new Date();
  const dateInput = document.getElementById('txDate');
  const timeInput = document.getElementById('txTime');
  const amountInput = document.getElementById('txAmount');
  const partyInput = document.getElementById('txParty');
  const notesInput = document.getElementById('txNotes');
  const wasteInput = document.getElementById('txIsWaste');

  if (dateInput) dateInput.value = now.toISOString().split('T')[0];
  if (timeInput) {
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    timeInput.value = `${hours}:${mins}`;
  }
  if (amountInput) amountInput.value = '';
  if (partyInput) partyInput.value = '';
  if (notesInput) notesInput.value = '';
  if (wasteInput) {
    wasteInput.checked = false;
    document.getElementById('wasteSwitchLabel').textContent = 'No (Necessary)';
    document.getElementById('wasteSwitchLabel').style.color = 'var(--text-secondary)';
  }

  updateCurrencySymbolDoms();

  const modal = document.getElementById('txModal');
  if (modal) modal.style.display = 'flex';
  if (amountInput) amountInput.focus();
}

function closeTxModal() {
  const modal = document.getElementById('txModal');
  if (modal) modal.style.display = 'none';
}

function setTxType(type) {
  document.getElementById('txType').value = type;
  const btnExpense = document.getElementById('btnTypeExpense');
  const btnIncome = document.getElementById('btnTypeIncome');
  const lblParty = document.getElementById('lblTxParty');
  const hintParty = document.getElementById('hintTxParty');
  const partyInput = document.getElementById('txParty');
  const wasteWrapper = document.getElementById('wasteToggleWrapper');
  const categorySelect = document.getElementById('txCategory');

  if (type === 'expense') {
    btnExpense.classList.add('active');
    btnIncome.classList.remove('active');
    lblParty.innerHTML = 'Recipient / Kisko Diya? <span class="required">*</span>';
    hintParty.textContent = 'Name of the person, vendor, or place you paid (e.g. Rahul, Swiggy, Landlord)';
    partyInput.placeholder = 'e.g. Rahul, Zomato, Landlord, Amazon';
    wasteWrapper.style.display = 'flex';

    // Populate expense categories
    categorySelect.innerHTML = CATEGORIES.expense.map(c => `<option value="${c}">${c}</option>`).join('');
  } else {
    btnIncome.classList.add('active');
    btnExpense.classList.remove('active');
    lblParty.innerHTML = 'Source / Kahan Se Aaya? <span class="required">*</span>';
    hintParty.textContent = 'Name of client, employer, or income source (e.g. Tech Corp, Client, Freelance)';
    partyInput.placeholder = 'e.g. Tech Corp, Freelance Client, Dividend';
    wasteWrapper.style.display = 'none';

    // Populate income categories
    categorySelect.innerHTML = CATEGORIES.income.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

async function handleTxSubmit(e) {
  e.preventDefault();

  const type = document.getElementById('txType').value;
  const rawInputAmount = parseFloat(document.getElementById('txAmount').value);
  const party = document.getElementById('txParty').value.trim();
  const category = document.getElementById('txCategory').value;
  const date = document.getElementById('txDate').value;
  const time = document.getElementById('txTime').value;
  const is_waste = document.getElementById('txIsWaste').checked ? 1 : 0;
  const notes = document.getElementById('txNotes').value.trim();

  if (!rawInputAmount || rawInputAmount <= 0) {
    showToast('Please enter a valid amount', 'error');
    return;
  }
  if (!party) {
    showToast('Please enter the recipient / source name', 'error');
    return;
  }

  // Convert entered amount to base INR if active currency is USD
  const amountInINR = toBaseINR(rawInputAmount);

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount: amountInINR, party, category, date, time, is_waste, notes })
    });

    const data = await res.json();
    if (data.status === 'success') {
      closeTxModal();
      showToast(`${type.toUpperCase()}: ${formatMoney(amountInINR)} recorded successfully!`, 'success');
      refreshDashboard();
    } else {
      showToast(data.message || 'Failed to save', 'error');
    }
  } catch (err) {
    showToast('Network error while saving transaction', 'error');
  }
}

async function deleteTransaction(id) {
  if (!confirm('Kya aap is transaction ko delete karna chahte hain?')) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Transaction deleted successfully', 'info');
      refreshDashboard();
    }
  } catch (err) {
    showToast('Error deleting transaction', 'error');
  }
}

/* ==========================================================================
   MONTHLY GOAL MODAL & UPDATE
   ========================================================================== */
function openGoalModal() {
  const goalInput = document.getElementById('goalInputAmount');
  if (goalInput && state.summaryData) {
    const converted = toActiveCurrency(state.summaryData.goal_target);
    goalInput.value = Math.round(converted * 100) / 100;
  }
  updateCurrencySymbolDoms();
  renderGoalPresets();
  
  const modal = document.getElementById('goalModal');
  if (modal) modal.style.display = 'flex';
  if (goalInput) goalInput.focus();
}

function closeGoalModal() {
  const modal = document.getElementById('goalModal');
  if (modal) modal.style.display = 'none';
}

function setGoalPreset(amount) {
  const goalInput = document.getElementById('goalInputAmount');
  if (goalInput) goalInput.value = amount;

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(amount.toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN')));
  });
}

async function handleGoalSubmit(e) {
  e.preventDefault();
  const rawInput = parseFloat(document.getElementById('goalInputAmount').value);
  if (isNaN(rawInput) || rawInput < 0) {
    showToast('Please enter a valid goal amount', 'error');
    return;
  }

  // Convert back to base INR for storage
  const targetAmountINR = toBaseINR(rawInput);

  try {
    const res = await fetch('/api/goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month_year: state.currentMonth,
        target_amount: targetAmountINR
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      closeGoalModal();
      showToast(`Monthly goal updated to ${formatMoney(targetAmountINR)}`, 'success');
      refreshDashboard();
    } else {
      showToast(data.message || 'Failed to update goal', 'error');
    }
  } catch (err) {
    showToast('Network error while updating goal', 'error');
  }
}
