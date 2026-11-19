"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import {
  resendPhoneOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  type AuthUser,
} from "@/lib/auth-api";
import { useAuth } from "@/lib/auth";

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9][0-9]{6,14}$/,
    "Enter a valid phone number (E.164, e.g. +14155552671)",
  );

const codeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

type State = "idle" | "sending" | "sent" | "verifying" | "verified";

/**
 * Two-step phone verification: enter the number, get a code by SMS, then enter
 * the code. Only shown while the phone is unverified.
 */
export function PhoneVerificationForm() {
  const { user, syncUser } = useAuth();
  const [state, setState] = useState<State>("idle");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [formError, setFormError] = useState<string | null>(null);

  // Hooks must run unconditionally, so they come before the early return.
  const phoneForm = useForm<{ phone: string }>({
    resolver: zodResolver(z.object({ phone: phoneSchema })),
    mode: "onBlur",
    defaultValues: { phone: "" },
  });

  const codeForm = useForm<{ phone: string; code: string }>({
    resolver: zodResolver(
      z.object({
        phone: phoneSchema,
        code: codeSchema,
      }),
    ),
    mode: "onBlur",
    defaultValues: { phone: "", code: "" },
  });

  if (!user || user.phoneVerified) {
    return null;
  }

  async function handleSendPhone(values: { phone: string }): Promise<void> {
    setFormError(null);

    try {
      setState("sending");
      await sendPhoneOtp(values);
      codeForm.setValue("phone", values.phone);
      setStep("code");
      setState("sent");
    } catch (caught) {
      setState("idle");
      setFormError(
        caught instanceof ApiError
          ? caught.message
          : "Could not send the code. Check your connection and try again.",
      );
    }
  }

  async function handleVerifyCode(values: {
    phone: string;
    code: string;
  }): Promise<void> {
    setFormError(null);

    try {
      setState("verifying");
      await verifyPhoneOtp(values);
      syncUser({ ...user, phoneVerified: true } as AuthUser);
      setState("verified");
    } catch (caught) {
      setState("sent");
      setFormError(
        caught instanceof ApiError
          ? caught.message
          : "Could not verify the code. Check your connection and try again.",
      );
    }
  }

  async function handleResend(): Promise<void> {
    setState("sending");
    setFormError(null);

    try {
      await resendPhoneOtp({ phone: codeForm.getValues().phone });
      setState("sent");
    } catch (caught) {
      setState("idle");
      setFormError(
        caught instanceof ApiError
          ? caught.message
          : "Could not resend the code. Check your connection and try again.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {formError ? (
        <Alert tone="danger" title="Could not verify your phone">
          {formError}
        </Alert>
      ) : null}

      {state === "verified" ? (
        <Alert tone="success" title="Phone verified">
          Your phone number is confirmed. The verified badge shows on your
          public profile.
        </Alert>
      ) : null}

      {step === "phone" ? (
        <form
          noValidate
          onSubmit={phoneForm.handleSubmit(handleSendPhone)}
          className="flex flex-col gap-5"
        >
          <TextField
            label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+14155552671"
            hint="E.164 format, starting with +. We send a 6-digit code to this number."
            error={phoneForm.formState.errors.phone?.message}
            {...phoneForm.register("phone")}
          />
          <div>
            <Button
              type="submit"
              loading={state === "sending"}
              disabled={state === "sending"}
            >
              Send verification code
            </Button>
          </div>
        </form>
      ) : (
        <form
          noValidate
          onSubmit={codeForm.handleSubmit(handleVerifyCode)}
          className="flex flex-col gap-5"
        >
          <TextField
            label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+14155552671"
            hint="The number the code was sent to."
            error={codeForm.formState.errors.phone?.message}
            {...codeForm.register("phone")}
            disabled
          />
          <TextField
            label="Verification code"
            type="tel"
            inputMode="tel"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            hint="The 6-digit code from the SMS. It works for 10 minutes."
            error={codeForm.formState.errors.code?.message}
            {...codeForm.register("code")}
          />
          {state === "sent" ? (
            <p className="mt-2" role="status">
              Code sent. Check your messages and enter it here.
            </p>
          ) : null}
          {state === "verifying" ? (
            <p className="mt-2" role="status">Verifying...</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              loading={state === "verifying"}
              disabled={state === "verifying"}
            >
              Verify code
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleResend}
              loading={state === "sending"}
              disabled={state === "sending"}
            >
              Resend code
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
