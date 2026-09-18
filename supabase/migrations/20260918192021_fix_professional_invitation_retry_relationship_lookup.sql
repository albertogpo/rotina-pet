-- Production migration-history alignment for the runtime retry correction.
-- The preceding repository migration already stores the corrected canonical
-- accept_professional_invitation definition, so new installations need no
-- additional DDL in this historical follow-up.


notify pgrst, 'reload schema';