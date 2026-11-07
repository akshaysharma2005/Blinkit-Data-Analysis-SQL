// =========================================================================
// BLINKIT ANALYTICS - LUXURY 3D SPACE DESIGN SYSTEM (Inspired by ReactJS18)
// =========================================================================

let charts = {};
let currentSqlResult = null;
let currentTotalSales = 1201681.72;
let currentGrossProfit = 281879.12;
let currentUser = {
  username: "Akshay Sharma",
  role: "Lead BI Analyst"
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupEventListeners();
  initStarsCanvas(); // 3D Floating Starfield Particle Engine
  checkLoginState();
});

async function initApp() {
  await Promise.all([
    loadKpis(),
    loadCleaningStats(),
    loadQueryTemplates(),
    loadDashboardCharts(),
    loadBusinessReport()
  ]);
}

function setupEventListeners() {
  // Tab buttons
  window.switchTab = switchTab;

  // Login functions (Only Username)
  window.selectPersona = selectPersona;
  window.submitLoginAndEnter = submitLoginAndEnter;
  window.quickGuestLogin = quickGuestLogin;
  window.logoutToLoginPage = logoutToLoginPage;

  // SQL buttons
  document.getElementById("runSqlBtn")?.addEventListener("click", runCurrentSql);
  document.getElementById("copySqlBtn")?.addEventListener("click", copyCurrentSql);
  document.getElementById("exportCsvBtn")?.addEventListener("click", exportSqlCsv);

  // File Upload
  const fileInput = document.getElementById("csvFileInput");
  fileInput?.addEventListener("change", handleFileUpload);

  // Reset Button
  const resetBtn = document.getElementById("resetDataBtn");
  resetBtn?.addEventListener("click", handleResetData);

  // Simulation Slider
  const slider = document.getElementById("upliftRange");
  slider?.addEventListener("input", updateSimulation);

  // Print function
  window.printReport = () => {
    switchTab("reportTab");
    setTimeout(() => {
      window.print();
    }, 250);
  };
}

// -------------------------------------------------------------
// 0. 3D STARS CANVAS ENGINE (Inspired by ReactJS18 Stars.tsx)
// -------------------------------------------------------------
function initStarsCanvas() {
  const canvas = document.getElementById("starsCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const starCount = 320;
  const stars = [];
  const colors = ["#ffffff", "#f8cb46", "#00cea8", "#915eff", "#f272c8"];

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: (Math.random() - 0.5) * width * 1.5,
      y: (Math.random() - 0.5) * height * 1.5,
      z: Math.random() * width,
      size: Math.random() * 1.5 + 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      baseAlpha: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.03 + 0.01
    });
  }

  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX - width / 2) * 0.05;
    mouseY = (e.clientY - height / 2) * 0.05;
  });

  let angle = 0;

  function animate() {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    angle += 0.0006;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      // Depth movement
      s.z -= 0.35;
      if (s.z <= 0) s.z = width;

      // 3D rotation
      const rx = s.x * cosA - s.y * sinA;
      const ry = s.x * sinA + s.y * cosA;

      const fov = 350;
      const k = fov / (s.z + fov);
      const px = rx * k + cx + mouseX * (1 - k);
      const py = ry * k + cy + mouseY * (1 - k);

      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        const alpha = Math.sin(Date.now() * s.twinkleSpeed) * 0.3 + s.baseAlpha;
        const currentSize = s.size * k * 2.2;

        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.6, currentSize), 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.min(1, Math.max(0.1, alpha));
        ctx.shadowBlur = 8;
        ctx.shadowColor = s.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.globalAlpha = 1.0;
    requestAnimationFrame(animate);
  }

  animate();
}

// -------------------------------------------------------------
// 1. LOGIN & PERSONA HANDLERS (ONLY USERNAME)
// -------------------------------------------------------------
function checkLoginState() {
  const saved = localStorage.getItem("blinkit_bi_user");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.username) {
        currentUser = parsed;
        updateHeaderUserBadge(currentUser.username, currentUser.role);
        enterDashboardView();
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }
  // Default: Show Login Page
  document.getElementById("loginPage")?.classList.remove("hidden");
  document.getElementById("appView")?.classList.add("hidden");
}

function selectPersona(name, role, el) {
  const usernameInput = document.getElementById("loginUsername");
  const roleInput = document.getElementById("loginRole");
  if (usernameInput) usernameInput.value = name;
  if (roleInput) roleInput.value = role;

  document.querySelectorAll(".role-chip").forEach(c => {
    c.classList.remove("active-chip");
  });

  if (el) {
    el.classList.add("active-chip");
  }
}

