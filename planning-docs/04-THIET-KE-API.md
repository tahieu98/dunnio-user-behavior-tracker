# 🖥️ Dunnio Behavior Tracker - Thiết kế API

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0  
> **Loại tài liệu**: API Specification

---

## 1. Tổng quan API

### 1.1 Base URL

```
Development: http://localhost:3000/api
Production:  https://api.dunnio-tracker.com/api
```

### 1.2 Authentication

Tất cả endpoints (trừ `/auth/login`) yêu cầu JWT token trong header:

```
Authorization: Bearer <token>
```

### 1.3 Response Format

**Success Response:**
```json
{
    "success": true,
    "data": { ... },
    "message": "Optional message"
}
```

**Error Response:**
```json
{
    "success": false,
    "message": "Error description",
    "errors": [
        { "field": "email", "message": "Invalid email format" }
    ]
}
```

### 1.4 HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

---

## 2. Authentication API

### 2.1 POST /api/auth/login

Đăng nhập người dùng.

**Request:**
```json
{
    "username": "admin",
    "password": "admin123"
}
```

**Response (200):**
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": 1,
            "username": "admin",
            "email": "admin@example.com",
            "role": "admin"
        }
    }
}
```

**Error (401):**
```json
{
    "success": false,
    "message": "Invalid username or password"
}
```

---

### 2.2 POST /api/auth/register

Đăng ký người dùng mới (Admin only).

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request:**
```json
{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepassword123",
    "role": "editor"
}
```

**Response (201):**
```json
{
    "success": true,
    "message": "User created successfully",
    "data": {
        "id": 5,
        "username": "john_doe",
        "email": "john@example.com",
        "role": "editor"
    }
}
```

---

### 2.3 GET /api/auth/me

Lấy thông tin người dùng hiện tại.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "role": "admin",
        "last_login": "2026-10-07T10:30:00Z",
        "created_at": "2026-10-01T00:00:00Z"
    }
}
```

---

### 2.4 GET /api/auth/users

Lấy danh sách người dùng (Admin/Dev only).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| role | string | - | Filter by role |
| is_active | boolean | - | Filter by active status |
| limit | integer | 50 | Max results |
| offset | integer | 0 | Pagination offset |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "users": [
            { "id": 1, "username": "admin", "role": "admin", "is_active": true },
            { "id": 2, "username": "dev1", "role": "dev", "is_active": true },
            { "id": 3, "username": "editor1", "role": "editor", "is_active": true }
        ],
        "total": 3,
        "limit": 50,
        "offset": 0
    }
}
```

---

### 2.5 PATCH /api/auth/users/:id

Cập nhật người dùng (Admin only).

**Request:**
```json
{
    "role": "dev",
    "is_active": false
}
```

---

### 2.6 PUT /api/auth/password

Đổi password của người dùng hiện tại.

**Request:**
```json
{
    "currentPassword": "oldpass123",
    "newPassword": "newpass456"
}
```

---

## 3. Pages API

### 3.1 GET /api/pages

Lấy danh sách tất cả pages.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| category | string | - | Filter by category |
| subcategory | string | - | Filter by subcategory |
| is_tracked | boolean | true | Only tracked pages |
| is_3d_demo | boolean | - | 3D demo pages only |
| search | string | - | Search in title/URL |
| limit | integer | 50 | Max results |
| offset | integer | 0 | Pagination |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "pages": [
            {
                "id": 1,
                "url": "https://dunniotailor.com/men/custom-suits",
                "url_path": "/men/custom-suits",
                "title": "Custom Suits",
                "category": "suits",
                "subcategory": "custom",
                "description": "Premium custom-tailored suits for men",
                "is_3d_demo": false,
                "last_synced_at": "2026-10-07T08:00:00Z"
            }
        ],
        "total": 50,
        "limit": 50,
        "offset": 0
    }
}
```

---

### 3.2 GET /api/pages/categories

Lấy danh sách categories.

