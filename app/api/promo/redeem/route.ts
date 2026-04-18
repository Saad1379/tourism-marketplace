import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createLocalClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { code } = await req.json()
    
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 })
    }

    const uppercaseCode = code.toUpperCase().trim()

    const localSupabase = await createLocalClient()
    const { data: { user }, error: authError } = await localSupabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin Client to bypass RLS
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch Promo Code
    const { data: promoCode, error: promoError } = await adminSupabase
      .from('promo_codes')
      .select('*')
      .eq('code', uppercaseCode)
      .eq('is_active', true)
      .single()

    if (promoError || !promoCode) {
      return NextResponse.json({ error: 'Invalid or inactive promo code' }, { status: 400 })
    }

    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This promo code has expired' }, { status: 400 })
    }

    if (promoCode.current_uses >= promoCode.max_uses) {
      return NextResponse.json({ error: 'This promo code has reached its maximum uses' }, { status: 400 })
    }

    // Check if user already redeemed it
    const { data: existingRedemption } = await adminSupabase
      .from('promo_code_redemptions')
      .select('id')
      .eq('promo_code_id', promoCode.id)
      .eq('guide_id', user.id)
      .maybeSingle()

    if (existingRedemption) {
      return NextResponse.json({ error: 'You have already redeemed this promo code' }, { status: 400 })
    }

    // Execute Redemptions
    const { error: insertError } = await adminSupabase
      .from('promo_code_redemptions')
      .insert({
        promo_code_id: promoCode.id,
        guide_id: user.id
      })

    if (insertError) {
      return NextResponse.json({ error: 'Failed to redeem promo code or already redeemed' }, { status: 400 })
    }

    // Increment usages
    const { data: currentPromo } = await adminSupabase.from('promo_codes').select('current_uses').eq('id', promoCode.id).single();
    if (currentPromo) {
       await adminSupabase.from('promo_codes').update({ current_uses: currentPromo.current_uses + 1 }).eq('id', promoCode.id);
    }

    // Grant Credits
    if (promoCode.credits_to_give > 0) {
      // NOTE: We generate a pseudo-random reference_id so it doesn't conflict with any other transaction check in the add_credits RPC
      const backupRef = `promo_${promoCode.id}_${user.id}`
      const { error: creditsError } = await adminSupabase.rpc('add_credits', {
        p_guide_id: user.id,
        p_credits: promoCode.credits_to_give,
        p_description: `Promo Code Redeemed: ${uppercaseCode}`,
        p_reference_id: backupRef
      })
      
      if (creditsError) {
        console.error('Failed to grant credits during promo redemption:', creditsError)
        return NextResponse.json({ error: 'Failed to add credits to wallet' }, { status: 500 })
      } 
    }

    // Upgrade Plan
    if (promoCode.gives_pro_status) {
      const { data: existingPlan } = await adminSupabase
        .from('guide_plans')
        .select('id, plan_type')
        .eq('guide_id', user.id)
        .maybeSingle()

      if (!existingPlan) {
        await adminSupabase.from('guide_plans').insert({
          guide_id: user.id,
          plan_type: 'pro',
          started_at: new Date().toISOString()
        })
      } else if (existingPlan.plan_type !== 'pro') {
        await adminSupabase
          .from('guide_plans')
          .update({ plan_type: 'pro', started_at: new Date().toISOString() })
          .eq('guide_id', user.id)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Promo code redeemed successfully!',
      credits_added: promoCode.credits_to_give,
      pro_upgraded: promoCode.gives_pro_status
    })

  } catch (error: any) {
    console.error('Promo redemption error:', error)
    return NextResponse.json({ error: 'Internal server error while processing promo code' }, { status: 500 })
  }
}
