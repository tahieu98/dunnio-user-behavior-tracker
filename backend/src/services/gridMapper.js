/**
 * Grid Mapper Service
 * Maps DOM elements to grid coordinates for heatmap visualization
 */

class GridMapper {
    constructor(config = {}) {
        this.config = {
            columns: config.columns || 12,
            rowHeight: config.rowHeight || 50,
            maxRows: config.maxRows || 100,
            viewportWidth: config.viewportWidth || 1920,
            ...config
        };
    }

    /**
     * Convert pixel position to grid coordinates
     */
    pixelToGrid(pixelX, pixelY) {
        const col = Math.min(
            Math.max(1, Math.ceil((pixelX / this.config.viewportWidth) * this.config.columns)),
            this.config.columns
        );

        const row = Math.min(
            Math.max(1, Math.ceil(pixelY / this.config.rowHeight)),
            this.config.maxRows
        );

        return { col, row };
    }

    /**
     * Convert grid coordinates to pixel range
     */
    gridToPixels(col, row) {
        const cellWidth = this.config.viewportWidth / this.config.columns;

        return {
            x: (col - 1) * cellWidth,
            y: (row - 1) * this.config.rowHeight,
            width: cellWidth,
            height: this.config.rowHeight
        };
    }

    /**
     * Map a DOM element to grid coordinates
     */
    elementToGrid(element) {
        const rect = element.getBoundingClientRect();
        const scrollY = window.scrollY || document.documentElement.scrollTop;

        // Get position relative to document
        const absoluteY = rect.top + scrollY;

        // Calculate grid positions
        const startPos = this.pixelToGrid(rect.left, absoluteY);
        const endPos = this.pixelToGrid(rect.right, absoluteY + rect.height);

        return {
            colStart: startPos.col,
            colEnd: endPos.col,
            rowStart: startPos.row,
            rowEnd: endPos.row,
            colSpan: endPos.col - startPos.col + 1,
            rowSpan: endPos.row - startPos.row + 1,
            pixels: {
                x: rect.left,
                y: absoluteY,
                width: rect.width,
                height: rect.height
            }
        };
    }

    /**
     * Get all elements within a grid cell
     */
    getElementsInCell(col, row) {
        const cellPixels = this.gridToPixels(col, row);
        const elements = [];

        // Create a range for the cell
        const cellRange = {
            left: cellPixels.x,
            right: cellPixels.x + cellPixels.width,
            top: cellPixels.y,
            bottom: cellPixels.y + cellPixels.height
        };

        // Get all clickable elements
        const allElements = document.querySelectorAll('a, button, input, [onclick], [role="button"], .clickable');

        allElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const absoluteY = rect.top + scrollY;

            const elRange = {
                left: rect.left,
                right: rect.right,
                top: absoluteY,
                bottom: absoluteY + rect.height
            };

            // Check if element overlaps with cell
            if (this.rangesOverlap(cellRange, elRange)) {
                elements.push(el);
            }
        });

        return elements;
    }

    /**
     * Check if two ranges overlap
     */
    rangesOverlap(a, b) {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }

    /**
     * Generate grid overlay data for a page
     */
    generateGridData(viewportHeight = 5000) {
        const rows = Math.ceil(viewportHeight / this.config.rowHeight);
        const cells = [];

        for (let row = 1; row <= Math.min(rows, this.config.maxRows); row++) {
            for (let col = 1; col <= this.config.columns; col++) {
                const pixels = this.gridToPixels(col, row);
                cells.push({
                    col,
                    row,
                    x: pixels.x,
                    y: pixels.y,
                    width: pixels.width,
                    height: pixels.height,
                    elements: this.getElementsInCell(col, row).length
                });
            }
        }

        return {
            columns: this.config.columns,
            rowHeight: this.config.rowHeight,
            totalRows: rows,
            cells
        };
    }

    /**
     * Calculate heat level for a cell based on click density
     */
    calculateHeatLevel(clickCount, maxClicks = 100) {
        if (clickCount === 0) return 0;

        const ratio = Math.min(clickCount / maxClicks, 1);

        // Color gradient: blue (cold) -> green -> yellow -> orange -> red (hot)
        if (ratio < 0.2) return 1;  // Light blue
        if (ratio < 0.4) return 2;  // Blue-green
        if (ratio < 0.6) return 3;  // Green
        if (ratio < 0.8) return 4;  // Yellow
        return 5;                    // Orange-red (hot)
    }

    /**
     * Convert element selector to readable description
     */
    selectorToDescription(selector) {
        const parts = selector.split(' ');
        const lastPart = parts[parts.length - 1];

        // Clean up selector
        let description = lastPart
            .replace(/^#/, 'ID: ')
            .replace(/^\./, 'Class: ')
            .replace(/\[.*?\]/, '');

        return description || selector;
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridMapper;
} else if (typeof window !== 'undefined') {
    window.GridMapper = GridMapper;
}
