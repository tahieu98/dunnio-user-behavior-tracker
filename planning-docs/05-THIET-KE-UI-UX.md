# 🎨 Dunnio Behavior Tracker - UI/UX Design Specification

> **Ngày tạo**: 07/10/2026  
> **Phiên bản**: 1.0.0  
> **Loại tài liệu**: UI/UX Design

---

## 1. Design Principles

### 1.1 Core Principles

1. **Simplicity First** - Clean, focused interface with minimal distractions
2. **Data Clarity** - Clear data visualization and hierarchy
3. **Consistency** - Uniform styling across all pages
4. **Accessibility** - WCAG 2.1 AA compliance
5. **Performance** - Fast loading and responsive interactions

### 1.2 Visual Hierarchy

```
┌─────────────────────────────────────────────────┐
│  HEADER (Primary Actions, User Info)           │
├─────────────────────────────────────────────────┤
│                                                 │
│  CONTENT                                        │
│  ├── Navigation / Sidebar                       │
│  ├── Page Title + Breadcrumb                    │
│  └── Main Content Area                         │
│       ├── Stats / Summary Cards                │
│       ├── Data Visualization                   │
│       └── Interactive Elements                 │
│                                                 │
├─────────────────────────────────────────────────┤
│  FOOTER (Contextual Actions)                   │
└─────────────────────────────────────────────────┘
```

---

## 2. Color System

### 2.1 Primary Colors

```css
:root {
    /* Primary */
    --primary-color: #2563eb;      /* Main actions, links */
    --primary-hover: #1d4ed8;     /* Hover state */
    --primary-light: #dbeafe;     /* Backgrounds, highlights */
    --primary-dark: #1e40af;     /* Active state */
    
    /* Secondary */
    --secondary-color: #64748b;   /* Secondary text */
    --secondary-hover: #475569;   /* Secondary hover */
    
    /* Neutral */
    --background: #f8fafc;       /* Page background */
    --surface: #ffffff;          /* Cards, panels */
    --border: #e2e8f0;           /* Borders, dividers */
    --text-primary: #1e293b;      /* Primary text */
    --text-secondary: #64748b;   /* Secondary text */
    --text-muted: #94a3b8;       /* Muted text */
}
```

### 2.2 Semantic Colors

```css
:root {
    /* Success */
    --success-color: #10b981;
    --success-bg: #d1fae5;
    --success-text: #065f46;
    
    /* Warning */
    --warning-color: #f59e0b;
    --warning-bg: #fef3c7;
    --warning-text: #92400e;
    
    /* Danger */
    --danger-color: #ef4444;
    --danger-bg: #fee2e2;
    --danger-text: #991b1b;
    
    /* Info */
    --info-color: #3b82f6;
    --info-bg: #dbeafe;
    --info-text: #1e40af;
}
```

### 2.3 Heatmap Gradient

```css
:root {
    /* Cold (No clicks) */
    --heat-0: #e0f2fe;  /* Very cold */
    --heat-1: #bae6fd;  /* Cold */
    --heat-2: #7dd3fc;  /* Cool */
    
    /* Warm (Some clicks) */
    --heat-3: #fef9c3;  /* Light warm */
    --heat-4: #fde047;  /* Warm */
    --heat-5: #fbbf24;  /* Medium warm */
    
    /* Hot (Many clicks) */
    --heat-6: #fed7aa;   /* Hot */
    --heat-7: #fca5a5;  /* Very hot */
    --heat-8: #f87171;  /* Hot zone */
    --heat-9: #ef4444;  /* Maximum heat */
    
    /* Dead zone */
    --dead-zone: #f3f4f6;
    --dead-border: #d1d5db;
}
```

### 2.4 Dark Mode (Future)

```css
@media (prefers-color-scheme: dark) {
    :root {
        --background: #0f172a;
        --surface: #1e293b;
        --border: #334155;
        --text-primary: #f8fafc;
        --text-secondary: #94a3b8;
    }
}
```

---

## 3. Typography

### 3.1 Font Stack

```css
:root {
    --font-sans: -apple-system, BlinkMacSystemFont, 
                 'Segoe UI', Roboto, 
                 'Helvetica Neue', Arial, sans-serif;
    --font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 
                 'Fira Code', monospace;
}
```

