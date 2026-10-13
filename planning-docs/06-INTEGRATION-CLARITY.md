# 🔗 Dunnio Behavior Tracker - Microsoft Clarity Integration

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0  
> **Loại tài liệu**: Integration Guide

---

## 1. Tổng quan Microsoft Clarity

### 1.1 Clarity là gì?

Microsoft Clarity là công cụ phân tích hành vi người dùng miễn phí của Microsoft, cung cấp:
- Session recordings
- Heatmaps
- Click maps
- Scroll depth analytics

### 1.2 Các tính năng của Clarity

| Feature | Miêu tả | Trong dự án |
|---------|---------|-------------|
| Click tracking | Theo dõi clicks | ✅ Sử dụng |
| Scroll maps | Bản đồ scroll | ✅ Sử dụng |
| Session recordings | Ghi lại phiên | ❌ Chỉ xem trong Clarity UI |
| Heatmaps | Bản đồ nhiệt | ✅ Sử dụng |
| Attention maps | Bản đồ chú ý | ❌ Không hỗ trợ |
| Dead clicks | Clicks không có tác dụng | ✅ Sử dụng |
| Rage clicks | Clicks liên tục | ✅ Sử dụng |

---

## 2. Clarity API

### 2.1 API Endpoints

**Base URL:**
```
https://www.clarity.ms/export-data/api/v1
```

### 2.2 Data Export API

**Endpoint:** `/project-live-insights`

**Method:** GET

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|---------|-------------|
| numOfDays | integer | Yes | 1, 2, or 3 |
| dimension1 | string | No | First breakdown dimension |
| dimension2 | string | No | Second breakdown dimension |
| dimension3 | string | No | Third breakdown dimension |

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

### 2.3 Rate Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Requests per day | 10 | Per project |
| Data range | 1-3 days | Most recent only |
| Response rows | 1,000 | No pagination |
| Quota reset | Daily | Midnight UTC |

---

## 3. API Integration

### 3.1 Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Backend   │     │  Clarity    │
│             │     │             │     │    API       │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                    │
       │  1. Enter token    │                    │
       │───────────────────▶│                    │
       │                    │                    │
       │                    │  2. Store token    │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  3. Test token     │
       │                    │◀──────────────────│
       │                    │                    │
       │  4. Success        │                    │
       │◀───────────────────│                    │
```

### 3.2 Token Setup

**Steps:**

1. Go to [Clarity Dashboard](https://clarity.microsoft.com/)
2. Select your project
3. Go to **Settings → Data Export**
4. Click **Generate Token**
5. Copy the JWT token
6. Enter in Dunnio Tracker Settings

**Token Requirements:**
- Token name: 4-32 characters
- Alphanumeric + hyphens/underscores/periods
- Project admin only

### 3.3 Implementation

```javascript
// services/clarityService.js

class ClarityService {
    constructor() {
        this.baseUrl = 'https://www.clarity.ms/export-data/api/v1';
        this.rateLimit = 10; // requests per day
    }

