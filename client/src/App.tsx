import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Quote from "@/pages/quote";
import PrivacyPage from "@/pages/legal/privacy";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminLeads from "@/pages/admin/leads";
import AdminLeadDetail from "@/pages/admin/leads/[id]";
import AdminLeadNew from "@/pages/admin/leads/new";
import AdminPolicies from "@/pages/admin/policies";
import AdminPolicyDetail from "@/pages/admin/policies/[id]";
import AdminClaims from "@/pages/admin/claims";
import AdminClaimDetail from "@/pages/admin/claims/[id]";
import AdminClaimNew from "@/pages/admin/claims/new";
import About from "@/pages/about";
import FAQ from "@/pages/faq";
import Claims from "@/pages/claims";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/quote" component={Quote} />
      <Route path="/about" component={About} />
      <Route path="/faq" component={FAQ} />
      <Route path="/claims" component={Claims} />
      <Route path="/legal/privacy" component={PrivacyPage} />
      <Route path="/admin/leads/new" component={AdminLeadNew} />
      <Route path="/admin/leads/:id" component={AdminLeadDetail} />
      <Route path="/admin/leads" component={AdminLeads} />
      <Route path="/admin/policies/:id" component={AdminPolicyDetail} />
      <Route path="/admin/policies" component={AdminPolicies} />
      <Route path="/policy/:id" component={AdminPolicyDetail} />
      <Route path="/admin/claims/new" component={AdminClaimNew} />
      <Route path="/admin/claims/:id" component={AdminClaimDetail} />
      <Route path="/admin/claims" component={AdminClaims} />
      <Route path="/admin" component={AdminDashboard} />
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
