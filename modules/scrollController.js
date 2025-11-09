/**
 * ScrollController Module
 * Progressively scrolls to bottom with delays to trigger lazy loading
 */

const ScrollController = {
    /**
     * Scroll to bottom incrementally
     * @param {Object} options - Configuration options
     * @param {number} options.stepPx - Pixels to scroll per step (default: 800)
     * @param {number} options.delayMs - Delay between steps in ms (default: 150)
     * @param {number} options.maxScrolls - Maximum scroll iterations (default: 50)
     * @returns {Promise<Object>} Stats about scroll operation
     */
    async toBottom(options = {}) {
        const {
            stepPx = 800,
            delayMs = 150,
            maxScrolls = 50
        } = options;

        const stats = {
            totalScrolled: 0,
            iterations: 0,
            startScrollHeight: document.documentElement.scrollHeight,
            endScrollHeight: 0,
            duration: 0,
            startTime: performance.now()
        };

        let lastScrollHeight = 0;
        let unchangedCount = 0;

        for (let i = 0; i < maxScrolls; i++) {
            stats.iterations = i + 1;

            // Get current scroll position and height
            const currentScrollHeight = document.documentElement.scrollHeight;
            const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

            // Check if we've reached the bottom
            if (currentScrollTop + window.innerHeight >= currentScrollHeight - 10) {
                console.log('[EXL] ScrollController: Reached bottom');
                break;
            }

            // Check if content is still loading
            if (currentScrollHeight === lastScrollHeight) {
                unchangedCount++;
                if (unchangedCount >= 3) {
                    console.log('[EXL] ScrollController: No new content after 3 attempts, stopping');
                    break;
                }
            } else {
                unchangedCount = 0;
            }

            lastScrollHeight = currentScrollHeight;

            // Scroll by step
            window.scrollBy(0, stepPx);
            stats.totalScrolled += stepPx;

            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        stats.endScrollHeight = document.documentElement.scrollHeight;
        stats.duration = performance.now() - stats.startTime;

        console.log('[EXL] ScrollController: Complete', stats);
        return stats;
    },

    /**
     * Scroll to top of page
     * @param {boolean} smooth - Use smooth scrolling (default: true)
     */
    toTop(smooth = true) {
        window.scrollTo({
            top: 0,
            behavior: smooth ? 'smooth' : 'auto'
        });
    },

    /**
     * Scroll element into view
     * @param {string|Element} target - Selector or element
     * @param {Object} options - scrollIntoView options
     * @returns {boolean} True if successful
     */
    scrollIntoView(target, options = {}) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;

        if (!element) {
            console.warn('[EXL] ScrollController: Element not found');
            return false;
        }

        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            ...options
        });

        console.log('[EXL] ScrollController: Scrolled element into view');
        return true;
    },

    /**
     * Ensure full page is loaded by scrolling
     * @returns {Promise<Object>} Load stats
     */
    async ensureFullPageLoad() {
        console.log('[EXL] ScrollController: Ensuring full page load...');
        
        // Scroll to bottom to trigger lazy loading
        const scrollStats = await this.toBottom();
        
        // Scroll back to top
        this.toTop(false);
        
        // Wait for any final renders
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return scrollStats;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollController;
}
