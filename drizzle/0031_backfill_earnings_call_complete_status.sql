-- Custom SQL migration file, put your code below! --
UPDATE "earnings_calls" ec SET "status" = 'complete', "updated_at" = now()
WHERE ec."status" = 'takeaways_queued'
  AND ec."document_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "takeaways" t WHERE t."document_id" = ec."document_id");
