# ------------------------------------------------------------------------------------------------------------------------------------------#
#                                                            Data Cleaning                                                                  #
# ------------------------------------------------------------------------------------------------------------------------------------------#
UPDATE blinkit_grocery_data set `Item Fat Content` = 'Regular' where `Item Fat Content` = 'reg';
UPDATE blinkit_grocery_data set `Item Fat Content` = 'Low Fat' where `Item Fat Content` = 'LF' or `Item Fat Content` = 'low Fat';


# ------------------------------------------------------------------------------------------------------------------------------------------#
#                                                           KPI Requirements                                                                #
# ------------------------------------------------------------------------------------------------------------------------------------------#
-- 1. Total Sales: The overall revenue generated from all items sold.
SELECT CONCAT(CAST(sum(sales)/1000000 as DECIMAL(10,2)),'M') as Total_Sales_Millions
from blinkit_grocery_data;

-- 2. Average Sales: The average revenue per sale.
SELECT CONCAT(CAST(AVG(sales) as DECIMAL(10,0)),'M') as Avg_Sales
from blinkit_grocery_data;

-- 3. Number of Items: The total count of different items sold.
SELECT COUNT(*) AS Total_No_Items from blinkit_grocery_data;

-- 4. Average Rating: The average customer rating for items sold.
SELECT CAST(AVG(`Rating`) as DECIMAL(10,2)) as Avg_Rating
from blinkit_grocery_data;


# ------------------------------------------------------------------------------------------------------------------------------------------#
#                                                           Granular Requirements                                                           #
# ------------------------------------------------------------------------------------------------------------------------------------------#

/*
1. Total Sales by Fat Content:
    Objective: Analyze the impact of fat content on total sales.
    Additional KPI Metrics: Assess how other KPIs (Average Sales, Number of Items, Average Rating) vary with fat content.
*/
SELECT `Item Fat Content`, 
                CONCAT(CAST(sum(sales)/1000 as DECIMAL(10,2)),'k') as Total_Sales_Thousands,
                CONCAT(CAST(AVG(sales) as DECIMAL(10,0)),'M') as Avg_Sales,
                COUNT(*) AS Total_No_Items,
                CAST(AVG(`Rating`) as DECIMAL(10,2)) as Avg_Rating
from blinkit_grocery_data 
GROUP BY `Item Fat Content`
ORDER BY Total_Sales_Thousands DESC;

/*
2. Total Sales by Item Type:
    Objective: Identify the performance of different item types in terms of total sales.
    Additional KPI Metrics: Assess how other KPIs (Average Sales, Number of Items, Average Rating) vary with fat content.
*/

SELECT `Item Type`, 
                CONCAT(CAST(sum(sales)/1000 as DECIMAL(10,2)),'k') as Total_Sales_Millions,
                CONCAT(CAST(AVG(sales) as DECIMAL(10,0)),'M') as Avg_Sales,
                COUNT(*) AS Total_No_Items,
                CAST(AVG(`Rating`) as DECIMAL(10,2)) as Avg_Rating
from blinkit_grocery_data 
GROUP BY `Item Type`
ORDER BY Total_Sales_Millions ;


/*
3. Fat Content by Outlet for Total Sales:
    Objective: Compare total sales across different outlets segmented by fat content.
    Additional KPI Metrics: Assess how other KPIs (Average Sales, Number of Items, Average Rating) vary with fat content.
*/

SELECT `Item Fat Content`,`Outlet Location Type`,
                CONCAT(CAST(sum(sales)/1000 as DECIMAL(10,2)),'k') as Total_Sales_Millions,
                CONCAT(CAST(AVG(sales) as DECIMAL(10,0)),'M') as Avg_Sales,
                COUNT(*) AS Total_No_Items,
                CAST(AVG(`Rating`) as DECIMAL(10,2)) as Avg_Rating
from blinkit_grocery_data 
GROUP BY `Item Fat Content`,`Outlet Location Type`
ORDER BY Total_Sales_Millions ;



/*
4. Total Sales by Outlet Establishment:
    Objective: Evaluate how the age or type of outlet establishment influences total sales.
*/
SELECT `Outlet Establishment Year`,
                CONCAT(CAST(SUM(`Sales`)/1000 as DECIMAL(10,2)),'k') as Total_Sales,
                CONCAT(CAST(AVG(`Sales`) as DECIMAL(10,0)),'M') as Avg_Sales,
                COUNT(*) as No_of_Items
from blinkit_grocery_data 
GROUP BY `Outlet Establishment Year`
ORDER BY Total_Sales;


/*
5. Percentage of Sales by Outlet Size:
Objective: Analyze the correlation between outlet size and total sales.
*/

SELECT `Outlet Size`,
                CAST(SUM(`Sales`) as DECIMAL(10,2))as Total_Sales,
                CAST((SUM(`Sales`) * 100.0 / SUM(SUM(`Sales`)) OVER()) as DECIMAL(10,2)) as Sales_Percentage
FROM blinkit_grocery_data
GROUP BY `Outlet Size`;
-- OVER() is the window function used here.

/*
6. Sales by Outlet Location:
Objective: Assess the geographic distribution of sales across different locations.
*/
SELECT `Outlet Location Type`,
                CAST(SUM(`Sales`) as DECIMAL(10,2)) as Total_Sales,
                CAST((SUM(`Sales`) * 100.0 / SUM(SUM(`Sales`)) OVER()) as DECIMAL(10,2)) as Sales_Percentage
FROM blinkit_grocery_data
GROUP BY `Outlet Location Type`;

