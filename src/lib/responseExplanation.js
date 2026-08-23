import { generateSituationBriefing } from './geminiInsights';

/**
 * Generates an explainable emergency response briefing.
 * Combines calculated deterministic scenario facts and passes them to Gemini (or uses local reasoning fallback).
 */
export async function generateResponseExplanation({
  recipient,
  medicine,
  simResult,
  optResult,
  language = 'en'
}) {
  if (!recipient || !medicine || !simResult || !optResult) {
    return null;
  }

  const { currentStatus, projectedStatus } = simResult;
  const { transfers, totalQuantity, requiredQuantity, isFullyAllocated } = optResult;

  // Format donor info for the structured decision
  let donorNames = 'No safe donor facility found';
  let recommendedTransferQuantity = 0;
  let donorStockText = '';
  let donorSafetyText = '';
  let donorSurplusText = '';

  if (transfers.length === 1) {
    const t = transfers[0];
    donorNames = t.fromPhc.name;
    recommendedTransferQuantity = t.quantity;
    donorStockText = `${t.donorBefore.stock} units`;
    donorSafetyText = `${t.fromPhc.reorder_level || 300} units`;
    donorSurplusText = `${t.quantity} units available`;
  } else if (transfers.length > 1) {
    donorNames = transfers.map(t => `${t.fromPhc.name} (${t.quantity} units)`).join(', ');
    recommendedTransferQuantity = totalQuantity;
    donorStockText = transfers.map(t => `${t.fromPhc.name}: ${t.donorBefore.stock}`).join(', ');
    donorSafetyText = transfers.map(t => `${t.fromPhc.name}: ${t.fromPhc.reorder_level || 300}`).join(', ');
    donorSurplusText = transfers.map(t => `${t.fromPhc.name}: ${t.quantity}`).join(', ');
  }

  // Construct structured decision inputs strictly matching Gemini briefing requirements
  const structuredDecision = {
    recipientPHC: recipient.name,
    district: recipient.district,
    state: recipient.state || 'Tamil Nadu',
    medicine: medicine.name,
    currentStock: currentStatus.stock,
    dailyConsumption: Math.round(projectedStatus.dailyDemand * 10) / 10 || 10,
    safetyStock: Number(medicine.reorder_level || 300),
    predictedDaysUntilStockout: projectedStatus.daysRemaining === 999 ? 120 : projectedStatus.daysRemaining,
    riskLevel: projectedStatus.overallRisk,
    donorPHC: transfers.length > 0 ? donorNames : null,
    donorStock: transfers.length > 0 ? donorStockText : null,
    donorSafetyStock: transfers.length > 0 ? donorSafetyText : null,
    donorSafeSurplus: transfers.length > 0 ? donorSurplusText : null,
    recommendedTransferQuantity,
    redistributionStatus: transfers.length > 0 ? "RECOMMENDED" : (projectedStatus.daysRemaining >= 10 ? "NOT_REQUIRED" : "NO_SAFE_DONOR")
  };

  try {
    // Attempt Gemini Cloud Function call
    const briefingJsonString = await generateSituationBriefing(structuredDecision, language);
    return briefingJsonString;
  } catch (error) {
    console.error("Gemini briefing failed, falling back to local explainer:", error);
    
    // Construct local deterministic fallback reasoning
    let recommendedActionStr = '';
    let reasoningStr = '';

    if (transfers.length === 0) {
      recommendedActionStr = 'No safe donor PHC is currently available within safety stock guidelines.';
      reasoningStr = `All nearby facilities stocking ${medicine.name} are either at capacity or would fall below their reorder safety thresholds if stock were transferred. Consider escalating to district or state-level emergency procurement.`;
    } else {
      recommendedActionStr = `Transfer a total of ${totalQuantity} units of ${medicine.name} to ${recipient.name}.`;
      
      const donorBreakdowns = transfers.map(t => 
        `Transfer ${t.quantity} units from ${t.fromPhc.name} (${t.distanceKm} km away, remaining stock: ${t.donorAfter.stock} units)`
      ).join(', ');

      reasoningStr = `${recipient.name} is facing critical pressure under this scenario. The multi-donor optimization engine selected the following path: ${donorBreakdowns}. This satisfies ${isFullyAllocated ? '100%' : Math.round((totalQuantity / requiredQuantity) * 100) + '%'} of the projected deficit while strictly preserving donor safety thresholds.`;
    }

    const fallbackObj = {
      headline: `${medicine.name} Stock Deficit at ${recipient.name}`,
      situation: `Under simulated surge of +${simResult.surgePercentage}%, daily demand increases to ${projectedStatus.dailyDemand} units/day. Current stock of ${currentStatus.stock} units is insufficient to meet safety targets.`,
      riskExplanation: `Projected days to stock-out falls to ${projectedStatus.daysRemaining === 999 ? 'Stable' : projectedStatus.daysRemaining + ' days'} with bed occupancy projected at ${projectedStatus.bedOccupancyPct}% (${projectedStatus.bedStatusText}).`,
      recommendedAction: recommendedActionStr,
      reason: reasoningStr,
      priority: projectedStatus.overallRisk === 'CRITICAL' || projectedStatus.overallRisk === 'HIGH' ? 'HIGH' : 'MEDIUM',
      confidenceNote: "Local calculation (Deterministic Response Plan, Gemini API offline)"
    };

    return JSON.stringify(fallbackObj);
  }
}
