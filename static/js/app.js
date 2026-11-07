// Blinkit Analytics & SQL Studio JavaScript Engine

let charts = {};
let currentSqlResult = null;
let currentTotalSales = 1201681.72;
let currentGrossProfit = 281879.12;

document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupEventListeners();
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

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(el => {
    el.classList.remove("active-tab");
    el.classList.add("border-transparent", "text-slate-400");
  });

  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.remove("hidden");
  }

  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add("active-tab");
    activeBtn.classList.remove("border-transparent", "text-slate-400");
  }

  // Trigger chart resize if switching to dashboard
  if (tabId === "dashboardTab") {
    setTimeout(() => {
      Object.values(charts).forEach(chart => chart?.resize());
    }, 100);
  }
}

// -------------------------------------------------------------
// 1. KPI LOADER
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
// 2. DATA CLEANING STATS & LIVE COMPARISON
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
    tr.className = "hover:bg-slate-900/50 transition";
    tr.innerHTML = `
      <td class="py-2 px-2 text-amber-300">${r['Item Identifier'] || '-'}</td>
      <td class="py-2 px-2">${r['Item Fat Content'] || '-'}</td>
      <td class="py-2 px-2 text-slate-300">${r['Item Weight'] !== null ? r['Item Weight'] : '<span class="text-rose-400 font-bold">NULL</span>'}</td>
      <td class="py-2 px-2 ${Number(r['Item Visibility']) === 0 ? 'text-rose-400 font-bold' : ''}">${r['Item Visibility'] !== null ? r['Item Visibility'] : '-'}</td>
      <td class="py-2 px-2 font-semibold text-emerald-400">$${Number(r['Sales'] || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// 3. SQL TEMPLATES & CONSOLE
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
    div.className = "query-card p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer text-xs space-y-1";
    div.onclick = () => selectQueryTemplate(t.id);

    let badgeColor = "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
    if (t.category.includes("Window")) badgeColor = "bg-amber-400/10 text-amber-300 border-amber-400/20";
    if (t.category.includes("Join")) badgeColor = "bg-sky-400/10 text-sky-300 border-sky-400/20";
    if (t.category.includes("Anomaly")) badgeColor = "bg-rose-400/10 text-rose-300 border-rose-400/20";

    div.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">${t.category}</span>
        <i class="fa-solid fa-arrow-up-right-from-square text-slate-500 hover:text-white transition"></i>
      </div>
      <div class="font-bold text-slate-200 mt-1">${t.title}</div>
      <div class="text-[11px] text-slate-400 line-clamp-2">${t.description}</div>
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

  statusText.innerText = "Executing query against SQLite...";
  statusText.className = "text-amber-400 animate-pulse text-xs";

  try {
    const res = await fetch("/api/execute-sql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const data = await res.json();

    if (data.status === "success") {
      statusText.innerText = "Execution completed successfully";
      statusText.className = "text-emerald-400 text-xs font-semibold";
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
    th.className = "py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800 text-slate-300";
    th.innerText = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="py-4 text-center text-slate-500 italic">Zero rows returned.</td></tr>`;
    return;
  }

  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.className = i % 2 === 0 ? "bg-slate-950 hover:bg-slate-900" : "bg-slate-900/50 hover:bg-slate-900";
    row.forEach(val => {
      const td = document.createElement("td");
      td.className = "py-2 px-3 border-b border-slate-800/40";
      if (typeof val === "number") {
        td.className += " font-mono text-emerald-400";
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
      <td class="p-4 text-rose-300 font-mono text-xs bg-rose-950/20 border border-rose-900/40 rounded-lg">
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
      copyBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i>';
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
// 4. CHART.JS VISUAL ANALYTICS
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
          backgroundColor: "#F8CB46",
          borderRadius: 6
        },
        {
          label: "Est. Gross Profit ($)",
          data: profits,
          backgroundColor: "#10B981",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#64748b", font: { size: 9 }, maxRotation: 45, minRotation: 45 },
          grid: { color: "#1e293b" }
        },
        y: {
          ticks: {
            color: "#64748b",
            font: { size: 10 },
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#1e293b" }
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
        backgroundColor: ["#10B981", "#F8CB46", "#38BDF8"],
        borderColor: "#1e293b",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#94a3b8", font: { size: 11 } }
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
        backgroundColor: ["#38BDF8", "#F43F5E"],
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
        x: { ticks: { color: "#cbd5e1" }, grid: { display: false } },
        y: {
          ticks: {
            color: "#64748b",
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#1e293b" }
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
  const items = data.map(d => d.item_count);

  charts.location = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Total Sales ($)",
          data: sales,
          backgroundColor: "#818CF8",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Sales: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { display: false } },
        y: {
          ticks: {
            color: "#64748b",
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#1e293b" }
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
          borderColor: "#F8CB46",
          backgroundColor: "rgba(248, 203, 70, 0.15)",
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#F8CB46",
          pointRadius: 4
        },
        {
          label: "Cumulative Revenue ($)",
          data: cumulative,
          borderColor: "#10B981",
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
        legend: { labels: { color: "#94a3b8" } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "#1e293b" } },
        y: {
          ticks: {
            color: "#64748b",
            callback: (v) => "$" + (v / 1000) + "k"
          },
          grid: { color: "#1e293b" }
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
        backgroundColor: "rgba(45, 212, 191, 0.6)",
        borderColor: "#14B8A6",
        pointRadius: 3.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } },
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
          title: { display: true, text: "Item Visibility Ratio", color: "#64748b", font: { size: 10 } },
          ticks: { color: "#64748b" },
          grid: { color: "#1e293b" }
        },
        y: {
          title: { display: true, text: "Sales ($)", color: "#64748b", font: { size: 10 } },
          ticks: { color: "#64748b" },
          grid: { color: "#1e293b" }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// 5. EXECUTIVE BUSINESS REPORT & ACTIONABLE CORRECTIONS
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

  points.forEach((p, idx) => {
    const div = document.createElement("div");
    div.className = "point-box bg-slate-900/90 print:bg-slate-50 p-5 rounded-xl border border-slate-700/80 print:border-slate-300 space-y-3";

    let sevBadge = `<span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">HIGH SEVERITY</span>`;
    if (p.severity === "Medium") {
      sevBadge = `<span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">MEDIUM SEVERITY</span>`;
    }

    div.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 print:border-slate-200 pb-2.5">
        <div class="flex items-center space-x-2">
          <span class="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs">
            ${p.id}
          </span>
          <h3 class="font-bold text-slate-100 print:text-slate-900 text-sm md:text-base">${p.domain}</h3>
        </div>
        ${sevBadge}
      </div>

      <!-- Finding & Chart Evidence -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div class="bg-slate-950/70 print:bg-white p-3 rounded-lg border border-slate-800/80 print:border-slate-200">
          <strong class="text-rose-400 print:text-rose-700 block mb-1">
            <i class="fa-solid fa-chart-line mr-1"></i> Data Finding (From Visual Charts):
          </strong>
          <p class="text-slate-300 print:text-slate-700 leading-relaxed">${p.finding}</p>
          <div class="mt-2 text-[10px] text-slate-500 print:text-slate-500">
            <strong>Evidence:</strong> ${p.chart_evidence}
          </div>
        </div>

        <div class="bg-slate-950/70 print:bg-white p-3 rounded-lg border border-slate-800/80 print:border-slate-200">
          <strong class="text-amber-400 print:text-amber-700 block mb-1">
            <i class="fa-solid fa-circle-notch mr-1"></i> Root Cause Diagnosis:
          </strong>
          <p class="text-slate-300 print:text-slate-700 leading-relaxed">${p.root_cause}</p>
        </div>
      </div>

      <!-- Actionable Correction & Expected ROI -->
      <div class="p-3.5 rounded-lg bg-emerald-950/30 print:bg-emerald-50 border border-emerald-800/40 print:border-emerald-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="space-y-1">
          <span class="font-bold text-emerald-400 print:text-emerald-800 flex items-center">
            <i class="fa-solid fa-bullseye mr-1.5"></i> Actionable Business Correction:
          </span>
          <p class="text-slate-200 print:text-slate-800 leading-relaxed">${p.actionable_correction}</p>
        </div>
        <div class="md:text-right shrink-0">
          <span class="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block">Expected ROI Impact</span>
          <span class="text-xs font-black text-emerald-400 print:text-emerald-700">${p.expected_impact}</span>
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
// 6. UPLOAD & RESET LOGIC
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

