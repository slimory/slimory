import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zhTranslation from './locales/zh.json'
import enTranslation from './locales/en.json'
import esTranslation from './locales/es.json'
import jaTranslation from './locales/ja.json'
import deTranslation from './locales/de.json'
import frTranslation from './locales/fr.json'
import ptTranslation from './locales/pt.json'
import arTranslation from './locales/ar.json'
import hiTranslation from './locales/hi.json'
import bnTranslation from './locales/bn.json'

const resources = {
    zh: {
        translation: zhTranslation
    },
    en: {
        translation: enTranslation
    },
    es: {
        translation: esTranslation
    },
    ja: {
        translation: jaTranslation
    },
    de: {
        translation: deTranslation
    },
    fr: {
        translation: frTranslation
    },
    pt: {
        translation: ptTranslation
    },
    ar: {
        translation: arTranslation
    },
    hi: {
        translation: hiTranslation
    },
    bn: {
        translation: bnTranslation
    }
}

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        lng: 'zh', // Default language
        fallbackLng: 'zh',
        debug: false,

        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage']
        },

        interpolation: {
            escapeValue: false // React already does escaping
        }
    })

export default i18n
