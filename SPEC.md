> v1.1: Xem planning-docs/08-TRIEN-KHAI-HEATMAP-THEO-THANG.md cho hành vi đã triển khai. Spec dưới đây là kế hoạch v1.0, không phải trạng thái kiểm thử hay triển khai hiện tại.

# Dunnio Behavior Tracker - Technical Specification

## Version: 1.0.0

---

## 1. Overview

**Project Name**: Dunnio Behavior Tracker  
**Type**: Web Analytics Dashboard + Behavior Tracking System  
**Target Website**: dunniotailor.com  
**Target Users**: Dev team and Content Editors

### 1.1 Purpose

A comprehensive tool to track and analyze user behavior on dunniotailor.com using Microsoft Clarity data, providing actionable insights for improving conversion through grid-based visualization and CTA suggestions.

### 1.2 Key Features

- [x] User authentication with role-based access
- [x] Microsoft Clarity API integration
- [x] Grid-based click tracking visualization
- [x] Heatmap display by grid cells
- [x] Dead zone detection
- [x] AI-powered CTA suggestion engine
- [x] Custom website tracker script
- [x] Export capabilities (CSV)

---

## 2. Technical Architecture

### 2.1 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Node.js | 18+ |
| API Framework | Express.js | 4.x |
| Database | MySQL | 8.x |
| ORM | mysql2 | 3.x |
| Authentication | JWT + bcrypt | - |
| Frontend | Vanilla JS (ES6+) | - |
| Charts | Chart.js | 4.x |
| CSS | Custom CSS | - |

### 2.2 Project Structure

```
dunnio-behavior-tracker/
├── backend/
│   ├── src/
│   │   ├── index.js           # Express server entry
│   │   ├── config/
│   │   │   └── database.js    # MySQL connection pool
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT authentication
│   │   │   └── errorHandler.js # Error handling
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Page.js
│   │   │   ├── ClickEvent.js
│   │   │   └── CtaSuggestion.js
│   │   ├── routes/
│   │   │   ├── auth.js        # /api/auth/*
│   │   │   ├── pages.js       # /api/pages/*
│   │   │   ├── cta.js         # /api/cta/*
│   │   │   └── clarity.js     # /api/clarity/*
│   │   └── services/
│   │       ├── clarityService.js # Clarity API integration
│   │       ├── gridMapper.js     # Grid coordinate mapper
│   │       └── ctaEngine.js      # CTA suggestion logic
│   ├── migrations/
│   │   └── 001_init.sql
│   └── package.json
│
├── frontend/
│   ├── index.html            # Redirect to login
│   ├── login.html            # Login page
│   ├── dashboard.html        # Main dashboard
│   ├── css/
│   │   ├── auth.css
│   │   ├── main.css
│   │   └── grid.css
│   └── js/
│       ├── auth.js
│       └── app.js
│
└── tracker/
    ├── clarity-tracker.js     # Website tracker
    └── README.md
```

---

## 3. Database Schema

### 3.1 Tables

#### users
```sql
id INT PRIMARY KEY
username VARCHAR(50) UNIQUE
email VARCHAR(100) UNIQUE
password_hash VARCHAR(255)
role ENUM('admin', 'dev', 'editor')
is_active BOOLEAN
last_login TIMESTAMP
created_at TIMESTAMP
```

#### pages
```sql
id INT PRIMARY KEY
url VARCHAR(500)
url_path VARCHAR(255) UNIQUE
title VARCHAR(255)
category VARCHAR(100)
subcategory VARCHAR(100)
description TEXT
grid_columns INT DEFAULT 12
grid_row_height INT DEFAULT 50
grid_max_rows INT DEFAULT 100
is_3d_demo BOOLEAN
last_synced_at TIMESTAMP
created_at TIMESTAMP
```

#### click_events
```sql
id INT PRIMARY KEY
page_id INT FK -> pages.id
element_selector VARCHAR(500)
grid_col_start INT
grid_col_end INT
grid_row_start INT
grid_row_end INT
click_count INT
unique_clicks INT
avg_scroll_depth DECIMAL(5,2)
avg_engagement_time INT
dead_click_count INT
rage_click_count INT
data_date DATE
```

#### cta_suggestions
```sql
id INT PRIMARY KEY
page_id INT FK -> pages.id
grid_col INT
grid_row INT
suggestion_type ENUM('cta_button', 'internal_link', 'promo_banner', 'product_feature', 'form_improvement', 'content_gap')
suggestion_title VARCHAR(255)
suggestion_text TEXT
suggestion_code TEXT
priority INT DEFAULT 0
difficulty ENUM('easy', 'medium', 'hard')
status ENUM('pending', 'approved', 'implemented', 'rejected', 'archived')
created_by INT FK -> users.id
created_at TIMESTAMP
```

#### clarity_tokens
```sql
id INT PRIMARY KEY
token_name VARCHAR(100)
jwt_token TEXT
project_id VARCHAR(100)
project_name VARCHAR(255)
is_active BOOLEAN
expires_at TIMESTAMP
created_at TIMESTAMP
```

### 3.2 Indexes

- `pages`: INDEX on (category), INDEX on (url_path)
- `click_events`: INDEX on (page_id, data_date), INDEX on (grid_col_start, grid_row_start)
- `cta_suggestions`: INDEX on (page_id, status), INDEX on (priority DESC)
- `users`: INDEX on (username), INDEX on (email)

---

## 4. API Specification

### 4.1 Authentication Endpoints

