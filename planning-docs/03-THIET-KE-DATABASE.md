# 📐 Dunnio Behavior Tracker - Thiết kế Database

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0  
> **Loại tài liệu**: Database Design

---

## 1. Tổng quan Database

### 1.1 Database Information

| Property | Value |
|----------|-------|
| Database Name | `dunnio_tracker` |
| Engine | MySQL 8.x |
| Charset | utf8mb4 |
| Collation | utf8mb4_unicode_ci |
| Storage Engine | InnoDB |

### 1.2 Tables Overview

```
┌─────────────────┐     ┌─────────────────┐
│     users       │     │     pages       │
│─────────────────│     │─────────────────│
│ • id (PK)       │     │ • id (PK)       │
│ • username      │     │ • url           │
│ • email         │     │ • url_path      │
│ • password_hash │     │ • title         │
│ • role          │     │ • category      │
│ • is_active     │     │ • subcategory   │
│ • last_login    │     │ • description   │
│ • created_at    │     │ • grid_config   │
└────────┬────────┘     │ • is_3d_demo    │
         │              │ • last_synced   │
         │              └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│              cta_suggestions              │
│─────────────────────────────────────────│
│ • id (PK)                               │
│ • page_id (FK) ──────────────────────► │
│ • grid_col                              │
│ • grid_row                              │
│ • suggestion_type                        │
│ • suggestion_title                       │
│ • suggestion_text                        │
│ • suggestion_code                        │
│ • priority                              │
│ • difficulty                            │
│ • status                                │
│ • created_by (FK) ──────────────────┐  │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  click_events   │     │ clarity_tokens  │
│─────────────────│     │─────────────────│
│ • id (PK)       │     │ • id (PK)       │
│ • page_id (FK) ─┼────▶│ • token_name    │
│ • element_sel  │     │ • jwt_token     │
│ • grid_pos     │     │ • project_id    │
│ • click_count  │     │ • is_active     │
│ • scroll_depth │     │ • expires_at    │
│ • data_date    │     └─────────────────┘
└─────────────────┘

┌─────────────────┐
│  page_metrics   │
│─────────────────│
│ • id (PK)       │
│ • page_id (FK)  │
│ • metric_date   │
│ • pageviews     │
│ • clicks        │
│ • engagement    │
│ • bounce_rate   │
│ • scroll_depth  │
└─────────────────┘

┌─────────────────┐
│  grid_cells     │
│─────────────────│
│ • id (PK)       │
│ • page_id (FK)  │
│ • grid_col      │
│ • grid_row      │
│ • heat_level    │
│ • has_cta       │
│ • has_content   │
└─────────────────┘

┌─────────────────┐
│  sync_logs     │
│─────────────────│
│ • id (PK)       │
│ • sync_type     │
│ • status        │
│ • records_cnt   │
│ • error_msg     │
│ • started_at    │
│ • completed_at  │
└─────────────────┘

┌─────────────────┐
│   sessions      │
│─────────────────│
│ • id (PK)       │
│ • user_id (FK)  │
│ • token_hash    │
│ • ip_address    │
│ • expires_at    │
└─────────────────┘
```

---

## 2. Table Definitions

### 2.1 users

Người dùng hệ thống với vai trò và quyền truy cập.

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'dev', 'editor') NOT NULL DEFAULT 'editor',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE KEY uk_username (username),
    UNIQUE KEY uk_email (email),
    
    -- Indexes
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Sample Data:**
```sql
-- Admin user (password: admin123 - bcrypt hash)
INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@dunnio-tracker.local', '$2b$10$...', 'admin');
```

**Relationships:**
- 1:N with `cta_suggestions` (created_by)
- 1:N with `sessions`

---

### 2.2 pages

Cấu hình các trang được theo dõi trên dunniotailor.com.

```sql
CREATE TABLE pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(500) NOT NULL,
    url_path VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100) NULL,
    description TEXT NULL,
    grid_columns INT NOT NULL DEFAULT 12,
    grid_row_height INT NOT NULL DEFAULT 50,
    grid_max_rows INT NOT NULL DEFAULT 100,
    viewport_width INT NOT NULL DEFAULT 1920,
    viewport_height INT NOT NULL DEFAULT 1080,
    is_3d_demo BOOLEAN NOT NULL DEFAULT FALSE,
    is_tracked BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMP NULL,
    last_data_update TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE KEY uk_url_path (url_path),
    
    -- Indexes
    INDEX idx_category (category),
    INDEX idx_is_3d_demo (is_3d_demo),
    INDEX idx_is_tracked (is_tracked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Sample Data (50 pages):**
```sql
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

-- Business
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

