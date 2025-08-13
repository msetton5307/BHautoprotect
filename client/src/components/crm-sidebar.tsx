import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  FileText, 
  Shield, 
  BarChart3, 
  Settings, 
  Handshake,
  Home
} from "lucide-react";
import { useLocation } from "wouter";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    title: "Leads",
    href: "/app/leads",
    icon: Users,
  },
  {
    title: "Quotes",
    href: "/app/quotes",
    icon: FileText,
  },
  {
    title: "Policies",
    href: "/app/policies",
    icon: Shield,
  },
  {
    title: "Reports",
    href: "/app/reports",
    icon: BarChart3,
  },
  {
    title: "Partners",
    href: "/app/partners",
    icon: Handshake,
  },
  {
    title: "Settings",
    href: "/app/settings",
    icon: Settings,
  },
];

export default function CrmSidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-white shadow-sm border-r min-h-screen">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">CRM</h2>
      </div>
      <nav className="px-4 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "w-full justify-start",
                isActive && "bg-primary/10 text-primary"
              )}
              asChild
            >
              <a href={item.href}>
                <Icon className="w-4 h-4 mr-3" />
                {item.title}
              </a>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
