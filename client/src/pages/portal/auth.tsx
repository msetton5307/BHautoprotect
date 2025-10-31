import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  loginCustomer,
  type AuthResult,
  type CustomerSessionSnapshot,
} from "@/lib/customer-auth";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, LockKeyhole, Mail, Phone, ShieldCheck } from "lucide-react";

type Props = {
  onAuthenticated: (session: CustomerSessionSnapshot) => void;
  variant?: "portal" | "claims";
};

function isSuccess(result: AuthResult): result is Extract<AuthResult, { success: true }> {
  return result.success;
}

export default function CustomerPortalAuth({ onAuthenticated, variant = "portal" }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", policyId: "" });

  const copy = useMemo(() => {
    if (variant === "claims") {
      return {
        badge: "Claims center access",
        title: "Sign in to continue your claim",
        description:
          "We just need to confirm your policy details before you can submit a claim. Log in with the email on file and your policy number to move forward.",
        formTitle: "Verify your policy",
        buttonLabel: "Access claims form",
      };
    }
    return {
      badge: "Customer portal",
      title: "Welcome back to BH Auto Protect",
      description:
        "Review your coverage, download documents, manage payments, and keep your protection on track—everything lives in one secure portal.",
      formTitle: "Sign in to your portal",
      buttonLabel: "Sign in",
    };
  }, [variant]);

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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-16 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950 via-slate-950/60" />
      </div>
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 lg:flex-row lg:items-center">
        <div className="space-y-8 lg:w-1/2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
            <LockKeyhole className="h-3.5 w-3.5" /> {copy.badge}
          </span>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{copy.title}</h1>
            <p className="text-base text-slate-300 sm:text-lg">{copy.description}</p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-medium">Your policy details are safe with us</p>
                <p className="text-slate-300/80">
                  We only use this login to match you to the right policy and protect your coverage information.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-medium">Find your policy number quickly</p>
                <p className="text-slate-300/80">
                  Your policy number lives in your welcome email and on any official BH Auto Protect documents.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-slate-900/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Need help signing in?</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <a className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white" href="mailto:support@bhautoprotect.com">
                  <Mail className="h-4 w-4" /> support@bhautoprotect.com
                </a>
                <a className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white" href="tel:+18339400234">
                  <Phone className="h-4 w-4" /> (833) 940-0234
                </a>
              </div>
              <p className="text-xs text-slate-400">
                Reach out and our support team will get you signed in or resend your policy information.
              </p>
            </div>
          </div>
        </div>
        <Card className="relative mx-auto w-full max-w-md border-slate-800/60 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-slate-950/50">
          <CardHeader className="space-y-1 text-left">
            <CardTitle className="text-2xl font-semibold text-white">{copy.formTitle}</CardTitle>
            <CardDescription className="text-sm text-slate-300">
              Enter the email on your policy and the matching policy number to confirm your identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
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
                  className="border-slate-700 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus:border-primary focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200" htmlFor="login-policy">
                  Policy number
                </Label>
                <Input
                  id="login-policy"
                  autoComplete="off"
                  placeholder="Policy number"
                  value={loginForm.policyId}
                  onChange={(event) => setLoginForm({ ...loginForm, policyId: event.target.value })}
                  className="border-slate-700 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus:border-primary focus:ring-primary"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking details..." : copy.buttonLabel}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-slate-800/60 bg-slate-900/70 p-6 text-sm text-slate-300">
            <p>
              Keep an eye on your inbox—we send important coverage updates to the email tied to your policy.
            </p>
            <p className="text-xs text-slate-500">
              Having trouble locating your policy number? Search your email for "BH Auto Protect" or contact our support
              team and we'll resend your documents.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
