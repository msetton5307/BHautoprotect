export type DocumentRequestType =
  | 'vin_photo'
  | 'odometer_photo'
  | 'diagnosis_report'
  | 'repair_invoice'
  | 'other';

export type DocumentRequestStatus = 'pending' | 'submitted' | 'completed' | 'cancelled';

export type DocumentUploadMeta = {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string | null;
};

export type DocumentPolicySummary = {
  id: string;
  package: string | null;
  policyStartDate: string | null;
  expirationDate: string | null;
  lead: {
    firstName: string | null;
    lastName: string | null;
  } | null;
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    vin: string | null;
  } | null;
} | null;

export type CustomerDocumentRequestRecord = {
  id: string;
  policyId: string;
  customerId?: string;
  customer?: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
  type: DocumentRequestType;
  title: string;
  instructions: string | null;
  status: DocumentRequestStatus;
  dueDate: string | null;
  requestedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  policy: DocumentPolicySummary;
  uploads: DocumentUploadMeta[];
};

export const DOCUMENT_REQUEST_TYPE_COPY: Record<
  DocumentRequestType,
  { label: string; hint: string }
> = {
  vin_photo: {
    label: 'VIN Photo',
    hint: 'Upload a clear photo of the VIN plate or door jamb sticker.',
  },
  odometer_photo: {
    label: 'Odometer Reading',
    hint: 'Capture the current mileage in your dashboard display.',
  },
  diagnosis_report: {
    label: 'Diagnosis Report',
    hint: 'Share the technician or dealership findings for your issue.',
  },
  repair_invoice: {
    label: 'Repair Invoice',
    hint: 'Send the itemized invoice so we can process reimbursement quickly.',
  },
  other: {
    label: 'Supporting Document',
    hint: 'Provide any additional paperwork our team asked for.',
  },
};

export const DOCUMENT_REQUEST_DEFAULTS: Record<
  DocumentRequestType,
  { title: string; instructions: string }
> = {
  vin_photo: {
    title: 'VIN photo for verification',
    instructions:
      'Please snap a clear photo of the VIN plate or door jamb sticker so we can confirm the vehicle on file matches your policy.',
  },
  odometer_photo: {
    title: 'Current mileage confirmation',
    instructions:
      'Take a quick photo of your dashboard or digital display that clearly shows the current mileage reading for this vehicle.',
  },
  diagnosis_report: {
    title: 'Diagnosis report from your shop',
    instructions:
      'Upload the inspection or diagnosis report from your technician so our team can review the recommended work.',
  },
  repair_invoice: {
    title: 'Repair invoice for reimbursement',
    instructions:
      'Send the finalized invoice from your repair facility, including parts and labor, so we can finish processing reimbursement.',
  },
  other: {
    title: 'Supporting document upload',
    instructions:
      'Share any additional paperwork or photos our team mentioned so we can keep your claim moving.',
  },
};

export const DOCUMENT_REQUEST_STATUS_COPY: Record<
  DocumentRequestStatus,
  { label: string; description: string; tone: 'pending' | 'notice' | 'success' | 'muted' }
> = {
  pending: {
    label: 'Awaiting Upload',
    description: 'We’re waiting on files from you to finish this step.',
    tone: 'notice',
  },
  submitted: {
    label: 'Received',
    description: 'Thanks! Our team is reviewing what you sent.',
    tone: 'pending',
  },
  completed: {
    label: 'Completed',
    description: 'All set. We have everything we need here.',
    tone: 'success',
  },
  cancelled: {
    label: 'No Longer Needed',
    description: 'This request was cancelled by our team.',
    tone: 'muted',
  },
};

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
};

export const summarizeVehicle = (policy: DocumentPolicySummary): string => {
  if (!policy?.vehicle) {
    return 'Vehicle on file';
  }
  const { year, make, model } = policy.vehicle;
  return [year ?? undefined, make || undefined, model || undefined]
    .filter((part) => part != null && `${part}`.trim().length > 0)
    .join(' ')
    .trim() || 'Vehicle on file';
};
