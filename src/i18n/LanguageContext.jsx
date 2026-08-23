import React, { createContext, useContext, useState } from 'react';
import en from './translations/en.json';
import hi from './translations/hi.json';
import ta from './translations/ta.json';
import ml from './translations/ml.json';

const translations = { en, hi, ta, ml };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('app_language');
      return saved && ['en', 'hi', 'ta', 'ml'].includes(saved) ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang) => {
    if (['en', 'hi', 'ta', 'ml'].includes(lang)) {
      setLanguageState(lang);
      try {
        localStorage.setItem('app_language', lang);
      } catch (err) {
        console.error("Failed to persist language setting:", err);
      }
    }
  };

  const t = (keyPath, params = {}) => {
    const keys = keyPath.split('.');
    
    const getVal = (obj) => {
      let current = obj;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return undefined;
        }
      }
      return current;
    };

    let text = getVal(translations[language]);
    
    // Fallback to English if key missing in selected language
    if (text === undefined && language !== 'en') {
      text = getVal(translations.en);
    }

    if (typeof text !== 'string') {
      return keyPath;
    }

    // Replace parameter placeholders e.g. {days}
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((paramKey) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
