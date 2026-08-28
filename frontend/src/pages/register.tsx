import { useState, type ChangeEvent, type FocusEvent, type FormEvent } from "react";
import { useLocation, Link } from "wouter";
import { Check, Eye, EyeOff, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const PHONE_REGEX = /^(\+962|00962|0)?7[789]\d{7}$/;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const CITY_AR = {
  amman: "عمّان",
  irbid: "إربد",
  zarqa: "الزرقاء",
  mafraq: "المفرق",
  aqaba: "العقبة",
  salt: "السلط",
  karak: "الكرك",
  madaba: "مادبا",
  jerash: "جرش",
  ajloun: "عجلون",
  tafilah: "الطفيلة",
  maan: "معان",
} as const;

type CityKey = keyof typeof CITY_AR;
const CITY_KEYS = Object.keys(CITY_AR) as CityKey[];

interface FormState {
  name: string;
  city: CityKey;
  address: string;
  managerName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

type FieldKey = Exclude<keyof FormState, "city">;

const STEP_FIELDS: FieldKey[][] = [
  ["name", "address"],
  ["managerName", "email", "phone", "password", "confirmPassword"],
  [],
];

const AUTOCOMPLETE: Partial<Record<FieldKey, string>> = {
  name: "organization",
  managerName: "name",
  email: "email",
  phone: "tel",
  password: "new-password",
  confirmPassword: "new-password",
};

const MAX_LENGTHS: Partial<Record<FieldKey, number>> = {
  name: 120,
  managerName: 120,
  email: 200,
  phone: 16,
  address: 300,
  password: 128,
  confirmPassword: 128,
};

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    name: "",
    city: "amman",
    address: "",
    managerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [showPw, setShowPw] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseFile, setLicenseFile] = useState<{ name: string; mime: string; data: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const r = t.register;
  const e = r.errors;

  function validate(key: FieldKey, value: string): string | null {
    if (!value.trim()) return e.required;
    switch (key) {
      case "name":
        if (value.trim().length < 2) return e.nameMin;
        if (value.length > 120) return e.nameMax;
        return null;
      case "managerName":
        if (value.trim().length < 2) return e.managerMin;
        if (value.length > 120) return e.managerMax;
        return null;
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : e.emailInvalid;
      case "phone":
        return PHONE_REGEX.test(value.replace(/[\s-]/g, "")) ? null : e.phoneInvalid;
      case "address":
        if (value.trim().length < 5) return e.addressMin;
        if (value.length > 300) return e.addressMax;
        return null;
      case "password":
        if (value.length < 12) return e.passwordMin;
        if (value.length > 128) return e.passwordMax;
        return null;
      case "confirmPassword":
        return value === form.password ? null : e.passwordMismatch;
    }
  }

  const fieldError = (key: FieldKey): string | null =>
    touched[key] ? validate(key, form[key]) : null;

  const passwordsMatchLive =
    form.confirmPassword.length > 0 && form.confirmPassword === form.password;

  const handleFieldBlur = (key: FieldKey) => (_e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  const handleFieldChange = (key: FieldKey) => (ev: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: ev.target.value }));
    setServerError(null);
  };

  const handleLicenseFile = (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    if (file.size > MAX_FILE_BYTES) {
      setLicenseFile(null);
      setFileError(e.fileSizeExceeded);
      return;
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      setLicenseFile(null);
      setFileError(e.fileTypeUnsupported);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(",")[1] ?? "";
      setLicenseFile({ name: file.name, mime: file.type, data });
    };
    reader.readAsDataURL(file);
  };

  function goToStep(next: number) {
    if (next > step) {
      const fields = STEP_FIELDS[step - 1];
      const allTouched = { ...touched };
      let hasError = false;
      for (const key of fields) {
        allTouched[key] = true;
        if (validate(key, form[key])) hasError = true;
      }
      setTouched(allTouched);
      if (hasError) return;
    }
    setStep(next);
    setServerError(null);
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();

    if (step < 3) {
      goToStep(step + 1);
      return;
    }

    setServerError(null);

    const allFields: FieldKey[] = [...STEP_FIELDS[0], ...STEP_FIELDS[1]];
    const allTouched: Partial<Record<FieldKey, boolean>> = {};
    let firstBadStep: number | null = null;
    for (let i = 0; i < STEP_FIELDS.length; i++) {
      for (const key of STEP_FIELDS[i]) {
        allTouched[key] = true;
        if (!firstBadStep && validate(key, form[key])) firstBadStep = i + 1;
      }
    }
    if (firstBadStep) {
      setTouched(allTouched);
      setStep(firstBadStep);
      return;
    }

    setLoading(true);
    try {
      await api.auth.register({
        name: form.name.trim(),
        managerName: form.managerName.trim(),
        email: form.email.trim(),
        phone: form.phone.replace(/[\s-]/g, ""),
        city: CITY_AR[form.city],
        address: form.address.trim(),
        password: form.password,
        ...(licenseNumber.trim() ? { licenseNumber: licenseNumber.trim() } : {}),
        ...(licenseFile ? { licenseDoc: licenseFile } : {}),
      });
      await refresh();
      navigate("/account-status");
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (/already registered/i.test(msg)) setServerError(e.emailTaken);
      else if (msg.trim().startsWith("[")) setServerError(e.reviewFields);
      else setServerError(e.generic);
    } finally {
      setLoading(false);
    }
  }

  const stepMeta = [
    { n: 1, label: r.steps.pharmacy },
    { n: 2, label: r.steps.manager },
    { n: 3, label: r.steps.license },
  ];

  const renderTextField = (key: FieldKey, label: string, opts?: {
    type?: string;
    placeholder?: string;
    hint?: string;
    ltr?: boolean;
    multiline?: boolean;
  }) => {
    const id = `reg-${key}`;
    const err = fieldError(key);
    const invalid = Boolean(err);
    const describedBy = [err ? `${id}-err` : null, opts?.hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ");
    const sharedProps = {
      id,
      name: key,
      maxLength: MAX_LENGTHS[key],
      autoComplete: AUTOCOMPLETE[key],
      required: STEP_FIELDS.flat().includes(key),
      placeholder: opts?.placeholder,
      dir: opts?.ltr ? ("ltr" as const) : undefined,
      "aria-invalid": invalid || undefined,
      "aria-describedby": describedBy || undefined,
      value: form[key],
      onChange: handleFieldChange(key),
      onBlur: handleFieldBlur(key),
    };
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
          {opts?.multiline ? (
            <textarea
              {...sharedProps}
              rows={3}
              className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          ) : (
            <Input
              {...sharedProps}
              type={opts?.type ?? "text"}
              inputMode={key === "phone" ? "tel" : undefined}
              className={cn(opts?.type === "password" && "pe-10")}
            />
          )}
          {opts?.type === "password" && (
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              tabIndex={-1}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? r.hidePassword : r.showPassword}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        </div>
        {opts?.hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {opts.hint}
          </p>
        )}
        {key === "password" && (
          <p
            aria-live="polite"
            className={cn(
              "text-xs font-medium",
              form.password.length >= 12 ? "text-[#2a5f66]" : "text-slate-500"
            )}
          >
            {form.password.length} / 12
          </p>
        )}
        {key === "confirmPassword" && form.confirmPassword.length > 0 && (
          <p
            aria-live="polite"
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              passwordsMatchLive ? "text-[#2a5f66]" : "text-red-600"
            )}
          >
            {passwordsMatchLive ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <X className="size-3.5" aria-hidden="true" />
            )}
            {passwordsMatchLive ? r.matchOk : r.matchBad}
          </p>
        )}
        {err && (
          <p id={`${id}-err`} className="text-sm text-red-600">
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10" dir={t.dir}>
      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo size={56} />
          </Link>
          <h1 className="mt-3 text-xl font-bold tracking-tight text-[#1b3a5f]">{r.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{r.subtitle}</p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
          {/* ── Stepper header ── */}
          <ol className="mb-8 flex items-start gap-2" aria-label={r.title}>
            {stepMeta.map((s) => {
              const isDone = s.n < step;
              const isActive = s.n === step;
              return (
                <li
                  key={s.n}
                  aria-current={isActive ? "step" : undefined}
                  className="flex flex-1 flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                      isDone && "border-transparent bg-[#2a5f66] text-white",
                      isActive && "border-[#2a5f66] text-[#2a5f66]",
                      !isDone && !isActive && "border-slate-300 text-slate-400"
                    )}
                  >
                    {isDone ? <Check className="size-4" aria-hidden="true" /> : s.n}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium leading-tight",
                      isActive ? "text-[#1b3a5f]" : "text-slate-500"
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {serverError && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {step === 1 && (
              <div className="space-y-4">
                {renderTextField("name", r.name, { placeholder: r.namePlaceholder })}
                <div className="space-y-1.5">
                  <Label htmlFor="reg-city">{r.city}</Label>
                  <select
                    id="reg-city"
                    name="city"
                    value={form.city}
                    onChange={(ev) => setForm((prev) => ({ ...prev, city: ev.target.value as CityKey }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {CITY_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {r.cities[k]}
                      </option>
                    ))}
                  </select>
                </div>
                {renderTextField("address", r.address, { placeholder: r.addressPlaceholder, multiline: true })}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {renderTextField("managerName", r.managerName, { placeholder: r.managerNamePlaceholder })}
                {renderTextField("email", r.email, { type: "email", ltr: true })}
                {renderTextField("phone", r.phone, {
                  type: "tel",
                  ltr: true,
                  hint: r.phoneHint,
                })}
                {renderTextField("password", r.password, {
                  type: "password",
                  hint: r.passwordHint,
                })}
                {renderTextField("confirmPassword", r.confirmPassword, { type: "password" })}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <Alert className="border-[#3f8b8e]/30 bg-secondary/40 text-slate-700">
                  <AlertDescription>{r.pendingNote}</AlertDescription>
                </Alert>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-license-number">
                    {r.licenseNumber}{" "}
                    <span className="font-normal text-muted-foreground">({r.optional})</span>
                  </Label>
                  <Input
                    id="reg-license-number"
                    name="licenseNumber"
                    type="text"
                    maxLength={50}
                    dir="ltr"
                    placeholder={r.licenseNumberPlaceholder}
                    value={licenseNumber}
                    onChange={(ev) => setLicenseNumber(ev.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-license-file">{r.licenseFile}</Label>
                  <p className="text-xs text-slate-500">{r.fileFormats}</p>
                  <Input
                    id="reg-license-file"
                    name="licenseFile"
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={(ev) => handleLicenseFile(ev.target.files?.[0])}
                    className="file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-[#1b3a5f] hover:file:bg-secondary/70"
                    aria-invalid={Boolean(fileError) || undefined}
                    aria-describedby={fileError ? "reg-license-file-err" : undefined}
                  />
                  {fileError && (
                    <p id="reg-license-file-err" role="alert" className="text-sm text-red-600">
                      {fileError}
                    </p>
                  )}
                  {licenseFile && !fileError && (
                    <p
                      role="status"
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm text-slate-700"
                    >
                      <span className="min-w-0 truncate">
                        <Check className="me-1 inline size-3.5 text-[#2a5f66]" aria-hidden="true" />
                        {r.attached} <span dir="auto">{licenseFile.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setLicenseFile(null)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={r.removeFile}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep(step - 1)}
                  disabled={loading}
                  className="min-h-[44px]"
                >
                  {r.back}
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="min-h-[44px] flex-1 bg-[#2a5f66] text-white hover:bg-[#24504f]"
              >
                {loading ? <Spinner className="size-4" /> : step < 3 ? r.next : r.submit}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {r.haveAccount}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {r.loginLink}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
