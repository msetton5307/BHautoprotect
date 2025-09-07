import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

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

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <a href="/" className="text-2xl font-bold text-primary">
                BH Auto Protect
              </a>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <a
                href="/plans"
                className="text-gray-700 hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
              >
                Coverage Plans
              </a>
              <a
                href="/about"
                className="text-gray-700 hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
              >
                About
              </a>
              <a
                href="/faq"
                className="text-gray-700 hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
              >
                FAQ
              </a>
              <a
                href="/claims"
                className="text-gray-700 hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
              >
                Claims
              </a>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                size="sm"
                onClick={onGetQuote}
              >
                Get Quote
              </Button>
            </div>
          </div>
          <div className="md:hidden">
            <button className="text-gray-700" onClick={toggleMenu} aria-label="Toggle Menu">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a
                href="/plans"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary"
                onClick={toggleMenu}
              >
                Coverage Plans
              </a>
              <a
                href="/about"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary"
                onClick={toggleMenu}
              >
                About
              </a>
              <a
                href="/faq"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary"
                onClick={toggleMenu}
              >
                FAQ
              </a>
              <a
                href="/claims"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary"
                onClick={toggleMenu}
              >
                Claims
              </a>
              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-700 mt-2"
                size="sm"
                onClick={handleQuote}
              >
                Get Quote
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
