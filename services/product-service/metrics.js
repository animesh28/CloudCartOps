const promClient = require('prom-client');

// Product Service Metrics
const productListTime = new promClient.Histogram({
  name: 'product_list_time_seconds',
  help: 'Time to fetch product list',
  buckets: [0.05, 0.1, 0.5, 1, 2, 5]
});

const productSearchTime = new promClient.Histogram({
  name: 'product_search_time_seconds',
  help: 'Time to search products',
  buckets: [0.05, 0.1, 0.5, 1, 2, 5]
});

const productStockUpdates = new promClient.Counter({
  name: 'product_stock_updates_total',
  help: 'Total product stock updates',
  labelNames: ['product_id', 'reason']
});

const productViewsTotal = new promClient.Counter({
  name: 'product_views_total',
  help: 'Total product page views',
  labelNames: ['product_id', 'category']
});

const inventoryAlerts = new promClient.Counter({
  name: 'inventory_alerts_total',
  help: 'Total low inventory alerts',
  labelNames: ['product_id', 'severity']
});

const productCategoryCount = new promClient.Gauge({
  name: 'product_count_by_category',
  help: 'Number of products in each category',
  labelNames: ['category']
});

const productAvgPrice = new promClient.Gauge({
  name: 'product_average_price',
  help: 'Average product price by category',
  labelNames: ['category']
});

const cacheRefreshTime = new promClient.Histogram({
  name: 'product_cache_refresh_time_seconds',
  help: 'Time to refresh product cache',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

module.exports = {
  productListTime,
  productSearchTime,
  productStockUpdates,
  productViewsTotal,
  inventoryAlerts,
  productCategoryCount,
  productAvgPrice,
  cacheRefreshTime,
  
  registerMetrics() {
    return [
      productListTime,
      productSearchTime,
      productStockUpdates,
      productViewsTotal,
      inventoryAlerts,
      productCategoryCount,
      productAvgPrice,
      cacheRefreshTime
    ];
  }
};
