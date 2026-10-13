-- =============================================
-- Dunnio Behavior Tracker - Database Schema
-- =============================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS dunnio_tracker;
USE dunnio_tracker;

-- =============================================
-- TABLE: users
-- Users with roles: admin, dev, editor
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'dev', 'editor') DEFAULT 'editor',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: pages
-- Page configurations for dunniotailor.com
-- =============================================
CREATE TABLE IF NOT EXISTS pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(500) NOT NULL,
    url_path VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    grid_columns INT DEFAULT 12,
    grid_row_height INT DEFAULT 50,
    grid_max_rows INT DEFAULT 100,
    viewport_width INT DEFAULT 1920,
    viewport_height INT DEFAULT 1080,
    is_3d_demo BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP NULL,
    last_data_update TIMESTAMP NULL,
    is_tracked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_url (url_path),
    INDEX idx_category (category),
    INDEX idx_is_tracked (is_tracked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: clarity_tokens
-- Microsoft Clarity API tokens
-- =============================================
CREATE TABLE IF NOT EXISTS clarity_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token_name VARCHAR(100) NOT NULL,
    jwt_token TEXT NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    project_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    INDEX idx_is_active (is_active),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: click_events
-- Aggregated click data by grid cell
-- =============================================
CREATE TABLE IF NOT EXISTS click_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    element_selector VARCHAR(500),
    element_text VARCHAR(255),
    element_tag VARCHAR(50),
    grid_col_start INT NOT NULL,
    grid_col_end INT NOT NULL,
    grid_row_start INT NOT NULL,
    grid_row_end INT NOT NULL,
    click_count INT DEFAULT 0,
    unique_clicks INT DEFAULT 0,
    avg_scroll_depth DECIMAL(5,2) DEFAULT 0.00,
    avg_engagement_time INT DEFAULT 0,
    dead_click_count INT DEFAULT 0,
    rage_click_count INT DEFAULT 0,
    data_date DATE NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    INDEX idx_page_date (page_id, data_date),
    INDEX idx_grid_position (grid_col_start, grid_row_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: page_metrics
-- Daily aggregated metrics per page
-- =============================================
CREATE TABLE IF NOT EXISTS page_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    metric_date DATE NOT NULL,
    total_pageviews INT DEFAULT 0,
    unique_visitors INT DEFAULT 0,
    avg_time_on_page INT DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0.00,
    scroll_depth_25 INT DEFAULT 0,
    scroll_depth_50 INT DEFAULT 0,
    scroll_depth_75 INT DEFAULT 0,
    scroll_depth_100 INT DEFAULT 0,
    total_clicks INT DEFAULT 0,
    avg_clicks_per_session DECIMAL(5,2) DEFAULT 0.00,
    dead_clicks INT DEFAULT 0,
    rage_clicks INT DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    UNIQUE KEY uk_page_date (page_id, metric_date),
    INDEX idx_metric_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: cta_suggestions
-- CTA recommendations by grid position
-- =============================================
CREATE TABLE IF NOT EXISTS cta_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    grid_col INT NOT NULL,
    grid_row INT NOT NULL,
    suggestion_type ENUM('cta_button', 'internal_link', 'promo_banner', 'product_feature', 'form_improvement', 'content_gap') NOT NULL,
    suggestion_title VARCHAR(255) NOT NULL,
    suggestion_text TEXT,
    suggestion_code TEXT,
    priority INT DEFAULT 0,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    status ENUM('pending', 'approved', 'implemented', 'rejected', 'archived') DEFAULT 'pending',
    impact_score INT DEFAULT 0,
    implemented_at TIMESTAMP NULL,
    created_by INT,
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_page_status (page_id, status),
    INDEX idx_priority (priority DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: grid_cells
-- Pre-calculated grid cell data
-- =============================================
CREATE TABLE IF NOT EXISTS grid_cells (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    grid_col INT NOT NULL,
    grid_row INT NOT NULL,
    pixel_x INT NOT NULL,
    pixel_y INT NOT NULL,
    pixel_width INT NOT NULL,
    pixel_height INT NOT NULL,
    heat_level INT DEFAULT 0,
    click_density DECIMAL(10,4) DEFAULT 0.00,
    has_cta BOOLEAN DEFAULT FALSE,
    has_content BOOLEAN DEFAULT FALSE,
    content_type VARCHAR(100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    UNIQUE KEY uk_page_cell (page_id, grid_col, grid_row),
    INDEX idx_heat_level (heat_level DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: sync_logs
-- Clarity data sync history
-- =============================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sync_type ENUM('clarity', 'manual', 'scheduled') NOT NULL,
    status ENUM('started', 'in_progress', 'completed', 'failed') DEFAULT 'started',
    records_processed INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    created_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLE: sessions
-- Active user sessions
-- =============================================
CREATE TABLE IF NOT EXISTS sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Insert default admin user (password: admin123)
-- Password hash generated with bcrypt
-- =============================================
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@dunnio-tracker.local', '$2b$10$YourHashHere', 'admin');

-- =============================================
-- Insert Dunnio Tailor pages
-- =============================================
INSERT INTO pages (url, url_path, title, category, subcategory, description, is_3d_demo) VALUES
-- Suits
('https://dunniotailor.com/men/custom-suits', '/men/custom-suits', 'Custom Suits', 'suits', 'custom', 'Premium custom-tailored suits for men', FALSE),
('https://dunniotailor.com/men/3-pieces-suit', '/men/3-pieces-suit', 'Custom 3-Piece Suits', 'suits', '3-piece', 'Complete 3-piece suit collections', FALSE),
('https://dunniotailor.com/men/wool-suits', '/men/wool-suits', 'Wool Suits', 'suits', 'wool', 'Luxurious wool suits', FALSE),
('https://dunniotailor.com/men/linen-suits', '/men/linen-suits', 'Linen Suits', 'suits', 'linen', 'Breathable linen suits for warm weather', FALSE),
('https://dunniotailor.com/men/cotton-suits', '/men/cotton-suits', 'Cotton Suits', 'suits', 'cotton', 'Comfortable cotton suits', FALSE),
('https://dunniotailor.com/men/tweed-suits', '/men/tweed-suits', 'Tweed Suits', 'suits', 'tweed', 'Classic tweed suits', FALSE),

-- Shirts
('https://dunniotailor.com/men/custom-dress-shirts', '/men/custom-dress-shirts', 'Custom Dress Shirts', 'shirts', 'custom', 'Bespoke dress shirts', FALSE),
('https://dunniotailor.com/men/cotton-shirts', '/men/cotton-shirts', 'Cotton Shirts', 'shirts', 'cotton', 'Premium cotton shirts', FALSE),
('https://dunniotailor.com/men/linen-shirts', '/men/linen-shirts', 'Linen Shirts', 'shirts', 'linen', 'Lightweight linen shirts', FALSE),
('https://dunniotailor.com/men/twill-shirts', '/men/twill-shirts', 'Twill Shirts', 'shirts', 'twill', 'Durable twill weave shirts', FALSE),
('https://dunniotailor.com/men/stretch-shirts', '/men/stretch-shirts', 'Stretch Shirts', 'shirts', 'stretch', 'Flexible stretch fabric shirts', FALSE),

-- Pants
('https://dunniotailor.com/men/custom-pants', '/men/custom-pants', 'Custom Pants', 'pants', 'custom', 'Tailored custom pants', FALSE),
('https://dunniotailor.com/men/custom-dress-pants', '/men/custom-dress-pants', 'Custom Dress Pants', 'pants', 'dress', 'Formal dress pants', FALSE),
('https://dunniotailor.com/men/wool-pants', '/men/wool-pants', 'Wool Pants', 'pants', 'wool', 'Premium wool trousers', FALSE),
('https://dunniotailor.com/men/linen-pants', '/men/linen-pants', 'Linen Pants', 'pants', 'linen', 'Casual linen pants', FALSE),
('https://dunniotailor.com/men/stretch-pants', '/men/stretch-pants', 'Stretch Pants', 'pants', 'stretch', 'Comfortable stretch pants', FALSE),

-- Tuxedo
('https://dunniotailor.com/men/custom-tuxedo', '/men/custom-tuxedo', 'Custom Tuxedo', 'tuxedo', 'custom', 'Bespoke tuxedo suits', FALSE),
('https://dunniotailor.com/men/wool-tuxedos', '/men/wool-tuxedos', 'Wool Tuxedos', 'tuxedo', 'wool', 'Classic wool tuxedos', FALSE),
('https://dunniotailor.com/men/velvet-tuxedos', '/men/velvet-tuxedos', 'Velvet Tuxedos', 'tuxedo', 'velvet', 'Luxurious velvet tuxedos', FALSE),
('https://dunniotailor.com/men/stretch-tuxedos', '/men/stretch-tuxedos', 'Stretch Tuxedos', 'tuxedo', 'stretch', 'Flexible stretch tuxedos', FALSE),
('https://dunniotailor.com/men/silk-blend-tuxedos', '/men/silk-blend-tuxedos', 'Silk Blend Tuxedos', 'tuxedo', 'silk', 'Premium silk blend tuxedos', FALSE),

-- Business & Formal
('https://dunniotailor.com/men/business-suits', '/men/business-suits', 'Business Suits', 'business', 'suits', 'Professional business suits', FALSE),
('https://dunniotailor.com/men/interview-suits', '/men/interview-suits', 'Interview Suits', 'business', 'interview', 'First impression suits', FALSE),
('https://dunniotailor.com/men/business-blazers', '/men/business-blazers', 'Business Blazers', 'business', 'blazers', 'Smart business blazers', FALSE),
('https://dunniotailor.com/men/formal-suits', '/men/formal-suits', 'Formal Suits', 'formal', 'suits', 'Elegant formal suits', FALSE),
('https://dunniotailor.com/men/black-tie-tuxedos', '/men/black-tie-tuxedos', 'Black Tie Tuxedos', 'formal', 'black-tie', 'Classic black tie tuxedos', FALSE),
('https://dunniotailor.com/men/gala-dinner', '/men/gala-dinner', 'Gala Dinner', 'formal', 'gala', 'Gala dinner attire', FALSE),
('https://dunniotailor.com/men/awards-ceremony', '/men/awards-ceremony', 'Awards Ceremony', 'formal', 'awards', 'Awards ceremony suits', FALSE),

-- Party
('https://dunniotailor.com/men/party-suits', '/men/party-suits', 'Party Suits', 'party', 'general', 'Stylish party suits', FALSE),
('https://dunniotailor.com/men/birthday-party', '/men/birthday-party', 'Birthday Party', 'party', 'birthday', 'Birthday celebration suits', FALSE),
('https://dunniotailor.com/men/christmas-party', '/men/christmas-party', 'Christmas Party', 'party', 'christmas', 'Festive Christmas party suits', FALSE),
('https://dunniotailor.com/men/new-year-party', '/men/new-year-party', 'New Year Party', 'party', 'new-year', 'New Year celebration suits', FALSE),

-- Casual
('https://dunniotailor.com/men/smart-casual', '/men/smart-casual', 'Smart Casual', 'casual', 'smart', 'Polished casual style', FALSE),
('https://dunniotailor.com/men/vacation-outfit', '/men/vacation-outfit', 'Vacation Outfit', 'casual', 'vacation', 'Travel and vacation outfits', FALSE),
('https://dunniotailor.com/men/weekend-style', '/men/weekend-style', 'Weekend Style', 'casual', 'weekend', 'Relaxed weekend wear', FALSE),

-- Wedding
('https://dunniotailor.com/men/groom-suit', '/men/groom-suit', 'Groom Suit', 'wedding', 'groom', 'Groom wedding suits', FALSE),
('https://dunniotailor.com/men/wedding-tuxedos', '/men/wedding-tuxedos', 'Wedding Tuxedos', 'wedding', 'tuxedo', 'Wedding day tuxedos', FALSE),
('https://dunniotailor.com/men/groomsmen-suits', '/men/groomsmen-suits', 'Groomsmen Suits', 'wedding', 'groomsmen', 'Groomsmen outfit coordination', FALSE),
('https://dunniotailor.com/men/wedding-guest-suits', '/men/wedding-guest-suits', 'Wedding Guest Suits', 'wedding', 'guest', 'Wedding guest attire', FALSE),
('https://dunniotailor.com/men/linen-wedding-suits', '/men/linen-wedding-suits', 'Linen Wedding Suits', 'wedding', 'linen', 'Summer wedding linen suits', FALSE),
('https://dunniotailor.com/men/wedding-vest', '/men/wedding-vest', 'Wedding Waistcoats', 'wedding', 'waistcoat', 'Wedding waistcoats and vests', FALSE),

-- 3D Demo Pages
('https://dunniotailor.com/3d-custom-outfit/suits.html', '/3d-custom-outfit/suits.html', '3D Customize Suits', '3d-demo', 'suits', 'Interactive 3D suit customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/3piece-suits.html', '/3d-custom-outfit/3piece-suits.html', '3D Customize 3-Piece Suits', '3d-demo', '3piece', 'Interactive 3D 3-piece suit customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/jacket.html', '/3d-custom-outfit/jacket.html', '3D Customize Jacket', '3d-demo', 'jacket', 'Interactive 3D jacket customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/vest.html', '/3d-custom-outfit/vest.html', '3D Customize Vest', '3d-demo', 'vest', 'Interactive 3D vest customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/tuxedo.html', '/3d-custom-outfit/tuxedo.html', '3D Customize Tuxedo', '3d-demo', 'tuxedo', 'Interactive 3D tuxedo customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/tuxedo-shirt.html', '/3d-custom-outfit/tuxedo-shirt.html', '3D Customize Tuxedo Shirt', '3d-demo', 'tuxedo-shirt', 'Interactive 3D tuxedo shirt customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/pant.html', '/3d-custom-outfit/pant.html', '3D Customize Pant', '3d-demo', 'pant', 'Interactive 3D pant customizer', TRUE);
