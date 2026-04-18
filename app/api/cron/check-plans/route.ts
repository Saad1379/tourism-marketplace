import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAndDowngradePlan } from '@/lib/credits/credit-service';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: proGuides } = await supabase
      .from('guide_plans')
      .select('guide_id')
      .eq('plan_type', 'pro');

    if (proGuides) {
      for (const guide of proGuides) {
        await checkAndDowngradePlan(guide.guide_id);
      }
    }

    return NextResponse.json({ success: true, checked: proGuides?.length || 0 });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
