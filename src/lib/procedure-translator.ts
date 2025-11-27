import type { Language } from '@/lib/i18n'

// Procedure translation dictionaries
// Keys are Polish names (from Google Sheets), values are translations
// Only procedures that exist in the API response will be displayed

const procedureTranslations: Record<string, Record<Language, string>> = {
  // ============================================
  // OLGA'S PROCEDURES
  // ============================================
  
  "Masaż twarzy japoński lifting": {
    pl: "Masaż twarzy japoński lifting",
    uk: "Японський ліфтинг-масаж обличчя",
    en: "Japanese facial lifting massage"
  },
  "Masaż twarzy japoński lifting + maska dostosowana do typu skóry": {
    pl: "Masaż twarzy japoński lifting + maska dostosowana do typu skóry",
    uk: "Японський ліфтинг-масаж обличчя + маска для типу шкіри",
    en: "Japanese facial lifting massage + skin type mask"
  },
  "Masaż twarzy japoński lifting + kinesiotaping": {
    pl: "Masaż twarzy japoński lifting + kinesiotaping",
    uk: "Японський ліфтинг-масаж обличчя + кінезіотейпування",
    en: "Japanese facial lifting massage + kinesiotaping"
  },
  "Masaż ciała mikrowibroterapia ciała (endosferoterapia)": {
    pl: "Masaż ciała mikrowibroterapia ciała (endosferoterapia)",
    uk: "Мікровібротерапія тіла (ендосферотерапія)",
    en: "Body microvibration therapy (endosphere therapy)"
  },
  "Masaż ciała mikrowibroterapia ciała (endosferoterapia) (nogi, brzuch, boki)": {
    pl: "Masaż ciała mikrowibroterapia ciała (endosferoterapia) (nogi, brzuch, boki)",
    uk: "Мікровібротерапія тіла (ноги, живіт, боки)",
    en: "Body microvibration therapy (legs, abdomen, sides)"
  },
  "Autorski masaż całego ciała": {
    pl: "Autorski masaż całego ciała",
    uk: "Авторський масаж усього тіла",
    en: "Signature full body massage"
  },
  "Masaż pleców": {
    pl: "Masaż pleców",
    uk: "Масаж спини",
    en: "Back massage"
  },

  // ============================================
  // YULIIA'S PROCEDURES
  // ============================================
  
  // Massage procedures
  "MODELUJĄCY MASAŻ TWARZY, SZYI I DEKOLTU": {
    pl: "MODELUJĄCY MASAŻ TWARZY, SZYI I DEKOLTU",
    uk: "Моделюючий масаж обличчя, шиї та декольте",
    en: "Contouring face, neck and décolleté massage"
  },
  "PRZEZPOLICZKOWY MASAZ TWARZY": {
    pl: "PRZEZPOLICZKOWY MASAZ TWARZY",
    uk: "Міжщелепний масаж обличчя",
    en: "Transoral facial massage"
  },
  "PRZEZPOLICZKOWY MASAZ TWARZY + ELEMENTY OSTEOPATII": {
    pl: "PRZEZPOLICZKOWY MASAZ TWARZY + ELEMENTY OSTEOPATII",
    uk: "Міжщелепний масаж обличчя + елементи остеопатії",
    en: "Transoral facial massage + osteopathy elements"
  },
  "MODELUJĄCY MASAŻ TWARZY, SZYI I DEKOLTU + ELEMENTY OSTEOPATII": {
    pl: "MODELUJĄCY MASAŻ TWARZY, SZYI I DEKOLTU + ELEMENTY OSTEOPATII",
    uk: "Моделюючий масаж обличчя, шиї та декольте + елементи остеопатії",
    en: "Contouring face, neck and décolleté massage + osteopathy elements"
  },
  
  // Osteopathy
  "SESJA TERAPII OSTEOPATYCZNEJ": {
    pl: "SESJA TERAPII OSTEOPATYCZNEJ",
    uk: "Сеанс остеопатичної терапії",
    en: "Osteopathic therapy session"
  },
  
  // Cosmetology - Cleansing
  "OCZYSZCZANIE TWARZY (ULTRADŹWIEKI + MECHANICZNE)": {
    pl: "OCZYSZCZANIE TWARZY (ULTRADŹWIEKI + MECHANICZNE)",
    uk: "Очищення обличчя (ультразвук + механічне)",
    en: "Facial cleansing (ultrasound + mechanical)"
  },
  "OCZYSZCZANIE TWARZY+ PEELING": {
    pl: "OCZYSZCZANIE TWARZY+ PEELING",
    uk: "Очищення обличчя + пілінг",
    en: "Facial cleansing + peeling"
  },
  
  // Cosmetology - Peelings
  "PEELING KWASOWY": {
    pl: "PEELING KWASOWY",
    uk: "Кислотний пілінг",
    en: "Acid peeling"
  },
  "PEELING ENZYMATYCZNY": {
    pl: "PEELING ENZYMATYCZNY",
    uk: "Ензимний пілінг",
    en: "Enzyme peeling"
  },
  "PEELING BIOREWITALIZUJĄCY: ¤PRX T33 ¤BIOREPEEL ¤Ninja": {
    pl: "PEELING BIOREWITALIZUJĄCY: ¤PRX T33 ¤BIOREPEEL ¤Ninja",
    uk: "Біоревіталізуючий пілінг: PRX T33, BIOREPEEL, Ninja",
    en: "Biorevitalizing peeling: PRX T33, BIOREPEEL, Ninja"
  },
  
  // Cosmetology - Other treatments
  "KARBOKSYTERAPIA (różne rodzaje)": {
    pl: "KARBOKSYTERAPIA (różne rodzaje)",
    uk: "Карбокситерапія (різні види)",
    en: "Carboxytherapy (various types)"
  },
  "Zabieg pielęgnacyjny do typu i stanu skóry (na wybór specjalisty)": {
    pl: "Zabieg pielęgnacyjny do typu i stanu skóry (na wybór specjalisty)",
    uk: "Доглядова процедура за типом шкіри (на вибір спеціаліста)",
    en: "Skincare treatment by skin type (specialist's choice)"
  },
  
  // Cosmetology - Microcurrent therapy
  "Terapia mikroprądowa TWARZY": {
    pl: "Terapia mikroprądowa TWARZY",
    uk: "Мікрострумова терапія обличчя",
    en: "Facial microcurrent therapy"
  },
  "Terapia mikroprądowa TWARZ, SZYJA I DEKOLT": {
    pl: "Terapia mikroprądowa TWARZ, SZYJA I DEKOLT",
    uk: "Мікрострумова терапія обличчя, шиї та декольте",
    en: "Microcurrent therapy for face, neck and décolleté"
  },
  
  // Cosmetology - Injection treatments
  "Zabieg iniekcyjny (biorewitalizacja/ mezoterapia)": {
    pl: "Zabieg iniekcyjny (biorewitalizacja/ mezoterapia)",
    uk: "Ін'єкційна процедура (біоревіталізація/мезотерапія)",
    en: "Injection treatment (biorevitalization/mesotherapy)"
  },
  
  // Osteopathy / Acupuncture
  "Estetyczna akupunktura": {
    pl: "Estetyczna akupunktura",
    uk: "Естетична акупунктура",
    en: "Aesthetic acupuncture"
  },
  
  // Mesotherapy
  "Mezoterapia frakcyjna (Dermapen): ciało, twarz, szyja, dekolt": {
    pl: "Mezoterapia frakcyjna (Dermapen): ciało, twarz, szyja, dekolt",
    uk: "Фракційна мезотерапія (Dermapen): тіло, обличчя, шия, декольте",
    en: "Fractional mesotherapy (Dermapen): body, face, neck, décolleté"
  }
}

