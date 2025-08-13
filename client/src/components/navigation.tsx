import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface NavigationProps {
  onGetQuote: () => void;
}

export default function Navigation({ onGetQuote }: NavigationProps) {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary">BH Auto Protect</h1>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <a href="#" className="text-gray-700 hover:text-primary px-3 py-2 rounded-md text-sm font-medium">Coverage Plans</a>
              <a href="#" className="text-gray-700 hover:text-primary px-3 py-2 rounded-md text-sm font-medium">About</a>
              <a href="#" className="text-gray-700 hover:text-primary px-3 py-2 rounded-md text-sm font-medium">FAQ</a>
              <Button 
                className="bg-primary text-white hover:bg-secondary"
                size="sm"
              >
                <a href="/api/login">Agent Login</a>
              </Button>
            </div>
          </div>
          <div className="md:hidden">
            <button className="text-gray-700">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
