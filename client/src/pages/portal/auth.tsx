import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  loginCustomer,
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
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", policyId: "" });

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
      onAuthenticated({ customer: result.customer, policies: result.policies, contracts: result.contracts });
    } else {
      toast({ title: "Sign in failed", description: result.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-2xl shadow-2xl border-slate-700 bg-slate-900/90 backdrop-blur">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-white">BH Auto Protect Portal</CardTitle>
          <CardDescription className="text-slate-300">
            Access your coverage documents, submit claims, and keep your payment preferences up to date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Already have a policy?</p>
              <p>
                Your customer portal account is automatically created for you. Sign in using the email on your
                policy and the policy ID that appears on your documents.
              </p>
            </div>
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
                <Label className="text-slate-200" htmlFor="login-policy">
                  Policy ID
                </Label>
                <Input
                  id="login-policy"
                  autoComplete="off"
                  placeholder="Enter your policy ID"
                  value={loginForm.policyId}
                  onChange={(event) => setLoginForm({ ...loginForm, policyId: event.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
