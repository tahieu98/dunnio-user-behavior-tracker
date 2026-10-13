# 📚 Dunnio Behavior Tracker - Planning Documents Index

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0

---

## Tài liệu dự án

| # | Tài liệu | Mô tả |
|---|-----------|--------|
| 01 | [Tổng hợp Kế hoạch](./01-TONG-HOP-KE-HOACH.md) | Tổng hợp toàn bộ kế hoạch triển khai |
| 02 | [Yêu cầu Nghiệp vụ](./02-YEU-CAU-NGHIEP-VU.md) | Business requirements, user stories, acceptance criteria |
| 03 | [Thiết kế Database](./03-THIET-KE-DATABASE.md) | Database schema, tables, indexes |
| 04 | [Thiết kế API](./04-THIET-KE-API.md) | API endpoints, request/response formats |
| 05 | [Thiết kế UI/UX](./05-THIET-KE-UI-UX.md) | Design system, components, responsive |
| 06 | [Integration Clarity](./06-INTEGRATION-CLARITY.md) | Microsoft Clarity integration guide |
| 07 | [Hướng dẫn Triển khai](./07-HUONG-DAN-TRIEN-KHAI.md) | Deployment guide, troubleshooting |
| 08 | [Triển khai heatmap theo tháng v1.1](./08-TRIEN-KHAI-HEATMAP-THEO-THANG.md) | Kiến trúc đã triển khai, ngữ nghĩa số liệu, consent, so sánh tháng, hạn chế Clarity |
| 09 | [Kết quả kiểm thử local v1.1](./09-KET-QUA-KIEM-THU.md) | Các kiểm tra đã chạy và phạm vi chưa xác minh |
| 10 | [Đóng gói Windows v1.2](./10-DONG-GOI-WINDOWS.md) | Launcher, Admin, DPAPI, lifecycle cleanup, portable ZIP và kiểm thử native |

**Bản triển khai hiện tại: v1.5 / Order 3.** Đọc [thiết kế](13-ORDER3-DESIGN.md), [kế hoạch thực thi](14-ORDER3-IMPLEMENTATION.md) và [vận hành + kiểm thử + VPS](15-ORDER3-OPERATIONS.md). Các ví dụ admin/admin123, ước lượng tọa độ Clarity và các dấu “đã kiểm thử” trong tài liệu 01–07 không mô tả phiên bản hiện tại.

---

## Cách sử dụng

### Đọc theo thứ tự khuyến nghị

1. **Bắt đầu**: Đọc [01-TONG-HOP-KE-HOACH.md](./01-TONG-HOP-KE-HOACH.md) để hiểu tổng quan
2. **Nghiệp vụ**: Đọc [02-YEU-CAU-NGHIEP-VU.md](./02-YEU-CAU-NGHIEP-VU.md) để hiểu yêu cầu
3. **Kỹ thuật**: Đọc [03](./03-THIET-KE-DATABASE.md), [04](./04-THIET-KE-API.md), [05](./05-THIET-KE-UI-UX.md) cho chi tiết
4. **Tích hợp**: Đọc [06-INTEGRATION-CLARITY.md](./06-INTEGRATION-CLARITY.md) cho Clarity
5. **Triển khai**: Đọc [07-HUONG-DAN-TRIEN-KHAI.md](./07-HUONG-DAN-TRIEN-KHAI.md) để triển khai

### Tra cứu nhanh

| Cần tìm | Đọc |
|----------|------|
| Tổng quan dự án | 01-TONG-HOP-KE-HOACH.md |
| Database schema | 03-THIET-KE-DATABASE.md |
| API endpoints | 04-THIET-KE-API.md |
| UI components | 05-THIET-KE-UI-UX.md |
| Clarity setup | 06-INTEGRATION-CLARITY.md |
| Deployment steps | 07-HUONG-DAN-TRIEN-KHAI.md |

---

## Các file khác trong dự án

| File | Mô tả |
|------|--------|
| [README.md](../README.md) | Hướng dẫn sử dụng chung |
| [SPEC.md](../SPEC.md) | Technical specifications |
| [PLAN.md](../PLAN.md) | Original planning document |

### Backend

| File | Mô tả |
|------|--------|
| [backend/src/index.js](../backend/src/index.js) | Express server entry |
| [backend/migrations/001_init.sql](../backend/migrations/001_init.sql) | Database schema |
| [backend/package.json](../backend/package.json) | Dependencies |

### Frontend

| File | Mô tả |
|------|--------|
| [frontend/login.html](../frontend/login.html) | Login page |
| [frontend/dashboard.html](../frontend/dashboard.html) | Main dashboard |
| [frontend/js/app.js](../frontend/js/app.js) | Frontend app logic |

### Tracker

| File | Mô tả |
|------|--------|
| [tracker/clarity-tracker.js](../tracker/clarity-tracker.js) | Website tracker |
| [tracker/README.md](../tracker/README.md) | Tracker installation |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 07/10/2026 | Initial documentation |

---

## Liên hệ

- **Technical Lead**: [TBD]
- **Project Manager**: [TBD]
- **Support**: [TBD]
