import { useCallback, useEffect, useState } from "react";
import Navigation from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, HelpCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import CustomerPortalAuth from "@/pages/portal/auth";
import { checkCustomerSession, type CustomerSessionSnapshot } from "@/lib/customer-auth";

const claimFormSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Required"),
  message: z.string().min(1, "Required"),
});

type ClaimForm = z.infer<typeof claimFormSchema>;

export default function Claims() {
  const [session, setSession] = useState<CustomerSessionSnapshot | null | undefined>(undefined);
  const { toast } = useToast();
  const form = useForm<ClaimForm>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const fillFormFromSession = useCallback(
    (snapshot: CustomerSessionSnapshot) => {
      const leadWithContact = snapshot.policies.find((policy) => policy.lead)?.lead;
      setValue("email", snapshot.customer.email, { shouldDirty: false });
      if (leadWithContact?.firstName) {
        setValue("firstName", leadWithContact.firstName, { shouldDirty: false });
      }
      if (leadWithContact?.lastName) {
        setValue("lastName", leadWithContact.lastName, { shouldDirty: false });
      }
      if (leadWithContact?.phone) {
        setValue("phone", leadWithContact.phone, { shouldDirty: false });
      }
    },
    [setValue],
  );

  useEffect(() => {
    let active = true;
    checkCustomerSession()
      .then((snapshot) => {
        if (!active) return;
        setSession(snapshot);
        if (snapshot) {
          fillFormFromSession(snapshot);
        }
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
      });
    return () => {
      active = false;
    };
  }, [fillFormFromSession]);

  const handleAuthenticated = (snapshot: CustomerSessionSnapshot) => {
    setSession(snapshot);
    fillFormFromSession(snapshot);
  };

  const onSubmit = async (values: ClaimForm) => {
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Claim submitted', description: "We'll be in touch soon." });
      reset();
      if (session) {
        fillFormFromSession(session);
      }
    } catch (error) {
      toast({ title: 'Submission failed', variant: 'destructive' });
    }
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation onGetQuote={() => {}} />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-4 text-slate-600 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-medium">Checking your portal access…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navigation onGetQuote={() => {}} />
        <CustomerPortalAuth onAuthenticated={handleAuthenticated} variant="claims" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1500&q=80"
            alt="Road"
            className="h-64 w-full object-cover"
          />
          <div className="absolute inset-0 bg-primary/80" />
        </div>
        <div className="relative flex h-64 items-center justify-center">
          <div className="text-center text-white">
            <p className="text-sm uppercase tracking-[0.35em] text-white/70">BH Auto Protect</p>
            <h1 className="mt-2 text-4xl font-bold">Claims center</h1>
            <p className="mt-2 text-base font-medium text-white/80">
              You're signed in as {session.customer.displayName || session.customer.email}. Submit your claim details below.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <div className="flex items-start space-x-4 rounded-lg bg-white p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-3">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Need to start a claim?</h2>
              <p className="text-sm text-gray-600">
                Share a few details and our dedicated claims team will reach out with next steps.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4 rounded-lg bg-white p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Prefer email?</h2>
              <p className="text-sm text-gray-600">
                Reach us directly at{' '}
                <a href="mailto:claims@bhautoprotect.com" className="font-medium text-primary">
                  claims@bhautoprotect.com
                </a>
                {' '}and we'll respond within one business day.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-2">Tell us what happened</h2>
            <p className="text-gray-600 mb-6">
              Provide as much detail as you can so we can jump in quickly and support your repair process.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="First name"
                    autoComplete="given-name"
                    {...register("firstName")}
                  />
                  {errors.firstName && (
                    <p className="text-sm font-medium text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Last name"
                    autoComplete="family-name"
                    {...register("lastName")}
                  />
                  {errors.lastName && (
                    <p className="text-sm font-medium text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm font-medium text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-sm font-medium text-destructive">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={4}
                  placeholder="Share the incident details, timeline, and any helpful notes."
                  {...register("message")}
                />
                {errors.message && (
                  <p className="text-sm font-medium text-destructive">{errors.message.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit your claim"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

