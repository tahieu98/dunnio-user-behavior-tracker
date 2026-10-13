# 📊 Dunnio Behavior Tracker - Yêu cầu Nghiệp vụ

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0  
> **Loại tài liệu**: Business Requirements

---

## 1. Mục đích Dự án

### 1.1 Mô tả

Thiết kế và xây dựng công cụ đo lường, theo dõi hành vi tương tác của người dùng trên website dunniotailor.com, dựa trên dữ liệu từ Microsoft Clarity. Công cụ giúp Dev và Content Editor phân tích, đánh giá và tối ưu hóa giao diện website.

### 1.2 Mục tiêu chiến lược

| Mục tiêu | Chỉ số thành công |
|-----------|-------------------|
| Phát hiện dead zones | >80% vùng không có tương tác được gợi ý |
| Gợi ý CTA hiệu quả | >50 suggestions được implement |
| Cải thiện UX | Giảm dead clicks >30% |
| Tăng conversion | Tăng CTR trên các trang cải thiện |

---

## 2. Phạm vi Dự án

### 2.1 Trong phạm vi (In Scope)

#### Người dùng & Quyền truy cập
- Hệ thống đăng nhập với 3 vai trò: Admin, Dev, Editor
- Phân quyền theo vai trò
- Quản lý người dùng

#### Phân tích Hành vi
- Grid-based visualization (12 cột)
- Heatmap display
- Dead zone detection
- Click tracking theo vị trí

#### CTA Suggestions
- Auto-generated suggestions dựa trên dead zones
- Priority scoring
- Status workflow (pending → approved → implemented)
- Export code snippets

#### Tích hợp
- Microsoft Clarity API
- Custom tracker script cho website

### 2.2 Ngoài phạm vi (Out of Scope)

- Real-time WebSocket updates
- Email notifications
- A/B testing
- Mobile app
- PDF report generation
- Google Analytics integration
- Payment/Transaction tracking

---

## 3. Người dùng Mục tiêu

### 3.1 User Personas

| Persona | Vai trò | Nhu cầu |
|---------|---------|---------|
| **Admin User** | Quản trị hệ thống | Quản lý users, cấu hình Clarity, xem toàn bộ dữ liệu |
| **Dev User** | Developer | Phân tích click data, tạo suggestions, xem grid |
| **Content Editor** | Content Team | Xem suggestions, đề xuất cải thiện nội dung |

### 3.2 User Stories

#### Admin User
```
- Là admin, tôi muốn quản lý người dùng để phân quyền truy cập
- Là admin, tôi muốn cấu hình Clarity API để lấy dữ liệu
- Là admin, tôi muốn approve/reject suggestions trước khi implement
```

#### Dev User
```
- Là dev, tôi muốn xem grid visualization để hiểu vị trí clicks
- Là dev, tôi muốn phát hiện dead zones để bổ sung CTAs
- Là dev, tôi muốn export suggestions để implement
- Là dev, tôi muốn sync dữ liệu từ Clarity
```

#### Content Editor
```
- Là editor, tôi muốn xem top hotspots để hiểu user behavior
- Là editor, tôi muốn tạo suggestions cho content cải thiện
- Là editor, tôi muốn xem pending suggestions để theo dõi tiến độ
```

---

## 4. Yêu cầu Chức năng

### 4.1 Authentication & Authorization

| ID | Yêu cầu | Độ ưu tiên | Ghi chú |
|----|---------|------------|---------|
| AUTH-001 | Đăng nhập với username/password | Must Have | JWT token |
| AUTH-002 | Phân quyền theo vai trò | Must Have | admin/dev/editor |
| AUTH-003 | Đăng xuất | Must Have | Clear token |
| AUTH-004 | Quản lý users (CRUD) | Should Have | Admin only |
| AUTH-005 | Đổi password | Should Have | User self-service |

### 4.2 Dashboard

| ID | Yêu cầu | Độ ưu tiên | Ghi chú |
|----|---------|------------|---------|
| DASH-001 | Hiển thị stats tổng quan | Must Have | Total pages, clicks, suggestions |
| DASH-002 | Recent suggestions widget | Must Have | 5 suggestions gần nhất |
| DASH-003 | Top hotspots | Should Have | 10 vùng có nhiều clicks |
| DASH-004 | Quick navigation | Must Have | Link đến các pages |

### 4.3 Pages Management

