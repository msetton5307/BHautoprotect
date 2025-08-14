import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Quote from "@/pages/quote";
import PrivacyPage from "@/pages/legal/privacy";
import Admin from "@/pages/admin";
import About from "@/pages/about";
import FAQ from "@/pages/faq";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/quote" component={Quote} />
      <Route path="/about" component={About} />
      <Route path="/faq" component={FAQ} />
      <Route path="/legal/privacy" component={PrivacyPage} />
      <Route path="/admin" component={Admin} />
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
