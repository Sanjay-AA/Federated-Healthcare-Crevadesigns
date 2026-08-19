import React from 'react';
import { mockMedicines } from '../data/mockMedicines';
import { predictDaysToStockOut } from '../lib/forecast';

export default function AlertsList({ phcs, onSelectPhc }) {
  // Collect all alerts from medicines
  const alerts = [];

  phcs.forEach((phc) => {
    const phcMeds = mockMedicines.filter(m => m.phc_id === phc.id);
    phcMeds.forEach((med) => {
      const days = predictDaysToStockOut(med.consumption_history, med.current_stock);
      if (days < 7) {
        alerts.push({
          phc,
          med,
          daysToStockOut: days
        });
      }
    });
  });

  // Sort alerts: critical first (lowest days)
  alerts.sort((a, b) => a.daysToStockOut - b.daysToStockOut);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-heading font-semibold text-[#1D4E89]">
          Active Inventory Alerts
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          Real-time depletion alerts computed via linear regression on local daily run-rates.
        </p>
      </div>

      {/* Main Panel */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748B] font-medium">
            No active resource alerts. All nodes operating normally.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F7F9FB] text-[#64748B] font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Primary Health Centre</th>
                  <th className="py-3.5 px-6">District</th>
                  <th className="py-3.5 px-6">Medicine Item</th>
                  <th className="py-3.5 px-6 text-right">Current Stock</th>
                  <th className="py-3.5 px-6 text-right">Run-Rate Trend</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, idx) => {
                  const { phc, med, daysToStockOut } = alert;
                  const isCritical = daysToStockOut < 3;
                  
                  const history = med.consumption_history || [];
                  const latestVal = history[history.length - 1]?.quantity_used || 0;
                  
                  return (
                    <tr 
                      key={idx}
                      onClick={() => onSelectPhc(phc)}
                      className="border-b border-[#E2E8F0]/70 hover:bg-[#F7F9FB] transition-colors cursor-pointer select-none"
                    >
                      <td className="py-4 px-6 font-semibold text-[#1E293B] font-heading">{phc.name}</td>
                      <td className="py-4 px-6 text-[#64748B]">{phc.district}</td>
                      <td className="py-4 px-6 font-semibold text-[#1D4E89]">{med.name}</td>
                      <td className="py-4 px-6 text-right font-mono text-[#1E293B]">{med.current_stock} {med.unit.toUpperCase()}</td>
                      <td className="py-4 px-6 text-right font-mono text-[#64748B]">{latestVal} units/day</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-block font-mono text-[10px] font-bold px-2.5 py-1 rounded border ${
                          isCritical
                            ? 'bg-[#D64545]/10 border-[#D64545]/20 text-[#D64545]'
                            : 'bg-[#E8A33D]/10 border-[#E8A33D]/20 text-[#E8A33D]'
                        }`}>
                          {isCritical 
                            ? `STOCK-OUT IN ${daysToStockOut} ${daysToStockOut === 1 ? 'DAY' : 'DAYS'}` 
                            : `STOCK-OUT IN ${daysToStockOut} DAYS`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
