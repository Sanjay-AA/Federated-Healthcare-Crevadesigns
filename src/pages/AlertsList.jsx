import React from 'react';
import { mockMedicines } from '../data/mockMedicines';
import { predictDaysToStockOut } from '../lib/forecast';

export default function AlertsList({ phcs = [], medicines = [], alerts = [], loading = false, onSelectPhc }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>LOADING INVENTORY ALERTS...</span>
      </div>
    );
  }

  const activeMedsSource = medicines && medicines.length > 0 ? medicines : mockMedicines;
  const alertItems = [];

  // 1. Process Firestore alerts collection if available
  if (alerts && alerts.length > 0) {
    alerts.forEach((alertDoc) => {
      const phc = phcs.find(p => p.id === alertDoc.phc_id);
      const med = activeMedsSource.find(m => m.id === alertDoc.medicine_id || (m.phc_id === alertDoc.phc_id && m.name === alertDoc.medicine_name)) || {
        name: alertDoc.medicine_name || "Critical Item",
        current_stock: 0,
        unit: "Units",
        consumption_history: []
      };

      if (phc) {
        alertItems.push({
          phc,
          med,
          daysToStockOut: alertDoc.days_to_stockout !== undefined ? alertDoc.days_to_stockout : 1,
          severity: alertDoc.severity || "CRITICAL"
        });
      }
    });
  }

  // 2. If no alert documents, calculate dynamically from medicines
  if (alertItems.length === 0) {
    phcs.forEach((phc) => {
      const phcMeds = activeMedsSource.filter(m => m.phc_id === phc.id);
      phcMeds.forEach((med) => {
        const days = predictDaysToStockOut(med.consumption_history, med.current_stock);
        if (days < 7) {
          alertItems.push({
            phc,
            med,
            daysToStockOut: days,
            severity: days < 3 ? "CRITICAL" : "HIGH"
          });
        }
      });
    });
  }

  // Sort alerts: critical first (lowest days)
  alertItems.sort((a, b) => a.daysToStockOut - b.daysToStockOut);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-heading font-semibold text-[#1D4E89]">
          Active Inventory Alerts
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          Real-time depletion alerts computed via linear regression on local daily run-rates from Firestore.
        </p>
      </div>

      {/* Main Panel */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        {alertItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] font-medium space-y-2">
            <svg className="w-8 h-8 text-emerald-500 mx-auto opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-slate-700">No Active Resource Alerts</p>
            <p className="text-slate-500 text-[11px]">All Primary Health Centre nodes are operating with sufficient inventory buffers.</p>
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
                {alertItems.map((alert, idx) => {
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
                      <td className="py-4 px-6 text-right font-mono text-[#1E293B]">
                        {med.current_stock} {med.unit ? med.unit.toUpperCase() : 'UNITS'}
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-[#64748B]">
                        {latestVal > 0 ? `${latestVal} units/day` : 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-block font-mono text-[10px] font-bold px-2.5 py-1 rounded border ${
                          isCritical
                            ? 'bg-[#D64545]/10 border-[#D64545]/20 text-[#D64545] animate-pulse'
                            : 'bg-[#E8A33D]/10 border-[#E8A33D]/20 text-[#E8A33D]'
                        }`}>
                          {daysToStockOut === 0 
                            ? 'STOCK-OUT TODAY'
                            : isCritical 
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
