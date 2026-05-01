"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Crown,
  ShieldCheck,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserStore } from "@/store/user-store";
import { useAuth } from "@/lib/supabase/auth-context";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import {
  AUTO_TOPUP_CONFIG_KEY,
  AUTO_TOPUP_THRESHOLD,
  parseAutoTopupConfig,
} from "@/lib/credits/auto-topup";

type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price: number;
  isPopular: boolean;
};

const freeHighlights = [
  "1 published tour maximum",
  "Maximum 7 guests per tour",
  "Basic listing visibility",
  "Standard support",
];

const proHighlights = [
  "Unlimited tours and group capacity",
  "Boost tools and priority placement",
  "Advanced analytics and visibility insights",
  "Verified badge and stronger trust signals",
];

import { isSeller } from "@/lib/marketplace/roles"

export default function UpgradePage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { planType, planLoading } = useUserStore();

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  const [activationPackageId, setActivationPackageId] = useState("");
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);
  const [autoTopupPackageId, setAutoTopupPackageId] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activationPolicyMessage, setActivationPolicyMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (profile && !isSeller(profile.role)) {
      router.push("/");
    }
  }, [authLoading, user, profile, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseAutoTopupConfig(
      localStorage.getItem(AUTO_TOPUP_CONFIG_KEY),
    );
    if (!parsed) return;

    setAutoTopupEnabled(parsed.enabled);
    setAutoTopupPackageId(parsed.packageId);
  }, []);

  useEffect(() => {
    if (!user || !isSeller(profile?.role)) return;

    const fetchData = async () => {
      try {
        setLoadingData(true);

        const [creditRes, packageRes] = await Promise.all([
          fetch("/api/credits/balance", { cache: "no-store" }),
          supabase
            .from("credit_packages")
            .select("id, name, credits, price_eur, is_popular")
            .eq("is_active", true)
            .order("display_order", { ascending: true }),
        ]);

        if (creditRes.ok) {
          const creditJson = await creditRes.json();
          setCreditsBalance(Number(creditJson.balance || 0));
        }

        if (!packageRes.error && packageRes.data) {
          const normalized: CreditPackage[] = packageRes.data.map(
            (pkg: any) => ({
              id: pkg.id,
              name: pkg.name,
              credits: Number(pkg.credits || 0),
              price: Number(pkg.price_eur || 0),
              isPopular: Boolean(pkg.is_popular),
            }),
          );

          setPackages(normalized);

          const firstUpgradePackage =
            normalized.find((pkg) => pkg.credits === 50) || null;
          if (firstUpgradePackage) {
            setActivationPackageId(firstUpgradePackage.id);
            setActivationPolicyMessage(null);
          } else {
            setActivationPackageId("");
            setActivationPolicyMessage(
              "The required 50-credit activation package is not configured yet.",
            );
          }

          const defaultPkg =
            normalized.find((pkg) => pkg.isPopular) || normalized[0];

          if (defaultPkg && !autoTopupPackageId) {
            setAutoTopupPackageId(defaultPkg.id);
          }
        }
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user, profile?.role]);

  const activationPackage = useMemo(
    () => packages.find((pkg) => pkg.id === activationPackageId) || null,
    [packages, activationPackageId],
  );

  const autoTopupPackage = useMemo(
    () => packages.find((pkg) => pkg.id === autoTopupPackageId) || null,
    [packages, autoTopupPackageId],
  );

  const handleStartActivation = () => {
    if (!activationPackage) return;

    const preferredTopupPackage = autoTopupPackageId || activationPackage.id;
    localStorage.setItem(
      AUTO_TOPUP_CONFIG_KEY,
      JSON.stringify({
        enabled: true,
        packageId: preferredTopupPackage,
        threshold: AUTO_TOPUP_THRESHOLD,
      }),
    );

    router.push(
      `/checkout?id=${encodeURIComponent(activationPackage.id)}&source=pro_activation`,
    );
  };

  const handleSaveAutoTopup = () => {
    if (!autoTopupPackageId) {
      setSaveMessage("Select a package before saving auto top-up settings.");
      return;
    }

    localStorage.setItem(
      AUTO_TOPUP_CONFIG_KEY,
      JSON.stringify({
        enabled: autoTopupEnabled,
        packageId: autoTopupPackageId,
        threshold: AUTO_TOPUP_THRESHOLD,
      }),
    );

    setSaveMessage("Auto top-up settings saved.");
    setTimeout(() => setSaveMessage(null), 2500);
  };

  if (authLoading || planLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner label="Loading upgrade settings..." />
      </div>
    );
  }

  if (!user || !isSeller(profile?.role)) {
    return null;
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="rounded-2xl border border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge className="mb-2 bg-primary text-primary-foreground">
              <Crown className="w-3 h-3 mr-1" /> Pro Access
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight">
              Upgrade & Auto Top-up
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              One-time Pro activation, then automatic top-up flow when your
              balance reaches {AUTO_TOPUP_THRESHOLD} credits.
            </p>
          </div>
          <Button asChild variant="outline" className="bg-background">
            <Link href="/dashboard/credits">Go to Credits</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              One-time Pro Activation
            </CardTitle>
            <CardDescription>
              First-time activation is fixed to one package: 50 credits. After
              that, you stay Pro and can top up normally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
                <p className="font-semibold mb-2">Free</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {freeHighlights.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-primary/30 p-4 bg-primary/5">
                <p className="font-semibold mb-2 text-primary">Pro</p>
                <ul className="space-y-2 text-sm">
                  {proHighlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-secondary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {planType === "pro" ? (
              <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4">
                <p className="font-semibold text-secondary">
                  You are already on Pro.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use auto top-up settings below to keep your credit wallet
                  healthy.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {loadingData ? (
                  <div className="text-sm text-muted-foreground flex items-center">
                    <Spinner className="h-4 w-4 mr-2" /> Loading packages...
                  </div>
                ) : activationPackage ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground">
                      Required first-time package
                    </p>
                    <p className="text-lg font-semibold text-foreground mt-1">
                      {activationPackage.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activationPackage.credits} credits • €
                      {activationPackage.price}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                    {activationPolicyMessage ||
                      "Unable to locate the 50-credit activation package."}
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!activationPackage}
                  onClick={handleStartActivation}
                >
                  <span className="inline-flex items-center">
                    <Crown className="w-4 h-4 mr-2" />
                    {activationPackage
                      ? `Pay once: €${activationPackage.price} for 50 credits and activate Pro`
                      : "Activation package unavailable"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              What happens next?
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-1 text-sm">
            <div className="rounded-lg border border-border/60 p-4">
              <p className="font-medium">1. Activate Pro once</p>
              <p className="text-muted-foreground mt-1">
                Use a one-time credit package checkout to unlock Pro.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="font-medium">2. Keep auto top-up enabled</p>
              <p className="text-muted-foreground mt-1">
                Set your preferred package for low-balance moments.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="font-medium">3. Maintain campaign continuity</p>
              <p className="text-muted-foreground mt-1">
                Avoid boost interruptions due to depleted wallet credits.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              After payment confirmation, your account is upgraded to Pro by the
              existing checkout/webhook flow.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
