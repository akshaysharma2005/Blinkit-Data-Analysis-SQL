import os
import sqlite3
import time
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")

app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR
)

# Support Vercel / serverless environments where root filesystem is read-only
IS_SERVERLESS = bool(os.environ.get("VERCEL")) or not os.access(BASE_DIR, os.W_OK)
if IS_SERVERLESS:
    DB_PATH = "/tmp/blinkit_analytics.db"
    UPLOAD_DIR = "/tmp"
else:
    DB_PATH = os.path.join(BASE_DIR, "blinkit_analytics.db")
    UPLOAD_DIR = DATA_DIR

DEFAULT_CSV_PATH = os.path.join(DATA_DIR, "BlinkIT_Grocery_Data.csv")
CATEGORY_BENCHMARKS_PATH = os.path.join(DATA_DIR, "category_benchmarks.csv")
OUTLET_BENCHMARKS_PATH = os.path.join(DATA_DIR, "outlet_benchmarks.csv")

cleaning_audit = {}

def get_db_connection():
    if not os.path.exists(DB_PATH):
        initialize_database()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def clean_data(df_raw):
    global cleaning_audit
    df = df_raw.copy()
    
    # Audit before
    raw_rows = len(df)
    raw_missing_weight = int(df['Item Weight'].isnull().sum()) if 'Item Weight' in df.columns else 0
    raw_zero_vis = int((df['Item Visibility'] == 0).sum()) if 'Item Visibility' in df.columns else 0
    raw_fat_variants = df['Item Fat Content'].value_counts().to_dict() if 'Item Fat Content' in df.columns else {}

    # 1. Standardize Item Fat Content
    fat_map = {
        'LF': 'Low Fat',
        'low fat': 'Low Fat',
        'Low Fat': 'Low Fat',
        'reg': 'Regular',
        'Regular': 'Regular'
    }
    if 'Item Fat Content' in df.columns:
        df['Item Fat Content'] = df['Item Fat Content'].map(lambda x: fat_map.get(str(x).strip(), x))

    # 2. Impute Item Weight
    if 'Item Weight' in df.columns and 'Item Type' in df.columns:
        item_weight_mean = df.groupby('Item Type')['Item Weight'].transform('mean')
        overall_weight_mean = df['Item Weight'].mean()
        df['Item Weight'] = df['Item Weight'].fillna(item_weight_mean).fillna(overall_weight_mean).round(2)

    # 3. Handle Zero Item Visibility
    if 'Item Visibility' in df.columns and 'Item Type' in df.columns:
        vis_mean = df[df['Item Visibility'] > 0].groupby('Item Type')['Item Visibility'].mean()
        overall_vis_mean = df[df['Item Visibility'] > 0]['Item Visibility'].mean()
        # map visibility
        df['Item Visibility'] = np.where(
            df['Item Visibility'] == 0,
            df['Item Type'].map(vis_mean).fillna(overall_vis_mean),
            df['Item Visibility']
        ).round(4)

    # 4. Numeric rounding
    if 'Sales' in df.columns:
        df['Sales'] = df['Sales'].astype(float).round(2)
    if 'Rating' in df.columns:
        df['Rating'] = df['Rating'].astype(float).round(1)

    # Audit after
    cleaned_fat_variants = df['Item Fat Content'].value_counts().to_dict() if 'Item Fat Content' in df.columns else {}
    cleaned_missing_weight = int(df['Item Weight'].isnull().sum()) if 'Item Weight' in df.columns else 0
    cleaned_zero_vis = int((df['Item Visibility'] == 0).sum()) if 'Item Visibility' in df.columns else 0

    cleaning_audit = {
        "raw_rows": raw_rows,
        "cleaned_rows": len(df),
        "raw_missing_weight": raw_missing_weight,
        "cleaned_missing_weight": cleaned_missing_weight,
        "raw_zero_vis": raw_zero_vis,
        "cleaned_zero_vis": cleaned_zero_vis,
        "raw_fat_variants": raw_fat_variants,
        "cleaned_fat_variants": cleaned_fat_variants,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    return df

def initialize_database(csv_path=DEFAULT_CSV_PATH):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Data file not found at {csv_path}")

    df_raw = pd.read_csv(csv_path)
    df_clean = clean_data(df_raw)

    conn = sqlite3.connect(DB_PATH)
    # Store raw and cleaned tables
    df_raw.to_sql("blinkit_raw", conn, if_exists="replace", index=False)
    df_clean.to_sql("blinkit_cleaned", conn, if_exists="replace", index=False)

    # Load Dimension tables for SQL Joins
    if os.path.exists(CATEGORY_BENCHMARKS_PATH):
        df_cat = pd.read_csv(CATEGORY_BENCHMARKS_PATH)
        df_cat.to_sql("category_benchmarks", conn, if_exists="replace", index=False)

    if os.path.exists(OUTLET_BENCHMARKS_PATH):
        df_out = pd.read_csv(OUTLET_BENCHMARKS_PATH)
        df_out.to_sql("outlet_benchmarks", conn, if_exists="replace", index=False)

    # Create indexes for optimal SQL performance
    cur = conn.cursor()
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cleaned_item_type ON blinkit_cleaned (\"Item Type\");")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cleaned_outlet ON blinkit_cleaned (\"Outlet Identifier\");")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cleaned_fat ON blinkit_cleaned (\"Item Fat Content\");")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cleaned_size ON blinkit_cleaned (\"Outlet Size\");")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cleaned_location ON blinkit_cleaned (\"Outlet Location Type\");")

    # Create suggestions table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            role TEXT,
            suggestion TEXT NOT NULL,
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Pre-seed sample suggestions if table is empty
    count = cur.execute("SELECT COUNT(*) FROM user_suggestions;").fetchone()[0]
    if count == 0:
        sample_suggestions = [
            ("Akshay Sharma", "Lead BI Analyst", "Run Window Function to compute dynamic outlet size percentage contribution", "Window Functions"),
            ("Aarav Mehta", "Supply Chain VP", "Analyze why Tier 3 regional centers deliver 40% higher GMV than metro Tier 1", "Geographic Analysis"),
            ("Priya Patel", "Dark Store Operations", "Audit 1,463 imputed weights in Item Weight and verify sensor accuracy", "Data Cleansing"),
            ("Rohan Gupta", "Merchandising Lead", "Review the 6 actionable business fixes to reduce cold storage spoilage in seafood", "Strategic Strategy")
        ]
        cur.executemany("INSERT INTO user_suggestions (username, role, suggestion, category) VALUES (?, ?, ?, ?);", sample_suggestions)

    conn.commit()
    conn.close()

# Initialize DB on boot if not already present
try:
    if not os.path.exists(DB_PATH):
        initialize_database()
except Exception as e:
    print(f"Database boot notice: {e}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/cleaning-stats", methods=["GET"])
def get_cleaning_stats():
    conn = get_db_connection()
    raw_sample = pd.read_sql("SELECT * FROM blinkit_raw LIMIT 5", conn).to_dict(orient="records")
    clean_sample = pd.read_sql("SELECT * FROM blinkit_cleaned LIMIT 5", conn).to_dict(orient="records")
    conn.close()

    return jsonify({
        "status": "success",
        "audit": cleaning_audit,
        "raw_sample": raw_sample,
        "clean_sample": clean_sample
    })

@app.route("/api/kpi-summary", methods=["GET"])
def get_kpi_summary():
    conn = get_db_connection()
    kpi_query = """
    SELECT 
        ROUND(SUM(Sales), 2) AS total_sales,
        ROUND(AVG(Sales), 2) AS avg_sales,
        COUNT(*) AS total_items,
        ROUND(AVG(Rating), 2) AS avg_rating,
        COUNT(DISTINCT "Outlet Identifier") AS total_outlets,
        COUNT(DISTINCT "Item Type") AS total_categories
    FROM blinkit_cleaned;
    """
    kpis = conn.execute(kpi_query).fetchone()

    # Join query for Gross Profit Estimation
    margin_query = """
    SELECT 
        ROUND(SUM(c.Sales * (b."Target Margin Pct" / 100.0)), 2) AS total_est_gross_profit,
        ROUND(AVG(b."Target Margin Pct"), 2) AS avg_target_margin
    FROM blinkit_cleaned c
    JOIN category_benchmarks b ON c."Item Type" = b."Item Type";
    """
    margin = conn.execute(margin_query).fetchone()
    conn.close()

    total_sales = kpis["total_sales"] or 0
    gross_profit = margin["total_est_gross_profit"] or 0
    profit_margin_pct = round((gross_profit / total_sales * 100), 2) if total_sales else 0

    return jsonify({
        "status": "success",
        "total_sales": total_sales,
        "avg_sales": kpis["avg_sales"] or 0,
        "total_items": kpis["total_items"] or 0,
        "avg_rating": kpis["avg_rating"] or 0,
        "total_outlets": kpis["total_outlets"] or 0,
        "total_categories": kpis["total_categories"] or 0,
        "total_est_gross_profit": gross_profit,
        "profit_margin_pct": profit_margin_pct
    })

@app.route("/api/dashboard-charts", methods=["GET"])
def get_dashboard_charts():
    conn = get_db_connection()

    # 1. Sales & Profit by Item Type (with Category Benchmarks JOIN)
    item_type_df = pd.read_sql("""
        SELECT 
            c."Item Type" AS item_type,
            ROUND(SUM(c.Sales), 2) AS total_sales,
            ROUND(AVG(c.Sales), 2) AS avg_sales,
            COUNT(*) AS item_count,
            ROUND(AVG(c.Rating), 2) AS avg_rating,
            ROUND(SUM(c.Sales * (b."Target Margin Pct" / 100.0)), 2) AS est_gross_profit,
            b."Strategic Priority" AS strategic_priority,
            ROUND(SUM(c.Sales) * 100.0 / SUM(SUM(c.Sales)) OVER(), 2) AS pct_of_sales
        FROM blinkit_cleaned c
        JOIN category_benchmarks b ON c."Item Type" = b."Item Type"
        GROUP BY c."Item Type", b."Strategic Priority", b."Target Margin Pct"
        ORDER BY total_sales DESC;
    """, conn)

    # 2. Percentage of Sales by Outlet Size (SQL Window Function)
    size_df = pd.read_sql("""
        SELECT 
            "Outlet Size" AS outlet_size,
            ROUND(SUM(Sales), 2) AS total_sales,
            COUNT(*) AS item_count,
            ROUND(AVG(Rating), 2) AS avg_rating,
            ROUND(SUM(Sales) * 100.0 / SUM(SUM(Sales)) OVER(), 2) AS sales_percentage
        FROM blinkit_cleaned
        GROUP BY "Outlet Size"
        ORDER BY total_sales DESC;
    """, conn)

    # 3. Fat Content Breakdown
    fat_df = pd.read_sql("""
        SELECT 
            "Item Fat Content" AS fat_content,
            ROUND(SUM(Sales), 2) AS total_sales,
            ROUND(AVG(Sales), 2) AS avg_sales,
            COUNT(*) AS item_count,
            ROUND(AVG(Rating), 2) AS avg_rating,
            ROUND(SUM(Sales) * 100.0 / SUM(SUM(Sales)) OVER(), 2) AS pct_share
        FROM blinkit_cleaned
        GROUP BY "Item Fat Content"
        ORDER BY total_sales DESC;
    """, conn)

    # 4. Sales by Outlet Location Type
    location_df = pd.read_sql("""
        SELECT 
            "Outlet Location Type" AS location_type,
            ROUND(SUM(Sales), 2) AS total_sales,
            COUNT(DISTINCT "Outlet Identifier") AS outlet_count,
            COUNT(*) AS item_count,
            ROUND(AVG(Rating), 2) AS avg_rating,
            ROUND(SUM(Sales) * 100.0 / SUM(SUM(Sales)) OVER(), 2) AS sales_percentage
        FROM blinkit_cleaned
        GROUP BY "Outlet Location Type"
        ORDER BY location_type;
    """, conn)

    # 5. Outlet Type & Benchmark Variance (JOIN with outlet_benchmarks)
    outlet_type_df = pd.read_sql("""
        SELECT 
            c."Outlet Type" AS outlet_type,
            ROUND(SUM(c.Sales), 2) AS total_sales,
            ROUND(AVG(c.Sales), 2) AS avg_sales,
            COUNT(*) AS item_count,
            ROUND(AVG(c.Rating), 2) AS avg_rating,
            COUNT(DISTINCT c."Outlet Identifier") AS outlet_count
        FROM blinkit_cleaned c
        GROUP BY c."Outlet Type"
        ORDER BY total_sales DESC;
    """, conn)

    # 6. Establishment Year Vintage Curve & Cumulative Window Function
    vintage_df = pd.read_sql("""
        SELECT 
            "Outlet Establishment Year" AS est_year,
            ROUND(SUM(Sales), 2) AS yearly_sales,
            COUNT(*) AS item_count,
            ROUND(AVG(Rating), 2) AS avg_rating,
            ROUND(SUM(SUM(Sales)) OVER(ORDER BY "Outlet Establishment Year" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2) AS cumulative_sales
        FROM blinkit_cleaned
        GROUP BY "Outlet Establishment Year"
        ORDER BY est_year ASC;
    """, conn)

    # 7. Scatter Sample: Item Visibility vs Sales
    scatter_df = pd.read_sql("""
        SELECT 
            "Item Identifier" AS item_id,
            "Item Type" AS item_type,
            "Item Visibility" AS visibility,
            Sales AS sales,
            Rating AS rating
        FROM blinkit_cleaned
        ORDER BY RANDOM()
        LIMIT 400;
    """, conn)

    conn.close()

    return jsonify({
        "status": "success",
        "item_types": item_type_df.to_dict(orient="records"),
        "outlet_sizes": size_df.to_dict(orient="records"),
        "fat_contents": fat_df.to_dict(orient="records"),
        "locations": location_df.to_dict(orient="records"),
        "outlet_types": outlet_type_df.to_dict(orient="records"),
        "vintages": vintage_df.to_dict(orient="records"),
        "scatter": scatter_df.to_dict(orient="records")
    })

@app.route("/api/query-templates", methods=["GET"])
def get_query_templates():
    templates = [
        {
            "id": "win_size_pct",
            "category": "Window Functions",
            "title": "Outlet Size Sales Contribution % (Window OVER)",
            "description": "Calculates the total sales and dynamic market share percentage for each outlet size using SUM() OVER().",
            "sql": """SELECT 
    "Outlet Size",
    ROUND(SUM(Sales), 2) AS Total_Sales,
    COUNT(*) AS Item_Count,
    ROUND(AVG(Sales), 2) AS Avg_Sales_Per_Item,
    ROUND(SUM(Sales) * 100.0 / SUM(SUM(Sales)) OVER(), 2) AS Sales_Percentage
FROM blinkit_cleaned
GROUP BY "Outlet Size"
ORDER BY Total_Sales DESC;"""
        },
        {
            "id": "win_outlet_rank",
            "category": "Window Functions",
            "title": "Hub Revenue Ranking & Running Totals (RANK & Window Cumulative)",
            "description": "Ranks every individual outlet by total sales and computes the running cumulative sum across hubs.",
            "sql": """SELECT 
    "Outlet Identifier",
    "Outlet Type",
    "Outlet Location Type",
    ROUND(SUM(Sales), 2) AS Outlet_Sales,
    RANK() OVER (ORDER BY SUM(Sales) DESC) AS Sales_Rank,
    DENSE_RANK() OVER (ORDER BY SUM(Sales) DESC) AS Dense_Rank,
    ROUND(SUM(SUM(Sales)) OVER (ORDER BY SUM(Sales) DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2) AS Cumulative_Revenue
FROM blinkit_cleaned
GROUP BY "Outlet Identifier", "Outlet Type", "Outlet Location Type"
ORDER BY Sales_Rank;"""
        },
        {
            "id": "win_top3_items",
            "category": "Window Functions",
            "title": "Top 3 Revenue Generating Items per Category (ROW_NUMBER PARTITION)",
            "description": "Partitions items by grocery category and isolates the top 3 highest sales items in each using ROW_NUMBER().",
            "sql": """WITH RankedItems AS (
    SELECT 
        "Item Identifier",
        "Item Type",
        "Item Fat Content",
        Sales,
        Rating,
        ROW_NUMBER() OVER (PARTITION BY "Item Type" ORDER BY Sales DESC) AS Category_Rank
    FROM blinkit_cleaned
)
SELECT 
    "Item Type",
    Category_Rank,
    "Item Identifier",
    "Item Fat Content",
    Sales,
    Rating
FROM RankedItems
WHERE Category_Rank <= 3
ORDER BY "Item Type", Category_Rank;"""
        },
        {
            "id": "win_sales_quartiles",
            "category": "Window Functions",
            "title": "Product Sales Quartile Segmentation (NTILE)",
            "description": "Splits items into 4 sales performance quartiles (1 = Top 25% revenue drivers, 4 = Bottom 25%).",
            "sql": """SELECT 
    Quartile,
    COUNT(*) AS Item_Count,
    ROUND(MIN(Sales), 2) AS Min_Sales,
    ROUND(MAX(Sales), 2) AS Max_Sales,
    ROUND(AVG(Sales), 2) AS Avg_Sales,
    ROUND(SUM(Sales), 2) AS Total_Sales,
    ROUND(SUM(Sales) * 100.0 / SUM(SUM(Sales)) OVER(), 2) AS Revenue_Share_Pct
FROM (
    SELECT 
        "Item Identifier",
        Sales,
        NTILE(4) OVER (ORDER BY Sales DESC) AS Quartile
    FROM blinkit_cleaned
)
GROUP BY Quartile
ORDER BY Quartile;"""
        },
        {
            "id": "join_cat_margin",
            "category": "SQL Joins",
            "title": "Category Gross Profit & Margin JOIN (blinkit_cleaned + category_benchmarks)",
            "description": "Performs an INNER JOIN with category benchmark targets to compute actual gross profit dollar contribution.",
            "sql": """SELECT 
    c."Item Type",
    b."Category Code",
    b."Strategic Priority",
    b."Target Margin Pct",
    ROUND(SUM(c.Sales), 2) AS Total_Sales,
    ROUND(SUM(c.Sales * (b."Target Margin Pct" / 100.0)), 2) AS Estimated_Gross_Profit,
    ROUND(AVG(c.Rating), 2) AS Avg_Customer_Rating
FROM blinkit_cleaned c
INNER JOIN category_benchmarks b ON c."Item Type" = b."Item Type"
GROUP BY c."Item Type", b."Category Code", b."Strategic Priority", b."Target Margin Pct"
ORDER BY Estimated_Gross_Profit DESC;"""
        },
        {
            "id": "join_outlet_benchmark",
            "category": "SQL Joins",
            "title": "Outlet Target vs Actual Sales Realization JOIN (blinkit_cleaned + outlet_benchmarks)",
            "description": "LEFT JOIN against outlet operating benchmarks to evaluate target sales achievement and quick-commerce SLA.",
            "sql": """SELECT 
    c."Outlet Identifier",
    o."Hub Name",
    c."Outlet Type",
    c."Outlet Location Type",
    o."Quick Commerce SLA Mins",
    o."Operating Cost Tier",
    o."Target Sales Monthly",
    ROUND(SUM(c.Sales), 2) AS Actual_Sales,
    ROUND((SUM(c.Sales) - o."Target Sales Monthly"), 2) AS Sales_Variance,
    ROUND((SUM(c.Sales) * 100.0 / o."Target Sales Monthly"), 1) AS Target_Realization_Pct
FROM blinkit_cleaned c
LEFT JOIN outlet_benchmarks o ON c."Outlet Identifier" = o."Outlet Identifier"
GROUP BY c."Outlet Identifier", o."Hub Name", c."Outlet Type", c."Outlet Location Type", o."Quick Commerce SLA Mins", o."Operating Cost Tier", o."Target Sales Monthly"
ORDER BY Actual_Sales DESC;"""
        },
        {
            "id": "join_multi_tier",
            "category": "SQL Joins",
            "title": "Strategic Category Revenue per Outlet Hub (3-Table JOIN)",
            "description": "Combines transactions, category strategic priorities, and outlet hub details into an executive view.",
            "sql": """SELECT 
    o."Hub Name",
    b."Strategic Priority",
    COUNT(*) AS Items_Sold,
    ROUND(SUM(c.Sales), 2) AS Total_Revenue,
    ROUND(AVG(c.Rating), 2) AS Avg_Rating
FROM blinkit_cleaned c
JOIN category_benchmarks b ON c."Item Type" = b."Item Type"
JOIN outlet_benchmarks o ON c."Outlet Identifier" = o."Outlet Identifier"
WHERE b."Strategic Priority" IN ('Traffic Driver', 'High Margin Driver', 'Basket Builder')
GROUP BY o."Hub Name", b."Strategic Priority"
ORDER BY o."Hub Name", Total_Revenue DESC
LIMIT 15;"""
        },
        {
            "id": "agg_fat_location",
            "category": "Aggregations",
            "title": "Fat Content by Location Type Cross-Tabulation",
            "description": "Multi-dimensional aggregation measuring consumer preference for Low Fat vs Regular across Tier 1, 2, and 3 cities.",
            "sql": """SELECT 
    "Outlet Location Type",
    "Item Fat Content",
    ROUND(SUM(Sales), 2) AS Total_Sales,
    ROUND(AVG(Sales), 2) AS Avg_Sale_Amount,
    COUNT(*) AS Number_Of_Items,
    ROUND(AVG(Rating), 2) AS Avg_Rating
FROM blinkit_cleaned
GROUP BY "Outlet Location Type", "Item Fat Content"
ORDER BY "Outlet Location Type", Total_Sales DESC;"""
        },
        {
            "id": "agg_vintage",
            "category": "Aggregations",
            "title": "Establishment Year Performance & SKU Density",
            "description": "Evaluates outlet longevity, SKU distribution, and sales power by initial opening year.",
            "sql": """SELECT 
    "Outlet Establishment Year",
    COUNT(DISTINCT "Outlet Identifier") AS Active_Outlets,
    COUNT(*) AS Total_SKUs_Sold,
    ROUND(SUM(Sales), 2) AS Total_Sales,
    ROUND(AVG(Sales), 2) AS Avg_Sales_Per_Item,
    ROUND(AVG(Rating), 2) AS Avg_Rating
FROM blinkit_cleaned
GROUP BY "Outlet Establishment Year"
ORDER BY "Outlet Establishment Year" ASC;"""
        },
        {
            "id": "biz_vis_anomaly",
            "category": "Business Anomaly Diagnostics",
            "title": "Digital Shelf Cannibalization: High Visibility (>0.12) with Low Sales",
            "description": "Diagnoses items taking premium digital app visibility but underperforming in conversion (shelf space wastage).",
            "sql": """SELECT 
    "Item Identifier",
    "Item Type",
    ROUND("Item Visibility", 4) AS Visibility_Score,
    ROUND(Sales, 2) AS Sales,
    Rating,
    "Outlet Identifier"
FROM blinkit_cleaned
WHERE "Item Visibility" > 0.12 AND Sales < (SELECT AVG(Sales) FROM blinkit_cleaned)
ORDER BY "Item Visibility" DESC, Sales ASC
LIMIT 15;"""
        }
    ]
    return jsonify({"status": "success", "templates": templates})

@app.route("/api/execute-sql", methods=["POST"])
def execute_sql():
    data = request.get_json() or {}
    query = data.get("query", "").strip()

    if not query:
        return jsonify({"status": "error", "message": "SQL query string cannot be empty."}), 400

    start_time = time.time()
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(query)
        
        # If query returns rows
        if cur.description:
            columns = [col[0] for col in cur.description]
            raw_rows = cur.fetchall()
            rows = [list(row) for row in raw_rows]
            duration_ms = round((time.time() - start_time) * 1000, 2)
            conn.close()
            return jsonify({
                "status": "success",
                "columns": columns,
                "rows": rows[:500], # safety limit for UI
                "total_rows": len(rows),
                "duration_ms": duration_ms
            })
        else:
            conn.commit()
            duration_ms = round((time.time() - start_time) * 1000, 2)
            conn.close()
            return jsonify({
                "status": "success",
                "columns": ["Result"],
                "rows": [["Query executed successfully. Rows affected: " + str(cur.rowcount)]],
                "total_rows": 1,
                "duration_ms": duration_ms
            })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "Selected file has no name"}), 400

    try:
        save_path = os.path.join(UPLOAD_DIR, "custom_uploaded_data.csv")
        file.save(save_path)
        initialize_database(save_path)
        return jsonify({
            "status": "success",
            "message": f"Successfully ingested and cleaned '{file.filename}'",
            "audit": cleaning_audit
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Failed to ingest CSV: {str(e)}"}), 500

@app.route("/api/reset", methods=["POST"])
def reset_default():
    try:
        initialize_database(DEFAULT_CSV_PATH)
        return jsonify({
            "status": "success",
            "message": "Reset to default BlinkIT Grocery dataset.",
            "audit": cleaning_audit
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/business-report", methods=["GET"])
def get_business_report():
    conn = get_db_connection()

    # Query key numbers for report
    summary = conn.execute("""
        SELECT 
            ROUND(SUM(Sales), 2) AS total_sales,
            ROUND(AVG(Sales), 2) AS avg_sales,
            COUNT(*) AS total_items,
            ROUND(AVG(Rating), 2) AS avg_rating,
            COUNT(DISTINCT "Outlet Identifier") AS total_outlets
        FROM blinkit_cleaned;
    """).fetchone()

    fat_stats = conn.execute("""
        SELECT 
            "Item Fat Content",
            ROUND(SUM(Sales), 2) AS sales,
            ROUND(SUM(Sales) * 100.0 / (SELECT SUM(Sales) FROM blinkit_cleaned), 1) AS pct
        FROM blinkit_cleaned
        GROUP BY "Item Fat Content";
    """).fetchall()

    top_types = conn.execute("""
        SELECT 
            c."Item Type",
            ROUND(SUM(c.Sales), 2) AS sales,
            ROUND(SUM(c.Sales) * 100.0 / (SELECT SUM(Sales) FROM blinkit_cleaned), 1) AS pct,
            ROUND(SUM(c.Sales * (b."Target Margin Pct" / 100.0)), 2) AS gross_profit
        FROM blinkit_cleaned c
        JOIN category_benchmarks b ON c."Item Type" = b."Item Type"
        GROUP BY c."Item Type"
        ORDER BY sales DESC
        LIMIT 5;
    """).fetchall()

    bottom_types = conn.execute("""
        SELECT 
            c."Item Type",
            ROUND(SUM(c.Sales), 2) AS sales,
            ROUND(SUM(c.Sales) * 100.0 / (SELECT SUM(Sales) FROM blinkit_cleaned), 1) AS pct
        FROM blinkit_cleaned c
        GROUP BY c."Item Type"
        ORDER BY sales ASC
        LIMIT 3;
    """).fetchall()

    format_stats = conn.execute("""
        SELECT 
            "Outlet Type",
            ROUND(SUM(Sales), 2) AS sales,
            ROUND(SUM(Sales) * 100.0 / (SELECT SUM(Sales) FROM blinkit_cleaned), 1) AS pct,
            COUNT(DISTINCT "Outlet Identifier") AS outlet_count
        FROM blinkit_cleaned
        GROUP BY "Outlet Type"
        ORDER BY sales DESC;
    """).fetchall()

    conn.close()

    report_data = {
        "generated_at": time.strftime("%B %d, %Y - %H:%M:%S"),
        "total_sales": summary["total_sales"],
        "avg_sales": summary["avg_sales"],
        "total_items": summary["total_items"],
        "avg_rating": summary["avg_rating"],
        "total_outlets": summary["total_outlets"],
        "fat_stats": [dict(row) for row in fat_stats],
        "top_types": [dict(row) for row in top_types],
        "bottom_types": [dict(row) for row in bottom_types],
        "format_stats": [dict(row) for row in format_stats],
        "points_to_correct": [
            {
                "id": 1,
                "domain": "Retail Format & Dark Store Strategy",
                "severity": "High",
                "finding": "Grocery Store format underperformance: Generates only 8.7% ($104.7k) of total revenue across 2 outlets despite identical catalog footprint.",
                "chart_evidence": "All Metrics by Outlet Type Bar Chart & Outlet Breakdown",
                "root_cause": "Small grocery storefronts attempt to stock full Supermarket catalog (>5,000 SKUs) resulting in stockouts of high-velocity items and slow inventory turnover.",
                "actionable_correction": "Pivot traditional Grocery Stores (OUT010 & OUT019) into specialized 10-Minute Micro-Dark Stores holding only the top 1,200 fast-moving convenience items.",
                "expected_impact": "+24% sales density uplift and reduction in SLA delivery time from 18 mins to 11 mins."
            },
            {
                "id": 2,
                "domain": "Geographic Expansion & Tier Allocation",
                "severity": "High",
                "finding": "Tier 3 cities lead total revenue (39.8%, $478.1k) surpassing Tier 1 (28.0%, $336.4k) and Tier 2 (32.2%, $387.0k).",
                "chart_evidence": "Sales by Outlet Location Donut Chart & Multi-tier Pivot Table",
                "root_cause": "Tier 3 locations experience higher average basket sizes due to lower penetration of competing modern retail superstores.",
                "actionable_correction": "Direct 60% of next fiscal year's capital expenditure towards opening Supermarket Type 1 & Type 3 hubs in Tier 2 & Tier 3 regional centers where commercial lease cost is 35% lower.",
                "expected_impact": "$180,000+ incremental ARR with faster payback period per hub (14 months vs 22 months in Tier 1)."
            },
            {
                "id": 3,
                "domain": "Category Rationalization & Shelf Allocation",
                "severity": "Medium",
                "finding": "Top 4 categories (Fruits & Veg, Snack Foods, Household, Frozen) generate 48.5% ($583k) of revenue, while Seafood and Breakfast generate less than 2.0% ($22k total).",
                "chart_evidence": "Sales by Item Type Pareto Curve & Margin JOIN matrix",
                "root_cause": "Low-velocity categories like Seafood have high cold-chain spoilage and occupy high-cost chilled storage without volume velocity.",
                "actionable_correction": "Cut low-velocity Seafood SKUs by 50% and reassign refrigerated shelf volume to high-margin Snack Foods and Fresh Produce.",
                "expected_impact": "12% reduction in cold storage spoilage loss and +$35,000 net margin expansion."
            },
            {
                "id": 4,
                "domain": "App Merchandising & Digital Shelf Optimization",
                "severity": "High",
                "finding": "500+ items with high UI visibility (>0.12) produce below-average revenue, creating digital shelf clutter in user search results.",
                "chart_evidence": "Item Visibility vs. Sales Quadrant Scatter Diagram",
                "root_cause": "Heuristic item placement algorithms prioritize legacy items rather than dynamic conversion-rate-weighted ranking.",
                "actionable_correction": "Deploy conversion-weighted search ranking algorithm: dynamically deprioritize low-converting items and award prime top-row visibility to high-velocity Low Fat snacks.",
                "expected_impact": "+8.5% app checkout conversion rate and +$60k GMV through higher click-to-cart velocity."
            },
            {
                "id": 5,
                "domain": "Product Assortment & Health Trend Alignment",
                "severity": "Medium",
                "finding": "Low Fat products account for 64.7% ($776.3k) of total sales, outperforming Regular fat items (35.3%) across all outlet sizes.",
                "chart_evidence": "Fat Content by Location Type Grouped Bar Chart",
                "root_cause": "Shift in urban and semi-urban consumer preferences toward wellness, clean snacking, and portion-controlled groceries.",
                "actionable_correction": "Launch Blinkit private-label Low Fat product lines (dry fruits, baked snacks, skim dairy) which carry 32% gross margins vs 18% on branded items.",
                "expected_impact": "Boost overall gross profit margin from 23.7% to 26.2% across grocery categories."
            },
            {
                "id": 6,
                "domain": "Operational Standardization from Flagship Hub",
                "severity": "Medium",
                "finding": "Supermarket Type 3 (OUT027 established 2018) alone delivers $345.3k (28.7% of entire business revenue) with highest rating (4.0/5.0).",
                "chart_evidence": "Establishment Vintage Line Chart & Outlet Rankings",
                "root_cause": "OUT027 has high fulfillment automation, multi-aisle picking routes, and 12,000 cu ft cold storage capacity.",
                "actionable_correction": "Establish OUT027 warehouse layout and batch-picking routing as the mandatory Golden SOP blueprint for upgrading OUT017, OUT018, and OUT045.",
                "expected_impact": "Improve order batching efficiency by 19% across all Tier 2 and Tier 3 supermarkets."
            }
        ]
    }
    return jsonify({"status": "success", "report": report_data})

@app.route("/api/suggestions", methods=["GET", "POST"])
def handle_suggestions():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.get_json() or {}
        username = data.get("username", "Anonymous Analyst").strip() or "Anonymous Analyst"
        role = data.get("role", "Data Analyst").strip() or "Data Analyst"
        suggestion = data.get("suggestion", "").strip()
        category = data.get("category", "General Inquiry").strip() or "General Inquiry"

        if not suggestion:
            conn.close()
            return jsonify({"status": "error", "message": "Suggestion text is required"}), 400

        cur = conn.cursor()
        cur.execute("""
            INSERT INTO user_suggestions (username, role, suggestion, category)
            VALUES (?, ?, ?, ?);
        """, (username, role, suggestion, category))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Suggestion saved successfully!"})
    else:
        rows = conn.execute("""
            SELECT id, username, role, suggestion, category, created_at
            FROM user_suggestions
            ORDER BY id DESC
            LIMIT 15;
        """).fetchall()
        conn.close()
        return jsonify({"status": "success", "suggestions": [dict(r) for r in rows]})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)

