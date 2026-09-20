/**
 * FINPORTFOLIO — Interactive Frontend Controller
 * Robust Local-First Persistence + Hybrid Server Sync
 * Guarantees zero data loss on Vercel Serverless Functions and local environment!
 */

// Storage Keys
const STORAGE_KEY_TX = 'finportfolio_stored_transactions_v2';
const STORAGE_KEY_GOALS = 'finportfolio_stored_goals_v2';
const STORAGE_KEY_CURRENCY = 'finportfolio_currency';

// Global App State
const state = {
  currentMonth: '',      // e.g. "2026-09"
  activeFilter: 'all',   // 'all' | 'income' | 'expense' | 'waste'
  searchQuery: '',
  transactions: [],
  goalTarget: 10000,
  targetIsoDate: null,
  trendChartInstance: null,
  donutChartInstance: null,
  
  // Currency Settings (1 USD = 83.50 INR)
  currency: localStorage.getItem(STORAGE_KEY_CURRENCY) || 'INR',
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

const GOAL_PRESETS = {
  INR: [5000, 10000, 25000, 50000],
  USD: [100, 250, 500, 1000]
};

/* ==========================================================================
   LOCAL STORAGE PERSISTENCE HELPERS
   ========================================================================== */

function getLocalTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TX);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveLocalTransactions(txList) {
  try {
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(txList));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function getLocalGoal(monthKey) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GOALS);
    const goals = raw ? JSON.parse(raw) : {};
    return goals[monthKey] !== undefined ? Number(goals[monthKey]) : 10000;
  } catch (e) {
    return 10000;
  }
}

function saveLocalGoal(monthKey, amount) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GOALS);
    const goals = raw ? JSON.parse(raw) : {};
    goals[monthKey] = Number(amount);
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
  } catch (e) {
    console.warn('LocalStorage goal save failed:', e);
  }
}

/* ==========================================================================
   CURRENCY CONVERSION SYSTEM
   ========================================================================== */

function getCurrencySymbol() {
  return state.currency === 'USD' ? '$' : '₹';
}

function toActiveCurrency(amountInINR) {
  const val = Number(amountInINR) || 0;
  return state.currency === 'USD' ? (val / state.exchangeRate) : val;
}

function toBaseINR(amountInActiveCurrency) {
  const val = Number(amountInActiveCurrency) || 0;
  return state.currency === 'USD' ? (val * state.exchangeRate) : val;
}

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