### 3.2 Type Scale

```css
:root {
    /* Font sizes */
    --text-xs: 0.75rem;    /* 12px - labels, captions */
    --text-sm: 0.875rem;    /* 14px - secondary text */
    --text-base: 1rem;      /* 16px - body text */
    --text-lg: 1.125rem;    /* 18px - large text */
    --text-xl: 1.25rem;     /* 20px - page titles */
    --text-2xl: 1.5rem;     /* 24px - section headers */
    --text-3xl: 1.875rem;   /* 30px - main titles */
    --text-4xl: 2.25rem;    /* 36px - hero text */
    
    /* Font weights */
    --font-normal: 400;
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;
    
    /* Line heights */
    --leading-tight: 1.25;
    --leading-normal: 1.5;
    --leading-relaxed: 1.75;
}
```

### 3.3 Text Styles

```css
/* Headings */
h1, .h1 {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
}

h2, .h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
}

h3, .h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
}

/* Body */
p, .body {
    font-size: var(--text-base);
    line-height: var(--leading-normal);
}

/* Small */
small, .small {
    font-size: var(--text-sm);
}

/* Caption */
.caption {
    font-size: var(--text-xs);
    color: var(--text-muted);
}
```

---

## 4. Spacing System

### 4.1 Spacing Scale

```css
:root {
    /* Base unit: 4px */
    --space-0: 0;
    --space-1: 0.25rem;   /* 4px */
    --space-2: 0.5rem;    /* 8px */
    --space-3: 0.75rem;   /* 12px */
    --space-4: 1rem;      /* 16px */
    --space-5: 1.25rem;   /* 20px */
    --space-6: 1.5rem;    /* 24px */
    --space-8: 2rem;      /* 32px */
    --space-10: 2.5rem;   /* 40px */
    --space-12: 3rem;     /* 48px */
    --space-16: 4rem;     /* 64px */
    --space-20: 5rem;     /* 80px */
}
```

### 4.2 Component Spacing

```css
/* Card padding */
.card {
    padding: var(--space-5);
}

/* Section spacing */
.section {
    margin-bottom: var(--space-8);
}

/* Form spacing */
.form-group {
    margin-bottom: var(--space-4);
}

/* Button spacing */
.btn-group {
    gap: var(--space-3);
}
```

---

## 5. Layout System

### 5.1 Container

```css
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-6);
}

.container-fluid {
    width: 100%;
    padding: 0 var(--space-6);
}
```

### 5.2 Grid System

```css
.grid {
    display: grid;
    gap: var(--space-6);
}

/* Columns */
.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
.grid-cols-6 { grid-template-columns: repeat(6, 1fr); }
.grid-cols-12 { grid-template-columns: repeat(12, 1fr); }

/* Responsive */
@media (max-width: 768px) {
    .grid-cols-2,
    .grid-cols-3,
    .grid-cols-4 {
        grid-template-columns: 1fr;
    }
}
```

### 5.3 App Layout

```
┌────────────────────────────────────────────────────────┐
│                    HEADER (64px)                        │
│  Logo          Page Title           User Status         │
├────────────┬───────────────────────────────────────────┤
│            │                                            │
│  SIDEBAR   │           MAIN CONTENT                    │
│  (260px)   │                                            │
│            │  ┌──────────────────────────────────────┐ │
│  - Dashboard│  │ Stats Cards                          │ │
│  - Pages   │  └──────────────────────────────────────┘ │
│  - Grid    │                                            │
│  - Heatmap │  ┌─────────────────┬──────────────────┐  │
│  - CTA     │  │                 │                   │ │
│  - Settings│  │ Recent          │ Top               │  │
│            │  │ Suggestions      │ Hotspots          │  │
│            │  │                 │                   │  │
│            │  └─────────────────┴──────────────────┘  │
│            │                                            │
└────────────┴───────────────────────────────────────────┘
```

### 5.4 Responsive Breakpoints

```css
/* Mobile: < 768px */
@media (max-width: 767px) {
    .sidebar {
        position: fixed;
        transform: translateX(-100%);
        width: 260px;
    }
    
    .sidebar.open {
        transform: translateX(0);
    }
}

/* Tablet: 768px - 1024px */
@media (min-width: 768px) and (max-width: 1024px) {
    .sidebar {
        width: 70px;
    }
}

/* Desktop: > 1024px */
@media (min-width: 1025px) {
    .sidebar {
        width: 260px;
    }
}
```

