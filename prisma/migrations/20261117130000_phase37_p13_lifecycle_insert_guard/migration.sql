-- Restore INSERT coverage for the existing lifecycle protection function.
CREATE OR REPLACE TRIGGER "p13_storage_lifecycle_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "storage_object_lifecycle"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_storage_lifecycle"();
