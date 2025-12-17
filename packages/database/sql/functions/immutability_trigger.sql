/**
 * Immutability Enforcement Trigger
 * Per README.md: "Immutability Enforcement for Closed Items"
 * Per PRD.md: "Once CLOSED / FORCE_CLOSED, data is immutable forever"
 * 
 * This trigger prevents ANY modifications to closed items.
 * This is a CRITICAL business rule for audit compliance.
 */

CREATE OR REPLACE FUNCTION prevent_closed_item_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if item is in a terminal state
  IF OLD.state IN ('CLOSED', 'FORCE_CLOSED', 'RFQ_CLOSED') THEN
    RAISE EXCEPTION 'Cannot modify closed item (ID: %). State: %. Create new RFQ for corrections.',
      OLD.id, OLD.state
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to workflow entities
CREATE TRIGGER rfq_items_immutability
BEFORE UPDATE ON rfq_items
FOR EACH ROW EXECUTE FUNCTION prevent_closed_item_modification();

CREATE TRIGGER order_items_immutability
BEFORE UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION prevent_closed_item_modification();

COMMENT ON FUNCTION prevent_closed_item_modification() IS 
'Prevents modification of items in terminal states (CLOSED, FORCE_CLOSED, RFQ_CLOSED). This is a critical audit compliance rule.';