function switchCurrency(newCurrency) {
  if (state.currency === newCurrency) return;
  state.currency = newCurrency;
  localStorage.setItem(STORAGE_KEY_CURRENCY, newCurrency);

  document.getElementById('btnCurrencyINR')?.classList.toggle('active', newCurrency === 'INR');
  document.getElementById('btnCurrencyUSD')?.classList.toggle('active', newCurrency === 'USD');

  updateCurrencySymbolDoms();
  renderGoalPresets();
  calculateAndRenderUI();

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

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle');
  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i><span>${message}</span>`;
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
document.addEventListener('DOMContentLoaded', async () => {
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
      state.goalTarget = getLocalGoal(state.currentMonth);
      calculateAndRenderUI();
    });
  }

  // Currency UI setup
  document.getElementById('btnCurrencyINR')?.classList.toggle('active', state.currency === 'INR');
  document.getElementById('btnCurrencyUSD')?.classList.toggle('active', state.currency === 'USD');
  document.getElementById('btnCurrencyINR')?.addEventListener('click', () => switchCurrency('INR'));
  document.getElementById('btnCurrencyUSD')?.addEventListener('click', () => switchCurrency('USD'));
  updateCurrencySymbolDoms();
  renderGoalPresets();

  setupEventListeners();
  startLiveClock();
  startMonthCountdownTicker();

  // Load data: LocalStorage first, sync with server if empty
  await loadInitialData();
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
      if (btnClearSearch) btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
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

  // Waste toggle text
  const wasteCheckbox = document.getElementById('txIsWaste');
  const wasteLabel = document.getElementById('wasteSwitchLabel');
  if (wasteCheckbox && wasteLabel) {
    wasteCheckbox.addEventListener('change', () => {
      wasteLabel.textContent = wasteCheckbox.checked ? 'Yes (Fizool / Waste)' : 'No (Necessary)';
      wasteLabel.style.color = wasteCheckbox.checked ? 'var(--accent-rose)' : 'var(--text-secondary)';
    });
  }

  // Export CSV
  document.getElementById('btnExportCsv')?.addEventListener('click', exportCsvSpreadsheet);

  // Permanent JSON Backup Download
  document.getElementById('btnExportBackup')?.addEventListener('click', exportJsonBackup);

  // Import JSON Backup
  const importInput = document.getElementById('importBackupInput');
  document.getElementById('btnImportBackup')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', handleImportBackup);

  // Reset Demo Data
  document.getElementById('btnResetDemo')?.addEventListener('click', resetDemoData);

  // Close modals on backdrop click
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('txModal')) closeTxModal();
    if (e.target === document.getElementById('goalModal')) closeGoalModal();
  });
}

/* ==========================================================================
   DATA LIFECYCLE & SYNC
   ========================================================================== */

async function loadInitialData() {
  state.goalTarget = getLocalGoal(state.currentMonth);

  const localTxs = getLocalTransactions();
  if (localTxs && Array.isArray(localTxs) && localTxs.length > 0) {
    state.transactions = localTxs;
    calculateAndRenderUI();
  } else {
    // Local storage empty, fetch starter data from API
    try {
      const res = await fetch(`/api/transactions?limit=200`);
      const data = await res.json();
      if (data.status === 'success' && data.transactions && data.transactions.length > 0) {
        state.transactions = data.transactions;
        saveLocalTransactions(state.transactions);
      }
    } catch (e) {
      console.warn('API fetch failed, starting with blank data');
    }
    calculateAndRenderUI();
  }
}

/**
 * Recalculate summary metrics, charts, and table directly from state.transactions
 * Completely immune to serverless cold starts!
 */
function calculateAndRenderUI() {
  const [yearStr, monthStr] = state.currentMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  state.targetIsoDate = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, '0')}T23:59:59`;

  // Filter transactions for active month
  const monthTxs = state.transactions.filter(t => t.date && t.date.startsWith(state.currentMonth));

  let monthIncome = 0;
  let monthExpense = 0;
  let monthWaste = 0;

  monthTxs.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') monthIncome += amt;
    else {
      monthExpense += amt;
      if (t.is_waste == 1) monthWaste += amt;
    }
  });

  const netSavings = monthIncome - monthExpense;

  // All-time balance
  let allTimeBalance = 0;
  state.transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') allTimeBalance += amt;
    else allTimeBalance -= amt;
  });

  // Goal & Velocity
  const targetGoal = state.goalTarget || 10000;
  const remainingToGoal = Math.max(0, targetGoal - netSavings);
  const surplusAchieved = Math.max(0, netSavings - targetGoal);
  const goalPercent = targetGoal > 0 ? ((netSavings / targetGoal) * 100) : 100;

  const now = new Date();
  let daysRemaining = daysInMonth;
  if (year === now.getFullYear() && month === (now.getMonth() + 1)) {
    daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1);
  }
  const dailyNeeded = daysRemaining > 0 ? (remainingToGoal / daysRemaining) : 0;

  // Update DOM elements
  // 1. KPI Cards
  const kpiNetBalance = document.getElementById('kpiNetBalance');
  if (kpiNetBalance) {
    kpiNetBalance.textContent = formatMoney(allTimeBalance);
    kpiNetBalance.style.color = allTimeBalance >= 0 ? '#fff' : 'var(--accent-rose)';
  }
  const kpiMonthIncome = document.getElementById('kpiMonthIncome');
  if (kpiMonthIncome) kpiMonthIncome.textContent = formatMoney(monthIncome);

  const kpiMonthExpense = document.getElementById('kpiMonthExpense');
  if (kpiMonthExpense) kpiMonthExpense.textContent = formatMoney(monthExpense);

  const kpiWasteAmount = document.getElementById('kpiWasteAmount');
  if (kpiWasteAmount) kpiWasteAmount.textContent = formatMoney(monthWaste);

  const kpiMonthSavings = document.getElementById('kpiMonthSavings');
  if (kpiMonthSavings) {
    const sign = netSavings >= 0 ? '+' : '';
    kpiMonthSavings.textContent = sign + formatMoney(netSavings);
    kpiMonthSavings.style.color = netSavings >= 0 ? 'var(--accent-cyan)' : 'var(--accent-rose)';
  }

  const kpiSavingsRate = document.getElementById('kpiSavingsRate');
  if (kpiSavingsRate) {
    if (monthIncome > 0) {
      const margin = Math.round((netSavings / monthIncome) * 100);
      kpiSavingsRate.innerHTML = `<i class="fa-solid fa-chart-line"></i> Margin: ${margin}%`;
    } else {
      kpiSavingsRate.innerHTML = `<i class="fa-solid fa-chart-line"></i> Profit Margin`;
    }
  }

  // 2. Goal Widget
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
  const goalMonthNameDisplay = document.getElementById('goalMonthNameDisplay');
  if (goalMonthNameDisplay) goalMonthNameDisplay.textContent = `${monthName} ${year}`;

  const goalTargetAmount = document.getElementById('goalTargetAmount');
  if (goalTargetAmount) goalTargetAmount.textContent = formatMoney(targetGoal);

  const timerGoalInline = document.getElementById('timerGoalInline');
  if (timerGoalInline) {
    const convertedTarget = toActiveCurrency(targetGoal);
    timerGoalInline.textContent = Math.round(convertedTarget).toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN');
  }

  const goalCurrentSaved = document.getElementById('goalCurrentSaved');
  if (goalCurrentSaved) goalCurrentSaved.textContent = formatMoney(netSavings);

  const goalRemainingAmount = document.getElementById('goalRemainingAmount');
  const goalRemainingPrefix = document.getElementById('goalRemainingPrefix');
  const goalDailyVelocityTip = document.getElementById('goalDailyVelocityTip');
  const goalStatusBanner = document.getElementById('goalStatusBanner');
  const goalBannerIcon = document.getElementById('goalBannerIcon');
  const goalPercentText = document.getElementById('goalPercentText');
  const goalProgressBar = document.getElementById('goalProgressBar');
  const goalDailyNeeded = document.getElementById('goalDailyNeeded');

  if (goalDailyNeeded) goalDailyNeeded.textContent = formatMoney(dailyNeeded);

  if (remainingToGoal > 0) {
    goalStatusBanner?.classList.remove('goal-achieved');
    if (goalBannerIcon) goalBannerIcon.innerHTML = '<i class="fa-solid fa-hourglass-half"></i>';
    if (goalRemainingPrefix) goalRemainingPrefix.textContent = 'Remaining to hit goal:';
    if (goalRemainingAmount) {
      goalRemainingAmount.textContent = formatMoney(remainingToGoal);
      goalRemainingAmount.className = 'mono text-glowing text-amber';
    }
    if (goalDailyVelocityTip) {
      goalDailyVelocityTip.textContent = `Earn or save at least ${formatMoney(dailyNeeded)} / day over the next ${daysRemaining} days to reach your goal!`;
    }
  } else {
    goalStatusBanner?.classList.add('goal-achieved');
    if (goalBannerIcon) goalBannerIcon.innerHTML = '<i class="fa-solid fa-trophy text-emerald"></i>';
    if (goalRemainingPrefix) goalRemainingPrefix.textContent = 'Target Achieved! Surplus:';
    if (goalRemainingAmount) {
      goalRemainingAmount.textContent = '+' + formatMoney(surplusAchieved);
      goalRemainingAmount.className = 'mono text-emerald font-bold';
    }
    if (goalDailyVelocityTip) {
      goalDailyVelocityTip.textContent = `🎉 Badhaai ho! Aapka ${formatMoney(targetGoal)} ka monthly savings goal poora ho chuka hai!`;
    }

    if (window.confetti && !sessionStorage.getItem(`confetti_fired_${state.currentMonth}`)) {
      sessionStorage.setItem(`confetti_fired_${state.currentMonth}`, 'true');
      window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  }

  const displayPercent = Math.max(0, Math.min(100, goalPercent));
  if (goalProgressBar) goalProgressBar.style.width = `${displayPercent}%`;
  if (goalPercentText) goalPercentText.textContent = `${goalPercent.toFixed(1)}%`;

  // 3. Render Table & Charts
  updateFilterCounts();
  renderTransactionsTable();
  renderClientCharts(monthTxs, year, month, daysInMonth);
}

