import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Quote from "@/pages/quote";
import QuoteEstimate from "@/pages/quote-estimate";
import LeadsPage from "@/pages/app/leads";
import LeadDetailsPage from "@/pages/app/leads/[id]";
import QuoteDetailsPage from "@/pages/app/quotes/[id]";
import PolicyDetailsPage from "@/pages/app/policies/[id]";
import ReportsPage from "@/pages/app/reports";
import PartnersPage from "@/pages/app/partners";
import SettingsPage from "@/pages/app/settings";
import PrivacyPage from "@/pages/legal/privacy";
import TermsPage from "@/pages/legal/terms";
import TCPAPage from "@/pages/legal/tcpa";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/quote" component={Quote} />
          <Route path="/quote/estimate" component={QuoteEstimate} />
          <Route path="/legal/privacy" component={PrivacyPage} />
          <Route path="/legal/terms" component={TermsPage} />
          <Route path="/legal/tcpa" component={TCPAPage} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/app/leads" component={LeadsPage} />
          <Route path="/app/leads/:id" component={LeadDetailsPage} />
          <Route path="/app/quotes/:id" component={QuoteDetailsPage} />
          <Route path="/app/policies/:id" component={PolicyDetailsPage} />
          <Route path="/app/reports" component={ReportsPage} />
          <Route path="/app/partners" component={PartnersPage} />
          <Route path="/app/settings" component={SettingsPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