---

## 6. Components

### 6.1 Buttons

```css
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
}

/* Primary */
.btn-primary {
    background: var(--primary-color);
    color: white;
    border: none;
}
.btn-primary:hover {
    background: var(--primary-hover);
}

/* Secondary */
.btn-secondary {
    background: var(--background);
    color: var(--text-primary);
    border: 1px solid var(--border);
}
.btn-secondary:hover {
    background: var(--border);
}

/* Danger */
.btn-danger {
    background: var(--danger-color);
    color: white;
    border: none;
}

/* Sizes */
.btn-sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
}

.btn-lg {
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-base);
}
```

### 6.2 Cards

```css
.card {
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
}

.card-header {
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.card-body {
    padding: var(--space-5);
}

.card-footer {
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--border);
}
```

### 6.3 Forms

```css
.form-group {
    margin-bottom: var(--space-4);
}

.form-label {
    display: block;
    margin-bottom: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
}

.form-input {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-base);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    transition: all 0.2s;
}

.form-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
}

.form-input::placeholder {
    color: var(--text-muted);
}

.form-error {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
    color: var(--danger-color);
}
```

### 6.4 Select

```css
.form-select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    padding-right: 2.5rem;
}
```

### 6.5 Badges

```css
.badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    border-radius: 0.25rem;
    text-transform: uppercase;
}

.badge-pending {
    background: var(--warning-bg);
    color: var(--warning-text);
}

.badge-approved {
    background: var(--primary-light);
    color: var(--primary-color);
}

.badge-implemented {
    background: var(--success-bg);
    color: var(--success-text);
}

.badge-rejected {
    background: var(--danger-bg);
    color: var(--danger-text);
}
```

### 6.6 Stats Card

```css
.stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-5);
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: var(--shadow-sm);
}

.stat-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    background: var(--primary-light);
    border-radius: 0.75rem;
}

.stat-content {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 1.75rem;
    font-weight: var(--font-bold);
    line-height: 1.2;
}

.stat-label {
    font-size: var(--text-sm);
    color: var(--text-muted);
}
```

### 6.7 Navigation

```css
.nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    border-left: 3px solid transparent;
    transition: all 0.2s;
}

.nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
}

.nav-item.active {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-left-color: var(--primary-color);
}

.nav-icon {
    width: 24px;
    text-align: center;
    font-size: 1.125rem;
}
```

### 6.8 Modal

```css
.modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal.active {
    display: flex;
}

.modal-content {
    background: var(--surface);
    border-radius: 1rem;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-header {
    padding: var(--space-5);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-body {
    padding: var(--space-5);
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
}
```

### 6.9 Toast

```css
.toast-container {
    position: fixed;
    bottom: var(--space-6);
    right: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    z-index: 2000;
}

.toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    background: var(--surface);
    border-radius: 0.5rem;
    box-shadow: var(--shadow-lg);
    animation: slideIn 0.3s ease;
}

.toast.success {
    background: var(--success-color);
    color: white;
}

.toast.error {
    background: var(--danger-color);
    color: white;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
```

---

## 7. Grid Visualization

### 7.1 Grid Cell

```css
.grid-cell {
    border: 1px solid var(--border);
    min-height: 50px;
    position: relative;
    cursor: pointer;
    transition: all 0.2s;
}

.grid-cell:hover {
    box-shadow: inset 0 0 0 2px var(--primary-color);
    z-index: 10;
}

/* Heat levels */
.grid-cell.heat-0 { background: var(--heat-0); }
.grid-cell.heat-1 { background: var(--heat-1); }
.grid-cell.heat-2 { background: var(--heat-2); }
.grid-cell.heat-3 { background: var(--heat-3); }
.grid-cell.heat-4 { background: var(--heat-4); }
.grid-cell.heat-5 { background: var(--heat-5); }
.grid-cell.heat-6 { background: var(--heat-6); }
.grid-cell.heat-7 { background: var(--heat-7); }
.grid-cell.heat-8 { background: var(--heat-8); }
.grid-cell.heat-9 { background: var(--heat-9); }

/* Dead zone */
.grid-cell.dead {
    background: var(--dead-zone);
    border-style: dashed;
}
```

