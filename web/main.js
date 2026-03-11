import init, { Simulation } from '../boids-wasm/pkg/boids_wasm.js';

const BOID_STRIDE = 6;
const PRED_STRIDE = 7;
const HEADER = 2;
const STATS_COUNT = 10;
const EXPERIMENT_FRAMES = 1800;

const PRESETS = {
    'manyeyes-a': {
        label: '多眼A: 个体',
        numBoids: 200, numPredators: 1,
        visualRange: 30, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.01, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 999,
        preferEdge: false,
    },
    'manyeyes-b': {
        label: '多眼B: 群体',
        numBoids: 200, numPredators: 1,
        visualRange: 100, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.08, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 999,
        preferEdge: false,
    },
    'dilution-a': {
        label: '稀释A: 小群',
        numBoids: 30, numPredators: 1,
        visualRange: 75, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 999,
        preferEdge: false,
    },
    'dilution-b': {
        label: '稀释B: 大群',
        numBoids: 300, numPredators: 1,
        visualRange: 75, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 999,
        preferEdge: false,
    },
    'confusion-a': {
        label: '混淆A: 无混淆',
        numBoids: 200, numPredators: 1,
        visualRange: 75, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 999,
        preferEdge: false,
    },
    'confusion-b': {
        label: '混淆B: 有混淆',
        numBoids: 200, numPredators: 1,
        visualRange: 75, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 3,
        preferEdge: false,
    },
    'selfish-a': {
        label: '自私A: 松散',
        numBoids: 200, numPredators: 1,
        visualRange: 75, protectedRange: 15,
        avoidanceFactor: 0.15, matchingFactor: 0.05, centeringFactor: 0.001,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 999,
        preferEdge: true,
    },
    'selfish-b': {
        label: '自私B: 紧密',
        numBoids: 200, numPredators: 1,
        visualRange: 75, protectedRange: 15,
        avoidanceFactor: 0.03, matchingFactor: 0.05, centeringFactor: 0.01,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5,
        predatorSpeed: 4, chaseFactor: 0.03,
        captureRadius: 10, confusionThreshold: 999,
        preferEdge: true,
    },
};

const PARAM_MAP = {
    numBoids:           { setter: 'setNumBoids',           type: 'int'   },
    numPredators:       { setter: 'setNumPredators',       type: 'int'   },
    visualRange:        { setter: 'setVisualRange',        type: 'float' },
    protectedRange:     { setter: 'setProtectedRange',     type: 'float' },
    avoidanceFactor:    { setter: 'setAvoidanceFactor',    type: 'float' },
    matchingFactor:     { setter: 'setMatchingFactor',     type: 'float' },
    centeringFactor:    { setter: 'setCenteringFactor',    type: 'float' },
    maxSpeed:           { setter: 'setMaxSpeed',           type: 'float' },
    minSpeed:           { setter: 'setMinSpeed',           type: 'float' },
    fleeRange:          { setter: 'setFleeRange',          type: 'float' },
    fleeFactor:         { setter: 'setFleeFactor',         type: 'float' },
    predatorSpeed:      { setter: 'setPredatorSpeed',      type: 'float' },
    chaseFactor:        { setter: 'setChaseFactor',        type: 'float' },
    captureRadius:      { setter: 'setCaptureRadius',      type: 'float' },
    confusionThreshold: { setter: 'setConfusionThreshold', type: 'int'   },
};

let sim = null;
let canvas, ctx;
let showRange = false;
let showTrails = false;
let showTargetLine = true;
let highlightEdge = false;
let lastTime = performance.now();
let frameCount = 0;
let fpsDisplay = 0;
let timeScale = 1;
let slowCounter = 0;
let lastData = null;

async function main() {
    await init();

    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    const container = document.getElementById('canvas-container');
    sim = new Simulation(container.clientWidth, container.clientHeight, 200, 1);

    bindSliders();
    bindToggles();
    bindPresets();
    bindActions();
    bindSectionToggles();
    bindTimeScale();

    requestAnimationFrame(loop);
}

function resize() {
    const container = document.getElementById('canvas-container');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (sim) {
        sim.setSize(container.clientWidth, container.clientHeight);
    }
}

