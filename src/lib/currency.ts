export const CURRENCY_PRESETS = ["HKD", "USD", "EUR", "CNY"] as const;

export function parseCurrencyFromForm(formData: FormData, fallback = "hkd") {
  const preset = String(formData.get("currencyPreset") || "").toUpperCase();
  if ((CURRENCY_PRESETS as readonly string[]).includes(preset)) {
    return preset.toLowerCase();
  }
  const other = String(formData.get("currencyOther") || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return other.length === 3 ? other.toLowerCase() : fallback;
}

export function parseCapacityFromForm(formData: FormData): number | null {
  if (formData.get("limitCapacity") !== "on") return null;
  const n = Math.floor(Number(formData.get("capacity") || 0));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function currencyPresetValue(currency: string) {
  const code = currency.toUpperCase();
  return (CURRENCY_PRESETS as readonly string[]).includes(code) ? code : "OTHER";
}