**Response (200):**
```json
{
    "success": true,
    "data": [
        { "category": "suits", "count": 6 },
        { "category": "shirts", "count": 5 },
        { "category": "pants", "count": 5 },
        { "category": "tuxedo", "count": 5 },
        { "category": "business", "count": 3 },
        { "category": "formal", "count": 4 },
        { "category": "party", "count": 4 },
        { "category": "casual", "count": 3 },
        { "category": "wedding", "count": 6 },
        { "category": "3d-demo", "count": 7 }
    ]
}
```

---

### 3.3 GET /api/pages/:id

Lấy chi tiết một page.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "url": "https://dunniotailor.com/men/custom-suits",
        "url_path": "/men/custom-suits",
        "title": "Custom Suits",
        "category": "suits",
        "subcategory": "custom",
        "description": "Premium custom-tailored suits for men",
        "grid_columns": 12,
        "grid_row_height": 50,
        "grid_max_rows": 100,
        "is_3d_demo": false,
        "is_tracked": true,
        "last_synced_at": "2026-10-07T08:00:00Z",
        "created_at": "2026-09-01T00:00:00Z"
    }
}
```

---

### 3.4 GET /api/pages/:id/grid

Lấy dữ liệu grid cells cho visualization.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days | integer | 7 | Time range |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "page": { ... },
        "gridCells": [
            {
                "grid_col": 1,
                "grid_row": 1,
                "pixel_x": 0,
                "pixel_y": 0,
                "pixel_width": 160,
                "pixel_height": 50,
                "heat_level": 0,
                "click_density": 0,
                "has_cta": false
            }
        ],
        "config": {
            "columns": 12,
            "rowHeight": 50,
            "maxRows": 100
        }
    }
}
```

---

### 3.5 GET /api/pages/:id/analytics

Lấy analytics data cho một page.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "page": { ... },
        "summary": {
            "hotspotsCount": 15,
            "deadZonesCount": 85,
            "totalDataPoints": 1200
        },
        "hotspots": [
            {
                "grid_col_start": 5,
                "grid_row_start": 8,
                "grid_col_end": 8,
                "grid_row_end": 10,
                "element_selector": ".btn-primary",
                "total_clicks": 245,
                "avg_scroll": 65.5
            }
        ],
        "deadZones": [
            { "grid_col": 3, "grid_row": 15 },
            { "grid_col": 4, "grid_row": 15 }
        ],
        "clickData": [ ... ],
        "config": {
            "columns": 12,
            "rowHeight": 50
        }
    }
}
```

---

### 3.6 POST /api/pages

Tạo page mới (Admin/Dev only).

**Request:**
```json
{
    "url": "https://dunniotailor.com/men/new-category",
    "title": "New Category",
    "category": "new",
    "subcategory": "sub",
    "description": "Description here"
}
```

---

### 3.7 PUT /api/pages/:id

Cập nhật page.

---

### 3.8 DELETE /api/pages/:id

Xóa page (Admin only).

---

## 4. CTA Suggestions API

### 4.1 GET /api/cta

Lấy danh sách suggestions.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string | - | Filter by status |
| suggestion_type | string | - | Filter by type |
| page_id | integer | - | Filter by page |
| priority_min | integer | - | Min priority |
| limit | integer | 50 | Max results |
| offset | integer | 0 | Pagination |

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "page_id": 1,
            "page_title": "Custom Suits",
            "grid_col": 5,
            "grid_row": 15,
            "suggestion_type": "cta_button",
            "suggestion_title": "Add Book Now button",
            "suggestion_text": "Consider adding a CTA button here",
            "suggestion_code": "<a href='/book' class='btn'>Book Now</a>",
            "priority": 8,
            "difficulty": "easy",
            "status": "pending",
            "created_by_name": "admin",
            "created_at": "2026-10-07T10:00:00Z"
        }
    ]
}
```

---

### 4.2 GET /api/cta/pending

Lấy suggestions đang chờ.