    async getLiveInsights(token, projectId, options = {}) {
        const { numOfDays = 2, dimension1, dimension2, dimension3 } = options;

        const url = new URL(this.baseUrl + '/project-live-insights');
        url.searchParams.append('numOfDays', numOfDays);
        if (dimension1) url.searchParams.append('dimension1', dimension1);
        if (dimension2) url.searchParams.append('dimension2', dimension2);
        if (dimension3) url.searchParams.append('dimension3', dimension3);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Clarity API error: ${response.status}`);
        }

        return response.json();
    }
}
```

---

## 4. Data Structure

### 4.1 Response Format

```json
{
    "projectId": "abc123xyz",
    "exportTime": "2026-10-07T10:30:00Z",
    "data": [
        {
            "url": "/men/custom-suits",
            "pageTitle": "Custom Suits",
            "pageviews": 1250,
            "visitors": 890,
            "clicks": 342,
            "avgTimeOnPage": 180,
            "scrollDepth": 65,
            "deadClicks": 12,
            "rageClicks": 5,
            "countries": [
                { "name": "Vietnam", "visitors": 450 },
                { "name": "United States", "visitors": 200 }
            ],
            "devices": [
                { "type": "Desktop", "visitors": 600 },
                { "type": "Mobile", "visitors": 250 }
            ],
            "clickElements": [
                {
                    "elementSelector": "#book-now-btn",
                    "clickCount": 156,
                    "clickPercentage": 45.6
                }
            ]
        }
    ]
}
```

### 4.2 Data Mapping

Vì Clarity không cung cấp raw X/Y coordinates, chúng ta cần:

1. **Element Selector → Grid Position**

```javascript
function estimateGridPosition(elementSelector) {
    const selector = elementSelector.toLowerCase();

    // Header elements → Top of page
    if (selector.includes('header') || selector.includes('nav')) {
        return { colStart: 1, colEnd: 12, rowStart: 1, rowEnd: 2 };
    }

    // Hero section
    if (selector.includes('hero') || selector.includes('banner')) {
        return { colStart: 1, colEnd: 12, rowStart: 2, rowEnd: 4 };
    }

    // Footer
    if (selector.includes('footer')) {
        return { colStart: 1, colEnd: 12, rowStart: 20, rowEnd: 25 };
    }

    // Product cards
    if (selector.includes('product') || selector.includes('card')) {
        return { colStart: 1, colEnd: 4, rowStart: 5, rowEnd: 10 };
    }

    // CTA buttons
    if (selector.includes('button') || selector.includes('btn') || selector.includes('cta')) {
        return { colStart: 4, colEnd: 8, rowStart: 8, rowEnd: 10 };
    }

    // Default → Middle of page
    return { colStart: 1, colEnd: 12, rowStart: 5, rowEnd: 8 };
}
```

2. **Click Count → Heat Level**

```javascript
function calculateHeatLevel(clickCount, maxClicks = 100) {
    if (clickCount === 0) return 0;
    
    const ratio = Math.min(clickCount / maxClicks, 1);
    
    // 0-20%: Level 1-2 (Cold)
    // 20-40%: Level 3-4 (Cool)
    // 40-60%: Level 5-6 (Warm)
    // 60-80%: Level 7-8 (Hot)
    // 80-100%: Level 9-10 (Maximum)
    
    return Math.ceil(ratio * 10);
}
```

---

## 5. Sync Strategy

### 5.1 Manual Sync

**Trigger:** User clicks "Sync" button

```
User clicks "Sync" 
    → Check rate limit (10/day)
    → Fetch data from Clarity API
    → Process and transform data
    → Store in MySQL
    → Update cache
    → Show success/error message
```

### 5.2 Scheduled Sync

**Recommended:** Daily sync at off-peak hours

```javascript
// Example: Run at 3 AM daily
const syncSchedule = {
    hour: 3,
    minute: 0,
    timezone: 'Asia/Ho_Chi_Minh'
};
```

### 5.3 Caching Strategy

```javascript
// Cache Clarity data for 4 hours
const CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours

class ClarityCache {
    constructor() {
        this.cache = new Map();
    }

    get(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
            return cached.data;
        }
        return null;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
}
```

### 5.4 Rate Limit Handling

```javascript
async function syncWithRateLimit() {
    const today = new Date().toISOString().split('T')[0];
    const syncKey = `sync_${today}`;
    
    // Check if already synced today
    const lastSync = await getLastSyncDate();
    if (lastSync === today) {
        console.log('Already synced today');
        return;
    }

    try {
        // Perform sync
        await performSync();
        
        // Record sync
        await recordSync(syncKey, today);
    } catch (error) {
        if (error.message.includes('429')) {
            console.log('Rate limit reached. Try again tomorrow.');
        }
        throw error;
    }
}
```

---

## 6. Custom Tracker Supplement

### 6.1 Why Custom Tracker?

| Limitation | Impact | Solution |
|------------|--------|----------|
| No raw coordinates | Can't show exact position | Grid approximation |
| Aggregated data only | No individual clicks | Custom tracker for precise data |
| 10 req/day limit | Limited real-time | Caching + scheduled sync |
| 1-3 day data only | Historical analysis limited | Store in MySQL |

### 6.2 Tracker → Backend Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  dunniotailor.com │     │    Backend       │     │     MySQL       │
│                   │     │                  │     │                  │
│  ┌──────────────┐ │     │  ┌────────────┐ │     │  ┌────────────┐ │
│  │ Custom       │─┼────▶│  │ Events API │─┼────▶│  │ click_events│ │
│  │ Tracker      │ │     │  └────────────┘ │     │  └────────────┘ │
│  └──────────────┘ │     │                  │     │                  │
│                    │     │  ┌────────────┐ │     │                  │
│                    │     │  │ Grid      │ │     │                  │
│                    │     │  │ Mapper    │ │     │                  │
│                    │     │  └────────────┘ │     │                  │
│                    │     │                  │     │                  │
│                    │     │  ┌────────────┐ │     │                  │
│                    │     │  │ CTA       │ │     │                  │
│                    │     │  │ Engine    │ │     │                  │
│                    │     │  └────────────┘ │     │                  │
└────────────────────┘     └──────────────────┘     └──────────────────┘
```

### 6.3 Data Comparison

| Metric | Clarity | Custom Tracker |
|--------|---------|----------------|
| Click location | Element selector | Exact X/Y coordinates |
| Data granularity | Aggregated | Individual events |
| Historical data | 1-3 days | Unlimited |
| Real-time | No | Yes |
| Cost | Free | Server costs |
| Setup | Easy (tag) | Medium (install script) |

---

## 7. Best Practices

### 7.1 API Usage

1. **Cache aggressively** - Clarity data doesn't change frequently
2. **Batch requests** - Get all pages in one sync
3. **Handle errors** - API can return errors for invalid tokens or rate limits
4. **Monitor usage** - Track API calls to avoid hitting limits

### 7.2 Data Storage

1. **Aggregate wisely** - Store summarized data, not raw events from Clarity
2. **Partition tables** - For large click_events table
3. **Archive old data** - Move data >90 days to archive
4. **Index properly** - On page_id, data_date, grid position

### 7.3 User Experience

1. **Show sync status** - Display last sync time
2. **Indicate rate limit** - Show remaining API calls
3. **Handle failures gracefully** - Show error messages, allow retry
4. **Provide feedback** - Loading states during sync

---

## 8. Troubleshooting

### 8.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid token" | Token expired or wrong | Regenerate token in Clarity |
| "Rate limit exceeded" | 10 requests/day used | Wait for quota reset |
| "No data returned" | Wrong project ID | Verify project ID in settings |
| "Token expired" | Clarity token TTL | Refresh token in Clarity settings |

### 8.2 Debug Steps

1. **Check token validity**
```bash
curl -X GET "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Verify project ID**
- Go to Clarity Dashboard
- Check project settings
- Compare project ID

3. **Check rate limit**
```javascript
const syncLogs = await query(
    'SELECT COUNT(*) as count FROM sync_logs WHERE DATE(started_at) = CURDATE()'
);
console.log(`Syncs today: ${syncLogs[0].count}/10`);
```

---

## 9. Future Enhancements

### 9.1 Planned Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Webhook integration | Real-time Clarity updates | High |
| Enhanced grid mapping | ML-based position estimation | Medium |
| Multi-project support | Track multiple websites | Medium |
| Automated suggestions | Auto-generate + implement | Low |

### 9.2 Alternative Data Sources

If Clarity API proves insufficient:

| Source | Pros | Cons |
|--------|------|------|
| Hotjar | Raw coordinates | Paid |
| FullStory | Rich session data | Paid |
| Google Analytics 4 | Free, powerful | Complex setup |
| Custom tracking | Full control | Development time |

---

## 10. References

- [Clarity Documentation](https://learn.microsoft.com/en-us/clarity/)
- [Clarity API Reference](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)
- [Clarity Dashboard](https://clarity.microsoft.com/)

---

*Document ends here*
