DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
END
$$;
UPDATE public.profiles SET must_change_password = false WHERE must_change_password IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;
