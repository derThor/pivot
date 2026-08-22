// Geteilt zwischen der Firma-Seite (Vollständigkeits-Kachel) und der
// Systemnachrichten-Seite (Warnbanner) – ein Datensatz, zwei Anzeigeorte
// (Nutzervorgabe, 2026-08-19: Warnhinweise müssen zusätzlich als
// Systembenachrichtigung erscheinen).
export const companyFields = [
  { key: "companyName", label: "Firmenname" },
  { key: "companyStreet", label: "Straße und Hausnummer" },
  { key: "companyPostalCode", label: "PLZ" },
  { key: "companyCity", label: "Ort" },
  { key: "companyCountry", label: "Land" },
  { key: "companyRepresentative", label: "Vertretungsberechtigte Person" },
  { key: "companyEmail", label: "E-Mail" },
  { key: "companyPhone", label: "Telefon" },
  { key: "companyRegisterCourt", label: "Registergericht" },
  { key: "companyRegisterNumber", label: "Handelsregisternummer" },
  { key: "companyVatId", label: "USt-IdNr." },
  { key: "companySupervisoryAuthority", label: "Aufsichtsbehörde" },
  { key: "companyDisputeResolution", label: "Streitschlichtung" },
] as const;

export type CompanyFieldKey = (typeof companyFields)[number]["key"];
