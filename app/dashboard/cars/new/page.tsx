"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { CarImageUploader } from "@/components/cars/car-image-uploader";

export default function NewCarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Image state (create flow — stored as blob preview URLs)
  const [images, setImages] = useState<string[]>([]);
  const pendingFilesRef = useRef<File[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    city_slug: "",
    country: "",
    price_per_day: "",
    make: "",
    model: "",
    year: "",
    seats: "4",
    transmission: "automatic",
    fuel_type: "petrol",
    features: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "city") {
        updated.city_slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.city_slug.trim()) {
      toast.error("City is required");
      return;
    }

    setLoading(true);
    try {
      // Step 1 — Create car record (no images yet)
      const res = await fetch("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          city: form.city.trim() || null,
          city_slug: form.city_slug.trim().toLowerCase(),
          country: form.country.trim() || null,
          price_per_day: form.price_per_day ? Number(form.price_per_day) : null,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          year: form.year ? Number(form.year) : null,
          seats: Number(form.seats),
          transmission: form.transmission,
          fuel_type: form.fuel_type,
          features: form.features
            ? form.features.split(",").map((f) => f.trim()).filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create car");
      }

      const car = await res.json();

      // Step 2 — Upload pending images to Cloudinary
      const files = pendingFilesRef.current;
      if (files.length > 0) {
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          const upRes = await fetch(`/api/cars/${car.id}/upload-image`, {
            method: "POST",
            body: fd,
          });
          if (!upRes.ok) {
            const err = await upRes.json();
            console.warn("[v0] Image upload failed:", err.error);
          }
        }
      }

      toast.success("Car listing created!", {
        description:
          files.length > 0
            ? "Photos uploaded. Add availability slots and publish."
            : "You can add photos and availability slots now.",
      });
      router.push(`/dashboard/cars/${car.id}/edit`);
    } catch (error) {
      toast.error("Failed to create car", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-10">
        <div className="mb-6">
          <Link
            href="/dashboard/cars"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to my cars
          </Link>
          <h1 className="text-2xl font-bold">Add a new car</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fill in the details below. You can add availability slots after
            creating the listing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photos */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Photos (up to 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <CarImageUploader
                images={images}
                onChange={setImages}
                onPendingFiles={(files) => { pendingFilesRef.current = files }}
                disabled={loading}
              />
            </CardContent>
          </Card>

          {/* Basic info */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Basic info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Listing title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g. Clean Toyota Corolla with A/C"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the car, its condition, what's included..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Location</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Barcelona"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  placeholder="Spain"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="price_per_day">Price per day (€)</Label>
                <Input
                  id="price_per_day"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_per_day}
                  onChange={(e) => updateField("price_per_day", e.target.value)}
                  placeholder="45"
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Vehicle details */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Vehicle details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={form.make}
                  onChange={(e) => updateField("make", e.target.value)}
                  placeholder="Toyota"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder="Corolla"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(e) => updateField("year", e.target.value)}
                  placeholder="2021"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="seats">Seats</Label>
                <Input
                  id="seats"
                  type="number"
                  min="1"
                  max="20"
                  value={form.seats}
                  onChange={(e) => updateField("seats", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Transmission</Label>
                <Select
                  value={form.transmission}
                  onValueChange={(v) => updateField("transmission", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automatic</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fuel type</Label>
                <Select
                  value={form.fuel_type}
                  onValueChange={(v) => updateField("fuel_type", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="petrol">Petrol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="features">Features (comma-separated)</Label>
                <Input
                  id="features"
                  value={form.features}
                  onChange={(e) => updateField("features", e.target.value)}
                  placeholder="GPS, Bluetooth, USB charger, Baby seat"
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? "Creating..." : "Create car listing"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
