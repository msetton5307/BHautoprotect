import Navigation from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

const claimFormSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Required"),
  message: z.string().min(1, "Required"),
});

type ClaimForm = z.infer<typeof claimFormSchema>;

export default function Claims() {
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
    formState: { errors, isSubmitting },
  } = form;

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
    } catch (error) {
      toast({ title: 'Submission failed', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1500&q=80"
            alt="Road"
            className="w-full h-64 object-cover"
          />
          <div className="absolute inset-0 bg-primary/80" />
        </div>
        <div className="relative h-64 flex items-center justify-center">
          <h1 className="text-4xl font-bold text-white">CLAIMS</h1>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          <div className="flex items-start space-x-4 bg-white p-6 rounded-lg shadow-sm">
            <div className="bg-primary/10 p-3 rounded-full">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Have a Claim?</h2>
              <p className="text-gray-600 text-sm">
                Fill out the form and our team will reach out shortly.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4 bg-white p-6 rounded-lg shadow-sm">
            <div className="bg-primary/10 p-3 rounded-full">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Email Us Directly</h2>
              <p className="text-gray-600 text-sm">
                <a href="mailto:claims@bhautoprotect.com" className="text-primary">
                  claims@bhautoprotect.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-2">Need Assistance?</h2>
            <p className="text-gray-600 mb-6">Send us a message and we'll get back to you.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
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
                  placeholder="How can we help?"
                  {...register("message")}
                />
                {errors.message && (
                  <p className="text-sm font-medium text-destructive">{errors.message.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "SUBMIT YOUR MESSAGE"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

