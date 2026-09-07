import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { api, ApiError } from "../lib/api";
import type { Currency, Language, Theme } from "../types";
import { Button, Card, ErrorText, Input, Label, Select } from "../components/ui";

export function SettingsPage() {
  const { user, updateSettings } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name ?? "");
  const [cycleStartDay, setCycleStartDay] = useState(user?.cycleStartDay ?? 1);
  const [customDay, setCustomDay] = useState(!PRESETS.some((p) => p.day === user?.cycleStartDay));
  const [currency, setCurrency] = useState<Currency>(user?.currency ?? "USD");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setCycleStartDay(user.cycleStartDay);
    setCustomDay(!PRESETS.some((p) => p.day === user.cycleStartDay));
    setCurrency(user.currency);
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await updateSettings({
        name,
        cycleStartDay,
        currency,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.saveError"));
    } finally {
      setLoading(false);
    }
  }

  const CURRENCIES: { value: Currency; label: string }[] = [
    { value: "USD", label: t("settings.currencyUSD") },
    { value: "COP", label: t("settings.currencyCOP") },
    { value: "MXN", label: t("settings.currencyMXN") },
    { value: "CAD", label: t("settings.currencyCAD") },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("nav.settings")}</h1>
        <p className="text-sm text-slate-500">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>{t("settings.periodLabel")}</Label>
            <div className="space-y-2">
              {PRESETS.map((preset) => (
                <label key={preset.day} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!customDay && cycleStartDay === preset.day}
                    onChange={() => {
                      setCustomDay(false);
                      setCycleStartDay(preset.day);
                    }}
                  />
                  {t(preset.labelKey)}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={customDay} onChange={() => setCustomDay(true)} />
                {t("settings.periodCustom")}
                {customDay && (
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={cycleStartDay}
                    onChange={(e) => setCycleStartDay(Number(e.target.value))}
                    className="ml-2 w-20"
                  />
                )}
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="currency">{t("settings.currencyLabel")}</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">
            {t("settings.budgetExplanationPre")} <span className="font-medium">{t("nav.categories")}</span>.{" "}
            {t("settings.budgetExplanationPost")}
          </div>

          <ErrorText>{error}</ErrorText>
          {success && <p className="text-sm text-emerald-600">{t("common.savedSuccessfully")}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </form>
      </Card>

      <ThemeCard />

      <LanguageCard />

      <LowBalanceAlertCard />

      <BalanceSinceCard />

      <WiseIntegrationCard />

      <ChangePasswordCard />

      <DeleteAccountCard />
    </div>
  );
}

const PRESETS: { day: number; labelKey: "settings.periodPreset1" | "settings.periodPreset15" }[] = [
  { day: 1, labelKey: "settings.periodPreset1" },
  { day: 15, labelKey: "settings.periodPreset15" },
];

const THEME_OPTIONS: { value: Theme; labelKey: "settings.themeSystem" | "settings.themeLight" | "settings.themeDark" }[] = [
  { value: "system", labelKey: "settings.themeSystem" },
  { value: "light", labelKey: "settings.themeLight" },
  { value: "dark", labelKey: "settings.themeDark" },
];

function ThemeCard() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("settings.appearance")}</h2>
      <p className="mt-1 text-xs text-slate-400">{t("settings.appearanceDescription")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              theme === opt.value
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </Card>
  );
}

const LANGUAGE_OPTIONS: { value: Language; labelKey: "settings.languageEs" | "settings.languageEn" }[] = [
  { value: "es", labelKey: "settings.languageEs" },
  { value: "en", labelKey: "settings.languageEn" },
];

function LanguageCard() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("settings.language")}</h2>
      <p className="mt-1 text-xs text-slate-400">{t("settings.languageDescription")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLanguage(opt.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              language === opt.value
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </Card>
  );
}

function ChangePasswordCard() {
  const { changePassword } = useAuth();
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError(t("validation.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("validation.passwordMismatch"));
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.changePasswordError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("common.password")}</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">{t("settings.confirmNewPassword")}</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        {success && <p className="text-sm text-emerald-600">{t("settings.passwordUpdated")}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? t("common.saving") : t("settings.changePassword")}
        </Button>
      </form>
    </Card>
  );
}