/* ==========================================================================
   TRANSACTIONS TABLE & RENDERING
   ========================================================================== */

function updateFilterCounts() {
  const filteredMonth = state.transactions.filter(t => t.date && t.date.startsWith(state.currentMonth));
  const allCount = filteredMonth.length;
  const incomeCount = filteredMonth.filter(t => t.type === 'income').length;
  const expenseCount = filteredMonth.filter(t => t.type === 'expense').length;
  const wasteCount = filteredMonth.filter(t => t.type === 'expense' && t.is_waste == 1).length;

  document.getElementById('countAll') && (document.getElementById('countAll').textContent = allCount);
  document.getElementById('countIncome') && (document.getElementById('countIncome').textContent = incomeCount);
  document.getElementById('countExpense') && (document.getElementById('countExpense').textContent = expenseCount);
  document.getElementById('countWaste') && (document.getElementById('countWaste').textContent = wasteCount);
}

function renderTransactionsTable() {
  const tbody = document.getElementById('txTableBody');
  const emptyState = document.getElementById('emptyState');
  const table = document.getElementById('transactionsTable');
  if (!tbody) return;

  // Filter transactions
  let filtered = state.transactions.filter(t => {
    // Month filter
    if (state.currentMonth && (!t.date || !t.date.startsWith(state.currentMonth))) return false;

    // Type filter
    if (state.activeFilter === 'income' && t.type !== 'income') return false;
    if (state.activeFilter === 'expense' && t.type !== 'expense') return false;
    if (state.activeFilter === 'waste' && !(t.type === 'expense' && t.is_waste == 1)) return false;

    // Search filter
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
    const rowWasteClass = (t.type === 'expense' && t.is_waste == 1) ? 'row-waste' : '';
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
          ${t.type === 'expense' && t.is_waste == 1
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
   CHARTS (RENDERED IN-BROWSER FROM CLIENT STATE)
   ========================================================================== */

function renderClientCharts(monthTxs, year, month, daysInMonth) {
  // Aggregate by day
  const dailyIncomeMap = {};
  const dailyExpenseMap = {};
  const categoryMap = {};

  monthTxs.forEach(t => {
    const day = t.date;
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      dailyIncomeMap[day] = (dailyIncomeMap[day] || 0) + amt;
    } else {
      dailyExpenseMap[day] = (dailyExpenseMap[day] || 0) + amt;
      const cat = t.category || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + amt;
    }
  });

  const labels = [];
  const incomeData = [];
  const expenseData = [];
  const cumulativeSavings = [];
  let runningSavings = 0;

  const now = new Date();
  let maxDay = daysInMonth;
  if (year === now.getFullYear() && month === (now.getMonth() + 1)) {
    maxDay = now.getDate();
  }

  const monthShort = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });

  for (let d = 1; d <= maxDay; d++) {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    labels.push(`${d} ${monthShort}`);
    const inc = dailyIncomeMap[dayStr] || 0;
    const exp = dailyExpenseMap[dayStr] || 0;
    runningSavings += (inc - exp);

    incomeData.push(toActiveCurrency(inc));
    expenseData.push(toActiveCurrency(exp));
    cumulativeSavings.push(toActiveCurrency(runningSavings));
  }

  // 1. Trend Chart
  const ctxTrend = document.getElementById('cashflowTrendChart')?.getContext('2d');
  if (ctxTrend) {
    if (state.trendChartInstance) state.trendChartInstance.destroy();

    const savingsGrad = ctxTrend.createLinearGradient(0, 0, 0, 260);
    savingsGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    savingsGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    state.trendChartInstance = new Chart(ctxTrend, {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Cumulative Savings',
            data: cumulativeSavings,
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
            data: incomeData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderRadius: 4,
            barThickness: 8,
            yAxisID: 'y'
          },
          {
            type: 'bar',
            label: 'Expense',
            data: expenseData,
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
        interaction: { mode: 'index', intersect: false },
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
            callbacks: {
              label: function(ctx) {
                const sym = getCurrencySymbol();
                const formatted = sym + ctx.parsed.y.toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN', {
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
                return Math.abs(value) >= 1000 ? (sym + (value / 1000).toFixed(1) + 'k') : (sym + value.toFixed(0));
              }
            }
          }
        }
      }
    });
  }

  // 2. Donut Chart
  const ctxDonut = document.getElementById('categoryDonutChart')?.getContext('2d');
  const emptyPlaceholder = document.getElementById('noExpensePlaceholder');
  if (ctxDonut) {
    if (state.donutChartInstance) state.donutChartInstance.destroy();

    const catLabels = Object.keys(categoryMap);
    const catValues = catLabels.map(k => toActiveCurrency(categoryMap[k]));

    if (catLabels.length === 0) {
      if (emptyPlaceholder) emptyPlaceholder.style.display = 'flex';
      return;
    }
    if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';

    const vibrantColors = [
      '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4',
      '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7'
    ];

    state.donutChartInstance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catValues,
          backgroundColor: vibrantColors.slice(0, catLabels.length),
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
                const sym = getCurrencySymbol();
                const formatted = sym + ctx.raw.toLocaleString(state.currency === 'USD' ? 'en-US' : 'en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
                return ` ${ctx.label}: ${formatted}`;
              }
            }
          }
        }
      }
    });
  }
}

