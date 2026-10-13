/**
 * CTA Suggestion Engine
 * Analyzes page data and generates actionable CTA suggestions
 */

class CtaEngine {
    constructor() {
        this.suggestionTemplates = {
            cta_button: {
                title: 'Add Call-to-Action Button',
                difficulty: 'easy',
                estimatedTime: '15 minutes'
            },
            internal_link: {
                title: 'Add Internal Link',
                difficulty: 'easy',
                estimatedTime: '10 minutes'
            },
            promo_banner: {
                title: 'Add Promotional Banner',
                difficulty: 'medium',
                estimatedTime: '30 minutes'
            },
            product_feature: {
                title: 'Highlight Product Feature',
                difficulty: 'easy',
                estimatedTime: '20 minutes'
            },
            form_improvement: {
                title: 'Improve Form/CTA',
                difficulty: 'medium',
                estimatedTime: '45 minutes'
            },
            content_gap: {
                title: 'Address Content Gap',
                difficulty: 'hard',
                estimatedTime: '1-2 hours'
            }
        };

        this.categoryContext = {
            suits: {
                suggestions: ['Book appointment', 'View fabric options', 'Customize now'],
                ctaText: 'Get Your Perfect Suit',
                promoContext: 'Summer/Winter suit promotions'
            },
            shirts: {
                suggestions: ['Design your shirt', 'View measurements guide'],
                ctaText: 'Create Your Custom Shirt',
                promoContext: 'Shirt bundles'
            },
            pants: {
                suggestions: ['Get measured', 'View fabrics'],
                ctaText: 'Tailor Your Pants',
                promoContext: 'Buy 2 get 1 deal'
            },
            tuxedo: {
                suggestions: ['Plan your event look', 'View style guide'],
                ctaText: 'Look Your Best',
                promoContext: 'Wedding season deals'
            },
            wedding: {
                suggestions: ['Wedding packages', 'Groom consultation'],
                ctaText: 'Plan Your Wedding Look',
                promoContext: 'Wedding season promotions'
            },
            business: {
                suggestions: ['Corporate packages', 'Bulk orders'],
                ctaText: 'Outfit Your Team',
                promoContext: 'Corporate discounts'
            },
            party: {
                suggestions: ['Limited designs', 'Express delivery'],
                ctaText: 'Party Ready',
                promoContext: 'Party season specials'
            },
            casual: {
                suggestions: ['View lookbook', 'Mix and match'],
                ctaText: 'Casual Collection',
                promoContext: 'Seasonal styles'
            },
            '3d-demo': {
                suggestions: ['Start designing', 'Try it now'],
                ctaText: 'Design Your Own',
                promoContext: 'Interactive experience'
            }
        };
    }

    /**
     * Analyze dead zones and generate suggestions
     */
    analyzeDeadZones(deadZones, pageCategory, pageData = {}) {
        const suggestions = [];
        const context = this.getCategoryContext(pageCategory);

        for (const zone of deadZones) {
            const suggestion = this.generateSuggestion(zone, context, pageCategory);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }

        return suggestions;
    }

    /**
     * Generate a suggestion for a dead zone
     */
    generateSuggestion(zone, context, pageCategory) {
        const { grid_col, grid_row, pixel_y } = zone;

        // Determine suggestion type based on position
        let type = 'cta_button';
        let priority = 5;

        // Top of page (hero area) - main CTA
        if (grid_row <= 3) {
            type = 'promo_banner';
            priority = 10;
        }
        // Middle of page - content/link suggestions
        else if (grid_row <= 8) {
            type = 'internal_link';
            priority = 7;
        }
        // Lower page - urgency CTA
        else if (grid_row >= 10) {
            type = 'cta_button';
            priority = 8;
        }

        // Product pages get product feature suggestions
        if (pageCategory === 'suits' || pageCategory === 'tuxedo') {
            if (grid_row >= 5 && grid_row <= 10) {
                type = 'product_feature';
            }
        }

        // Wedding pages get promo banners
        if (pageCategory === 'wedding' && grid_row <= 5) {
            type = 'promo_banner';
            priority = 9;
        }

        const template = this.suggestionTemplates[type];
        const suggestions = context?.suggestions || ['Contact us'];
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

        return {
            suggestion_type: type,
            suggestion_title: template.title,
            suggestion_text: `Add ${randomSuggestion} at row ${grid_row}`,
            suggestion_code: this.generateSuggestionCode(type, context),
            priority: priority,
            difficulty: template.difficulty,
            grid_col,
            grid_row,
            estimated_time: template.estimatedTime
        };
    }

    /**
     * Get context-specific content for a category
     */
    getCategoryContext(category) {
        const normalizedCategory = category?.toLowerCase().replace('-', '_');

        for (const [key, context] of Object.entries(this.categoryContext)) {
            if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
                return context;
            }
        }

        return this.categoryContext.suits; // Default
    }

    /**
     * Generate HTML code snippet for the suggestion
     */
    generateSuggestionCode(type, context) {
        const ctaText = context?.ctaText || 'Learn More';

        switch (type) {
            case 'cta_button':
                return `<a href="/contact" class="btn btn-primary">${ctaText}</a>`;

            case 'internal_link':
                return `<a href="/products" class="related-link">View similar products →</a>`;

            case 'promo_banner':
                return `<div class="promo-banner">
    <h3>${context?.promoContext || 'Special Offer'}</h3>
    <a href="/promotions" class="btn">Shop Now</a>
</div>`;

            case 'product_feature':
                return `<div class="feature-highlight">
    <span class="feature-icon">✓</span>
    <span>Premium fabric quality</span>
</div>`;

            default:
                return `<button class="cta-btn">${ctaText}</button>`;
        }
    }

    /**
     * Calculate impact score for a suggestion
     */
    calculateImpactScore(suggestion, pageMetrics = {}) {
        let score = 50; // Base score

        // Position factor
        if (suggestion.grid_row <= 3) {
            score += 30; // Above fold = high impact
        } else if (suggestion.grid_row <= 8) {
            score += 15; // Mid page
        }

        // Traffic factor
        const pageviews = pageMetrics.total_pageviews || 0;
        if (pageviews > 1000) {
            score += 20;
        } else if (pageviews > 500) {
            score += 10;
        }

        // Difficulty factor
        if (suggestion.difficulty === 'easy') {
            score += 10;
        } else if (suggestion.difficulty === 'hard') {
            score -= 10;
        }

        return Math.min(Math.max(score, 0), 100);
    }

    /**
     * Get suggestions summary by type
     */
    summarizeSuggestions(suggestions) {
        const summary = {
            total: suggestions.length,
            byType: {},
            byPriority: { high: 0, medium: 0, low: 0 },
            estimated_effort: 0
        };

        suggestions.forEach(s => {
            // Count by type
            summary.byType[s.suggestion_type] = (summary.byType[s.suggestion_type] || 0) + 1;

            // Count by priority
            if (s.priority >= 8) {
                summary.byPriority.high++;
            } else if (s.priority >= 5) {
                summary.byPriority.medium++;
            } else {
                summary.byPriority.low++;
            }

            // Estimate effort
            const effortMap = { easy: 15, medium: 30, hard: 60 };
            summary.estimated_effort += effortMap[s.difficulty] || 30;
        });

        return summary;
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CtaEngine;
} else if (typeof window !== 'undefined') {
    window.CtaEngine = CtaEngine;
}
