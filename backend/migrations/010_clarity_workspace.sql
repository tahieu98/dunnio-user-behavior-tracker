CREATE TABLE IF NOT EXISTS clarity_heatmap_reports (
 id INT PRIMARY KEY AUTO_INCREMENT,
 site_id INT NOT NULL,
 page_path VARCHAR(255) NOT NULL,
 project_id VARCHAR(100) NOT NULL DEFAULT '',
 device VARCHAR(12) NOT NULL,
 heatmap_type VARCHAR(32) NOT NULL DEFAULT 'all-clicks',
 segment VARCHAR(500) NOT NULL DEFAULT '',
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
 pageviews INT NULL,
 clicks INT NULL,
 image_path VARCHAR(255) NULL,
 image_width INT NULL,
 image_height INT NULL,
 selector_counts JSON NOT NULL,
 raw_csv MEDIUMTEXT NULL,
 csv_status VARCHAR(24) NOT NULL,
 complete_export BOOLEAN NOT NULL DEFAULT FALSE,
 anchors JSON NOT NULL,
 export_name VARCHAR(255) NOT NULL,
 content_hash CHAR(64) NOT NULL,
 source VARCHAR(32) NOT NULL DEFAULT 'clarity-portal-export',
 created_by INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (site_id) REFERENCES tracking_sites(id),
 FOREIGN KEY (created_by) REFERENCES users(id),
 UNIQUE KEY uk_clarity_report_content (content_hash),
 INDEX idx_clarity_report_cohort (site_id,page_path,device,start_date,end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clarity_collection_runs (
 id INT PRIMARY KEY AUTO_INCREMENT,
 site_id INT NOT NULL,
 name VARCHAR(120) NOT NULL,
 project_id VARCHAR(100) NOT NULL,
 device VARCHAR(12) NOT NULL,
 heatmap_type VARCHAR(32) NOT NULL,
 segment VARCHAR(500) NOT NULL DEFAULT '',
 timezone VARCHAR(64) NOT NULL,
 created_by INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (site_id) REFERENCES tracking_sites(id),
 FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clarity_collection_jobs (
 id INT PRIMARY KEY AUTO_INCREMENT,
 run_id INT NOT NULL,
 page_path VARCHAR(255) NOT NULL,
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'pending',
 report_id INT NULL,
 note VARCHAR(1000) NOT NULL DEFAULT '',
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (run_id) REFERENCES clarity_collection_runs(id),
 FOREIGN KEY (report_id) REFERENCES clarity_heatmap_reports(id),
 UNIQUE KEY uk_collection_job (run_id,page_path,start_date,end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO clarity_heatmap_reports
 (site_id,page_path,project_id,device,heatmap_type,segment,start_date,end_date,timezone,pageviews,clicks,image_path,image_width,image_height,selector_counts,raw_csv,csv_status,complete_export,anchors,export_name,content_hash,source,created_by,created_at)
 SELECT site_id,page_path,'',device,'all-clicks','',STR_TO_DATE(CONCAT(period_month,'-01'),'%Y-%m-%d'),LAST_DAY(STR_TO_DATE(CONCAT(period_month,'-01'),'%Y-%m-%d')),'Asia/Ho_Chi_Minh',pageviews,clicks,image_path,viewport_width,document_height,COALESCE(selector_counts,JSON_ARRAY()),NULL,'legacy',FALSE,JSON_ARRAY(),export_name,SHA2(CONCAT('legacy-archive-',id),256),'legacy-archive',created_by,created_at
 FROM heatmap_archives;
