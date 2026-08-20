import React from 'react';

const flagMap = {
  IN: '🇮🇳',
  BR: '🇧🇷',
  RU: '🇷🇺',
  CN: '🇨🇳',
  ZA: '🇿🇦'
};

export default function BricsNetwork({ countries = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>LOADING BRICS FEDERATION NODES...</span>
      </div>
    );
  }

  // Fallback countries list if collection empty
  const activeCountries = countries.length > 0
    ? countries
    : [
        { code: 'IN', name: 'India', status: 'ACTIVE' },
        { code: 'BR', name: 'Brazil', status: 'CONNECTED' },
        { code: 'RU', name: 'Russia', status: 'CONNECTED' },
        { code: 'CN', name: 'China', status: 'CONNECTED' },
        { code: 'ZA', name: 'South Africa', status: 'CONNECTED' }
      ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-heading font-semibold text-[#1D4E89]">
          BRICS Global Federation Network
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          International federated model parameters sharing for pandemic response and outbreak preparedness.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Main Content Info */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-6">
          <h3 className="font-heading font-bold text-[#1E293B] text-base">
            Global Aggregate Model Nodes
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Select an active national server node to view global parameter exchange rates. Currently, the India central aggregator is active and feeding local state parameters.
          </p>

          {/* Selector Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {activeCountries.map((c) => {
              const flag = flagMap[c.code] || '🌐';
              const isActive = c.code === 'IN' || c.status === 'ACTIVE';

              return (
                <div 
                  key={c.code || c.id}
                  className={`flex items-center gap-3 p-4 rounded select-none ${
                    isActive 
                      ? 'bg-[#F0F5FA] border border-[#1D4E89]/40 text-[#1E293B] cursor-pointer' 
                      : 'bg-[#F7F9FB]/50 border border-[#E2E8F0] text-slate-400 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <span className="text-xl">{flag}</span>
                  <div className="leading-tight">
                    <div className="font-bold text-xs">{c.name}</div>
                    <div className={`text-[9px] font-semibold mt-0.5 ${isActive ? 'text-[#0F6B66]' : 'text-slate-500'}`}>
                      {isActive ? '● ACTIVE NODE' : 'COMING SOON'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Info Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-semibold text-[#1D4E89] uppercase tracking-wider">
            Federated Scope & Policy
          </h3>
          <p className="text-xs text-[#1E293B] leading-relaxed">
            The same state-level federated aggregation pattern extends to a BRICS-level aggregator, allowing nations to share predictive intelligence for pandemic/outbreak preparedness without exposing raw health data across borders.
          </p>
          <div className="p-3 bg-[#F0F5FA] rounded border border-[#E2E8F0] text-[11px] text-[#64748B] leading-normal space-y-2">
            <div className="font-semibold text-xs text-[#1D4E89] uppercase tracking-wider">AGGREGATION RULES</div>
            <p>1. Local patient records never leave national borders.</p>
            <p>2. Aggregated trend slopes are merged via secure multi-party computation (SMPC).</p>
            <p>3. Dynamic forecasting updates occur under official health ministries.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
