/**
 * Audit Log Trigger Function
 * Per README.md: "Audit Log Trigger (MANDATORY for all workflow tables)"
 * 
 * This function automatically logs all INSERT, UPDATE, DELETE operations
 * to the audit_logs table with full change tracking.
 */

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    timestamp,
    ip_address,
    user_agent
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    current_setting('app.current_user_id', true)::uuid,
    NOW(),
    current_setting('app.client_ip', true),
    current_setting('app.user_agent', true)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all critical tables
-- RFQ workflow tables
CREATE TRIGGER rfq_items_audit
AFTER INSERT OR UPDATE OR DELETE ON rfq_items
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER rfq_item_revisions_audit
AFTER INSERT OR UPDATE OR DELETE ON rfq_item_revisions
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER commercial_terms_audit
AFTER INSERT OR UPDATE OR DELETE ON commercial_terms
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER vendor_quotes_audit
AFTER INSERT OR UPDATE OR DELETE ON vendor_quotes
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ORDER workflow tables
CREATE TRIGGER order_items_audit
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER order_item_lots_audit
AFTER INSERT OR UPDATE OR DELETE ON order_item_lots
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER invoices_audit
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER payments_audit
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- Master data tables
CREATE TRIGGER customers_audit
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER vendors_audit
AFTER INSERT OR UPDATE OR DELETE ON vendors
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER products_audit
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
