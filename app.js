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
            baseColor: { r: 245, g: 240, b: 230 },
            shadowColor: { r: 180, g: 165, b: 145 },    // Darker for deeper holes
            highlightColor: { r: 255, g: 252, b: 248 }, // Lighter for dunes
        },

        // Garden dimensions
        garden: {
            padding: 20,
            frameWidth: 12,
            frameColor: '#2D2D2D'
        },

        // Blade settings
        blade: {
            baseRotationSpeed: 0.003,
            width: 8,
            color: '#FAFAFA',
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            centerRadius: 14
        },

        // Wave pattern
        waves: {
            amplitude: 1.0,
        },

        // Interaction
        touch: {
            radius: 35,              // Size of disturbance area
            digStrength: 0.15,       // How fast we dig holes (per frame while dragging)
            pileStrength: 0.08,      // How fast we pile sand (per frame while holding)
            maxHeight: 4,            // Max dune height
            minHeight: -4            // Max hole depth
        },

        // Simulation
        simulation: {
            gridResolution: 2,
            // For normal undisturbed sand: apply pattern strongly
            normalRate: 0.95,
            // For disturbed sand (dunes/holes): fix gradually
            disturbanceFixRate: 0.03,  // Slow fixing per pass
            // Threshold to consider sand "disturbed"
            disturbanceThreshold: 1.5
        }
    };

    // ==================== STATE ====================
    let canvas, ctx;
    let gardenRadius, centerX, centerY;
    let bladeAngle = 0;
    let heightMap = [];
    let targetHeightMap = [];
    let gridWidth, gridHeight;
    let isInteracting = false;
    let lastTouchPos = null;
    let currentTouchPos = null;
    let holdStartTime = 0;
    let animationId = null;
    let teethCount = 0;
    let rotationSpeed = CONFIG.blade.baseRotationSpeed;
    let speedSlider = null;

    // ==================== AUDIO HOOKS (for future) ====================
    const AudioManager = {
        initialized: false,
        init() { this.initialized = true; },
        playAmbient() { },
        stopAmbient() { },
        playDisturbSound(intensity) { },
        playBladeSound() { }
    };

    // ==================== INITIALIZATION ====================
    function init() {
        canvas = document.getElementById('garden');
        ctx = canvas.getContext('2d');
        speedSlider = document.getElementById('speed-slider');

        setupCanvas();
        initHeightMap();
        setupEventListeners();
        setupSpeedControl();

        animate();
    }

    function setupSpeedControl() {
        if (speedSlider) {
            updateSpeed();
            speedSlider.addEventListener('input', updateSpeed);
            speedSlider.addEventListener('touchstart', (e) => e.stopPropagation());
            speedSlider.addEventListener('touchmove', (e) => e.stopPropagation());
        }
    }

    function updateSpeed() {
        const value = parseInt(speedSlider.value);
        rotationSpeed = 0.001 + (value / 100) * 0.014;
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

        const bladeLength = gardenRadius - 20;
        const teethSpacing = 12;
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

        calculateTargetWavePattern();
        applyInitialPattern();
    }

    function calculateTargetWavePattern() {
        const resolution = CONFIG.simulation.gridResolution;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const worldX = (x * resolution) - gardenRadius;
                const worldY = (y * resolution) - gardenRadius;
                const dist = Math.sqrt(worldX * worldX + worldY * worldY);

                if (dist < gardenRadius - 5) {
                    const waveFreq = teethCount / gardenRadius;
                    const waveVal = Math.sin(dist * waveFreq * Math.PI * 2);
                    targetHeightMap[y][x] = waveVal * CONFIG.waves.amplitude;
                }
            }
        }
    }

    function applyInitialPattern() {
        const resolution = CONFIG.simulation.gridResolution;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const worldX = (x * resolution) - gardenRadius;

                if (worldX >= 0) {
                    heightMap[y][x] = targetHeightMap[y][x];
                } else {
                    heightMap[y][x] = 0;
                }
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
        currentTouchPos = pos;
        holdStartTime = Date.now();
    }

    function handleInteractionMove(e) {
        if (!isInteracting) return;
        e.preventDefault();
        const pos = getEventPos(e);
        lastTouchPos = currentTouchPos;
        currentTouchPos = pos;
    }

    function handleInteractionEnd(e) {
        isInteracting = false;
        lastTouchPos = null;
        currentTouchPos = null;
    }

    function handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            isInteracting = true;
            const pos = getTouchPos(e.touches[0]);
            lastTouchPos = pos;
            currentTouchPos = pos;
            holdStartTime = Date.now();
        }
    }

    function handleTouchMove(e) {
        if (!isInteracting) return;
        e.preventDefault();
        if (e.touches.length > 0) {
            const pos = getTouchPos(e.touches[0]);
            lastTouchPos = currentTouchPos;
            currentTouchPos = pos;
        }
    }

    function getEventPos(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function getTouchPos(touch) {
        const rect = canvas.getBoundingClientRect();
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }

    function handleResize() {
        setupCanvas();
        initHeightMap();
    }

    // ==================== SAND INTERACTION (called each frame) ====================
    function processInteraction() {
        if (!isInteracting || !currentTouchPos) return;

        const screenX = currentTouchPos.x;
        const screenY = currentTouchPos.y;

        const worldX = screenX - centerX;
        const worldY = screenY - centerY;
        const distFromCenter = Math.sqrt(worldX * worldX + worldY * worldY);
        if (distFromCenter > gardenRadius - 10) return;

        // Check if dragging or holding still
        let isDragging = false;
        if (lastTouchPos) {
            const dx = currentTouchPos.x - lastTouchPos.x;
            const dy = currentTouchPos.y - lastTouchPos.y;
            const moveDist = Math.sqrt(dx * dx + dy * dy);
            isDragging = moveDist > 2; // Threshold for movement
        }

        if (isDragging) {
            // DRAGGING = dig holes (lower the sand)
            digHole(screenX, screenY);
        } else {
            // HOLDING STILL = pile sand (raise dunes)
            pileSand(screenX, screenY);
        }
    }

    function digHole(screenX, screenY) {
        const resolution = CONFIG.simulation.gridResolution;
        const gridX = Math.floor((screenX - centerX + gardenRadius) / resolution);
        const gridY = Math.floor((screenY - centerY + gardenRadius) / resolution);
        const radius = Math.ceil(CONFIG.touch.radius / resolution);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = gridX + dx;
                const gy = gridY + dy;

                if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        const falloff = 1 - (dist / radius);
                        const strength = falloff * falloff * CONFIG.touch.digStrength;

                        // Dig down (lower height)
                        heightMap[gy][gx] -= strength;
                        heightMap[gy][gx] = Math.max(CONFIG.touch.minHeight, heightMap[gy][gx]);
                    }
                }
            }
        }
    }

    function pileSand(screenX, screenY) {
        const resolution = CONFIG.simulation.gridResolution;
        const gridX = Math.floor((screenX - centerX + gardenRadius) / resolution);
        const gridY = Math.floor((screenY - centerY + gardenRadius) / resolution);
        const radius = Math.ceil(CONFIG.touch.radius / resolution);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = gridX + dx;
                const gy = gridY + dy;

                if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        const falloff = 1 - (dist / radius);
                        const strength = falloff * falloff * CONFIG.touch.pileStrength;

                        // Pile up (raise height)
                        heightMap[gy][gx] += strength;
                        heightMap[gy][gx] = Math.min(CONFIG.touch.maxHeight, heightMap[gy][gx]);
                    }
                }
            }
        }
    }

    // ==================== BLADE MECHANICS ====================
    function updateBlade() {
        bladeAngle += rotationSpeed;
        if (bladeAngle > Math.PI * 2) {
            bladeAngle -= Math.PI * 2;
        }

        applyBladeEffects();
    }

    function applyBladeEffects() {
        const resolution = CONFIG.simulation.gridResolution;
        const bladeLength = gardenRadius - 5;
        const wedgeAngle = rotationSpeed * 2.5;
        const threshold = CONFIG.simulation.disturbanceThreshold;

        for (let side = 0; side < 2; side++) {
            const sideAngle = side === 0 ? 0 : Math.PI;
            const isCombSide = (side === 0);

            for (let r = 20; r < bladeLength; r += resolution) {
                for (let a = -wedgeAngle; a <= 0; a += 0.012) {
                    const angle = bladeAngle + a + sideAngle;
                    const worldX = Math.cos(angle) * r;
                    const worldY = Math.sin(angle) * r;

                    const gridX = Math.floor((worldX + gardenRadius) / resolution);
                    const gridY = Math.floor((worldY + gardenRadius) / resolution);

                    if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                        const currentHeight = heightMap[gridY][gridX];
                        let targetHeight;

                        if (isCombSide) {
                            targetHeight = targetHeightMap[gridY][gridX]; // Wave pattern
                        } else {
                            targetHeight = 0; // Flat/smooth
                        }

                        const diff = targetHeight - currentHeight;
                        const absDiff = Math.abs(diff);

                        // Check if this is a disturbance (dune or hole)
                        if (absDiff > threshold) {
                            // DISTURBED: fix gradually (multiple passes needed)
                            heightMap[gridY][gridX] = currentHeight + diff * CONFIG.simulation.disturbanceFixRate;
                        } else {
                            // NORMAL: apply pattern strongly
                            heightMap[gridY][gridX] = currentHeight + diff * CONFIG.simulation.normalRate;
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
            // Dunes are lighter
            const t = Math.min(height / 3, 1);
            r = sand.baseColor.r + (sand.highlightColor.r - sand.baseColor.r) * t;
            g = sand.baseColor.g + (sand.highlightColor.g - sand.baseColor.g) * t;
            b = sand.baseColor.b + (sand.highlightColor.b - sand.baseColor.b) * t;
        } else {
            // Holes are darker
            const t = Math.min(-height / 3, 1);
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

        ctx.shadowColor = blade.shadowColor;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Full blade body
        ctx.beginPath();
        ctx.moveTo(20, -blade.width / 2);
        ctx.lineTo(bladeLength, -blade.width / 2 - 2);
        ctx.lineTo(bladeLength, blade.width / 2 + 2);
        ctx.lineTo(20, blade.width / 2);
        ctx.lineTo(-20, blade.width / 2);
        ctx.lineTo(-bladeLength, blade.width / 2 + 2);
        ctx.lineTo(-bladeLength, -blade.width / 2 - 2);
        ctx.lineTo(-20, -blade.width / 2);
        ctx.closePath();

        ctx.fillStyle = blade.color;
        ctx.fill();

        // Comb teeth on RIGHT side only
        const teethSpacing = (bladeLength - 25) / teethCount;
        ctx.strokeStyle = '#E0E0E0';
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

        ctx.beginPath();
        ctx.arc(centerX, centerY, blade.centerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#E8E8E8';
        ctx.fill();
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, blade.centerRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#CCCCCC';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#999999';
        ctx.fill();
    }

    // ==================== ANIMATION LOOP ====================
    function animate() {
        processInteraction(); // Handle sand interaction each frame
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
