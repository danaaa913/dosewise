import "express-session";

declare module "express-session" {
  interface SessionData {
    pharmacyId?: number;
    adminId?: number;
    isAdmin?: boolean;
  }
}
