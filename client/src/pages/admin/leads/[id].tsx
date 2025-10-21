import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, User, Car, Activity, Phone, Mail, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { clearCredentials, fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

// Helper to include JSON content type with auth header
const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

type LeadContractSummary = {
  id: string;
  quoteId: string | null;
  status: string;
  signedAt?: string | null;
  fileName: string;
  fileSize?: number | null;
};

type PolicyFormState = {
  package: string;
  expirationMiles: string;
  expirationDate: string;
  deductible: string;
  totalPremium: string;
  downPayment: string;
  policyStartDate: string;
  monthlyPayment: string;
  totalPayments: string;
  paymentOption: 'monthly' | 'one-time';
};

type QuoteFormState = {
  plan: "basic" | "silver" | "gold";
  deductible: number | null;
  termMonths: number | null;
  priceTotal: number | null;
  priceMonthly: number | null;
  expirationMiles: number | null;
  paymentOption: "monthly" | "one-time";
};

type CreateQuotePayload = {
  plan: QuoteFormState['plan'];
  deductible: number;
  termMonths: number;
  priceTotal: number;
  priceMonthly: number;
  expirationMiles?: number | null;
  paymentOption: QuoteFormState['paymentOption'];
};

type ShippingFieldKey = 'shippingAddress' | 'shippingCity' | 'shippingState' | 'shippingZip';
type BillingFieldKey = 'billingAddress' | 'billingCity' | 'billingState' | 'billingZip';

const SHIPPING_TO_BILLING_FIELD: Record<ShippingFieldKey, BillingFieldKey> = {
  shippingAddress: 'billingAddress',
  shippingCity: 'billingCity',
  shippingState: 'billingState',
  shippingZip: 'billingZip',
};

const DEFAULT_QUOTE_FORM: QuoteFormState = {
  plan: "gold",
  deductible: 500,
  termMonths: 36,
  priceTotal: 299900,
  priceMonthly: 8331,
  expirationMiles: null,
  paymentOption: "one-time",
};

const normalizePaymentOption = (value: unknown): QuoteFormState['paymentOption'] =>
  value === 'monthly' ? 'monthly' : 'one-time';

const formatCurrencyInput = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '';
  }
  return (numeric / 100).toFixed(2);
};

const parseCurrencyInput = (value: string): number | null => {
  const normalized = value.replace(/[$,]/g, '').trim();
  if (!normalized) {
    return null;
  }
  const numeric = Number.parseFloat(normalized);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return Math.round(numeric * 100);
};

const formatDollarInput = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '';
  }
  return numeric.toFixed(2);
};

const parseDollarInput = (value: string): number | null => {
  const normalized = value.replace(/[$,]/g, '').trim();
  if (!normalized) {
    return null;
  }
  const numeric = Number.parseFloat(normalized);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return Math.round(numeric);
};

const formatDateForInput = (date: Date): string => date.toISOString().slice(0, 10);

const addYearsToDateInputValue = (value: string, years: number): string | null => {
  if (!value) {
    return null;
  }
  const parts = value.split('-');
  if (parts.length !== 3) {
    return null;
  }
  const [yearPart, monthPart, dayPart] = parts;
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }
  baseDate.setUTCFullYear(baseDate.getUTCFullYear() + years);
  return formatDateForInput(baseDate);
};

const toDateInputValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return formatDateForInput(parsed);
};

