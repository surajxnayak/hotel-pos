import React, { useEffect, useMemo, useState } from "react";
import StaffShell from "../components/StaffShell";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  adminSetPin,
} from "../lib/api";
import { toast } from "sonner";
import {
  Lock,
  Loader2,
  KeyRound,
  ShieldCheck,
  Pencil,
  Mail,
  Phone,
  MapPin,
  AtSign,
  BadgeCheck,
  User,
  Check,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

const ROLE_TONE = {
  ADMIN: "bg-brand/10 text-brand border-brand/30",
  WAITER: "bg-blue-50 text-blue-700 border-blue-200",
  KITCHEN: "bg-amber-50 text-amber-800 border-amber-200",
  CASHIER: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function MyAccount() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setMe(await getMyProfile());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <StaffShell title="My Account" testId="my-account" showBack>
      <div className="max-w-4xl mx-auto space-y-6">
        {loading || !me ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="animate-spin text-brand" size={28} />
          </div>
        ) : (
          <>
            <HeroCard me={me} />
            <PersonalInfoCard me={me} onSaved={setMe} />
            <PasswordCard />
            {me.role === "ADMIN" && <AdminPinCard />}
          </>
        )}
      </div>
    </StaffShell>
  );
}

// ==================================================================
// Hero card
// ==================================================================
function HeroCard({ me }) {
  const initials = useMemo(() => {
    return (me.name || me.username || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }, [me.name, me.username]);

  const tone = ROLE_TONE[me.role] || "bg-bg2 text-ink2 border-bg2";

  const chips = [
    me.email && { Icon: Mail, value: me.email },
    me.contactNumber && { Icon: Phone, value: me.contactNumber },
    me.address && { Icon: MapPin, value: me.address },
  ].filter(Boolean);

  return (
    <div
      data-testid="account-hero"
      className="relative overflow-hidden rounded-3xl border border-bg2 bg-gradient-to-br from-surface via-surface to-brand/5 p-6 shadow-soft animate-fadeUp"
    >
      {/* Decorative corner accent */}
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-brand/8 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="h-20 w-20 shrink-0 rounded-3xl bg-gradient-to-br from-brand to-brandHover text-white grid place-items-center font-heading text-3xl font-bold shadow-lift">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading text-3xl font-semibold tracking-tight truncate">
            {me.name}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border ${tone}`}
            >
              <BadgeCheck size={11} />
              {me.role}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-ink2 font-mono">
              <AtSign size={11} />
              {me.username}
            </span>
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="relative mt-5 flex flex-wrap gap-2">
          {chips.map(({ Icon, value }, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-bg2 bg-bg/70 px-3 py-1 text-xs text-ink2"
            >
              <Icon size={12} className="text-brand shrink-0" />
              <span className="truncate max-w-[200px]">{value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================================================================
// Personal info — inline-editable field rows
// ==================================================================
function PersonalInfoCard({ me, onSaved }) {
  const fields = [
    { key: "name", label: "Full name", Icon: User, required: true },
    { key: "username", label: "Username", Icon: AtSign, required: true, prefix: "@" },
    { key: "email", label: "Email", Icon: Mail, type: "email" },
    { key: "contactNumber", label: "Contact number", Icon: Phone },
    { key: "address", label: "Address", Icon: MapPin, multiline: true },
  ];

  return (
    <section
      data-testid="account-personal-info"
      className="rounded-3xl border border-bg2 bg-surface shadow-soft animate-fadeUp"
    >
      <header className="flex items-center gap-2 px-6 py-4 border-b border-bg2">
        <div className="h-8 w-8 rounded-xl bg-brand/10 text-brand grid place-items-center">
          <User size={15} />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold">Personal info</h2>
          <p className="text-xs text-ink2">
            Tap the pencil to edit any field individually.
          </p>
        </div>
      </header>
      <div className="divide-y divide-bg2">
        {fields.map((f) => (
          <FieldRow key={f.key} field={f} me={me} onSaved={onSaved} />
        ))}
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="h-9 w-9 rounded-xl bg-bg text-ink2 grid place-items-center border border-bg2 shrink-0">
            <BadgeCheck size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
              Role
            </div>
            <div className="text-sm font-medium text-ink">{me.role}</div>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-ink2 italic">
            Set by admin
          </span>
        </div>
      </div>
    </section>
  );
}

function FieldRow({ field, me, onSaved }) {
  const { key, label, Icon, required, type, prefix, multiline } = field;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(me[key] || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setValue(me[key] || "");
  }, [me, key]);

  const cancel = () => {
    setValue(me[key] || "");
    setErr("");
    setEditing(false);
  };

  const save = async () => {
    setErr("");
    const trimmed = value.trim();
    if (required && !trimmed) return setErr(`${label} can't be empty.`);
    if (trimmed === (me[key] || "")) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const updated = await updateMyProfile({ [key]: trimmed });
      onSaved(updated);
      // Keep header/localStorage in sync when name changes.
      if (key === "name") {
        const info = JSON.parse(localStorage.getItem("staff_info") || "null");
        if (info) {
          localStorage.setItem(
            "staff_info",
            JSON.stringify({ ...info, name: updated.name })
          );
        }
      }
      toast.success(`${label} updated`);
      setEditing(false);
    } catch (e) {
      if (e.status === 409) setErr(e.message || "That value is already taken.");
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const displayValue = me[key];

  return (
    <div className="flex items-start gap-3 px-6 py-4">
      <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0 mt-0.5">
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </div>
        {!editing ? (
          <div
            className={`mt-0.5 text-sm ${
              displayValue ? "text-ink" : "text-ink2 italic"
            } break-words`}
            data-testid={`field-${key}-value`}
          >
            {displayValue ? `${prefix || ""}${displayValue}` : "Not set"}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              {prefix && (
                <span className="text-ink2 font-mono text-sm">{prefix}</span>
              )}
              {multiline ? (
                <textarea
                  autoFocus
                  rows={2}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  data-testid={`field-${key}-input`}
                  className="flex-1 bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand resize-none"
                />
              ) : (
                <input
                  autoFocus
                  type={type || "text"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  data-testid={`field-${key}-input`}
                  className="flex-1 bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              )}
            </div>
            {err && (
              <div className="text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {err}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 mt-0.5">
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            data-testid={`field-${key}-edit`}
            title={`Edit ${label}`}
            className="h-8 w-8 grid place-items-center rounded-full text-ink2 hover:text-brand hover:bg-brand/10 transition"
          >
            <Pencil size={13} />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={cancel}
              disabled={busy}
              data-testid={`field-${key}-cancel`}
              title="Cancel"
              className="h-8 w-8 grid place-items-center rounded-full text-ink2 hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-40"
            >
              <X size={14} />
            </button>
            <button
              onClick={save}
              disabled={busy}
              data-testid={`field-${key}-save`}
              title="Save"
              className="h-8 w-8 grid place-items-center rounded-full bg-brand text-white hover:bg-brandHover transition disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// Password
// ==================================================================
function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (next.length < 6) return setErr("New password must be at least 6 characters.");
    if (next !== confirm) return setErr("New passwords do not match.");
    setBusy(true);
    try {
      await changeMyPassword({ currentPassword: current, newPassword: next });
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e2) {
      if (e2.status === 401) setErr("Incorrect current password.");
      else setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-testid="account-password"
      className="rounded-3xl border border-bg2 bg-surface shadow-soft p-6 animate-fadeUp"
    >
      <header className="flex items-center gap-2 mb-1">
        <div className="h-8 w-8 rounded-xl bg-ink/10 text-ink grid place-items-center">
          <Lock size={14} />
        </div>
        <h2 className="font-heading text-lg font-semibold">Change password</h2>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="ml-auto text-xs text-ink2 hover:text-brand inline-flex items-center gap-1"
          data-testid="pwd-toggle-visibility"
        >
          {show ? <EyeOff size={12} /> : <Eye size={12} />}
          {show ? "Hide" : "Show"}
        </button>
      </header>
      <p className="text-xs text-ink2 mb-4">
        Only you can change your password — even admins can&apos;t reset it for you.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SecretField
          label="Current password"
          value={current}
          onChange={setCurrent}
          show={show}
          testId="pwd-current"
        />
        <SecretField
          label="New password"
          value={next}
          onChange={setNext}
          show={show}
          testId="pwd-new"
          hint="Minimum 6 characters"
        />
        <SecretField
          label="Confirm new"
          value={confirm}
          onChange={setConfirm}
          show={show}
          testId="pwd-confirm"
        />
      </div>
      {err && (
        <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          {err}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !current || !next || !confirm}
        data-testid="pwd-save"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink hover:bg-black text-white font-medium px-5 py-2.5 shadow-lift transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />}
        Update password
      </button>
    </form>
  );
}

// ==================================================================
// Admin PIN
// ==================================================================
function AdminPinCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!currentPassword) return setErr("Enter your current password.");
    if (!/^\d{4,6}$/.test(newPin)) return setErr("PIN must be 4–6 digits.");
    if (newPin !== confirm) return setErr("PINs do not match.");
    setBusy(true);
    try {
      await adminSetPin(currentPassword, newPin);
      toast.success("Admin PIN updated");
      setCurrentPassword("");
      setNewPin("");
      setConfirm("");
    } catch (e2) {
      if (e2.status === 401) setErr("Incorrect password.");
      else setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-testid="account-admin-pin"
      className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/5 via-surface to-surface shadow-soft p-6 animate-fadeUp"
    >
      <header className="flex items-center gap-2 mb-1">
        <div className="h-8 w-8 rounded-xl bg-brand/15 text-brand grid place-items-center">
          <ShieldCheck size={14} />
        </div>
        <h2 className="font-heading text-lg font-semibold">Admin security PIN</h2>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="ml-auto text-xs text-ink2 hover:text-brand inline-flex items-center gap-1"
          data-testid="pin-toggle-visibility"
        >
          {show ? <EyeOff size={12} /> : <Eye size={12} />}
          {show ? "Hide" : "Show"}
        </button>
      </header>
      <p className="text-xs text-ink2 mb-4">
        Re-verified on every destructive action (force-freeing a table, revealing customer
        phone numbers, bulk changes). Never cached.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SecretField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          show={show}
          testId="pin-currentpwd"
        />
        <SecretField
          label="New PIN (4–6 digits)"
          value={newPin}
          onChange={(v) => setNewPin(v.replace(/\D/g, "").slice(0, 6))}
          show={show}
          testId="pin-new"
          inputMode="numeric"
          hint="Digits only"
        />
        <SecretField
          label="Confirm new PIN"
          value={confirm}
          onChange={(v) => setConfirm(v.replace(/\D/g, "").slice(0, 6))}
          show={show}
          testId="pin-confirm"
          inputMode="numeric"
        />
      </div>
      {err && (
        <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          {err}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !currentPassword || !newPin || !confirm}
        data-testid="pin-save"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand hover:bg-brandHover text-white font-medium px-5 py-2.5 shadow-lift transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
        Update PIN
      </button>
    </form>
  );
}

function SecretField({ label, value, onChange, show, testId, hint, inputMode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
        {label}
      </span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        data-testid={testId}
        className="mt-1 w-full bg-bg border border-bg2 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand text-sm font-mono tracking-wider"
      />
      {hint && <span className="text-[10px] text-ink2 italic mt-0.5 block">{hint}</span>}
    </label>
  );
}
