/**
 * Zen Sand Garden
 * A meditative sand garden simulation with a rotating dual-sided blade
 * Features realistic sand physics with redistribution
 */

(function () {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        // Sand appearance
        sand: {
            baseColor: { r: 245, g: 240, b: 230 },
            shadowColor: { r: 170, g: 155, b: 135 },
            highlightColor: { r: 255, g: 252, b: 248 },
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
            centerRadius: 14,
            pushStrength: 0.15  // How strongly the blade pushes sand
        },

        // Wave pattern
        waves: {
            amplitude: 1.0,
        },

        // Interaction
        touch: {
            radius: 35,
            digStrength: 0.2,
            pileStrength: 0.1,
            maxHeight: 5,
            minHeight: -5
        },

        // Simulation
        simulation: {
            gridResolution: 2,
            normalRate: 0.92,
            disturbanceThreshold: 1.2,
            // Sand redistribution
            spreadRadius: 8,      // How far sand spreads when pushed
            spreadDecay: 0.7      // How much sand is preserved when spreading
        }
    };

    // ==================== STATE ====================
    let canvas, ctx;
    let gardenRadius, centerX, centerY;
    let bladeAngle = 0;
    let heightMap = [];
    let targetHeightMap = [];
    let excessSandPool = 0;  // Accumulates sand pushed by blade
    let gridWidth, gridHeight;
    let isInteracting = false;
    let lastTouchPos = null;
    let currentTouchPos = null;
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
        excessSandPool = 0;

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

    // ==================== SAND INTERACTION ====================
    function processInteraction() {
        if (!isInteracting || !currentTouchPos) return;

        const screenX = currentTouchPos.x;
        const screenY = currentTouchPos.y;

        const worldX = screenX - centerX;
        const worldY = screenY - centerY;
        const distFromCenter = Math.sqrt(worldX * worldX + worldY * worldY);
        if (distFromCenter > gardenRadius - 10) return;

        let isDragging = false;
        if (lastTouchPos) {
            const dx = currentTouchPos.x - lastTouchPos.x;
            const dy = currentTouchPos.y - lastTouchPos.y;
            isDragging = Math.sqrt(dx * dx + dy * dy) > 2;
        }

        if (isDragging) {
            digHole(screenX, screenY);
        } else {
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

                        // Dig down - the removed sand goes into the pool
                        const removed = Math.min(heightMap[gy][gx] - CONFIG.touch.minHeight, strength);
                        if (removed > 0) {
                            heightMap[gy][gx] -= removed;
                            excessSandPool += removed * 0.5; // Some sand goes to pool
                        } else {
                            heightMap[gy][gx] -= strength;
                            heightMap[gy][gx] = Math.max(CONFIG.touch.minHeight, heightMap[gy][gx]);
                        }
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
        redistributeSand();
    }

    function applyBladeEffects() {
        const resolution = CONFIG.simulation.gridResolution;
        const bladeLength = gardenRadius - 5;
        const wedgeAngle = rotationSpeed * 3;
        const threshold = CONFIG.simulation.disturbanceThreshold;
        const pushStrength = CONFIG.blade.pushStrength;

        for (let side = 0; side < 2; side++) {
            const sideAngle = side === 0 ? 0 : Math.PI;
            const isCombSide = (side === 0);

            for (let r = 20; r < bladeLength; r += resolution) {
                for (let a = -wedgeAngle; a <= 0; a += 0.015) {
                    const angle = bladeAngle + a + sideAngle;
                    const worldX = Math.cos(angle) * r;
                    const worldY = Math.sin(angle) * r;

                    const gridX = Math.floor((worldX + gardenRadius) / resolution);
                    const gridY = Math.floor((worldY + gardenRadius) / resolution);

                    if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                        const currentHeight = heightMap[gridY][gridX];
                        let targetHeight = isCombSide ? targetHeightMap[gridY][gridX] : 0;

                        // If current is higher than target (dune), push the excess
                        if (currentHeight > targetHeight + threshold) {
                            // Calculate how much to push down
                            const excess = currentHeight - targetHeight;
                            const pushed = excess * pushStrength;

                            // Remove from this cell
                            heightMap[gridY][gridX] -= pushed;

                            // Add to excess pool for redistribution
                            excessSandPool += pushed * CONFIG.simulation.spreadDecay;

                            // Also spread to nearby cells in the direction of blade movement
                            spreadSandFromBlade(gridX, gridY, angle, pushed * 0.3);
                        }
                        // If current is lower than target (hole), fill from pool
                        else if (currentHeight < targetHeight - threshold && excessSandPool > 0) {
                            const deficit = targetHeight - currentHeight;
                            const fillAmount = Math.min(deficit * pushStrength, excessSandPool * 0.1);

                            heightMap[gridY][gridX] += fillAmount;
                            excessSandPool -= fillAmount;
                        }
                        // Normal sand - apply pattern
                        else {
                            const diff = targetHeight - currentHeight;
                            heightMap[gridY][gridX] = currentHeight + diff * CONFIG.simulation.normalRate;
                        }
                    }
                }
            }
        }
    }

    function spreadSandFromBlade(originX, originY, bladeAngle, amount) {
        if (amount < 0.01) return;

        const resolution = CONFIG.simulation.gridResolution;
        const spreadRadius = CONFIG.simulation.spreadRadius;

        // Spread in the direction the blade is moving (perpendicular to blade angle)
        const spreadAngle = bladeAngle + Math.PI / 2;
        const spreadDirX = Math.cos(spreadAngle);
        const spreadDirY = Math.sin(spreadAngle);

        for (let d = 1; d <= spreadRadius; d++) {
            const gx = originX + Math.round(spreadDirX * d);
            const gy = originY + Math.round(spreadDirY * d);

            if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                const falloff = 1 - (d / spreadRadius);
                const deposit = amount * falloff * falloff * 0.15;

                heightMap[gy][gx] += deposit;
            }
        }
    }

    function redistributeSand() {
        // Slowly distribute excess sand pool into holes
        if (excessSandPool < 0.01) return;

        const resolution = CONFIG.simulation.gridResolution;
        const distributePerFrame = excessSandPool * 0.02; // Distribute 2% per frame
        let distributed = 0;

        // Find holes and fill them
        for (let y = 0; y < gridHeight && distributed < distributePerFrame; y++) {
            for (let x = 0; x < gridWidth && distributed < distributePerFrame; x++) {
                // Check if within garden circle
                const worldX = (x * resolution) - gardenRadius;
                const worldY = (y * resolution) - gardenRadius;
                const dist = Math.sqrt(worldX * worldX + worldY * worldY);
                if (dist > gardenRadius - 5) continue;

                // If this is a hole, fill it a tiny bit
                if (heightMap[y][x] < -0.5) {
                    const fillAmount = Math.min(0.01, distributePerFrame - distributed);
                    heightMap[y][x] += fillAmount;
                    distributed += fillAmount;
                }
            }
        }

        excessSandPool -= distributed;
        if (excessSandPool < 0) excessSandPool = 0;
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
            const t = Math.min(height / 3, 1);
            r = sand.baseColor.r + (sand.highlightColor.r - sand.baseColor.r) * t;
            g = sand.baseColor.g + (sand.highlightColor.g - sand.baseColor.g) * t;
            b = sand.baseColor.b + (sand.highlightColor.b - sand.baseColor.b) * t;
        } else {
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
        processInteraction();
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
