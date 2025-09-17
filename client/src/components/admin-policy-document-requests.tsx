import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DOCUMENT_REQUEST_STATUS_COPY,
  DOCUMENT_REQUEST_TYPE_COPY,
  type CustomerDocumentRequestRecord,
  formatFileSize,
} from "@/lib/document-requests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Calendar, CheckCircle2, UploadCloud, FileDown, Clock3 } from "lucide-react";

type Props = {
  policyId: string;
  customers: { id: string; email: string; displayName?: string | null }[];
};

type AdminDocumentRequestsResponse = {
  data?: { requests?: CustomerDocumentRequestRecord[] };
};

type AdminDocumentUploadResponse = {
  data?: {
    dataUrl?: string;
    fileName?: string;
    fileType?: string | null;
  };
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return dateFormatter.format(parsed);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function PolicyDocumentRequests({ policyId, customers }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [type, setType] = useState<keyof typeof DOCUMENT_REQUEST_TYPE_COPY>("vin_photo");
  const [title, setTitle] = useState("VIN photo for verification");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const hasCustomers = customers.length > 0;

  const { data, isLoading } = useQuery<AdminDocumentRequestsResponse>({
    queryKey: ["/api/admin/policies", policyId, "document-requests"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/policies/${policyId}/document-requests`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error("Failed to load document requests");
      }
      return res.json();
    },
  });

  const requests = useMemo(() => data?.data?.requests ?? [], [data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        type,
        title,
        instructions: instructions.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };
      const res = await fetchWithAuth(`/api/admin/policies/${policyId}/document-requests`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const message = typeof (json as { message?: unknown }).message === "string" ? (json as { message: string }).message : "Unable to create request";
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", policyId, "document-requests"] });
      toast({
        title: "Request sent",
        description: "The customer will now see this document request in their portal.",
      });
      setInstructions("");
      setDueDate("");
    },
    onError: (error: Error) => {
      toast({ title: "Unable to create request", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      const res = await fetchWithAuth(`/api/admin/document-requests/${requestId}/status`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const message = typeof (json as { message?: unknown }).message === "string" ? (json as { message: string }).message : "Unable to update status";
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", policyId, "document-requests"] });
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleDownload = async (uploadId: string, fileName: string) => {
    try {
      setDownloadingId(uploadId);
      const res = await fetchWithAuth(`/api/admin/document-uploads/${uploadId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error("Unable to retrieve file");
      }
      const json = (await res.json()) as AdminDocumentUploadResponse;
      const dataUrl = json?.data?.dataUrl;
      if (typeof dataUrl === "string") {
        downloadDataUrl(dataUrl, fileName);
      } else {
        throw new Error("Missing file data");
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "We couldn’t fetch that file.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-white/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Request new documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasCustomers ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
              Link a customer portal user to this policy to send document requests.
            </div>
          ) : (
            <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="admin-document-customer">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="admin-document-customer">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.displayName?.trim() || customer.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-document-type">Document type</Label>
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger id="admin-document-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DOCUMENT_REQUEST_TYPE_COPY) as Array<keyof typeof DOCUMENT_REQUEST_TYPE_COPY>).map((key) => (
                    <SelectItem key={key} value={key}>
                      {DOCUMENT_REQUEST_TYPE_COPY[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-document-due">Due date (optional)</Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-document-due"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-document-title">Title</Label>
              <Input
                id="admin-document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: VIN verification photo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-document-instructions">Instructions</Label>
              <Textarea
                id="admin-document-instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder={DOCUMENT_REQUEST_TYPE_COPY[type].hint}
                className="min-h-[88px]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => createMutation.mutate()} disabled={!customerId || !title.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Sending…" : "Create request"}
            </Button>
          </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Requests on file</h3>
          <p className="text-sm text-slate-500">
            Track what’s been asked for, see customer uploads, and close out tasks once everything looks good.
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
            <UploadCloud className="h-5 w-5 text-slate-300" />
            No document requests yet for this policy.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const typeInfo = DOCUMENT_REQUEST_TYPE_COPY[request.type];
              const statusInfo = DOCUMENT_REQUEST_STATUS_COPY[request.status];
              const toneClass =
                statusInfo.tone === "success"
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                  : statusInfo.tone === "notice"
                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                    : statusInfo.tone === "pending"
                      ? "bg-sky-100 text-sky-900 border border-sky-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200";

              return (
                <Card key={request.id} className="overflow-hidden border-slate-200">
                  <CardHeader className="space-y-4 bg-gradient-to-br from-white via-slate-50 to-white">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                        {typeInfo.label}
                      </Badge>
                      <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", toneClass)}>
                        {statusInfo.label}
                      </span>
                      {request.dueDate ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                          <Clock3 className="h-3.5 w-3.5" /> Due {formatDate(request.dueDate)}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-slate-900">{request.title}</CardTitle>
                      <p className="text-sm text-slate-500">
                        {request.customer?.displayName?.trim() || request.customer?.email} • Policy {request.policyId}
                      </p>
                      <p className="text-xs text-slate-500">{statusInfo.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-600">
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4">
                      <p className="font-medium text-slate-700">Instructions for the customer</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {request.instructions?.trim() || typeInfo.hint}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ requestId: request.id, status: "submitted" })}
                      >
                        Mark as received
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ requestId: request.id, status: "completed" })}
                      >
                        Close out request
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ requestId: request.id, status: "pending" })}
                      >
                        Re-open
                      </Button>
                    </div>
                    {request.uploads.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700">Customer uploads</p>
                        <div className="space-y-2">
                          {request.uploads.map((upload) => (
                            <div
                              key={upload.id}
                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
                            >
                              <div>
                                <p className="font-medium text-slate-800">{upload.fileName}</p>
                                <p className="text-xs text-slate-500">
                                  {formatFileSize(upload.fileSize)} • Uploaded {formatDate(upload.createdAt)}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-slate-200"
                                onClick={() => handleDownload(upload.id, upload.fileName)}
                                disabled={downloadingId === upload.id}
                              >
                                {downloadingId === upload.id ? "Preparing…" : "Download"}
                                <FileDown className="ml-2 h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
                        No files uploaded yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
