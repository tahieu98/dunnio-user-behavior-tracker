-- Independent measured events. Legacy estimated Clarity events are never mixed in.
CREATE TABLE IF NOT EXISTS tracking_sites (
 id INT PRIMARY KEY AUTO_INCREMENT,
 name VARCHAR(120) NOT NULL,
 public_key VARCHAR(80) NOT NULL UNIQUE,
 origin VARCHAR(255) NOT NULL UNIQUE,
 goal_paths JSON NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS behavior_events (
 id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
 event_id CHAR(36) NOT NULL UNIQUE,
 site_id INT NOT NULL,
 page_path VARCHAR(255) NOT NULL,
 session_hash CHAR(64) NOT NULL,
 view_id CHAR(36) NOT NULL,
 event_type ENUM('pageview','click','scroll','exposure','action') NOT NULL,
 occurred_at DATETIME(3) NOT NULL COMMENT 'UTC',
 received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 device ENUM('desktop','tablet','mobile') NOT NULL,
 layout_version VARCHAR(80) NOT NULL,
 viewport_width INT NOT NULL,
 viewport_height INT NOT NULL,
 document_height INT NOT NULL,
 x DECIMAL(12,3) NULL,
 y DECIMAL(12,3) NULL,
 grid_col SMALLINT NULL,
 grid_row INT NULL,
 region_key VARCHAR(80) NOT NULL DEFAULT 'unmarked',
 element_key VARCHAR(80) NULL,
 target_path VARCHAR(255) NULL,
 action_name ENUM('navigation','form_success','customizer_start') NULL,
 source_event_id CHAR(36) NULL,
 scroll_depth SMALLINT NULL,
 FOREIGN KEY (site_id) REFERENCES tracking_sites(id),
 INDEX idx_period (site_id,page_path,device,layout_version,occurred_at),
 INDEX idx_attribution (source_event_id,session_hash),
 INDEX idx_session (site_id,session_hash,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS page_snapshots (
 id INT PRIMARY KEY AUTO_INCREMENT,
 site_id INT NOT NULL,
 page_path VARCHAR(255) NOT NULL,
 device ENUM('desktop','tablet','mobile') NOT NULL,
 layout_version VARCHAR(80) NOT NULL,
 viewport_width INT NOT NULL,
 document_height INT NOT NULL,
 image_path VARCHAR(255) NOT NULL,
 captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (site_id) REFERENCES tracking_sites(id),
 UNIQUE KEY uk_snapshot (site_id,page_path,device,layout_version,viewport_width)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS behavior_notes (
 id INT PRIMARY KEY AUTO_INCREMENT,
 site_id INT NOT NULL,
 page_path VARCHAR(255) NOT NULL,
 device VARCHAR(12) NOT NULL,
 layout_version VARCHAR(80) NOT NULL,
 grid_col SMALLINT NOT NULL,
 grid_row INT NOT NULL,
 period_a CHAR(7) NOT NULL,
 period_b CHAR(7) NOT NULL,
 note_text VARCHAR(2000) NOT NULL,
 status ENUM('pending','approved','implemented','rejected') DEFAULT 'pending',
 created_by INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (site_id) REFERENCES tracking_sites(id),
 FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clarity_exports (
 id INT PRIMARY KEY AUTO_INCREMENT,
 project_id VARCHAR(100) NOT NULL,
 requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 num_of_days SMALLINT NOT NULL,
 payload JSON NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'started',
 INDEX idx_project_day (project_id,requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO tracking_sites(name,public_key,origin,goal_paths)
VALUES ('Dunnio Tailor','dunnio-public-v1','https://dunniotailor.com',
 JSON_ARRAY('/men/custom-suits','/men/custom-tuxedo','/3d-custom-outfit/suits.html','/3d-custom-outfit/tuxedo.html','/contact-us'));
