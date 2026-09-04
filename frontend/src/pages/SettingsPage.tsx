import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
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
    </div>
  );
}
