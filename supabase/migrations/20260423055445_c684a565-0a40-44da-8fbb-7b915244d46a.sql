
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('user','admin');
CREATE TYPE public.market_code AS ENUM ('US','KR');
CREATE TYPE public.asset_status AS ENUM ('active','archived');
CREATE TYPE public.user_status AS ENUM ('active','suspended');
CREATE TYPE public.valuation_band AS ENUM ('UNDERVALUED','FAIR','OVERVALUED','UNKNOWN');
CREATE TYPE public.chat_intent_type AS ENUM ('ADD_ASSET','UPDATE_ASSET','REMOVE_ASSET','QUERY_PORTFOLIO','UNKNOWN');
CREATE TYPE public.chat_intent_status AS ENUM ('pending','confirmed','cancelled','failed');

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

-- profile policies
CREATE POLICY "self read profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()=id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "self insert profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);
CREATE POLICY "admin update profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- role policies
CREATE POLICY "self read roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== PRICE SNAPSHOTS (mock market data) ==============
CREATE TABLE public.price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  market public.market_code NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  current_price NUMERIC(18,4) NOT NULL,
  prev_close NUMERIC(18,4),
  eps NUMERIC(18,4),
  per NUMERIC(18,4),
  industry_per NUMERIC(18,4),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (ticker, market)
);
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read prices" ON public.price_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write prices" ON public.price_snapshots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== PORTFOLIOS / ASSETS ==============
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Portfolio',
  base_currency TEXT NOT NULL DEFAULT 'KRW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all portfolios" ON public.portfolios FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);

CREATE TABLE public.portfolio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  market public.market_code NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
  avg_price NUMERIC(18,4) NOT NULL CHECK (avg_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.asset_status NOT NULL DEFAULT 'active',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all assets" ON public.portfolio_assets FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);
CREATE INDEX idx_assets_user ON public.portfolio_assets(user_id);
CREATE INDEX idx_assets_ticker ON public.portfolio_assets(ticker, market);

-- ============== VALUATION ==============
CREATE TABLE public.valuation_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  description TEXT,
  rule_json JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.valuation_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read rules" ON public.valuation_rule_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage rules" ON public.valuation_rule_versions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.valuation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.portfolio_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_version TEXT NOT NULL,
  fair_value NUMERIC(18,4),
  current_price NUMERIC(18,4),
  gap_percent NUMERIC(10,4),
  score INTEGER,
  band public.valuation_band NOT NULL DEFAULT 'UNKNOWN',
  reason_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.valuation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read valuation" ON public.valuation_results FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner write valuation" ON public.valuation_results FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "owner del valuation" ON public.valuation_results FOR DELETE TO authenticated USING (auth.uid()=user_id);
CREATE INDEX idx_valuation_asset ON public.valuation_results(asset_id, computed_at DESC);

-- ============== CHAT INTENTS ==============
CREATE TABLE public.chat_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  intent_type public.chat_intent_type NOT NULL DEFAULT 'UNKNOWN',
  parsed_payload JSONB,
  confidence NUMERIC(5,4),
  status public.chat_intent_status NOT NULL DEFAULT 'pending',
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read chat" ON public.chat_intents FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner insert chat" ON public.chat_intents FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "owner update chat" ON public.chat_intents FOR UPDATE TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============== ADMIN AUDIT LOGS ==============
CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert audit" ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id=auth.uid());

-- ============== TRIGGERS ==============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.portfolio_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile, default user role, and default portfolio on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id,email,display_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.portfolios (user_id, name) VALUES (NEW.id, 'My Portfolio');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
