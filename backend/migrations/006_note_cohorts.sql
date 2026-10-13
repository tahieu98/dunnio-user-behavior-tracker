ALTER TABLE behavior_notes
 ADD COLUMN viewport_width INT NULL,
 ADD COLUMN layout_version_b VARCHAR(80) NULL,
 ADD COLUMN viewport_width_b INT NULL,
 ADD COLUMN selected_period ENUM('a','b') NOT NULL DEFAULT 'a';
