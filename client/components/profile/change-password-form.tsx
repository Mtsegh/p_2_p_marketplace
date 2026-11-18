"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { changePassword } from "@/lib/auth-api";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(200, "Password is too long"),
    confirmPassword: z.string().min(1, "Repeat the new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    setSaved(false);

    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "INVALID_PASSWORD") {
          setError("currentPassword", { message: error.message });
          return;
        }

        const passwordError = error.details?.find(
          (detail) => detail.field === "newPassword",
        );

        if (passwordError) {
          setError("newPassword", { message: passwordError.issue });
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
        <Alert tone="danger" title="Could not change the password">
          {formError}
        </Alert>
      ) : null}

      {saved ? (
        <Alert tone="success" title="Password changed">
          Any other device signed in to your account was signed out. This device
          stays signed in.
        </Alert>
      ) : null}

      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />

      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />

      <TextField
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <div>
        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}
