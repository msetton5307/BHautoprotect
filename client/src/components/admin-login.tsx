import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { login, clearCredentials, getStoredUsername, checkSession } from "@/lib/auth";

type Props = {
  onSuccess: () => void;
};

export default function AdminLogin({ onSuccess }: Props) {
  const [username, setUsername] = useState(getStoredUsername() ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    checkSession()
      .then((isLoggedIn) => {
        if (!active) return;
        if (isLoggedIn) {
          onSuccess();
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login({ username, password });
    setLoading(false);

    if (result.success) {
      setPassword("");
      setError("");
      onSuccess();
    } else {
      clearCredentials();
      setError(result.message);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_bottom_right,rgba(14,116,144,0.18),transparent_55%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full items-center justify-center px-6 py-12 sm:px-8 lg:px-12">
        <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-white shadow-2xl backdrop-blur-lg">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-medium tracking-wide">
              Welcome back
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
              Manage BH Auto Protect with confidence
            </h1>
            <p className="mt-4 max-w-md text-base text-slate-200/80">
              Securely access your administrative tools, keep track of your customers, and respond to new opportunities the moment they arrive.
            </p>
            <Separator className="mt-8 border-white/10" />
            <div className="mt-8 grid gap-6 text-sm text-slate-100/80 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="font-medium text-white">Real-time dashboards</p>
                <p className="mt-1 text-slate-200/70">Track leads, policies, and claims in a single glance.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="font-medium text-white">Secure by design</p>
                <p className="mt-1 text-slate-200/70">Multi-layer authentication keeps sensitive data protected.</p>
              </div>
            </div>
          </div>

          <Card className="relative rounded-3xl border border-slate-200/70 bg-white/95 shadow-2xl backdrop-blur-sm">
            <CardHeader className="space-y-2 pb-0">
              <CardTitle className="text-2xl font-semibold text-slate-900">Administrator Access</CardTitle>
              <CardDescription className="text-base text-slate-500">
                Log in with your secure credentials to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-10 pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600" htmlFor="username">
                    Username
                  </label>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    autoComplete="username"
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}
                <Button type="submit" className="h-12 w-full text-base font-medium" disabled={loading}>
                  {loading ? "Logging in..." : "Sign in"}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-400">
                Having trouble signing in? Contact the BH Auto Protect support team.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
