"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { requestEmailChange } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  newEmail: z
    .string()
    .trim()
    .min(1, "Enter the new email address")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

export function ChangeEmailForm() {
  const { user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { newEmail: "", password: "" },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    setSentTo(null);

    try {
      await requestEmailChange(values);
      reset();
      setSentTo(values.newEmail);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "INVALID_PASSWORD") {
          setError("password", { message: error.message });
          return;
        }

        if (error.code === "EMAIL_UNCHANGED") {
          setError("newEmail", { message: error.message });
          return;
        }

        if (error.code === "EMAIL_IN_USE") {
          setError("newEmail", { message: error.message });
          return;
        }

        const fieldError = error.details?.find(
          (detail) => detail.field === "newEmail",
        );

        if (fieldError) {
          setError("newEmail", { message: fieldError.issue });
          return;
        }

        setFormError(error.message);
        return;
      }

      setFormError(
        "Something went wrong. Check your connection and try again.",
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
    >
      {formError ? (
        <Alert tone="danger" title="Could not start the email change">
          {formError}
        </Alert>
      ) : null}

      {sentTo ? (
        <Alert tone="success" title="Check your new inbox">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it
          within an hour to finish the change. Until then, keep signing in with{" "}
          {user?.email ?? "your current address"}.
        </Alert>
      ) : null}

      <TextField
        label="New email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="new@example.com"
        hint="We send the confirmation link to this address, so make sure you can open it."
        error={errors.newEmail?.message}
        {...register("newEmail")}
      />

      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        hint="Confirms it is you, not someone using a borrowed session."
        error={errors.password?.message}
        {...register("password")}
      />

      <div>
        <Button type="submit" loading={isSubmitting}>
          Send confirmation link
        </Button>
      </div>
    </form>
  );
}
