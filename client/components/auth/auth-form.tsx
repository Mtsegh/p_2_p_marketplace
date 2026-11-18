"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email")
  .email("Enter a valid email address");

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
});

const registerSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200, "Password is too long"),
});

type FormValues = z.infer<typeof loginSchema>;

const copy = {
  login: {
    submit: "Sign in",
    footer: "New here?",
    footerLink: "/register",
    footerLinkLabel: "Create an account",
  },
  register: {
    submit: "Create account",
    footer: "Already have an account?",
    footerLink: "/login",
    footerLinkLabel: "Sign in",
  },
} as const;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { login, register, status, user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(mode === "register" ? registerSchema : loginSchema),
    mode: "onBlur",
  });

  // Already signed in: no reason to show the form.
  useEffect(() => {
    if (status === "ready" && user) {
      router.replace("/profile");
    }
  }, [status, user, router]);

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);

    try {
      if (mode === "register") {
        await register(values);
      } else {
        await login(values);
      }

      router.replace("/profile");
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.details?.filter(
          (detail) => detail.field === "email" || detail.field === "password",
        );

        if (fieldErrors && fieldErrors.length > 0) {
          for (const detail of fieldErrors) {
            setError(detail.field as "email" | "password", {
              message: detail.issue,
            });
          }
          return;
        }

        if (error.code === "EMAIL_IN_USE") {
          setError("email", { message: error.message });
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
        <Alert tone="danger" title="Could not continue">
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
        {...registerField("email")}
      />

      <TextField
        label="Password"
        type="password"
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        hint={mode === "register" ? "At least 10 characters." : undefined}
        error={errors.password?.message}
        {...registerField("password")}
      />

      <Button type="submit" loading={isSubmitting} className="w-full">
        {copy[mode].submit}
      </Button>

      <p className="text-sm text-muted">
        {copy[mode].footer}{" "}
        <Link
          href={copy[mode].footerLink}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {copy[mode].footerLinkLabel}
        </Link>
      </p>
    </form>
  );
}