export default function AdminLeadDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'quotes' | 'payment-info'>('overview');
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>({ ...DEFAULT_QUOTE_FORM });
  const [quoteFormInitialized, setQuoteFormInitialized] = useState(false);
  const [lastEditedPriceField, setLastEditedPriceField] = useState<'total' | 'monthly'>('total');
  const [policyForm, setPolicyForm] = useState<PolicyFormState>({
    package: '',
    expirationMiles: '',
    expirationDate: '',
    deductible: '',
    totalPremium: '',
    downPayment: '',
    policyStartDate: '',
    monthlyPayment: '',
    totalPayments: '',
    paymentOption: 'one-time',
  });
  const [expirationDateManuallyEdited, setExpirationDateManuallyEdited] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<any>({});
  const [newNote, setNewNote] = useState('');
  const [leadForm, setLeadForm] = useState<any>({ shippingSameAsBilling: false });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const createQuoteSectionRef = useRef<HTMLDivElement | null>(null);

  const formatMilesDisplay = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) {
      return 'Not set';
    }
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(numeric)) {
      return 'Not set';
    }
    return `${Math.round(numeric).toLocaleString()} miles`;
  };

  const parseCurrencyToCents = (input: string): number | null => {
    const normalized = input.replace(/[$,]/g, '').trim();
    if (normalized.length === 0) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return Math.round(parsed * 100);
  };

  const handleTotalPriceChange = (value: string) => {
    setQuoteForm((prev) => {
      if (value.trim().length === 0) {
        return { ...prev, priceTotal: null };
      }
      const cents = parseCurrencyToCents(value);
      if (cents === null) {
        return prev;
      }
      const next = { ...prev, priceTotal: cents };
      if (prev.termMonths && prev.termMonths > 0) {
        next.priceMonthly = Math.round(cents / prev.termMonths);
      }
      return next;
    });
    setLastEditedPriceField('total');
  };

  const handleMonthlyPriceChange = (value: string) => {
    setQuoteForm((prev) => {
      if (value.trim().length === 0) {
        return { ...prev, priceMonthly: null };
      }
      const cents = parseCurrencyToCents(value);
      if (cents === null) {
        return prev;
      }
      const next = { ...prev, priceMonthly: cents };
      if (prev.termMonths && prev.termMonths > 0) {
        next.priceTotal = cents * prev.termMonths;
      }
      return next;
    });
    setLastEditedPriceField('monthly');
  };

  const handleTermMonthsChange = (value: string) => {
    setQuoteForm((prev) => {
      if (value.trim().length === 0) {
        return { ...prev, termMonths: null };
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        return prev;
      }
      const term = Math.max(parsed, 0);
      const next = { ...prev, termMonths: term };
      if (term > 0) {
        if (lastEditedPriceField === 'monthly') {
          if (prev.priceMonthly !== null) {
            next.priceTotal = prev.priceMonthly * term;
          }
        } else if (prev.priceTotal !== null) {
          next.priceMonthly = Math.round(prev.priceTotal / term);
        }
      } else if (lastEditedPriceField === 'monthly') {
        next.priceTotal = null;
      } else {
        next.priceMonthly = null;
      }
      return next;
    });
  };

  const handleDeductibleChange = (value: string) => {
    setQuoteForm((prev) => {
      if (value.trim().length === 0) {
        return { ...prev, deductible: null };
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        return prev;
      }
      return { ...prev, deductible: parsed };
    });
  };

  const handleExpirationMilesChange = (value: string) => {
    setQuoteForm((prev) => {
      if (value.trim().length === 0) {
        return { ...prev, expirationMiles: null };
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        return prev;
      }
      return { ...prev, expirationMiles: Math.max(parsed, 0) };
    });
  };

  const currentMilesDisplay = formatMilesDisplay(vehicleForm?.odometer);
  const expirationMilesDisplay = formatMilesDisplay(
    quoteForm.expirationMiles ?? policyForm.expirationMiles,
  );

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['/api/admin/leads', id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}`, {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch lead');
      return res.json();
    },
    enabled: authenticated && !!id,
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: authJsonHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to update lead');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      setQuoteFormInitialized(false);
      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to delete lead');
      return res.json();
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['/api/admin/leads', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads'] });
      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      });
      setDeleteDialogOpen(false);
      setLocation('/admin/leads');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete lead',
        variant: 'destructive',
      });
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (quoteData: CreateQuotePayload) => {
      const payload: Record<string, unknown> = {
        plan: quoteData.plan,
        deductible: quoteData.deductible,
        termMonths: quoteData.termMonths,
        priceMonthly: quoteData.priceMonthly / 100,
        paymentOption: quoteData.paymentOption,
      };

      if (quoteData.expirationMiles !== undefined && quoteData.expirationMiles !== null) {
        payload.expirationMiles = quoteData.expirationMiles;
      }

      const res = await fetch(`/api/leads/${id}/coverage`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to create quote');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      setIsCreatingQuote(false);
      setQuoteForm({ ...DEFAULT_QUOTE_FORM });
      setQuoteFormInitialized(false);
      setLastEditedPriceField('total');
      toast({
        title: "Success",
        description: "Quote created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    },
  });

  const buildPolicyPayloadFromForm = (form: PolicyFormState): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};

    if (form.package.trim().length > 0) {
      payload.package = form.package.trim();
    }

    if (form.policyStartDate) {
      payload.policyStartDate = new Date(form.policyStartDate).toISOString();
    }

    if (form.expirationDate) {
      payload.expirationDate = new Date(form.expirationDate).toISOString();
    }

    if (form.expirationMiles.trim().length > 0) {
      const miles = Number(form.expirationMiles);
      if (!Number.isNaN(miles)) {
        payload.expirationMiles = miles;
      }
    }

    const currencyFields: (keyof PolicyFormState)[] = [
      'totalPremium',
      'downPayment',
      'monthlyPayment',
    ];

    for (const field of currencyFields) {
      const cents = parseCurrencyInput(form[field]);
      if (cents !== null) {
        payload[field] = cents;
      }
    }

    const totalPaymentsValue = form.totalPayments.trim();
    if (totalPaymentsValue.length > 0) {
      const parsed = Number.parseInt(totalPaymentsValue, 10);
      if (!Number.isNaN(parsed)) {
        payload.totalPayments = parsed;
      }
    }

    const deductibleDollars = parseDollarInput(form.deductible);
    if (deductibleDollars !== null) {
      payload.deductible = deductibleDollars;
    }

    return payload;
  };

  const convertLeadMutation = useMutation({
    mutationFn: async (policyData: PolicyFormState) => {
      const payload = buildPolicyPayloadFromForm(policyData);
      const response = await fetchWithAuth(`/api/admin/leads/${id}/convert`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.message ?? 'Failed to convert lead';
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/policies'] });
      toast({
        title: 'Success',
        description: 'Lead converted to policy',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to convert lead',
        variant: 'destructive',
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}/notes`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ content }),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to add note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      setNewNote('');
      toast({
        title: 'Success',
        description: 'Note added',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive',
      });
    },
  });

  const leadPayload = leadData?.data as
    | {
        lead?: any;
        vehicle?: any;
        quotes: any[];
        notes: any[];
        policy: any;
        contracts?: LeadContractSummary[];
      }
    | undefined;

  useEffect(() => {
    if (!leadPayload) {
      return;
    }

    if (leadPayload.lead) {
      const leadData = leadPayload.lead;
      setLeadForm((prev) => ({
        ...prev,
        ...leadData,
        shippingSameAsBilling: Boolean(leadData.shippingSameAsBilling),
      }));
    }
    const vehicleData = leadPayload.vehicle;
    if (vehicleData) {
      const v = vehicleData;
      setVehicleForm({
        ...v,
        year: v.year?.toString(),
        odometer: v.odometer?.toString(),
      });
    }

    const parsedOdometer = (() => {
      const raw = vehicleData?.odometer;
      if (typeof raw === 'number') {
        return Number.isFinite(raw) ? raw : null;
      }
      if (typeof raw === 'string') {
        const normalized = raw.replace(/[,]/g, '').trim();
        if (normalized.length === 0) {
          return null;
        }
        const numeric = Number.parseFloat(normalized);
        return Number.isNaN(numeric) ? null : numeric;
      }
      return null;
    })();
    const defaultExpirationMiles =
      parsedOdometer !== null ? String(Math.round(parsedOdometer + 100_000)) : '';

    const todayInput = formatDateForInput(new Date());
    const fallbackStartDate =
      toDateInputValue(leadPayload.policy?.policyStartDate) ??
      toDateInputValue(leadPayload.lead?.createdAt) ??
      todayInput;

    const existingExpirationDate = policyForm.expirationDate;

    if (leadPayload.policy) {
      const p = leadPayload.policy;
      const paymentOption: PolicyFormState['paymentOption'] = (() => {
        const raw = typeof p.paymentOption === 'string' ? p.paymentOption.toLowerCase() : null;
        if (raw === 'monthly') {
          return 'monthly';
        }
        if (typeof p.monthlyPayment === 'number' && Number.isFinite(p.monthlyPayment) && p.monthlyPayment > 0) {
          return 'monthly';
        }
        return 'one-time';
      })();
      const expirationMilesValue =
        p.expirationMiles !== null && p.expirationMiles !== undefined && p.expirationMiles !== ''
          ? String(p.expirationMiles)
          : defaultExpirationMiles;
      const policyStartDateValue = toDateInputValue(p.policyStartDate) ?? fallbackStartDate;
      const expirationDateValue = toDateInputValue(p.expirationDate) ?? '';

      setPolicyForm({
        package: p.package || '',
        expirationMiles: expirationMilesValue,
        expirationDate: expirationDateValue,
        deductible: formatDollarInput(p.deductible),
        totalPremium: formatCurrencyInput(p.totalPremium),
        downPayment: formatCurrencyInput(p.downPayment),
        policyStartDate: policyStartDateValue,
        monthlyPayment: formatCurrencyInput(p.monthlyPayment),
        totalPayments:
          p.totalPayments !== null && p.totalPayments !== undefined
            ? String(p.totalPayments)
            : '',
        paymentOption,
      });
      setExpirationDateManuallyEdited(Boolean(p.expirationDate));
    } else {
      setPolicyForm((prev) => ({
        ...prev,
        expirationMiles: prev.expirationMiles || defaultExpirationMiles,
        policyStartDate: prev.policyStartDate || fallbackStartDate,
      }));
      setExpirationDateManuallyEdited((prevManual) => {
        if (prevManual) {
          return true;
        }
        return existingExpirationDate.trim().length > 0;
      });
    }

    if (quoteFormInitialized) {
      return;
    }

    const quotesList = Array.isArray(leadPayload.quotes) ? leadPayload.quotes : [];
    if (quotesList.length > 0) {
      const latestQuote = quotesList[0];
      const breakdown = (latestQuote.breakdown ?? null) as Record<string, unknown> | null;
      let expirationMiles: number | null = null;
      if (breakdown && Object.prototype.hasOwnProperty.call(breakdown, 'expirationMiles')) {
        const raw = (breakdown as Record<string, unknown>).expirationMiles;
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          expirationMiles = Math.round(raw);
        }
      }

      setQuoteForm({
        plan:
          typeof latestQuote.plan === 'string'
            ? (latestQuote.plan as QuoteFormState['plan'])
            : DEFAULT_QUOTE_FORM.plan,
        deductible:
          typeof latestQuote.deductible === 'number' && Number.isFinite(latestQuote.deductible)
            ? latestQuote.deductible
            : DEFAULT_QUOTE_FORM.deductible,
        termMonths:
          typeof latestQuote.termMonths === 'number' && Number.isFinite(latestQuote.termMonths)
            ? latestQuote.termMonths
            : DEFAULT_QUOTE_FORM.termMonths,
        priceTotal:
          typeof latestQuote.priceTotal === 'number' && Number.isFinite(latestQuote.priceTotal)
            ? latestQuote.priceTotal
            : DEFAULT_QUOTE_FORM.priceTotal,
        priceMonthly:
          typeof latestQuote.priceMonthly === 'number' && Number.isFinite(latestQuote.priceMonthly)
            ? latestQuote.priceMonthly
            : DEFAULT_QUOTE_FORM.priceMonthly,
        expirationMiles,
        paymentOption: normalizePaymentOption(breakdown?.paymentOption),
      });
      setLastEditedPriceField('total');
      setQuoteFormInitialized(true);
      return;
    }

    const policy = leadPayload.policy;
    if (policy) {
      const planValue:
        | QuoteFormState['plan']
        | typeof DEFAULT_QUOTE_FORM.plan =
        policy.package === 'basic' || policy.package === 'silver' || policy.package === 'gold'
          ? policy.package
          : DEFAULT_QUOTE_FORM.plan;

      const deductibleValue =
        typeof policy.deductible === 'number' && Number.isFinite(policy.deductible)
          ? policy.deductible
          : DEFAULT_QUOTE_FORM.deductible;

      const expirationMilesValue =
        typeof policy.expirationMiles === 'number' && Number.isFinite(policy.expirationMiles)
          ? policy.expirationMiles
          : null;

      const totalPremium =
        typeof policy.totalPremium === 'number' && Number.isFinite(policy.totalPremium)
          ? policy.totalPremium
          : null;
      const totalPaymentsCount =
        typeof policy.totalPayments === 'number' && Number.isFinite(policy.totalPayments)
          ? policy.totalPayments
          : null;
      const monthlyValue =
        typeof policy.monthlyPayment === 'number' && Number.isFinite(policy.monthlyPayment)
          ? policy.monthlyPayment
          : null;

      let resolvedTerm: number | null = totalPaymentsCount && totalPaymentsCount > 0 ? totalPaymentsCount : null;
      let resolvedTotal = totalPremium ?? null;
      let resolvedMonthly = monthlyValue ?? null;

      if (!resolvedTerm && resolvedTotal && resolvedMonthly && resolvedMonthly > 0) {
        resolvedTerm = Math.max(1, Math.round(resolvedTotal / resolvedMonthly));
      }

      if (!resolvedTerm || !Number.isFinite(resolvedTerm) || resolvedTerm <= 0) {
        resolvedTerm = DEFAULT_QUOTE_FORM.termMonths;
      }

      if ((!resolvedMonthly || resolvedMonthly <= 0) && resolvedTotal && resolvedTerm) {
        resolvedMonthly = Math.round(resolvedTotal / resolvedTerm);
      }

      if ((!resolvedTotal || resolvedTotal <= 0) && resolvedMonthly && resolvedTerm) {
        resolvedTotal = resolvedMonthly * resolvedTerm;
      }

      const paymentOption: QuoteFormState['paymentOption'] = (() => {
        if (typeof policy.paymentOption === 'string') {
          return policy.paymentOption === 'monthly' ? 'monthly' : 'one-time';
        }
        return resolvedMonthly && resolvedMonthly > 0 ? 'monthly' : 'one-time';
      })();

      setQuoteForm({
        plan: planValue,
        deductible: deductibleValue,
        termMonths: resolvedTerm,
        priceTotal: resolvedTotal ?? DEFAULT_QUOTE_FORM.priceTotal,
        priceMonthly: resolvedMonthly ?? DEFAULT_QUOTE_FORM.priceMonthly,
        expirationMiles: expirationMilesValue,
        paymentOption,
      });
      setLastEditedPriceField('total');
      setQuoteFormInitialized(true);
      return;
    }

    setQuoteFormInitialized(true);
  }, [leadPayload, quoteFormInitialized]);

  const policyStartDateValue = policyForm.policyStartDate;

  useEffect(() => {
    if (!policyStartDateValue || expirationDateManuallyEdited) {
      return;
    }
    const nextExpirationDate = addYearsToDateInputValue(policyStartDateValue, 5);
    if (!nextExpirationDate) {
      return;
    }
    setPolicyForm((prev) => {
      if (prev.policyStartDate !== policyStartDateValue) {
        return prev;
      }
      if (prev.expirationDate === nextExpirationDate) {
        return prev;
      }
      return { ...prev, expirationDate: nextExpirationDate };
    });
  }, [policyStartDateValue, expirationDateManuallyEdited]);

  const prefillQuoteFormFromPolicy = useCallback(() => {
    setQuoteForm((prev) => {
      const next: QuoteFormState = { ...prev };

      const deductible = parseDollarInput(policyForm.deductible);
      if (deductible !== null) {
        next.deductible = deductible;
      }

      const termInput = policyForm.totalPayments.trim();
      if (termInput.length > 0) {
        const parsedTerm = Number.parseInt(termInput, 10);
        if (!Number.isNaN(parsedTerm) && parsedTerm > 0) {
          next.termMonths = parsedTerm;
        }
      }

      const expirationInput = policyForm.expirationMiles.trim();
      if (expirationInput.length > 0) {
        const parsedMiles = Number.parseInt(expirationInput, 10);
        if (!Number.isNaN(parsedMiles) && parsedMiles >= 0) {
          next.expirationMiles = parsedMiles;
        }
      }

      const totalFromPolicy = parseCurrencyInput(policyForm.totalPremium);
      const monthlyFromPolicy = parseCurrencyInput(policyForm.monthlyPayment);

      if (totalFromPolicy !== null) {
        next.priceTotal = totalFromPolicy;
      }

      if (monthlyFromPolicy !== null) {
        next.priceMonthly = monthlyFromPolicy;
      }

      if (
        totalFromPolicy !== null &&
        monthlyFromPolicy === null &&
        next.termMonths &&
        next.termMonths > 0
      ) {
        next.priceMonthly = Math.round(totalFromPolicy / next.termMonths);
      }

      if (
        monthlyFromPolicy !== null &&
        totalFromPolicy === null &&
        next.termMonths &&
        next.termMonths > 0
      ) {
        next.priceTotal = monthlyFromPolicy * next.termMonths;
      }

      if (policyForm.paymentOption === 'monthly') {
        next.paymentOption = 'monthly';
      } else if (policyForm.paymentOption === 'one-time') {
        next.paymentOption = 'one-time';
      } else if (next.priceMonthly && next.priceMonthly > 0) {
        next.paymentOption = 'monthly';
      } else if (next.priceTotal && next.priceTotal > 0) {
        next.paymentOption = 'one-time';
      }

      return next;
    });
    setLastEditedPriceField('total');
  }, [policyForm]);

  const quotes = leadPayload?.quotes ?? [];
  const notes = leadPayload?.notes ?? [];
  const existingPolicy = leadPayload?.policy;
  const contracts = leadPayload?.contracts ?? [];

  const cardholderName = useMemo(() => {
    if (typeof leadForm?.cardholderName === 'string' && leadForm.cardholderName.trim().length > 0) {
      return leadForm.cardholderName.trim();
    }
    const parts: string[] = [];
    if (typeof leadForm?.firstName === 'string' && leadForm.firstName.trim().length > 0) {
      parts.push(leadForm.firstName.trim());
    }
    if (typeof leadForm?.lastName === 'string' && leadForm.lastName.trim().length > 0) {
      parts.push(leadForm.lastName.trim());
    }
    return parts.join(' ').trim();
  }, [leadForm?.cardholderName, leadForm?.firstName, leadForm?.lastName]);

  const formatActivityDate = useCallback((value: unknown): string | null => {
    if (!value) {
      return null;
    }
    const date = new Date(value as string);
    if (Number.isNaN(date.valueOf())) {
      return null;
    }
    return date.toLocaleDateString();
  }, []);

  const contractGroups = useMemo(() => {
    const grouped: Record<string, LeadContractSummary[]> = {};
    contracts.forEach((contract) => {
      if (!contract.quoteId) {
        return;
      }
      if (!grouped[contract.quoteId]) {
        grouped[contract.quoteId] = [];
      }
      grouped[contract.quoteId].push(contract);
    });
    return grouped;
  }, [contracts]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={markAuthenticated} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!leadPayload) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lead Not Found</h2>
          <Button asChild>
            <Link href="/admin/leads">Back to Leads</Link>
          </Button>
        </div>
      </div>
    );
  }
  const hasPolicy = Boolean(existingPolicy);
  const convertButtonDisabled = convertLeadMutation.isPending || hasPolicy;
  const convertButtonLabel = hasPolicy
    ? 'Policy Created'
    : convertLeadMutation.isPending
      ? 'Converting...'
      : 'Convert to Policy';
  const shippingSameAsBilling = Boolean(leadForm?.shippingSameAsBilling);

  const handleConvert = () => {
    if (hasPolicy) return;
    if (
      policyForm.paymentOption === 'monthly' &&
      (policyForm.monthlyPayment.trim().length === 0 || policyForm.totalPayments.trim().length === 0)
    ) {
      toast({
        title: 'Missing payment details',
        description: 'Monthly policies require monthly payment amount and total payment count.',
        variant: 'destructive',
      });
      return;
    }
    convertLeadMutation.mutate(policyForm);
  };

  const handleCreateQuote = () => {
    if (quoteForm.deductible === null || quoteForm.termMonths === null || quoteForm.termMonths <= 0) {
      toast({
        title: 'Missing information',
        description: 'Please complete all required quote fields before sending.',
        variant: 'destructive',
      });
      return;
    }

    let priceTotal = quoteForm.priceTotal;
    let priceMonthly = quoteForm.priceMonthly;

    if ((priceTotal === null || priceMonthly === null) && quoteForm.termMonths > 0) {
      if (priceTotal === null && priceMonthly !== null) {
        priceTotal = priceMonthly * quoteForm.termMonths;
      } else if (priceMonthly === null && priceTotal !== null) {
        priceMonthly = Math.round(priceTotal / quoteForm.termMonths);
      }
    }

    if (
      priceMonthly === null ||
      priceTotal === null
    ) {
      toast({
        title: 'Missing information',
        description: 'Please complete all required quote fields before sending.',
        variant: 'destructive',
      });
      return;
    }

    if (priceMonthly !== quoteForm.priceMonthly || priceTotal !== quoteForm.priceTotal) {
      setQuoteForm((prev) => ({
        ...prev,
        priceMonthly,
        priceTotal,
      }));
    }

    createQuoteMutation.mutate({
      plan: quoteForm.plan,
      deductible: quoteForm.deductible,
      termMonths: quoteForm.termMonths,
      priceTotal,
      priceMonthly,
      paymentOption: quoteForm.paymentOption,
      expirationMiles: quoteForm.expirationMiles ?? undefined,
    });
  };

  const handleShippingFieldChange = (field: ShippingFieldKey, value: string) => {
    setLeadForm((prev: Record<string, any>) => {
      const next = { ...prev, [field]: value };
      if (prev.shippingSameAsBilling) {
        const billingField = SHIPPING_TO_BILLING_FIELD[field];
        next[billingField] = value;
      }
      return next;
    });
  };

  const handleShippingSameAsBillingChange = (checked: boolean) => {
    setLeadForm((prev: Record<string, any>) => {
      const next = { ...prev, shippingSameAsBilling: checked };
      if (checked) {
        (Object.keys(SHIPPING_TO_BILLING_FIELD) as ShippingFieldKey[]).forEach((shippingField) => {
          const billingField = SHIPPING_TO_BILLING_FIELD[shippingField];
          next[billingField] = prev[shippingField] ?? '';
        });
      }
      return next;
    });
  };

  const sanitizeLeadUpdates = (input: Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    Object.entries(input).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        result[key] = trimmed.length > 0 ? trimmed : null;
        return;
      }
      result[key] = value;
    });
    delete result.id;
    delete result.createdAt;
    delete result.updatedAt;
    delete result.rawPayload;
    return result;
  };

  const handleSave = () => {
    const { id: _id, ...leadUpdates } = leadForm;
    const vehiclePayload = { ...vehicleForm } as any;
    ['year', 'odometer'].forEach((key) => {
      if (vehiclePayload[key] === '' || vehiclePayload[key] === undefined) {
        delete vehiclePayload[key];
      } else {
        vehiclePayload[key] = Number(vehiclePayload[key]);
      }
    });

    if (
      policyForm.paymentOption === 'monthly' &&
      (policyForm.monthlyPayment.trim().length === 0 || policyForm.totalPayments.trim().length === 0)
    ) {
      toast({
        title: 'Missing payment details',
        description: 'Monthly policies require monthly payment amount and total payment count.',
        variant: 'destructive',
      });
      return;
    }

    const sanitizedLeadUpdates = sanitizeLeadUpdates(leadUpdates);
    const payload: any = { ...sanitizedLeadUpdates };
    if (Object.keys(vehiclePayload).length > 0) payload.vehicle = vehiclePayload;
    if (existingPolicy) {
      const policyPayload = buildPolicyPayloadFromForm(policyForm);
      if (Object.keys(policyPayload).length > 0) payload.policy = policyPayload;
    }
    updateLeadMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" className="mr-4" asChild>
                <Link href="/admin/leads">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Leads
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {leadForm.firstName} {leadForm.lastName}
                </h1>
                <p className="text-gray-600">Lead Details & Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('quotes');
                  if (!isCreatingQuote) {
                    prefillQuoteFormFromPolicy();
                    setIsCreatingQuote(true);
                  }
                  setTimeout(() => {
                    createQuoteSectionRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }, 0);
                }}
              >
                Send Quote
              </Button>
              <Button
                size="sm"
                onClick={handleConvert}
                disabled={convertButtonDisabled}
              >
                {convertButtonLabel}
              </Button>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteLeadMutation.isPending}
                  >
                    Delete Lead
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. Deleting the lead will permanently
                      remove its related quotes, notes, and vehicle information.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteLeadMutation.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        variant="destructive"
                        onClick={() => deleteLeadMutation.mutate()}
                        disabled={deleteLeadMutation.isPending}
                      >
                        {deleteLeadMutation.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-end mb-4">
          <Button onClick={handleSave} disabled={updateLeadMutation.isPending}>
            {updateLeadMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'overview' | 'quotes' | 'payment-info')}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quotes">Quotes ({quotes?.length || 0})</TabsTrigger>
            <TabsTrigger value="payment-info">Payment Info</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Accordion type="single" collapsible defaultValue="lead">
                <AccordionItem value="lead">
                  <AccordionTrigger className="flex items-center">
                    <span className="mr-2"><User className="h-5 w-5" /></span>
                    Lead Information
                  </AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    <div className="space-y-4">
                      <div>
                        <Label>ID</Label>
                        <Input value={leadForm.id || ''} readOnly />
                        <input type="hidden" value={leadForm.id} />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={leadForm.status}
                          onValueChange={(value) =>
                            setLeadForm({ ...leadForm, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="--- Please Select ---" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="quoted">Quoted</SelectItem>
                            <SelectItem value="callback">Callback</SelectItem>
                            <SelectItem value="left-message">Left Message</SelectItem>
                            <SelectItem value="no-contact">No Contact</SelectItem>
                            <SelectItem value="wrong-number">Wrong Number</SelectItem>
                            <SelectItem value="fake-lead">Fake Lead</SelectItem>
                            <SelectItem value="not-interested">Not Interested</SelectItem>
                            <SelectItem value="duplicate-lead">Duplicate Lead</SelectItem>
                            <SelectItem value="dnc">DNC</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name</Label>
                          <Input
                            value={leadForm.firstName || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, firstName: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Last Name</Label>
                          <Input
                            value={leadForm.lastName || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, lastName: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          <Input
                            value={leadForm.email || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, email: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          <Input
                            value={leadForm.phone || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, phone: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Phone Type</Label>
                        <Input
                          value={leadForm.phoneType || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, phoneType: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Newsletter</Label>
                        <Select
                          value={leadForm.newsletter ? 'Yes' : 'No'}
                          onValueChange={(value) =>
                            setLeadForm({ ...leadForm, newsletter: value === 'Yes' })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="No">No</SelectItem>
                            <SelectItem value="Yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Referrer</Label>
                        <Input
                          value={leadForm.referrer || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, referrer: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>UID</Label>
                          <Input
                            value={leadForm.uid || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, uid: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>IP Address</Label>
                          <Input
                            value={leadForm.ipAddress || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, ipAddress: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Salesperson Email</Label>
                        <Input
                          type="email"
                          placeholder="name@company.com"
                          value={leadForm.salespersonEmail || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, salespersonEmail: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Date Created</Label>
                          <Input
                            value={leadForm.dateCreated || leadForm.createdAt || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, dateCreated: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Last Updated</Label>
                          <Input
                            value={leadForm.lastUpdated || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, lastUpdated: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Sent to Vanillasoft</Label>
                        <Input
                          value={leadForm.sentToVanillasoft ? 'Yes' : 'No'}
                          onChange={(e) =>
                            setLeadForm({
                              ...leadForm,
                              sentToVanillasoft: e.target.value === 'Yes',
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>SID</Label>
                          <Input
                            value={leadForm.sid || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, sid: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>SID2</Label>
                          <Input
                            value={leadForm.sid2 || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, sid2: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Converted By</Label>
                        <Input
                          value={leadForm.convertedBy || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, convertedBy: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Accordion type="multiple" className="space-y-4" defaultValue={["policy", "vehicle", "notes"]}>
                <AccordionItem value="policy">
                  <AccordionTrigger>Policy Information</AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Package</Label>
                          <Select
                            value={policyForm.package}
                            onValueChange={(value) => setPolicyForm({ ...policyForm, package: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="--- Please Select ---" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="silver">Silver</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Payment Schedule</Label>
                          <Select
                            value={policyForm.paymentOption}
                            onValueChange={(value) => {
                              const nextOption = value as PolicyFormState['paymentOption'];
                              setPolicyForm((prev) => {
                                if (prev.paymentOption === nextOption) {
                                  return prev;
                                }
                                if (nextOption === 'one-time') {
                                  return {
                                    ...prev,
                                    paymentOption: nextOption,
                                    monthlyPayment: '',
                                    totalPayments: '',
                                    downPayment: '',
                                  };
                                }
                                return { ...prev, paymentOption: nextOption };
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="one-time">Pay in Full (default)</SelectItem>
                              <SelectItem value="monthly">Monthly Installments</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="mt-1 text-xs text-slate-500">
                            Selecting monthly will require installment details.
                          </p>
                        </div>
                        <div>
                          <Label>Policy Start Date</Label>
                          <Input
                            type="date"
                            value={policyForm.policyStartDate}
                            onChange={(e) => setPolicyForm({ ...policyForm, policyStartDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Expiration Date</Label>
                          <Input
                            type="date"
                            value={policyForm.expirationDate}
                            onChange={(e) => {
                              setExpirationDateManuallyEdited(e.target.value.trim().length > 0);
                              setPolicyForm({ ...policyForm, expirationDate: e.target.value });
                            }}
                          />
                        </div>
                        <div>
                          <Label>Expiration Miles</Label>
                          <Input
                            value={policyForm.expirationMiles}
                            onChange={(e) => setPolicyForm({ ...policyForm, expirationMiles: e.target.value })}
                            placeholder="Expiration Miles"
                          />
                        </div>
                        <div>
                          <Label>Deductible</Label>
                          <Input
                            value={policyForm.deductible}
                            onChange={(e) => setPolicyForm({ ...policyForm, deductible: e.target.value })}
                            placeholder="Deductible"
                          />
                        </div>
                        <div>
                          <Label>Total Premium</Label>
                          <Input
                            value={policyForm.totalPremium}
                            onChange={(e) => setPolicyForm({ ...policyForm, totalPremium: e.target.value })}
                            placeholder="Total Premium"
                          />
                        </div>
                        {policyForm.paymentOption === 'monthly' && (
                          <>
                            <div>
                              <Label>Down Payment</Label>
                              <Input
                                value={policyForm.downPayment}
                                onChange={(e) =>
                                  setPolicyForm((prev) => ({ ...prev, downPayment: e.target.value }))
                                }
                                placeholder="Down Payment"
                              />
                            </div>
                            <div>
                              <Label>Monthly Payment</Label>
                              <Input
                                value={policyForm.monthlyPayment}
                                onChange={(e) =>
                                  setPolicyForm((prev) => ({ ...prev, monthlyPayment: e.target.value }))
                                }
                                placeholder="Monthly Payment"
                                required
                              />
                            </div>
                            <div>
                              <Label>Total Payments</Label>
                              <Input
                                value={policyForm.totalPayments}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                onChange={(e) =>
                                  setPolicyForm((prev) => ({ ...prev, totalPayments: e.target.value }))
                                }
                                placeholder="Total Payments"
                                required
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="vehicle">
                  <AccordionTrigger>Vehicle Information</AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    {Object.keys(vehicleForm).length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Year</Label>
                            <Input
                              value={vehicleForm.year || ''}
                              onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Make</Label>
                            <Input
                              value={vehicleForm.make || ''}
                              onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Model</Label>
                          <Input
                            value={vehicleForm.model || ''}
                            onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Mileage</Label>
                          <Input
                            value={vehicleForm.odometer || ''}
                            onChange={(e) => setVehicleForm({ ...vehicleForm, odometer: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Vin</Label>
                          <Input
                            value={vehicleForm.vin || ''}
                            onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Registered State</Label>
                          <Input
                            value={leadForm.state || ''}
                            onChange={(e) => setLeadForm({ ...leadForm, state: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No vehicle information available</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="notes">
                  <AccordionTrigger>Notes</AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {notes && notes.length > 0 ? (
                          notes.map((note: any) => (
                            <div key={note.id} className="border rounded p-2 text-sm">
                              {note.content}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">No notes yet</div>
                        )}
                      </div>
                      <Textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a new note"
                      />
                      <Button
                        onClick={() => addNoteMutation.mutate(newNote)}
                        disabled={addNoteMutation.isPending || !newNote.trim()}
                      >
                        {addNoteMutation.isPending ? 'Saving...' : 'Add Note'}
                      </Button>
                      <div className="pt-6 border-t border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Activity className="h-4 w-4" />
                          Lead activity
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                            <div>
                              <p className="font-medium">Lead Created</p>
                              <p className="text-sm text-muted-foreground">
                                Lead submitted quote request • {formatActivityDate(leadForm?.createdAt) ?? 'Date unavailable'}
                              </p>
                            </div>
                          </div>
                          {quotes && quotes.length > 0 ? (
                            quotes.map((quote: any) => (
                              <div key={quote.id} className="flex items-start gap-3">
                                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
                                <div>
                                  <p className="font-medium">Quote Created</p>
                                  <p className="text-sm text-muted-foreground">
                                    {quote.plan} plan quote for ${(quote.priceTotal / 100).toFixed(2)} • {formatActivityDate(quote.createdAt) ?? 'Date unavailable'}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No quotes have been created for this lead yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

          </TabsContent>

          <TabsContent value="quotes" className="space-y-6">
            {/* Create Quote */}
            <div ref={createQuoteSectionRef}>
              <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Create New Quote
                  </span>
                  <Button
                    onClick={() => {
                      if (!isCreatingQuote) {
                        prefillQuoteFormFromPolicy();
                        setIsCreatingQuote(true);
                      } else {
                        setIsCreatingQuote(false);
                      }
                    }}
                    variant={isCreatingQuote ? "outline" : "default"}
                  >
                    {isCreatingQuote ? 'Cancel' : 'New Quote'}
                  </Button>
                </CardTitle>
              </CardHeader>
              {isCreatingQuote && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Plan Type</Label>
                      <Select
                        value={quoteForm.plan}
                        onValueChange={(value) =>
                          setQuoteForm((prev) => ({
                            ...prev,
                            plan: value as QuoteFormState['plan'],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="silver">Silver</SelectItem>
                          <SelectItem value="gold">Gold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Deductible ($)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quoteForm.deductible ?? ''}
                        onChange={(event) => handleDeductibleChange(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Term (Months)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quoteForm.termMonths ?? ''}
                        onChange={(event) => handleTermMonthsChange(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Expiration Miles</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quoteForm.expirationMiles ?? ''}
                        onChange={(event) => handleExpirationMilesChange(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Payment Presentation</Label>
                      <Select
                        value={quoteForm.paymentOption}
                        onValueChange={(value) =>
                          setQuoteForm((prev) => {
                            const nextOption = value as QuoteFormState['paymentOption'];
                            if (
                              nextOption === 'monthly' &&
                              (prev.priceMonthly === null || prev.priceMonthly === 0) &&
                              prev.priceTotal !== null &&
                              prev.termMonths &&
                              prev.termMonths > 0
                            ) {
                              return {
                                ...prev,
                                paymentOption: nextOption,
                                priceMonthly: Math.round(prev.priceTotal / prev.termMonths),
                              };
                            }

                            if (nextOption === 'one-time') {
                              const resolvedMonthly =
                                prev.priceTotal !== null && prev.termMonths && prev.termMonths > 0
                                  ? Math.round(prev.priceTotal / prev.termMonths)
                                  : prev.priceMonthly;
                              return {
                                ...prev,
                                paymentOption: nextOption,
                                priceMonthly: resolvedMonthly,
                              };
                            }

                            return { ...prev, paymentOption: nextOption };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one-time">Pay in Full (default)</SelectItem>
                          <SelectItem value="monthly">Monthly Installments</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-slate-500">
                        Choose how pricing is emphasized in the customer email.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mileage Overview
                    </h4>
                    <div className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-slate-500">Current Miles</p>
                        <p className="font-medium text-slate-900">{currentMilesDisplay}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Expiration Miles</p>
                        <p className="font-medium text-slate-900">{expirationMilesDisplay}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Total Price ($)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={quoteForm.priceTotal !== null ? quoteForm.priceTotal / 100 : ''}
                        onChange={(e) => handleTotalPriceChange(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    {quoteForm.paymentOption === 'monthly' ? (
                      <div>
                        <Label>Monthly Price ($)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={quoteForm.priceMonthly !== null ? quoteForm.priceMonthly / 100 : ''}
                          onChange={(e) => handleMonthlyPriceChange(e.target.value)}
                          placeholder="0.00"
                        />
                        <p className="mt-1 text-xs text-slate-500">Displayed in the customer email.</p>
                      </div>
                    ) : null}
                  </div>
                  <Button 
                    onClick={handleCreateQuote}
                    disabled={createQuoteMutation.isPending}
                    className="w-full"
                  >
                    {createQuoteMutation.isPending ? 'Creating...' : 'Create Quote'}
                  </Button>
                </CardContent>
              )}
              </Card>
            </div>

            {/* Existing Quotes */}
            <Card>
              <CardHeader>
                <CardTitle>Quote History</CardTitle>
                <CardDescription>All quotes for this lead</CardDescription>
              </CardHeader>
              <CardContent>
                {quotes && quotes.length > 0 ? (
                  <div className="space-y-4">
                    {quotes.map((quote: any) => {
                      const breakdown = (quote.breakdown ?? null) as Record<string, unknown> | null;
                      let expirationMilesValue: number | null = null;
                      if (breakdown && Object.prototype.hasOwnProperty.call(breakdown, 'expirationMiles')) {
                        const raw = (breakdown as Record<string, unknown>).expirationMiles;
                        if (typeof raw === 'number' && Number.isFinite(raw)) {
                          expirationMilesValue = raw;
                        } else if (typeof raw === 'string') {
                          const parsed = Number(raw);
                          if (Number.isFinite(parsed)) {
                            expirationMilesValue = parsed;
                          }
                        }
                      }

                      const paymentOptionRaw =
                        breakdown && Object.prototype.hasOwnProperty.call(breakdown, 'paymentOption')
                          ? (breakdown as Record<string, unknown>).paymentOption
                          : null;
                      const paymentPreference: QuoteFormState['paymentOption'] =
                        paymentOptionRaw === 'monthly' ? 'monthly' : 'one-time';

                      const formattedExpirationMiles =
                        expirationMilesValue !== null
                          ? Number(expirationMilesValue).toLocaleString()
                          : null;

                      return (
                        <div key={quote.id} className="border rounded-lg p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-medium capitalize">{quote.plan} Plan</h4>
                                <Badge variant="secondary" className="capitalize">
                                  {paymentPreference === 'monthly' ? 'Monthly focus' : 'Pay-in-full focus'}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500">
                                Created {new Date(quote.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="outline">{quote.status}</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="font-medium">Pay in full:</span> ${(quote.priceTotal / 100).toFixed(2)}
                              </div>
                              {paymentPreference === 'monthly' && quote.priceMonthly > 0 && (
                                <div className="flex justify-between">
                                  <span className="font-medium">
                                    {paymentPreference === 'monthly' ? 'Monthly plan:' : 'Monthly option:'}
                                  </span>
                                  ${(quote.priceMonthly / 100).toFixed(2)}
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="font-medium">Deductible:</span> ${quote.deductible}
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Term:</span> {quote.termMonths} months
                              </div>
                              {formattedExpirationMiles ? (
                                <div className="flex justify-between">
                                  <span className="font-medium">Expiration Miles:</span> {formattedExpirationMiles}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-4 space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">Contract workflow</p>
                              {contractGroups[quote.id]?.length ? (
                                <span className="text-xs text-muted-foreground uppercase">
                                  {contractGroups[quote.id][0].status === 'signed' ? 'Signed' : 'Awaiting signature'}
                                </span>
                              ) : null}
                            </div>
                            {contractGroups[quote.id]?.length ? (
                              <ul className="space-y-1 text-sm text-slate-600">
                                {contractGroups[quote.id].map((contract) => {
                                  const statusLabel =
                                    contract.status === 'signed'
                                      ? 'Signed'
                                      : contract.status === 'sent'
                                        ? 'Awaiting signature'
                                        : contract.status;
                                  return (
                                    <li key={contract.id} className="flex items-center justify-between">
                                      <span className="capitalize">{statusLabel}</span>
                                      {contract.signedAt ? (
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(contract.signedAt).toLocaleString()}
                                        </span>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No contract sent yet for this quote.
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Contracts are prepared manually. Update the lead once paperwork is signed.
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No quotes created yet. Click "New Quote" to create the first quote.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-info" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment method</CardTitle>
                  <CardDescription>
                    Keep the customer&apos;s billing details on file for a smooth policy handoff.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Cardholder name</Label>
                      <Input value={cardholderName} readOnly className="bg-muted/30" />
                    </div>
                    <div>
                      <Label>Card number</Label>
                      <Input
                        value={leadForm.cardNumber || ''}
                        onChange={(e) => setLeadForm({ ...leadForm, cardNumber: e.target.value })}
                        inputMode="numeric"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Exp. month (MM)</Label>
                        <Input
                          value={leadForm.cardExpiryMonth || ''}
                          onChange={(e) => setLeadForm({ ...leadForm, cardExpiryMonth: e.target.value })}
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="MM"
                        />
                      </div>
                      <div>
                        <Label>Exp. year (YY)</Label>
                        <Input
                          value={leadForm.cardExpiryYear || ''}
                          onChange={(e) => setLeadForm({ ...leadForm, cardExpiryYear: e.target.value })}
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="YY"
                        />
                      </div>
                    </div>
                    <div className="max-w-xs">
                      <Label>CVV</Label>
                      <Input
                        value={leadForm.cardCvv || ''}
                        onChange={(e) => setLeadForm({ ...leadForm, cardCvv: e.target.value })}
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="CVV"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Billing &amp; shipping</CardTitle>
                  <CardDescription>
                    Addresses used on paperwork and future billing communications.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="shipping-same-as-billing"
                        checked={shippingSameAsBilling}
                        onCheckedChange={(value) => handleShippingSameAsBillingChange(value === true)}
                      />
                      <Label htmlFor="shipping-same-as-billing" className="text-sm font-medium text-slate-700">
                        Billing address is the same as shipping
                      </Label>
                    </div>
                    <div>
                      <Label>Shipping Address (Line 1)</Label>
                      <Input
                        value={leadForm.shippingAddress || ''}
                        onChange={(e) => handleShippingFieldChange('shippingAddress', e.target.value)}
                      />
                      <input type="hidden" value={leadForm.shippingAddress2 || ''} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Shipping City</Label>
                        <Input
                          value={leadForm.shippingCity || ''}
                          onChange={(e) => handleShippingFieldChange('shippingCity', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Shipping State</Label>
                        <Input
                          value={leadForm.shippingState || ''}
                          onChange={(e) => handleShippingFieldChange('shippingState', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Shipping Zipcode</Label>
                        <Input
                          value={leadForm.shippingZip || ''}
                          onChange={(e) => handleShippingFieldChange('shippingZip', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing</p>
                    </div>
                    <div>
                      <Label>Billing Address (Line 1)</Label>
                      <Input
                        value={leadForm.billingAddress || ''}
                        onChange={(e) => setLeadForm({ ...leadForm, billingAddress: e.target.value })}
                        disabled={shippingSameAsBilling}
                        className={shippingSameAsBilling ? 'bg-muted/30' : undefined}
                      />
                      <input type="hidden" value={leadForm.billingAddress2 || ''} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Billing City</Label>
                        <Input
                          value={leadForm.billingCity || ''}
                          onChange={(e) => setLeadForm({ ...leadForm, billingCity: e.target.value })}
                          disabled={shippingSameAsBilling}
                          className={shippingSameAsBilling ? 'bg-muted/30' : undefined}
                        />
                      </div>
                      <div>
                        <Label>Billing State</Label>
                        <Input
                          value={leadForm.billingState || ''}
                          onChange={(e) => setLeadForm({ ...leadForm, billingState: e.target.value })}
                          disabled={shippingSameAsBilling}
                          className={shippingSameAsBilling ? 'bg-muted/30' : undefined}
                        />
                      </div>
                      <div>
                        <Label>Billing Zipcode</Label>
                        <Input
                          value={leadForm.billingZip || ''}
                          onChange={(e) => setLeadForm({ ...leadForm, billingZip: e.target.value })}
                          disabled={shippingSameAsBilling}
                          className={shippingSameAsBilling ? 'bg-muted/30' : undefined}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}