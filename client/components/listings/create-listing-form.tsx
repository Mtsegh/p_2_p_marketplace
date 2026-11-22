"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { createListing, fetchListing } from "@/lib/listings-api";
import { ImageUpload } from "./image-upload";
import { ImageGallery } from "./image-gallery";

const conditionOptions = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
];

const listingTypeOptions = [
  { value: "SALE", label: "Sell for money" },
  { value: "EXCHANGE", label: "Exchange only" },
  { value: "BOTH", label: "Sell or exchange" },
];

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title")
    .max(200, "Use 200 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(1, "Enter a description")
    .max(2000, "Use 2000 characters or fewer"),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"]),
  priceCents: z
    .number()
    .int()
    .min(0, "Price must be zero or more")
    .optional(),
  listingType: z.enum(["SALE", "EXCHANGE", "BOTH"]),
  categoryId: z.string().uuid("Select a valid category").optional(),
  location: z
    .string()
    .trim()
    .min(1, "Enter a location")
    .max(200, "Use 200 characters or fewer"),
});

type FormValues = z.infer<typeof schema>;

type ListingImage = {
  id: string;
  url: string;
  key: string;
};

export function CreateListingForm({
  categories,
}: {
  categories: { id: string; name: string; slug: string }[];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [listing, setListing] = useState<{ id: string } | null>(null);
  const [images, setImages] = useState<ListingImage[]>([]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      condition: "GOOD",
      priceCents: undefined,
      listingType: "BOTH",
      categoryId: undefined,
      location: "",
    },
  });

  async function handleCreateSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);

    try {
      const input = {
        title: values.title,
        description: values.description,
        condition: values.condition,
        priceCents: values.priceCents ?? null,
        listingType: values.listingType,
        categoryId: values.categoryId ?? undefined,
        location: values.location,
      };

      const created = await createListing(input);
      setListing({ id: created.id });
      setImages([]);
      reset();
    } catch (caught) {
      setSubmitting(false);

      if (caught instanceof ApiError) {
        if (caught.code === "PRICE_REQUIRED") {
          setError("priceCents", {
            message: "A price is required when the listing can be sold",
          });
          return;
        }

        const fieldError = caught.details?.find(
          (detail) => detail.field === "priceCents",
        );

        if (fieldError) {
          setError("priceCents", { message: fieldError.issue });
          return;
        }

        setFormError(caught.message);
        return;
      }

      setFormError(
        "Something went wrong. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleImageAdded(image: { id: string; url: string }) {
    setImages((prev) => [
      ...prev,
      { id: image.id, url: image.url, key: "" },
    ]);
  }

  function handleImageDeleted() {
    // Refresh images from the API after a deletion so the gallery stays in sync.
    if (listing) {
      fetchListing(listing.id)
        .then((updated) => {
          setImages(
            updated.images.map((image) => ({
              id: image.id,
              url: image.url,
              key: image.key,
            })),
          );
        })
        .catch(() => {
          // Best effort: the gallery still shows the current local state.
        });
    }
  }

  if (listing) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success" title="Draft listing created">
          Your listing has been created as a draft. Add photos, then publish
          when you&apos;re ready.
        </Alert>

        <section className="rounded-lg border border-line bg-surface p-6">
          <h3 className="text-lg font-semibold">Listing photos</h3>
          <p className="mt-1 text-sm text-muted">
            Add up to 10 photos. Buyers are more likely to respond to listings
            with clear images.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <ImageUpload
              listingId={listing.id}
              onImageAdded={handleImageAdded}
            />
            <ImageGallery
              images={images.map((img) => ({ id: img.id, url: img.url, key: img.key, position: 0 }))}
              listingId={listing.id}
              onImageDeleted={handleImageDeleted}
            />
          </div>
        </section>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setListing(null)}>
            Create another listing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(handleCreateSubmit)}
      className="flex flex-col gap-5"
    >
      {formError ? (
        <Alert tone="danger" title="Could not create the listing">{formError}</Alert>
      ) : null}

      <TextField
        label="Title"
        autoComplete="off"
        hint="A short, clear name for what you're offering. Up to 200 characters."
        error={errors.title?.message}
        {...register("title")}
      />

      <TextArea
        label="Description"
        hint="Describe the item's condition, what works, and what doesn't. Up to 2000 characters."
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Condition"
          hint="How worn is the item?"
          error={errors.condition?.message}
          {...register("condition")}
        >
          {conditionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          label="Listing type"
          hint="Sell for money, swap for other items, or both."
          error={errors.listingType?.message}
          {...register("listingType")}
        >
          {listingTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <TextField
        label="Price (cents)"
        type="number"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        hint="Whole cents, e.g. 45000 for $450.00. Required when the listing can be sold."
        error={errors.priceCents?.message}
        {...register("priceCents")}
      />

      <Select
        label="Category (optional)"
        hint="Pick the closest match, or leave unset."
        error={errors.categoryId?.message}
        {...register("categoryId")}
      >
        <option value="">None</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>

      <TextField
        label="Location"
        autoComplete="off"
        hint="A city or region helps buyers arrange a handoff. Up to 200 characters."
        error={errors.location?.message}
        {...register("location")}
      />

      <div className="flex gap-3">
        <Button type="submit" loading={submitting} disabled={submitting}>
          Create draft listing
        </Button>
      </div>
    </form>
  );
}
