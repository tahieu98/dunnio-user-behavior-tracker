-- Site-qualified paths let multiple websites each register / or /products.
CREATE TABLE IF NOT EXISTS tracked_pages (
 id INT PRIMARY KEY AUTO_INCREMENT,
 site_id INT NOT NULL,
 page_path VARCHAR(255) NOT NULL,
 title VARCHAR(255) NOT NULL,
 category VARCHAR(100) NOT NULL,
 is_tracked BOOLEAN DEFAULT TRUE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (site_id) REFERENCES tracking_sites(id),
 UNIQUE KEY uk_site_path (site_id,page_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO tracked_pages(site_id,page_path,title,category,is_tracked)
SELECT s.id,p.url_path,p.title,p.category,p.is_tracked FROM pages p
JOIN tracking_sites s ON p.url COLLATE utf8mb4_unicode_ci=CONCAT(s.origin,p.url_path) COLLATE utf8mb4_unicode_ci;