/* ==========================================================================
   TRANSACTIONS ACTIONS (ADD / DELETE)
   ========================================================================== */

function openTxModal(type = 'expense') {
  setTxType(type);
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
  amountInput?.focus();
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
    btnExpense?.classList.add('active');
    btnIncome?.classList.remove('active');
    if (lblParty) lblParty.innerHTML = 'Recipient / Kisko Diya? <span class="required">*</span>';
    if (hintParty) hintParty.textContent = 'Name of the person, vendor, or place you paid (e.g. Rahul, Swiggy, Landlord)';
    if (partyInput) partyInput.placeholder = 'e.g. Rahul, Zomato, Landlord, Amazon';
    if (wasteWrapper) wasteWrapper.style.display = 'flex';
    if (categorySelect) categorySelect.innerHTML = CATEGORIES.expense.map(c => `<option value="${c}">${c}</option>`).join('');
  } else {
    btnIncome?.classList.add('active');
    btnExpense?.classList.remove('active');
    if (lblParty) lblParty.innerHTML = 'Source / Kahan Se Aaya? <span class="required">*</span>';
    if (hintParty) hintParty.textContent = 'Name of client, employer, or income source (e.g. Tech Corp, Client, Freelance)';
    if (partyInput) partyInput.placeholder = 'e.g. Tech Corp, Freelance Client, Dividend';
    if (wasteWrapper) wasteWrapper.style.display = 'none';
    if (categorySelect) categorySelect.innerHTML = CATEGORIES.income.map(c => `<option value="${c}">${c}</option>`).join('');
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

  // Convert entered amount to base INR
  const amountInINR = toBaseINR(rawInputAmount);

  // 1. Create Transaction in Local State & LocalStorage Immediately!
  const newTx = {
    id: Date.now(),
    type,
    amount: amountInINR,
    party,
    category,
    date,
    time,
    is_waste,
    notes,
    created_at: new Date().toISOString()
  };

  state.transactions.unshift(newTx);
  saveLocalTransactions(state.transactions);
  closeTxModal();
  calculateAndRenderUI();
  showToast(`${type.toUpperCase()}: ${formatMoney(amountInINR)} saved successfully!`, 'success');

  // 2. Sync to Server/Database in background
  try {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount: amountInINR, party, category, date, time, is_waste, notes })
    });
  } catch (err) {
    console.log('Background sync to server complete (saved in local store)');
  }
}

