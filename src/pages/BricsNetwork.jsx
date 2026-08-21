import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const flagMap = {
  IN: '🇮🇳',
  BR: '🇧🇷',
  RU: '🇷🇺',
  CN: '🇨🇳',
  ZA: '🇿🇦'
};

const languageMap = {
  IN: 'Hindi/English',
  BR: 'Portuguese',
  RU: 'Russian',
  CN: 'Mandarin Chinese',
  ZA: 'English'
};

export default function BricsNetwork({ countries = [], loading = false }) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>{t('brics.loading')}</span>
      </div>
    );
  }

  const activeCountries = countries || [];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="pb-3 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-sans font-semibold text-[#0F172A]">
          {t('brics.title')}
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          {t('brics.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        
        {/* Main Content Info */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-4">
          <div>
            <h3 className="font-sans font-semibold text-[#0F172A] text-sm">
              {t('brics.nodes.title')}
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              {t('brics.nodes.subtitle')}
            </p>
          </div>

          {activeCountries.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-200 rounded-[6px] text-center text-xs text-[#64748B]">
              {t('brics.nodes.noNodes')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeCountries.map((c) => {
                const flag = flagMap[c.code] || '🌐';
                const isActive = c.code === 'IN' || c.status === 'ACTIVE';
                const primaryLang = languageMap[c.code] || (c.name === 'India' ? 'Hindi/English' : c.name === 'Brazil' ? 'Portuguese' : c.name === 'Russia' ? 'Russian' : c.name === 'China' ? 'Mandarin Chinese' : c.name === 'South Africa' ? 'English' : '');

                return (
                  <div 
                    key={c.code || c.id}
                    className={`flex items-center gap-3 p-3 rounded-[6px] select-none border transition-colors ${
                      isActive 
                        ? 'bg-slate-50 border-slate-300 text-[#0F172A] cursor-pointer hover:bg-slate-100/70' 
                        : 'bg-[#F8FAFC]/50 border-[#E2E8F0] text-slate-400 opacity-75 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-lg">{flag}</span>
                    <div className="leading-tight flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#0F172A]">{c.name}</span>
                        {primaryLang && (
                          <span className="text-[10px] text-[#64748B] font-medium font-sans">
                            {primaryLang}
                          </span>
                        )}
                      </div>
                      <div className={`text-[8px] font-bold tracking-wide mt-1 uppercase ${isActive ? 'text-[#0F6B66]' : 'text-slate-500'}`}>
                        {isActive ? t('brics.nodes.prototypeNode') : t('brics.nodes.futureVision')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Info Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
            {t('brics.policy.title')}
          </h3>
          <p className="text-xs text-[#475569] leading-relaxed">
            {t('brics.policy.desc')}
          </p>
          <div className="p-2.5 bg-[#F8FAFC] rounded-[6px] border border-[#E2E8F0] text-[11px] text-[#64748B] leading-normal space-y-1.5">
            <div className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">{t('brics.policy.rulesTitle')}</div>
            <p>{t('brics.policy.rule1')}</p>
            <p>{t('brics.policy.rule2')}</p>
            <p>{t('brics.policy.rule3')}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
