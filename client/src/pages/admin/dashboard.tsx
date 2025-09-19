import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Users, FileText, Target, TrendingUp, Activity, Calendar, UserPlus, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { clearCredentials, fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

export default function AdminDashboard() {
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();

  const queriesEnabled = authenticated && !checking;

  const statsQuery = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const res = await fetchWithAuth('/api/admin/stats', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: queriesEnabled,
  });

  const recentLeadsQuery = useQuery({
    queryKey: ['/api/admin/leads'],
    queryFn: async () => {
      const res = await fetchWithAuth('/api/admin/leads', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch leads');
      return res.json();
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: queriesEnabled,
  });

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

  if (statsQuery.isLoading && !statsQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const statsData = statsQuery.data?.data || {};
  const leads = recentLeadsQuery.data?.data?.slice(0, 5) || [];
  const pipeline = statsData.leadsByStatus || [];
  const totalPipeline = pipeline.reduce((total: number, item: any) => total + (item.count || 0), 0);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US", { notation: value > 999 ? "compact" : "standard" }).format(value || 0);

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminNav />
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Insight Hub
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">BH Auto Protect Admin Dashboard</h1>
              <p className="mt-3 text-base leading-relaxed text-slate-500">
                Stay ahead of every lead, policy, and claim with a streamlined workspace built for clarity. Review the latest activity and jump into action without the clutter.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button className="h-12 rounded-full px-6 text-sm font-semibold" asChild>
              <Link href="/admin/leads">View all leads</Link>
            </Button>
            <Button variant="outline" className="h-12 rounded-full px-6 text-sm font-semibold" asChild>
              <Link href="/">Return to site</Link>
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl space-y-10 px-6 py-10 sm:px-8 lg:px-12">
        <section>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card className="card-hover overflow-hidden rounded-3xl border-none bg-white shadow-lg ring-1 ring-slate-900/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <div>
                  <CardDescription className="text-xs uppercase tracking-wide text-slate-400">Total leads</CardDescription>
                  <CardTitle className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(statsData.totalLeads || 0)}</CardTitle>
                </div>
                <div className="rounded-full bg-blue-50 p-3 text-blue-500">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="mt-6 border-t border-slate-100/80 pt-5">
                <p className="text-sm text-slate-500">All contacts captured across every channel.</p>
              </CardContent>
            </Card>

            <Card className="card-hover overflow-hidden rounded-3xl border-none bg-white shadow-lg ring-1 ring-slate-900/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <div>
                  <CardDescription className="text-xs uppercase tracking-wide text-slate-400">New this month</CardDescription>
                  <CardTitle className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(statsData.newLeads || 0)}</CardTitle>
                </div>
                <div className="rounded-full bg-emerald-50 p-3 text-emerald-500">
                  <Calendar className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="mt-6 border-t border-slate-100/80 pt-5">
                <p className="text-sm text-slate-500">Fresh opportunities generated over the last 30 days.</p>
              </CardContent>
            </Card>

            <Card className="card-hover overflow-hidden rounded-3xl border-none bg-white shadow-lg ring-1 ring-slate-900/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <div>
                  <CardDescription className="text-xs uppercase tracking-wide text-slate-400">Quoted leads</CardDescription>
                  <CardTitle className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(statsData.quotedLeads || 0)}</CardTitle>
                </div>
                <div className="rounded-full bg-violet-50 p-3 text-violet-500">
                  <FileText className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="mt-6 border-t border-slate-100/80 pt-5">
                <p className="text-sm text-slate-500">Quotes delivered and awaiting follow up.</p>
              </CardContent>
            </Card>

            <Card className="card-hover overflow-hidden rounded-3xl border-none bg-white shadow-lg ring-1 ring-slate-900/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <div>
                  <CardDescription className="text-xs uppercase tracking-wide text-slate-400">Conversion rate</CardDescription>
                  <CardTitle className="mt-2 text-3xl font-semibold text-slate-900">{statsData.conversionRate || 0}%</CardTitle>
                </div>
                <div className="rounded-full bg-amber-50 p-3 text-amber-500">
                  <Target className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="mt-6 border-t border-slate-100/80 pt-5">
                <p className="text-sm text-slate-500">Closed-won rate across all active deals.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden rounded-3xl border-none bg-white shadow-lg ring-1 ring-slate-900/5">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Activity className="h-5 w-5 text-blue-500" />
                Recent leads
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Latest quote requests and their current progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-8 pt-6">
              {leads.length > 0 ? (
                leads.map((item: any) => (
                  <div
                    key={item.lead.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm transition hover:bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {item.lead.firstName} {item.lead.lastName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {item.vehicle?.year} {item.vehicle?.make} {item.vehicle?.model}
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                        {item.lead.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                      <span>Created {new Date(item.lead.createdAt).toLocaleDateString()}</span>
                      <Button size="sm" variant="outline" className="rounded-full px-4" asChild>
                        <Link href={`/admin/leads/${item.lead.id}`}>
                          Review details
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-12 text-center">
                  <Sparkles className="h-6 w-6 text-slate-400" />
                  <div>
                    <p className="text-base font-semibold text-slate-700">No leads just yet</p>
                    <p className="text-sm text-slate-500">New quote requests will appear here as soon as they arrive.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="overflow-hidden rounded-3xl border-none bg-white shadow-lg ring-1 ring-slate-900/5">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Lead pipeline
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  See how prospects are flowing through each status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pb-8 pt-6">
                {pipeline.length > 0 ? (
                  pipeline.map((status: any) => {
                    const percentage = totalPipeline ? Math.round((status.count / totalPipeline) * 100) : 0;
                    return (
                      <div key={status.status} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize text-slate-600">{status.status.replace('-', ' ')}</span>
                          <span className="text-xs font-semibold text-slate-400">{status.count} leads</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400">{percentage}% of active pipeline</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-10 text-center">
                    <Target className="h-6 w-6 text-slate-400" />
                    <div>
                      <p className="text-base font-semibold text-slate-700">No pipeline data</p>
                      <p className="text-sm text-slate-500">Once leads progress through stages you will see them here.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-3xl border-none bg-white shadow-lg ring-1 ring-slate-900/5">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                  <Users className="h-5 w-5 text-sky-500" />
                  Quick actions
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Jump straight into the most common workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pb-8 pt-6 md:grid-cols-2">
                <Button className="h-20 justify-between rounded-2xl border border-transparent bg-slate-900 px-5 text-left text-base font-semibold text-white shadow-lg transition hover:bg-slate-800" asChild>
                  <Link href="/admin/leads">
                    Manage leads
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button className="h-20 justify-between rounded-2xl border border-slate-200 bg-white px-5 text-left text-base font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50" variant="outline" asChild>
                  <Link href="/admin/users">
                    Manage users
                    <UserPlus className="h-5 w-5" />
                  </Link>
                </Button>
                <Button className="h-20 justify-between rounded-2xl border border-slate-200 bg-white px-5 text-left text-base font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50" variant="outline">
                  Performance insights
                  <TrendingUp className="h-5 w-5" />
                </Button>
                <Button className="h-20 justify-between rounded-2xl border border-slate-200 bg-white px-5 text-left text-base font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50" variant="outline">
                  Update brand assets
                  <Sparkles className="h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator className="border-slate-200/80" />

        <section className="grid gap-6 text-sm text-slate-500 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Today’s priorities</h2>
            <p className="mt-3 leading-relaxed">
              Review recently quoted leads and follow up with warm prospects. Confirm upcoming renewal reminders to keep retention strong.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Workflow tips</h2>
            <p className="mt-3 leading-relaxed">
              Use advanced filters on the leads page to isolate duplicates and speed up your outbound efforts.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Need help?</h2>
            <p className="mt-3 leading-relaxed">
              Reach out to the BH Auto Protect support team for onboarding assistance or to request new dashboard metrics.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}