/*
7. All Metrics by Outlet Type:
Objective: Provide a comprehensive view of all key metrics (Total Sales, Average Sales, Number of
Items, Average Rating) broken down by different outlet types.
*/
SELECT `Outlet Type`,
                CONCAT(CAST(SUM(`Sales`)/1000 as DECIMAL(10,2)),'k') as Total_Sales,
                CONCAT(CAST(AVG(`Sales`) as DECIMAL(10,0)),'M') as Avg_Sales,
                COUNT(*) as No_of_Items,
                CAST(AVG(`Rating`) as DECIMAL(10,2)) as Avg_Rating
from blinkit_grocery_data 
GROUP BY `Outlet Type`
ORDER BY Total_Sales DESC;


# ------------------------------------------------------------------------------------------------------------------------------------------#
#                                            Advanced SQL Functions: Window Functions & Analytics                                           #
# ------------------------------------------------------------------------------------------------------------------------------------------#

-- 8. Hub Revenue Ranking & Running Cumulative Totals (RANK & Window Cumulative)
SELECT 
    `Outlet Identifier`,
    `Outlet Type`,
    `Outlet Location Type`,
    ROUND(SUM(Sales), 2) AS Outlet_Sales,
    RANK() OVER (ORDER BY SUM(Sales) DESC) AS Sales_Rank,
    DENSE_RANK() OVER (ORDER BY SUM(Sales) DESC) AS Dense_Rank,
    ROUND(SUM(SUM(Sales)) OVER (ORDER BY SUM(Sales) DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2) AS Cumulative_Revenue
FROM blinkit_cleaned
GROUP BY `Outlet Identifier`, `Outlet Type`, `Outlet Location Type`
ORDER BY Sales_Rank;

-- 9. Top 3 Revenue-Generating Items per Category (ROW_NUMBER PARTITION BY)
WITH RankedItems AS (
    SELECT 
        `Item Identifier`,
        `Item Type`,
        `Item Fat Content`,
        Sales,
        Rating,
        ROW_NUMBER() OVER (PARTITION BY `Item Type` ORDER BY Sales DESC) AS Category_Rank
    FROM blinkit_cleaned
)
SELECT 
    `Item Type`,
    Category_Rank,
    `Item Identifier`,
    `Item Fat Content`,
    Sales,
    Rating
FROM RankedItems
WHERE Category_Rank <= 3
ORDER BY `Item Type`, Category_Rank;

-- 10. Product Quartile Segmentation (NTILE)
SELECT 
    Quartile,
    COUNT(*) AS Item_Count,
    ROUND(MIN(Sales), 2) AS Min_Sales,
    ROUND(MAX(Sales), 2) AS Max_Sales,
    ROUND(AVG(Sales), 2) AS Avg_Sales,
    ROUND(SUM(Sales), 2) AS Total_Sales,
    ROUND(SUM(Sales) * 100.0 / SUM(SUM(Sales)) OVER(), 2) AS Revenue_Share_Pct
FROM (
    SELECT 
        `Item Identifier`,
        Sales,
        NTILE(4) OVER (ORDER BY Sales DESC) AS Quartile
    FROM blinkit_cleaned
)
GROUP BY Quartile
ORDER BY Quartile;


# ------------------------------------------------------------------------------------------------------------------------------------------#
#                                                Advanced SQL Functions: Multi-Table Joins                                                  #
# ------------------------------------------------------------------------------------------------------------------------------------------#

-- 11. Category Gross Profit & Margin Contribution JOIN
SELECT 
    c.`Item Type`,
    b.`Category Code`,
    b.`Strategic Priority`,
    b.`Target Margin Pct`,
    ROUND(SUM(c.Sales), 2) AS Total_Sales,
    ROUND(SUM(c.Sales * (b.`Target Margin Pct` / 100.0)), 2) AS Estimated_Gross_Profit,
    ROUND(AVG(c.Rating), 2) AS Avg_Customer_Rating
FROM blinkit_cleaned c
INNER JOIN category_benchmarks b ON c.`Item Type` = b.`Item Type`
GROUP BY c.`Item Type`, b.`Category Code`, b.`Strategic Priority`, b.`Target Margin Pct`
ORDER BY Estimated_Gross_Profit DESC;

-- 12. Outlet Target vs Actual Sales Realization & Quick-Commerce SLA JOIN
SELECT 
    c.`Outlet Identifier`,
    o.`Hub Name`,
    c.`Outlet Type`,
    c.`Outlet Location Type`,
    o.`Quick Commerce SLA Mins`,
    o.`Operating Cost Tier`,
    o.`Target Sales Monthly`,
    ROUND(SUM(c.Sales), 2) AS Actual_Sales,
    ROUND((SUM(c.Sales) - o.`Target Sales Monthly`), 2) AS Sales_Variance,
    ROUND((SUM(c.Sales) * 100.0 / o.`Target Sales Monthly`), 1) AS Target_Realization_Pct
FROM blinkit_cleaned c
LEFT JOIN outlet_benchmarks o ON c.`Outlet Identifier` = o.`Outlet Identifier`
GROUP BY c.`Outlet Identifier`, o.`Hub Name`, c.`Outlet Type`, c.`Outlet Location Type`, o.`Quick Commerce SLA Mins`, o.`Operating Cost Tier`, o.`Target Sales Monthly`
ORDER BY Actual_Sales DESC;

-- 13. Digital Shelf Anomaly: High Visibility (>0.12) with Below-Average Sales
SELECT 
    `Item Identifier`,
    `Item Type`,
    ROUND(`Item Visibility`, 4) AS Visibility_Score,
    ROUND(Sales, 2) AS Sales,
    Rating,
    `Outlet Identifier`
FROM blinkit_cleaned
WHERE `Item Visibility` > 0.12 AND Sales < (SELECT AVG(Sales) FROM blinkit_cleaned)
ORDER BY `Item Visibility` DESC, Sales ASC
LIMIT 15;

