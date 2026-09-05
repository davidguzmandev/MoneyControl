import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import type { Currency } from "../types";
import { Button, Card, ErrorText, Input, Label, Select } from "../components/ui";

const PRESETS = [
  { day: 1, label: "Del 1 al último día del mes" },
  { day: 15, label: "Del 15 al 14 del mes siguiente" },
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "USD", label: "USD: Dólar estadounidense" },
  { value: "COP", label: "COP: Peso colombiano" },
  { value: "MXN", label: "MXN: Peso mexicano" },
  { value: "CAD", label: "CAD: Dólar canadiense" },
];

export function SettingsPage() {
  const { user, updateSettings } = useAuth();
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
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la configuración");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-slate-500">Ajusta tu perfil, periodo de mes y moneda.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Periodo de tu mes</Label>
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
                  {preset.label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={customDay}
                  onChange={() => setCustomDay(true)}
                />
                Otro día de inicio
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
            <Label htmlFor="currency">Moneda</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">
            Tu presupuesto diario se calcula con lo que asignes a cada categoría de gasto en{" "}
            <span className="font-medium">Categorías</span>. Lo que asignes no puede superar tu ingreso
            del periodo, y lo que no gastes en un día se suma al siguiente.
          </div>

          <ErrorText>{error}</ErrorText>
          {success && <p className="text-sm text-emerald-600">Guardado correctamente.</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </Card>

      <WiseIntegrationCard />
    </div>
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
        setError("No se encontró ningún balance en tu cuenta de Wise");
        return;
      }
      setBalances(data.balances);
      setSelectedBalanceId(data.balances[0].id);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo validar el token"),
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
      setMessage(`Conectado en ${data.currency}. Se importaron ${data.imported} movimientos.`);
      queryClient.invalidateQueries({ queryKey: ["integrations", "wise", "status"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con Wise"),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<{ imported: number }>("/integrations/wise/sync"),
    onSuccess: (data) => {
      setError(null);
      setMessage(`Sincronizado. Se importaron ${data.imported} movimientos nuevos.`);
      queryClient.invalidateQueries({ queryKey: ["integrations", "wise", "status"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo sincronizar con Wise"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/integrations/wise"),
    onSuccess: () => {
      setError(null);
      setMessage(null);
      queryClient.invalidateQueries({ queryKey: ["integrations", "wise", "status"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo desconectar Wise"),
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
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Wise</h2>
      <p className="mt-1 text-xs text-slate-400">
        Conecta tu cuenta de Wise para importar tus movimientos automáticamente cada 15 minutos. Los
        ingresos se guardan en tu categoría "Salario" (así alimentan tu presupuesto igual que un ingreso
        manual) y los gastos en "Wise Gasto", para que los reclasifiques si quieres.
      </p>

      {status?.connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-emerald-600">
            Conectado (moneda de Wise: {status.currency}).{" "}
            {status.lastSyncedAt
              ? `Última sincronización: ${new Date(status.lastSyncedAt).toLocaleString("es-MX")}`
              : "Todavía no se ha sincronizado."}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              Desconectar
            </Button>
          </div>
        </div>
      ) : balances ? (
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="wiseBalance">Balance a sincronizar</Label>
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
              Cancelar
            </Button>
            <Button type="button" disabled={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
              {connectMutation.isPending ? "Conectando..." : "Confirmar y conectar"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleValidate} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="wiseToken">Token de API de Wise</Label>
            <Input
              id="wiseToken"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega tu token aquí"
            />
          </div>
          <Button type="submit" disabled={balancesMutation.isPending}>
            {balancesMutation.isPending ? "Validando..." : "Continuar"}
          </Button>
        </form>
      )}

      <ErrorText>{error}</ErrorText>
      {message && <p className="mt-2 text-xs text-emerald-600">{message}</p>}
    </Card>
  );
}
