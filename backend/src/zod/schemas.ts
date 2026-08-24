import * as zod from "zod";

export const HealthCheckResponse = zod.object({ status: zod.string() });

export const RegisterPharmacyBody = zod.object({
  name: zod.string(),
  managerName: zod.string(),
  email: zod.string(),
  phone: zod.string(),
  city: zod.string(),
  address: zod.string(),
  password: zod.string(),
});

export const LoginPharmacyBody = zod.object({
  email: zod.string(),
  password: zod.string(),
});

export const AdminLoginBody = zod.object({
  email: zod.string().email(),
  password: zod.string(),
});

export const AddMedicineBody = zod.object({
  name: zod.string(),
  quantity: zod.number(),
  price: zod.number(),
  expiryDate: zod.string(),
  description: zod.string().optional(),
  isAvailable: zod.boolean().optional(),
});

export const UpdateMedicineParams = zod.object({
  medicineId: zod.coerce.number(),
});

export const UpdateMedicineBody = zod.object({
  name: zod.string().optional(),
  quantity: zod.number().optional(),
  price: zod.number().optional(),
  expiryDate: zod.string().optional(),
  description: zod.string().optional(),
  isAvailable: zod.boolean().optional(),
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
});

export const MarkNotificationReadParams = zod.object({
  notificationId: zod.coerce.number(),
});

export const AiChatBody = zod.object({
  message: zod.string(),
});
