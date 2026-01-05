/**
 * Zen Sand Garden
 * A meditative sand garden simulation with a rotating dual-sided blade
 * Features realistic sand physics with true conservation of mass
 */

(function () {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        // Sand appearance
        sand: {
            baseColor: { r: 245, g: 240, b: 230 },
            shadowColor: { r: 160, g: 145, b: 125 },
            highlightColor: { r: 255, g: 253, b: 250 },
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
            pushStrength: 0.025  // Much slower healing - many passes needed
        },

        // Wave pattern
        waves: {
            amplitude: 1.0,
        },

        // Interaction - only digging holes now
        touch: {
            radius: 35,
            digStrength: 0.25,
            duneSpreadRadius: 4,  // How far the displaced sand spreads
            maxHeight: 6,
            minHeight: -6
        },

        // Simulation
        simulation: {
            gridResolution: 2,
            normalRate: 0.92,
            disturbanceThreshold: 0.3,  // Lower threshold = cleaner result
            spreadRadius: 6
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

        // Always dig holes (both drag and hold)
        digHoleWithConservation(screenX, screenY);
    }

    function digHoleWithConservation(screenX, screenY) {
        const resolution = CONFIG.simulation.gridResolution;
        const gridX = Math.floor((screenX - centerX + gardenRadius) / resolution);
        const gridY = Math.floor((screenY - centerY + gardenRadius) / resolution);
        const digRadius = Math.ceil(CONFIG.touch.radius / resolution);
        const spreadRadius = CONFIG.touch.duneSpreadRadius;

        let totalRemoved = 0;
        const affectedCells = [];

        // First pass: dig the hole and count removed sand
        for (let dy = -digRadius; dy <= digRadius; dy++) {
            for (let dx = -digRadius; dx <= digRadius; dx++) {
                const gx = gridX + dx;
                const gy = gridY + dy;

                if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= digRadius) {
                        const falloff = 1 - (dist / digRadius);
                        const strength = falloff * falloff * CONFIG.touch.digStrength;

                        const currentHeight = heightMap[gy][gx];
                        const newHeight = Math.max(CONFIG.touch.minHeight, currentHeight - strength);
                        const removed = currentHeight - newHeight;

                        if (removed > 0) {
                            heightMap[gy][gx] = newHeight;
                            totalRemoved += removed;
                        }
                    }
                }
            }
        }

        // Second pass: pile the removed sand around the hole (conservation of mass)
        if (totalRemoved > 0) {
            const ringInner = digRadius + 1;
            const ringOuter = digRadius + spreadRadius;
            const ringCells = [];

            // Collect cells in the ring around the hole
            for (let dy = -ringOuter; dy <= ringOuter; dy++) {
                for (let dx = -ringOuter; dx <= ringOuter; dx++) {
                    const gx = gridX + dx;
                    const gy = gridY + dy;

                    if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist >= ringInner && dist <= ringOuter) {
                            // Check it's inside the garden circle
                            const worldX = (gx * resolution) - gardenRadius;
                            const worldY = (gy * resolution) - gardenRadius;
                            const gardenDist = Math.sqrt(worldX * worldX + worldY * worldY);
                            if (gardenDist < gardenRadius - 5) {
                                ringCells.push({ x: gx, y: gy, dist: dist });
                            }
                        }
                    }
                }
            }

            // Distribute the removed sand to the ring cells (closer = more sand)
            if (ringCells.length > 0) {
                let totalWeight = 0;
                ringCells.forEach(cell => {
                    cell.weight = 1 - ((cell.dist - ringInner) / spreadRadius);
                    totalWeight += cell.weight;
                });

                ringCells.forEach(cell => {
                    const sandShare = (cell.weight / totalWeight) * totalRemoved;
                    heightMap[cell.y][cell.x] += sandShare;
                    heightMap[cell.y][cell.x] = Math.min(CONFIG.touch.maxHeight, heightMap[cell.y][cell.x]);
                });
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
        const wedgeAngle = rotationSpeed * 3;
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

                        if (isCombSide) {
                            // COMB SIDE: creates wave pattern
                            const targetHeight = targetHeightMap[gridY][gridX];
                            const diff = targetHeight - currentHeight;
                            const absDiff = Math.abs(diff);

                            if (absDiff > 1.5) {
                                // Big disturbance: heal slowly
                                const moveAmount = diff * pushStrength;
                                heightMap[gridY][gridX] += moveAmount;
                                if (absDiff > 2.5) {
                                    spreadToNeighbors(gridX, gridY, -moveAmount * 0.3, angle);
                                }
                            } else if (absDiff > 0.1) {
                                // Medium: heal moderately
                                heightMap[gridY][gridX] = currentHeight + diff * 0.15;
                            } else {
                                // Small: snap to target wave
                                heightMap[gridY][gridX] = targetHeight;
                            }
                        } else {
                            // SMOOTH SIDE: flattens to ZERO (completely flat)
                            const absCurrent = Math.abs(currentHeight);

                            if (absCurrent > 1.5) {
                                // Big disturbance: flatten slowly
                                heightMap[gridY][gridX] = currentHeight * (1 - pushStrength);
                                if (absCurrent > 2.5) {
                                    spreadToNeighbors(gridX, gridY, currentHeight * pushStrength * 0.3, angle);
                                }
                            } else {
                                // Normal: flatten to exactly 0 (no texture)
                                heightMap[gridY][gridX] = 0;
                            }
                        }
                    }
                }
            }
        }
    }

    function spreadToNeighbors(originX, originY, amount, bladeAngle) {
        if (Math.abs(amount) < 0.001) return;

        const spreadAngle = bladeAngle + Math.PI / 2;
        const dirX = Math.round(Math.cos(spreadAngle) * 2);
        const dirY = Math.round(Math.sin(spreadAngle) * 2);

        const gx = originX + dirX;
        const gy = originY + dirY;

        if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
            heightMap[gy][gx] += amount;
            heightMap[gy][gx] = Math.max(CONFIG.touch.minHeight,
                Math.min(CONFIG.touch.maxHeight, heightMap[gy][gx]));
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

        // Full blade body - NO TEETH (smooth blade visual)
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

        // No teeth drawn - just a smooth blade

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
