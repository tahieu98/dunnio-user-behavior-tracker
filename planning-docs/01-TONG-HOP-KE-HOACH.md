# 📋 Dunnio Behavior Tracker - Tổng hợp Kế hoạch Triển khai

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0  
> **Trạng thái**: Đã phê duyệt & Sẵn sàng triển khai

---

## Mục lục

1. [Tổng quan Dự án](#1-tổng-quan-dự-án)
2. [Bối cảnh & Yêu cầu](#2-bối-cảnh--yêu-cầu)
3. [Phân tích Kỹ thuật](#3-phân-tích-kỹ-thuật)
4. [Kiến trúc Hệ thống](#4-kiến-trúc-hệ-thống)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [Grid System](#7-grid-system)
8. [CTA Suggestion Engine](#8-cta-suggestion-engine)
9. [Microsoft Clarity Integration](#9-microsoft-clarity-integration)
10. [Frontend Dashboard](#10-frontend-dashboard)
11. [Custom Tracker Script](#11-custom-tracker-script)
12. [Danh sách Pages](#12-danh-sách-pages)
13. [Bảo mật & Quyền truy cập](#13-bảo-mật--quyền-truy-cập)
14. [Hạn chế & Giải pháp](#14-hạn-chế--giải-pháp)
15. [Các bước Triển khai](#15-các-bước-triển-khai)
16. [Checklist Triển khai](#16-checklist-triển-khai)

---

## 1. Tổng quan Dự án

### 1.1 Thông tin cơ bản

| Trường | Giá trị |
|--------|---------|
| **Tên dự án** | Dunnio Behavior Tracker |
| **Website mục tiêu** | dunniotailor.com |
| **Mục đích** | Theo dõi & phân tích hành vi người dùng |
| **Người dùng** | Dev Team & Content Editor |
| **Công nghệ** | Node.js + Express + MySQL + Vanilla JS |

### 1.2 Mục tiêu

- ✅ Theo dõi click theo vị trí grid (12 cột)
- ✅ Phát hiện dead zones (vùng không có tương tác)
- ✅ Gợi ý CTA tự động dựa trên phân tích
- ✅ Tích hợp Microsoft Clarity API
- ✅ Dashboard trực quan cho Dev & Editor

---

## 2. Bối cảnh & Yêu cầu

### 2.1 Vấn đề cần giải quyết

Dev và Content Editor của Dunnio Tailor cần:
1. Hiểu người dùng tương tác **ở vị trí nào** trên mỗi trang
2. Phát hiện **dead zones** để bổ sung CTA, internal links, promotions
3. Tối ưu hóa **conversion** trên từng trang sản phẩm/dịch vụ
4. Có công cụ **trực quan** để phân tích không cần code

### 2.2 Yêu cầu đặc thù

| Yêu cầu | Đã xác nhận |
|----------|-------------|
| Dashboard riêng | ✅ |
| Có đăng nhập/phân quyền | ✅ |
| Sử dụng MySQL | ✅ |
| Tính năng đầy đủ (Grid + Heatmap + CTA Engine) | ✅ |
| Kết nối Microsoft API/SDK | ✅ |

### 2.3 Phạm vi (Scope)

**Trong phạm vi:**
- Grid-based visualization
- Heatmap display
- Dead zone detection
- CTA suggestion engine
- Microsoft Clarity integration
- User authentication

**Ngoài phạm vi (Future):**
- Real-time WebSocket updates
- Email notifications
- A/B testing
- Mobile app
- PDF reports

---

## 3. Phân tích Kỹ thuật

### 3.1 Microsoft Clarity - Giới hạn API

| Metric | Hỗ trợ | Chi tiết |
|--------|---------|----------|
| Data Export API | ✅ | Endpoint: `/export-data/api/v1/project-live-insights` |
| Click Counts per Element | ✅ | CSS selectors |
| Scroll Depth | ✅ | Percentage breakdown |
| Engagement Time | ✅ | Per page/section |
| **Raw X/Y Coordinates** | ❌ | **KHÔNG có qua API** |
| Session Replay | ✅ | Chỉ xem trong UI |

**Hạn chế quan trọng**: Clarity API không cung cấp tọa độ pixel chính xác. Giải pháp: Grid-based approach với element selectors.

### 3.2 Giải pháp Kỹ thuật

```
┌─────────────────────────────────────────────────────────────┐
│  Grid-based Approach                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Website Tracker → Custom click tracking                │
│  2. Grid Mapper → Element position → Grid coordinates        │
│  3. Clarity API → Aggregated data + Heatmap                 │
│  4. CTA Engine → Dead zone analysis → Suggestions           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Kiến trúc Hệ thống

### 4.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DUNNIO TAILOR TRACKER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │  dunniotailor   │     │   Dashboard     │                    │
│  │  .com Website   │     │   (Local)       │                    │
│  │                 │     │                 │                    │
│  │ ┌─────────────┐│     │ ┌─────────────┐│                    │
│  │ │ Custom JS   ││────▶│ │ Grid View   ││                    │
│  │ │ Tracker     ││     │ │ Heatmap     ││                    │
│  │ └─────────────┘│     │ │ CTA Panel   ││                    │
│  └────────┬────────┘     │ └─────────────┘│                    │
│           │               └────────┬────────┘                    │
│           │                        │                               │
│           ▼                        ▼                               │
│  ┌────────────────────────────────────────┐                  │
│  │              MySQL Database              │                  │
│  │  users │ pages │ click_events │ cta     │                  │
│  └────────────────────────────────────────┘                  │
│                          │                                        │
│           ┌──────────────┼──────────────┐                        │
│           ▼              ▼              ▼                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
│  │ Clarity    │  │ Grid       │  │ CTA        │                   │
│  │ API        │  │ Mapper     │  │ Engine     │                   │
│  └────────────┘  └────────────┘  └────────────┘                   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Node.js + Express | 18+ |
| Database | MySQL | 8.x |
| ORM | mysql2 | 3.x |
| Auth | JWT + bcrypt | - |
| Frontend | Vanilla JS | ES6+ |
| CSS | Custom CSS | - |
| Charts | Chart.js | 4.x |

### 4.3 Project Structure

```
dunnio-behavior-tracker/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server entry
│   │   ├── config/
│   │   │   └── database.js       # MySQL connection
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT authentication
│   │   │   └── errorHandler.js   # Error handling
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Page.js
│   │   │   ├── ClickEvent.js
│   │   │   └── CtaSuggestion.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── pages.js
│   │   │   ├── cta.js
│   │   │   └── clarity.js
│   │   └── services/
│   │       ├── clarityService.js  # Clarity API
│   │       ├── gridMapper.js     # Grid calculations
│   │       └── ctaEngine.js      # Suggestion logic
│   ├── migrations/
│   │   └── 001_init.sql
│   └── package.json
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── css/
│   │   ├── auth.css
│   │   ├── main.css
│   │   └── grid.css
│   └── js/
│       ├── auth.js
│       └── app.js
│
└── tracker/
    ├── clarity-tracker.js
    └── README.md
```

---

## 5. Database Schema

### 5.1 Tables Overview

```
┌─────────────────┐     ┌─────────────────┐
│     users       │     │     pages       │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ username        │     │ url             │
│ email           │     │ url_path        │
│ password_hash   │     │ title           │
│ role            │     │ category        │
│ is_active       │     │ grid_config     │
└────────┬────────┘     │ is_3d_demo      │
         │              └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ cta_suggestions │     │  click_events   │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ page_id (FK)────┼────▶│ page_id (FK)    │
│ grid_col/row    │     │ grid_col/row    │
│ suggestion_type │     │ click_count    │
│ suggestion_text │     │ scroll_depth   │
│ priority        │     │ data_date      │
│ status          │     └─────────────────┘
│ created_by (FK) │
└─────────────────┘
```

### 5.2 Table Definitions

#### users
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'dev', 'editor') DEFAULT 'editor',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### pages (40+ pages pre-configured)
```sql
CREATE TABLE pages (
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
    is_3d_demo BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### click_events
```sql
CREATE TABLE click_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    element_selector VARCHAR(500),
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
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);
```

#### cta_suggestions
```sql
CREATE TABLE cta_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    grid_col INT NOT NULL,
    grid_row INT NOT NULL,
    suggestion_type ENUM('cta_button', 'internal_link', 'promo_banner', 
                        'product_feature', 'form_improvement', 'content_gap') NOT NULL,
    suggestion_title VARCHAR(255) NOT NULL,
    suggestion_text TEXT,
    suggestion_code TEXT,
    priority INT DEFAULT 0,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    status ENUM('pending', 'approved', 'implemented', 'rejected', 'archived') DEFAULT 'pending',
    created_by INT,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);
```

#### clarity_tokens
```sql
CREATE TABLE clarity_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token_name VARCHAR(100) NOT NULL,
    jwt_token TEXT NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    project_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. API Endpoints

### 6.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/register | Register new user (admin only) |
| GET | /api/auth/me | Get current user |
| GET | /api/auth/users | List users (admin only) |
| PATCH | /api/auth/users/:id | Update user |
| PUT | /api/auth/password | Change password |

### 6.2 Pages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/pages | List all pages |
| GET | /api/pages/categories | Get categories |
| GET | /api/pages/:id | Get page details |
| GET | /api/pages/:id/grid | Get grid cells |
| GET | /api/pages/:id/analytics | Get page analytics |
| POST | /api/pages | Create page |
| PUT | /api/pages/:id | Update page |
| DELETE | /api/pages/:id | Delete page |

### 6.3 CTA Suggestions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/cta | List suggestions |
| GET | /api/cta/pending | Get pending |
| GET | /api/cta/stats | Get statistics |
| GET | /api/cta/generate/:pageId | Auto-generate |
| GET | /api/cta/:id | Get details |
| POST | /api/cta | Create suggestion |
| POST | /api/cta/bulk | Bulk create |
| PATCH | /api/cta/:id | Update |
| PATCH | /api/cta/:id/status | Change status |
| DELETE | /api/cta/:id | Delete |

### 6.4 Clarity Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/clarity/status | Check connection |
| POST | /api/clarity/token | Save API token |
| GET | /api/clarity/insights | Get live insights |
| POST | /api/clarity/sync/:pageId | Sync page data |
| POST | /api/clarity/sync/all | Sync all pages |
| GET | /api/clarity/history | Sync history |
| GET | /api/clarity/suggestions/:pageId | Get suggestions |

---

## 7. Grid System

### 7.1 Grid Configuration

| Parameter | Value |
|-----------|-------|
| Columns | 12 |
| Row Height | 50px |
| Max Rows | 100 (5000px viewport) |

### 7.2 Coordinate System

```
Grid Cell (col, row):
├── col: 1-12 (left → right)
└── row: 1-N (top → bottom)

Pixel calculation:
├── pixel_x = (col - 1) * (viewport_width / 12)
└── pixel_y = (row - 1) * rowHeight
```

### 7.3 Visual Representation

```
┌───────┬───────┬───────┬───────┬───────┬───────┐
│ (1,1) │ (2,1) │ (3,1) │ (4,1) │ (5,1) │ ...   │
├───────┼───────┼───────┼───────┼───────┼───────┤
│ (1,2) │ (2,2) │ (3,2) │ (4,2) │ (5,2) │ ...   │
├───────┼───────┼───────┼───────┼───────┼───────┤
│ (1,3) │ (2,3) │ (3,3) │ (4,3) │ (5,3) │ ...   │
├───────┼───────┼───────┼───────┼───────┼───────┤
│ (1,4) │ (2,4) │ (3,4) │ (4,4) │ (5,4) │ ...   │
└───────┴───────┴───────┴───────┴───────┴───────┘
```

### 7.4 Heat Levels

| Level | Color | Description |
|-------|-------|-------------|
| 0 | #e0f2fe | No clicks (Cold) |
| 1-2 | #bae6fd | Very few clicks |
| 3-4 | #7dd3fc | Some clicks |
| 5-6 | #fef9c3 | Moderate (Warm) |
| 7-8 | #fde047 | Many clicks |
| 9-10 | #f87171 | Hot zone |

---

## 8. CTA Suggestion Engine

### 8.1 Suggestion Types

| Type | Trigger | Example |
|------|---------|---------|
| `cta_button` | Dead zone > 2 cells | "Add Book Now button here" |
| `internal_link` | Low link density | "Add related product link" |
| `promo_banner` | High traffic, no promo | "Add seasonal promotion" |
| `product_feature` | Product page, no features | "Add fabric quality highlight" |
| `form_improvement` | Form without CTA | "Improve form CTA" |
| `content_gap` | Missing content | "Add size guide section" |

### 8.2 Priority Calculation

```javascript
priority = base_score + traffic_factor + position_factor

where:
- base_score = 10 (default)
- traffic_factor = (daily_views / 100) * 5
- position_factor = (12 - row) * 2  // Higher rows = lower priority
```

### 8.3 Category Context

| Category | Suggestions | CTA Text |
|----------|-------------|----------|
| suits | Book appointment, View fabrics | Get Your Perfect Suit |
| shirts | Design your shirt | Create Your Custom Shirt |
| wedding | Wedding packages, Groom consultation | Plan Your Wedding Look |
| 3d-demo | Start designing, Try now | Design Your Own |
| tuxedo | Event look, Style guide | Look Your Best |

### 8.4 Status Workflow

```
pending → approved → implemented
   ↓          ↓
rejected   rejected
   ↓
archived
```

---

## 9. Microsoft Clarity Integration

### 9.1 API Details

| Item | Value |
|------|-------|
| Base URL | https://www.clarity.ms |
| Endpoint | /export-data/api/v1/project-live-insights |
| Auth | JWT Bearer Token |
| Rate Limit | 10 requests/day |
| Data Range | 1-3 days |

### 9.2 Data Mapping Strategy

Since Clarity doesn't provide raw coordinates:

1. **Element Selectors** → Map to grid position based on selector patterns
2. **Click Counts** → Determine heat levels
3. **Custom Tracker** → Supplement with precise coordinate data

### 9.3 Token Management

```sql
-- Store tokens securely
INSERT INTO clarity_tokens (token_name, jwt_token, project_id, project_name)
VALUES ('Production', 'eyJhbGc...', 'abc123', 'Dunnio Production');
```

---

## 10. Frontend Dashboard

### 10.1 Pages

| Page | Purpose |
|------|---------|
| login.html | Authentication |
| dashboard.html | Main dashboard with all features |

### 10.2 Dashboard Sections

1. **Stats Cards**: Total pages, clicks, suggestions, implemented
2. **Recent Suggestions**: Latest CTA recommendations
3. **Top Hotspots**: Most clicked areas
4. **Pages Grid**: Browse and select pages
5. **Grid Visualizer**: Interactive grid with heatmap
6. **CTA Suggestions**: Manage suggestions workflow
7. **Settings**: Configure Clarity, manage users

### 10.3 Color Scheme

| Element | Color |
|---------|-------|
| Primary | #2563eb |
| Success | #10b981 |
| Danger | #ef4444 |
| Warning | #f59e0b |
| Background | #f8fafc |
| Text | #1e293b |

---

## 11. Custom Tracker Script

### 11.1 Features

- Click tracking with grid mapping
- Scroll depth monitoring
- Form interaction tracking
- Session management
- Clarity integration option
- Privacy-friendly (no PII)

### 11.2 Installation

```html
<script>
    var TRACKER_CONFIG = {
        apiEndpoint: 'http://localhost:3000/api',
        enabled: true,
        sampleRate: 1
    };
</script>
<script src="/path/to/clarity-tracker.js"></script>
```

### 11.3 Data Collected

```javascript
{
    type: 'click',
    pageId: '/men/custom-suits',
    data: {
        elementTag: 'button',
        elementClass: 'btn-primary',
        gridCol: 5,
        gridRow: 8,
        scrollDepth: 25
    }
}
```

---

## 12. Danh sách Pages

### 12.1 Suits (6 pages)
| Title | URL |
|-------|-----|
| Custom Suits | /men/custom-suits |
| Custom 3-Piece Suits | /men/3-pieces-suit |
| Wool Suits | /men/wool-suits |
| Linen Suits | /men/linen-suits |
| Cotton Suits | /men/cotton-suits |
| Tweed Suits | /men/tweed-suits |

### 12.2 Shirts (5 pages)
| Title | URL |
|-------|-----|
| Custom Dress Shirts | /men/custom-dress-shirts |
| Cotton Shirts | /men/cotton-shirts |
| Linen Shirts | /men/linen-shirts |
| Twill Shirts | /men/twill-shirts |
| Stretch Shirts | /men/stretch-shirts |

### 12.3 Pants (5 pages)
| Title | URL |
|-------|-----|
| Custom Pants | /men/custom-pants |
| Custom Dress Pants | /men/custom-dress-pants |
| Wool Pants | /men/wool-pants |
| Linen Pants | /men/linen-pants |
| Stretch Pants | /men/stretch-pants |

### 12.4 Tuxedo (5 pages)
| Title | URL |
|-------|-----|
| Custom Tuxedo | /men/custom-tuxedo |
| Wool Tuxedos | /men/wool-tuxedos |
| Velvet Tuxedos | /men/velvet-tuxedos |
| Stretch Tuxedos | /men/stretch-tuxedos |
| Silk Blend Tuxedos | /men/silk-blend-tuxedos |

### 12.5 Business & Formal (9 pages)
| Title | URL |
|-------|-----|
| Business Suits | /men/business-suits |
| Interview Suits | /men/interview-suits |
| Business Blazers | /men/business-blazers |
| Formal Suits | /men/formal-suits |
| Black Tie Tuxedos | /men/black-tie-tuxedos |
| Gala Dinner | /men/gala-dinner |
| Awards Ceremony | /men/awards-ceremony |

### 12.6 Party (4 pages)
| Title | URL |
|-------|-----|
| Party Suits | /men/party-suits |
| Birthday Party | /men/birthday-party |
| Christmas Party | /men/christmas-party |
| New Year Party | /men/new-year-party |

### 12.7 Casual (3 pages)
| Title | URL |
|-------|-----|
| Smart Casual | /men/smart-casual |
| Vacation Outfit | /men/vacation-outfit |
| Weekend Style | /men/weekend-style |

### 12.8 Wedding (6 pages)
| Title | URL |
|-------|-----|
| Groom Suit | /men/groom-suit |
| Wedding Tuxedos | /men/wedding-tuxedos |
| Groomsmen Suits | /men/groomsmen-suits |
| Wedding Guest Suits | /men/wedding-guest-suits |
| Linen Wedding Suits | /men/linen-wedding-suits |
| Wedding Waistcoats | /men/wedding-vest |

### 12.9 3D Demo (7 pages)
| Title | URL |
|-------|-----|
| Customize Suits | /3d-custom-outfit/suits.html |
| Customize 3-Piece Suits | /3d-custom-outfit/3piece-suits.html |
| Customize Jacket | /3d-custom-outfit/jacket.html |
| Customize Vest | /3d-custom-outfit/vest.html |
| Customize Tuxedo | /3d-custom-outfit/tuxedo.html |
| Customize Tuxedo Shirt | /3d-custom-outfit/tuxedo-shirt.html |
| Customize Pant | /3d-custom-outfit/pant.html |

**Tổng cộng: 50 pages**

---

## 13. Bảo mật & Quyền truy cập

### 13.1 User Roles

| Role | View Data | Create CTA | Approve CTA | Manage Users | Configure Clarity |
|------|-----------|------------|-------------|--------------|-------------------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| dev | ✅ | ✅ | ❌ | ❌ | ✅ |
| editor | ✅ | ✅ | ❌ | ❌ | ❌ |

### 13.2 Authentication

- JWT tokens với 24h expiration
- Password hashing với bcrypt (cost factor 10)
- Token stored in localStorage

### 13.3 Security Measures

- Role-based middleware on protected routes
- User can only edit own suggestions (unless admin)
- Secrets in environment variables
- No PII collected

---

## 14. Hạn chế & Giải pháp

### 14.1 Known Limitations

| Limitation | Impact | Solution |
|------------|--------|----------|
| No raw X/Y coordinates from Clarity | Can't show exact pixel positions | Grid-based approximation |
| 10 API requests/day limit | Limited real-time sync | Redis caching + scheduled sync |
| CORS issues | API calls blocked | Backend proxy |
| Session-based tracking | No persistent user tracking | Anonymous tracking only |

### 14.2 Workarounds

1. **Custom Tracker** supplements Clarity data with precise coordinates
2. **Caching** reduces API calls
3. **Backend proxy** handles CORS

---

## 15. Các bước Triển khai

### Phase 1: Setup & Infrastructure (2-3h)

- [ ] 1.1 Install dependencies (`npm install`)
- [ ] 1.2 Configure `.env` file
- [ ] 1.3 Create MySQL database
- [ ] 1.4 Run migrations
- [ ] 1.5 Create admin user
- [ ] 1.6 Test database connection

### Phase 2: Backend Development (4-5h)

- [ ] 2.1 Verify auth endpoints
- [ ] 2.2 Test pages CRUD
- [ ] 2.3 Test CTA endpoints
- [ ] 2.4 Configure Clarity integration
- [ ] 2.5 Test data sync

### Phase 3: Frontend Development (6-8h)

- [ ] 3.1 Test login flow
- [ ] 3.2 Verify dashboard loads
- [ ] 3.3 Test page selector
- [ ] 3.4 Implement grid visualizer
- [ ] 3.5 Build heatmap view
- [ ] 3.6 Create CTA panel

### Phase 4: Tracker Integration (3-4h)

- [ ] 4.1 Add tracker to dunniotailor.com
- [ ] 4.2 Test click tracking
- [ ] 4.3 Verify grid mapping
- [ ] 4.4 Test scroll tracking

### Phase 5: Testing & Deployment (2-3h)

- [ ] 5.1 Unit tests
- [ ] 5.2 Integration tests
- [ ] 5.3 Cross-browser testing
- [ ] 5.4 Documentation
- [ ] 5.5 Deploy to production

**Total Estimated: 17-23 hours**

---

## 16. Checklist Triển khai

### 16.1 Pre-Deployment

```
□ Node.js 18+ installed
□ MySQL 8+ installed and running
□ Git repository initialized
□ .env configured
□ Database created
□ Migrations run
□ Admin user created
```

### 16.2 Configuration

```
□ JWT_SECRET changed (not default)
□ DB credentials verified
□ Clarity API token obtained
□ CORS origins configured
□ PORT configured (3000)
```

### 16.3 Testing Checklist

```
□ Login works
□ Dashboard loads
□ Pages list displays
□ Grid visualizer works
□ Heatmap renders
□ CTA suggestions generate
□ Status workflow functions
□ Export works
□ Clarity sync works
```

### 16.4 Production Checklist

```
□ HTTPS enabled
□ JWT_SECRET changed
□ Error logging configured
□ Rate limiting enabled
□ Database backups scheduled
□ Monitoring set up
□ SSL certificate installed
```

---

## 📎 Related Documents

- [SPEC.md](../SPEC.md) - Technical specifications
- [README.md](../README.md) - Usage guide
- [PLAN.md](../PLAN.md) - Original planning document
- [backend/migrations/001_init.sql](../backend/migrations/001_init.sql) - Database schema
- [tracker/README.md](../tracker/README.md) - Tracker installation guide

---

## 👥 Contact & Support

For technical questions about this project, refer to:
- Technical Lead
- Project Documentation
- Git Repository Issues

---

*Document generated: 07/10/2026*  
*Project: Dunnio Behavior Tracker v1.0.0*
