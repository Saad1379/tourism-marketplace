-- Add guide_approval_status to profiles
-- Values: null (not a guide yet), 'pending' (submitted, awaiting review), 'approved', 'rejected'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guide_approval_status text
  CHECK (guide_approval_status IN ('pending', 'approved', 'rejected'));

-- Admin notifications table for real-time alerts
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL DEFAULT 'guide_application',
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can access notifications
CREATE POLICY "Admins can manage notifications"
  ON public.admin_notifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Enable Realtime for admin_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
