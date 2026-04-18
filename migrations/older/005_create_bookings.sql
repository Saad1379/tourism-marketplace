-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  tourist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Booking details
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  group_size INTEGER NOT NULL DEFAULT 1,
  special_requests TEXT,
  -- Contact info (in case tourist hasn't completed profile)
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  -- Attendance tracking
  guide_checked_in BOOLEAN DEFAULT FALSE,
  tourist_confirmed BOOLEAN DEFAULT FALSE,
  attendance_status TEXT CHECK (attendance_status IN ('show', 'no_show', 'partial')),
  -- Payment/Tips
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  tip_currency TEXT DEFAULT 'USD',
  -- Cancellation
  cancelled_by TEXT CHECK (cancelled_by IN ('tourist', 'guide', 'system')),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "bookings_select_own"
  ON public.bookings FOR SELECT
  USING (tourist_id = auth.uid() OR guide_id = auth.uid());

CREATE POLICY "bookings_insert_tourist"
  ON public.bookings FOR INSERT
  WITH CHECK (tourist_id = auth.uid());

CREATE POLICY "bookings_update_own"
  ON public.bookings FOR UPDATE
  USING (tourist_id = auth.uid() OR guide_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON public.bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tourist_id ON public.bookings(tourist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guide_id ON public.bookings(guide_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
