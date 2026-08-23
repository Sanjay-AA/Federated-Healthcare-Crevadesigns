import React from 'react';

import { predictDaysToStockOut } from '../lib/forecast';
import { useLanguage } from '../i18n/LanguageContext';

export default function AlertsList({ phcs = [], medicines = [], alerts = [], loading = false, onSelectPhc, onSimulateResponse }) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>{t('alertsList.loading')}</span>
      </div>
    );
  }

  const activeMedsSource = medicines || [];
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
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="pb-3 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-sans font-semibold text-[#0F172A]">
          {t('alertsList.title')}
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          {t('alertsList.subtitle')}
        </p>
      </div>

      {/* Main Panel */}
      <div className="bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden">
        {alertItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] font-medium space-y-2">
            <svg className="w-8 h-8 text-emerald-500 mx-auto opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-slate-700">{t('alertsList.noAlerts.title')}</p>
            <p className="text-slate-500 text-[11px]">{t('alertsList.noAlerts.desc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[#64748B] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">{t('alertsList.th.phc')}</th>
                  <th className="py-2.5 px-4">{t('alertsList.th.district')}</th>
                  <th className="py-2.5 px-4">{t('alertsList.th.medicine')}</th>
                  <th className="py-2.5 px-4 text-right">{t('alertsList.th.currentStock')}</th>
                  <th className="py-2.5 px-4 text-right">{t('alertsList.th.runRateTrend')}</th>
                  <th className="py-2.5 px-4 text-center">{t('alertsList.th.status')}</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
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
                      className="border-b border-[#E2E8F0]/70 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                    >
                      <td className="py-3 px-4 font-semibold text-[#0F172A]">{phc.name}</td>
                      <td className="py-3 px-4 text-[#64748B]">{phc.district}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{med.name}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#0F172A]">
                        {med.current_stock} {med.unit ? med.unit.toUpperCase() : t('dashboard.recs.units')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#64748B]">
                        {latestVal > 0 ? `${latestVal} ${t('alertsList.unitsPerDay')}` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block font-mono text-[9px] font-bold px-2 py-0.5 rounded-[4px] border ${
                          isCritical
                            ? 'bg-[#D64545]/10 border-[#D64545]/20 text-[#D64545] animate-pulse'
                            : 'bg-[#E8A33D]/10 border-[#E8A33D]/20 text-[#E8A33D]'
                        }`}>
                          {daysToStockOut === 0 
                            ? t('alertsList.stockOutToday')
                            : t('alertsList.stockOutIn', { days: daysToStockOut })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSimulateResponse(phc, med)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-750 text-white rounded text-[10px] font-bold cursor-pointer transition-colors select-none shadow-xs"
                        >
                          Simulate Response →
                        </button>
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
