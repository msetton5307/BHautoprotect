import Navigation from "@/components/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowUpRight,
  CreditCard,
  FileCheck,
  LifeBuoy,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

export default function FAQ() {
  const heroHighlights = [
    {
      icon: Sparkles,
      title: "95%",
      subtitle: "Claims approved on first submission",
    },
    {
      icon: LifeBuoy,
      title: "24/7",
      subtitle: "Emergency roadside assistance included",
    },
    {
      icon: ShieldCheck,
      title: "50+ components",
      subtitle: "Protected across major vehicle systems",
    },
    {
      icon: CreditCard,
      title: "Flexible",
      subtitle: "Payment options with no surprise fees",
    },
  ];

  const supportActions = [
    {
      icon: FileCheck,
      label: "Compare protection plans",
      description: "See coverage levels side-by-side",
      href: "/plans",
    },
    {
      icon: Wrench,
      label: "File a new claim",
      description: "Start the process in under five minutes",
      href: "/claims",
    },
    {
      icon: PhoneCall,
      label: "Talk with an advisor",
      description: "We'll connect you with a specialist",
      href: "tel:+18339400234",
    },
  ];

  const faqSections = [
    {
      title: "Coverage & Protection",
      description: "Understand how BH Auto Protect keeps you on the road.",
      icon: ShieldCheck,
      faqs: [
        {
          question: "What is an extended warranty?",
          answer:
            "An extended warranty, or vehicle service contract, covers repair costs after your manufacturer's warranty expires, so unexpected breakdowns don't derail your plans.",
        },
        {
          question: "What's covered by BH Auto Protect?",
          answer:
            "We offer plans that cover major components like engines, transmissions, electrical systems, air conditioning, and high-tech features. Coverage varies by plan so you can match the protection to your vehicle.",
        },
        {
          question: "Can I transfer my coverage?",
          answer:
            "Yes, most plans are transferable if you sell your vehicle. Transferring the remaining coverage can increase its resale value and give the next owner added peace of mind.",
        },
        {
          question: "Can I choose my own repair shop?",
          answer:
            "Absolutely. You can visit any licensed repair facility in the United States or Canada and we’ll work directly with them to settle the invoice.",
        },
      ],
    },
    {
      title: "Getting Started",
      description: "Everything you need to enroll with confidence.",
      icon: FileCheck,
      faqs: [
        {
          question: "How do I get a quote?",
          answer:
            'Click the "Get My Quote" button or call our team to receive a fast, personalized quote tailored to your vehicle, mileage, and driving habits.',
        },
        {
          question: "Is there a deductible?",
          answer:
            "Deductible amounts vary by plan. Choose the option that works best for your budget — from $0 deductibles to lower monthly payments with a small copay per repair.",
        },
        {
          question: "Are there financing options?",
          answer:
            "Yes. Flexible payment plans let you spread the cost of coverage over time with automated payments and no early payoff penalties.",
        },
      ],
    },
    {
      title: "Support & Claims",
      description: "We're here when you need help the most.",
      icon: LifeBuoy,
      faqs: [
        {
          question: "Do you offer roadside assistance?",
          answer:
            "Many of our plans include roadside assistance for services like towing, battery jumps, and flat tire changes so you're never stranded.",
        },
        {
          question: "What's the claims process like?",
          answer:
            "Simply contact us or your plan administrator before repairs. We'll coordinate directly with the repair facility, handle payment, and keep you updated every step of the way.",
        },
      ],
    },
  ];

  const checklist = [
    "Have your Vehicle Identification Number (VIN) handy",
    "Note your current mileage and recent maintenance",
    "Keep your preferred repair facility's contact information nearby",
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation onGetQuote={() => {}} />
      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" aria-hidden />
          <div className="absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-secondary/20 blur-[140px]" aria-hidden />
          <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" aria-hidden />
        </div>

        <section className="relative pt-20 pb-16 sm:pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
              <div className="flex-1 space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-200/80">
                  Support Center
                </div>
                <div className="space-y-5">
                  <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                    Answers that keep your coverage running smoothly
                  </h1>
                  <p className="max-w-2xl text-lg text-slate-300">
                    Browse our most asked questions, explore coverage options, and connect with a specialist — all in one place. We're committed to keeping every journey protected.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:max-w-xl">
                  {heroHighlights.map((highlight) => (
                    <div
                      key={highlight.title}
                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 px-5 py-6 shadow-lg shadow-slate-900/30 backdrop-blur"
                    >
                      <div className="absolute -top-10 right-0 h-24 w-24 rounded-full bg-white/10 blur-3xl" aria-hidden />
                      <div className="relative flex items-start gap-4">
                        <div className="rounded-2xl bg-primary/20 p-3 text-primary">
                          <highlight.icon className="h-5 w-5" aria-hidden />
                        </div>
                        <div>
                          <p className="text-2xl font-semibold text-white">{highlight.title}</p>
                          <p className="text-sm text-slate-300">{highlight.subtitle}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1">
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/90 via-secondary/80 to-slate-900 p-8 shadow-2xl shadow-slate-900/60 sm:p-10">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_65%)] opacity-40" aria-hidden />
                  <div className="relative space-y-6">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/80">
                        Need immediate help?
                      </p>
                      <h2 className="text-2xl font-semibold sm:text-3xl">Talk to a protection specialist</h2>
                      <p className="text-sm text-slate-100/80">
                        Our US-based experts are ready to walk you through coverage, claims, and everything in between.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <a
                        href="tel:+18339400234"
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-5 py-4 text-left text-base font-semibold text-white transition hover:bg-white/20"
                      >
                        <span className="flex items-center gap-3">
                          <PhoneCall className="h-5 w-5" aria-hidden />
                          Call (833) 940-0234
                        </span>
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </a>
                      <a
                        href="mailto:hello@bhautoprotect.com"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/5 px-5 py-4 text-left text-base font-semibold text-white transition hover:bg-white/10"
                      >
                        <span className="flex items-center gap-3">
                          <MessageCircle className="h-5 w-5" aria-hidden />
                          Email hello@bhautoprotect.com
                        </span>
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </a>
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/70">
                      Weekdays 8am – 8pm ET · Saturday 9am – 4pm ET
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative pb-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr] lg:gap-12">
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
                  <h3 className="text-xl font-semibold text-white">Quick assistance</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Prefer a human touch? These resources connect you directly with our team and the tools we rely on every day.
                  </p>
                  <div className="mt-6 space-y-3">
                    {supportActions.map((action) => (
                      <a
                        key={action.label}
                        href={action.href}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4 text-sm text-slate-200 transition hover:border-white/30 hover:bg-slate-900/80"
                      >
                        <span className="flex items-center gap-3">
                          <span className="rounded-2xl bg-white/10 p-2 text-primary">
                            <action.icon className="h-5 w-5" aria-hidden />
                          </span>
                          <span>
                            <span className="block text-base font-semibold text-white">{action.label}</span>
                            <span className="text-xs text-slate-400">{action.description}</span>
                          </span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-white" aria-hidden />
                      </a>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.04] to-transparent p-8 shadow-xl shadow-slate-900/30 backdrop-blur">
                  <h3 className="text-xl font-semibold text-white">Checklist for faster answers</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Gather these details so our specialists can resolve your questions without any back-and-forth.
                  </p>
                  <ul className="mt-6 space-y-4 text-sm text-slate-300">
                    {checklist.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-0.5 rounded-full bg-primary/20 p-1 text-primary">
                          <Sparkles className="h-4 w-4" aria-hidden />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-8">
                {faqSections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur sm:p-8"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <span className="rounded-2xl bg-primary/20 p-3 text-primary">
                          <section.icon className="h-6 w-6" aria-hidden />
                        </span>
                        <div>
                          <h2 className="text-lg font-semibold text-white sm:text-xl">{section.title}</h2>
                          <p className="text-sm text-slate-300">{section.description}</p>
                        </div>
                      </div>
                    </div>
                    <Accordion type="single" collapsible className="mt-6 space-y-3">
                      {section.faqs.map((faq) => (
                        <AccordionItem
                          key={faq.question}
                          value={faq.question}
                          className="border-none rounded-2xl bg-slate-900/70 shadow-md shadow-slate-900/40 ring-1 ring-white/10"
                        >
                          <AccordionTrigger className="px-4 py-4 text-left text-base font-semibold text-white transition hover:text-primary sm:text-lg">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-6 text-sm leading-relaxed text-slate-300 sm:text-base">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