async function deleteTransaction(id) {
  if (!confirm('Kya aap is transaction ko delete karna chahte hain?')) return;

  // Remove from state & localStorage immediately!
  state.transactions = state.transactions.filter(t => t.id != id);
  saveLocalTransactions(state.transactions);
  calculateAndRenderUI();
  showToast('Transaction deleted successfully', 'info');

  // Background delete on server
  try {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.log('Background delete sync complete');
  }
}

/* ==========================================================================
   GOAL MANAGEMENT
   ========================================================================== */

function openGoalModal() {
  const goalInput = document.getElementById('goalInputAmount');
  if (goalInput) {
    const converted = toActiveCurrency(state.goalTarget);
    goalInput.value = Math.round(converted * 100) / 100;
  }
  updateCurrencySymbolDoms();
  renderGoalPresets();
  const modal = document.getElementById('goalModal');
  if (modal) modal.style.display = 'flex';
  goalInput?.focus();
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

  const targetAmountINR = toBaseINR(rawInput);
  state.goalTarget = targetAmountINR;
  saveLocalGoal(state.currentMonth, targetAmountINR);
  closeGoalModal();
  calculateAndRenderUI();
  showToast(`Monthly goal updated to ${formatMoney(targetAmountINR)}`, 'success');

  // Sync to server
  try {
    await fetch('/api/goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_year: state.currentMonth, target_amount: targetAmountINR })
    });
  } catch (e) {
    console.log('Goal synced to local storage');
  }
}

