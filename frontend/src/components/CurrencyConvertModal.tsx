import { useState } from "react";
import type { Currency } from "../types";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Select } from "./ui";

const CURRENCIES: Currency[] = ["USD", "COP", "MXN", "CAD"];

export function CurrencyConvertModal({ onClose }: { onClose: () => void }) {
  const { user, updateSettings } = useAuth();
  const { t } = useLanguage();
  const current = user?.currency ?? "USD";
  const [target, setTarget] = useState<Currency>(CURRENCIES.find((c) => c !== current) ?? "USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setSaving(true);
    try {
      await updateSettings({ currency: target });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">{t("settings.currencyLabel")}</label>
        <Select value={target} onChange={(e) => setTarget(e.target.value as Currency)}>
          {CURRENCIES.filter((c) => c !== current).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" disabled={saving} onClick={handleConfirm}>
          {saving ? t("settings.converting") : t("dashboard.convertCurrency")}
        </Button>
      </div>
    </div>
  );
}
