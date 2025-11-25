/**
 * 3D Sphere Color Picker Module
 * Provides a 3D interactive color picker with preset color palette
 */

const ColorPicker3D = {
    // Preset colors - organized by category
    PRESET_COLORS: {
        light: [
            { hex: '#FEF0EC', rgb: 'rgb(254, 240, 236)' },
            { hex: '#FFF7ED', rgb: 'rgb(255, 247, 237)' },
            { hex: '#FEFCE8', rgb: 'rgb(254, 252, 232)' },
            { hex: '#F0FDF4', rgb: 'rgb(240, 253, 244)' },
            { hex: '#ECFDF5', rgb: 'rgb(236, 253, 245)' },
            { hex: '#ECFEFF', rgb: 'rgb(236, 254, 255)' },
            { hex: '#EFF6FF', rgb: 'rgb(239, 246, 255)' },
            { hex: '#EEF2FF', rgb: 'rgb(238, 242, 255)' },
            { hex: '#F5F3FF', rgb: 'rgb(245, 243, 255)' },
            { hex: '#FDF2F8', rgb: 'rgb(253, 242, 248)' },
            { hex: '#FFF1F2', rgb: 'rgb(255, 241, 242)' },
            { hex: '#F8FAFC', rgb: 'rgb(248, 250, 252)' }
        ],
        bright: [
            { hex: '#F97316', rgb: 'rgb(249, 115, 22)' },
            { hex: '#FF4500', rgb: 'rgb(255, 69, 0)' },
            { hex: '#F59E0B', rgb: 'rgb(245, 158, 11)' },
            { hex: '#84CC16', rgb: 'rgb(132, 204, 22)' },
            { hex: '#22C55E', rgb: 'rgb(34, 197, 94)' },
            { hex: '#10B981', rgb: 'rgb(16, 185, 129)' },
            { hex: '#06B6D4', rgb: 'rgb(6, 182, 212)' },
            { hex: '#3B82F6', rgb: 'rgb(59, 130, 246)' },
            { hex: '#6366F1', rgb: 'rgb(99, 102, 241)' },
            { hex: '#8B5CF6', rgb: 'rgb(139, 92, 246)' },
            { hex: '#EC4899', rgb: 'rgb(236, 72, 153)' },
            { hex: '#6B7280', rgb: 'rgb(107, 114, 128)' }
        ],
        dark: [
            { hex: '#9A3412', rgb: 'rgb(154, 52, 18)' },
            { hex: '#991B1B', rgb: 'rgb(153, 27, 27)' },
            { hex: '#B45309', rgb: 'rgb(180, 83, 9)' },
            { hex: '#4D7C0F', rgb: 'rgb(77, 124, 15)' },
            { hex: '#15803D', rgb: 'rgb(21, 128, 61)' },
            { hex: '#047857', rgb: 'rgb(4, 120, 87)' },
            { hex: '#087EA4', rgb: 'rgb(8, 126, 164)' },
            { hex: '#1D4ED8', rgb: 'rgb(29, 78, 216)' },
            { hex: '#4338CA', rgb: 'rgb(67, 56, 202)' },
            { hex: '#6D28D9', rgb: 'rgb(109, 40, 217)' },
            { hex: '#DB2777', rgb: 'rgb(219, 39, 119)' },
            { hex: '#374151', rgb: 'rgb(55, 65, 81)' }
        ],
        labelsLightest: [
            { hex: '#E6F6FF', rgb: 'rgb(230, 246, 255)' },
            { hex: '#DBEFFF', rgb: 'rgb(219, 239, 255)' },
            { hex: '#DDF2DB', rgb: 'rgb(221, 242, 219)' },
            { hex: '#FFF9DB', rgb: 'rgb(255, 249, 219)' },
            { hex: '#FFF5DD', rgb: 'rgb(255, 245, 221)' },
            { hex: '#FFEDDD', rgb: 'rgb(255, 237, 221)' },
            { hex: '#FFE8E6', rgb: 'rgb(255, 232, 230)' },
            { hex: '#FFE8EF', rgb: 'rgb(255, 232, 239)' },
            { hex: '#F9E8FF', rgb: 'rgb(249, 232, 255)' },
            { hex: '#EDEBFF', rgb: 'rgb(237, 235, 255)' },
            { hex: '#EAECEF', rgb: 'rgb(234, 236, 241)' }
        ],
        labelsLightMedium: [
            { hex: '#BFE5FF', rgb: 'rgb(191, 229, 255)' },
            { hex: '#A6D9FF', rgb: 'rgb(166, 217, 255)' },
            { hex: '#A8E0A5', rgb: 'rgb(168, 224, 165)' },
            { hex: '#FFEEA3', rgb: 'rgb(255, 238, 163)' },
            { hex: '#FFE4A8', rgb: 'rgb(255, 228, 168)' },
            { hex: '#FFD4A8', rgb: 'rgb(255, 212, 168)' },
            { hex: '#FFC7C2', rgb: 'rgb(255, 199, 194)' },
            { hex: '#FFC7D8', rgb: 'rgb(255, 199, 216)' },
            { hex: '#EEC7FF', rgb: 'rgb(238, 199, 255)' },
            { hex: '#D4CFFF', rgb: 'rgb(212, 207, 255)' },
            { hex: '#CCCFD8', rgb: 'rgb(204, 207, 216)' }
        ],
        labelsMediumDark: [
            { hex: '#66BBFF', rgb: 'rgb(102, 187, 255)' },
            { hex: '#40B5FF', rgb: 'rgb(64, 181, 255)' },
            { hex: '#4DBF48', rgb: 'rgb(77, 191, 72)' },
            { hex: '#FFDB3B', rgb: 'rgb(255, 219, 59)' },
            { hex: '#FFC74D', rgb: 'rgb(255, 199, 77)' },
            { hex: '#FFA34D', rgb: 'rgb(255, 163, 77)' },
            { hex: '#FF756B', rgb: 'rgb(255, 117, 107)' },
            { hex: '#FF7599', rgb: 'rgb(255, 117, 153)' },
            { hex: '#D675FF', rgb: 'rgb(214, 117, 255)' },
            { hex: '#8A80FF', rgb: 'rgb(138, 128, 255)' },
            { hex: '#7A808E', rgb: 'rgb(122, 128, 142)' }
        ],
        labelsDarkest: [
            { hex: '#3399FF', rgb: 'rgb(51, 153, 255)' },
            { hex: '#0091FF', rgb: 'rgb(0, 145, 255)' },
            { hex: '#26A621', rgb: 'rgb(38, 166, 33)' },
            { hex: '#FFCC00', rgb: 'rgb(255, 204, 0)' },
            { hex: '#FFA800', rgb: 'rgb(255, 168, 0)' },
            { hex: '#FF7300', rgb: 'rgb(255, 115, 0)' },
            { hex: '#FF4033', rgb: 'rgb(255, 64, 51)' },
            { hex: '#FF4070', rgb: 'rgb(255, 64, 112)' },
            { hex: '#BA33FF', rgb: 'rgb(186, 51, 255)' },
            { hex: '#5247FF', rgb: 'rgb(82, 71, 255)' },
            { hex: '#4D525E', rgb: 'rgb(77, 82, 94)' }
        ]
    },
    
    /**
     * Create a color picker instance
     * @param {Object} options - Configuration options
     * @param {string} options.currentColor - Initial color in RGB format (e.g., 'rgb(255, 0, 0)')
     * @param {Function} options.onColorChange - Callback when color changes
     * @param {Function} options.onApply - Callback when Apply is clicked
     * @param {Function} options.onCancel - Callback when Cancel is clicked
     * @returns {HTMLElement} Color picker container element
     */
    create(containerId, options = {}) {
        const {
            currentColor = 'rgb(128, 128, 128)',
            onColorChange = () => {},
            onApply = () => {},
            onCancel = () => {}
        } = options;
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[ColorPicker3D] Container not found:', containerId);
            return null;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Parse initial color
        const initialColor = this.parseRgb(currentColor);
        if (!initialColor) {
            console.error('[ColorPicker3D] Invalid initial color:', currentColor);
            return null;
        }
        
        // Create color picker HTML structure
        const pickerHTML = this.createPickerHTML();
        container.innerHTML = pickerHTML;
        
        // Get elements
        const canvas = container.querySelector('#exl-colorSphere');
        const colorDisplay = container.querySelector('#exl-color-display');
        const rgbValue = container.querySelector('#exl-rgb-value');
        const hexValue = container.querySelector('#exl-hex-value');
        const hslValue = container.querySelector('#exl-hsl-value');
        const presetColorsContainer = container.querySelector('#exl-preset-colors');
        const applyBtn = container.querySelector('#exl-color-picker-apply');
        const cancelBtn = container.querySelector('#exl-color-picker-cancel');
        
        // Initialize state
        let currentColorState = { ...initialColor };
        let rotationX = 0;
        let rotationY = 0;
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        let animationFrameId = null;
        
        // Initialize canvas
        const ctx = canvas.getContext('2d');
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        const radius = canvas.width / 2 - 10;
        
        // Create preset colors grid
        this.renderPresetColors(presetColorsContainer, currentColorState, (color) => {
            currentColorState = color;
            updateColorDisplay();
            onColorChange(this.rgbToString(currentColorState));
        });
        
        // Update color display
        const updateColorDisplay = () => {
            const rgbStr = this.rgbToString(currentColorState);
            const hexStr = this.rgbToHex(currentColorState);
            const hslStr = this.rgbToHsl(currentColorState);
            
            colorDisplay.style.backgroundColor = rgbStr;
            rgbValue.textContent = rgbStr;
            hexValue.textContent = hexStr;
            hslValue.textContent = hslStr;
            
            onColorChange(rgbStr);
        };
        
        // Initialize display
        updateColorDisplay();
        
        // Draw sphere
        const drawSphere = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw base sphere with current color
            ctx.save();
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = this.rgbToString(currentColorState);
            ctx.fill();
            
            // Draw lighting effect
            const gradient = ctx.createRadialGradient(
                center.x + radius * 0.3,
                center.y - radius * 0.3,
                radius * 0.1,
                center.x,
                center.y,
                radius
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.5, 'rgba(200, 200, 200, 0.5)');
            gradient.addColorStop(1, 'rgba(50, 50, 50, 0.3)');
            
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Draw outline
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
            
            // Draw color map on sphere
            this.drawColorMap(ctx, canvas, center, radius, rotationX, rotationY, currentColorState);
        };
        
        // Color update from sphere position
        const updateColorFromSpherePosition = (x, y) => {
            const normX = (x - center.x) / radius;
            const normY = (y - center.y) / radius;
            const distFromCenter = Math.sqrt(normX * normX + normY * normY);
            
            if (distFromCenter <= 1) {
                const normZ = Math.sqrt(1 - (normX * normX + normY * normY));
                
                // Apply rotation matrix
                const cosX = Math.cos(rotationX);
                const sinX = Math.sin(rotationX);
                const cosY = Math.cos(rotationY);
                const sinY = Math.sin(rotationY);
                
                let x1 = normX;
                let y1 = cosX * normY - sinX * normZ;
                let z1 = sinX * normY + cosX * normZ;
                
                let x2 = cosY * x1 + sinY * z1;
                let y2 = y1;
                let z2 = -sinY * x1 + cosY * z1;
                
                // Convert to color (0-255)
                currentColorState.r = Math.round((x2 + 1) * 127.5);
                currentColorState.g = Math.round((y2 + 1) * 127.5);
                currentColorState.b = Math.round((z2 + 1) * 127.5);
            }
        };
        
        // Drag handlers
        const startDrag = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            lastMouseX = clientX - rect.left;
            lastMouseY = clientY - rect.top;
            isDragging = true;
        };
        
        const drag = (e) => {
            if (!isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const mouseX = clientX - rect.left;
            const mouseY = clientY - rect.top;
            
            const deltaX = mouseX - lastMouseX;
            const deltaY = mouseY - lastMouseY;
            
            rotationY += deltaX * 0.01;
            rotationX += deltaY * 0.01;
            
            rotationX = rotationX % (Math.PI * 2);
            rotationY = rotationY % (Math.PI * 2);
            
            lastMouseX = mouseX;
            lastMouseY = mouseY;
            
            updateColorFromSpherePosition(mouseX, mouseY);
            
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            animationFrameId = requestAnimationFrame(() => {
                drawSphere();
                updateColorDisplay();
            });
        };
        
        const endDrag = () => {
            isDragging = false;
        };
        
        // Event listeners
        canvas.addEventListener('mousedown', startDrag);
        canvas.addEventListener('mousemove', drag);
        canvas.addEventListener('mouseup', endDrag);
        canvas.addEventListener('mouseleave', endDrag);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag(e); });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); drag(e); });
        canvas.addEventListener('touchend', endDrag);
        
        // Button handlers
        applyBtn.addEventListener('click', () => {
            onApply(this.rgbToString(currentColorState));
        });
        
        cancelBtn.addEventListener('click', () => {
            onCancel();
        });
        
        // Initial draw
        drawSphere();
        
        return container;
    },
    
    /**
     * Create HTML structure for color picker
     * @returns {string} HTML string
     */
    createPickerHTML() {
        return `
            <div class="exl-color-picker-wrapper">
                <div class="exl-color-picker-main">
                    <div id="exl-color-sphere-container">
                        <canvas id="exl-colorSphere" width="300" height="300"></canvas>
                    </div>
                    <div class="exl-color-info-panel">
                        <div class="exl-color-display" id="exl-color-display"></div>
                        <div class="exl-color-values">
                            <div class="exl-color-value">
                                <label>RGB:</label>
                                <span id="exl-rgb-value">rgb(128, 128, 128)</span>
                            </div>
                            <div class="exl-color-value">
                                <label>HEX:</label>
                                <span id="exl-hex-value">#808080</span>
                            </div>
                            <div class="exl-color-value">
                                <label>HSL:</label>
                                <span id="exl-hsl-value">hsl(0, 0%, 50%)</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="exl-preset-colors-container">
                    <div class="exl-preset-colors-label">Preset Colors</div>
                    <div id="exl-preset-colors" class="exl-preset-colors"></div>
                </div>
                <div class="exl-color-picker-actions">
                    <button id="exl-color-picker-cancel" class="exl-btn-cancel">Cancel</button>
                    <button id="exl-color-picker-apply" class="exl-btn-apply">Apply</button>
                </div>
            </div>
        `;
    },
    
    /**
     * Render preset colors grid
     * @param {HTMLElement} container - Container element
     * @param {Object} currentColor - Current selected color {r, g, b}
     * @param {Function} onSelect - Callback when color is selected
     */
    renderPresetColors(container, currentColor, onSelect) {
        container.innerHTML = '';
        
        // Create rows for each preset category
        const categories = [
            { key: 'light', label: 'Light' },
            { key: 'bright', label: 'Bright' },
            { key: 'dark', label: 'Dark' },
            { key: 'labelsLightest', label: 'Labels Lightest' },
            { key: 'labelsLightMedium', label: 'Labels Light-Medium' },
            { key: 'labelsMediumDark', label: 'Labels Medium-Dark' },
            { key: 'labelsDarkest', label: 'Labels Darkest' }
        ];
        
        categories.forEach(category => {
            const colors = this.PRESET_COLORS[category.key];
            if (!colors) return;
            
            const row = document.createElement('div');
            row.className = 'exl-preset-color-row';
            
            colors.forEach(colorObj => {
                const swatch = document.createElement('div');
                swatch.className = 'exl-preset-color-swatch';
                swatch.style.backgroundColor = colorObj.rgb;
                swatch.title = `${colorObj.hex} - ${colorObj.rgb}`;
                
                // Check if this is the current color
                const parsedColor = this.parseRgb(colorObj.rgb);
                if (parsedColor && this.colorsMatch(parsedColor, currentColor)) {
                    swatch.classList.add('exl-preset-selected');
                }
                
                swatch.addEventListener('click', () => {
                    const newColor = this.parseRgb(colorObj.rgb);
                    if (newColor) {
                        // Update selected state
                        container.querySelectorAll('.exl-preset-color-swatch').forEach(s => {
                            s.classList.remove('exl-preset-selected');
                        });
                        swatch.classList.add('exl-preset-selected');
                        onSelect(newColor);
                    }
                });
                
                row.appendChild(swatch);
            });
            
            container.appendChild(row);
        });
    },
    
    /**
     * Draw color map on sphere surface
     */
    drawColorMap(ctx, canvas, center, radius, rotationX, rotationY, currentColor) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let x = 0; x < canvas.width; x++) {
            for (let y = 0; y < canvas.height; y++) {
                const normX = (x - center.x) / radius;
                const normY = (y - center.y) / radius;
                const distFromCenter = Math.sqrt(normX * normX + normY * normY);
                
                if (distFromCenter <= 1) {
                    const normZ = Math.sqrt(1 - (normX * normX + normY * normY));
                    
                    // Apply rotation matrix
                    const cosX = Math.cos(rotationX);
                    const sinX = Math.sin(rotationX);
                    const cosY = Math.cos(rotationY);
                    const sinY = Math.sin(rotationY);
                    
                    let x1 = normX;
                    let y1 = cosX * normY - sinX * normZ;
                    let z1 = sinX * normY + cosX * normZ;
                    
                    let x2 = cosY * x1 + sinY * z1;
                    let y2 = y1;
                    let z2 = -sinY * x1 + cosY * z1;
                    
                    // Convert to color
                    const r = Math.round((x2 + 1) * 127.5);
                    const g = Math.round((y2 + 1) * 127.5);
                    const b = Math.round((z2 + 1) * 127.5);
                    
                    // Apply lighting based on Z coordinate
                    const lighting = 0.7 + 0.5 * z2;
                    
                    const i = (y * canvas.width + x) * 4;
                    data[i] = Math.min(255, Math.round(r * lighting));
                    data[i + 1] = Math.min(255, Math.round(g * lighting));
                    data[i + 2] = Math.min(255, Math.round(b * lighting));
                    data[i + 3] = 255;
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    },
    
    /**
     * Parse RGB string to object
     * @param {string} rgbStr - RGB string (e.g., 'rgb(255, 0, 0)')
     * @returns {Object|null} Color object {r, g, b} or null
     */
    parseRgb(rgbStr) {
        if (!rgbStr) return null;
        
        // Handle hex format
        if (rgbStr.startsWith('#')) {
            const hex = rgbStr.substring(1);
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return { r, g, b };
        }
        
        // Handle rgb() format
        const match = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return {
                r: parseInt(match[1], 10),
                g: parseInt(match[2], 10),
                b: parseInt(match[3], 10)
            };
        }
        
        return null;
    },
    
    /**
     * Convert RGB object to string
     * @param {Object} color - Color object {r, g, b}
     * @returns {string} RGB string
     */
    rgbToString(color) {
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    },
    
    /**
     * Convert RGB object to hex string
     * @param {Object} color - Color object {r, g, b}
     * @returns {string} Hex string
     */
    rgbToHex(color) {
        const toHex = (n) => n.toString(16).padStart(2, '0');
        return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    },
    
    /**
     * Convert RGB object to HSL string
     * @param {Object} color - Color object {r, g, b}
     * @returns {string} HSL string
     */
    rgbToHsl(color) {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        h = Math.round(h * 360);
        s = Math.round(s * 100);
        l = Math.round(l * 100);
        
        return `hsl(${h}, ${s}%, ${l}%)`;
    },
    
    /**
     * Check if two colors match (within tolerance)
     * @param {Object} color1 - Color object {r, g, b}
     * @param {Object} color2 - Color object {r, g, b}
     * @returns {boolean} True if colors match
     */
    colorsMatch(color1, color2) {
        return color1.r === color2.r && color1.g === color2.g && color1.b === color2.b;
    }
};

