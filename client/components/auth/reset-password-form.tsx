"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { resetPassword } from "@/lib/auth-api";

const schema = z.object({
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200, "Password is too long"),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token?: string }) {
  const { clearSession } = useAuth();
  const [completed, setCompleted] = useState(false);
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
    if (!token) {
      return;
    }

    setFormError(null);

    try {
      await resetPassword(token, values.password);
      // The API revoked every session, so the cached user is stale. Clearing
      // it now turns the header's "Sign out" into "Sign in" immediately.
      clearSession();
      setCompleted(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Check your connection and try again.",
      );
    }
  }

  if (!token) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <Alert tone="danger" title="That link did not work">
          This link is missing its token. Open the link from your email again,
          or request a new one.
        </Alert>
        <ButtonLink href="/forgot-password">Request a new link</ButtonLink>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <Alert tone="success" title="Password updated">
          Every device was signed out, including any session someone else may
          have had. Sign in with your new password.
        </Alert>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-md flex-col gap-5"
    >
      {formError ? (
        <Alert tone="danger" title="Could not reset the password">
          {formError}
        </Alert>
      ) : null}

      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        error={errors.password?.message}
        {...register("password")}
      />

      <Button type="submit" loading={isSubmitting} className="w-full">
        Set new password
      </Button>

      <p className="text-sm text-muted">
        Changed your mind?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
