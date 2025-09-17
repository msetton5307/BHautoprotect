import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  loginCustomer,
  registerCustomer,
  type AuthResult,
  type CustomerSessionSnapshot,
} from "@/lib/customer-auth";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onAuthenticated: (session: CustomerSessionSnapshot) => void;
};

function isSuccess(result: AuthResult): result is Extract<AuthResult, { success: true }> {
  return result.success;
}

export default function CustomerPortalAuth({ onAuthenticated }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    policyId: "",
    displayName: "",
  });

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const result = await loginCustomer(loginForm);
    setLoading(false);

    if (isSuccess(result)) {
      toast({
        title: "Welcome back",
        description: "You are now signed in to your policy portal.",
      });
      onAuthenticated({ customer: result.customer, policies: result.policies });
    } else {
      toast({ title: "Login failed", description: result.message, variant: "destructive" });
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setLoading(true);
    const result = await registerCustomer({
      email: registerForm.email,
      password: registerForm.password,
      policyId: registerForm.policyId,
      displayName: registerForm.displayName || undefined,
    });
    setLoading(false);

    if (isSuccess(result)) {
      toast({
        title: "Account created",
        description: "Your customer portal is ready to use.",
      });
      onAuthenticated({ customer: result.customer, policies: result.policies });
    } else {
      toast({ title: "Registration failed", description: result.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-2xl shadow-2xl border-slate-700 bg-slate-900/90 backdrop-blur">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-white">BH Auto Protect Portal</CardTitle>
          <p className="text-slate-300 text-sm">
            Access your coverage documents, submit claims, and keep your payment preferences up to date.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-200" htmlFor="login-email">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200" htmlFor="login-password">
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-200" htmlFor="register-email">
                      Email
                    </Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200" htmlFor="register-policy">
                      Policy Number
                    </Label>
                    <Input
                      id="register-policy"
                      placeholder="Enter your policy ID"
                      value={registerForm.policyId}
                      onChange={(event) => setRegisterForm({ ...registerForm, policyId: event.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200" htmlFor="register-display-name">
                    Preferred Display Name (optional)
                  </Label>
                  <Input
                    id="register-display-name"
                    placeholder="How should we address you?"
                    value={registerForm.displayName}
                    onChange={(event) => setRegisterForm({ ...registerForm, displayName: event.target.value })}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-200" htmlFor="register-password">
                      Password
                    </Label>
                    <Input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      value={registerForm.password}
                      onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200" htmlFor="register-confirm">
                      Confirm Password
                    </Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={registerForm.confirmPassword}
                      onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
