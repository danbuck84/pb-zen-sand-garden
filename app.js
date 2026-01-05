/**
 * Zen Sand Garden
 * A meditative sand garden simulation with a rotating dual-sided blade
 */

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        // Sand appearance
        sand: {
            baseColor: { r: 245, g: 240, b: 230 },      // #F5F0E6 - light cream
            shadowColor: { r: 200, g: 190, b: 175 },    // Darker for valleys
            highlightColor: { r: 255, g: 252, b: 248 }, // Lighter for peaks
            grainDensity: 0.3
        },
        
        // Garden dimensions
        garden: {
            padding: 20,           // Padding from screen edge
            frameWidth: 12,        // Dark rim width
            frameColor: '#2D2D2D'
        },
        
        // Blade settings
        blade: {
            rotationSpeed: 0.0008,  // Radians per frame (slow, meditative)
            width: 8,               // Blade thickness
            color: '#FAFAFA',
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            centerRadius: 12        // Center pivot size
        },
        
        // Wave pattern (comb side)
        waves: {
            count: 14,              // Number of concentric waves
            amplitude: 1.0,         // Height of waves
            sharpness: 0.7          // How sharp the wave peaks are
        },
        
        // Interaction
        touch: {
            radius: 25,             // Size of disturbance
            strength: 2.5,          // How much the sand is displaced
            dragMultiplier: 0.8     // Reduced strength while dragging
        },
        
        // Simulation
        simulation: {
            gridResolution: 2,      // Pixels per grid cell (lower = more detail, slower)
            healingRate: 0.85,      // How quickly blade heals disturbances (0-1)
            waveApplicationRate: 0.9 // How strongly waves are applied
        }
    };

    // ==================== STATE ====================
    let canvas, ctx;
    let gardenRadius, centerX, centerY;
    let bladeAngle = 0;
    let heightMap = [];
    let gridWidth, gridHeight;
    let isInteracting = false;
    let lastTouchPos = null;
    let animationId = null;

    // ==================== AUDIO HOOKS (for future) ====================
    const AudioManager = {
        initialized: false,
        
        init() {
            // Placeholder for future audio initialization
            this.initialized = true;
        },
        
        playAmbient() {
            // Future: play ambient zen music/sounds
        },
        
        stopAmbient() {
            // Future: stop ambient sounds
        },
        
        playDisturbSound(intensity) {
            // Future: play sand disturbance sound
            // intensity: 0-1 based on how much sand was moved
        },
        
        playBladeSound() {
            // Future: subtle blade movement sound
        }
    };

    // ==================== INITIALIZATION ====================
    function init() {
        canvas = document.getElementById('garden');
        ctx = canvas.getContext('2d');
        
        setupCanvas();
        initHeightMap();
        setupEventListeners();
        
        // Start the animation loop
        animate();
    }

    function setupCanvas() {
        // Set canvas to fill viewport
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(dpr, dpr);
        
        // Calculate garden dimensions (fit circle in viewport with padding)
        const minDimension = Math.min(window.innerWidth, window.innerHeight);
        gardenRadius = (minDimension / 2) - CONFIG.garden.padding - CONFIG.garden.frameWidth;
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight / 2;
    }

    function initHeightMap() {
        // Create height map grid
        const resolution = CONFIG.simulation.gridResolution;
        gridWidth = Math.ceil((gardenRadius * 2) / resolution);
        gridHeight = Math.ceil((gardenRadius * 2) / resolution);
        
        heightMap = [];
        for (let y = 0; y < gridHeight; y++) {
            heightMap[y] = [];
            for (let x = 0; x < gridWidth; x++) {
                heightMap[y][x] = 0; // Start flat
            }
        }
        
        // Apply initial wave pattern
        applyFullWavePattern();
    }

    function applyFullWavePattern() {
        // Apply wave pattern to entire garden (initial state)
        const resolution = CONFIG.simulation.gridResolution;
        const waves = CONFIG.waves;
        
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                // Convert grid coords to world coords
                const worldX = (x * resolution) - gardenRadius;
                const worldY = (y * resolution) - gardenRadius;
                const dist = Math.sqrt(worldX * worldX + worldY * worldY);
                
                if (dist < gardenRadius - 5) {
                    // Create concentric waves based on distance from center
                    const waveFreq = waves.count / gardenRadius;
                    const waveVal = Math.sin(dist * waveFreq * Math.PI * 2);
                    heightMap[y][x] = waveVal * waves.amplitude;
                }
            }
        }
    }

    // ==================== EVENT HANDLING ====================
    function setupEventListeners() {
        // Mouse events
        canvas.addEventListener('mousedown', handleInteractionStart);
        canvas.addEventListener('mousemove', handleInteractionMove);
        canvas.addEventListener('mouseup', handleInteractionEnd);
        canvas.addEventListener('mouseleave', handleInteractionEnd);
        
        // Touch events
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleInteractionEnd);
        canvas.addEventListener('touchcancel', handleInteractionEnd);
        
        // Resize
        window.addEventListener('resize', handleResize);
    }

    function handleInteractionStart(e) {
        e.preventDefault();
        isInteracting = true;
        const pos = getEventPos(e);
        lastTouchPos = pos;
        disturbSand(pos.x, pos.y, CONFIG.touch.strength);
    }

    function handleInteractionMove(e) {
        if (!isInteracting) return;
        e.preventDefault();
        const pos = getEventPos(e);
        
        if (lastTouchPos) {
            // Create disturbance along the drag path
            const dx = pos.x - lastTouchPos.x;
            const dy = pos.y - lastTouchPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.ceil(dist / 5);
            
            for (let i = 0; i <= steps; i++) {
                const t = steps > 0 ? i / steps : 0;
                const x = lastTouchPos.x + dx * t;
                const y = lastTouchPos.y + dy * t;
                disturbSand(x, y, CONFIG.touch.strength * CONFIG.touch.dragMultiplier);
            }
        }
        
        lastTouchPos = pos;
    }

    function handleInteractionEnd(e) {
        isInteracting = false;
        lastTouchPos = null;
    }

    function handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            isInteracting = true;
            const pos = getTouchPos(e.touches[0]);
            lastTouchPos = pos;
            disturbSand(pos.x, pos.y, CONFIG.touch.strength);
        }
    }

    function handleTouchMove(e) {
        if (!isInteracting) return;
        e.preventDefault();
        if (e.touches.length > 0) {
            const pos = getTouchPos(e.touches[0]);
            
            if (lastTouchPos) {
                const dx = pos.x - lastTouchPos.x;
                const dy = pos.y - lastTouchPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const steps = Math.ceil(dist / 5);
                
                for (let i = 0; i <= steps; i++) {
                    const t = steps > 0 ? i / steps : 0;
                    const x = lastTouchPos.x + dx * t;
                    const y = lastTouchPos.y + dy * t;
                    disturbSand(x, y, CONFIG.touch.strength * CONFIG.touch.dragMultiplier);
                }
            }
            
            lastTouchPos = pos;
        }
    }

    function getEventPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function getTouchPos(touch) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    function handleResize() {
        setupCanvas();
        initHeightMap();
    }

    // ==================== SAND DISTURBANCE ====================
    function disturbSand(screenX, screenY, strength) {
        // Convert screen coords to grid coords
        const resolution = CONFIG.simulation.gridResolution;
        const gridX = Math.floor((screenX - centerX + gardenRadius) / resolution);
        const gridY = Math.floor((screenY - centerY + gardenRadius) / resolution);
        
        // Check if within garden
        const worldX = screenX - centerX;
        const worldY = screenY - centerY;
        const distFromCenter = Math.sqrt(worldX * worldX + worldY * worldY);
        if (distFromCenter > gardenRadius - 10) return;
        
        // Apply disturbance in a circular area
        const radius = Math.ceil(CONFIG.touch.radius / resolution);
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = gridX + dx;
                const gy = gridY + dy;
                
                if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        // Falloff from center of touch
                        const falloff = 1 - (dist / radius);
                        const falloffSmooth = falloff * falloff;
                        
                        // Create both raised and lowered areas (like pushing sand)
                        const angle = Math.atan2(dy, dx);
                        const pushEffect = Math.sin(angle * 2 + bladeAngle);
                        
                        heightMap[gy][gx] += pushEffect * strength * falloffSmooth;
                        
                        // Clamp height
                        heightMap[gy][gx] = Math.max(-3, Math.min(3, heightMap[gy][gx]));
                    }
                }
            }
        }
        
        // Trigger disturbance sound hook
        AudioManager.playDisturbSound(strength / CONFIG.touch.strength);
    }

    // ==================== BLADE MECHANICS ====================
    function updateBlade() {
        bladeAngle += CONFIG.blade.rotationSpeed;
        if (bladeAngle > Math.PI * 2) {
            bladeAngle -= Math.PI * 2;
        }
        
        // Apply blade effects along its path
        applyBladeEffects();
    }

    function applyBladeEffects() {
        const resolution = CONFIG.simulation.gridResolution;
        const bladeLength = gardenRadius - 5;
        
        // The blade has two sides:
        // - Trailing side (just passed): applies smooth/flat effect
        // - Leading side (about to pass): applies wave pattern
        
        // We process a thin wedge that the blade just passed over
        const wedgeAngle = CONFIG.blade.rotationSpeed * 3; // Process slightly wider than movement
        
        for (let r = 15; r < bladeLength; r += resolution) {
            // Points along the blade at this radius
            for (let a = -wedgeAngle; a <= 0; a += 0.02) {
                const angle = bladeAngle + a;
                const worldX = Math.cos(angle) * r;
                const worldY = Math.sin(angle) * r;
                
                const gridX = Math.floor((worldX + gardenRadius) / resolution);
                const gridY = Math.floor((worldY + gardenRadius) / resolution);
                
                if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                    // Determine which side of blade this is
                    // Use angle relative to blade center to determine side
                    const relAngle = a + wedgeAngle / 2;
                    
                    if (relAngle < wedgeAngle / 2) {
                        // Comb side - apply wave pattern
                        const waveFreq = CONFIG.waves.count / gardenRadius;
                        const targetHeight = Math.sin(r * waveFreq * Math.PI * 2) * CONFIG.waves.amplitude;
                        
                        // Blend toward target wave pattern
                        const currentHeight = heightMap[gridY][gridX];
                        heightMap[gridY][gridX] = currentHeight + 
                            (targetHeight - currentHeight) * CONFIG.simulation.waveApplicationRate;
                    } else {
                        // Smooth side - flatten toward zero, but keep subtle texture
                        const currentHeight = heightMap[gridY][gridX];
                        heightMap[gridY][gridX] = currentHeight * CONFIG.simulation.healingRate;
                    }
                }
            }
        }
    }

    // ==================== RENDERING ====================
    function render() {
        // Clear canvas
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw garden frame (dark rim)
        drawFrame();
        
        // Draw sand
        drawSand();
        
        // Draw blade
        drawBlade();
        
        // Draw center pivot
        drawCenter();
    }

    function drawFrame() {
        const outerRadius = gardenRadius + CONFIG.garden.frameWidth;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.garden.frameColor;
        ctx.fill();
    }

    function drawSand() {
        const resolution = CONFIG.simulation.gridResolution;
        const sand = CONFIG.sand;
        
        // Create circular clipping path
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, gardenRadius, 0, Math.PI * 2);
        ctx.clip();
        
        // Draw each cell of the height map
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const worldX = (x * resolution) - gardenRadius + centerX;
                const worldY = (y * resolution) - gardenRadius + centerY;
                
                // Check if within circle
                const dx = worldX - centerX;
                const dy = worldY - centerY;
                if (dx * dx + dy * dy > gardenRadius * gardenRadius) continue;
                
                const height = heightMap[y][x];
                
                // Calculate color based on height
                const color = getHeightColor(height);
                
                ctx.fillStyle = color;
                ctx.fillRect(worldX, worldY, resolution, resolution);
            }
        }
        
        ctx.restore();
    }

    function getHeightColor(height) {
        const sand = CONFIG.sand;
        const normalizedHeight = (height + 2) / 4; // Normalize to 0-1 range
        
        let r, g, b;
        
        if (height > 0) {
            // Peaks are lighter
            const t = Math.min(height / 2, 1);
            r = sand.baseColor.r + (sand.highlightColor.r - sand.baseColor.r) * t;
            g = sand.baseColor.g + (sand.highlightColor.g - sand.baseColor.g) * t;
            b = sand.baseColor.b + (sand.highlightColor.b - sand.baseColor.b) * t;
        } else {
            // Valleys are darker
            const t = Math.min(-height / 2, 1);
            r = sand.baseColor.r + (sand.shadowColor.r - sand.baseColor.r) * t;
            g = sand.baseColor.g + (sand.shadowColor.g - sand.baseColor.g) * t;
            b = sand.baseColor.b + (sand.shadowColor.b - sand.baseColor.b) * t;
        }
        
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    function drawBlade() {
        const blade = CONFIG.blade;
        const bladeLength = gardenRadius - 5;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(bladeAngle);
        
        // Blade shadow
        ctx.shadowColor = blade.shadowColor;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw blade body
        ctx.beginPath();
        ctx.moveTo(15, -blade.width / 2);
        ctx.lineTo(bladeLength, -blade.width / 2 - 2);
        ctx.lineTo(bladeLength, blade.width / 2 + 2);
        ctx.lineTo(15, blade.width / 2);
        ctx.closePath();
        
        ctx.fillStyle = blade.color;
        ctx.fill();
        
        // Draw comb teeth on one side
        const teethCount = Math.floor((bladeLength - 20) / 12);
        ctx.strokeStyle = blade.color;
        ctx.lineWidth = 2;
        
        for (let i = 0; i < teethCount; i++) {
            const x = 25 + i * 12;
            ctx.beginPath();
            ctx.moveTo(x, blade.width / 2 + 2);
            ctx.lineTo(x, blade.width / 2 + 10);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    function drawCenter() {
        const blade = CONFIG.blade;
        
        // Center pivot
        ctx.beginPath();
        ctx.arc(centerX, centerY, blade.centerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#E0E0E0';
        ctx.fill();
        ctx.strokeStyle = '#BDBDBD';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner detail
        ctx.beginPath();
        ctx.arc(centerX, centerY, blade.centerRadius / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#BDBDBD';
        ctx.fill();
    }

    // ==================== ANIMATION LOOP ====================
    function animate() {
        updateBlade();
        render();
        animationId = requestAnimationFrame(animate);
    }

    // ==================== START ====================
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
