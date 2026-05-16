import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zh from './locales/zh.json'
import en from './locales/en.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import pt from './locales/pt.json'
import it from './locales/it.json'
import pl from './locales/pl.json'
import nl from './locales/nl.json'
import tr from './locales/tr.json'
import sv from './locales/sv.json'
import uk from './locales/uk.json'

export const SUPPORTED_LANGUAGES: Array<{ code: string; label: string; nativeName: string }> = [
  { code: 'zh', label: 'Chinese',     nativeName: '中文' },
  { code: 'en', label: 'English',     nativeName: 'English' },
  { code: 'ja', label: 'Japanese',    nativeName: '日本語' },
  { code: 'ko', label: 'Korean',      nativeName: '한국어' },
  { code: 'de', label: 'German',      nativeName: 'Deutsch' },
  { code: 'fr', label: 'French',      nativeName: 'Français' },
  { code: 'es', label: 'Spanish',     nativeName: 'Español' },
  { code: 'pt', label: 'Portuguese',  nativeName: 'Português' },
  { code: 'it', label: 'Italian',     nativeName: 'Italiano' },
  { code: 'pl', label: 'Polish',      nativeName: 'Polski' },
  { code: 'nl', label: 'Dutch',       nativeName: 'Nederlands' },
  { code: 'tr', label: 'Turkish',     nativeName: 'Türkçe' },
  { code: 'sv', label: 'Swedish',     nativeName: 'Svenska' },
  { code: 'uk', label: 'Ukrainian',   nativeName: 'Українська' },
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    resources: {
      zh: { translation: zh },
      en: { translation: en },
      ja: { translation: ja },
      ko: { translation: ko },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      pt: { translation: pt },
      it: { translation: it },
      pl: { translation: pl },
      nl: { translation: nl },
      tr: { translation: tr },
      sv: { translation: sv },
      uk: { translation: uk },
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'unfetch.lang',
    },
  })

export default i18n
