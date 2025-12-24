DROP POLICY IF EXISTS "Allow trigger to insert audit log" ON public.issue_audit_log;
CREATE POLICY "Allow trigger to insert audit log" ON public.issue_audit_log
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert audit log" ON public.issue_audit_log;
CREATE POLICY "Users can insert audit log" ON public.issue_audit_log
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