### 7.2 Grid Cell Tooltip

```css
.cell-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--background);
    color: var(--text-primary);
    padding: var(--space-3);
    border-radius: 0.5rem;
    box-shadow: var(--shadow-lg);
    font-size: var(--text-sm);
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s;
    z-index: 100;
}

.cell-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--background);
}

.grid-cell:hover .cell-tooltip {
    opacity: 1;
    visibility: visible;
    bottom: calc(100% + 8px);
}

.tooltip-stat {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
}

.tooltip-stat span:first-child {
    color: var(--text-muted);
}
```

### 7.3 Grid Legend

```css
.grid-legend {
    display: flex;
    justify-content: center;
    gap: var(--space-6);
    padding: var(--space-4);
}

.legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-muted);
}

.legend-color {
    width: 16px;
    height: 16px;
    border-radius: 4px;
}

.legend-color.cold { background: var(--heat-0); }
.legend-color.warm { background: var(--heat-4); }
.legend-color.hot { background: var(--heat-8); }
.legend-color.dead { 
    background: var(--dead-zone); 
    border: 1px dashed var(--dead-border);
}
```

---

## 8. Animations

### 8.1 Transitions

```css
/* Fast transitions */
.transition-fast {
    transition: all 0.15s ease;
}

/* Normal transitions */
.transition {
    transition: all 0.2s ease;
}

/* Slow transitions */
.transition-slow {
    transition: all 0.3s ease;
}
```

### 8.2 Hover Effects

```css
/* Scale */
.hover-scale:hover {
    transform: scale(1.02);
}

/* Shadow */
.hover-shadow:hover {
    box-shadow: var(--shadow-md);
}

/* Lift */
.hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}
```

### 8.3 Loading States

```css
.spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.skeleton {
    background: linear-gradient(
        90deg,
        var(--border) 0%,
        var(--background) 50%,
        var(--border) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
```

---

## 9. Accessibility

### 9.1 Focus States

```css
:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

/* Remove outline for mouse users */
:focus:not(:focus-visible) {
    outline: none;
}
```

### 9.2 Screen Reader

```css
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* Skip link */
.skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--primary-color);
    color: white;
    padding: var(--space-2) var(--space-4);
    z-index: 1000;
}

.skip-link:focus {
    top: 0;
}
```

### 9.3 Color Contrast

| Element | Color | Contrast Ratio | WCAG |
|---------|-------|----------------|------|
| Text on Background | #1e293b on #f8fafc | 12.6:1 | AAA |
| Text on Surface | #1e293b on #ffffff | 15.9:1 | AAA |
| Link on Background | #2563eb on #f8fafc | 4.8:1 | AA |
| Danger on White | #ef4444 on #ffffff | 4.6:1 | AA |

---

## 10. Responsive Design

### 10.1 Breakpoints

```css
/* Extra small devices (phones) */
@media (max-width: 575px) { }

/* Small devices (landscape phones) */
@media (min-width: 576px) and (max-width: 767px) { }

/* Medium devices (tablets) */
@media (min-width: 768px) and (max-width: 991px) { }

/* Large devices (desktops) */
@media (min-width: 992px) and (max-width: 1199px) { }

/* Extra large devices (large desktops) */
@media (min-width: 1200px) { }
```

### 10.2 Responsive Utilities

```css
/* Display */
.hidden { display: none; }
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }

/* Flex */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-end { justify-content: flex-end; }
.gap-2 { gap: var(--space-2); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }

/* Spacing */
.m-auto { margin: auto; }
.mx-auto { margin-left: auto; margin-right: auto; }
.p-4 { padding: var(--space-4); }
.px-4 { padding-left: var(--space-4); padding-right: var(--space-4); }
.py-4 { padding-top: var(--space-4); padding-bottom: var(--space-4); }

/* Text */
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: var(--font-bold); }
.text-sm { font-size: var(--text-sm); }
.text-muted { color: var(--text-muted); }

/* Responsive visibility */
@media (max-width: 767px) {
    .hide-mobile { display: none; }
}

@media (min-width: 768px) {
    .hide-desktop { display: none; }
}
```

---

*Document ends here*