/**
 * Translate a procedure name from Polish to the target language.
 * Falls back to the original Polish name if no translation is found.
 */
export function translateProcedureName(namePl: string, targetLang: Language): string {
  // If target is Polish, return as is
  if (targetLang === 'pl') {
    return namePl
  }

  // Look up in dictionary
  const translations = procedureTranslations[namePl]
  if (translations && translations[targetLang]) {
    return translations[targetLang]
  }

  // Try case-insensitive match
  const lowerName = namePl.toLowerCase()
  for (const [key, value] of Object.entries(procedureTranslations)) {
    if (key.toLowerCase() === lowerName && value[targetLang]) {
      return value[targetLang]
    }
  }

  // Fallback to original Polish name
  return namePl
}

/**
 * Format procedure display with duration and price
 */
export function formatProcedureDisplay(
  namePl: string, 
  durationMin: number, 
  pricePln: number | string | undefined,
  targetLang: Language,
  minutesLabel: string
): string {
  const translatedName = translateProcedureName(namePl, targetLang)
  let display = `${translatedName} - ${durationMin} ${minutesLabel}`
  
  if (pricePln !== undefined && pricePln !== '') {
    display += ` / ${pricePln} zł`
  }
  
  return display
}

/**
 * Add a new procedure translation at runtime (for dynamic data)
 */
export function addProcedureTranslation(
  namePl: string, 
  translations: Partial<Record<Language, string>>
): void {
  procedureTranslations[namePl] = {
    pl: namePl,
    uk: translations.uk || namePl,
    en: translations.en || namePl,
  }
}
