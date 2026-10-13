ALTER TABLE tracking_sites ADD COLUMN tracking_scope VARCHAR(20) NOT NULL DEFAULT 'registered';
UPDATE tracking_sites SET tracking_scope='all-public' WHERE origin='https://dunniotailor.com';
