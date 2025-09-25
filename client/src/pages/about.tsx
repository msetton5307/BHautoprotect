import Navigation from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Users,
  Clock,
  Award,
  HeartHandshake,
  MapPin,
  Phone,
  Mail,
  Sparkles,
} from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-100">
      <Navigation onGetQuote={() => {}} />
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-16">
        <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-blue-100 p-12 text-center shadow-2xl">
          <Sparkles className="absolute -top-6 -left-6 h-24 w-24 text-primary/10" />
          <Sparkles className="absolute -bottom-10 -right-4 h-32 w-32 text-primary/5" />
          <div className="mx-auto max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-sm font-semibold uppercase tracking-wide text-primary">
              Driven by trust • Powered by protection
            </span>
            <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">
              Peace of mind for every mile you drive.
            </h1>
            <div className="grid gap-3 text-left text-slate-600 md:grid-cols-2">
              <p className="rounded-2xl border border-blue-100 bg-white/80 p-4 text-sm font-medium uppercase tracking-wide text-slate-700">
                Specialists in extended vehicle protection plans tailored for real drivers.
              </p>
              <p className="rounded-2xl border border-blue-100 bg-white/80 p-4 text-sm font-medium uppercase tracking-wide text-slate-700">
                Transparent pricing, quick responses, and nationwide repair partnerships you can rely on.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <Card className="border-blue-100 bg-white/90">
            <CardContent className="p-8 text-center space-y-4">
              <Shield className="mx-auto h-12 w-12 text-primary" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900">Coverage without confusion</h3>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Engine, transmission, electronics, and luxury tech components</li>
                  <li>• Plans tuned for new daily drivers and seasoned classics alike</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-white/90">
            <CardContent className="p-8 text-center space-y-4">
              <Users className="mx-auto h-12 w-12 text-primary" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900">People-first guidance</h3>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Real humans answering questions in minutes, not hours</li>
                  <li>• Dedicated concierge team for claims and repair scheduling</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-white/90">
            <CardContent className="p-8 text-center space-y-4">
              <Clock className="mx-auto h-12 w-12 text-primary" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900">Rapid resolution</h3>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Instant roadside assistance &amp; rental support options</li>
                  <li>• Partner network of ASE-certified shops nationwide</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8 rounded-3xl border border-blue-100 bg-white/90 p-10 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-900">What keeps us in the fast lane</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <Award className="mb-3 h-8 w-8 text-primary" />
                <h3 className="text-lg font-semibold text-slate-900">15+ years of proven protection</h3>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  <li>• 32,000+ active contracts serviced nationwide</li>
                  <li>• Partnerships with top-rated finance &amp; dealer groups</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <HeartHandshake className="mb-3 h-8 w-8 text-primary" />
                <h3 className="text-lg font-semibold text-slate-900">Promises we keep every day</h3>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  <li>• Transparent terms with zero surprise fees</li>
                  <li>• 24/7 claim intake with live status updates</li>
                </ul>
              </div>
            </div>
            <div className="grid gap-4 rounded-2xl border border-blue-100 bg-white/80 p-6 text-sm text-slate-600 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary">Our north star</p>
                <ul className="mt-2 space-y-1">
                  <li>• Keep repairs affordable</li>
                  <li>• Keep drivers confident</li>
                  <li>• Keep promises visible</li>
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-primary">How we deliver</p>
                <ul className="mt-2 space-y-1">
                  <li>• Real-time plan customization</li>
                  <li>• Concierge claim coordination</li>
                  <li>• Nationwide repair partnerships</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-blue-100 bg-blue-50 p-8 text-left">
            <h3 className="text-xl font-semibold text-slate-900">Quick company snapshot</h3>
            <ul className="space-y-4 text-sm text-slate-600">
              <li>
                <span className="block text-xs uppercase tracking-wide text-primary">Headquarters</span>
                Austin, Texas
              </li>
              <li>
                <span className="block text-xs uppercase tracking-wide text-primary">Founded</span>
                2009 — family-owned and operated
              </li>
              <li>
                <span className="block text-xs uppercase tracking-wide text-primary">Focus</span>
                Extended auto warranties, roadside support, rental coverage
              </li>
            </ul>
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-left">
              <p className="text-xs uppercase tracking-wide text-primary">Ready when you are</p>
              <p className="mt-2 text-sm text-slate-900">
                Need a tailored plan? Let us build one that fits your driving style and budget.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-blue-100 bg-white/90 p-10 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-900">Visit or connect with us</h2>
            <p className="text-sm uppercase tracking-wide text-primary">Our flagship service center</p>
            <div className="space-y-3 text-sm text-slate-600">
              <p className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 p-4">
                <MapPin className="h-5 w-5 text-primary" />
                <span>BH Auto Protect, 800 N King St, Suite 304-2390, Wilmington, DE 19801</span>
              </p>
              <p className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 p-4">
                <Phone className="h-5 w-5 text-primary" />
                <span>Service hotline: (855) 555-2746</span>
              </p>
              <p className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 p-4">
                <Mail className="h-5 w-5 text-primary" />
                <span>Support: support@bhautoprotect.com</span>
              </p>
            </div>
          </div>
          <div className="grid content-between gap-6 rounded-2xl border border-blue-100 bg-white/80 p-8 text-sm text-slate-600">
            <div>
              <p className="text-xs uppercase tracking-wide text-primary">Hours</p>
              <ul className="mt-2 space-y-1">
                <li>• Monday – Friday: 8:00 AM – 7:00 PM CST</li>
                <li>• Saturday: 9:00 AM – 2:00 PM CST</li>
                <li>• Emergency claims team: 24/7</li>
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-primary">Need help fast?</p>
              <ul className="mt-2 space-y-1">
                <li>• Text “PROTECT” to 41745 for plan updates</li>
                <li>• Email docs to claims@bhautoprotect.com</li>
                <li>• Dealer inquiries: partners@bhautoprotect.com</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