function submitLoginAndEnter() {
  const username = document.getElementById("loginUsername")?.value.trim() || "Akshay Sharma";
  const role = document.getElementById("loginRole")?.value || "Lead BI Analyst";

  currentUser = { username, role };
  localStorage.setItem("blinkit_bi_user", JSON.stringify(currentUser));

  updateHeaderUserBadge(username, role);
  enterDashboardView();
}

function quickGuestLogin() {
  currentUser = { username: "Guest Auditor", role: "Public Sandbox" };
  localStorage.setItem("blinkit_bi_user", JSON.stringify(currentUser));
  updateHeaderUserBadge("Guest Auditor", "Public Sandbox");
  enterDashboardView();
}

function updateHeaderUserBadge(username, role) {
  const nameEl = document.getElementById("topLoggedUser");
  const roleEl = document.getElementById("topLoggedRole");
  const bannerName = document.getElementById("bannerUserName");

  if (nameEl) nameEl.innerText = username;
  if (roleEl) roleEl.innerText = role;
  if (bannerName) bannerName.innerText = username;
}

function enterDashboardView() {
  const loginPage = document.getElementById("loginPage");
  const appView = document.getElementById("appView");

  if (loginPage) loginPage.classList.add("hidden");
  if (appView) appView.classList.remove("hidden");

  switchTab("cleaningTab");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function logoutToLoginPage() {
  localStorage.removeItem("blinkit_bi_user");
  const loginPage = document.getElementById("loginPage");
  const appView = document.getElementById("appView");

  if (appView) appView.classList.add("hidden");
  if (loginPage) loginPage.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(el => {
    el.classList.remove("active-tab");
    el.classList.add("border-transparent", "text-[#aaa6c3]");
  });

  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.remove("hidden");
  }

  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add("active-tab");
    activeBtn.classList.remove("border-transparent", "text-[#aaa6c3]");
  }

  // Trigger chart resize if switching to dashboard
  if (tabId === "dashboardTab") {
    setTimeout(() => {
      Object.values(charts).forEach(chart => chart?.resize());
    }, 100);
  }
}

// -------------------------------------------------------------
// 2. KPI LOADER
// -------------------------------------------------------------
async function loadKpis() {
  try {
    const res = await fetch("/api/kpi-summary");
    const data = await res.json();
    if (data.status === "success") {
      currentTotalSales = data.total_sales;
      currentGrossProfit = data.total_est_gross_profit;

      document.getElementById("kpi-total-sales").innerText = formatCurrency(data.total_sales);
      document.getElementById("kpi-avg-sales").innerText = "$" + Number(data.avg_sales).toFixed(2);
      document.getElementById("kpi-avg-rating").innerText = Number(data.avg_rating).toFixed(2);
      document.getElementById("kpi-gross-profit").innerText = formatCurrency(data.total_est_gross_profit);
      document.getElementById("kpi-margin-pct").innerText = data.profit_margin_pct + "%";
      document.getElementById("kpi-outlets").innerText = data.total_outlets;

      updateSimulation();
    }
  } catch (err) {
    console.error("Failed to load KPIs:", err);
  }
}

function formatCurrency(val) {
  const num = Number(val);
  if (num >= 1000000) {
    return "$" + (num / 1000000).toFixed(2) + "M";
  } else if (num >= 1000) {
    return "$" + (num / 1000).toFixed(2) + "k";
  }
  return "$" + num.toFixed(2);
}

// -------------------------------------------------------------
// 3. DATA CLEANING STATS & LIVE COMPARISON
// -------------------------------------------------------------
async function loadCleaningStats() {
  try {
    const res = await fetch("/api/cleaning-stats");
    const data = await res.json();
    if (data.status === "success") {
      const audit = data.audit || {};
      
      const missingWeightEl = document.getElementById("audit-missing-weight");
      if (missingWeightEl) {
        missingWeightEl.innerText = `${audit.cleaned_missing_weight} / ${audit.cleaned_rows} (0% nulls)`;
      }

      const zeroVisEl = document.getElementById("audit-zero-vis");
      if (zeroVisEl) {
        zeroVisEl.innerText = `${audit.cleaned_zero_vis} Anomalies Left`;
      }

      // Populate raw sample table
      populateSampleTable("rawSampleBody", data.raw_sample || []);
      // Populate clean sample table
      populateSampleTable("cleanSampleBody", data.clean_sample || []);
    }
  } catch (err) {
    console.error("Failed to load cleaning stats:", err);
  }
}

