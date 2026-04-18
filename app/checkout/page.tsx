'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

import { createClient } from '@/lib/supabase/client';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function CheckoutForm({ selectedPkg, source }: { selectedPkg: any; source: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setStatus(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success?credits=${selectedPkg.credits}&package_id=${selectedPkg.id}&source=${encodeURIComponent(source)}`,
        },
      });

      if (error) {
        setStatus({ type: 'error', message: error.message || 'Payment failed' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Payment processing failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex justify-between mb-2">
          <span>Credits:</span>
          <span className="font-semibold">{selectedPkg.credits}</span>
        </div>
        <div className="flex justify-between text-xl font-bold">
          <span>Total:</span>
          <span>€{selectedPkg.price}</span>
        </div>
      </div>

      <PaymentElement />

      <Button type="submit" disabled={!stripe || loading} className="w-full" size="lg">
        {loading ? <Spinner className="mr-2" /> : null}
        Pay €{selectedPkg.price}
      </Button>

      {status && (
        <Alert variant={status.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  
  // Notice we now track selected package ID instead of credits count
  const preselectedId = searchParams.get('id');
  const checkoutSource = searchParams.get('source') || 'credits_purchase';
  const isProActivation = checkoutSource === 'pro_activation';
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(preselectedId);
  
  const [creditPackages, setCreditPackages] = useState<any[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);
  
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchPackages = async () => {
      setPackagesLoading(true);
      const { data, error } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        // Map database fields to UI keys
        const parsed = data.map((pkg: any) => ({
          id: pkg.id,
          name: pkg.name,
          credits: pkg.credits,
          price: Number(pkg.price_eur),
          popular: pkg.is_popular,
          savings: pkg.savings_percentage
        }));
        setCreditPackages(parsed);

        if (isProActivation) {
          const activationPackage = parsed.find((p: any) => Number(p.credits) === 50) || null;
          if (!activationPackage) {
            setPolicyError('50-credit activation package is not configured.');
            setSelectedPackageId(null);
          } else {
            setPolicyError(null);
            setSelectedPackageId(activationPackage.id);
          }
          setPackagesLoading(false);
          return;
        }
        
        // If no ID was preselected in URL, default to the most popular or first item
        if (!selectedPackageId) {
          const defaultPkg = parsed.find((p: any) => p.popular) || parsed[0];
          setSelectedPackageId(defaultPkg.id);
        }
      }
      setPackagesLoading(false);
    };

    fetchPackages();
  }, []);

  useEffect(() => {
    // Only fetch payment intent if packages are done loading and we have a valid selection
    if (!packagesLoading && selectedPackageId) {
      handleCreatePayment();
    }
  }, [selectedPackageId, packagesLoading]);

  const selectedPkg = creditPackages.find(p => p.id === selectedPackageId);

  const handleCreatePayment = async () => {
    if (!selectedPkg) return;
    setPaymentLoading(true);
    setPolicyError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          packageId: selectedPkg.id,
          currency: 'eur',
          source: checkoutSource,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setClientSecret(data.clientSecret);
      } else {
        setPolicyError(data?.error || 'Failed to initialize payment.');
      }
    } catch (error) {
      console.error('Failed to create payment intent', error);
      setPolicyError('Failed to initialize payment.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const displayedPackages = isProActivation
    ? creditPackages.filter((pkg: any) => Number(pkg.credits) === 50)
    : creditPackages;

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Purchase Credits</h1>
        <p className="text-muted-foreground">1 Credit = €1 | Use credits for tour bookings</p>
        {isProActivation && (
          <p className="text-sm text-primary mt-2">First-time Pro activation requires the 50-credit package.</p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Select Package</h2>
          <div className="space-y-3">
            {packagesLoading ? (
               <div className="flex justify-center py-12"><Spinner /></div>
            ) : displayedPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`relative cursor-pointer transition-all ${
                  selectedPackageId === pkg.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  if (!isProActivation) setSelectedPackageId(pkg.id);
                }}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Most Popular</span>
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-lg">{pkg.credits} Credits</div>
                      {pkg.savings && (
                        <div className="text-sm text-secondary">Save {pkg.savings}%</div>
                      )}
                    </div>
                    <div className="text-2xl font-bold">€{pkg.price}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!packagesLoading && displayedPackages.length === 0 && (
              <Alert variant="destructive">
                <AlertDescription>{policyError || 'No available packages.'}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
              <CardDescription>Complete your purchase</CardDescription>
            </CardHeader>
            <CardContent>
              {packagesLoading || paymentLoading || !clientSecret || !selectedPkg ? (
                <div className="py-8 text-center">
                  <Spinner className="mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading payment form...</p>
                </div>
              ) : clientSecret.startsWith('pi_mock_') ? (
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span>Credits (Mock):</span>
                      <span className="font-semibold">{selectedPkg.credits}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span>€{selectedPkg.price}</span>
                    </div>
                  </div>
                  <Alert className="bg-primary/10 text-primary border-primary/30">
                    <AlertDescription>
                      You are in Test Mode. Click below to safely simulate a successful payment without triggering the Stripe SDK validation.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    className="w-full bg-primary hover:bg-primary text-white" 
                    size="lg" 
                    onClick={() => {
                        window.location.href = `/checkout/success?credits=${selectedPkg.credits}&package_id=${selectedPkg.id}&source=${encodeURIComponent(checkoutSource)}&payment_intent=${clientSecret.split('_secret_')[0]}`;
                    }}>
                    Simulate Successful Payment
                  </Button>
                </div>
              ) : !stripePromise ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Checkout is temporarily unavailable because Stripe is not configured.
                  </AlertDescription>
                </Alert>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm selectedPkg={selectedPkg} source={checkoutSource} />
                </Elements>
              )}
              {policyError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{policyError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              Secure payment powered by Stripe
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
