import React, { useState, useEffect } from 'react';
import { 
  getPHCs, 
  getMedicines, 
  getAlerts, 
  getTransfers, 
  getDiseaseReports, 
  getFederatedModel, 
  getCountries, 
  getDistricts 
} from "./lib/firestore";

import { useLanguage } from './i18n/LanguageContext';

import Dashboard from './pages/Dashboard';
import PhcDetail from './pages/PhcDetail';
import FederatedIntelligence from './pages/FederatedIntelligence';
import DistrictsSummary from './pages/DistrictsSummary';
import AlertsList from './pages/AlertsList';
import BricsNetwork from './pages/BricsNetwork';

function App() {
  const { language, setLanguage, t } = useLanguage();
  const [selectedPhc, setSelectedPhc] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [liveTimestamp, setLiveTimestamp] = useState('');

  // Firestore collections state
  const [phcs, setPhcs] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [diseaseReports, setDiseaseReports] = useState([]);
  const [federatedModel, setFederatedModel] = useState(null);
  const [countries, setCountries] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFirestoreData() {
      try {
        setLoading(true);
        setError(null);

        const [
          phcData,
          medData,
          alertData,
          transferData,
          reportData,
          fedData,
          countryData,
          districtData
        ] = await Promise.all([
          getPHCs(),
          getMedicines(),
          getAlerts(),
          getTransfers(),
          getDiseaseReports(),
          getFederatedModel(),
          getCountries(),
          getDistricts()
        ]);

        if (isMounted) {
          setPhcs(phcData || []);
          setMedicines(medData || []);
          setAlerts(alertData || []);
          setTransfers(transferData || []);
          setDiseaseReports(reportData || []);
          setFederatedModel(fedData && fedData.length > 0 ? fedData[0] : null);
          setCountries(countryData || []);
          setDistricts(districtData || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Firestore loading error:", err);
        if (isMounted) {
          setError("Unable to connect to local healthcare data.");
          setPhcs([]);
          setMedicines([]);
          setLoading(false);
        }
      }
    }

    loadFirestoreData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update live clock in 12-hour format: "04:39 PM"
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour '0' should be '12'
      setLiveTimestamp(`${String(hours).padStart(2, '0')}:${minutes} ${ampm}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setSelectedPhc(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex font-sans antialiased">
      {/* 1. SIDEBAR */}
      <aside className="w-60 bg-white border-r border-[#E2E8F0] flex flex-col justify-between shrink-0">
        <div className="flex flex-col">
          {/* Logo / Branding */}
          <div className="h-14 px-4 border-b border-[#E2E8F0] flex flex-col justify-center">
            <span className="font-sans font-bold text-[13px] tracking-tight text-[#0F172A] leading-none">
              {t('app.title')}
            </span>
            <span className="text-[9px] text-[#64748B] font-medium tracking-wide uppercase mt-1">
              {t('app.subtitle')}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="py-3 px-2 space-y-1">
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-2 px-2.5 py-2 text-[13px] font-medium rounded-[6px] select-none cursor-pointer transition-all duration-150 ${
                activeTab === 'dashboard'
                  ? 'bg-slate-100 text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              {/* Dashboard Icon */}
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {t('app.nav.commandCenter')}
            </button>
            
            <button
              onClick={() => handleNavClick('districts')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-[6px] select-none cursor-pointer transition-all duration-150 ${
                activeTab === 'districts'
                  ? 'bg-slate-100 text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              {/* Districts Icon */}
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {t('app.nav.districts')}
            </button>

            <button
              onClick={() => handleNavClick('alerts')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-[6px] select-none cursor-pointer transition-all duration-150 ${
                activeTab === 'alerts'
                  ? 'bg-slate-100 text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              {/* Alerts Icon */}
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {t('app.nav.alerts')}
            </button>

            <button
              onClick={() => handleNavClick('federated')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-[6px] select-none cursor-pointer transition-all duration-150 ${
                activeTab === 'federated'
                  ? 'bg-slate-100 text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              {/* Fed Intel Icon */}
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              {t('app.nav.federated')}
            </button>

            <button
              onClick={() => handleNavClick('brics')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-[6px] select-none cursor-pointer transition-all duration-150 ${
                activeTab === 'brics'
                  ? 'bg-slate-100 text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              {/* Global Icon */}
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              {t('app.nav.brics')}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#E2E8F0] space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[#0F6B66] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6B66]"></span>
            {t('app.status.allSystemsOperational')}
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-[#0F172A] font-medium outline-none cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="ta">தமிழ்</option>
          </select>
          <div className="text-[9px] text-[#64748B] font-medium tracking-wider font-mono uppercase bg-[#F8FAFC] py-1 rounded border border-[#E2E8F0] text-center">
            {t('app.status.emulatorSecure')}
          </div>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Operations Header */}
        <header className="bg-white border-b border-[#E2E8F0] h-14 px-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-sans font-semibold text-[14px] text-[#0F172A] leading-tight">
              {t('app.header.title')}
            </h2>
            <p className="text-[9px] text-[#64748B] font-medium uppercase tracking-wider mt-0.5">
              {t('app.header.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Live system status */}
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0F6B66] animate-pulse"></span>
              <span className="text-[#0F6B66] font-semibold uppercase tracking-wider text-[9px]">{t('app.header.live')}</span>
            </div>

            {/* Last updated */}
            <div className="text-[11px] text-[#64748B] font-mono">
              {t('app.header.updated')} {liveTimestamp}
            </div>

            {/* District filter */}
            {activeTab === 'dashboard' && !selectedPhc && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{t('app.header.filter')}</span>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-[#0F172A] font-medium outline-none cursor-pointer hover:border-slate-300 transition-colors"
                >
                  <option value="All">{t('app.header.allDistricts')}</option>
                  {(districts && districts.length > 0 ? districts.map(d => d.name) : ['Salem', 'Erode', 'Namakkal']).map((dName) => (
                    <option key={dName} value={dName}>{dName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Panel Workspace */}
        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded flex items-center justify-between animate-fadeIn">
              <span className="flex items-center gap-2">
                <span className="font-bold">⚠️ {t('app.error.notice')}</span> {t('app.error.connection')}
              </span>
              <button 
                onClick={() => window.location.reload()} 
                className="underline text-xs font-semibold hover:text-amber-900 cursor-pointer"
              >
                {t('app.error.retry')}
              </button>
            </div>
          )}

          {activeTab === 'dashboard' ? (
            selectedPhc ? (
              <PhcDetail 
                phc={selectedPhc} 
                medicines={medicines}
                loading={loading}
                onBack={() => setSelectedPhc(null)} 
              />
            ) : (
              <Dashboard 
                phcs={phcs} 
                medicines={medicines}
                transfers={transfers}
                districts={districts}
                diseaseReports={diseaseReports}
                federatedModel={federatedModel}
                loading={loading}
                error={error}
                onSelectPhc={setSelectedPhc} 
                districtFilter={districtFilter}
              />
            )
          ) : activeTab === 'districts' ? (
            <DistrictsSummary 
              phcs={phcs} 
              medicines={medicines}
              districts={districts}
              diseaseReports={diseaseReports}
              federatedModel={federatedModel}
              loading={loading}
              onSelectDistrict={(d) => {
                setDistrictFilter(d);
                setActiveTab('dashboard');
              }} 
            />
          ) : activeTab === 'alerts' ? (
            <AlertsList 
              phcs={phcs} 
              medicines={medicines}
              alerts={alerts}
              loading={loading}
              onSelectPhc={(phc) => {
                setSelectedPhc(phc);
                setActiveTab('dashboard');
              }} 
            />
          ) : activeTab === 'federated' ? (
            <FederatedIntelligence 
              federatedModel={federatedModel}
              loading={loading}
            />
          ) : activeTab === 'brics' ? (
            <BricsNetwork 
              countries={countries}
              loading={loading}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default App;
