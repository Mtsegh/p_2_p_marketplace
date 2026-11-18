"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { updateProfile } from "@/lib/profiles-api";

/**
 * Same limits as the API schema. The server trims and validates again; this
 * copy exists so mistakes are caught before a round trip.
 */
const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a display name")
    .max(60, "Use 60 characters or fewer"),
  bio: z.string().trim().max(500, "Use 500 characters or fewer"),
  location: z.string().trim().max(80, "Use 80 characters or fewer"),
});

type FormValues = z.infer<typeof schema>;
type FieldName = keyof FormValues;

const PROFILE_FIELDS: FieldName[] = ["displayName", "bio", "location"];

export function ProfileForm() {
  const { user, syncUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      displayName: user?.displayName ?? "",
      bio: user?.bio ?? "",
      location: user?.location ?? "",
    },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    setSaved(false);

    try {
      const updated = await updateProfile(values);
      // The endpoint returns the whole user, so the header and every other
      // screen see the new name without another request.
      syncUser(updated);
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError) {
        let handled = false;

        for (const detail of error.details ?? []) {
          if ((PROFILE_FIELDS as string[]).includes(detail.field)) {
            setError(detail.field as FieldName, { message: detail.issue });
            handled = true;
          }
        }

        if (handled) {
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
        <Alert tone="danger" title="Could not save your profile">
          {formError}
        </Alert>
      ) : null}

      {saved ? (
        <Alert tone="success" title="Profile saved">
          Your public profile is up to date.
        </Alert>
      ) : null}

      <TextField
        label="Display name"
        autoComplete="nickname"
        hint="This is the name other members see. Use 60 characters or fewer."
        error={errors.displayName?.message}
        {...register("displayName")}
      />

      <TextArea
        label="About you (optional)"
        hint="Tell members what you trade. Line breaks are kept. Up to 500 characters."
        error={errors.bio?.message}
        {...register("bio")}
      />

      <TextField
        label="Location (optional)"
        autoComplete="address-level2"
        hint="A city or region helps people arrange a handoff. Up to 80 characters."
        error={errors.location?.message}
        {...register("location")}
      />

      <div>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
