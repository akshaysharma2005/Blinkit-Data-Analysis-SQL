# ⚡ Blinkit Data Analysis, SQL BI Platform & Business Diagnostics

A full-stack Business Intelligence & Data Diagnostics web application built with Python (Flask), SQLite 3.50, and Tailwind CSS + Chart.js.

The platform ingests grocery transaction datasets, automates multi-stage data cleansing, executes advanced SQL functions (Window Functions `OVER()`, Multi-table Joins, CTEs, Aggregations), visualizes metrics across 6 interactive dimensions, and generates an executive business diagnosis report with prioritized corrective actions.

---

## 🌟 Key Features

1. **Automated Data Ingestion & Cleansing Pipeline**:
   - Ingests raw grocery datasets (`8,523` transactions).
   - **Rule 1: Categorical Standardization**: Normalizes fragmented fat content variants (`'LF'`, `'low fat'` $\rightarrow$ `'Low Fat'`, `'reg'` $\rightarrow$ `'Regular'`).
   - **Rule 2: Null Imputation**: Fills `1,463` missing values in `Item Weight` using category-specific conditional mean weights.
   - **Rule 3: Sensor/Entry Repair**: Corrects `526` active inventory items with `Item Visibility = 0` (physically impossible for on-shelf inventory) using category-weighted visibility benchmarks.
   - Live side-by-side audit of `blinkit_raw` vs `blinkit_cleaned`.

2. **Advanced SQL Functions Studio**:
   - In-engine **SQLite 3.50** runner with pre-built query catalog and custom query console.
   - **Window Functions**:
     - `SUM(Sales) * 100.0 / SUM(SUM(Sales)) OVER ()` for percentage market share by outlet size.
     - `RANK() OVER (ORDER BY SUM(Sales) DESC)` and running cumulative revenue.
     - `ROW_NUMBER() OVER (PARTITION BY "Item Type" ORDER BY Sales DESC)` for top 3 best-selling items per category.
     - `NTILE(4) OVER (ORDER BY Sales DESC)` for inventory velocity quartile segmentation.
   - **Multi-Table Joins**:
     - `INNER JOIN category_benchmarks`: Calculates gross profit dollar contribution ($281.88k, 23.5% margin).
     - `LEFT JOIN outlet_benchmarks`: Compares actual sales against monthly targets and audits Quick-Commerce delivery SLA (10–18 min fulfillment).
   - Custom SQL editor with query execution timing, row count, and CSV export.

3. **Multi-Dimensional Visual Analytics**:
   - **Sales & Profit by Item Type**: Pareto 80/20 driver analysis (Fruits & Veg, Snack Foods, Household leading).
   - **Sales Share by Outlet Size**: Donut chart with window-function-calculated percentages (Medium: 42.3%, Small: 37.0%, High: 20.7%).
   - **Consumer Preference by Fat Content**: Low Fat products generate 64.7% ($776.3k) of total sales.
   - **Geographic Distribution**: Tier 3 cities lead sales ($478.1k / 39.8%), surpassing Tier 1 metro hubs ($336.4k).
   - **Outlet Vintage Curve**: Longevity curve tracking performance from 2011 to 2022.
   - **Visibility vs. Sales Scatter (Quadrant Diagnostics)**: Uncovers digital shelf clutter and over-promoted low-sales items.

4. **Executive Strategy Report & Business Corrective Action Plan**:
   - Comprehensive diagnosis derived directly from charts and SQL metrics.
   - **6 Prioritized Points to Correct in the Business** detailing Chart Evidence, Root Cause, Specific Actionable Business Corrections, and Expected Target ROI.
   - Interactive ROI Uplift simulator ($+5\%$ to $+30\%$).
   - Formatted for 1-click **Print / PDF Export**.

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/akshaysharma2005/Blinkit-Data-Analysis-SQL.git
cd Blinkit-Data-Analysis-SQL
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python3 app.py
```

Open your browser and navigate to:
```
http://127.0.0.1:5001
```

---

## 🗂️ Project Structure

```
Blinkit-Data-Analysis-SQL/
├── app.py                      # Flask backend API, SQLite connection & cleaning engine
├── Blinkit_Data_Analysis.sql   # SQL script with Window Functions, Joins & Aggregations
├── requirements.txt            # Python dependencies (flask, pandas, numpy)
├── .gitignore                  # Git ignore rules
├── data/
│   ├── BlinkIT_Grocery_Data.csv # Cleaned baseline dataset (8,523 rows)
│   ├── category_benchmarks.csv  # Target margins & strategic priorities dimension table
│   └── outlet_benchmarks.csv    # Hub SLAs & operating targets dimension table
├── static/
│   ├── css/
│   │   └── style.css           # Styling, scrollbars & print/PDF layout
│   └── js/
│       └── app.js              # State manager, Chart.js renderers, SQL runner & report engine
├── templates/
│   └── index.html              # Modern, responsive single-page dashboard UI
└── Blinkit-analysis.pbix       # Power BI analysis dashboard file
```

---

## 📊 Summary of Strategic Business Corrections

| # | Domain | Severity | Core Finding | Recommended Correction | Expected ROI Impact |
|---|---|---|---|---|---|
| **1** | **Retail Format** | `HIGH` | Grocery Stores generate only 8.7% ($104.7k) of sales across 2 outlets. | Pivot traditional Grocery Stores into 10-Min Micro Dark Stores with curated top 1,200 SKUs. | **+24% Sales Density** & SLA drop to 11 min |
| **2** | **Geographic Expansion** | `HIGH` | Tier 3 cities lead sales ($478.1k / 39.8%), far exceeding Tier 1 ($336.4k). | Direct 60% of new dark store expansion capital into Tier 2 & Tier 3 hubs where rents are 35% lower. | **+$180,000 ARR** with 14-month hub payback |
| **3** | **Category & Cold Chain** | `MEDIUM` | Seafood & Breakfast generate $<2.0\%$ of sales while taking up chilled space. | Cut low-velocity Seafood SKUs by 50%; reallocate cold storage to high-margin Snacks & Fresh Produce. | **+$35,000 Net Margin** & 12% lower spoilage |
| **4** | **Digital Merchandising** | `HIGH` | 500+ items with high UI visibility ($>0.12$) generate below-median sales. | Deploy conversion-weighted ranking: demote low-converting items; promote high-velocity Low Fat snacks. | **+8.5% Checkout Conversion** & +$60k GMV |
| **5** | **Private Label Assortment** | `MEDIUM` | Low Fat products account for 64.7% ($776.3k) of consumer grocery spend. | Launch Blinkit Private Label in Low Fat dry snacks, clean dairy, and bakery (32% margin vs 18% branded). | **Margin expansion** from 23.5% to 26.2% |
| **6** | **Operational Blueprint** | `MEDIUM` | Flagship Supermarket Type 3 (`OUT027`) delivers $345.3k (28.7% of total sales). | Replicate `OUT027` layout, batch-picking routes, and cold-storage SOPs across all satellite outlets. | **+19% Pick-Pack Dispatch Efficiency** |
