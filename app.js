/**
 * Zen Sand Garden
 * A meditative sand garden simulation with a rotating dual-sided blade
 */

(function () {
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
            rotationSpeed: 0.004,   // Radians per frame (faster, still meditative)
            width: 8,               // Blade thickness
            color: '#FAFAFA',
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            centerRadius: 14        // Center pivot size
        },

        // Wave pattern (comb side) - will be calculated based on teeth
        waves: {
            amplitude: 1.0,         // Height of waves
            sharpness: 0.7          // How sharp the wave peaks are
        },

        // Interaction
        touch: {
            radius: 30,             // Size of disturbance
            strength: 3.0,          // How much the sand is displaced
            dragMultiplier: 0.7     // Reduced strength while dragging
        },

        // Simulation - physics-based gradual healing
        simulation: {
            gridResolution: 2,      // Pixels per grid cell
            healingRate: 0.08,      // SLOW healing per pass (physics-based)
            waveApplicationRate: 0.12 // Gradual wave application
        }
    };

    // ==================== STATE ====================
    let canvas, ctx;
    let gardenRadius, centerX, centerY;
    let bladeAngle = 0;
    let heightMap = [];
    let targetHeightMap = []; // Target wave pattern for each cell
    let gridWidth, gridHeight;
    let isInteracting = false;
    let lastTouchPos = null;
    let animationId = null;
    let teethCount = 0; // Will be calculated based on blade length

    // ==================== AUDIO HOOKS (for future) ====================
    const AudioManager = {
        initialized: false,

        init() {
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

        animate();
    }

    function setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(dpr, dpr);

        const minDimension = Math.min(window.innerWidth, window.innerHeight);
        gardenRadius = (minDimension / 2) - CONFIG.garden.padding - CONFIG.garden.frameWidth;
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight / 2;

        // Calculate teeth count based on blade length (matching wave count)
        const bladeLength = gardenRadius - 20;
        const teethSpacing = 12; // Pixels between teeth
        teethCount = Math.floor(bladeLength / teethSpacing);
    }

    function initHeightMap() {
        const resolution = CONFIG.simulation.gridResolution;
        gridWidth = Math.ceil((gardenRadius * 2) / resolution);
        gridHeight = Math.ceil((gardenRadius * 2) / resolution);

        heightMap = [];
        targetHeightMap = [];

        for (let y = 0; y < gridHeight; y++) {
            heightMap[y] = [];
            targetHeightMap[y] = [];
            for (let x = 0; x < gridWidth; x++) {
                heightMap[y][x] = 0;
                targetHeightMap[y][x] = 0;
            }
        }

        // Calculate and store target wave pattern
        calculateTargetWavePattern();

        // Apply initial wave pattern
        applyFullWavePattern();
    }

    function calculateTargetWavePattern() {
        const resolution = CONFIG.simulation.gridResolution;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const worldX = (x * resolution) - gardenRadius;
                const worldY = (y * resolution) - gardenRadius;
                const dist = Math.sqrt(worldX * worldX + worldY * worldY);

                if (dist < gardenRadius - 5) {
                    // Wave frequency based on teeth count (they match!)
                    const waveFreq = teethCount / gardenRadius;
                    const waveVal = Math.sin(dist * waveFreq * Math.PI * 2);
                    targetHeightMap[y][x] = waveVal * CONFIG.waves.amplitude;
                }
            }
        }
    }

    function applyFullWavePattern() {
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                heightMap[y][x] = targetHeightMap[y][x];
            }
        }
    }

    // ==================== EVENT HANDLING ====================
    function setupEventListeners() {
        canvas.addEventListener('mousedown', handleInteractionStart);
        canvas.addEventListener('mousemove', handleInteractionMove);
        canvas.addEventListener('mouseup', handleInteractionEnd);
        canvas.addEventListener('mouseleave', handleInteractionEnd);

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleInteractionEnd);
        canvas.addEventListener('touchcancel', handleInteractionEnd);

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
        const resolution = CONFIG.simulation.gridResolution;
        const gridX = Math.floor((screenX - centerX + gardenRadius) / resolution);
        const gridY = Math.floor((screenY - centerY + gardenRadius) / resolution);

        const worldX = screenX - centerX;
        const worldY = screenY - centerY;
        const distFromCenter = Math.sqrt(worldX * worldX + worldY * worldY);
        if (distFromCenter > gardenRadius - 10) return;

        const radius = Math.ceil(CONFIG.touch.radius / resolution);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = gridX + dx;
                const gy = gridY + dy;

                if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        const falloff = 1 - (dist / radius);
                        const falloffSmooth = falloff * falloff;

                        // Create chaotic disturbance (random-ish based on position)
                        const noise = Math.sin(gx * 0.5) * Math.cos(gy * 0.7);

                        heightMap[gy][gx] += noise * strength * falloffSmooth;
                        heightMap[gy][gx] = Math.max(-3, Math.min(3, heightMap[gy][gx]));
                    }
                }
            }
        }

        AudioManager.playDisturbSound(strength / CONFIG.touch.strength);
    }

    // ==================== BLADE MECHANICS ====================
    function updateBlade() {
        bladeAngle += CONFIG.blade.rotationSpeed;
        if (bladeAngle > Math.PI * 2) {
            bladeAngle -= Math.PI * 2;
        }

        applyBladeEffects();
    }

    function applyBladeEffects() {
        const resolution = CONFIG.simulation.gridResolution;
        const bladeLength = gardenRadius - 5;

        // Process a thin wedge that the blade just passed over
        // FULL BLADE: process both directions from center
        const wedgeAngle = CONFIG.blade.rotationSpeed * 2;

        // Process BOTH sides of the blade (full diameter)
        for (let side = 0; side < 2; side++) {
            const sideAngle = side === 0 ? 0 : Math.PI; // 0 and 180 degrees

            for (let r = 20; r < bladeLength; r += resolution) {
                for (let a = -wedgeAngle; a <= 0; a += 0.015) {
                    const angle = bladeAngle + a + sideAngle;
                    const worldX = Math.cos(angle) * r;
                    const worldY = Math.sin(angle) * r;

                    const gridX = Math.floor((worldX + gardenRadius) / resolution);
                    const gridY = Math.floor((worldY + gardenRadius) / resolution);

                    if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                        const currentHeight = heightMap[gridY][gridX];
                        const targetHeight = targetHeightMap[gridY][gridX];

                        // Determine which side based on blade orientation
                        // One half has teeth (creates waves), other half is smooth
                        if (side === 0) {
                            // COMB SIDE - gradually apply wave pattern
                            // Physics: move a small amount toward target each pass
                            const diff = targetHeight - currentHeight;
                            heightMap[gridY][gridX] = currentHeight + diff * CONFIG.simulation.waveApplicationRate;
                        } else {
                            // SMOOTH SIDE - gradually flatten toward smooth (zero-ish)
                            // Physics: move a small amount toward flat each pass
                            heightMap[gridY][gridX] = currentHeight * (1 - CONFIG.simulation.healingRate);
                        }
                    }
                }
            }
        }
    }

    // ==================== RENDERING ====================
    function render() {
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawFrame();
        drawSand();
        drawBlade();
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

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, gardenRadius, 0, Math.PI * 2);
        ctx.clip();

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const worldX = (x * resolution) - gardenRadius + centerX;
                const worldY = (y * resolution) - gardenRadius + centerY;

                const dx = worldX - centerX;
                const dy = worldY - centerY;
                if (dx * dx + dy * dy > gardenRadius * gardenRadius) continue;

                const height = heightMap[y][x];
                const color = getHeightColor(height);

                ctx.fillStyle = color;
                ctx.fillRect(worldX, worldY, resolution, resolution);
            }
        }

        ctx.restore();
    }

    function getHeightColor(height) {
        const sand = CONFIG.sand;

        let r, g, b;

        if (height > 0) {
            const t = Math.min(height / 2, 1);
            r = sand.baseColor.r + (sand.highlightColor.r - sand.baseColor.r) * t;
            g = sand.baseColor.g + (sand.highlightColor.g - sand.baseColor.g) * t;
            b = sand.baseColor.b + (sand.highlightColor.b - sand.baseColor.b) * t;
        } else {
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
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Draw FULL blade body (extends both directions from center)
        ctx.beginPath();
        // Right side
        ctx.moveTo(20, -blade.width / 2);
        ctx.lineTo(bladeLength, -blade.width / 2 - 2);
        ctx.lineTo(bladeLength, blade.width / 2 + 2);
        ctx.lineTo(20, blade.width / 2);
        // Left side
        ctx.lineTo(-20, blade.width / 2);
        ctx.lineTo(-bladeLength, blade.width / 2 + 2);
        ctx.lineTo(-bladeLength, -blade.width / 2 - 2);
        ctx.lineTo(-20, -blade.width / 2);
        ctx.closePath();

        ctx.fillStyle = blade.color;
        ctx.fill();

        // Draw comb teeth on ONE side only (right side, bottom edge)
        // Teeth count matches wave count!
        const teethSpacing = (bladeLength - 25) / teethCount;
        ctx.strokeStyle = '#E8E8E8';
        ctx.lineWidth = 2;

        for (let i = 0; i < teethCount; i++) {
            const x = 25 + i * teethSpacing;
            ctx.beginPath();
            ctx.moveTo(x, blade.width / 2 + 2);
            ctx.lineTo(x, blade.width / 2 + 12);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawCenter() {
        const blade = CONFIG.blade;

        // Outer ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, blade.centerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#E8E8E8';
        ctx.fill();
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner detail
        ctx.beginPath();
        ctx.arc(centerX, centerY, blade.centerRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#CCCCCC';
        ctx.fill();

        // Center dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#999999';
        ctx.fill();
    }

    // ==================== ANIMATION LOOP ====================
    function animate() {
        updateBlade();
        render();
        animationId = requestAnimationFrame(animate);
    }

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
