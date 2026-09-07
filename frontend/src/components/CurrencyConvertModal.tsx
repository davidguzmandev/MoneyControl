import { useState } from "react";
import type { Currency } from "../types";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { api, ApiError } from "../lib/api";
import { Button, ErrorText, Select } from "./ui";

const CURRENCIES: Currency[] = ["USD", "COP", "MXN", "CAD"];

export function CurrencyConvertModal({ onClose }: { onClose: () => void }) {
  const { user, updateSettings } = useAuth();
  const { t } = useLanguage();
  const current = user?.currency ?? "USD";
  const [target, setTarget] = useState<Currency>(CURRENCIES.find((c) => c !== current) ?? "USD");
  const [rateNotice, setRateNotice] = useState<{ from: string; to: string; rate: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setError(null);
    setChecking(true);
    try {
      const preview = await api.get<{ from: string; to: string; rate: number }>(
        `/auth/currency-rate?to=${target}`
      );
      setRateNotice(preview);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.conversionCalcError"));
    } finally {
      setChecking(false);
    }
  }

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
        <Select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value as Currency);
            setRateNotice(null);
          }}
        >
          {CURRENCIES.filter((c) => c !== current).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {rateNotice && (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <p>
            {t("settings.currencyChangeWarning", {
              from: rateNotice.from,
              to: rateNotice.to,
              rate: rateNotice.rate.toFixed(4),
            })}
          </p>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        {rateNotice ? (
          <Button type="button" disabled={saving} onClick={handleConfirm}>
            {saving ? t("settings.converting") : t("settings.confirmConversion")}
          </Button>
        ) : (
          <Button type="button" disabled={checking} onClick={handlePreview}>
            {checking ? t("settings.calculating") : t("common.continue")}
          </Button>
        )}
      </div>
    </div>
  );
}
