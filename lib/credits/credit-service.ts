import { createClient } from '@/lib/supabase/server';

export async function addCreditsToGuide(guideId: string, credits: number, description: string, referenceId?: string) {
  const supabase = await createClient();

  const normalizedReferenceId =
    referenceId && /^[0-9a-fA-F-]{36}$/.test(referenceId) ? referenceId : "";

  const { error } = await supabase.rpc('add_credits_for_purchase', {
    p_guide_id: guideId,
    p_credits: credits,
    p_description: description,
    p_reference_id: normalizedReferenceId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function upgradeGuideToPro(guideId: string, durationMonths: number = 12) {
  const supabase = await createClient();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  const { data: existingPlan } = await supabase
    .from('guide_plans')
    .select('*')
    .eq('guide_id', guideId)
    .single();

  if (existingPlan) {
    await supabase
      .from('guide_plans')
      .update({ plan_type: 'pro', expires_at: expiresAt.toISOString(), auto_renew: true })
      .eq('guide_id', guideId);
  } else {
    await supabase.from('guide_plans').insert({
      guide_id: guideId,
      plan_type: 'pro',
      expires_at: expiresAt.toISOString(),
      auto_renew: true,
    });
  }
}

export async function getGuideCredits(guideId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('guide_credits')
    .select('balance')
    .eq('guide_id', guideId)
    .single();
  
  return data?.balance || 0;
}

export async function checkAndDowngradePlan(guideId: string) {
  const supabase = await createClient();
  const balance = await getGuideCredits(guideId);
  
  if (balance <= 0) {
    await supabase
      .from('guide_plans')
      .update({ plan_type: 'free', expires_at: null })
      .eq('guide_id', guideId);
  }
}
