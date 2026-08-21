import React from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import federatedTrainingLog from '../data/federatedTrainingLog.json';
import { useLanguage } from '../i18n/LanguageContext';

export default function FederatedIntelligence({ federatedModel, loading = false }) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>{t('federated.loading')}</span>
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
      <div className="pb-3 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-sans font-semibold text-[#0F172A]">
          {t('federated.title')}
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          {t('federated.subtitle')}
        </p>
      </div>

      {/* Model & Training Metadata Strip */}
      <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 px-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
        <div>
          <span className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider block">{t('federated.meta.globalModel')}</span>
          <span className="font-semibold text-[#0F172A]">{t('federated.meta.globalModelVal')}</span>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider block">{t('federated.meta.trainingRound')}</span>
          <span className="font-semibold text-[#0F172A]">{t('federated.meta.trainingRoundVal')}</span>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider block">{t('federated.meta.participatingNodes')}</span>
          <span className="font-semibold text-[#0F172A]">{t('federated.meta.participatingNodesVal')}</span>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider block">{t('federated.meta.aggregationMethod')}</span>
          <span className="font-semibold text-[#0F172A]">{algorithmName}</span>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider block">{t('federated.meta.modelStatus')}</span>
          <span className="flex items-center gap-1 font-semibold text-[#0F6B66]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6B66] animate-pulse"></span>
            {t('federated.meta.active')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        <div className="lg:col-span-2 space-y-5">
          {/* Architecture Diagram and Animation Flow */}
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-8 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              {t('federated.flow.title')}
            </div>
            <span className="text-[9px] font-mono text-[#64748B] bg-slate-50 px-2 py-0.5 rounded border border-[#E2E8F0]">
              {t('federated.flow.globalTrend')} +{globalTrend}
            </span>
          </div>

          {/* District Nodes Layer */}
          <div className="grid grid-cols-3 gap-3 relative z-10">
            
            {/* Salem Node */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-3 space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#0F172A] uppercase tracking-wider">{t('federated.node.salem')}</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0F6B66]"></span>
                  <span className="text-[9px] text-[#0F6B66] font-medium uppercase tracking-wider">{t('federated.node.online')}</span>
                </span>
              </div>
              <div className="space-y-0.5 text-[11px] text-[#64748B]">
                <div className="flex justify-between">
                  <span>{t('federated.node.status')}</span>
                  <span className={`font-mono font-medium ${salemStatus === 'OUTBREAK' ? 'text-[#D64545]' : 'text-[#0F6B66]'}`}>{salemStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('federated.node.localTrend')}</span>
                  <span className="font-mono text-[#0F172A] font-medium">{salemSlope >= 0 ? `+${salemSlope}` : salemSlope}</span>
                </div>
              </div>
              <div className="text-[9px] text-[#64748B] font-mono bg-white p-1 rounded border border-[#E2E8F0]/70 text-center">
                {t('federated.node.protected')}
              </div>
              
              {/* Downward Animation Line Container */}
              <div className="absolute left-1/2 -bottom-12 transform -translate-x-1/2 flex flex-col items-center">
                <div className="h-12 w-px bg-dashed border-l border-[#E2E8F0]"></div>
                <div className="absolute top-1 bg-white border border-[#E2E8F0] text-[#0F172A] text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm animate-flow-delay-0 z-20">
                  {`{ slope: ${salemSlope} }`}
                </div>
              </div>
            </div>

            {/* Namakkal Node */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-3 space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#0F172A] uppercase tracking-wider">{t('federated.node.namakkal')}</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0F6B66]"></span>
                  <span className="text-[9px] text-[#0F6B66] font-medium uppercase tracking-wider">{t('federated.node.online')}</span>
                </span>
              </div>
              <div className="space-y-0.5 text-[11px] text-[#64748B]">
                <div className="flex justify-between">
                  <span>{t('federated.node.status')}</span>
                  <span className={`font-mono font-medium ${namakkalStatus === 'OUTBREAK' ? 'text-[#D64545]' : 'text-[#0F6B66]'}`}>{namakkalStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('federated.node.localTrend')}</span>
                  <span className="font-mono text-[#0F172A] font-medium">{namakkalSlope >= 0 ? `+${namakkalSlope}` : namakkalSlope}</span>
                </div>
              </div>
              <div className="text-[9px] text-[#64748B] font-mono bg-white p-1 rounded border border-[#E2E8F0]/70 text-center">
                {t('federated.node.protected')}
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
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-3 space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#0F172A] uppercase tracking-wider">{t('federated.node.erode')}</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0F6B66]"></span>
                  <span className="text-[9px] text-[#0F6B66] font-medium uppercase tracking-wider">{t('federated.node.online')}</span>
                </span>
              </div>
              <div className="space-y-0.5 text-[11px] text-[#64748B]">
                <div className="flex justify-between">
                  <span>{t('federated.node.status')}</span>
                  <span className={`font-mono font-medium ${erodeStatus === 'OUTBREAK' ? 'text-[#D64545]' : 'text-[#0F6B66]'}`}>{erodeStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('federated.node.localTrend')}</span>
                  <span className="font-mono text-[#0F172A] font-medium">{erodeSlope >= 0 ? `+${erodeSlope}` : erodeSlope}</span>
                </div>
              </div>
              <div className="text-[9px] text-[#64748B] font-mono bg-white p-1 rounded border border-[#E2E8F0]/70 text-center">
                {t('federated.node.protected')}
              </div>

              {/* Downward Animation Line Container */}
              <div className="absolute left-1/2 -bottom-12 transform -translate-x-1/2 flex flex-col items-center">
                <div className="h-12 w-px bg-dashed border-l border-[#E2E8F0]"></div>
                <div className="absolute top-1 bg-white border border-[#E2E8F0] text-[#0F172A] text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm animate-flow-delay-2 z-20">
                  {`{ slope: ${erodeSlope} }`}
                </div>
              </div>
            </div>

          </div>

          {/* Spacer to give room for animation */}
          <div className="h-6"></div>

          {/* Aggregator Node Layer */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 max-w-lg mx-auto relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded bg-white border border-[#E2E8F0] flex items-center justify-center text-slate-700">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider font-heading">{aggregatorName}</span>
              </div>
              <span className="text-[9px] font-bold text-slate-700 bg-white border border-[#E2E8F0] px-2 py-0.5 rounded">
                {algorithmName} {t('federated.agg.active')}
              </span>
            </div>

            <div className="space-y-2.5 pt-2.5 border-t border-[#E2E8F0] text-[11px]">
              <div className="space-y-1">
                <span className="text-[#64748B] uppercase tracking-wider text-[9px] font-semibold">{t('federated.agg.params')}</span>
                <p className="text-[#1E293B] font-mono bg-white p-2 rounded border border-[#E2E8F0] leading-relaxed text-[10px]">
                  Global_Trend = (w_salem * slope_salem) + (w_namakkal * slope_namakkal) + (w_erode * slope_erode)
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[#64748B] uppercase tracking-wider text-[9px] font-semibold">{t('federated.agg.statePrediction')}</span>
                <div className="p-3 bg-red-50/50 border border-red-100 text-[#D64545] rounded-[6px] space-y-1">
                  <div className="font-semibold text-[11px] uppercase tracking-wide">{t('federated.agg.riskConfirmed')}</div>
                  <p className="text-[10px] text-red-700 leading-normal">
                    {t('federated.agg.riskDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Federated Training Loss Chart */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              {t('federated.history.title')}
            </h3>
            <p className="text-xs text-[#64748B] mt-1">
              {t('federated.history.subtitle')}
            </p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={federatedTrainingLog} 
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.6} />
                <XAxis 
                  dataKey="round" 
                  stroke="#64748B" 
                  fontSize={10} 
                  fontWeight={500}
                  tickFormatter={(val) => `Round ${val}`}
                />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={10} 
                  fontWeight={500}
                />
                <Tooltip 
                  contentStyle={{ 
                    fontSize: '11px', 
                    borderRadius: '6px', 
                    borderColor: '#E2E8F0',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                  }} 
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} 
                />
                <Line 
                  name={t('federated.history.salemClient')} 
                  type="monotone" 
                  dataKey="Salem" 
                  stroke="#0F6B66" 
                  strokeWidth={2} 
                  dot={{ r: 3 }} 
                  activeDot={{ r: 5 }}
                />
                <Line 
                  name={t('federated.history.erodeClient')} 
                  type="monotone" 
                  dataKey="Erode" 
                  stroke="#E8A33D" 
                  strokeWidth={2} 
                  dot={{ r: 3 }} 
                  activeDot={{ r: 5 }}
                />
                <Line 
                  name={t('federated.history.namakkalClient')} 
                  type="monotone" 
                  dataKey="Namakkal" 
                  stroke="#D64545" 
                  strokeWidth={2} 
                  dot={{ r: 3 }} 
                  activeDot={{ r: 5 }}
                />
                <Line 
                  name={t('federated.history.globalModel')} 
                  type="monotone" 
                  dataKey="Global" 
                  stroke="#7E22CE" 
                  strokeWidth={3} 
                  strokeDasharray="5 5"
                  dot={{ r: 4 }} 
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <p className="text-[11px] text-[#64748B] italic text-center pt-1">
            {t('federated.history.caption')}
          </p>
        </div>
      </div>

      {/* Explainers Sidebar */}
      <div className="space-y-4">
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
            {t('federated.privacy.title')}
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            {t('federated.privacy.desc')}
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
            {t('federated.howItWorks.title')}
          </h3>
          <ol className="text-xs text-[#64748B] space-y-2 list-decimal list-inside">
            <li className="leading-relaxed">
              <strong className="text-[#0F172A]">{t('federated.howItWorks.step1Title')}</strong> {t('federated.howItWorks.step1Desc')}
            </li>
            <li className="leading-relaxed">
              <strong className="text-[#0F172A]">{t('federated.howItWorks.step2Title')}</strong> {t('federated.howItWorks.step2Desc')}
            </li>
            <li className="leading-relaxed">
              <strong className="text-[#0F172A]">{t('federated.howItWorks.step3Title')}</strong> {t('federated.howItWorks.step3Desc')}
            </li>
          </ol>
        </div>
      </div>

      </div>
    </div>
  );
}
