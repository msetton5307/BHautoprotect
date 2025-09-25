import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Star,
  Shield,
  Award,
  Check,
  Users,
  FileText,
  Clock,
  DollarSign,
  Sparkle,
  Gauge,
  Wrench,
} from "lucide-react";
import Navigation from "@/components/navigation";
import QuoteModal from "@/components/quote-modal";
import { COVERAGE_PLANS } from "@/lib/constants";

const heroStats = [
  { label: "Drivers Protected", value: "100K+" },
  { label: "Claims Approved", value: "92%" },
  { label: "Avg. Savings", value: "$3,200" },
  { label: "Repair Network", value: "30K+" },
];

const whyChooseUs = [
  {
    icon: Users,
    title: "Personalized Plans",
    description:
      "Select coverage built around your mileage, driving habits, and budget with the help of our specialists.",
  },
  {
    icon: Clock,
    title: "Rapid Claim Approvals",
    description: "Average claim turnaround is under 24 hours with direct payment to your repair facility.",
  },
  {
    icon: DollarSign,
    title: "Transparent Savings",
    description: "No hidden fees or surprise surcharges—just clear pricing and flexible monthly options.",
  },
  {
    icon: FileText,
    title: "Concierge Support",
    description: "Dedicated advisors guide you from plan selection to service scheduling and beyond.",
  },
];

const howItWorks = [
  {
    title: "Enter Vehicle Info",
    description: "Tell us about your vehicle—year, make, model, and mileage. Takes less than 2 minutes.",
  },
  {
    title: "Compare Plans",
    description: "View personalized coverage options with crystal-clear details. Choose what fits your lifestyle.",
  },
  {
    title: "Get Protected",
    description: "Complete your application online and receive instant coverage confirmation.",
  },
];

const testimonials = [
  {
    quote:
      "BH Auto Protect saved me thousands when my transmission failed. The claim process was smooth and they covered everything as promised. Highly recommend!",
    name: "Jennifer Martinez",
    role: "Honda Accord Owner",
    image:
      "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
  },
  {
    quote:
      "Great customer service and support. When my car broke down, they handled everything professionally. The roadside assistance was a lifesaver!",
    name: "Robert Johnson",
    role: "Ford F-150 Owner",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
  },
  {
    quote:
      "Easy online process and transparent service. No hidden fees or surprises. They've covered multiple repairs and always deliver on their promises.",
    name: "Lisa Thompson",
    role: "Toyota Camry Owner",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
  },
];

const fadeIn = (delay = 0) => ({
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      delay,
      ease: [0.215, 0.61, 0.355, 1],
    },
  },
});

const subtleUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function Landing() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const openQuoteModal = () => setIsQuoteModalOpen(true);
  const closeQuoteModal = () => setIsQuoteModalOpen(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <Navigation onGetQuote={openQuoteModal} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-slate-900 opacity-90" aria-hidden />
        <div className="absolute -top-20 -right-32 h-72 w-72 rounded-full bg-blue-400/40 blur-3xl" aria-hidden />
        <div className="absolute bottom-0 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-cyan-400/40 blur-3xl" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeIn(0.1)} className="text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium uppercase tracking-[0.3em] text-blue-100 backdrop-blur">
                <Sparkle className="w-4 h-4" /> Premium Protection Plans
              </div>
              <h1 className="mt-6 text-4xl md:text-5xl lg:text-[56px] font-black leading-tight tracking-tight">
                Elevate Your Driving Confidence with Extended Warranty Coverage
              </h1>
              <p className="mt-6 text-lg md:text-xl text-blue-100 max-w-2xl">
                Tailored protection, lightning-fast claims, and concierge-level care. Over 100,000 drivers trust BH Auto Protect
                to keep them moving with zero surprises.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
                <Button
                  size="lg"
                  className="px-9 py-6 text-lg font-semibold bg-white text-primary hover:bg-blue-50 shadow-lg shadow-blue-900/20"
                  onClick={openQuoteModal}
                >
                  Get My Free Quote
                </Button>
                <div className="flex items-center gap-3 text-sm text-blue-100">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="max-w-[200px]">ASE-certified support & repairs covered nationwide</span>
                </div>
              </div>
              <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
                {heroStats.map((stat) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-blue-200">{stat.label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, ease: [0.19, 1, 0.22, 1] }}
              className="relative"
            >
              <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-white/20 via-white/5 to-transparent blur-xl" aria-hidden />
              <div className="relative rounded-[28px] border border-white/20 bg-white/10 backdrop-blur-lg shadow-2xl shadow-blue-900/20 overflow-hidden">
                <img
                  src="https://cdn.mos.cms.futurecdn.net/xCJhXa8uGzbwrhJP95BoRM.jpg"
                  alt="Modern car dashboard"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-6 grid gap-4 text-sm text-white">
                <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                  <span className="flex items-center gap-2 font-semibold">
                    <Gauge className="w-4 h-4" /> 24/7 Roadside Assistance
                  </span>
                  <span className="text-blue-100">Included</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                  <span className="flex items-center gap-2 font-semibold">
                    <Wrench className="w-4 h-4" /> Repairs Paid Directly
                  </span>
                  <span className="text-blue-100">Nationwide</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <motion.section
        className="bg-white py-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={subtleUp}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-500">
              Trusted By Industry Leaders
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 items-center justify-items-center text-gray-600">
            <div className="flex items-center justify-center h-12 text-2xl font-bold">A+ Rating</div>
            <div className="flex items-center justify-center h-12 gap-2 text-lg font-semibold">
              <Shield className="w-7 h-7 text-green-500" /> Secure
            </div>
            <div className="flex items-center justify-center h-12 text-xl font-bold">ASE Certified</div>
            <div className="flex items-center justify-center h-12 gap-2 text-lg font-semibold">
              <Award className="w-7 h-7 text-yellow-500" /> Award Winner
            </div>
            <div className="flex items-center justify-center h-12 text-xl font-bold">BBB A+</div>
          </div>
        </div>
      </motion.section>

      {/* Why Choose Us */}
      <motion.section
        className="py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
        variants={fadeIn(0.1)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              Why Choose BH Auto Protect
            </span>
            <h2 className="mt-6 text-3xl md:text-4xl font-bold text-gray-900">
              Concierge-Level Protection Designed Around the Way You Drive
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From customizable plans to transparent pricing, our experts make extended coverage effortless—and beautiful—for every
              vehicle and lifestyle.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                  className="relative h-full rounded-3xl border border-blue-100 bg-white p-8 shadow-[0px_24px_60px_-35px_rgba(37,99,235,0.45)] transition-transform duration-500 hover:-translate-y-2"
                >
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        className="py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeIn(0.1)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Get covered in three simple steps</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-10 text-center shadow-[0_40px_80px_-45px_rgba(15,23,42,0.45)]"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden
                />
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl font-bold text-primary">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold mb-4">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Plan Comparison */}
      <motion.section
        id="plans"
        className="bg-white py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeIn(0.1)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Choose Your Protection Level</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Comprehensive coverage options for every budget</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {["basic", "gold", "silver"].map((tier, index) => {
              const plan = COVERAGE_PLANS[tier as keyof typeof COVERAGE_PLANS];
              const highlight = tier === "gold";

              return (
                <motion.div
                  key={tier}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.12, ease: "easeOut" }}
                  className="h-full"
                >
                  <Card
                    className={`relative h-full overflow-hidden rounded-3xl border ${
                      highlight
                        ? "border-primary shadow-[0_45px_90px_-40px_rgba(37,99,235,0.55)]"
                        : "border-gray-200/70 shadow-[0_40px_80px_-45px_rgba(15,23,42,0.25)]"
                    } transition-transform duration-500 hover:-translate-y-2`}
                  >
                    {highlight && (
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary via-secondary to-primary px-6 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-lg">
                        Most Popular
                      </div>
                    )}
                    <CardContent className={`p-10 ${highlight ? "pt-16" : ""}`}>
                      <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                        {plan.description && (
                          <p className="text-sm font-semibold text-primary uppercase tracking-[0.3em]">{plan.description}</p>
                        )}
                      </div>
                      <ul className="space-y-4 mb-10 text-left">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3 text-gray-700">
                            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50">
                              <Check className="w-4 h-4 text-primary" />
                            </span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`w-full ${
                          highlight
                            ? "bg-gradient-to-r from-primary via-secondary to-primary text-white"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                        size="lg"
                        onClick={openQuoteModal}
                      >
                        Get a Quote
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Customer Reviews */}
      <motion.section
        className="py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeIn(0.1)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <div className="flex justify-center items-center space-x-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-gray-600">4.8 out of 5 based on 2,341 reviews</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                className="h-full"
              >
                <Card className="h-full rounded-3xl border border-blue-50 shadow-[0_35px_90px_-50px_rgba(37,99,235,0.75)]">
                  <CardContent className="p-10 flex flex-col h-full">
                    <div className="flex items-center mb-6 text-primary">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-gray-600 mb-8 leading-relaxed">“{testimonial.quote}”</p>
                    <div className="mt-auto flex items-center">
                      <img
                        src={testimonial.image}
                        alt={`Portrait of ${testimonial.name}`}
                        className="w-12 h-12 rounded-full object-cover mr-4"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">{testimonial.name}</p>
                        <p className="text-sm text-gray-500">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* FAQ Section */}
      <motion.section
        className="bg-white py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeIn(0.1)}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600">Get answers to common questions about extended warranties</p>
          </div>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border border-blue-100 rounded-2xl px-6">
              <AccordionTrigger className="text-left hover:no-underline text-lg font-semibold text-gray-900">
                What does an extended warranty cover?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                Our extended warranties cover major mechanical breakdowns including engine, transmission, electrical systems, air
                conditioning, and more. Coverage varies by plan—Basic covers essential systems, Silver adds steering, suspension,
                and high-tech components, and Gold extends coverage to seals, gaskets, and hybrid/EV components.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-blue-100 rounded-2xl px-6">
              <AccordionTrigger className="text-left hover:no-underline text-lg font-semibold text-gray-900">
                Is there a waiting period?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                Yes, there is a 30-day/1,000-mile waiting period after your coverage begins. This prevents coverage of pre-existing
                conditions. Emergency situations like total breakdowns may have different terms.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-blue-100 rounded-2xl px-6">
              <AccordionTrigger className="text-left hover:no-underline text-lg font-semibold text-gray-900">
                Can I choose my own mechanic?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                Yes! You can use any licensed repair facility in the United States. We have a network of preferred providers for
                your convenience, but you're not required to use them. We'll work directly with your chosen mechanic to handle
                approvals and payments.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-blue-100 rounded-2xl px-6">
              <AccordionTrigger className="text-left hover:no-underline text-lg font-semibold text-gray-900">
                How do I file a claim?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                Filing a claim is simple: call our 24/7 claims hotline, provide your policy information and describe the problem,
                get pre-approval for repairs, take your vehicle to an approved facility, and we'll handle payment directly with the
                shop. Most claims are processed within 24 hours.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </motion.section>

      {/* CTA Banner */}
      <motion.section
        className="relative overflow-hidden bg-gradient-to-br from-primary via-secondary to-primary text-white py-20"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.215, 0.61, 0.355, 1] }}
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" aria-hidden />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to Protect Your Vehicle?</h2>
          <p className="text-xl text-blue-100 mb-8">Get your free quote in less than 3 minutes. No obligations, no hassle.</p>
          <Button
            size="lg"
            className="bg-white text-primary hover:bg-blue-50 px-10 py-6 text-lg font-semibold shadow-xl shadow-blue-900/30"
            onClick={openQuoteModal}
          >
            Get My Free Quote Now
          </Button>
        </div>
      </motion.section>

      <QuoteModal isOpen={isQuoteModalOpen} onClose={closeQuoteModal} />
    </div>
  );
}
