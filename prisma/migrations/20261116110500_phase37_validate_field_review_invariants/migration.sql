ALTER TABLE "extraction_field"
VALIDATE CONSTRAINT "extraction_field_review_configuration_check";

ALTER TABLE "extraction_field_review"
VALIDATE CONSTRAINT "extraction_field_review_payload_check";

ALTER TABLE "extraction_field_review"
VALIDATE CONSTRAINT "extraction_field_review_actor_snapshot_check";