function loop(ts) {
    let data = lastData;

    if (timeScale > 0) {
        for (let i = 0; i < timeScale; i++) {
            data = sim.tick();
        }
        lastData = data;
    } else if (timeScale < 0) {
        slowCounter++;
        if (slowCounter >= Math.abs(timeScale)) {
            slowCounter = 0;
            data = sim.tick();
            lastData = data;
        }
    }
    // timeScale === 0: no tick (pause)

    if (lastData) {
        render(lastData);
    }

    frameCount++;
    if (ts - lastTime >= 1000) {
        fpsDisplay = frameCount;
        frameCount = 0;
        lastTime = ts;
        document.getElementById('fps-counter').textContent = `FPS: ${fpsDisplay}`;
    }

    const indicator = document.getElementById('time-indicator');
    if (timeScale === 0) {
        indicator.textContent = '⏸ 暂停';
    } else if (timeScale < 0) {
        indicator.textContent = `⏪ 1/${Math.abs(timeScale)}x 慢放`;
    } else if (timeScale > 1) {
        indicator.textContent = `⏩ ${timeScale}x 快进`;
    } else {
        indicator.textContent = '';
    }

    requestAnimationFrame(loop);
}

function render(data) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const numBoids = data[0];
    const numPreds = data[1];

    const so = HEADER;
    const captures = data[so];
    const captureRate = data[so + 1];
    const avgReaction = data[so + 2];
    const compactness = data[so + 3];
    const edgeRatio = data[so + 4];
    const switches = data[so + 5];
    const successRate = data[so + 6];
    const aliveCount = data[so + 7];
    const expCaptureRate = data[so + 8];
    const expProgress = data[so + 9];

    updateStats(captures, captureRate, avgReaction, compactness, edgeRatio, switches, successRate, aliveCount, expCaptureRate, expProgress);

    if (showTrails) {
        ctx.fillStyle = 'rgba(15, 15, 26, 0.12)';
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, w, h);
    }

    const bo = HEADER + STATS_COUNT;

    for (let i = 0; i < numBoids; i++) {
        const off = bo + i * BOID_STRIDE;
        const x = data[off];
        const y = data[off + 1];
        const vx = data[off + 2];
        const vy = data[off + 3];
        const alert = data[off + 4];
        const active = data[off + 5];

        if (active < 0.5) continue;

        const angle = Math.atan2(vy, vx);

        if (showRange) {
            ctx.beginPath();
            ctx.arc(x, y, parseFloat(document.getElementById('visualRange').value), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(79, 195, 247, 0.06)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        let color;
        if (alert > 0.5) {
            const t = Math.min(alert, 1);
            const r = Math.round(79 + (255 - 79) * t);
            const g = Math.round(195 + (213 - 195) * t);
            const b = Math.round(247 + (79 - 247) * t);
            color = `rgb(${r},${g},${b})`;
        } else {
            color = '#4fc3f7';
        }

        if (highlightEdge) {
            const cx = w / 2, cy = h / 2;
            const dist = Math.hypot(x - cx, y - cy);
            const maxDist = Math.min(w, h) * 0.35;
            if (dist > maxDist) {
                color = '#ffd54f';
            }
        }

        drawBoid(x, y, angle, 7, color);
    }

    const po = bo + numBoids * BOID_STRIDE;
    for (let i = 0; i < numPreds; i++) {
        const off = po + i * PRED_STRIDE;
        const px = data[off];
        const py = data[off + 1];
        const pvx = data[off + 2];
        const pvy = data[off + 3];
        const tx = data[off + 4];
        const ty = data[off + 5];

        const angle = Math.atan2(pvy, pvx);
        drawBoid(px, py, angle, 13, '#ef5350');

        if (showTargetLine && tx >= 0 && ty >= 0) {
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(px, py);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = 'rgba(239, 83, 80, 0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

function drawBoid(x, y, angle, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, -size * 0.4);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(-size * 0.6, size * 0.4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function updateStats(captures, rate, reaction, compact, edge, switches, success, alive, expRate, expProgress) {
    document.getElementById('stat-captures').textContent = captures;
    document.getElementById('stat-rate').textContent = rate.toFixed(2);
    document.getElementById('stat-success').textContent = (success * 100).toFixed(1) + '%';
    document.getElementById('stat-reaction').textContent = reaction > 0 ? reaction.toFixed(0) + ' 帧' : '--';
    document.getElementById('stat-compact').textContent = compact.toFixed(1) + ' px';
    document.getElementById('stat-edge').textContent = (edge * 100).toFixed(1) + '%';
    document.getElementById('stat-switches').textContent = switches;
    document.getElementById('stat-alive').textContent = alive;

    const expRateEl = document.getElementById('stat-exp-rate');
    const progressBar = document.getElementById('exp-progress-bar');
    const statusEl = document.getElementById('exp-status');

    if (expProgress > 0) {
        progressBar.style.width = (expProgress * 100).toFixed(1) + '%';

        if (expProgress >= 1.0) {
            expRateEl.textContent = expRate.toFixed(3);
            statusEl.textContent = '实验完成 (' + EXPERIMENT_FRAMES + ' 帧)';
            statusEl.className = 'exp-status done';
        } else {
            expRateEl.textContent = expRate.toFixed(3);
            statusEl.textContent = '实验进行中... ' + (expProgress * 100).toFixed(0) + '%';
            statusEl.className = 'exp-status running';
        }
    } else {
        expRateEl.textContent = '--';
        progressBar.style.width = '0%';
    }
}

function bindSliders() {
    for (const [id, { setter, type }] of Object.entries(PARAM_MAP)) {
        const el = document.getElementById(id);
        if (!el) continue;
        const valEl = document.getElementById('val-' + id);
        el.addEventListener('input', () => {
            const raw = el.value;
            const v = type === 'int' ? parseInt(raw) : parseFloat(raw);
            if (valEl) valEl.textContent = raw;
            if (sim && sim[setter]) sim[setter](v);
        });
    }
}

function bindTimeScale() {
    const el = document.getElementById('timeScale');
    const valEl = document.getElementById('val-timeScale');
    el.addEventListener('input', () => {
        timeScale = parseInt(el.value);
        slowCounter = 0;
        if (valEl) {
            if (timeScale < 0) {
                valEl.textContent = '1/' + Math.abs(timeScale);
            } else {
                valEl.textContent = timeScale;
            }
        }
    });
}

function bindToggles() {
    document.getElementById('showRange').addEventListener('change', e => { showRange = e.target.checked; });
    document.getElementById('showTrails').addEventListener('change', e => { showTrails = e.target.checked; });
    document.getElementById('showTargetLine').addEventListener('change', e => { showTargetLine = e.target.checked; });
    document.getElementById('highlightEdge').addEventListener('change', e => { highlightEdge = e.target.checked; });
    document.getElementById('preferEdge').addEventListener('change', e => {
        if (sim) sim.setPreferEdgeTarget(e.target.checked);
    });
}

function bindPresets() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            const p = PRESETS[key];
            if (!p || !sim) return;

            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            applyPreset(p);
        });
    });
}

