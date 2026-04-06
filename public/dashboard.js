(function () {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const currencyFull = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });
  const currencyCompact = new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
  const shortMonth = new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric" });

  const TAB_META = {
    transfers: { title: "ประวัติการโอนเงิน", chart: "กราฟโอนเงินรายวัน", dateKey: "date" },
    withdrawals: { title: "ประวัติการถอนเงิน", chart: "กราฟถอนเงินรายวัน", dateKey: "date" },
    topups: { title: "ประวัติเติมเงิน", chart: "กราฟเติมเงินรายวัน", dateKey: "date" },
    bills: { title: "ประวัติการจ่ายบิล", chart: "กราฟจ่ายบิลรายวัน", dateKey: "date" },
    schedule: { title: "กำหนดชำระ", chart: "กราฟกำหนดชำระรายวัน", dateKey: "due" },
  };

  const state = {
    user: {
      username: localStorage.getItem("mb_user") || "guest",
      email: localStorage.getItem("mb_email") || "guest@example.com",
      fullName:
        localStorage.getItem("mb_fullName") ||
        localStorage.getItem("mb_name") ||
        "Guest User",
    },
    showFullBalance: false,
    activeTab: "transfers",
    range: "this",
    q: "",
    from: "",
    to: "",
    data: null,
  };

  let confirmAction = null;

  function dataKeyOf(username) {
    return `bs5_dashboard_data:${username || "guest"}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function slugId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatDateTimeValue(date) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join("-") + ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function shiftDate(days, hours, minutes) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, minutes, 0, 0);
    return formatDateTimeValue(date);
  }

  function seedData() {
    return {
      balance: 42350.5,
      transfers: [
        { id: slugId("tr"), date: shiftDate(-7, 9, 15), to: "KBank 482-1-4421", note: "ค่าอุปกรณ์ออฟฟิศ", amount: 1850, status: "สำเร็จ" },
        { id: slugId("tr"), date: shiftDate(-3, 14, 5), to: "SCB 114-9-0201", note: "จ่ายค่าฟรีแลนซ์", amount: 4200, status: "สำเร็จ" },
        { id: slugId("tr"), date: shiftDate(-1, 11, 40), to: "พร้อมเพย์ 089-123-4567", note: "ค่าเดินทาง", amount: 780, status: "สำเร็จ" },
      ],
      withdrawals: [
        { id: slugId("wd"), date: shiftDate(-5, 16, 10), channel: "ATM KBank", note: "ถอนใช้รายวัน", amount: 2000, fee: 20, status: "สำเร็จ" },
        { id: slugId("wd"), date: shiftDate(-2, 18, 45), channel: "Counter Service", note: "เงินสดฉุกเฉิน", amount: 1500, fee: 20, status: "สำเร็จ" },
      ],
      topups: [
        { id: slugId("tp"), date: shiftDate(-8, 8, 20), channel: "Mobile Banking", note: "เติมเงินเข้าบัญชี", amount: 12000, fee: 0, status: "สำเร็จ" },
        { id: slugId("tp"), date: shiftDate(-1, 9, 10), channel: "Cash Deposit", note: "ฝากเงินเพิ่ม", amount: 4800, fee: 0, status: "สำเร็จ" },
      ],
      bills: [
        { id: slugId("bi"), date: shiftDate(-6, 10, 35), bill: "ค่าไฟฟ้า", provider: "MEA", ref: "MEA-10293", amount: 1520, status: "จ่ายแล้ว" },
        { id: slugId("bi"), date: shiftDate(-4, 13, 0), bill: "ค่าอินเทอร์เน็ต", provider: "AIS Fibre", ref: "AIS-55302", amount: 799, status: "จ่ายแล้ว" },
      ],
      schedule: [
        { id: slugId("sc"), due: shiftDate(2, 9, 0), bill: "ค่าน้ำประปา", provider: "MWA", amount: 430, status: "แนะนำจ่ายก่อน" },
        { id: slugId("sc"), due: shiftDate(5, 12, 30), bill: "ค่าโทรศัพท์", provider: "True", amount: 699, status: "รอดำเนินการ" },
      ],
    };
  }

  function loadData() {
    const raw = localStorage.getItem(dataKeyOf(state.user.username));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (error) {
        console.warn("Failed to parse dashboard data, reseeding.", error);
      }
    }
    const seeded = seedData();
    localStorage.setItem(dataKeyOf(state.user.username), JSON.stringify(seeded));
    return seeded;
  }

  function saveData() {
    localStorage.setItem(dataKeyOf(state.user.username), JSON.stringify(state.data));
  }

  function parseDateTime(value) {
    if (!value) return null;
    const normalized = value.length === 10 ? `${value}T00:00` : value.replace(" ", "T");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatCurrency(value, compact) {
    return compact ? currencyCompact.format(Number(value || 0)) : currencyFull.format(Number(value || 0));
  }

  function formatDateTH(value) {
    const date = parseDateTime(value);
    if (!date) return value || "-";
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function formatDayLabel(value) {
    const date = parseDateTime(value);
    if (!date) return value || "-";
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
  }

  function monthKeyOf(value) {
    const date = parseDateTime(value);
    if (!date) return "";
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0);
  }

  function startOfPrevMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() - 1, 1, 0, 0, 0);
  }

  function endOfPrevMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inRange(value) {
    const date = parseDateTime(value);
    if (!date) return false;

    const now = new Date();
    if (state.range === "all") return true;
    if (state.range === "today") return date >= startOfDay(now) && date <= endOfDay(now);
    if (state.range === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return date >= startOfDay(yesterday) && date <= endOfDay(yesterday);
    }
    if (state.range === "this") return date >= startOfMonth(now);
    if (state.range === "last") return date >= startOfPrevMonth(now) && date <= endOfPrevMonth(now);
    if (state.range === "custom") {
      const from = state.from ? new Date(`${state.from}T00:00`) : null;
      const to = state.to ? new Date(`${state.to}T23:59`) : null;
      if (from && date < from) return false;
      if (to && date > to) return false;
    }
    return true;
  }

  function matchesQuery(row) {
    const needle = state.q.trim().toLowerCase();
    if (!needle) return true;
    return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(needle));
  }

  function sortByDateDesc(rows, key) {
    return rows.slice().sort((a, b) => {
      const left = parseDateTime(a[key]);
      const right = parseDateTime(b[key]);
      const leftTime = left ? left.getTime() : 0;
      const rightTime = right ? right.getTime() : 0;
      return rightTime - leftTime;
    });
  }

  function getRowsByTab(tab) {
    if (tab === "schedule") return state.data.schedule;
    if (tab === "bills") return state.data.bills;
    if (tab === "topups") return state.data.topups;
    if (tab === "withdrawals") return state.data.withdrawals;
    return state.data.transfers;
  }

  function getFilteredRows(tab = state.activeTab) {
    const meta = TAB_META[tab];
    return sortByDateDesc(getRowsByTab(tab), meta.dateKey).filter((row) => inRange(row[meta.dateKey]) && matchesQuery(row));
  }

  function getChartSeries(rows, dateKey) {
    const sums = new Map();
    rows.forEach((row) => {
      const date = parseDateTime(row[dateKey]);
      if (!date) return;
      const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
      sums.set(key, (sums.get(key) || 0) + Math.abs(Number(row.amount || 0)));
    });
    return Array.from(sums.entries())
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .slice(-10)
      .map(([key, value]) => ({ key, label: formatDayLabel(key), value }));
  }

  function computeMonthStats() {
    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const incomeRows = state.data.topups.filter((row) => monthKeyOf(row.date) === targetMonth);
    const expenseRows = []
      .concat(state.data.transfers.map((row) => ({ ...row, kind: "transfer" })))
      .concat(state.data.bills.map((row) => ({ ...row, kind: "bill" })))
      .concat(state.data.withdrawals.map((row) => ({ ...row, kind: "withdrawal" })))
      .filter((row) => monthKeyOf(row.date) === targetMonth);
    return {
      incomeSum: incomeRows.reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0),
      incomeCount: incomeRows.length,
      expenseSum: expenseRows.reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0),
      expenseCount: expenseRows.length,
    };
  }

  function statusClass(status) {
    if (status === "สำเร็จ" || status === "จ่ายแล้ว") return "status-pill good";
    if (status === "แนะนำจ่ายก่อน") return "status-pill warn";
    return "status-pill";
  }

  function renderProfile() {
    const avatarLetter = (state.user.username || "g").charAt(0).toUpperCase();
    qs("#profileAvatar").textContent = avatarLetter;
    qs("#profileName").textContent = state.user.fullName || state.user.username;
    qs("#profileEmail").textContent = state.user.email || "guest@example.com";
  }

  function renderSummary() {
    const stats = computeMonthStats();
    qs("#balanceValue").textContent = formatCurrency(state.data.balance, !state.showFullBalance);
    qs("#toggleBalanceBtn").textContent = state.showFullBalance ? "ย่อ" : "ดูเต็ม";
    qs("#incomeThisMonth").textContent = formatCurrency(stats.incomeSum, false);
    qs("#incomeCount").textContent = `${stats.incomeCount} รายการ`;
    qs("#expenseThisMonth").textContent = formatCurrency(stats.expenseSum, false);
    qs("#expenseCount").textContent = `${stats.expenseCount} รายการ`;
  }

  function renderToolbar() {
    qsa("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === state.activeTab);
    });
    qsa("[data-range]").forEach((button) => {
      button.classList.toggle("active", button.dataset.range === state.range);
    });
    qs("#customRangeFields").classList.toggle("is-hidden", state.range !== "custom");
    qs("#searchInput").value = state.q;
    qs("#fromDate").value = state.from;
    qs("#toDate").value = state.to;
    qs("#activityTitle").textContent = TAB_META[state.activeTab].title;
    qs("#activeTabLabel").textContent = `${TAB_META[state.activeTab].title} • ${shortMonth.format(new Date())}`;
    qs("#chartTitle").textContent = TAB_META[state.activeTab].chart;
  }

  function renderChart(rows) {
    const chartBody = qs("#chartBody");
    const series = getChartSeries(rows, TAB_META[state.activeTab].dateKey);
    const total = series.reduce((sum, item) => sum + item.value, 0);
    const latest = series.length ? series[series.length - 1].value : 0;

    qs("#chartTotal").textContent = formatCurrency(total, false);
    qs("#chartLatest").textContent = formatCurrency(latest, false);

    if (!series.length) {
      chartBody.innerHTML = '<div class="chart-empty">ยังไม่มีข้อมูลในช่วงที่เลือก ลองเปลี่ยนแท็บหรือช่วงเวลาเพื่อดูกราฟ</div>';
      return;
    }

    const max = Math.max(...series.map((item) => item.value), 1);
    chartBody.innerHTML = `
      <div class="chart-bars">
        ${series
          .map((item) => {
            const height = Math.max(12, Math.round((item.value / max) * 100));
            return `
              <div class="chart-bar-col">
                <div class="chart-bar-value">${escapeHtml(formatCurrency(item.value, true))}</div>
                <div class="chart-bar-track">
                  <div class="chart-bar-fill" style="--bar-height:${height}%"></div>
                </div>
                <div class="chart-bar-label">${escapeHtml(item.label)}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderTable(rows) {
    const head = qs("#tableHead");
    const body = qs("#tableBody");

    const headerMap = {
      transfers: ["วันเวลา", "ปลายทาง", "หมายเหตุ", "ยอดโอน", "สถานะ", "จัดการ"],
      withdrawals: ["วันเวลา", "ช่องทาง", "รายละเอียด", "ยอดถอน", "ค่าธรรมเนียม", "สถานะ", "จัดการ"],
      topups: ["วันเวลา", "ช่องทาง", "รายละเอียด", "ยอดเติม", "ค่าธรรมเนียม", "สถานะ", "จัดการ"],
      bills: ["วันเวลา", "รายการบิล", "ผู้ให้บริการ", "เลขอ้างอิง", "ยอดจ่าย", "สถานะ", "จัดการ"],
      schedule: ["วันครบกำหนด", "รายการ", "ผู้ให้บริการ", "ยอดชำระ", "สถานะ", "จัดการ"],
    };

    head.innerHTML = `<tr>${headerMap[state.activeTab].map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>`;
    qs("#recordCount").textContent = `${rows.length} รายการ`;

    if (!rows.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="${headerMap[state.activeTab].length}">ไม่พบรายการตามเงื่อนไขที่เลือก</td></tr>`;
      return;
    }

    if (state.activeTab === "transfers") {
      body.innerHTML = rows.map((row) => `
        <tr>
          <td>${escapeHtml(formatDateTH(row.date))}</td>
          <td class="cell-strong">${escapeHtml(row.to)}</td>
          <td class="cell-muted">${escapeHtml(row.note || "-")}</td>
          <td class="amount-negative">-${escapeHtml(formatCurrency(row.amount, false))}</td>
          <td><span class="${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
          <td><div class="row-actions"><button type="button" class="table-btn danger" data-action="delete" data-tab="transfers" data-id="${escapeHtml(row.id)}">ลบ</button></div></td>
        </tr>
      `).join("");
      return;
    }

    if (state.activeTab === "withdrawals") {
      body.innerHTML = rows.map((row) => `
        <tr>
          <td>${escapeHtml(formatDateTH(row.date))}</td>
          <td class="cell-strong">${escapeHtml(row.channel)}</td>
          <td class="cell-muted">${escapeHtml(row.note || "-")}</td>
          <td class="amount-negative">-${escapeHtml(formatCurrency(row.amount, false))}</td>
          <td>${escapeHtml(formatCurrency(row.fee || 0, false))}</td>
          <td><span class="${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
          <td><div class="row-actions"><button type="button" class="table-btn danger" data-action="delete" data-tab="withdrawals" data-id="${escapeHtml(row.id)}">ลบ</button></div></td>
        </tr>
      `).join("");
      return;
    }

    if (state.activeTab === "topups") {
      body.innerHTML = rows.map((row) => `
        <tr>
          <td>${escapeHtml(formatDateTH(row.date))}</td>
          <td class="cell-strong">${escapeHtml(row.channel)}</td>
          <td class="cell-muted">${escapeHtml(row.note || "-")}</td>
          <td class="amount-positive">+${escapeHtml(formatCurrency(row.amount, false))}</td>
          <td>${escapeHtml(formatCurrency(row.fee || 0, false))}</td>
          <td><span class="${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
          <td><div class="row-actions"><button type="button" class="table-btn danger" data-action="delete" data-tab="topups" data-id="${escapeHtml(row.id)}">ลบ</button></div></td>
        </tr>
      `).join("");
      return;
    }

    if (state.activeTab === "bills") {
      body.innerHTML = rows.map((row) => `
        <tr>
          <td>${escapeHtml(formatDateTH(row.date))}</td>
          <td class="cell-strong">${escapeHtml(row.bill)}</td>
          <td>${escapeHtml(row.provider)}</td>
          <td class="cell-muted">${escapeHtml(row.ref || "-")}</td>
          <td class="amount-negative">-${escapeHtml(formatCurrency(row.amount, false))}</td>
          <td><span class="${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
          <td><div class="row-actions"><button type="button" class="table-btn danger" data-action="delete" data-tab="bills" data-id="${escapeHtml(row.id)}">ลบ</button></div></td>
        </tr>
      `).join("");
      return;
    }

    body.innerHTML = rows.map((row) => `
      <tr>
        <td>${escapeHtml(formatDateTH(row.due))}</td>
        <td class="cell-strong">${escapeHtml(row.bill)}</td>
        <td>${escapeHtml(row.provider)}</td>
        <td>${escapeHtml(formatCurrency(row.amount, false))}</td>
        <td><span class="${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" class="table-btn" data-action="pay-schedule" data-id="${escapeHtml(row.id)}">Pay now</button>
            <button type="button" class="table-btn danger" data-action="delete" data-tab="schedule" data-id="${escapeHtml(row.id)}">ลบ</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function render() {
    const rows = getFilteredRows();
    renderProfile();
    renderSummary();
    renderToolbar();
    renderChart(rows);
    renderTable(rows);
  }

  function showToast(message, type) {
    const host = qs("#toastHost");
    const toast = document.createElement("div");
    toast.className = `toast-card ${type === "error" ? "error" : "success"}`;
    toast.innerHTML = `<strong>${type === "error" ? "แจ้งเตือน" : "สำเร็จ"}</strong><div>${escapeHtml(message)}</div>`;
    host.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function closeModal() {
    qs("#modalBackdrop").classList.add("is-hidden");
    qs("#modalBody").innerHTML = "";
    confirmAction = null;
  }

  function openModal(title, bodyHtml, bindFn) {
    qs("#modalTitle").textContent = title;
    qs("#modalBody").innerHTML = bodyHtml;
    qs("#modalBackdrop").classList.remove("is-hidden");
    if (typeof bindFn === "function") bindFn();
  }

  function askConfirm(message, onConfirm) {
    confirmAction = onConfirm;
    openModal(
      "ยืนยันรายการ",
      `
        <div class="modal-form">
          <p class="text-muted-soft mb-0">${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button type="button" class="mini-action" id="confirmCancelBtn">ยกเลิก</button>
            <button type="button" class="btn glow-button" id="confirmAcceptBtn">ยืนยัน</button>
          </div>
        </div>
      `,
      () => {
        qs("#confirmCancelBtn").addEventListener("click", closeModal);
        qs("#confirmAcceptBtn").addEventListener("click", () => {
          if (typeof confirmAction === "function") confirmAction();
          closeModal();
        });
      }
    );
  }

  function getFormConfig(type) {
    if (type === "transfer") {
      return {
        title: "โอนเงิน",
        submitText: "ยืนยันโอน",
        fields: [
          { name: "to", label: "ปลายทาง", placeholder: "เช่น KBank 482-1-4421", type: "text", required: true },
          { name: "amount", label: "จำนวนเงิน", placeholder: "1000", type: "number", required: true },
          { name: "note", label: "หมายเหตุ", placeholder: "เช่น ค่าอุปกรณ์", type: "textarea", full: true },
        ],
      };
    }
    if (type === "bill") {
      return {
        title: "จ่ายบิล",
        submitText: "ยืนยันจ่าย",
        fields: [
          { name: "bill", label: "รายการบิล", placeholder: "เช่น ค่าไฟฟ้า", type: "text", required: true },
          { name: "provider", label: "ผู้ให้บริการ", placeholder: "เช่น MEA", type: "text", required: true },
          { name: "ref", label: "เลขอ้างอิง", placeholder: "เช่น MEA-10293", type: "text", required: false },
          { name: "amount", label: "จำนวนเงิน", placeholder: "599", type: "number", required: true },
        ],
      };
    }
    if (type === "topup") {
      return {
        title: "เติมเงิน",
        submitText: "ยืนยันเติมเงิน",
        fields: [
          { name: "channel", label: "ช่องทาง", placeholder: "เช่น Mobile Banking", type: "text", required: true },
          { name: "amount", label: "จำนวนเงิน", placeholder: "2000", type: "number", required: true },
          { name: "note", label: "หมายเหตุ", placeholder: "เช่น ฝากเงินเข้าบัญชี", type: "textarea", full: true },
        ],
      };
    }
    return {
      title: "ถอนเงิน",
      submitText: "ยืนยันถอน",
      fields: [
        { name: "channel", label: "ช่องทาง", placeholder: "เช่น ATM KBank", type: "text", required: true },
        { name: "amount", label: "จำนวนเงิน", placeholder: "1000", type: "number", required: true },
        { name: "note", label: "หมายเหตุ", placeholder: "เช่น ถอนเงินสด", type: "textarea", full: true },
      ],
    };
  }

  function openActionModal(type) {
    const config = getFormConfig(type);
    openModal(
      config.title,
      `
        <form class="modal-form" id="actionForm">
          <div class="field-grid">
            ${config.fields.map((field) => {
              const className = field.full ? "field full" : "field";
              if (field.type === "textarea") {
                return `
                  <label class="${className}">
                    <span>${escapeHtml(field.label)}</span>
                    <textarea name="${escapeHtml(field.name)}" placeholder="${escapeHtml(field.placeholder || "")}" ${field.required ? "required" : ""}></textarea>
                  </label>
                `;
              }
              return `
                <label class="${className}">
                  <span>${escapeHtml(field.label)}</span>
                  <input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type)}" placeholder="${escapeHtml(field.placeholder || "")}" ${field.required ? "required" : ""} min="${field.type === "number" ? "0" : ""}" step="${field.type === "number" ? "0.01" : ""}">
                </label>
              `;
            }).join("")}
          </div>
          <div class="modal-actions">
            <button type="button" class="mini-action" id="actionCancelBtn">ยกเลิก</button>
            <button type="submit" class="btn glow-button">${escapeHtml(config.submitText)}</button>
          </div>
        </form>
      `,
      () => {
        qs("#actionCancelBtn").addEventListener("click", closeModal);
        qs("#actionForm").addEventListener("submit", (event) => {
          event.preventDefault();
          const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
          handleActionSubmit(type, formData);
        });
      }
    );
  }

  function numberValue(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }

  function nowString() {
    return formatDateTimeValue(new Date());
  }

  function handleActionSubmit(type, formData) {
    if (type === "transfer") {
      const amount = numberValue(formData.amount);
      if (!amount) return showToast("กรอกจำนวนเงินให้ถูกต้อง", "error");
      if (!formData.to || !String(formData.to).trim()) return showToast("กรอกปลายทาง", "error");
      if (amount > state.data.balance) return showToast("ยอดเงินไม่พอ", "error");
      state.data.balance -= amount;
      state.data.transfers.push({ id: slugId("tr"), date: nowString(), to: String(formData.to).trim(), note: String(formData.note || "").trim(), amount, status: "สำเร็จ" });
      state.activeTab = "transfers";
      closeModal();
      saveData();
      render();
      showToast("โอนเงินสำเร็จ", "success");
      return;
    }

    if (type === "bill") {
      const amount = numberValue(formData.amount);
      if (!amount) return showToast("กรอกจำนวนเงินให้ถูกต้อง", "error");
      if (!formData.bill || !String(formData.bill).trim()) return showToast("กรอกรายการบิล", "error");
      if (!formData.provider || !String(formData.provider).trim()) return showToast("กรอกผู้ให้บริการ", "error");
      if (amount > state.data.balance) return showToast("ยอดเงินไม่พอ", "error");
      state.data.balance -= amount;
      state.data.bills.push({ id: slugId("bi"), date: nowString(), bill: String(formData.bill).trim(), provider: String(formData.provider).trim(), ref: String(formData.ref || "").trim(), amount, status: "จ่ายแล้ว" });
      state.activeTab = "bills";
      closeModal();
      saveData();
      render();
      showToast("จ่ายบิลสำเร็จ", "success");
      return;
    }

    if (type === "topup") {
      const amount = numberValue(formData.amount);
      if (!amount) return showToast("กรอกจำนวนเงินให้ถูกต้อง", "error");
      if (!formData.channel || !String(formData.channel).trim()) return showToast("กรอกช่องทางเติมเงิน", "error");
      if (amount > 100000000) return showToast("จำนวนเงินเกินลิมิตที่ตั้งไว้", "error");
      state.data.balance += amount;
      state.data.topups.push({ id: slugId("tp"), date: nowString(), channel: String(formData.channel).trim(), note: String(formData.note || "").trim(), amount, fee: 0, status: "สำเร็จ" });
      state.activeTab = "topups";
      closeModal();
      saveData();
      render();
      showToast("เติมเงินสำเร็จ", "success");
      return;
    }

    const amount = numberValue(formData.amount);
    const fee = 20;
    if (!amount) return showToast("กรอกจำนวนเงินให้ถูกต้อง", "error");
    if (!formData.channel || !String(formData.channel).trim()) return showToast("กรอกช่องทางถอนเงิน", "error");
    if (amount + fee > state.data.balance) return showToast("ยอดเงินไม่พอสำหรับยอดถอนและค่าธรรมเนียม", "error");
    state.data.balance -= amount + fee;
    state.data.withdrawals.push({ id: slugId("wd"), date: nowString(), channel: String(formData.channel).trim(), note: String(formData.note || "").trim(), amount, fee, status: "สำเร็จ" });
    state.activeTab = "withdrawals";
    closeModal();
    saveData();
    render();
    showToast("ถอนเงินสำเร็จ", "success");
  }

  function deleteRow(tab, id) {
    if (!id) return;
    if (tab === "transfers") state.data.transfers = state.data.transfers.filter((row) => row.id !== id);
    if (tab === "withdrawals") state.data.withdrawals = state.data.withdrawals.filter((row) => row.id !== id);
    if (tab === "topups") state.data.topups = state.data.topups.filter((row) => row.id !== id);
    if (tab === "bills") state.data.bills = state.data.bills.filter((row) => row.id !== id);
    if (tab === "schedule") state.data.schedule = state.data.schedule.filter((row) => row.id !== id);
    saveData();
    render();
    showToast("ลบรายการเรียบร้อยแล้ว", "success");
  }

  function paySchedule(id) {
    const row = state.data.schedule.find((item) => item.id === id);
    if (!row) return;
    if (row.amount > state.data.balance) return showToast("ยอดเงินไม่พอสำหรับรายการนี้", "error");
    state.data.balance -= Number(row.amount || 0);
    state.data.schedule = state.data.schedule.filter((item) => item.id !== id);
    state.data.bills.push({ id: slugId("bi"), date: nowString(), bill: row.bill, provider: row.provider, ref: `AUTO-${row.id.slice(-4)}`, amount: Number(row.amount || 0), status: "จ่ายแล้ว" });
    state.activeTab = "bills";
    saveData();
    render();
    showToast("ชำระรายการที่นัดไว้เรียบร้อยแล้ว", "success");
  }

  function resetDemoData() {
    askConfirm("ต้องการรีเซ็ตข้อมูลตัวอย่างของผู้ใช้นี้กลับเป็นค่าเริ่มต้นใช่ไหม?", () => {
      state.data = seedData();
      saveData();
      render();
      showToast("รีเซ็ตข้อมูลตัวอย่างแล้ว", "success");
    });
  }

  function logout() {
    localStorage.removeItem("mb_user");
    localStorage.removeItem("mb_email");
    localStorage.removeItem("mb_fullName");
    localStorage.removeItem("mb_name");
    window.location.href = "./login.html";
  }

  function bindEvents() {
    qsa("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;
        render();
      });
    });

    qsa("[data-range]").forEach((button) => {
      button.addEventListener("click", () => {
        state.range = button.dataset.range;
        render();
      });
    });

    qs("#searchInput").addEventListener("input", (event) => {
      state.q = event.target.value;
      render();
    });

    qs("#fromDate").addEventListener("change", (event) => {
      state.from = event.target.value;
      render();
    });

    qs("#toDate").addEventListener("change", (event) => {
      state.to = event.target.value;
      render();
    });

    qs("#clearCustomRangeBtn").addEventListener("click", () => {
      state.from = "";
      state.to = "";
      render();
    });

    qsa("[data-open-modal]").forEach((button) => {
      button.addEventListener("click", () => openActionModal(button.dataset.openModal));
    });

    qs("#toggleBalanceBtn").addEventListener("click", () => {
      state.showFullBalance = !state.showFullBalance;
      renderSummary();
    });

    qs("#resetDemoBtn").addEventListener("click", resetDemoData);
    qs("#logoutBtn").addEventListener("click", logout);
    qs("#navLogoutBtn").addEventListener("click", logout);

    qs("#modalCloseBtn").addEventListener("click", closeModal);
    qs("#modalBackdrop").addEventListener("mousedown", (event) => {
      if (event.target === event.currentTarget) closeModal();
    });

    qs("#tableBody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      const tab = button.dataset.tab;

      if (action === "delete") {
        askConfirm("ต้องการลบรายการนี้ใช่ไหม?", () => deleteRow(tab, id));
        return;
      }

      if (action === "pay-schedule") {
        askConfirm("ยืนยันการชำระรายการที่นัดไว้ใช่ไหม?", () => paySchedule(id));
      }
    });
  }

  function init() {
    state.data = loadData();
    bindEvents();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