| ID | Yêu cầu | Độ ưu tiên | Ghi chú |
|----|---------|------------|---------|
| PAGE-001 | List all pages | Must Have | 40+ pages pre-configured |
| PAGE-002 | Filter by category | Must Have | Suits, Shirts, etc. |
| PAGE-003 | Search pages | Should Have | By title/URL |
| PAGE-004 | View page details | Must Have | Title, URL, category |
| PAGE-005 | Sync page data | Must Have | Từ Clarity API |

### 4.4 Grid Visualization

| ID | Yêu cầu | Độ ưu tiên | Ghi chú |
|----|---------|------------|---------|
| GRID-001 | 12-column grid overlay | Must Have | Responsive |
| GRID-002 | Color-coded heat levels | Must Have | Cold → Hot gradient |
| GRID-003 | Dead zone highlighting | Must Have | Dashed border |
| GRID-004 | Click on cell → details | Must Have | Show clicks, element |
| GRID-005 | Create CTA from cell | Must Have | Quick action |
| GRID-006 | Toggle labels | Should Have | Show/hide coordinates |
| GRID-007 | Time range selector | Should Have | 7/14/30 days |

### 4.5 CTA Suggestions

| ID | Yêu cầu | Độ ưu tiên | Ghi chú |
|----|---------|------------|---------|
| CTA-001 | Auto-generate suggestions | Must Have | Từ dead zones |
| CTA-002 | View all suggestions | Must Have | Filterable |
| CTA-003 | Create manual suggestion | Must Have | Chọn grid position |
| CTA-004 | Status workflow | Must Have | pending → approved → implemented |
| CTA-005 | View suggestion details | Must Have | Modal popup |
| CTA-006 | Copy code snippet | Must Have | One-click copy |
| CTA-007 | Filter by status/type | Should Have | Dropdown filters |
| CTA-008 | Bulk actions | Should Have | Approve multiple |

### 4.6 Microsoft Clarity Integration

| ID | Yêu cầu | Độ ưu tiên | Ghi chú |
|----|---------|------------|---------|
| CLAR-001 | Save API token | Must Have | JWT token |
| CLAR-002 | Check connection status | Must Have | Visual indicator |
| CLAR-003 | Sync single page | Must Have | Manual trigger |
| CLAR-004 | Sync all pages | Should Have | Batch operation |
| CLAR-005 | View sync history | Should Have | Log records |
| CLAR-006 | Handle rate limits | Must Have | 10 req/day |

### 4.7 Custom Tracker

| ID | Yêu cầu | Độ ưu tiên | Ghi chú |
|----|---------|------------|---------|
| TRACK-001 | Click tracking | Must Have | Grid coordinates |
| TRACK-002 | Scroll depth tracking | Must Have | Milestones |
| TRACK-003 | Form interactions | Should Have | Focus/submit |
| TRACK-004 | Session management | Should Have | Unique session ID |
| TRACK-005 | Send to backend | Must Have | Queue & batch |

---

## 5. Yêu cầu Phi chức năng

### 5.1 Performance

| Chỉ số | Target | Ghi chú |
|--------|--------|---------|
| Page load time | <2s | Dashboard |
| API response time | <500ms | P95 |
| Grid render | <1s | 1000 cells |
| Concurrent users | 10 | Simultaneous |

### 5.2 Security

| Yêu cầu | Mô tả |
|----------|--------|
| Authentication | JWT with 24h expiry |
| Password | bcrypt hashed (cost ≥10) |
| HTTPS | Required in production |
| Secrets | Environment variables only |
| CORS | Configurable origins |

### 5.3 Scalability

| Yêu cầu | Mô tả |
|----------|--------|
| Database | Support 1M+ click events |
| Pages | Support 100+ tracked pages |
| Users | Support 50+ concurrent users |

### 5.4 Reliability

| Yêu cầu | Mô tả |
|----------|--------|
| Uptime | 99.5% |
| Error handling | Graceful degradation |
| Logging | Request & error logs |
| Backup | Daily database backup |

---

## 6. UI/UX Requirements

### 6.1 Design Principles

1. **Simplicity**: Clean, focused interface
2. **Clarity**: Clear data visualization
3. **Consistency**: Uniform styling
4. **Accessibility**: WCAG 2.1 AA compliance

### 6.2 Color Palette