#### POST /api/auth/login
**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  }
}
```

#### GET /api/auth/me
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### 4.2 Pages Endpoints

#### GET /api/pages
**Query params:** `category`, `is_tracked`, `is_3d_demo`, `search`, `limit`, `offset`

#### GET /api/pages/:id/analytics
**Query params:** `days` (default: 7)  
**Response:**
```json
{
  "success": true,
  "data": {
    "page": { /* page details */ },
    "hotspots": [
      {
        "grid_col_start": 5,
        "grid_row_start": 8,
        "total_clicks": 150,
        "element_selector": ".btn-primary"
      }
    ],
    "deadZones": [
      { "grid_col": 3, "grid_row": 15 }
    ],
    "summary": {
      "hotspotsCount": 10,
      "deadZonesCount": 50
    }
  }
}
```

### 4.3 CTA Endpoints

#### GET /api/cta/generate/:pageId
Generates automatic suggestions based on dead zones.

#### PATCH /api/cta/:id/status
Update suggestion status.

### 4.4 Clarity Endpoints

#### POST /api/clarity/token
Save Clarity API token.

#### POST /api/clarity/sync/:pageId
Sync data from Clarity for a specific page.

---

## 5. Grid System Specification

### 5.1 Grid Configuration
- **Columns**: 12 (standard CSS grid)
- **Row Height**: 50px
- **Max Rows**: 100 (5000px viewport)

### 5.2 Coordinate System
```
Position (col, row):
- col: 1 to 12 (left to right)
- row: 1 to N (top to bottom)

Pixel calculation:
- pixel_x = (col - 1) * (viewport_width / 12)
- pixel_y = (row - 1) * 50
```

### 5.3 Heat Levels
| Level | Color | Description |
|-------|-------|-------------|
| 0 | #e0f2fe (light blue) | No clicks |
| 1-2 | #bae6fd | Very few clicks |
| 3-4 | #7dd3fc | Some clicks |
| 5-6 | #fef9c3 | Moderate clicks |
| 7-8 | #fde047 | Many clicks |
| 9-10 | #f87171 | Hot zone |

---

## 6. CTA Suggestion Engine

### 6.1 Suggestion Types
| Type | Trigger | Suggested Code |
|------|---------|----------------|
| cta_button | Dead zone | `<a href="#" class="btn">CTA</a>` |
| internal_link | Low link density | `<a href="/product">Link</a>` |
| promo_banner | High traffic page | `<div class="promo">...</div>` |
| product_feature | Product page | `<div class="feature">...</div>` |

### 6.2 Priority Calculation
```
priority = base_score + traffic_factor + position_factor

where:
- base_score = 10
- traffic_factor = (daily_views / 100) * 5
- position_factor = (12 - row) * 2  (higher rows = lower priority)
```

### 6.3 Context-Aware Suggestions
Suggestions adapt based on page category:
- **Wedding**: Focus on seasonal promotions
- **3D Demo**: Highlight customization features
- **Suits/Tuxedo**: Emphasize booking appointments
- **Shirts/Pants**: Quick order CTAs

---

## 7. Microsoft Clarity Integration

### 7.1 API Capabilities
| Feature | Supported |
|---------|----------|
| Data Export API | ✅ Yes |
| Click counts per element | ✅ Yes |
| Scroll depth | ✅ Yes |
| Engagement time | ✅ Yes |
| Raw X/Y coordinates | ❌ No (aggregated only) |

### 7.2 Rate Limits
- 10 requests per project per day
- Data limited to 1-3 days

### 7.3 Data Mapping
Since Clarity doesn't provide raw coordinates, the system:
1. Estimates grid position from element selectors
2. Uses click counts to determine heat levels
3. Combines with custom tracker for precise data

---

## 8. User Roles & Permissions

| Role | View Data | Create Suggestions | Approve | Manage Users | Configure Clarity |
|------|-----------|-------------------|---------|--------------|-------------------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| dev | ✅ | ✅ | ❌ | ❌ | ✅ |
| editor | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 9. Security

### 9.1 Authentication
- JWT tokens with 24-hour expiration
- Password hashing with bcrypt (cost factor 10)
- Token stored in localStorage (consider httpOnly cookies in production)

### 9.2 Authorization
- Role-based middleware on protected routes
- User can only edit own suggestions (unless admin)

### 9.3 Data Protection
- No PII collected by tracker
- Session IDs are random (not cookie-based)
- Secrets stored in environment variables

---

## 10. Deployment Notes

### 10.1 Development
```bash
cd backend
npm install
cp .env.example .env
# Configure MySQL credentials
npm start
```

### 10.2 Production Checklist
- [ ] Change JWT_SECRET
- [ ] Enable HTTPS
- [ ] Configure CORS for production domain
- [ ] Set up proper logging
- [ ] Configure rate limiting
- [ ] Set up monitoring/alerting
- [ ] Regular database backups
- [ ] SSL certificate

---

## 11. Future Enhancements

### 11.1 Planned Features
- Real-time WebSocket updates
- Email notifications for new suggestions
- A/B testing integration
- Mobile dashboard app
- PDF report generation
- Google Analytics integration
- Custom goal tracking

### 11.2 Potential Improvements
- Machine learning for recommendation accuracy
- Cohort analysis
- Funnel visualization
- Session replay links (using Clarity data)
- Automated CTA implementation (direct code injection)

---

## 12. Support & Documentation

- **README.md**: General usage guide
- **tracker/README.md**: Website tracker installation
- **Dashboard UI**: Inline help tooltips

---

*Last updated: 2024*

