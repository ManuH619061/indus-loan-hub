import { useState } from "react";
import axios from "axios";
import { Modal } from "@/components/common/Modal";
import { createClient, updateClient } from "@/api/clients";
import type { Client, ClientPayload } from "@/types/client";

interface ClientFormModalProps {
  client: Client | null;
  onClose: () => void;
  onSaved: (client: Client) => void;
}

interface FormState {
  company_name: string;
  gstin: string;
  pan: string;
  financial_year: string;
  address: string;
  contact_person: string;
}

function toFormState(client: Client | null): FormState {
  return {
    company_name: client?.company_name ?? "",
    gstin: client?.gstin ?? "",
    pan: client?.pan ?? "",
    financial_year: client?.financial_year ?? "",
    address: client?.address ?? "",
    contact_person: client?.contact_person ?? "",
  };
}

function extractFieldErrors(error: unknown): Record<string, string> {
  if (axios.isAxiosError(error) && Array.isArray(error.response?.data?.detail)) {
    const errors: Record<string, string> = {};
    for (const item of error.response.data.detail) {
      const field = item.loc?.[item.loc.length - 1];
      if (typeof field === "string") errors[field] = item.msg;
    }
    return errors;
  }
  return {};
}

export function ClientFormModal({ client, onClose, onSaved }: ClientFormModalProps) {
  const [form, setForm] = useState<FormState>(toFormState(client));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = client !== null;

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setSubmitError(null);

    const payload: ClientPayload = {
      company_name: form.company_name.trim(),
      gstin: form.gstin.trim() || null,
      pan: form.pan.trim() || null,
      financial_year: form.financial_year.trim() || null,
      address: form.address.trim() || null,
      contact_person: form.contact_person.trim() || null,
    };

    try {
      const saved = isEditing ? await updateClient(client.id, payload) : await createClient(payload);
      onSaved(saved as Client);
    } catch (error) {
      const errors = extractFieldErrors(error);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
      } else {
        setSubmitError("Could not save this client. Please check your details and try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEditing ? "Edit Client" : "Create New Client"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Company Name" required error={fieldErrors.company_name}>
          <input
            type="text"
            required
            value={form.company_name}
            onChange={handleChange("company_name")}
            placeholder="e.g. Sunrise Textiles Pvt Ltd"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="GSTIN" error={fieldErrors.gstin}>
            <input
              type="text"
              value={form.gstin}
              onChange={handleChange("gstin")}
              placeholder="27ABCDE1234F1Z5"
              className={`${inputClass} uppercase`}
              maxLength={15}
            />
          </Field>
          <Field label="PAN" error={fieldErrors.pan}>
            <input
              type="text"
              value={form.pan}
              onChange={handleChange("pan")}
              placeholder="ABCDE1234F"
              className={`${inputClass} uppercase`}
              maxLength={10}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Financial Year" error={fieldErrors.financial_year}>
            <input
              type="text"
              value={form.financial_year}
              onChange={handleChange("financial_year")}
              placeholder="2026-27"
              className={inputClass}
            />
          </Field>
          <Field label="Contact Person" error={fieldErrors.contact_person}>
            <input
              type="text"
              value={form.contact_person}
              onChange={handleChange("contact_person")}
              placeholder="e.g. Rahul Sharma"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Address" error={fieldErrors.address}>
          <textarea
            value={form.address}
            onChange={handleChange("address")}
            rows={2}
            placeholder="Registered office address"
            className={inputClass}
          />
        </Field>

        {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Client"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}
