import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Mail, Clock } from "lucide-react";
import Logo from "@/components/logo";

interface NavigationProps {
  onGetQuote: () => void;
}

export default function Navigation({ onGetQuote }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const handleQuote = () => {
    onGetQuote();
    setIsMenuOpen(false);
  };

  const navLinks = [
    { href: "/plans", label: "Plans" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/claims", label: "Claims" },
    { href: "/portal", label: "Login" },
  ];

  return (
    <header className="sticky top-0 z-50">
      <div className="hidden md:block bg-gradient-to-r from-primary via-secondary to-primary text-white">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 uppercase tracking-[0.2em] text-xs text-blue-100">
              Premium Vehicle Protection
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Claims Support 24/7</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="tel:18882001234" className="flex items-center gap-2 font-semibold hover:text-blue-100 transition-colors">
              <Phone className="w-4 h-4" /> 1 (888) 200-1234
            </a>
            <a
              href="mailto:hello@bhautoprotect.com"
              className="flex items-center gap-2 font-medium hover:text-blue-100 transition-colors"
            >
              <Mail className="w-4 h-4" /> hello@bhautoprotect.com
            </a>
          </div>
        </div>
      </div>
      <nav className="bg-white/90 backdrop-blur border-b border-blue-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 gap-4">
            <a
              href="/"
              className="group flex items-center"
              aria-label="BH Auto Protect home"
            >
              <Logo
                titleClassName="group-hover:text-secondary transition-colors"
                subtitleClassName="group-hover:text-primary/70 transition-colors"
              />
            </a>
            <div className="hidden md:flex flex-1 items-center justify-end gap-4 lg:gap-6 xl:gap-10">
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 lg:gap-x-6 xl:gap-x-8">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-600 transition-colors hover:text-primary sm:text-sm sm:tracking-[0.22em]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="hidden lg:block h-10 w-px bg-gradient-to-b from-transparent via-blue-200 to-transparent" aria-hidden />
              <Button
                className="whitespace-nowrap bg-gradient-to-r from-primary via-secondary to-primary text-white shadow-lg shadow-blue-200 transition hover:opacity-90"
                size="lg"
                onClick={onGetQuote}
              >
                Get My Quote
              </Button>
            </div>
            <div className="md:hidden flex items-center gap-4">
              <a href="tel:18882001234" className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary">
                <Phone className="w-4 h-4" />
                Call
              </a>
              <button
                className="text-gray-700 rounded-full border border-gray-200 p-2 hover:bg-gray-50 transition"
                onClick={toggleMenu}
                aria-label="Toggle Menu"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {isMenuOpen && (
            <div className="md:hidden pb-6 space-y-4">
              <div className="grid gap-3">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="px-4 py-3 rounded-xl bg-white/80 shadow-sm text-base font-medium text-gray-700 hover:text-primary hover:shadow-md transition"
                    onClick={toggleMenu}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="px-4 flex flex-col gap-3">
                <a
                  href="tel:18882001234"
                  className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-primary"
                >
                  <Phone className="w-4 h-4" /> 1 (888) 200-1234
                </a>
                <a
                  href="mailto:hello@bhautoprotect.com"
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700"
                >
                  <Mail className="w-4 h-4" /> hello@bhautoprotect.com
                </a>
                <Button
                  className="w-full bg-gradient-to-r from-primary via-secondary to-primary text-white"
                  size="lg"
                  onClick={handleQuote}
                >
                  Get My Quote
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
