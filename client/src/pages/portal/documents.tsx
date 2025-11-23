import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DOCUMENT_REQUEST_STATUS_COPY,
  DOCUMENT_REQUEST_TYPE_COPY,
  type CustomerDocumentRequestRecord,
  formatFileSize,
  summarizeVehicle,
} from "@/lib/document-requests";
import type { CustomerSessionSnapshot } from "@/lib/customer-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileDown,
  Inbox,
  Paperclip,
  UploadCloud,
} from "lucide-react";

type Props = {
  session: CustomerSessionSnapshot;
};

type UploadPayload = {
  requestId: string;
  file: File;
};

const STATUS_TONE_CLASSES: Record<string, string> = {
  notice: "bg-amber-100 text-amber-900 border border-amber-200",
  pending: "bg-sky-100 text-sky-900 border border-sky-200",
  success: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  muted: "bg-slate-100 text-slate-600 border border-slate-200",
};

const formatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return formatter.format(parsed);
}

function buildDownloadLink(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

type DocumentRequestCardProps = {
  request: CustomerDocumentRequestRecord;
  highlighted?: boolean;
};

function DocumentRequestCard({ request, highlighted }: DocumentRequestCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fileState, setFileState] = useState<File | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlighted && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      containerRef.current.focus({ preventScroll: true });
    }
  }, [highlighted]);

  const uploadMutation = useMutation({
    mutationFn: async (payload: UploadPayload) => {
      const buffer = await payload.file.arrayBuffer();
      const res = await fetch(`/api/customer/document-requests/${payload.requestId}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": payload.file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(payload.file.name),
          "X-File-Size": `${payload.file.size}`,
        },
        credentials: "include",
        body: buffer,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const message = typeof (json as { message?: unknown }).message === "string" ? (json as { message: string }).message : "Unable to upload file";
        throw new Error(message);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/document-requests"] });
      setFileState(null);
      toast({
        title: "Upload received",
        description: "Thanks! Our document team has your file and will review it shortly.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileState(null);
      return;
    }
    setFileState(file);
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fileState || uploadMutation.isPending) return;

    uploadMutation.mutate({
      requestId: request.id,
      file: fileState,
    });
  };

  const handleDownload = async (uploadId: string, fileName: string) => {
    try {
      setDownloadingId(uploadId);
      const res = await fetch(`/api/customer/document-uploads/${uploadId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Unable to download file");
      }
      const json = (await res.json()) as { data?: { dataUrl?: string } };
      const dataUrl = json?.data?.dataUrl;
      if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
        buildDownloadLink(dataUrl, fileName);
      } else {
        throw new Error("The file could not be downloaded");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Download failed",
        description: "We couldn’t retrieve that file. Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const typeInfo = DOCUMENT_REQUEST_TYPE_COPY[request.type];
  const statusInfo = DOCUMENT_REQUEST_STATUS_COPY[request.status];
  const statusClasses = STATUS_TONE_CLASSES[statusInfo.tone] ?? STATUS_TONE_CLASSES.muted;
  const hasUploads = request.uploads.length > 0;
  const uploadDisabled = request.status === "completed" || request.status === "cancelled";

  return (
    <Card
      ref={containerRef}
      className={cn(
        "overflow-hidden border shadow-sm transition",
        highlighted ? "border-primary ring-2 ring-primary/20" : "border-slate-200",
      )}
      id={`document-request-${request.id}`}
      tabIndex={-1}
    >
      <CardHeader className="space-y-4 border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-white">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
            {typeInfo.label}
          </Badge>
          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", statusClasses)}>
            {statusInfo.label}
          </span>
          {request.dueDate ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
              <Clock3 className="h-3.5 w-3.5" /> Due {formatDate(request.dueDate)}
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold text-slate-900">{request.title}</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {`Policy ${request.policy?.id ?? request.policyId}`} • {summarizeVehicle(request.policy)}
          </CardDescription>
          <p className="text-sm text-slate-500">{statusInfo.description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">What to upload</p>
          <p className="mt-2 leading-relaxed">{request.instructions || typeInfo.hint}</p>
        </div>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <label className="flex h-full flex-col rounded-lg border border-slate-200 bg-white/60 p-4 text-sm text-slate-600 shadow-sm transition hover:border-slate-300">
              <span className="flex items-center gap-2 text-slate-700">
                <UploadCloud className="h-4 w-4 text-primary" />
                Choose a file
              </span>
              <span className="mt-1 text-xs text-slate-500">JPG, JPEG, PNG, or any file type up to 20MB.</span>
              <Input
                type="file"
                className="mt-3 cursor-pointer border-0 px-0 text-sm"
                onChange={handleFileChange}
                disabled={uploadDisabled || uploadMutation.isPending}
              />
            </label>
            <Button type="submit" className="justify-self-end" disabled={!fileState || uploadDisabled || uploadMutation.isPending}>
              {uploadMutation.isPending ? "Uploading…" : "Send to BH"}
            </Button>
          </div>
          {fileState ? (
            <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
              <Paperclip className="h-4 w-4 text-slate-400" />
              <div className="flex-1 truncate">
                <p className="truncate font-medium text-slate-700">{fileState.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(fileState.size)} • {fileState.type || "Unknown type"}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setFileState(null)}>
                Clear
              </Button>
            </div>
          ) : null}
        </form>
        {hasUploads ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">What you’ve already sent</h4>
            <div className="space-y-2">
              {request.uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">{upload.fileName}</span>
                    <span className="text-xs text-slate-500">
                      {formatFileSize(upload.fileSize)} • Uploaded {formatDate(upload.createdAt)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(upload.id, upload.fileName)}
                    disabled={downloadingId === upload.id}
                    className="border-slate-200"
                  >
                    {downloadingId === upload.id ? "Preparing…" : "Download"}
                    <FileDown className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function CustomerPortalDocuments({ session }: Props) {
  const [location] = useLocation();
  const { data, isLoading } = useQuery<{ data?: { requests?: CustomerDocumentRequestRecord[] } }>({
    queryKey: ["/api/customer/document-requests"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const requests = useMemo(() => data?.data?.requests ?? [], [data]);
  const openRequests = useMemo(
    () => requests.filter((request) => request.status !== "completed" && request.status !== "cancelled"),
    [requests],
  );
  const completedRequests = useMemo(
    () => requests.filter((request) => request.status === "completed"),
    [requests],
  );
  const recentUploads = useMemo(() => {
    const uploads = requests.flatMap((request) =>
      request.uploads.map((upload) => ({
        ...upload,
        request,
      })),
    );
    return uploads.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).valueOf() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).valueOf() : 0;
      return bTime - aTime;
    });
  }, [requests]);

  const nextDueDate = useMemo(() => {
    let earliest: string | null = null;
    for (const request of openRequests) {
      if (!request.dueDate) continue;
      if (!earliest || new Date(request.dueDate).valueOf() < new Date(earliest).valueOf()) {
        earliest = request.dueDate;
      }
    }
    return earliest;
  }, [openRequests]);

  const totalPolicies = session.policies.length;
  const highlightedRequestId = useMemo(() => {
    if (!location) return "";
    const queryIndex = location.indexOf("?");
    if (queryIndex === -1) return "";
    try {
      const params = new URLSearchParams(location.slice(queryIndex + 1));
      return params.get("request") ?? "";
    } catch (error) {
      console.error("Unable to parse document highlight", error);
      return "";
    }
  }, [location]);

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 bg-gradient-to-br from-primary/10 via-white to-white px-6 py-8 md:grid-cols-3">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Document center</h2>
            <p className="text-sm text-slate-600">
              Upload photos and paperwork our claims team needs. We’ll show the latest requests and confirmations below.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-amber-500">Outstanding</p>
                <p className="text-lg font-semibold text-slate-900">{openRequests.length}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {openRequests.length === 0
                ? "No open tasks right now."
                : nextDueDate
                  ? `Next due ${formatDate(nextDueDate)}.`
                  : "Submit whenever it’s convenient—no deadlines set."}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-500">Completed</p>
                <p className="text-lg font-semibold text-slate-900">{completedRequests.length}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {completedRequests.length === 0
                ? "We’ll mark items complete once reviewed."
                : "Everything listed here has been cleared by our team."}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200 bg-white px-6 py-5 text-sm text-slate-600">
          <p>
            Covered vehicles on file: <span className="font-medium text-slate-900">{totalPolicies}</span>. Need help? Email{' '}
            <a className="font-medium text-primary" href="mailto:support@bhautoprotect.com">
              support@bhautoprotect.com
            </a>
            .
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Open requests</h3>
            <p className="text-sm text-slate-500">
              We’ll keep this list updated as soon as someone from the BH Auto Protect team asks for new documentation.
            </p>
          </div>
        </div>
        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : openRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            <Inbox className="h-10 w-10 text-slate-300" />
            <div className="space-y-1">
              <p className="font-medium text-slate-700">No outstanding uploads</p>
              <p className="text-sm text-slate-500">
                When we need something from you—like a VIN photo or diagnosis report—it’ll appear here instantly.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {openRequests.map((request) => (
              <DocumentRequestCard
                key={request.id}
                request={request}
                highlighted={request.id === highlightedRequestId}
              />
            ))}
          </div>
        )}
      </section>

      {recentUploads.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-slate-900">Recent uploads</h3>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[360px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">File</th>
                    <th className="px-4 py-3 font-medium">Request</th>
                    <th className="px-4 py-3 font-medium">Uploaded</th>
                    <th className="px-4 py-3 font-medium text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {recentUploads.slice(0, 6).map((upload) => (
                    <tr key={upload.id}>
                      <td className="px-4 py-3 font-medium text-slate-700">{upload.fileName}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-700">{upload.request.title}</div>
                        <div className="text-xs text-slate-500">{DOCUMENT_REQUEST_TYPE_COPY[upload.request.type].label}</div>
                      </td>
                      <td className="px-4 py-3">{formatDate(upload.createdAt)}</td>
                      <td className="px-4 py-3 text-right">{formatFileSize(upload.fileSize)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