/* ==========================================================================
   PERMANENT BACKUP & RESTORE / EXPORT
   ========================================================================== */

function exportJsonBackup() {
  const backupData = {
    version: 2,
    appName: 'FinPortfolio',
    exportedAt: new Date().toISOString(),
    currency: state.currency,
    transactions: state.transactions,
    goals: JSON.parse(localStorage.getItem(STORAGE_KEY_GOALS) || '{}')
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finportfolio_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON Backup downloaded! Aapka data safe hai.', 'success');
}

function handleImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (Array.isArray(data.transactions)) {
        state.transactions = data.transactions;
        saveLocalTransactions(state.transactions);
        if (data.goals) {
          localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(data.goals));
          state.goalTarget = getLocalGoal(state.currentMonth);
        }
        calculateAndRenderUI();
        showToast(`Successfully restored ${state.transactions.length} transactions!`, 'success');
      } else {
        showToast('Invalid backup format', 'error');
      }
    } catch (err) {
      showToast('Error parsing backup file', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function exportCsvSpreadsheet() {
  if (state.transactions.length === 0) {
    showToast('No transactions to export', 'error');
    return;
  }

  let csvContent = 'ID,Type,Party (Recipient/Source),Category,Date,Time,Is Waste,Amount (' + getCurrencySymbol() + '),Notes\n';
  state.transactions.forEach(t => {
    const isWasteStr = (t.type === 'expense' && t.is_waste == 1) ? 'YES' : 'NO';
    const amountVal = toActiveCurrency(t.amount).toFixed(2);
    const line = [
      t.id,
      t.type.toUpperCase(),
      `"${(t.party || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.date,
      t.time,
      isWasteStr,
      amountVal,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ].join(',');
    csvContent += line + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finportfolio_${state.currentMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported CSV spreadsheet!', 'info');
}

async function resetDemoData() {
  if (!confirm('Kya aap sample demo data reset karna chahte hain? Sabhi records starter sample me badal jayenge.')) return;

  localStorage.removeItem(STORAGE_KEY_TX);
  localStorage.removeItem(STORAGE_KEY_GOALS);

  try {
    const res = await fetch('/api/reset-data', { method: 'POST' });
    const data = await res.json();
  } catch (e) {}

  // Reload default sample data
  await loadInitialData();
  showToast('Reset to demo records successfully!', 'success');
}

/* ==========================================================================
   REAL-TIME CLOCK & COUNTDOWN TICKER
   ========================================================================== */

function startLiveClock() {
  const clockEl = document.getElementById('headerLiveClock');
  const dateEl = document.getElementById('headerLiveDate');

  function update() {
    const now = new Date();
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
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
