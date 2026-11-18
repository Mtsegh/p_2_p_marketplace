"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { requestPasswordReset } from "@/lib/auth-api";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Always ends in the same confirmation, whether or not the address has an
 * account. "No account found" would turn this page into an account checker.
 */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);

    try {
      await requestPasswordReset(values.email);
      setSentTo(values.email);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Check your connection and try again.",
      );
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="Check your email">
          If an account exists for {sentTo}, we sent a link to reset the
          password. The link works once and expires in an hour.
        </Alert>
        <Link
          href="/login"
          className="text-sm font-medium underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
    >
      {formError ? (
        <Alert tone="danger" title="Could not send the link">
          {formError}
        </Alert>
      ) : null}

      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <Button type="submit" loading={isSubmitting} className="w-full">
        Send reset link
      </Button>

      <p className="text-sm text-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
