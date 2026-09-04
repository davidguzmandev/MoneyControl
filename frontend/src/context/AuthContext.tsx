import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSettings: (data: Partial<Pick<User, "name" | "cycleStartDay" | "currency" | "savingsGoal">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { user } = await api.get<{ user: User }>("/auth/me");
        return user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      api.post<{ user: User }>("/auth/login", vars),
    onSuccess: ({ user }) => queryClient.setQueryData(["me"], user),
  });

  const registerMutation = useMutation({
    mutationFn: (vars: { email: string; password: string; name: string }) =>
      api.post<{ user: User }>("/auth/register", vars),
    onSuccess: ({ user }) => queryClient.setQueryData(["me"], user),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSuccess: () => queryClient.setQueryData(["me"], null),
  });

  const settingsMutation = useMutation({
    mutationFn: (data: Partial<Pick<User, "name" | "cycleStartDay" | "currency" | "savingsGoal">>) =>
      api.patch<{ user: User }>("/auth/me", data),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["me"], user);
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    login: async (email, password) => {
      await loginMutation.mutateAsync({ email, password });
    },
    register: async (email, password, name) => {
      await registerMutation.mutateAsync({ email, password, name });
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    updateSettings: async (data) => {
      await settingsMutation.mutateAsync(data);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