function applyPreset(p) {
    for (const [id, { setter, type }] of Object.entries(PARAM_MAP)) {
        if (p[id] === undefined) continue;
        const el = document.getElementById(id);
        if (el) {
            el.value = p[id];
            const valEl = document.getElementById('val-' + id);
            if (valEl) valEl.textContent = p[id];
        }
        const v = type === 'int' ? parseInt(p[id]) : parseFloat(p[id]);
        if (sim[setter]) sim[setter](v);
    }

    if (p.preferEdge !== undefined) {
        sim.setPreferEdgeTarget(p.preferEdge);
        document.getElementById('preferEdge').checked = p.preferEdge;
    }

    const nb = parseInt(document.getElementById('numBoids').value);
    const np = parseInt(document.getElementById('numPredators').value);
    sim.reset(nb, np);
    sim.setExperimentDuration(EXPERIMENT_FRAMES);

    document.getElementById('exp-progress-bar').style.width = '0%';
    document.getElementById('exp-status').textContent = '实验已启动 (30 秒 / ' + EXPERIMENT_FRAMES + ' 帧)';
    document.getElementById('exp-status').className = 'exp-status running';
    document.getElementById('stat-exp-rate').textContent = '...';

    if (timeScale === 0) {
        timeScale = 1;
        document.getElementById('timeScale').value = 1;
        document.getElementById('val-timeScale').textContent = '1';
    }
}

function bindActions() {
    document.getElementById('btn-pause').addEventListener('click', () => {
        if (timeScale === 0) {
            timeScale = 1;
            document.getElementById('timeScale').value = 1;
            document.getElementById('val-timeScale').textContent = '1';
            document.getElementById('btn-pause').textContent = '暂停';
            document.getElementById('btn-pause').classList.remove('paused');
        } else {
            timeScale = 0;
            document.getElementById('timeScale').value = 0;
            document.getElementById('val-timeScale').textContent = '0';
            document.getElementById('btn-pause').textContent = '继续';
            document.getElementById('btn-pause').classList.add('paused');
        }
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        const nb = parseInt(document.getElementById('numBoids').value);
        const np = parseInt(document.getElementById('numPredators').value);
        sim.reset(nb, np);
        sim.setExperimentDuration(0);
        lastData = null;
        document.getElementById('exp-progress-bar').style.width = '0%';
        document.getElementById('exp-status').textContent = '点击预设按钮开始 30 秒定时实验';
        document.getElementById('exp-status').className = 'exp-status';
    });
}

function bindSectionToggles() {
    document.querySelectorAll('.section-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const target = document.getElementById(toggle.dataset.target);
            if (target) {
                target.classList.toggle('open');
                toggle.classList.toggle('collapsed');
            }
        });
    });
}

main();
