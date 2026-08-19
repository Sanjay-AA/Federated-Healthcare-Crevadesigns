/**
 * Predicts the number of days until a medicine's stock is depleted using
 * simple linear regression on the last 7 days of consumption history.
 * 
 * @param {Array<{date: string, quantity_used: number}>} consumptionHistory 14-day history
 * @param {number} currentStock Current inventory level
 * @returns {number} Predicted days until stock-out (rounded). Returns 999 if no stock-out is expected in the near future.
 */
export function predictDaysToStockOut(consumptionHistory, currentStock) {
  if (!consumptionHistory || consumptionHistory.length === 0) {
    return 999;
  }
  
  if (currentStock <= 0) {
    return 0;
  }

  // Use the last 7 days to capture the latest trend
  const historySegment = consumptionHistory.slice(-7);
  const n = historySegment.length;

  if (n < 2) {
    // Fallback if there is not enough history: use average of whatever is available
    const avg = consumptionHistory.reduce((sum, d) => sum + d.quantity_used, 0) / consumptionHistory.length;
    return avg > 0 ? Math.round(currentStock / avg) : 999;
  }

  // Simple Linear Regression: y = m * x + c
  // x is the time index (0 to n-1), y is the daily quantity_used
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = historySegment[i].quantity_used;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }

  const denominator = n * sumXX - sumX * sumX;
  
  // Calculate slope (m) and intercept (c)
  let m = 0;
  let c = 0;

  if (denominator !== 0) {
    m = (n * sumXY - sumX * sumY) / denominator;
    c = (sumY - m * sumX) / n;
  } else {
    // Fallback: flat trend based on average
    m = 0;
    c = sumY / n;
  }

  // Calculate average baseline consumption to prevent division by zero / negative rates
  const averageConsumption = sumY / n;
  
  // Simulate depletion day-by-day in the future
  let remainingStock = currentStock;
  let dayIndex = n; // start predicting from next day index (i.e. day 7 relative to history)
  let predictedDays = 0;
  const maxSimulationDays = 120; // Cap to avoid infinite loops

  while (remainingStock > 0 && predictedDays < maxSimulationDays) {
    // Project the rate: y_t = m * t + c
    let predictedConsumption = m * dayIndex + c;

    // Operational sanity check: if the regression predicts negative or extremely low consumption
    // because of a downward slope, we fallback to a baseline floor of 1 or the average consumption.
    // This ensures we don't predict infinite stock for fluctuating locations.
    const baselineFloor = Math.max(1, averageConsumption * 0.5);
    if (predictedConsumption < baselineFloor) {
      predictedConsumption = baselineFloor;
    }

    remainingStock -= predictedConsumption;
    predictedDays++;
    dayIndex++;
  }

  // If stock is not depleted within the cap window, report 999 (stable)
  return predictedDays >= maxSimulationDays ? 999 : predictedDays;
}
