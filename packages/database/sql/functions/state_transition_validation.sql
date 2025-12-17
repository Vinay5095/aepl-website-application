/**
 * State Transition Validation Function
 * Per README.md: "State Transition Matrix (Database Constraint)"
 * 
 * Validates that a state transition is allowed based on:
 * 1. Valid from/to state combination exists
 * 2. User's role is allowed to perform this transition
 */

CREATE OR REPLACE FUNCTION validate_state_transition(
  p_entity_type TEXT,
  p_from_state TEXT,
  p_to_state TEXT,
  p_user_role TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  -- Check if transition exists and user role is allowed
  SELECT 
    p_user_role = ANY(allowed_roles)
  INTO v_allowed
  FROM state_transitions
  WHERE entity_type = p_entity_type
    AND from_state = p_from_state
    AND to_state = p_to_state;
  
  -- If no transition found, return false
  IF v_allowed IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN v_allowed;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_state_transition(TEXT, TEXT, TEXT, TEXT) IS 
'Validates that a state transition is allowed based on the state_transitions table and user role.';

/**
 * Check if user role can perform any transition from current state
 */
CREATE OR REPLACE FUNCTION get_allowed_transitions(
  p_entity_type TEXT,
  p_from_state TEXT,
  p_user_role TEXT
) RETURNS TABLE(to_state TEXT, requires_reason BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.to_state,
    st.requires_reason
  FROM state_transitions st
  WHERE st.entity_type = p_entity_type
    AND st.from_state = p_from_state
    AND p_user_role = ANY(st.allowed_roles);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_allowed_transitions(TEXT, TEXT, TEXT) IS 
'Returns all allowed transitions from a given state for a specific user role.';
