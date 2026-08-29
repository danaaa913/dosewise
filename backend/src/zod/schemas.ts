import * as zod from "zod/v4";

export const HealthCheckResponse = zod.object({ status: zod.string() });

export const jordanPhone = zod
  .string()
  .regex(/^(\+962|00962|0)?7[789]\d{7}$/, "Invalid Jordanian phone number");

const MAX_LICENSE_DOC_BASE64 = 6_000_000;

export const LicenseDocumentInput = zod.object({
  name: zod.string().min(1).max(200),
  mime: zod.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  data: zod.string().max(MAX_LICENSE_DOC_BASE64),
});

export type LicenseDocument = zod.infer<typeof LicenseDocumentInput>;

export const RegisterPharmacyBody = zod.object({
  name: zod.string().min(2).max(120),
  managerName: zod.string().min(2).max(120),
  email: zod.string().email().max(200),
  phone: jordanPhone,
  city: zod.string().min(2).max(80),
  address: zod.string().min(5).max(300),
  password: zod.string().min(12).max(128),
  licenseNumber: zod.string().max(50).optional(),
  licenseDoc: LicenseDocumentInput.optional(),
});

export const UpdateLicenseBody = zod.object({
  licenseNumber: zod.string().max(50).optional(),
  licenseDoc: LicenseDocumentInput.optional(),
});

export const VerificationDecisionBody = zod.object({
  decision: zod.enum(["approve", "reject"]),
  reason: zod.string().min(5).max(500).optional(),
}).refine(
  (data) => data.decision === "approve" || (data.reason !== undefined && data.reason.trim().length >= 5),
  { message: "A rejection reason (min 5 chars) is required", path: ["reason"] },
);

export const LoginPharmacyBody = zod.object({
  email: zod.string().email(),
  password: zod.string().min(1),
});

export const AdminLoginBody = zod.object({
  email: zod.string().email(),
  password: zod.string(),
});

function isValidCalendarDate(value: string): boolean {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === mo && dt.getUTCDate() === d;
}

const emptyToUndefined = (v: unknown): unknown => {
  if (v === null) return Number.NaN;
  return typeof v === "string" && v.trim() === "" ? undefined : v;
};

const emptyToNaN = (v: unknown): unknown => {
  if (v === null) return Number.NaN;
  return typeof v === "string" && v.trim() === "" ? Number.NaN : v;
};

export const AddMedicineBody = zod.object({
  name: zod.string().trim().min(2).max(100),
  quantity: zod.preprocess(
    emptyToUndefined,
    zod.coerce.number().finite().int().min(0).max(2147483647)
  ),
  price: zod.preprocess(
    emptyToUndefined,
    zod.coerce.number().finite().min(0).max(99999999.99).multipleOf(0.01)
  ),
  expiryDate: zod
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD")
    .refine(isValidCalendarDate, "Invalid calendar date"),
  description: zod.string().max(500).optional(),
  isAvailable: zod.boolean().optional(),
});

export const UpdateMedicineParams = zod.object({
  medicineId: zod.coerce.number(),
});

export const UpdateMedicineBody = zod
  .object({
    name: zod.string().trim().min(2).max(100).optional(),
    quantity: zod.preprocess(emptyToNaN, zod.coerce.number().finite().int().min(0).max(2147483647)).optional(),
    price: zod.preprocess(emptyToNaN, zod.coerce.number().finite().min(0).max(99999999.99).multipleOf(0.01)).optional(),
    expiryDate: zod
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD")
      .refine(isValidCalendarDate, "Invalid calendar date")
      .optional(),
    description: zod.string().max(500).optional(),
    isAvailable: zod.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field required",
  });

export const DeleteMedicineParams = zod.object({
  medicineId: zod.coerce.number(),
});

export const SendRequestBody = zod.object({
  medicineId: zod.number().int().positive(),
  requestedQuantity: zod.number().int().min(1),
});

export const AcceptRequestParams = zod.object({
  requestId: zod.coerce.number(),
});

export const RejectRequestParams = zod.object({
  requestId: zod.coerce.number(),
});

export const RequestIdParams = zod.object({
  requestId: zod.coerce.number(),
});

export const ProcessPaymentBody = zod.object({
  planId: zod.string(),
  cardNumber: zod.string().optional(),
  cardHolder: zod.string().optional(),
  expiryMonth: zod.string().optional(),
  expiryYear: zod.string().optional(),
  cvv: zod.string().optional(),
});

export const GetNotificationsQueryParams = zod.object({
  unread_only: zod.coerce.boolean().optional(),
  limit: zod.coerce.number().int().min(1).max(100).optional(),
});

export const MarkNotificationReadParams = zod.object({
  notificationId: zod.coerce.number(),
});

export const AiChatBody = zod.object({
  message: zod.string(),
});
