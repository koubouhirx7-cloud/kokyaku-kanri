-- Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kana TEXT,
    phone TEXT,
    email TEXT,
    "lineId" TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new',
    bikes JSONB DEFAULT '[]'::jsonb,
    "maintenanceLogs" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    "customerId" TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    "customerName" TEXT,
    status TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    "dueDate" DATE,
    memo TEXT,
    attachment TEXT,
    "orderItems" JSONB DEFAULT '[]'::jsonb,
    "workItems" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "completedAt" TIMESTAMPTZ,
    "archivedAt" TIMESTAMPTZ
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create Policies (Only allowed to authenticated users)
-- Note: Replace 'authenticated' with proper role if needed
CREATE POLICY "Allow authenticated access" ON public.customers
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated access" ON public.tasks
    FOR ALL USING (auth.role() = 'authenticated');