**Response (200):**
```json
{
    "success": true,
    "data": [ ... ]
}
```

---

### 4.3 GET /api/cta/stats

Lấy thống kê suggestions.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "total": 45,
        "pending": 20,
        "approved": 15,
        "implemented": 8,
        "rejected": 2
    }
}
```

---

### 4.4 GET /api/cta/generate/:pageId

Tự động generate suggestions cho một page.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "page": { ... },
        "deadZonesCount": 50,
        "suggestions": [
            {
                "suggestion_type": "cta_button",
                "suggestion_title": "Add Call-to-Action Button",
                "suggestion_text": "Add Book Now button at row 15",
                "suggestion_code": "<a href='/contact' class='btn btn-primary'>Book Appointment</a>",
                "priority": 7,
                "difficulty": "easy",
                "grid_col": 3,
                "grid_row": 15,
                "estimated_time": "15 minutes"
            }
        ],
        "summary": {
            "total": 15,
            "byType": {
                "cta_button": 8,
                "internal_link": 4,
                "promo_banner": 3
            },
            "byPriority": {
                "high": 5,
                "medium": 7,
                "low": 3
            },
            "estimated_effort": "3 hours"
        }
    }
}
```

---

### 4.5 GET /api/cta/:id

Lấy chi tiết một suggestion.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "page_id": 1,
        "page_title": "Custom Suits",
        "url_path": "/men/custom-suits",
        "grid_col": 5,
        "grid_row": 15,
        "suggestion_type": "cta_button",
        "suggestion_title": "Add Book Now button",
        "suggestion_text": "Consider adding a CTA button here",
        "suggestion_code": "<a href='/book' class='btn'>Book Now</a>",
        "priority": 8,
        "difficulty": "easy",
        "status": "pending",
        "impact_score": 75,
        "created_by": 1,
        "created_by_name": "admin",
        "created_at": "2026-10-07T10:00:00Z"
    }
}
```

---

### 4.6 POST /api/cta

Tạo suggestion mới.

**Request:**
```json
{
    "page_id": 1,
    "grid_col": 5,
    "grid_row": 15,
    "suggestion_type": "cta_button",
    "suggestion_title": "Add Book Now button",
    "suggestion_text": "This is a great place for a CTA",
    "suggestion_code": "<a href='/book' class='btn'>Book Now</a>",
    "priority": 8,
    "difficulty": "easy"
}
```

**Response (201):**
```json
{
    "success": true,
    "message": "Suggestion created successfully",
    "data": {
        "id": 10,
        "page_id": 1,
        "grid_col": 5,
        "grid_row": 15,
        ...
    }
}
```

---

### 4.7 POST /api/cta/bulk

Tạo nhiều suggestions cùng lúc (Admin/Dev only).

**Request:**
```json
{
    "suggestions": [
        { "page_id": 1, "grid_col": 3, "grid_row": 10, ... },
        { "page_id": 1, "grid_col": 5, "grid_row": 12, ... }
    ]
}
```

---

### 4.8 PATCH /api/cta/:id

Cập nhật suggestion.

---

### 4.9 PATCH /api/cta/:id/status

Cập nhật status của suggestion.

**Request:**
```json
{
    "status": "approved"
}
```

**Response (200):**
```json
{
    "success": true,
    "message": "Suggestion approved",
    "data": {
        "id": 1,
        "status": "approved",
        ...
    }
}
```

**Valid Status Transitions:**
```
pending → approved
pending → rejected
approved → implemented
approved → rejected
rejected → archived
```

---

### 4.10 DELETE /api/cta/:id

Xóa suggestion.

---

## 5. Clarity Integration API

### 5.1 GET /api/clarity/status

Kiểm tra trạng thái kết nối Clarity.

**Response (200) - Connected:**
```json
{
    "success": true,
    "data": {
        "configured": true,
        "projectId": "abc123xyz",
        "projectName": "Dunnio Production",
        "expiresAt": "2027-01-01T00:00:00Z",
        "lastUsed": "2026-10-07T10:00:00Z"
    }
}
```

**Response (200) - Not Configured:**
```json
{
    "success": true,
    "data": {
        "configured": false,
        "message": "No active Clarity token found"
    }
}
```

---

### 5.2 POST /api/clarity/token

Lưu Clarity API token (Admin only).

**Request:**
```json
{
    "token_name": "Production",
    "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "project_id": "abc123xyz",
    "project_name": "Dunnio Production",
    "expires_at": "2027-01-01"
}
```

---

### 5.3 GET /api/clarity/insights

Lấy live insights từ Clarity.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| numOfDays | integer | 2 | Days of data (1-3) |
| dimension1 | string | - | First dimension |
| dimension2 | string | - | Second dimension |
| dimension3 | string | - | Third dimension |

**Available Dimensions:**
- Browser
- Device
- Country
- OS
- Source
- Medium
- Campaign
- Channel
- URL

**Response (200):**
```json
{
    "success": true,
    "data": {
        "insights": [
            {
                "url": "/men/custom-suits",
                "pageTitle": "Custom Suits",
                "pageviews": 1250,
                "clicks": 342,
                "scrollDepth": 65,
                "engagementTime": 180
            }
        ],
        "projectId": "abc123xyz",
        "fetchedAt": "2026-10-07T10:30:00Z"
    }
}
```

---

### 5.4 POST /api/clarity/sync/:pageId

Đồng bộ dữ liệu từ Clarity cho một page.

**Request Body:**
```json
{
    "numOfDays": 2
}
```

**Response (200):**
```json
{
    "success": true,
    "message": "Sync completed successfully",
    "data": {
        "success": true,
        "recordsProcessed": 45,
        "syncId": 12
    }
}
```

**Error (500):**
```json
{
    "success": false,
    "message": "Clarity API error: Invalid token"
}
```

---

### 5.5 POST /api/clarity/sync/all

Đồng bộ tất cả pages (Admin only).

**Request Body:**
```json
{
    "numOfDays": 2
}
```

**Response (200):**
```json
{
    "success": true,
    "message": "Sync completed: 45 succeeded, 5 failed",
    "data": {
        "synced": 45,
        "failed": 5,
        "errors": [
            {
                "pageId": 12,
                "pageTitle": "Some Page",
                "error": "No data available"
            }
        ]
    }
}
```

---

### 5.6 GET /api/clarity/history

Lấy lịch sử sync.

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": 12,
            "sync_type": "clarity",
            "status": "completed",
            "records_processed": 450,
            "started_at": "2026-10-07T10:00:00Z",
            "completed_at": "2026-10-07T10:05:00Z",
            "created_by_name": "admin"
        }
    ]
}
```

---

### 5.7 GET /api/clarity/suggestions/:pageId

Lấy suggestions dựa trên Clarity data.

---

## 6. Health Check

### 6.1 GET /api/health

Kiểm tra trạng thái server.

**Response (200):**
```json
{
    "success": true,
    "message": "Dunnio Behavior Tracker API is running",
    "version": "1.0.0",
    "timestamp": "2026-10-07T10:30:00Z"
}
```

---

## 7. Error Codes

| Code | Message | Description |
|------|---------|-------------|
| AUTH001 | Invalid credentials | Wrong username/password |
| AUTH002 | Token expired | JWT token has expired |
| AUTH003 | Access denied | Insufficient permissions |
| PAGE001 | Page not found | Page ID doesn't exist |
| PAGE002 | Duplicate URL | URL already exists |
| CTA001 | Invalid status | Invalid status transition |
| CLAR001 | No token | No Clarity token configured |
| CLAR002 | Rate limited | Clarity API rate limit reached |
| CLAR003 | Invalid token | Clarity token is invalid |

---

## 8. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/auth/login | 5 | per minute |
| /api/clarity/sync/* | 10 | per day |
| All other endpoints | 100 | per minute |

---

*Document ends here*