-- 3D Demo (is_3d_demo = TRUE)
('https://dunniotailor.com/3d-custom-outfit/suits.html', '/3d-custom-outfit/suits.html', '3D Customize Suits', '3d-demo', 'suits', 'Interactive 3D suit customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/3piece-suits.html', '/3d-custom-outfit/3piece-suits.html', '3D Customize 3-Piece Suits', '3d-demo', '3piece', 'Interactive 3D 3-piece suit customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/jacket.html', '/3d-custom-outfit/jacket.html', '3D Customize Jacket', '3d-demo', 'jacket', 'Interactive 3D jacket customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/vest.html', '/3d-custom-outfit/vest.html', '3D Customize Vest', '3d-demo', 'vest', 'Interactive 3D vest customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/tuxedo.html', '/3d-custom-outfit/tuxedo.html', '3D Customize Tuxedo', '3d-demo', 'tuxedo', 'Interactive 3D tuxedo customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/tuxedo-shirt.html', '/3d-custom-outfit/tuxedo-shirt.html', '3D Customize Tuxedo Shirt', '3d-demo', 'tuxedo-shirt', 'Interactive 3D tuxedo shirt customizer', TRUE),
('https://dunniotailor.com/3d-custom-outfit/pant.html', '/3d-custom-outfit/pant.html', '3D Customize Pant', '3d-demo', 'pant', 'Interactive 3D pant customizer', TRUE);
```

**Relationships:**
- 1:N with `click_events`
- 1:N with `cta_suggestions`
- 1:N with `page_metrics`
- 1:N with `grid_cells`

---

### 2.3 click_events

Dữ liệu clicks được tổng hợp theo grid cell.

```sql
CREATE TABLE click_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    element_selector VARCHAR(500) NULL,
    element_text VARCHAR(255) NULL,
    element_tag VARCHAR(50) NULL,
    grid_col_start INT NOT NULL,
    grid_col_end INT NOT NULL,
    grid_row_start INT NOT NULL,
    grid_row_end INT NOT NULL,
    click_count INT NOT NULL DEFAULT 0,
    unique_clicks INT NOT NULL DEFAULT 0,
    avg_scroll_depth DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    avg_engagement_time INT NOT NULL DEFAULT 0,
    dead_click_count INT NOT NULL DEFAULT 0,
    rage_click_count INT NOT NULL DEFAULT 0,
    data_date DATE NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_page_date (page_id, data_date),
    INDEX idx_grid_position (grid_col_start, grid_row_start),
    INDEX idx_element (element_selector(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Note:** Grid position được tính dựa trên:
- `grid_col_start/end`: Cột bắt đầu và kết thúc (1-12)
- `grid_row_start/end`: Dòng bắt đầu và kết thúc (1-100)

---

### 2.4 cta_suggestions

Gợi ý CTA được tạo tự động hoặc thủ công.

```sql
CREATE TABLE cta_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    grid_col INT NOT NULL,
    grid_row INT NOT NULL,
    suggestion_type ENUM(
        'cta_button',
        'internal_link',
        'promo_banner',
        'product_feature',
        'form_improvement',
        'content_gap'
    ) NOT NULL,
    suggestion_title VARCHAR(255) NOT NULL,
    suggestion_text TEXT NULL,
    suggestion_code TEXT NULL,
    priority INT NOT NULL DEFAULT 0,
    difficulty ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'medium',
    status ENUM(
        'pending',
        'approved',
        'implemented',
        'rejected',
        'archived'
    ) NOT NULL DEFAULT 'pending',
    impact_score INT NOT NULL DEFAULT 0,
    implemented_at TIMESTAMP NULL,
    created_by INT NULL,
    approved_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_page_status (page_id, status),
    INDEX idx_priority (priority DESC),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Status Workflow:**
```
pending → approved → implemented
   ↓          ↓
rejected   rejected
   ↓
archived
```

---

### 2.5 clarity_tokens

Lưu trữ API tokens của Microsoft Clarity.

```sql
CREATE TABLE clarity_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token_name VARCHAR(100) NOT NULL,
    jwt_token TEXT NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    project_name VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    
    -- Foreign Key
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_is_active (is_active),
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Note:** Chỉ 1 token active tại một thời điểm.

---

### 2.6 page_metrics

Metrics tổng hợp theo ngày cho mỗi trang.

```sql
CREATE TABLE page_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    metric_date DATE NOT NULL,
    total_pageviews INT NOT NULL DEFAULT 0,
    unique_visitors INT NOT NULL DEFAULT 0,
    avg_time_on_page INT NOT NULL DEFAULT 0,
    bounce_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    scroll_depth_25 INT NOT NULL DEFAULT 0,
    scroll_depth_50 INT NOT NULL DEFAULT 0,
    scroll_depth_75 INT NOT NULL DEFAULT 0,
    scroll_depth_100 INT NOT NULL DEFAULT 0,
    total_clicks INT NOT NULL DEFAULT 0,
    avg_clicks_per_session DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    dead_clicks INT NOT NULL DEFAULT 0,
    rage_clicks INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    
    -- Constraints
    UNIQUE KEY uk_page_date (page_id, metric_date),
    
    -- Indexes
    INDEX idx_metric_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.7 grid_cells

Cache dữ liệu grid cell để hiển thị nhanh.

```sql
CREATE TABLE grid_cells (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    grid_col INT NOT NULL,
    grid_row INT NOT NULL,
    pixel_x INT NOT NULL,
    pixel_y INT NOT NULL,
    pixel_width INT NOT NULL,
    pixel_height INT NOT NULL,
    heat_level INT NOT NULL DEFAULT 0,
    click_density DECIMAL(10,4) NOT NULL DEFAULT 0.00,
    has_cta BOOLEAN NOT NULL DEFAULT FALSE,
    has_content BOOLEAN NOT NULL DEFAULT FALSE,
    content_type VARCHAR(100) NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    
    -- Constraints
    UNIQUE KEY uk_page_cell (page_id, grid_col, grid_row),
    
    -- Indexes
    INDEX idx_heat_level (heat_level DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.8 sync_logs

Lịch sử đồng bộ dữ liệu từ Clarity.

```sql
CREATE TABLE sync_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sync_type ENUM('clarity', 'manual', 'scheduled') NOT NULL,
    status ENUM('started', 'in_progress', 'completed', 'failed') NOT NULL DEFAULT 'started',
    records_processed INT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    created_by INT NULL,
    
    -- Foreign Key
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_status (status),
    INDEX idx_started_at (started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.9 sessions

Quản lý sessions của người dùng.

```sql
CREATE TABLE sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. Indexes Summary

| Table | Index | Type | Columns |
|-------|-------|------|---------|
| users | idx_role | B-tree | role |
| users | idx_is_active | B-tree | is_active |
| pages | idx_category | B-tree | category |
| pages | idx_is_3d_demo | B-tree | is_3d_demo |
| pages | idx_is_tracked | B-tree | is_tracked |
| click_events | idx_page_date | B-tree | page_id, data_date |
| click_events | idx_grid_position | B-tree | grid_col_start, grid_row_start |
| cta_suggestions | idx_page_status | B-tree | page_id, status |
| cta_suggestions | idx_priority | B-tree | priority DESC |
| grid_cells | idx_heat_level | B-tree | heat_level DESC |

---

## 4. Foreign Keys

```sql
-- users (referenced)
users.id ← cta_suggestions.created_by
users.id ← cta_suggestions.approved_by
users.id ← sessions.user_id
users.id ← clarity_tokens.created_by
users.id ← sync_logs.created_by

-- pages (referenced)
pages.id ← click_events.page_id
pages.id ← cta_suggestions.page_id
pages.id ← page_metrics.page_id
pages.id ← grid_cells.page_id
```

---

## 5. Data Types Mapping

| MySQL Type | JavaScript/JSON |
|------------|-----------------|
| INT | number |
| VARCHAR | string |
| TEXT | string |
| BOOLEAN | boolean |
| TIMESTAMP | ISO string |
| DATE | ISO date string |
| DECIMAL | number |
| ENUM | string |
| JSON | object (MySQL 5.7+) |

---

## 6. Performance Considerations

### 6.1 Partitioning (Future)

```sql
-- Partition click_events by month for better performance
CREATE TABLE click_events (
    ...
)
PARTITION BY RANGE (YEAR(data_date) * 100 + MONTH(data_date)) (
    PARTITION p202601 VALUES LESS THAN (202602),
    PARTITION p202602 VALUES LESS THAN (202603),
    ...
);
```

### 6.2 Archiving Strategy

```sql
-- Archive old data (>90 days) to separate table
CREATE TABLE click_events_archive LIKE click_events;
ALTER TABLE click_events_archive REMOVE PARTITIONING;

-- Move old records
INSERT INTO click_events_archive 
SELECT * FROM click_events 
WHERE data_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY);

DELETE FROM click_events 
WHERE data_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY);
```

---

## 7. Backup & Recovery

### 7.1 Backup Script

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/dunnio_tracker
mysqldump -u root -p dunnio_tracker > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### 7.2 Recovery

```bash
mysql -u root -p dunnio_tracker < backup_20261007_120000.sql
```

---

*Document ends here*
