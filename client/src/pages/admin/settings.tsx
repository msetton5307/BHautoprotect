import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon } from "lucide-react";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { clearCredentials, fetchWithAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/pjpeg"];

type BrandingResponse = {
  data?: {
    logoUrl: string | null;
  };
};

type BrandingUploadResponse = BrandingResponse;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read file."));
        return;
      }
      const base64 = result.includes(",") ? result.split(",").pop() ?? "" : result;
      if (!base64) {
        reject(new Error("Unable to read file."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

export default function AdminSettings() {
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const queriesEnabled = authenticated && !checking;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const brandingQuery = useQuery<BrandingResponse>({
    queryKey: ["/api/admin/branding"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/admin/branding");
      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }
      if (!response.ok) {
        throw new Error("Failed to load branding");
      }
      return response.json();
    },
    enabled: queriesEnabled,
    staleTime: 0,
  });

  const uploadMutation = useMutation<BrandingUploadResponse, Error, File>({
    mutationFn: async (file: File) => {
      let base64: string;
      try {
        base64 = await fileToBase64(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to read file.";
        throw new Error(message);
      }

      const response = await fetchWithAuth("/api/admin/branding/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: base64,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
        }),
      });

      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.message === "string" ? payload.message : "Failed to upload logo";
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/branding"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setValidationError(null);
      setUploadError(null);
      setSuccessMessage("Logo updated successfully.");
    },
    onError: (error) => {
      setUploadError(error.message);
      setSuccessMessage(null);
    },
  });

  const currentLogoUrl = useMemo(() => {
    const value = brandingQuery.data?.data?.logoUrl;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }, [brandingQuery.data]);

  const displayedPreview = previewUrl ?? currentLogoUrl ?? null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSuccessMessage(null);
    setUploadError(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (!file) {
      setSelectedFile(null);
      setValidationError(null);
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setValidationError("Please upload a JPG image file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setValidationError("Logo must be 2MB or smaller.");
      return;
    }

    setValidationError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setValidationError("Please choose a JPG logo before saving.");
      return;
    }

    setValidationError(null);
    setUploadError(null);
    uploadMutation.mutate(selectedFile);
  };

  const handleClearSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setValidationError(null);
    setUploadError(null);
    setSuccessMessage(null);
  };

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

  if (brandingQuery.isLoading && !brandingQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Site Branding
            </CardTitle>
            <CardDescription>
              Upload a JPG logo to replace the default illustration shown across the public site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full max-w-[220px] aspect-square rounded-lg border bg-white flex items-center justify-center overflow-hidden p-4">
                    {displayedPreview ? (
                      <img
                        src={displayedPreview}
                        alt="Current logo preview"
                        className="max-h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-sm text-muted-foreground">No logo uploaded yet</div>
                    )}
                  </div>
                  {currentLogoUrl && (
                    <p className="text-xs text-muted-foreground break-words text-center">
                      Live file: {currentLogoUrl}
                    </p>
                  )}
                </div>
              </div>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo image</Label>
                  <Input
                    id="logo"
                    type="file"
                    accept=".jpg,.jpeg,image/jpeg"
                    onChange={handleFileChange}
                    disabled={uploadMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a high-resolution JPG (max 2MB). We recommend at least 320×120 pixels with transparent or solid
                    background.
                  </p>
                </div>

                {validationError && (
                  <Alert variant="destructive">
                    <AlertTitle>Unable to use this file</AlertTitle>
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                {uploadError && (
                  <Alert variant="destructive">
                    <AlertTitle>Upload failed</AlertTitle>
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}

                {successMessage && (
                  <Alert>
                    <AlertTitle>Logo updated</AlertTitle>
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? "Uploading…" : "Save logo"}
                  </Button>
                  {selectedFile && (
                    <Button type="button" variant="outline" onClick={handleClearSelection} disabled={uploadMutation.isPending}>
                      Cancel selection
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