function populateSampleTable(tbodyId, rows) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-[#151030]/60 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-2 text-[#f8cb46] font-mono">${r['Item Identifier'] || '-'}</td>
      <td class="py-2.5 px-2 text-white">${r['Item Fat Content'] || '-'}</td>
      <td class="py-2.5 px-2 text-[#aaa6c3]">${r['Item Weight'] !== null ? r['Item Weight'] : '<span class="text-rose-400 font-bold">NULL</span>'}</td>
      <td class="py-2.5 px-2 ${Number(r['Item Visibility']) === 0 ? 'text-rose-400 font-bold' : 'text-[#aaa6c3]'}">${r['Item Visibility'] !== null ? r['Item Visibility'] : '-'}</td>
      <td class="py-2.5 px-2 font-semibold text-[#00cea8] font-mono">$${Number(r['Sales'] || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// 4. SQL TEMPLATES & CONSOLE
// -------------------------------------------------------------
let queryTemplates = [];

async function loadQueryTemplates() {
  try {
    const res = await fetch("/api/query-templates");
    const data = await res.json();
    if (data.status === "success") {
      queryTemplates = data.templates || [];
      renderQueryTemplates(queryTemplates);

      // Default load first template into editor
      if (queryTemplates.length > 0) {
        selectQueryTemplate(queryTemplates[0].id);
      }
    }
  } catch (err) {
    console.error("Failed to load query templates:", err);
  }
}

function renderQueryTemplates(templates) {
  const container = document.getElementById("queryTemplateList");
  if (!container) return;
  container.innerHTML = "";

  templates.forEach(t => {
    const div = document.createElement("div");
    div.className = "query-card p-3 rounded-2xl bg-[#100d25] border border-[#2e265c] cursor-pointer text-xs space-y-1";
    div.onclick = () => selectQueryTemplate(t.id);

    let badgeColor = "bg-[#00cea8]/10 text-[#00cea8] border-[#00cea8]/30";
    if (t.category.includes("Window")) badgeColor = "bg-[#f8cb46]/10 text-[#f8cb46] border-[#f8cb46]/30";
    if (t.category.includes("Join")) badgeColor = "bg-[#38bdf8]/10 text-[#38bdf8] border-[#38bdf8]/30";
    if (t.category.includes("Anomaly")) badgeColor = "bg-rose-500/10 text-rose-300 border-rose-500/30";

    div.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">${t.category}</span>
        <i class="fa-solid fa-arrow-up-right-from-square text-[#aaa6c3] hover:text-white transition"></i>
      </div>
      <div class="font-bold text-white mt-1">${t.title}</div>
      <div class="text-[11px] text-[#aaa6c3] line-clamp-2">${t.description}</div>
    `;
    container.appendChild(div);
  });
}

function selectQueryTemplate(id) {
  const found = queryTemplates.find(t => t.id === id);
  if (found) {
    const input = document.getElementById("sqlQueryInput");
    if (input) {
      input.value = found.sql;
      runCurrentSql();
    }
  }
}

async function runCurrentSql() {
  const input = document.getElementById("sqlQueryInput");
  const query = input?.value.trim();
  if (!query) return;

  const statusText = document.getElementById("queryStatusText");
  const timingText = document.getElementById("queryTimingText");
  const rowCount = document.getElementById("resultRowCount");

  statusText.innerText = "Executing query against SQLite 3.50 engine...";
  statusText.className = "text-[#f8cb46] animate-pulse text-xs";

  try {
    const res = await fetch("/api/execute-sql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const data = await res.json();

    if (data.status === "success") {
      statusText.innerText = "Execution completed successfully";
      statusText.className = "text-[#00cea8] text-xs font-semibold";
      timingText.innerText = `${data.duration_ms} ms`;
      rowCount.innerText = `${data.total_rows} rows`;

      currentSqlResult = data;
      renderSqlResultsTable(data.columns, data.rows);
    } else {
      statusText.innerText = `SQL Error: ${data.message}`;
      statusText.className = "text-rose-400 text-xs font-semibold";
      renderSqlError(data.message);
    }
  } catch (err) {
    statusText.innerText = `Network/Execution error: ${err}`;
    statusText.className = "text-rose-400 text-xs font-semibold";
  }
}

function renderSqlResultsTable(columns, rows) {
  const thead = document.getElementById("sqlResultsHead");
  const tbody = document.getElementById("sqlResultsBody");
  if (!thead || !tbody) return;

  thead.innerHTML = "";
  tbody.innerHTML = "";

  const headerRow = document.createElement("tr");
  columns.forEach(col => {
    const th = document.createElement("th");
    th.className = "py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px] border-b border-[#2e265c] text-white";
    th.innerText = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="py-4 text-center text-[#aaa6c3] italic">Zero rows returned.</td></tr>`;
    return;
  }

  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.className = i % 2 === 0 ? "bg-[#100d25] hover:bg-[#151030]" : "bg-[#050816] hover:bg-[#151030]";
    row.forEach(val => {
      const td = document.createElement("td");
      td.className = "py-2 px-3 border-b border-[#2e265c]/40";
      if (typeof val === "number") {
        td.className += " font-mono text-[#00cea8]";
        td.innerText = val.toLocaleString();
      } else {
        td.innerText = val !== null ? val : "NULL";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderSqlError(errMsg) {
  const thead = document.getElementById("sqlResultsHead");
  const tbody = document.getElementById("sqlResultsBody");
  if (!thead || !tbody) return;

  thead.innerHTML = "<tr><th class='py-2 px-3 text-rose-400'>Error Diagnostics</th></tr>";
  tbody.innerHTML = `
    <tr>
      <td class="p-4 text-rose-300 font-mono text-xs bg-rose-950/20 border border-rose-900/40 rounded-xl">
        <i class="fa-solid fa-triangle-exclamation mr-2"></i> ${errMsg}
      </td>
    </tr>
  `;
}

function copyCurrentSql() {
  const sql = document.getElementById("sqlQueryInput")?.value;
  if (sql) {
    navigator.clipboard.writeText(sql).then(() => {
      const copyBtn = document.getElementById("copySqlBtn");
      copyBtn.innerHTML = '<i class="fa-solid fa-check text-[#00cea8]"></i>';
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      }, 1500);
    });
  }
}

function exportSqlCsv() {
  if (!currentSqlResult || !currentSqlResult.columns || !currentSqlResult.rows) {
    alert("No query result to export.");
    return;
  }
  const { columns, rows } = currentSqlResult;
  let csvContent = "data:text/csv;charset=utf-8," + columns.map(c => `"${c}"`).join(",") + "\n";
  rows.forEach(r => {
    const line = r.map(val => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",");
    csvContent += line + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `blinkit_sql_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// 5. CHART.JS VISUAL ANALYTICS (ReactJS18 Cosmic Palette)
// -------------------------------------------------------------
async function loadDashboardCharts() {
  try {
    const res = await fetch("/api/dashboard-charts");
    const data = await res.json();
    if (data.status === "success") {
      renderItemTypeChart(data.item_types || []);
      renderOutletSizeChart(data.outlet_sizes || []);
      renderFatContentChart(data.fat_contents || []);
      renderLocationChart(data.locations || []);
      renderVintageChart(data.vintages || []);
      renderScatterChart(data.scatter || []);
    }
  } catch (err) {
    console.error("Failed to load charts:", err);
  }
}

function renderItemTypeChart(data) {
  const ctx = document.getElementById("itemTypeChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.itemType) charts.itemType.destroy();

  const labels = data.map(d => d.item_type);
  const sales = data.map(d => d.total_sales);
  const profits = data.map(d => d.est_gross_profit);

  charts.itemType = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Total Sales ($)",
          data: sales,
          backgroundColor: "#f8cb46",
          borderRadius: 6
        },
        {
          label: "Est. Gross Profit ($)",
          data: profits,
          backgroundColor: "#00cea8",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#aaa6c3", font: { size: 10, family: "Poppins" } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#aaa6c3", font: { size: 9, family: "Poppins" }, maxRotation: 45, minRotation: 45 },
          grid: { color: "#2e265c" }
        },
        y: {
          ticks: {
            color: "#aaa6c3",
            font: { size: 10, family: "Poppins" },
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#2e265c" }
        }
      }
    }
  });
}

function renderOutletSizeChart(data) {
  const ctx = document.getElementById("outletSizeChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.outletSize) charts.outletSize.destroy();

  const labels = data.map(d => `${d.outlet_size} (${d.sales_percentage}%)`);
  const sales = data.map(d => d.total_sales);

  charts.outletSize = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: sales,
        backgroundColor: ["#00cea8", "#f8cb46", "#915eff"],
        borderColor: "#151030",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#aaa6c3", font: { size: 11, family: "Poppins" } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Sales: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      cutout: "68%"
    }
  });
}

function renderFatContentChart(data) {
  const ctx = document.getElementById("fatContentChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.fatContent) charts.fatContent.destroy();

  const labels = data.map(d => `${d.fat_content} (${d.pct_share}%)`);
  const sales = data.map(d => d.total_sales);

  charts.fatContent = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Sales ($)",
        data: sales,
        backgroundColor: ["#00cea8", "#f43f5e"],
        borderRadius: 8,
        barThickness: 45
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Sales: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#f3f3f3", font: { family: "Poppins" } }, grid: { display: false } },
        y: {
          ticks: {
            color: "#aaa6c3",
            font: { family: "Poppins" },
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#2e265c" }
        }
      }
    }
  });
}

function renderLocationChart(data) {
  const ctx = document.getElementById("locationChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.location) charts.location.destroy();

  const labels = data.map(d => `${d.location_type} (${d.sales_percentage}%)`);
  const sales = data.map(d => d.total_sales);

  charts.location = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Total Sales ($)",
          data: sales,
          backgroundColor: "#915eff",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#aaa6c3", font: { family: "Poppins" } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Sales: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#f3f3f3", font: { family: "Poppins" } }, grid: { display: false } },
        y: {
          ticks: {
            color: "#aaa6c3",
            font: { family: "Poppins" },
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#2e265c" }
        }
      }
    }
  });
}

function renderVintageChart(data) {
  const ctx = document.getElementById("vintageChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.vintage) charts.vintage.destroy();

  const labels = data.map(d => d.est_year);
  const sales = data.map(d => d.yearly_sales);
  const cumulative = data.map(d => d.cumulative_sales);

  charts.vintage = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Annual Sales ($)",
          data: sales,
          borderColor: "#f8cb46",
          backgroundColor: "rgba(248, 203, 70, 0.12)",
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#f8cb46",
          pointRadius: 4
        },
        {
          label: "Cumulative Revenue ($)",
          data: cumulative,
          borderColor: "#00cea8",
          borderDash: [5, 5],
          tension: 0.2,
          fill: false,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#aaa6c3", font: { family: "Poppins" } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#f3f3f3", font: { family: "Poppins" } }, grid: { color: "#2e265c" } },
        y: {
          ticks: {
            color: "#aaa6c3",
            font: { family: "Poppins" },
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#2e265c" }
        }
      }
    }
  });
}

function renderScatterChart(data) {
  const ctx = document.getElementById("scatterChart")?.getContext("2d");
  if (!ctx) return;
  if (charts.scatter) charts.scatter.destroy();

  const scatterData = data.map(d => ({
    x: d.visibility,
    y: d.sales,
    id: d.item_id,
    type: d.item_type
  }));

  charts.scatter = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "SKU Visibility vs Sales",
        data: scatterData,
        backgroundColor: "rgba(0, 206, 168, 0.65)",
        borderColor: "#00cea8",
        pointRadius: 3.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#aaa6c3", font: { family: "Poppins" } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.raw;
              return `${raw.id} (${raw.type}): Vis=${raw.x}, Sales=$${raw.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Item Visibility Ratio", color: "#aaa6c3", font: { size: 10, family: "Poppins" } },
          ticks: { color: "#aaa6c3", font: { family: "Poppins" } },
          grid: { color: "#2e265c" }
        },
        y: {
          title: { display: true, text: "Sales ($)", color: "#aaa6c3", font: { size: 10, family: "Poppins" } },
          ticks: { color: "#aaa6c3", font: { family: "Poppins" } },
          grid: { color: "#2e265c" }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// 6. EXECUTIVE BUSINESS REPORT & ACTIONABLE CORRECTIONS
// -------------------------------------------------------------
async function loadBusinessReport() {
  try {
    const res = await fetch("/api/business-report");
    const data = await res.json();
    if (data.status === "success") {
      const rep = data.report || {};
      const dateEl = document.getElementById("reportDate");
      if (dateEl) dateEl.innerText = rep.generated_at;

      renderPointsToCorrect(rep.points_to_correct || []);
    }
  } catch (err) {
    console.error("Failed to load business report:", err);
  }
}

function renderPointsToCorrect(points) {
  const container = document.getElementById("pointsToCorrectContainer");
  if (!container) return;
  container.innerHTML = "";

  points.forEach((p) => {
    const div = document.createElement("div");
    div.className = "point-box bg-[#100d25] print:bg-slate-50 p-5 rounded-2xl border border-[#2e265c] print:border-slate-300 space-y-3 shadow-md";

    let sevBadge = `<span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">HIGH SEVERITY</span>`;
    if (p.severity === "Medium") {
      sevBadge = `<span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-[#f8cb46]/20 text-[#f8cb46] border border-[#f8cb46]/40">MEDIUM SEVERITY</span>`;
    }

    div.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e265c] print:border-slate-200 pb-2.5">
        <div class="flex items-center space-x-2">
          <span class="w-6 h-6 rounded-full bg-[#f8cb46] text-[#050816] flex items-center justify-center font-black text-xs">
            ${p.id}
          </span>
          <h3 class="font-bold text-white print:text-slate-900 text-sm md:text-base">${p.domain}</h3>
        </div>
        ${sevBadge}
      </div>

      <!-- Finding & Chart Evidence -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div class="bg-[#151030] print:bg-white p-3 rounded-xl border border-[#2e265c] print:border-slate-200">
          <strong class="text-rose-400 print:text-rose-700 block mb-1">
            <i class="fa-solid fa-chart-line mr-1"></i> Data Finding (From Visual Charts):
          </strong>
          <p class="text-[#f3f3f3] print:text-slate-700 leading-relaxed">${p.finding}</p>
          <div class="mt-2 text-[10px] text-[#aaa6c3] print:text-slate-500">
            <strong>Evidence:</strong> ${p.chart_evidence}
          </div>
        </div>

        <div class="bg-[#151030] print:bg-white p-3 rounded-xl border border-[#2e265c] print:border-slate-200">
          <strong class="text-[#f8cb46] print:text-amber-700 block mb-1">
            <i class="fa-solid fa-circle-notch mr-1"></i> Root Cause Diagnosis:
          </strong>
          <p class="text-[#f3f3f3] print:text-slate-700 leading-relaxed">${p.root_cause}</p>
        </div>
      </div>

      <!-- Actionable Correction & Expected ROI -->
      <div class="p-3.5 rounded-xl bg-[#151030] print:bg-emerald-50 border border-[#00cea8]/30 print:border-emerald-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="space-y-1">
          <span class="font-bold text-[#00cea8] print:text-emerald-800 flex items-center">
            <i class="fa-solid fa-bullseye mr-1.5"></i> Actionable Business Correction:
          </span>
          <p class="text-white print:text-slate-800 leading-relaxed">${p.actionable_correction}</p>
        </div>
        <div class="md:text-right shrink-0">
          <span class="text-[10px] uppercase font-bold text-[#aaa6c3] print:text-slate-600 block">Expected ROI Impact</span>
          <span class="text-xs font-black text-[#00cea8] print:text-emerald-700">${p.expected_impact}</span>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function updateSimulation() {
  const slider = document.getElementById("upliftRange");
  if (!slider) return;
  const pct = Number(slider.value);

  const label = document.getElementById("upliftPctLabel");
  if (label) label.innerText = `${pct}%`;

  const incGmv = currentTotalSales * (pct / 100);
  const incProfit = currentGrossProfit * (pct / 100);

  const gmvEl = document.getElementById("simGmvUplift");
  const profitEl = document.getElementById("simProfitUplift");

  if (gmvEl) gmvEl.innerText = `+$${incGmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (profitEl) profitEl.innerText = `+$${incProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// -------------------------------------------------------------
// 7. UPLOAD & RESET LOGIC
// -------------------------------------------------------------
async function handleFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.status === "success") {
      alert(`Success: ${data.message}`);
      initApp();
      switchTab("cleaningTab");
    } else {
      alert(`Upload Failed: ${data.message}`);
    }
  } catch (err) {
    alert("Error uploading file: " + err);
  }
}

async function handleResetData() {
  if (!confirm("Reset database to original Blinkit Grocery Dataset?")) return;

  try {
    const res = await fetch("/api/reset", { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      alert("Successfully reset to default Blinkit data.");
      initApp();
    } else {
      alert("Reset error: " + data.message);
    }
  } catch (err) {
    alert("Error resetting data: " + err);
  }
}
