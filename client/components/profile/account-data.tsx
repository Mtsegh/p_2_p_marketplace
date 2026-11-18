"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { deleteAccount, exportAccountData } from "@/lib/auth-api";

const schema = z.object({
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

function downloadExport(data: Awaited<ReturnType<typeof exportAccountData>>) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `marketplace-account-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AccountData({ onDeleted }: { onDeleted: () => void }) {
  const { clearSession } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { password: "" },
  });

  async function handleExport(): Promise<void> {
    setExporting(true);
    setExported(false);
    setExportError(null);

    try {
      downloadExport(await exportAccountData());
      setExported(true);
    } catch (error) {
      setExportError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Check your connection and try again.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(values: FormValues): Promise<void> {
    setDeleteError(null);

    try {
      await deleteAccount(values.password);
      // The API revoked every session. Clearing the cache now flips the whole
      // app to signed out before the deleted notice is shown.
      clearSession();
      onDeleted();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "INVALID_PASSWORD") {
          setError("password", { message: error.message });
          return;
        }

        setDeleteError(error.message);
        return;
      }

      setDeleteError(
        "Something went wrong. Check your connection and try again.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-medium">Download your data</h3>
        <p className="mt-1 text-sm text-muted">
          A JSON file with your account details, profile text, and sign-in
          history. Passwords and sign-in tokens are never included.
        </p>

        {exportError ? (
          <Alert
            tone="danger"
            title="Could not prepare the export"
            className="mt-3"
          >
            {exportError}
          </Alert>
        ) : null}

        {exported ? (
          <Alert tone="success" title="Export downloaded" className="mt-3">
            The file was saved by your browser.
          </Alert>
        ) : null}

        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={handleExport}
            loading={exporting}
          >
            Download my data
          </Button>
        </div>
      </div>

      <div className="border-t border-line pt-6">
        <h3 className="font-medium">Delete your account</h3>
        <p className="mt-1 text-sm text-muted">
          This signs you out everywhere and removes your name, bio, location,
          email address, and phone number. Your account cannot be restored.
        </p>

        {!confirmingDelete ? (
          <div className="mt-3">
            <Button
              variant="danger"
              onClick={() => {
                setConfirmingDelete(true);
                setDeleteError(null);
              }}
            >
              Delete account
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit(handleDelete)}
            className="mt-4 flex flex-col gap-4 rounded-md border border-danger/30 bg-danger/5 p-4"
          >
            {deleteError ? (
              <Alert tone="danger" title="Could not delete the account">
                {deleteError}
              </Alert>
            ) : null}

            <p className="text-sm text-foreground">
              Enter your password to confirm. This is the last step.
            </p>

            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="danger" loading={isSubmitting}>
                Delete my account
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteError(null);
                }}
              >
                Keep my account
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
