import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings as SettingsIcon, 
  Users, 
  DollarSign, 
  MessageSquare, 
  Webhook, 
  Database,
  Save
} from "lucide-react";
import CrmSidebar from "@/components/crm-sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const [systemSettings, setSystemSettings] = useState({
    companyName: 'BH Auto Protect',
    supportEmail: 'support@bhautoprotect.com',
    supportPhone: '1-800-555-0123',
    timezone: 'America/New_York',
    currency: 'USD',
  });

  const [pricingSettings, setPricingSettings] = useState({
    basePowertrainPrice: '79',
    baseGoldPrice: '129',
    basePlatinumPrice: '199',
    discountThreshold: '10',
    stateMultipliers: '{}',
  });

  const [messageTemplates, setMessageTemplates] = useState({
    welcomeSms: 'Welcome to BH Auto Protect! Your quote is being processed.',
    followUpEmail: 'Thank you for your interest in our warranty coverage.',
    quoteReadySms: 'Your auto warranty quote is ready! Click here to view: {quote_link}',
  });

  const [integrationSettings, setIntegrationSettings] = useState({
    twilioEnabled: false,
    stripeEnabled: false,
    docusignEnabled: false,
    gaTrackingId: '',
    gtmContainerId: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: pricingRulesData, isLoading: rulesLoading, error } = useQuery({
    queryKey: ["/api/pricing-rules"],
    enabled: isAuthenticated,
    retry: false,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("POST", "/api/settings", settings);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createPricingRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      return apiRequest("POST", "/api/pricing-rules", rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
      toast({
        title: "Pricing Rule Created",
        description: "New pricing rule has been created successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || rulesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  const pricingRules = pricingRulesData?.data || [];

  const handleSaveSystemSettings = () => {
    saveSettingsMutation.mutate({ type: 'system', ...systemSettings });
  };

  const handleSavePricingSettings = () => {
    saveSettingsMutation.mutate({ type: 'pricing', ...pricingSettings });
  };

  const handleSaveMessageTemplates = () => {
    saveSettingsMutation.mutate({ type: 'templates', ...messageTemplates });
  };

  const handleSaveIntegrations = () => {
    saveSettingsMutation.mutate({ type: 'integrations', ...integrationSettings });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CrmSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <SettingsIcon className="w-6 h-6 mr-3 text-primary" />
                <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="pricing">Pricing Rules</TabsTrigger>
              <TabsTrigger value="templates">Message Templates</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={systemSettings.companyName}
                        onChange={(e) => setSystemSettings({ ...systemSettings, companyName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="supportEmail">Support Email</Label>
                      <Input
                        id="supportEmail"
                        type="email"
                        value={systemSettings.supportEmail}
                        onChange={(e) => setSystemSettings({ ...systemSettings, supportEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="supportPhone">Support Phone</Label>
                      <Input
                        id="supportPhone"
                        value={systemSettings.supportPhone}
                        onChange={(e) => setSystemSettings({ ...systemSettings, supportPhone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={systemSettings.timezone} onValueChange={(value) => setSystemSettings({ ...systemSettings, timezone: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleSaveSystemSettings} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Base Pricing Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="powertrainPrice">Powertrain Base Price</Label>
                      <Input
                        id="powertrainPrice"
                        type="number"
                        value={pricingSettings.basePowertrainPrice}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, basePowertrainPrice: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="goldPrice">Gold Base Price</Label>
                      <Input
                        id="goldPrice"
                        type="number"
                        value={pricingSettings.baseGoldPrice}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, baseGoldPrice: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="platinumPrice">Platinum Base Price</Label>
                      <Input
                        id="platinumPrice"
                        type="number"
                        value={pricingSettings.basePlatinumPrice}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, basePlatinumPrice: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="stateMultipliers">State Multipliers (JSON)</Label>
                    <Textarea
                      id="stateMultipliers"
                      value={pricingSettings.stateMultipliers}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, stateMultipliers: e.target.value })}
                      placeholder='{"CA": 1.1, "NY": 1.15, "FL": 1.05}'
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleSavePricingSettings} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Pricing Settings
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Pricing Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pricingRules.map((rule: any) => (
                      <div key={rule.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{rule.name}</h3>
                            <p className="text-sm text-gray-500">
                              Created {new Date(rule.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch checked={rule.active} />
                            <span className="text-sm">{rule.active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {pricingRules.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No pricing rules configured.</p>
                        <p className="text-sm">Pricing rules allow dynamic adjustment of base prices.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Message Templates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="welcomeSms">Welcome SMS</Label>
                    <Textarea
                      id="welcomeSms"
                      value={messageTemplates.welcomeSms}
                      onChange={(e) => setMessageTemplates({ ...messageTemplates, welcomeSms: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="followUpEmail">Follow-up Email</Label>
                    <Textarea
                      id="followUpEmail"
                      value={messageTemplates.followUpEmail}
                      onChange={(e) => setMessageTemplates({ ...messageTemplates, followUpEmail: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quoteReadySms">Quote Ready SMS</Label>
                    <Textarea
                      id="quoteReadySms"
                      value={messageTemplates.quoteReadySms}
                      onChange={(e) => setMessageTemplates({ ...messageTemplates, quoteReadySms: e.target.value })}
                      rows={2}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available variables: {'{customer_name}'}, {'{quote_link}'}, {'{amount}'}
                    </p>
                  </div>
                  <Button onClick={handleSaveMessageTemplates} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Templates
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Webhook className="w-5 h-5 mr-2" />
                    External Integrations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">Twilio SMS</h3>
                          <p className="text-sm text-gray-500">SMS and WhatsApp messaging</p>
                        </div>
                        <Switch 
                          checked={integrationSettings.twilioEnabled} 
                          onCheckedChange={(checked) => setIntegrationSettings({ ...integrationSettings, twilioEnabled: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">Stripe Payments</h3>
                          <p className="text-sm text-gray-500">Payment processing</p>
                        </div>
                        <Switch 
                          checked={integrationSettings.stripeEnabled} 
                          onCheckedChange={(checked) => setIntegrationSettings({ ...integrationSettings, stripeEnabled: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">DocuSign</h3>
                          <p className="text-sm text-gray-500">Electronic signatures</p>
                        </div>
                        <Switch 
                          checked={integrationSettings.docusignEnabled} 
                          onCheckedChange={(checked) => setIntegrationSettings({ ...integrationSettings, docusignEnabled: checked })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="gaTrackingId">Google Analytics Tracking ID</Label>
                        <Input
                          id="gaTrackingId"
                          placeholder="GA4-XXXXXXXXXX"
                          value={integrationSettings.gaTrackingId}
                          onChange={(e) => setIntegrationSettings({ ...integrationSettings, gaTrackingId: e.target.value })}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="gtmContainerId">Google Tag Manager Container ID</Label>
                        <Input
                          id="gtmContainerId"
                          placeholder="GTM-XXXXXXX"
                          value={integrationSettings.gtmContainerId}
                          onChange={(e) => setIntegrationSettings({ ...integrationSettings, gtmContainerId: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={handleSaveIntegrations} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Integration Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    User Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>User management interface will be implemented here.</p>
                    <p className="text-sm">Create and manage user accounts, roles, and permissions.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
