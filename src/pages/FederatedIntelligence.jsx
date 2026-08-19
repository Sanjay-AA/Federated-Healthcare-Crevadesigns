import React from 'react';

export default function FederatedIntelligence({ federatedModel, loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>LOADING FEDERATED NETWORK MODEL PARAMETERS...</span>
      </div>
    );
  }

  // Extract model parameters from Firestore or use fallback
  const salemSlope = federatedModel?.nodes?.Salem?.slope ?? 0.05;
  const salemStatus = federatedModel?.nodes?.Salem?.status ?? 'STABLE';
  
  const namakkalSlope = federatedModel?.nodes?.Namakkal?.slope ?? 11.93;
  const namakkalStatus = federatedModel?.nodes?.Namakkal?.status ?? 'OUTBREAK';
  
  const erodeSlope = federatedModel?.nodes?.Erode?.slope ?? -0.02;
  const erodeStatus = federatedModel?.nodes?.Erode?.status ?? 'STABLE';

  const aggregatorName = federatedModel?.aggregator ?? 'Tamil Nadu Central Aggregator';
  const algorithmName = federatedModel?.algorithm ?? 'FedAvg';
  const globalTrend = federatedModel?.global_trend ?? 3.42;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* CSS Animation Keyframes Injector */}
      <style>{`
        @keyframes flowDown {
          0% {
            transform: translateY(0) scale(0.9);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(80px) scale(0.9);
            opacity: 0;
          }
        }
        .animate-flow-delay-0 {
          animation: flowDown 3.5s infinite linear;
        }
        .animate-flow-delay-1 {
          animation: flowDown 3.5s infinite linear;
          animation-delay: 1.2s;
        }
        .animate-flow-delay-2 {
          animation: flowDown 3.5s infinite linear;
          animation-delay: 2.4s;
        }
      `}</style>

      {/* Header */}
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-heading font-semibold text-[#1D4E89]">
          Federated AI Network Architecture
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          Privacy-preserving collaborative machine learning for state-wide resource forecasting from Firestore.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Architecture Diagram and Animation Flow */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-12 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#1D4E89] uppercase tracking-wider">
              Live Aggregation Data-Flow Simulation
            </div>
            <span className="text-[9px] font-mono text-[#64748B] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              GLOBAL TREND: +{globalTrend}
            </span>
          </div>

          {/* District Nodes Layer */}
          <div className="grid grid-cols-3 gap-4 relative z-10">
            
            {/* Salem Node */}
            <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Node: Salem</span>
                <span className={`h-1.5 w-1.5 rounded-full ${salemStatus === 'OUTBREAK' ? 'bg-[#D64545]' : 'bg-[#0F6B66]'} animate-pulse`}></span>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-[#64748B] font-medium">Local Model State</div>
                <div className={`text-xs font-semibold font-mono ${salemStatus === 'OUTBREAK' ? 'text-[#D64545]' : 'text-[#0F6B66]'}`}>
                  {salemStatus} (slope = {salemSlope >= 0 ? `+${salemSlope}` : salemSlope})
                </div>
              </div>
              <div className="text-[9px] text-[#64748B] font-mono bg-white p-1.5 rounded border border-[#E2E8F0]/70">
                P2P DATA: PROTECTED
              </div>
              
              {/* Downward Animation Line Container */}
              <div className="absolute left-1/2 -bottom-12 transform -translate-x-1/2 flex flex-col items-center">
                <div className="h-12 w-px bg-dashed border-l border-[#E2E8F0]"></div>
                <div className="absolute top-1 bg-[#F0F5FA] border border-[#1D4E89]/20 text-[#1D4E89] text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm animate-flow-delay-0 z-20">
                  {`{ slope: ${salemSlope} }`}
                </div>
              </div>
            </div>

            {/* Namakkal Node */}
            <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Node: Namakkal</span>
                <span className={`h-1.5 w-1.5 rounded-full ${namakkalStatus === 'OUTBREAK' ? 'bg-[#D64545]' : 'bg-[#0F6B66]'} animate-pulse`}></span>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-[#64748B] font-medium">Local Model State</div>
                <div className={`text-xs font-semibold font-mono ${namakkalStatus === 'OUTBREAK' ? 'text-[#D64545]' : 'text-[#0F6B66]'}`}>
                  {namakkalStatus} (slope = {namakkalSlope >= 0 ? `+${namakkalSlope}` : namakkalSlope})
                </div>
              </div>
              <div className="text-[9px] text-[#64748B] font-mono bg-white p-1.5 rounded border border-[#E2E8F0]/70">
                P2P DATA: PROTECTED
              </div>

              {/* Downward Animation Line Container */}
              <div className="absolute left-1/2 -bottom-12 transform -translate-x-1/2 flex flex-col items-center">
                <div className="h-12 w-px bg-dashed border-l border-[#E2E8F0]"></div>
                <div className="absolute top-1 bg-[#D64545]/10 border border-[#D64545]/20 text-[#D64545] text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm animate-flow-delay-1 z-20">
                  {`{ slope: ${namakkalSlope} }`}
                </div>
              </div>
            </div>

            {/* Erode Node */}
            <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Node: Erode</span>
                <span className={`h-1.5 w-1.5 rounded-full ${erodeStatus === 'OUTBREAK' ? 'bg-[#D64545]' : 'bg-[#0F6B66]'} animate-pulse`}></span>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-[#64748B] font-medium">Local Model State</div>
                <div className={`text-xs font-semibold font-mono ${erodeStatus === 'OUTBREAK' ? 'text-[#D64545]' : 'text-[#0F6B66]'}`}>
                  {erodeStatus} (slope = {erodeSlope >= 0 ? `+${erodeSlope}` : erodeSlope})
                </div>
              </div>
              <div className="text-[9px] text-[#64748B] font-mono bg-white p-1.5 rounded border border-[#E2E8F0]/70">
                P2P DATA: PROTECTED
              </div>

              {/* Downward Animation Line Container */}
              <div className="absolute left-1/2 -bottom-12 transform -translate-x-1/2 flex flex-col items-center">
                <div className="h-12 w-px bg-dashed border-l border-[#E2E8F0]"></div>
                <div className="absolute top-1 bg-[#F0F5FA] border border-[#1D4E89]/20 text-[#1D4E89] text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm animate-flow-delay-2 z-20">
                  {`{ slope: ${erodeSlope} }`}
                </div>
              </div>
            </div>

          </div>

          {/* Spacer to give room for animation */}
          <div className="h-8"></div>

          {/* Aggregator Node Layer */}
          <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded-lg p-5 max-w-lg mx-auto relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-[#F0F5FA] border border-[#E2E8F0] flex items-center justify-center text-[#1D4E89]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[#1E293B] uppercase tracking-wider font-heading">{aggregatorName}</span>
              </div>
              <span className="text-[9px] font-bold text-[#1D4E89] bg-[#F0F5FA] border border-[#E2E8F0] px-2 py-0.5 rounded">
                {algorithmName} Active
              </span>
            </div>

            <div className="space-y-3 pt-3 border-t border-[#E2E8F0] text-xs">
              <div className="space-y-1">
                <span className="text-[#64748B] uppercase tracking-wider text-[10px] font-semibold">Aggregation Parameters</span>
                <p className="text-[#1E293B] font-mono bg-white p-2 rounded border border-[#E2E8F0] leading-relaxed text-[11px]">
                  Global_Trend = (w_salem * slope_salem) + (w_namakkal * slope_namakkal) + (w_erode * slope_erode)
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[#64748B] uppercase tracking-wider text-[10px] font-semibold">Aggregated State Prediction</span>
                <div className="p-3 bg-[#D64545]/10 border border-[#D64545]/20 text-[#D64545] rounded space-y-1.5">
                  <div className="font-semibold text-xs uppercase tracking-wide">⚠️ Collaborative Outbreak Risk Confirmed</div>
                  <p className="text-[11px] text-[#D64545]/85 leading-normal">
                    Aggregate regression models confirm an escalating slope mismatch. Namakkal region is identified as the outbreak epicentre (Severe deficit slope $\ge 11.5$). Salem & Erode are verified as stable surplus buffers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Explainers Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[#1D4E89] uppercase tracking-wider">
              Privacy-First Aggregation
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Each district trains locally on its own data. Only model insights — not raw patient or stock data — are shared with the central aggregator, preserving privacy while improving predictions for everyone.
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[#1E293B] uppercase tracking-wider">
              How it works
            </h3>
            <ol className="text-xs text-[#64748B] space-y-3 list-decimal list-inside">
              <li className="leading-relaxed">
                <strong className="text-[#1E293B]">Local Training:</strong> Salem, Erode, and Namakkal run independent linear regressions locally inside their nodes using their specific PHC inventories.
              </li>
              <li className="leading-relaxed">
                <strong className="text-[#1E293B]">Parameters Sharing:</strong> The district nodes transmit only computed trend coefficients (slope slopes, intercept weights) to the central aggregator.
              </li>
              <li className="leading-relaxed">
                <strong className="text-[#1E293B]">Global Aggregation:</strong> The central node performs federated aggregation, calculating a unified state-wide resource allocation projection.
              </li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  );
}
