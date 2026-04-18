-- Booking credit deduction and refund triggers

CREATE OR REPLACE FUNCTION public.booking_credit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.deduct_credits_on_booking(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.booking_refund_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refund_credits_on_cancellation(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_credit_trigger ON public.bookings;
CREATE TRIGGER booking_credit_trigger
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.booking_credit_trigger();

DROP TRIGGER IF EXISTS booking_refund_trigger ON public.bookings;
CREATE TRIGGER booking_refund_trigger
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.booking_refund_trigger();
