import { Facebook, Twitter, Instagram } from "lucide-react";
import Logo from "@/components/logo";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <Logo
              className="mb-4"
              titleClassName="text-white"
              subtitleClassName="text-blue-200"
              textClassName="gap-1"
              variant="inverse"
            />
            <p className="text-gray-400 mb-4">
              Protecting your vehicle and your wallet with comprehensive extended warranty coverage.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
              >
                <Facebook className="w-6 h-6 text-gray-400 hover:text-white" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
              >
                <Twitter className="w-6 h-6 text-gray-400 hover:text-white" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <Instagram className="w-6 h-6 text-gray-400 hover:text-white" />
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Coverage</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/plans" className="hover:text-white">Basic Coverage</a></li>
              <li><a href="/plans" className="hover:text-white">Silver Coverage</a></li>
              <li><a href="/plans" className="hover:text-white">Gold Protection</a></li>
              <li><a href="/plans" className="hover:text-white">Add-On Options</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/claims" className="hover:text-white">File a Claim</a></li>
              <li><a href="/contact" className="hover:text-white">Customer Support</a></li>
              <li><a href="/faq" className="hover:text-white">FAQ</a></li>
              <li><a href="/portal" className="hover:text-white">Customer Portal</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/about" className="hover:text-white">About Us</a></li>
              <li><a href="/contact" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© 2024 BH Auto Protect. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="/legal/privacy" className="text-gray-400 hover:text-white text-sm">Privacy Policy</a>
              <a href="/legal/terms" className="text-gray-400 hover:text-white text-sm">Terms of Service</a>
              <a href="/legal/tcpa" className="text-gray-400 hover:text-white text-sm">TCPA Notice</a>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Coverage varies by plan and vehicle. Waiting period and exclusions may apply. Licensed in all 50 states.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