| Màu | Hex | Usage |
|------|-----|-------|
| Primary | #2563eb | Buttons, links, accents |
| Success | #10b981 | Success states, implemented |
| Warning | #f59e0b | Pending status |
| Danger | #ef4444 | Errors, rejected |
| Background | #f8fafc | Page background |
| Text | #1e293b | Primary text |

### 6.3 Heatmap Colors

| Level | Color | Description |
|-------|-------|-------------|
| Cold | #e0f2fe | No clicks |
| Cool | #bae6fd | Very few |
| Warm | #fef9c3 | Moderate |
| Hot | #fecaca | Many |
| Dead | #f3f4f6 | Dead zone (dashed) |

### 6.4 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | <768px | Single column |
| Tablet | 768-1024px | Adjusted grid |
| Desktop | >1024px | Full layout |

---

## 7. Data Requirements

### 7.1 Data Sources

| Source | Type | Update Frequency |
|--------|------|------------------|
| Microsoft Clarity | API | Manual sync |
| Custom Tracker | JS Script | Real-time |
| Manual Entry | User Input | On-demand |

### 7.2 Data Retention

| Data Type | Retention | Justification |
|-----------|-----------|---------------|
| Click Events | 90 days | Performance |
| Suggestions | 1 year | Historical reference |
| User Sessions | 30 days | GDPR compliance |
| Sync Logs | 90 days | Audit trail |

### 7.3 Data Privacy

- No PII collected
- Anonymous session IDs
- Cookie-less tracking option
- User consent before tracking

---

## 8. Integration Requirements

### 8.1 Microsoft Clarity

| Integration Point | Method |
|-------------------|--------|
| Data Export API | REST GET |
| Authentication | JWT Bearer Token |
| Rate Limit | 10 requests/day |
| Data Format | JSON |

### 8.2 dunniotailor.com

| Integration Point | Method |
|-------------------|--------|
| Tracker Script | JavaScript |
| API Endpoint | REST POST |
| Session ID | Random UUID |

---

## 9. Acceptance Criteria

### 9.1 Authentication

- [ ] User can login with valid credentials
- [ ] Invalid credentials show error message
- [ ] Protected routes redirect to login
- [ ] Role-based access enforced

### 9.2 Dashboard

- [ ] Stats display correctly
- [ ] Recent suggestions load
- [ ] Navigation works

### 9.3 Grid Visualization

- [ ] Grid renders with 12 columns
- [ ] Heat levels display correctly
- [ ] Dead zones highlighted
- [ ] Click opens cell details
- [ ] CTA can be created from cell

### 9.4 CTA Suggestions

- [ ] Auto-generation works
- [ ] Status workflow functions
- [ ] Copy code works
- [ ] Filters work

### 9.5 Clarity Integration

- [ ] Token saves correctly
- [ ] Sync retrieves data
- [ ] Rate limits handled

### 9.6 Custom Tracker

- [ ] Clicks tracked
- [ ] Grid coordinates correct
- [ ] Data sent to backend

---

## 10. Glossary

| Term | Definition |
|------|------------|
| Dead Zone | Grid cell with zero clicks |
| Hotspot | Grid cell with high click count |
| Heat Level | Visual indicator of click density |
| CTA | Call-to-Action button/link |
| Grid Cell | Intersection of column and row |
| Clarity | Microsoft Clarity analytics tool |
| Dead Click | Click on non-interactive element |
| Rage Click | Multiple rapid clicks on same element |

---

## 11. Appendix

### 11.1 Page Categories

1. **Suits**: Custom, 3-piece, Wool, Linen, Cotton, Tweed
2. **Shirts**: Dress, Cotton, Linen, Twill, Stretch
3. **Pants**: Custom, Dress, Wool, Linen, Stretch
4. **Tuxedo**: Custom, Wool, Velvet, Stretch, Silk Blend
5. **Business**: Suits, Interview, Blazers
6. **Formal**: Suits, Black Tie, Gala, Awards
7. **Party**: Suits, Birthday, Christmas, New Year
8. **Casual**: Smart Casual, Vacation, Weekend
9. **Wedding**: Groom, Tuxedos, Groomsmen, Guest, Waistcoats
10. **3D Demo**: Suits, 3-piece, Jacket, Vest, Tuxedo, Shirt, Pant

### 11.2 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 07/10/2026 | Claude | Initial version |

---

*Document ends here*