function DeleteAccountCard() {
  const { deleteAccount } = useAuth();
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.deleteAccountError"));
      setDeleting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-red-600">{t("settings.deleteAccountTitle")}</h2>
      <p className="mt-1 text-xs text-slate-400">{t("settings.deleteAccountWarning")}</p>
      {!confirming ? (
        <Button
          type="button"
          variant="danger"
          className="mt-4"
          onClick={() => {
            setConfirming(true);
            setError(null);
          }}
        >
          {t("settings.deleteAccountButton")}
        </Button>
      ) : (
        <form onSubmit={handleDelete} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="deletePassword">{t("settings.confirmPasswordToDelete")}</Label>
            <Input
              id="deletePassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setConfirming(false);
                setPassword("");
                setError(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" disabled={deleting || !password}>
              {deleting ? t("settings.deleting") : t("settings.confirmDeletion")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function LowBalanceAlertCard() {
  const { user, updateSettings } = useAuth();
  const { t } = useLanguage();
  const [value, setValue] = useState(user?.lowBalanceAlert !== null ? String(user?.lowBalanceAlert ?? "") : "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(user?.lowBalanceAlert !== null && user?.lowBalanceAlert !== undefined ? String(user.lowBalanceAlert) : "");
  }, [user?.lowBalanceAlert]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setError(t("validation.invalidAmount"));
      return;
    }
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await updateSettings({ lowBalanceAlert: parsed });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.alertSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("settings.alertsTitle")}</h2>
      <p className="mt-1 text-xs text-slate-400">{t("settings.alertsDescription")}</p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Label htmlFor="lowBalanceAlert">{t("settings.lowBalanceLabel")}</Label>
          <Input
            id="lowBalanceAlert"
            type="number"
            min={0}
            step="0.01"
            placeholder={t("settings.noAlertPlaceholder")}
            value={value}
            disabled={saving}
            onChange={(e) => {
              setValue(e.target.value);
              setSuccess(false);
            }}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {success && <p className="mt-2 text-xs text-emerald-600">{t("common.savedSuccessfully")}</p>}
    </Card>
  );
}

function BalanceSinceCard() {
  const { user, updateSettings } = useAuth();
  const { t } = useLanguage();
  const [value, setValue] = useState(user?.balanceSince ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(user?.balanceSince ?? "");
  }, [user?.balanceSince]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await updateSettings({ balanceSince: value.trim() === "" ? null : value });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("settings.balanceSinceSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("settings.balanceSinceTitle")}</h2>
      <p className="mt-1 text-xs text-slate-400">{t("settings.balanceSinceDescription")}</p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="w-44">
          <Label htmlFor="balanceSince">{t("settings.countFrom")}</Label>
          <Input
            id="balanceSince"
            type="date"
            value={value}
            disabled={saving}
            onChange={(e) => {
              setValue(e.target.value);
              setSuccess(false);
            }}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {success && <p className="mt-2 text-xs text-emerald-600">{t("common.savedSuccessfully")}</p>}
    </Card>
  );
}

interface WiseStatus {
  connected: boolean;
  currency: string | null;
  lastSyncedAt: string | null;
}

interface WiseBalanceOption {
  id: number;
  currency: string;
  amount: number;
}

function WiseIntegrationCard() {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [token, setToken] = useState("");
  const [balances, setBalances] = useState<WiseBalanceOption[] | null>(null);
  const [selectedBalanceId, setSelectedBalanceId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ["integrations", "wise", "status"],
    queryFn: () => api.get<WiseStatus>("/integrations/wise/status"),
  });

  const balancesMutation = useMutation({
    mutationFn: (apiToken: string) =>
      api.post<{ balances: WiseBalanceOption[] }>("/integrations/wise/balances", { apiToken }),
    onSuccess: (data) => {
      setError(null);
      if (data.balances.length === 0) {
        setError(t("settings.wiseNoBalance"));
        return;
      }
      setBalances(data.balances);
      setSelectedBalanceId(data.balances[0].id);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("settings.wiseTokenError")),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      api.post<{ connected: boolean; currency: string; imported: number; warning?: string }>(
        "/integrations/wise/connect",
        { apiToken: token, balanceId: selectedBalanceId }
      ),
    onSuccess: (data) => {
      setError(data.warning ?? null);
      setToken("");
      setBalances(null);
      setSelectedBalanceId(null);
      setMessage(t("settings.wiseConnectedMessage", { currency: data.currency, imported: data.imported }));
      queryClient.invalidateQueries({ queryKey: ["integrations", "wise", "status"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("settings.wiseConnectError")),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<{ imported: number; recategorized: number }>("/integrations/wise/sync"),
    onSuccess: (data) => {
      setError(null);
      const parts = [t("settings.wiseImportedMessage", { imported: data.imported })];
      if (data.recategorized > 0) {
        parts.push(t("settings.wiseRecategorizedMessage", { count: data.recategorized }));
      }
      setMessage(`${t("settings.wiseSyncedPrefix")} ${parts.join(" ")}`);
      queryClient.invalidateQueries({ queryKey: ["integrations", "wise", "status"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("settings.wiseSyncError")),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/integrations/wise"),
    onSuccess: () => {
      setError(null);
      setMessage(null);
      queryClient.invalidateQueries({ queryKey: ["integrations", "wise", "status"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("settings.wiseDisconnectError")),
  });

  function handleValidate(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!token.trim()) return;
    balancesMutation.mutate(token.trim());
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("settings.wiseTitle")}</h2>
      <p className="mt-1 text-xs text-slate-400">{t("settings.wiseDescription")}</p>

      {status?.connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-emerald-600">
            {t("settings.wiseConnectedStatus", { currency: status.currency ?? "" })}{" "}
            {status.lastSyncedAt
              ? t("settings.wiseLastSync", {
                  date: new Date(status.lastSyncedAt).toLocaleString(language === "en" ? "en-US" : "es-MX"),
                })
              : t("settings.wiseNeverSynced")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? t("settings.wiseSyncing") : t("settings.wiseSyncNow")}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              {t("settings.wiseDisconnect")}
            </Button>
          </div>
        </div>
      ) : balances ? (
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="wiseBalance">{t("settings.wiseBalanceLabel")}</Label>
            <Select
              id="wiseBalance"
              value={selectedBalanceId ?? ""}
              onChange={(e) => setSelectedBalanceId(Number(e.target.value))}
            >
              {balances.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.currency} ({b.amount.toFixed(2)})
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setBalances(null);
                setSelectedBalanceId(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
              {connectMutation.isPending ? t("settings.wiseConnecting") : t("settings.wiseConfirmConnect")}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleValidate} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="wiseToken">{t("settings.wiseTokenLabel")}</Label>
            <Input
              id="wiseToken"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("settings.wiseTokenPlaceholder")}
            />
          </div>
          <Button type="submit" disabled={balancesMutation.isPending}>
            {balancesMutation.isPending ? t("settings.wiseValidating") : t("common.continue")}
          </Button>
        </form>
      )}

      <ErrorText>{error}</ErrorText>
      {message && <p className="mt-2 text-xs text-emerald-600">{message}</p>}
    </Card>
  );
}
