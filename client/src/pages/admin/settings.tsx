import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, FileText, Mail as MailIcon } from "lucide-react";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { clearCredentials, fetchWithAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/pjpeg", "image/png", "image/x-png"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const MAX_CONTRACT_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_CONTRACT_ACCEPT = ".pdf,application/pdf";
const DEFAULT_INSTRUCTIONS_FALLBACK =
  "Ready to move forward? Click the contract button in your quote to review, complete your details, and sign to activate coverage.";

type BrandingResponse = {
  data?: {
    logoUrl: string | null;
  };
};

type BrandingUploadResponse = BrandingResponse;

type QuotePreferencesResponse = {
  data?: {
    defaultContract: {
      fileName: string;
      fileType: string | null;
      fileSize: number | null;
      updatedAt: string | null;
    } | null;
    emailInstructions: string;
    emailInstructionsUpdatedAt?: string | null;
  };
};

type SampleContractResponse = {
  data?: {
    contract: {
      fileName: string;
      fileType: string | null;
      fileSize: number | null;
      updatedAt: string | null;
      isPlaceholder: boolean;
      downloadUrl?: string;
    } | null;
  };
};

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
  const contractInputRef = useRef<HTMLInputElement | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractValidationError, setContractValidationError] = useState<string | null>(null);
  const [contractUploadError, setContractUploadError] = useState<string | null>(null);
  const [contractSuccessMessage, setContractSuccessMessage] = useState<string | null>(null);
  const sampleContractInputRef = useRef<HTMLInputElement | null>(null);
  const [sampleContractFile, setSampleContractFile] = useState<File | null>(null);
  const [sampleContractValidationError, setSampleContractValidationError] = useState<string | null>(null);
  const [sampleContractUploadError, setSampleContractUploadError] = useState<string | null>(null);
  const [sampleContractSuccessMessage, setSampleContractSuccessMessage] = useState<string | null>(null);
  const [quoteInstructions, setQuoteInstructions] = useState<string>(DEFAULT_INSTRUCTIONS_FALLBACK);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [instructionsSuccess, setInstructionsSuccess] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const queriesEnabled = authenticated && !checking;

  const formatFileSize = (size: number | null | undefined) => {
    if (!size || size <= 0) {
      return null;
    }
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (size >= 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${size} bytes`;
  };

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

  const quotePreferencesQuery = useQuery<QuotePreferencesResponse>({
    queryKey: ["/api/admin/quote-preferences"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/admin/quote-preferences");
      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }
      if (!response.ok) {
        throw new Error("Failed to load quote preferences");
      }
      return response.json();
    },
    enabled: queriesEnabled,
    staleTime: 0,
  });

  useEffect(() => {
    const value = quotePreferencesQuery.data?.data?.emailInstructions;
    if (typeof value === "string") {
      setQuoteInstructions(value);
    }
  }, [quotePreferencesQuery.data?.data?.emailInstructions]);

  const sampleContractQuery = useQuery<SampleContractResponse>({
    queryKey: ["/api/admin/sample-contract"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/admin/sample-contract");
      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }
      if (!response.ok) {
        throw new Error("Failed to load sample contract metadata");
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

      const normalizedFileName = file.name?.toLowerCase() ?? "";
      const normalizedType = file.type?.toLowerCase() ?? "";
      const fallbackMimeType =
        normalizedType ||
        (normalizedFileName.endsWith(".png")
          ? "image/png"
          : normalizedFileName.endsWith(".jpeg") || normalizedFileName.endsWith(".jpg")
            ? "image/jpeg"
            : "image/jpeg");

      const response = await fetchWithAuth("/api/admin/branding/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: base64,
          fileName: file.name,
          mimeType: fallbackMimeType,
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

  const uploadDefaultContractMutation = useMutation<QuotePreferencesResponse, Error, File>({
    mutationFn: async (file: File) => {
      let base64: string;
      try {
        base64 = await fileToBase64(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to read file.";
        throw new Error(message);
      }

      const response = await fetchWithAuth("/api/admin/quote-preferences/default-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileData: base64,
        }),
      });

      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.message === "string" ? payload.message : "Failed to save default contract";
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quote-preferences"] });
      setContractSuccessMessage("Default contract updated successfully.");
      setContractUploadError(null);
      setContractValidationError(null);
      setContractFile(null);
      if (contractInputRef.current) {
        contractInputRef.current.value = "";
      }
    },
    onError: (error) => {
      setContractUploadError(error.message);
      setContractSuccessMessage(null);
    },
  });

  const uploadSampleContractMutation = useMutation<SampleContractResponse, Error, File>({
    mutationFn: async (file: File) => {
      let base64: string;
      try {
        base64 = await fileToBase64(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to read file.";
        throw new Error(message);
      }

      const response = await fetchWithAuth("/api/admin/sample-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/pdf",
          fileData: base64,
        }),
      });

      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.message === "string" ? payload.message : "Failed to save sample contract";
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/sample-contract"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/site/sample-contract"] });
      if (sampleContractInputRef.current) {
        sampleContractInputRef.current.value = "";
      }
      setSampleContractFile(null);
      setSampleContractValidationError(null);
      setSampleContractUploadError(null);
      setSampleContractSuccessMessage("Sample contract updated successfully.");
    },
    onError: (error) => {
      setSampleContractSuccessMessage(null);
      setSampleContractUploadError(error.message);
    },
  });

  const saveInstructionsMutation = useMutation<QuotePreferencesResponse, Error, string>({
    mutationFn: async (instructions: string) => {
      const response = await fetchWithAuth("/api/admin/quote-preferences/email-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions }),
      });

      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.message === "string" ? payload.message : "Failed to update email instructions";
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quote-preferences"] });
      setInstructionsSuccess("Quote email instructions updated.");
      setInstructionsError(null);
    },
    onError: (error) => {
      setInstructionsError(error.message);
      setInstructionsSuccess(null);
    },
  });

  const currentLogoUrl = useMemo(() => {
    const value = brandingQuery.data?.data?.logoUrl;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }, [brandingQuery.data]);

  const displayedPreview = previewUrl ?? currentLogoUrl ?? null;

  const contractMetadata = quotePreferencesQuery.data?.data?.defaultContract ?? null;
  const contractSizeLabel = contractMetadata ? formatFileSize(contractMetadata.fileSize) : null;
  const contractUpdatedAt = useMemo(() => {
    if (!contractMetadata?.updatedAt) {
      return null;
    }
    const date = new Date(contractMetadata.updatedAt);
    if (Number.isNaN(date.valueOf())) {
      return null;
    }
    return date.toLocaleString();
  }, [contractMetadata?.updatedAt]);

  const sampleContractMetadata = sampleContractQuery.data?.data?.contract ?? null;
  const sampleContractSizeLabel = sampleContractMetadata
    ? formatFileSize(sampleContractMetadata.fileSize)
    : null;
  const sampleContractUpdatedAt = useMemo(() => {
    if (!sampleContractMetadata?.updatedAt) {
      return null;
    }
    const date = new Date(sampleContractMetadata.updatedAt);
    if (Number.isNaN(date.valueOf())) {
      return null;
    }
    return date.toLocaleString();
  }, [sampleContractMetadata?.updatedAt]);

  const instructionsUpdatedAt = useMemo(() => {
    const raw = quotePreferencesQuery.data?.data?.emailInstructionsUpdatedAt;
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    if (Number.isNaN(date.valueOf())) {
      return null;
    }
    return date.toLocaleString();
  }, [quotePreferencesQuery.data?.data?.emailInstructionsUpdatedAt]);

  const quotePreferencesErrorMessage = quotePreferencesQuery.isError
    ? quotePreferencesQuery.error instanceof Error
      ? quotePreferencesQuery.error.message
      : 'Failed to load quote preferences'
    : null;

  const sampleContractErrorMessage = sampleContractQuery.isError
    ? sampleContractQuery.error instanceof Error
      ? sampleContractQuery.error.message
      : 'Failed to load sample contract metadata'
    : null;

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

    const normalizedName = file.name?.toLowerCase() ?? "";
    const normalizedType = file.type?.toLowerCase() ?? "";
    const hasAcceptedMime = normalizedType ? ACCEPTED_MIME_TYPES.includes(normalizedType) : false;
    const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));

    if ((normalizedType && !hasAcceptedMime) || (!normalizedType && !hasAcceptedExtension)) {
      setSelectedFile(null);
      setValidationError("Please upload a JPG or PNG image file.");
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

  const handleContractFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setContractSuccessMessage(null);
    setContractUploadError(null);

    if (!file) {
      setContractFile(null);
      setContractValidationError(null);
      return;
    }

    if (file.type && !file.type.toLowerCase().includes('pdf')) {
      setContractFile(null);
      setContractValidationError('Please upload a PDF contract file.');
      return;
    }

    if (file.size > MAX_CONTRACT_FILE_SIZE) {
      setContractFile(null);
      setContractValidationError('Contract files must be 5MB or smaller.');
      return;
    }

    setContractValidationError(null);
    setContractFile(file);
  };

  const handleSampleContractFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSampleContractSuccessMessage(null);
    setSampleContractUploadError(null);

    if (!file) {
      setSampleContractFile(null);
      setSampleContractValidationError(null);
      return;
    }

    const normalizedType = file.type?.toLowerCase() ?? '';
    const normalizedName = file.name?.toLowerCase() ?? '';
    const isPdf = normalizedType.includes('pdf') || normalizedName.endsWith('.pdf');
    if (!isPdf) {
      setSampleContractFile(null);
      setSampleContractValidationError('Please upload a PDF contract file.');
      if (sampleContractInputRef.current) {
        sampleContractInputRef.current.value = '';
      }
      return;
    }

    if (file.size > MAX_CONTRACT_FILE_SIZE) {
      setSampleContractFile(null);
      setSampleContractValidationError('Contract files must be 5MB or smaller.');
      if (sampleContractInputRef.current) {
        sampleContractInputRef.current.value = '';
      }
      return;
    }

    setSampleContractValidationError(null);
    setSampleContractFile(file);
  };

  const handleContractUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!contractFile) {
      setContractValidationError('Please select a PDF contract before saving.');
      return;
    }

    setContractValidationError(null);
    setContractUploadError(null);
    uploadDefaultContractMutation.mutate(contractFile);
  };

  const handleClearContractSelection = () => {
    if (contractInputRef.current) {
      contractInputRef.current.value = '';
    }
    setContractFile(null);
    setContractValidationError(null);
    setContractUploadError(null);
    setContractSuccessMessage(null);
  };

  const handleSampleContractUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sampleContractFile) {
      setSampleContractValidationError('Please select a PDF contract before saving.');
      return;
    }

    setSampleContractValidationError(null);
    setSampleContractUploadError(null);
    uploadSampleContractMutation.mutate(sampleContractFile);
  };

  const handleClearSampleContractSelection = () => {
    if (sampleContractInputRef.current) {
      sampleContractInputRef.current.value = '';
    }
    setSampleContractFile(null);
    setSampleContractValidationError(null);
    setSampleContractUploadError(null);
    setSampleContractSuccessMessage(null);
  };

  const handleInstructionsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInstructionsError(null);
    setInstructionsSuccess(null);
    saveInstructionsMutation.mutate(quoteInstructions);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setValidationError("Please choose a JPG or PNG logo before saving.");
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
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Site Branding
              </CardTitle>
              <CardDescription>
                Upload a JPG or PNG logo to replace the default illustration shown across the public site.
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
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handleFileChange}
                      disabled={uploadMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload a high-resolution JPG or PNG (max 2MB). We recommend at least 320×120 pixels with transparent or solid background.
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Sample Contract (Public)
              </CardTitle>
              <CardDescription>
                Upload a PDF that visitors can view from the website footer as the sample contract.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {sampleContractErrorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Unable to load current sample</AlertTitle>
                  <AlertDescription>{sampleContractErrorMessage}</AlertDescription>
                </Alert>
              )}
              {sampleContractQuery.isLoading && !sampleContractQuery.data ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current sample</h3>
                    {sampleContractMetadata ? (
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <li>
                          <span className="font-medium text-foreground">File:</span> {sampleContractMetadata.fileName}
                        </li>
                        {sampleContractSizeLabel && (
                          <li>
                            <span className="font-medium text-foreground">Size:</span> {sampleContractSizeLabel}
                          </li>
                        )}
                        {sampleContractUpdatedAt && (
                          <li>
                            <span className="font-medium text-foreground">Updated:</span> {sampleContractUpdatedAt}
                          </li>
                        )}
                        <li>
                          <span className="font-medium text-foreground">Status:</span>{' '}
                          {sampleContractMetadata.isPlaceholder ? 'Using placeholder contract' : 'Custom contract in use'}
                        </li>
                        {sampleContractMetadata.downloadUrl && (
                          <li>
                            <a
                              href={sampleContractMetadata.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              View current sample contract
                            </a>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No sample contract uploaded yet. The placeholder contract will be displayed publicly until you provide
                        one.
                      </p>
                    )}
                  </div>
                  <form className="space-y-4" onSubmit={handleSampleContractUpload}>
                    <div className="space-y-2">
                      <Label htmlFor="sample-contract">Upload new sample contract</Label>
                      <Input
                        id="sample-contract"
                        type="file"
                        accept={ACCEPTED_CONTRACT_ACCEPT}
                        ref={sampleContractInputRef}
                        onChange={handleSampleContractFileChange}
                        disabled={uploadSampleContractMutation.isPending}
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload a PDF (max 5MB). This file will be linked in the footer as the sample contract visitors can
                        review.
                      </p>
                    </div>

                    {sampleContractValidationError && (
                      <Alert variant="destructive">
                        <AlertTitle>Unable to use this file</AlertTitle>
                        <AlertDescription>{sampleContractValidationError}</AlertDescription>
                      </Alert>
                    )}

                    {sampleContractUploadError && (
                      <Alert variant="destructive">
                        <AlertTitle>Upload failed</AlertTitle>
                        <AlertDescription>{sampleContractUploadError}</AlertDescription>
                      </Alert>
                    )}

                    {sampleContractSuccessMessage && (
                      <Alert>
                        <AlertTitle>Sample contract updated</AlertTitle>
                        <AlertDescription>{sampleContractSuccessMessage}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={uploadSampleContractMutation.isPending}>
                        {uploadSampleContractMutation.isPending ? 'Saving…' : 'Save sample contract'}
                      </Button>
                      {sampleContractFile && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearSampleContractSelection}
                          disabled={uploadSampleContractMutation.isPending}
                        >
                          Cancel selection
                        </Button>
                      )}
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Default Contract
              </CardTitle>
              <CardDescription>Upload a PDF contract that will be attached to every quote email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {quotePreferencesErrorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Unable to load current settings</AlertTitle>
                  <AlertDescription>{quotePreferencesErrorMessage}</AlertDescription>
                </Alert>
              )}
              {quotePreferencesQuery.isLoading && !quotePreferencesQuery.data ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current default</h3>
                    {contractMetadata ? (
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <li>
                          <span className="font-medium text-foreground">File:</span> {contractMetadata.fileName}
                        </li>
                        {contractSizeLabel && (
                          <li>
                            <span className="font-medium text-foreground">Size:</span> {contractSizeLabel}
                          </li>
                        )}
                        {contractUpdatedAt && (
                          <li>
                            <span className="font-medium text-foreground">Updated:</span> {contractUpdatedAt}
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No custom default contract uploaded. The placeholder contract will be used until you provide one.
                      </p>
                    )}
                  </div>
                  <form className="space-y-4" onSubmit={handleContractUpload}>
                    <div className="space-y-2">
                      <Label htmlFor="default-contract">Upload new contract</Label>
                      <Input
                        id="default-contract"
                        type="file"
                        accept={ACCEPTED_CONTRACT_ACCEPT}
                        ref={contractInputRef}
                        onChange={handleContractFileChange}
                        disabled={uploadDefaultContractMutation.isPending}
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload a PDF (max 5MB). We’ll include this contract automatically with every quote unless you attach a different file.
                      </p>
                    </div>

                    {contractValidationError && (
                      <Alert variant="destructive">
                        <AlertTitle>Unable to use this file</AlertTitle>
                        <AlertDescription>{contractValidationError}</AlertDescription>
                      </Alert>
                    )}

                    {contractUploadError && (
                      <Alert variant="destructive">
                        <AlertTitle>Upload failed</AlertTitle>
                        <AlertDescription>{contractUploadError}</AlertDescription>
                      </Alert>
                    )}

                    {contractSuccessMessage && (
                      <Alert>
                        <AlertTitle>Default contract updated</AlertTitle>
                        <AlertDescription>{contractSuccessMessage}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={uploadDefaultContractMutation.isPending}>
                        {uploadDefaultContractMutation.isPending ? "Saving…" : "Save default contract"}
                      </Button>
                      {contractFile && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearContractSelection}
                          disabled={uploadDefaultContractMutation.isPending}
                        >
                          Cancel selection
                        </Button>
                      )}
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailIcon className="h-5 w-5 text-primary" />
                Quote Email Instructions
              </CardTitle>
              <CardDescription>Customize the message customers see above the quote details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quotePreferencesQuery.isLoading && !quotePreferencesQuery.data ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleInstructionsSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="quote-instructions">Email message</Label>
                    <Textarea
                      id="quote-instructions"
                      value={quoteInstructions}
                      onChange={(event) => {
                        setQuoteInstructions(event.target.value);
                        setInstructionsError(null);
                        setInstructionsSuccess(null);
                      }}
                      rows={6}
                      disabled={saveInstructionsMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      This message appears in every quote email to encourage customers to review and sign their contract.
                    </p>
                    {instructionsUpdatedAt && (
                      <p className="text-xs text-muted-foreground">Last updated {instructionsUpdatedAt}.</p>
                    )}
                  </div>

                  {instructionsError && (
                    <Alert variant="destructive">
                      <AlertTitle>Save failed</AlertTitle>
                      <AlertDescription>{instructionsError}</AlertDescription>
                    </Alert>
                  )}

                  {instructionsSuccess && (
                    <Alert>
                      <AlertTitle>Instructions updated</AlertTitle>
                      <AlertDescription>{instructionsSuccess}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={saveInstructionsMutation.isPending}>
                    {saveInstructionsMutation.isPending ? "Saving…" : "Save instructions"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
