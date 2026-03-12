import init, { Simulation } from '../boids-wasm/pkg/boids_wasm.js';
import {
    EXPERIMENT_FRAMES,
    PARAM_MAP,
    PRESETS,
    applyConditionToSimulation,
    readStatsFromData,
    randomSeed as sharedRandomSeed,
} from './sim-shared.js';
import {
    runBatchPairExperiments,
    runPairExperiment,
    toCsv as pairRunsToCsv,
} from './experiment-api.js';

const BOID_STRIDE = 6;
const PRED_STRIDE = 8;
const HEADER = 2;
const STATS_COUNT = 14;
const BATCH_STEPS_PER_FRAME = 240;
const MAX_RECORDS = 24;
const TIMELINE_SAMPLE_STEP = 30;
const RULE_DEMO_SEED = 20260312;
const randomSeed = sharedRandomSeed;
const readStats = readStatsFromData;

const RULE_DEMOS = {
    separation: {
        title: '分离 Separation',
        definition: '避免局部碰撞，保持个体间安全距离。',
        effect: '在本系统中会表现为个体相互排斥、队形更疏开。',
        param: 'avoidanceFactor ↑',
        tags: ['avoidanceFactor', 'protectedRange', 'short-range repulsion'],
        weights: { separation: 1.4, alignment: 0.08, cohesion: 0.04 },
        color: '#4fc3f7',
    },
    alignment: {
        title: '对齐 Alignment',
        definition: '让邻近个体的速度方向趋同，形成一致流向。',
        effect: '在本系统中会表现为局部个体逐渐同向飞行，轨迹更整齐。',
        param: 'matchingFactor ↑',
        tags: ['matchingFactor', 'velocity match', 'heading sync'],
        weights: { separation: 0.18, alignment: 1.2, cohesion: 0.08 },
        color: '#66bb6a',
    },
    cohesion: {
        title: '聚合 Cohesion',
        definition: '驱动个体向群体中心聚拢，维持群体整体性。',
        effect: '在本系统中会表现为个体不断回到局部中心，群体更紧密。',
        param: 'centeringFactor ↑',
        tags: ['centeringFactor', 'group center', 'cluster forming'],
        weights: { separation: 0.16, alignment: 0.14, cohesion: 1.15 },
        color: '#ffd54f',
    },
};

const PARAM_HELP = {
    visualRange: {
        title: '视觉范围',
        definition: '决定 boid 会在多远的距离内感知邻居与威胁。',
        impact: '范围越大，个体越容易更早参与群体组织和预警响应。',
    },
    viewAngle: {
        title: '视野角度',
        definition: '决定 boid 能感知邻居和捕食者的方向范围。',
        impact: '角度越大，个体越容易更早发现威胁并加入群体响应。',
    },
    protectedRange: {
        title: '保护范围',
        definition: '决定个体会开始强烈避让邻居的近距离阈值。',
        impact: '范围越大，群体越不容易互相挤压，但也更难压得很紧。',
    },
    avoidanceFactor: {
        title: '分离权重',
        definition: '控制个体在近距离内避碰和相互排斥的强度。',
        impact: '权重越大，队形越疏开；过高时群体会变得分散。',
    },
    matchingFactor: {
        title: '对齐权重',
        definition: '控制个体朝邻居平均速度方向调整的力度。',
        impact: '权重越大，局部飞行方向越一致，群体更容易形成统一流向。',
    },
    centeringFactor: {
        title: '聚合权重',
        definition: '控制个体向局部群体中心靠拢的力度。',
        impact: '权重越大，群体越紧密；过高时会让个体更容易扎堆。',
    },
    fleeRange: {
        title: '逃离范围',
        definition: '决定捕食者进入多远距离后会触发明显逃逸反应。',
        impact: '范围越大，个体越早开始规避，但也可能更频繁打乱群体结构。',
    },
    fleeFactor: {
        title: '逃离强度',
        definition: '控制个体面对捕食者时转向逃逸的力度。',
        impact: '强度越大，规避动作越激烈，但群体队形也更容易被打散。',
    },
    alertSpread: {
        title: '警报传播',
        definition: '决定警戒状态在邻居之间扩散和保留的强度。',
        impact: '值越高，预警更容易传遍全群，但也更容易让整体长期处于高警戒。',
    },
    predatorTurnRate: {
        title: '转向率',
        definition: '决定捕食者追击时每一步能修正方向的幅度。',
        impact: '转向率越高，捕食者越容易快速贴住目标；较低时更容易被机动群体甩开。',
    },
    confusionThreshold: {
        title: '混淆阈值',
        definition: '决定附近出现多少潜在目标后会触发明显混淆。',
        impact: '阈值越低，捕食者越容易丢失稳定锁定；阈值越高，混淆更不容易发生。',
    },
    lockFrames: {
        title: '锁定帧数',
        definition: '决定捕食者进入攻击前需要持续锁定目标多久。',
        impact: '值越高，攻击更谨慎，但也更容易在锁定阶段被混淆打断。',
    },
};

let sim = null;
let canvas;
let ctx;
let compareMode = false;
let compareScenes = [];
let rulesCanvas;
let rulesCtx;
let rulesState = null;
let currentRuleDemo = 'separation';
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
let activePresetKey = null;
let activeRun = null;
let experimentRecords = [];
let previousPredatorTargets = [];
let previousCaptureCount = 0;
let switchTrails = [];
let captureBursts = [];
let paramHelpTooltip = null;
let activeHelpButton = null;
let pinnedHelpButton = null;
let activePresetMeta = null;
let randomPresetCounter = 0;

async function main() {
    await init();

    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    rulesCanvas = document.getElementById('rules-canvas');
    rulesCtx = rulesCanvas.getContext('2d');
    compareScenes = createCompareScenes();
    rulesState = createRuleDemoState();

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
    bindExperimentControls();
    bindCompareControls();
    bindRulesLab();
    bindParamHelp();

    syncSeedDisplay();
    updatePresetExplainer();
    updateRulesLabCopy();
    renderRecords();
    updateStageMode();
    requestAnimationFrame(loop);
}

function resize() {
    const container = document.getElementById('canvas-container');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rulesRect = rulesCanvas.parentElement.getBoundingClientRect();
    rulesCanvas.width = rulesRect.width * dpr;
    rulesCanvas.height = rulesRect.height * dpr;
    rulesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const compareWidth = compareMode ? Math.floor(container.clientWidth / (window.innerWidth <= 700 ? 1 : 2)) : Math.floor(container.clientWidth / 2);
    const compareHeight = compareMode && window.innerWidth <= 700 ? Math.floor(container.clientHeight / 2) : container.clientHeight;
    for (const scene of compareScenes) {
        scene.canvas.width = compareWidth * dpr;
        scene.canvas.height = compareHeight * dpr;
        scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (scene.sim) {
            scene.sim.setSize(compareWidth, compareHeight);
        }
    }

    if (sim) {
        sim.setSize(container.clientWidth, container.clientHeight);
    }
}

function loop(ts) {
    if (compareMode) {
        advanceCompareMode();
    } else {
        const data = advanceSimulation();
        if (data) {
            render(data);
        }
    }

    renderRulesLab();

    frameCount++;
    if (ts - lastTime >= 1000) {
        fpsDisplay = frameCount;
        frameCount = 0;
        lastTime = ts;
        document.getElementById('fps-counter').textContent = `FPS: ${fpsDisplay}`;
    }

    updateTimeIndicator();
    requestAnimationFrame(loop);
}

function advanceSimulation() {
    if (!sim) return lastData;

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

    return lastData;
}

function advanceCompareMode() {
    for (const scene of compareScenes) {
        if (!scene.sim) continue;
        let data = scene.lastData;
        if (timeScale > 0) {
            for (let i = 0; i < timeScale; i++) {
                data = scene.sim.tick();
            }
            scene.lastData = data;
        } else if (timeScale < 0) {
            scene.slowCounter += 1;
            if (scene.slowCounter >= Math.abs(timeScale)) {
                scene.slowCounter = 0;
                data = scene.sim.tick();
                scene.lastData = data;
            }
        }

        if (scene.lastData) {
            renderScene(scene.ctx, scene.canvas, scene.lastData, scene);
            updateCompareOverlay(scene);
        }
    }
}

function bindRulesLab() {
    document.querySelectorAll('.rules-tab').forEach(button => {
        button.addEventListener('click', () => {
            const nextRule = button.dataset.rule;
            if (!RULE_DEMOS[nextRule] || nextRule === currentRuleDemo) return;
            currentRuleDemo = nextRule;
            document.querySelectorAll('.rules-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.rule === nextRule));
            resetRuleDemo(nextRule);
            updateRulesLabCopy();
        });
    });
}

function updateRulesLabCopy() {
    const config = RULE_DEMOS[currentRuleDemo];
    document.getElementById('rules-title').textContent = config.title;
    document.getElementById('rules-param').textContent = config.param;
    document.getElementById('rules-definition').textContent = config.definition;
    document.getElementById('rules-effect').textContent = config.effect;
    document.getElementById('rules-tags').innerHTML = config.tags.map(tag => `<span class="metric-pill">${tag}</span>`).join('');
}

function createRuleDemoState() {
    return {
        boids: [],
        rng: createSeededRandom(RULE_DEMO_SEED),
        frame: 0,
    };
}

function resetRuleDemo(rule) {
    rulesState = createRuleDemoState();
    const width = rulesCanvas.clientWidth || 300;
    const height = rulesCanvas.clientHeight || 210;
    const rng = rulesState.rng;
    const centerBias = rule === 'cohesion';
    for (let i = 0; i < 28; i++) {
        const x = centerBias ? width * 0.5 + (rng() - 0.5) * width * 0.35 : rng() * width;
        const y = centerBias ? height * 0.5 + (rng() - 0.5) * height * 0.35 : rng() * height;
        const angle = rng() * Math.PI * 2;
        const speed = 1.2 + rng() * 1.4;
        rulesState.boids.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
        });
    }
}

function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0xffffffff;
    };
}

function render(data) {
    renderScene(ctx, canvas, data, {
        previousPredatorTargets,
        previousCaptureCount,
        switchTrails,
        captureBursts,
        assign(next) {
            previousPredatorTargets = next.previousPredatorTargets;
            previousCaptureCount = next.previousCaptureCount;
            switchTrails = next.switchTrails;
            captureBursts = next.captureBursts;
        },
    });
}

function renderScene(targetCtx, targetCanvas, data, sceneState) {
    const w = targetCanvas.width / (window.devicePixelRatio || 1);
    const h = targetCanvas.height / (window.devicePixelRatio || 1);
    const stats = readStats(data);
    const numBoids = data[0];
    const numPreds = data[1];

    if ((!compareMode || sceneState.assign) && !experimentRecords.length && !activeRun) {
        updateStats(stats);
        updateRunTimelineSample(stats);
    }

    if (showTrails) {
        targetCtx.fillStyle = 'rgba(15, 15, 26, 0.12)';
        targetCtx.fillRect(0, 0, w, h);
    } else {
        targetCtx.fillStyle = '#0f0f1a';
        targetCtx.fillRect(0, 0, w, h);
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
            drawVisionCone(targetCtx, x, y, angle, parseFloat(document.getElementById('visualRange').value), parseFloat(document.getElementById('viewAngle').value));
            targetCtx.strokeStyle = 'rgba(79, 195, 247, 0.08)';
            targetCtx.lineWidth = 0.5;
            targetCtx.stroke();
        }

        let color = '#4fc3f7';
        if (alert > 0.5) {
            const t = Math.min(alert, 1);
            const r = Math.round(79 + (255 - 79) * t);
            const g = Math.round(195 + (213 - 195) * t);
            const b = Math.round(247 + (79 - 247) * t);
            color = `rgb(${r},${g},${b})`;
        }

        if (highlightEdge) {
            const cx = w / 2;
            const cy = h / 2;
            const dist = Math.hypot(x - cx, y - cy);
            const maxDist = Math.min(w, h) * 0.35;
            if (dist > maxDist) {
                color = '#ffd54f';
            }
        }

        drawBoid(targetCtx, x, y, angle, 7, color);
    }

    let lastPredatorPos = null;
    const po = bo + numBoids * BOID_STRIDE;
    for (let i = 0; i < numPreds; i++) {
        const off = po + i * PRED_STRIDE;
        const px = data[off];
        const py = data[off + 1];
        const pvx = data[off + 2];
        const pvy = data[off + 3];
        const tx = data[off + 4];
        const ty = data[off + 5];
        const confusion = data[off + 6];
        const state = data[off + 7];
        const prev = sceneState.previousPredatorTargets[i];
        if (showTargetLine && tx >= 0 && ty >= 0 && prev && (Math.abs(prev.tx - tx) > 0.1 || Math.abs(prev.ty - ty) > 0.1)) {
            sceneState.switchTrails.push({
                x1: px,
                y1: py,
                x2: tx,
                y2: ty,
                width: w,
                height: h,
                ttl: 22,
                maxTtl: 22,
            });
        }
        sceneState.previousPredatorTargets[i] = { tx, ty };
        lastPredatorPos = { x: px, y: py };
        const predatorColor = state >= 2
            ? '#ff8a65'
            : state >= 1
                ? '#ef5350'
                : '#ffca28';

        if (confusion > 0.05) {
            targetCtx.beginPath();
            targetCtx.arc(px, py, 10 + confusion * 8, 0, Math.PI * 2);
            targetCtx.strokeStyle = `rgba(255, 202, 40, ${Math.min(0.45, confusion * 0.25)})`;
            targetCtx.lineWidth = 1;
            targetCtx.stroke();
        }

        drawBoid(targetCtx, px, py, Math.atan2(pvy, pvx), 13, predatorColor);

        if (showTargetLine && tx >= 0 && ty >= 0) {
            targetCtx.setLineDash([4, 4]);
            targetCtx.strokeStyle = 'rgba(239, 83, 80, 0.35)';
            targetCtx.lineWidth = 1;
            drawWrappedLine(targetCtx, px, py, tx, ty, w, h);
            targetCtx.setLineDash([]);
        }
    }

    if (stats.captures > sceneState.previousCaptureCount) {
        sceneState.captureBursts.push({
            x: lastPredatorPos?.x ?? w * 0.5,
            y: lastPredatorPos?.y ?? h * 0.5,
            ttl: 18,
            maxTtl: 18,
            radius: 18,
        });
        sceneState.previousCaptureCount = stats.captures;
    } else if (stats.captures < sceneState.previousCaptureCount) {
        sceneState.previousCaptureCount = stats.captures;
    }

    renderEventEffects(targetCtx, sceneState);
    if (sceneState.assign) {
        sceneState.assign(sceneState);
    }
}

function drawBoid(targetCtx, x, y, angle, size, color) {
    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.rotate(angle);
    targetCtx.beginPath();
    targetCtx.moveTo(size, 0);
    targetCtx.lineTo(-size * 0.6, -size * 0.4);
    targetCtx.lineTo(-size * 0.3, 0);
    targetCtx.lineTo(-size * 0.6, size * 0.4);
    targetCtx.closePath();
    targetCtx.fillStyle = color;
    targetCtx.fill();
    targetCtx.restore();
}

function drawVisionCone(targetCtx, x, y, angle, radius, angleDeg) {
    const half = (angleDeg * Math.PI / 180) * 0.5;
    targetCtx.beginPath();
    targetCtx.moveTo(x, y);
    targetCtx.arc(x, y, radius, angle - half, angle + half);
    targetCtx.closePath();
}

function wrapAxisDelta(delta, size) {
    if (delta > size * 0.5) return delta - size;
    if (delta < -size * 0.5) return delta + size;
    return delta;
}

function drawWrappedLine(targetCtx, x1, y1, x2, y2, width, height) {
    const dx = wrapAxisDelta(x2 - x1, width);
    const dy = wrapAxisDelta(y2 - y1, height);
    const targetX = x1 + dx;
    const targetY = y1 + dy;

    for (const ox of [-width, 0, width]) {
        for (const oy of [-height, 0, height]) {
            targetCtx.beginPath();
            targetCtx.moveTo(x1 + ox, y1 + oy);
            targetCtx.lineTo(targetX + ox, targetY + oy);
            targetCtx.stroke();
        }
    }
}

function renderEventEffects(targetCtx, sceneState) {
    sceneState.switchTrails = sceneState.switchTrails.filter(trail => trail.ttl > 0);
    for (const trail of sceneState.switchTrails) {
        const alpha = trail.ttl / trail.maxTtl;
        targetCtx.strokeStyle = `rgba(255, 202, 40, ${alpha * 0.35})`;
        targetCtx.lineWidth = 1 + alpha;
        drawWrappedLine(targetCtx, trail.x1, trail.y1, trail.x2, trail.y2, trail.width, trail.height);
        trail.ttl -= 1;
    }

    sceneState.captureBursts = sceneState.captureBursts.filter(burst => burst.ttl > 0);
    for (const burst of sceneState.captureBursts) {
        const alpha = burst.ttl / burst.maxTtl;
        targetCtx.beginPath();
        targetCtx.arc(burst.x, burst.y, burst.radius + (1 - alpha) * 16, 0, Math.PI * 2);
        targetCtx.strokeStyle = `rgba(239, 83, 80, ${alpha * 0.4})`;
        targetCtx.lineWidth = 2;
        targetCtx.stroke();
        burst.ttl -= 1;
    }
}

function updateStats(stats) {
    document.getElementById('stat-captures').textContent = stats.captures;
    document.getElementById('stat-rate').textContent = stats.captureRate.toFixed(2);
    document.getElementById('stat-success').textContent = (stats.successRate * 100).toFixed(1) + '%';
    document.getElementById('stat-reaction').textContent = stats.avgReaction > 0 ? stats.avgReaction.toFixed(0) + ' 帧' : '--';
    document.getElementById('stat-first-alert').textContent = stats.firstAlertDelay > 0 ? stats.firstAlertDelay.toFixed(0) + ' 帧' : '--';
    document.getElementById('stat-alert-coverage').textContent = (stats.alertCoverage * 100).toFixed(1) + '%';
    document.getElementById('stat-compact').textContent = stats.compactness.toFixed(1) + ' px';
    document.getElementById('stat-edge').textContent = (stats.edgeRatio * 100).toFixed(1) + '%';
    document.getElementById('stat-switches').textContent = stats.switches;
    document.getElementById('stat-lock').textContent = stats.avgLockDuration > 0 ? stats.avgLockDuration.toFixed(1) + ' 帧' : '--';
    document.getElementById('stat-confusion').textContent = stats.meanConfusion.toFixed(2);
    document.getElementById('stat-alive').textContent = stats.aliveCount;
    updateStateBadges(stats);

    const expRateEl = document.getElementById('stat-exp-rate');
    const progressBar = document.getElementById('exp-progress-bar');
    const statusEl = document.getElementById('exp-status');

    if (stats.expProgress > 0) {
        progressBar.style.width = (stats.expProgress * 100).toFixed(1) + '%';
        expRateEl.textContent = stats.expCaptureRate.toFixed(3);

        if (stats.expProgress >= 1.0) {
            statusEl.textContent = buildExperimentStatus('done', stats.expProgress);
            statusEl.className = 'exp-status done';
        } else {
            statusEl.textContent = buildExperimentStatus('running', stats.expProgress);
            statusEl.className = 'exp-status running';
        }
    } else {
        expRateEl.textContent = '--';
        progressBar.style.width = '0%';
    }
}

function updateStateBadges(stats) {
    const totalBoids = Math.max(1, Number(document.getElementById('numBoids')?.value || 1));
    const aliveRatio = stats.aliveCount / totalBoids;

    setBadge('stat-exp-rate-band', stats.expCaptureRate <= 0 ? '待运行' : stats.expCaptureRate < 0.35 ? '低风险' : stats.expCaptureRate < 0.8 ? '中风险' : '高风险');
    setBadge('stat-success-band', stats.successRate <= 0 ? '低截获' : stats.successRate < 0.35 ? '不稳定' : stats.successRate < 0.65 ? '中等' : '高效率');
    setBadge('stat-reaction-band', stats.avgReaction <= 0 ? '待运行' : stats.avgReaction < 120 ? '反应快' : stats.avgReaction < 260 ? '反应中' : '反应慢');
    setBadge('stat-alert-band', stats.alertCoverage < 0.25 ? '局部' : stats.alertCoverage < 0.65 ? '扩散中' : '全群警戒');
    setBadge('stat-alive-band', aliveRatio > 0.85 ? '损失低' : aliveRatio > 0.6 ? '损失中' : '损失高');
    setBadge('stat-compact-band', stats.compactness <= 0 ? '待运行' : stats.compactness < 90 ? '紧' : stats.compactness < 150 ? '中' : '松');
}

function setBadge(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function updateRunTimelineSample(stats) {
    if (!activeRun?.collectLiveTimeline || stats.expProgress <= 0) return;
    if (!activeRun.timeline) {
        activeRun.timeline = [];
        activeRun.lastTimelineFrame = -TIMELINE_SAMPLE_STEP;
    }

    const frame = Math.round(stats.expProgress * EXPERIMENT_FRAMES);
    if (frame - activeRun.lastTimelineFrame < TIMELINE_SAMPLE_STEP && stats.expProgress < 1) {
        return;
    }

    activeRun.timeline.push({
        frame,
        captureRate: stats.expCaptureRate,
        alertCoverage: stats.alertCoverage,
        meanConfusion: stats.meanConfusion,
    });
    activeRun.lastTimelineFrame = frame;
}

function buildExperimentStatus(mode, progress) {
    if (activeRun?.mode === 'batch') {
        const prefix = `批量实验 ${activeRun.completedRuns + (mode === 'done' ? 1 : 0)}/${activeRun.totalRuns}`;
        if (mode === 'done') {
            return `${prefix} 完成`;
        }
        return `${prefix} 进行中... ${(progress * 100).toFixed(0)}%`;
    }

    if (mode === 'done') {
        return `实验完成 (${EXPERIMENT_FRAMES} 帧)`;
    }
    return `实验进行中... ${(progress * 100).toFixed(0)}%`;
}

function renderRulesLab() {
    if (!rulesCtx || !rulesState) return;
    if (!rulesState.boids.length) {
        resetRuleDemo(currentRuleDemo);
    }

    updateRuleDemo();

    const width = rulesCanvas.width / (window.devicePixelRatio || 1);
    const height = rulesCanvas.height / (window.devicePixelRatio || 1);
    const config = RULE_DEMOS[currentRuleDemo];

    rulesCtx.fillStyle = 'rgba(10, 13, 24, 0.55)';
    rulesCtx.fillRect(0, 0, width, height);
    rulesCtx.strokeStyle = 'rgba(255,255,255,0.03)';
    rulesCtx.lineWidth = 1;
    for (let x = 0; x < width; x += 48) {
        rulesCtx.beginPath();
        rulesCtx.moveTo(x, 0);
        rulesCtx.lineTo(x, height);
        rulesCtx.stroke();
    }
    for (let y = 0; y < height; y += 48) {
        rulesCtx.beginPath();
        rulesCtx.moveTo(0, y);
        rulesCtx.lineTo(width, y);
        rulesCtx.stroke();
    }

    for (const boid of rulesState.boids) {
        drawBoid(rulesCtx, boid.x, boid.y, Math.atan2(boid.vy, boid.vx), 8, config.color);
    }
}

function updateRuleDemo() {
    const width = rulesCanvas.width / (window.devicePixelRatio || 1);
    const height = rulesCanvas.height / (window.devicePixelRatio || 1);
    const config = RULE_DEMOS[currentRuleDemo];
    const visualRange = currentRuleDemo === 'alignment' ? 86 : 72;
    const protectedRange = currentRuleDemo === 'separation' ? 26 : 18;
    const maxSpeed = 2.6;
    const minSpeed = 1.2;
    const next = [];

    for (let i = 0; i < rulesState.boids.length; i++) {
        const me = rulesState.boids[i];
        let sepX = 0;
        let sepY = 0;
        let alignX = 0;
        let alignY = 0;
        let cohX = 0;
        let cohY = 0;
        let neighbors = 0;

        for (let j = 0; j < rulesState.boids.length; j++) {
            if (i === j) continue;
            const other = rulesState.boids[j];
            let dx = other.x - me.x;
            let dy = other.y - me.y;
            if (dx > width * 0.5) dx -= width;
            if (dx < -width * 0.5) dx += width;
            if (dy > height * 0.5) dy -= height;
            if (dy < -height * 0.5) dy += height;
            const distSq = dx * dx + dy * dy;
            if (distSq < 1e-6) continue;

            if (distSq < protectedRange * protectedRange) {
                sepX -= dx / Math.sqrt(distSq);
                sepY -= dy / Math.sqrt(distSq);
            }

            if (distSq < visualRange * visualRange) {
                alignX += other.vx;
                alignY += other.vy;
                cohX += dx;
                cohY += dy;
                neighbors += 1;
            }
        }

        if (neighbors > 0) {
            alignX = alignX / neighbors - me.vx;
            alignY = alignY / neighbors - me.vy;
            cohX = cohX / neighbors;
            cohY = cohY / neighbors;
        }

        let vx = me.vx
            + sepX * 0.045 * config.weights.separation
            + alignX * 0.05 * config.weights.alignment
            + cohX * 0.0018 * config.weights.cohesion;
        let vy = me.vy
            + sepY * 0.045 * config.weights.separation
            + alignY * 0.05 * config.weights.alignment
            + cohY * 0.0018 * config.weights.cohesion;

        const centerX = width * 0.5 - me.x;
        const centerY = height * 0.5 - me.y;
        if (currentRuleDemo === 'cohesion') {
            vx += centerX * 0.0009;
            vy += centerY * 0.0009;
        }

        const len = Math.hypot(vx, vy) || 1;
        const clamped = Math.min(maxSpeed, Math.max(minSpeed, len));
        vx = vx / len * clamped;
        vy = vy / len * clamped;

        let x = me.x + vx;
        let y = me.y + vy;
        if (x < 0) x += width;
        if (x >= width) x -= width;
        if (y < 0) y += height;
        if (y >= height) y -= height;

        next.push({ x, y, vx, vy });
    }

    rulesState.boids = next;
    rulesState.frame += 1;
}

function createCompareScenes() {
    return [
        createSceneState('left', document.getElementById('canvas-left'), document.getElementById('compare-left-label'), document.getElementById('compare-left-stats')),
        createSceneState('right', document.getElementById('canvas-right'), document.getElementById('compare-right-label'), document.getElementById('compare-right-stats')),
    ];
}

function createSceneState(side, targetCanvas, labelEl, statsEl) {
    return {
        side,
        canvas: targetCanvas,
        ctx: targetCanvas.getContext('2d'),
        labelEl,
        statsEl,
        sim: null,
        lastData: null,
        presetKey: null,
        preset: null,
        slowCounter: 0,
        previousPredatorTargets: [],
        previousCaptureCount: 0,
        switchTrails: [],
        captureBursts: [],
    };
}

function initializeCompareScene(scene, presetKey, preset, seed) {
    const container = document.getElementById('canvas-container');
    const width = compareMode ? Math.floor(container.clientWidth / (window.innerWidth <= 700 ? 1 : 2)) : container.clientWidth;
    const height = compareMode && window.innerWidth <= 700 ? Math.floor(container.clientHeight / 2) : container.clientHeight;

    scene.sim = new Simulation(width, height, preset.numBoids, preset.numPredators);
    scene.sim.setSeed(seed);
    scene.presetKey = presetKey;
    scene.preset = preset;
    scene.lastData = null;
    scene.slowCounter = 0;
    scene.previousPredatorTargets = [];
    scene.previousCaptureCount = 0;
    scene.switchTrails = [];
    scene.captureBursts = [];

    applyParamsToSimulation(scene.sim, preset);
    scene.labelEl.textContent = preset.label;
    scene.statsEl.textContent = `Seed ${seed}`;
}

function updateCompareOverlay(scene) {
    if (!scene.lastData || !scene.preset) return;
    const stats = readStats(scene.lastData);
    scene.labelEl.textContent = scene.preset.label;
    scene.statsEl.textContent = `捕获 ${stats.expCaptureRate.toFixed(3)} | 成功 ${(stats.successRate * 100).toFixed(1)}%`;
}

function bindSliders() {
    for (const [id, { setter, type }] of Object.entries(PARAM_MAP)) {
        const el = document.getElementById(id);
        if (!el) continue;
        const valEl = document.getElementById('val-' + id);
        el.addEventListener('input', () => {
            const raw = el.value;
            const value = type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
            if (valEl) valEl.textContent = raw;
            if (sim && sim[setter]) sim[setter](value);
        });
    }
}

function bindTimeScale() {
    const el = document.getElementById('timeScale');
    const valEl = document.getElementById('val-timeScale');
    el.addEventListener('input', () => {
        timeScale = parseInt(el.value, 10);
        slowCounter = 0;
        valEl.textContent = timeScale < 0 ? '1/' + Math.abs(timeScale) : String(timeScale);
    });

    const batchEl = document.getElementById('batchCount');
    const batchValEl = document.getElementById('val-batchCount');
    batchEl.addEventListener('input', () => {
        batchValEl.textContent = batchEl.value;
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
            if (btn.id === 'btn-random-preset') return;
            const key = btn.dataset.preset;
            const preset = PRESETS[key];
            if (!preset || !sim || activeRun) return;

            setActivePreset(key, preset, btn);
        });
    });

    document.getElementById('btn-random-preset')?.addEventListener('click', () => {
        if (!sim || activeRun) return;

        const preset = buildRandomPreset();
        setActiveGeneratedPreset(preset, document.getElementById('btn-random-preset'));
    });
}

function applyPreset(preset) {
    for (const [id, { setter, type }] of Object.entries(PARAM_MAP)) {
        if (preset[id] === undefined) continue;
        const el = document.getElementById(id);
        if (el) {
            el.value = preset[id];
            const valEl = document.getElementById('val-' + id);
            if (valEl) valEl.textContent = preset[id];
        }

        const value = type === 'int' ? parseInt(preset[id], 10) : parseFloat(preset[id]);
        if (sim[setter]) sim[setter](value);
    }

    if (preset.preferEdge !== undefined) {
        sim.setPreferEdgeTarget(preset.preferEdge);
        document.getElementById('preferEdge').checked = preset.preferEdge;
    }

    if (preset.defaultSeed) {
        document.getElementById('seedInput').value = preset.defaultSeed;
        if (document.getElementById('useFixedSeed').checked) {
            sim.setSeed(preset.defaultSeed);
            syncSeedDisplay();
        }
    }
}

function setActivePreset(key, preset, button) {
    activePresetKey = key;
    activePresetMeta = null;
    markActivePresetButton(button);
    applyPreset(preset);
    updatePresetExplainer();
    setPresetLoadedStatus(preset.label);
}

function setActiveGeneratedPreset(preset, button) {
    activePresetKey = null;
    activePresetMeta = preset;
    markActivePresetButton(button);
    applyPreset(preset);
    updatePresetExplainer();
    setPresetLoadedStatus(preset.label);
}

function markActivePresetButton(activeButton) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn === activeButton);
    });
}

function setPresetLoadedStatus(label) {
    const statusEl = document.getElementById('exp-status');
    statusEl.textContent = `已加载 ${label} 参数模板。正式实验请在 A/B 条件里选择模板后点击“运行 A/B”。`;
    statusEl.className = 'exp-status';
}

function buildRandomPreset() {
    randomPresetCounter += 1;
    const randFloat = (min, max, digits = 2) => Number((min + Math.random() * (max - min)).toFixed(digits));
    const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

    return {
        label: `随机模板 #${randomPresetCounter}`,
        family: 'random',
        variant: 'Rnd',
        mechanism: '随机探索',
        hypothesis: '在合理范围内重新采样群体与捕食参数，用于快速探索不同条件下的涌现行为。',
        keyMetrics: ['实验捕获率', '平均反应时间', '群体紧密度'],
        defaultSeed: document.getElementById('useFixedSeed').checked ? readSeedInput() : randomSeed(),
        references: '随机模板在经验范围内采样，不对应单一文献场景。',
        numBoids: randInt(80, 260),
        numPredators: randInt(1, 2),
        visualRange: randInt(55, 110),
        viewAngle: randInt(180, 300),
        protectedRange: randInt(10, 22),
        avoidanceFactor: randFloat(0.03, 0.12, 3),
        matchingFactor: randFloat(0.03, 0.10, 3),
        centeringFactor: randFloat(0.003, 0.012, 3),
        maxSpeed: randFloat(5.0, 7.2, 1),
        minSpeed: randFloat(2.5, 4.2, 1),
        fleeRange: randInt(110, 190),
        fleeFactor: randFloat(0.35, 0.90, 2),
        alertSpread: randFloat(0.75, 0.96, 2),
        predatorSpeed: randFloat(3.8, 5.8, 1),
        chaseFactor: randFloat(0.02, 0.05, 3),
        predatorTurnRate: randFloat(0.12, 0.24, 2),
        captureRadius: randInt(8, 12),
        confusionThreshold: randInt(4, 12),
        lockFrames: randInt(10, 24),
        preferEdge: Math.random() >= 0.5,
    };
}

function bindActions() {
    document.getElementById('btn-pause').addEventListener('click', () => {
        if (timeScale === 0) {
            setTimeScale(1);
            document.getElementById('btn-pause').textContent = '暂停';
            document.getElementById('btn-pause').classList.remove('paused');
        } else {
            setTimeScale(0);
            document.getElementById('btn-pause').textContent = '继续';
            document.getElementById('btn-pause').classList.add('paused');
        }
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        stopActiveRun(false);
        if (compareMode) {
            for (const scene of compareScenes) {
                scene.lastData = null;
                scene.sim = null;
                scene.statsEl.textContent = '--';
            }
        } else {
            sim.resetSimulation();
            sim.setExperimentDuration(0);
            lastData = null;
        }
        resetExperimentStatus();
    });
}

function bindExperimentControls() {
    document.getElementById('btn-run').addEventListener('click', () => {
        if (!sim || activeRun) return;
        void startPairExperimentRun('single');
    });

    document.getElementById('btn-batch').addEventListener('click', () => {
        if (!sim || activeRun) return;
        void startPairExperimentRun('batch');
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
        stopActiveRun(true);
    });

    document.getElementById('btn-randomize-seed').addEventListener('click', () => {
        const seed = randomSeed();
        document.getElementById('seedInput').value = seed;
        if (document.getElementById('useFixedSeed').checked) {
            sim.setSeed(seed);
            syncSeedDisplay();
        }
    });

    document.getElementById('useFixedSeed').addEventListener('change', () => {
        if (document.getElementById('useFixedSeed').checked) {
            sim.setSeed(readSeedInput());
            syncSeedDisplay();
        }
    });

    document.getElementById('seedInput').addEventListener('change', () => {
        const seed = readSeedInput();
        document.getElementById('seedInput').value = seed;
        if (document.getElementById('useFixedSeed').checked) {
            sim.setSeed(seed);
            syncSeedDisplay();
        }
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
        exportRecords('json');
    });

    document.getElementById('btn-export-csv').addEventListener('click', () => {
        exportRecords('csv');
    });
}

function bindCompareControls() {
    populateComparePresetSelects();

    document.getElementById('compareMode').addEventListener('change', e => {
        compareMode = e.target.checked;
        updateStageMode();
        resize();
    });

    document.getElementById('btn-compare-run').addEventListener('click', () => {
        startCompareRun();
    });
}

function populateComparePresetSelects() {
    const left = document.getElementById('compareLeftPreset');
    const right = document.getElementById('compareRightPreset');
    const options = [
        '<option value="__current__">当前右侧参数</option>',
        ...Object.entries(PRESETS).map(([key, preset]) => `<option value="${key}">${preset.label}</option>`),
    ].join('');
    left.innerHTML = options;
    right.innerHTML = options;
    left.value = 'manyeyes-a';
    right.value = 'manyeyes-b';
}

function updateStageMode() {
    document.getElementById('single-stage').classList.toggle('active', !compareMode);
    document.getElementById('compare-stage').classList.toggle('active', compareMode);
    document.getElementById('compare-controls').classList.toggle('display-mode', compareMode);
    document.getElementById('btn-run').disabled = !!activeRun;
    document.getElementById('btn-batch').disabled = !!activeRun;
    document.getElementById('btn-compare-run').disabled = !compareMode || !!activeRun;

    const statusEl = document.getElementById('exp-status');
    if (!activeRun) {
        statusEl.textContent = compareMode
            ? '当前为双画布同屏对照模式。A/B 模板用于可视观察；正式实验仍使用“运行 A/B”。'
            : '先选择 A/B 条件模板，再手动运行 A/B 实验。';
        statusEl.className = 'exp-status';
    }
}

function startCompareRun() {
    if (!compareMode) return;

    const leftKey = document.getElementById('compareLeftPreset').value;
    const rightKey = document.getElementById('compareRightPreset').value;
    const leftPreset = PRESETS[leftKey];
    const rightPreset = PRESETS[rightKey];
    if (!leftPreset || !rightPreset) return;

    const baseSeed = document.getElementById('useFixedSeed').checked ? readSeedInput() : (leftPreset.defaultSeed || randomSeed());
    initializeCompareScene(compareScenes[0], leftKey, leftPreset, baseSeed);
    initializeCompareScene(compareScenes[1], rightKey, rightPreset, baseSeed);
    document.getElementById('exp-status').textContent = `同屏对照已启动，共用 Seed ${baseSeed}。`;
    document.getElementById('exp-status').className = 'exp-status';
    ensureSimulationRunning();
}

async function startPairExperimentRun(mode) {
    const pair = getSelectedPairConfig();
    if (!pair) return;
    const totalRuns = mode === 'batch' ? parseInt(document.getElementById('batchCount').value, 10) : 1;
    const baseSeed = prepareSeedForPairRun();

    activeRun = {
        kind: 'pair',
        mode,
        pairLabel: `${pair.leftPreset.label} vs ${pair.rightPreset.label}`,
        family: pair.family,
        mechanism: pair.mechanism,
        totalRuns,
        completedRuns: 0,
        stopped: false,
        baseSeed,
    };

    lockRunControls(true);
    document.getElementById('btn-stop').disabled = false;
    setPairRunStatus(
        activeRun.mode === 'batch'
            ? `批量 A/B 实验准备中 0/${totalRuns}，共用 Seed 起点 ${baseSeed}。`
            : `A/B 实验准备中，A=${pair.leftPreset.label}，B=${pair.rightPreset.label}，Seed ${baseSeed}。`,
        'running'
    );
    resetProgressBar();

    try {
        if (mode === 'single') {
            const result = await runPairExperiment({
                conditionA: pair.leftPreset,
                conditionB: pair.rightPreset,
                seed: baseSeed,
                pairLabel: activeRun.pairLabel,
                family: activeRun.family,
                mechanism: activeRun.mechanism,
                durationFrames: EXPERIMENT_FRAMES,
                includeTimeline: true,
            });
            finalizePairRuns([result], false);
        } else {
            const batch = await runBatchPairExperiments({
                conditionA: pair.leftPreset,
                conditionB: pair.rightPreset,
                repeatCount: totalRuns,
                baseSeed,
                pairLabel: activeRun.pairLabel,
                family: activeRun.family,
                mechanism: activeRun.mechanism,
                durationFrames: EXPERIMENT_FRAMES,
                includeTimeline: false,
                shouldStop: () => activeRun?.stopped ?? true,
                onProgress: progress => {
                    if (!activeRun) return;
                    activeRun.completedRuns = progress.completed;
                    updateProgressBar(progress.completed / Math.max(1, totalRuns));
                    setPairRunStatus(`批量 A/B 实验 ${progress.completed}/${totalRuns}，当前 Seed ${progress.seed}。`, 'running');
                },
            });
            finalizePairRuns(batch.runs, activeRun?.stopped ?? false);
        }
    } catch (error) {
        console.error(error);
        setPairRunStatus(`A/B 实验失败：${error.message}`, '');
        lockRunControls(false);
        document.getElementById('btn-stop').disabled = true;
        activeRun = null;
    }
}

function stopActiveRun(clearExperimentDuration) {
    if (!activeRun) return;

    activeRun.stopped = true;
    if (clearExperimentDuration && activeRun.kind !== 'pair') {
        sim.setExperimentDuration(0);
    }

    if (activeRun.kind !== 'pair') {
        lockRunControls(false);
        document.getElementById('btn-stop').disabled = true;
        activeRun = null;
    }

    setPairRunStatus('实验已停止', '');
}

function captureCurrentParams() {
    const params = {};
    for (const id of Object.keys(PARAM_MAP)) {
        const el = document.getElementById(id);
        params[id] = el ? Number(el.value) : null;
    }
    params.preferEdge = document.getElementById('preferEdge').checked;
    return params;
}

function updateLatestPairDisplay(pair) {
    if (!pair) return;
    setPairMetricDisplay('stat-exp-rate', 'stat-exp-rate-band', pair.resultA.stats.expCaptureRate, pair.resultB.stats.expCaptureRate, value => value.toFixed(3), delta => delta < 0 ? 'B 风险更低' : 'B 风险更高');
    setPairMetricDisplay('stat-success', 'stat-success-band', pair.resultA.stats.successRate, pair.resultB.stats.successRate, value => `${(value * 100).toFixed(1)}%`, delta => delta > 0 ? 'B 更易截获' : 'B 更难截获');
    setPairMetricDisplay('stat-reaction', 'stat-reaction-band', pair.resultA.stats.avgReaction, pair.resultB.stats.avgReaction, value => value > 0 ? `${value.toFixed(0)} 帧` : '--', delta => delta < 0 ? 'B 反应更快' : 'B 反应更慢');
    setPairMetricDisplay('stat-alert-coverage', 'stat-alert-band', pair.resultA.stats.alertCoverage, pair.resultB.stats.alertCoverage, value => `${(value * 100).toFixed(1)}%`, delta => delta > 0 ? 'B 覆盖更广' : 'B 覆盖更窄');
    setPairMetricDisplay('stat-alive', 'stat-alive-band', pair.resultA.stats.aliveCount, pair.resultB.stats.aliveCount, value => value.toFixed(0), delta => delta > 0 ? 'B 存活更多' : 'B 存活更少');
    setPairMetricDisplay('stat-compact', 'stat-compact-band', pair.resultA.stats.compactness, pair.resultB.stats.compactness, value => `${value.toFixed(1)} px`, delta => delta < 0 ? 'B 更紧密' : 'B 更松散');

    document.getElementById('stat-captures').textContent = `${pair.resultA.stats.captures} / ${pair.resultB.stats.captures}`;
    document.getElementById('stat-rate').textContent = `${pair.resultA.stats.captureRate.toFixed(2)} / ${pair.resultB.stats.captureRate.toFixed(2)}`;
    document.getElementById('stat-first-alert').textContent = `${formatMetricFrame(pair.resultA.stats.firstAlertDelay)} / ${formatMetricFrame(pair.resultB.stats.firstAlertDelay)}`;
    document.getElementById('stat-edge').textContent = `${(pair.resultA.stats.edgeRatio * 100).toFixed(1)}% / ${(pair.resultB.stats.edgeRatio * 100).toFixed(1)}%`;
    document.getElementById('stat-switches').textContent = `${pair.resultA.stats.switches} / ${pair.resultB.stats.switches}`;
    document.getElementById('stat-lock').textContent = `${formatMetricFrame(pair.resultA.stats.avgLockDuration, 1)} / ${formatMetricFrame(pair.resultB.stats.avgLockDuration, 1)}`;
    document.getElementById('stat-confusion').textContent = `${pair.resultA.stats.meanConfusion.toFixed(2)} / ${pair.resultB.stats.meanConfusion.toFixed(2)}`;
}

function setPairMetricDisplay(valueId, badgeId, aValue, bValue, formatter, badgeBuilder) {
    document.getElementById(valueId).textContent = `A ${formatter(aValue)} · B ${formatter(bValue)}`;
    const delta = bValue - aValue;
    setBadge(badgeId, badgeBuilder(delta));
}

function formatMetricFrame(value, digits = 0) {
    return value > 0 ? `${value.toFixed(digits)} 帧` : '--';
}

function finalizePairRuns(runs, wasStopped) {
    if (runs.length) {
        experimentRecords = [...runs.reverse(), ...experimentRecords].slice(0, MAX_RECORDS);
        renderRecords();
        updateLatestPairDisplay(experimentRecords[0]);
    }

    const completed = runs.length;
    const total = activeRun?.totalRuns ?? completed;
    if (wasStopped) {
        setPairRunStatus(`批量 A/B 实验已停止，已完成 ${completed}/${total} 组。`, '');
    } else if (activeRun?.mode === 'batch') {
        updateProgressBar(1);
        setPairRunStatus(`批量 A/B 实验完成，共 ${completed} 组，CSV 已可导出。`, 'done');
    } else {
        updateProgressBar(1);
        setPairRunStatus(`A/B 实验完成，Seed ${runs[0]?.seed ?? '--'}。`, 'done');
    }

    lockRunControls(false);
    document.getElementById('btn-stop').disabled = true;
    activeRun = null;
}

function getSelectedPairConfig() {
    const leftKey = document.getElementById('compareLeftPreset').value;
    const rightKey = document.getElementById('compareRightPreset').value;
    const leftPreset = leftKey === '__current__' ? buildCurrentCondition('A') : PRESETS[leftKey];
    const rightPreset = rightKey === '__current__' ? buildCurrentCondition('B') : PRESETS[rightKey];
    if (!leftPreset || !rightPreset) return null;
    return {
        leftKey,
        rightKey,
        leftPreset,
        rightPreset,
        family: leftPreset.family === rightPreset.family ? leftPreset.family : 'mixed',
        mechanism: leftPreset.mechanism === rightPreset.mechanism ? leftPreset.mechanism : `${leftPreset.mechanism} vs ${rightPreset.mechanism}`,
    };
}

function buildCurrentCondition(variant) {
    const params = captureCurrentParams();
    const activePreset = getActivePreset();
    return {
        label: activePreset?.label ? `${activePreset.label} (当前)` : '当前右侧参数',
        family: activePreset?.family ?? 'custom',
        variant,
        mechanism: activePreset?.mechanism ?? '自定义参数',
        conditionSource: activePreset?.conditionSource ?? 'current-panel',
        ...params,
    };
}

function prepareSeedForPairRun() {
    const useFixedSeed = document.getElementById('useFixedSeed').checked;
    const seed = useFixedSeed ? readSeedInput() : randomSeed();
    document.getElementById('seedInput').value = seed;
    sim.setSeed(seed);
    syncSeedDisplay();
    return seed;
}

function updateProgressBar(progress) {
    document.getElementById('exp-progress-bar').style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
}

function resetProgressBar() {
    updateProgressBar(0);
}

function setPairRunStatus(text, stateClass) {
    const statusEl = document.getElementById('exp-status');
    statusEl.textContent = text;
    statusEl.className = stateClass ? `exp-status ${stateClass}` : 'exp-status';
}

function renderRecords() {
    const body = document.getElementById('records-body');
    if (!experimentRecords.length) {
        body.innerHTML = '<tr class="records-empty"><td colspan="6">暂无实验记录</td></tr>';
        document.getElementById('compare-summary').textContent = '运行一次 A/B 实验后显示对比摘要';
        renderTimeline();
        renderRunTimelineChart();
        renderBatchCompareChart();
        updateABSummary();
        return;
    }

    body.innerHTML = experimentRecords.slice(0, 8).map((record, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${record.pairLabel}</td>
            <td>${record.seed}</td>
            <td>${record.resultA.stats.expCaptureRate.toFixed(3)} → ${record.resultB.stats.expCaptureRate.toFixed(3)}</td>
            <td>${(record.resultA.stats.successRate * 100).toFixed(1)}% → ${(record.resultB.stats.successRate * 100).toFixed(1)}%</td>
            <td>${formatSigned(record.delta.avgReaction, 0)} 帧</td>
        </tr>
    `).join('');

    updateCompareSummary();
    renderTimeline();
    renderRunTimelineChart();
    renderBatchCompareChart();
    updateABSummary();
}

function updateCompareSummary() {
    const summaryEl = document.getElementById('compare-summary');
    const latest = experimentRecords[0];
    if (!latest) {
        summaryEl.textContent = '运行一次 A/B 实验后显示对比摘要';
        return;
    }

    summaryEl.textContent =
        `${latest.pairLabel}：实验捕获率 Δ${formatSigned(latest.delta.expCaptureRate, 3)}，` +
        `攻击成功率 Δ${formatSigned(latest.delta.successRate * 100, 1)}%，` +
        `平均反应时间 Δ${formatSigned(latest.delta.avgReaction, 0)} 帧，` +
        `混淆强度 Δ${formatSigned(latest.delta.meanConfusion, 2)}。`;
}

function updatePresetExplainer() {
    const preset = getActivePreset();
    const mechanismEl = document.getElementById('preset-mechanism');
    const seedEl = document.getElementById('preset-seed-hint');
    const hypothesisEl = document.getElementById('preset-hypothesis');
    const metricsEl = document.getElementById('preset-metrics');
    const referenceEl = document.getElementById('preset-reference');

    if (!preset) {
        mechanismEl.textContent = '未选择机制';
        seedEl.textContent = '推荐 Seed: --';
        hypothesisEl.textContent = '选择预设后，这里会显示理论预期和建议观察指标。';
        metricsEl.innerHTML = '';
        referenceEl.textContent = '';
        return;
    }

    mechanismEl.textContent = `${preset.mechanism} · ${preset.variant} 方案`;
    seedEl.textContent = `推荐 Seed: ${preset.defaultSeed}`;
    hypothesisEl.textContent = preset.hypothesis;
    metricsEl.innerHTML = preset.keyMetrics.map(metric => `<span class="metric-pill">${metric}</span>`).join('');
    referenceEl.textContent = preset.references ?? '';
}

function renderTimeline() {
    const el = document.getElementById('records-timeline');
    if (!experimentRecords.length) {
        el.innerHTML = '<div class="insight-body">暂无实验趋势</div>';
        return;
    }

    const recent = experimentRecords.slice(0, 6).reverse();
    const maxRate = Math.max(...recent.map(record => Math.max(record.resultA.stats.expCaptureRate, record.resultB.stats.expCaptureRate)), 0.001);
    el.innerHTML = recent.map(record => {
        const height = Math.max(12, (Math.max(record.resultA.stats.expCaptureRate, record.resultB.stats.expCaptureRate) / maxRate) * 72);
        const label = (record.mechanism || record.pairLabel).slice(0, 4);
        return `<div class="timeline-bar" data-label="${label}" title="${record.pairLabel} · Δ${record.delta.expCaptureRate.toFixed(3)}" style="height:${height}px"></div>`;
    }).join('');
}

function renderRunTimelineChart() {
    const svg = document.getElementById('run-timeline-chart');
    const summary = document.getElementById('timeline-summary');
    const record = experimentRecords[0];
    const timelineA = record?.resultA?.timeline ?? [];
    const timelineB = record?.resultB?.timeline ?? [];
    if (!timelineA.length || !timelineB.length) {
        svg.innerHTML = '';
        summary.textContent = '完成一次 A/B 实验后显示时间线。';
        return;
    }

    const width = 320;
    const height = 120;
    const pad = 12;
    const xMax = Math.max(
        ...timelineA.map(sample => sample.frame),
        ...timelineB.map(sample => sample.frame),
        1
    );
    const rateMax = Math.max(
        ...timelineA.map(sample => sample.captureRate),
        ...timelineB.map(sample => sample.captureRate),
        0.001
    );

    const toX = frame => pad + (frame / xMax) * (width - pad * 2);
    const toYRate = value => height - pad - (value / rateMax) * (height - pad * 2);
    const toYUnit = value => height - pad - value * (height - pad * 2);

    const capturePathA = buildPath(timelineA, sample => toX(sample.frame), sample => toYRate(sample.captureRate));
    const capturePathB = buildPath(timelineB, sample => toX(sample.frame), sample => toYRate(sample.captureRate));
    const alertPathA = buildPath(timelineA, sample => toX(sample.frame), sample => toYUnit(sample.alertCoverage));
    const alertPathB = buildPath(timelineB, sample => toX(sample.frame), sample => toYUnit(sample.alertCoverage));
    const markers = buildTimelineMarkers(timelineA, timelineB, toX, toYUnit, toYRate);

    svg.innerHTML = `
        <path d="${capturePathA}" fill="none" stroke="#4fc3f7" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>
        <path d="${capturePathB}" fill="none" stroke="#66bb6a" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>
        <path d="${alertPathA}" fill="none" stroke="rgba(79,195,247,0.45)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></path>
        <path d="${alertPathB}" fill="none" stroke="rgba(102,187,106,0.45)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></path>
        ${markers}
    `;

    const firstA = timelineA[0];
    const lastA = timelineA[timelineA.length - 1];
    const firstB = timelineB[0];
    const lastB = timelineB[timelineB.length - 1];
    const eventLabels = summarizeTimelineEvents(timelineA, timelineB);
    summary.textContent =
        `最近 A/B：A 捕获率 ${firstA.captureRate.toFixed(2)}→${lastA.captureRate.toFixed(2)}，` +
        `B 捕获率 ${firstB.captureRate.toFixed(2)}→${lastB.captureRate.toFixed(2)}。${eventLabels}`;
}

function buildPath(samples, getX, getY) {
    return samples.map((sample, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command}${getX(sample).toFixed(2)} ${getY(sample).toFixed(2)}`;
    }).join(' ');
}

function buildTimelineMarkers(timelineA, timelineB, toX, toYUnit, toYRate) {
    const events = [];
    const firstAlertA = timelineA.find(sample => sample.alertCoverage >= 0.2);
    const firstAlertB = timelineB.find(sample => sample.alertCoverage >= 0.2);
    const confusionPeakB = timelineB.reduce((best, sample) => sample.meanConfusion > (best?.meanConfusion ?? -1) ? sample : best, null);
    let captureSurgeB = null;
    for (let i = 1; i < timelineB.length; i++) {
        const delta = timelineB[i].captureRate - timelineB[i - 1].captureRate;
        if (!captureSurgeB || delta > captureSurgeB.delta) {
            captureSurgeB = { sample: timelineB[i], delta };
        }
    }

    if (firstAlertA) {
        events.push(markerSvg(toX(firstAlertA.frame), toYUnit(firstAlertA.alertCoverage), '#4fc3f7', 'A'));
    }
    if (firstAlertB) {
        events.push(markerSvg(toX(firstAlertB.frame), toYUnit(firstAlertB.alertCoverage), '#66bb6a', 'B'));
    }
    if (captureSurgeB && captureSurgeB.delta > 0.05) {
        events.push(markerSvg(toX(captureSurgeB.sample.frame), toYRate(captureSurgeB.sample.captureRate), '#ffca28', 'C'));
    }
    if (confusionPeakB && confusionPeakB.meanConfusion > 0.3) {
        events.push(markerSvg(toX(confusionPeakB.frame), toYUnit(Math.min(confusionPeakB.meanConfusion / 2.5, 1)), '#ef5350', 'M'));
    }

    return events.join('');
}

function markerSvg(x, y, color, label) {
    return `
        <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.2" fill="${color}" opacity="0.92"></circle>
        <text x="${x.toFixed(2)}" y="${(y - 7).toFixed(2)}" text-anchor="middle" fill="${color}" font-size="8" font-weight="700">${label}</text>
    `;
}

function summarizeTimelineEvents(timelineA, timelineB) {
    const events = [];
    const firstAlertA = timelineA.find(sample => sample.alertCoverage >= 0.2);
    const firstAlertB = timelineB.find(sample => sample.alertCoverage >= 0.2);
    const confusionPeakB = timelineB.reduce((best, sample) => sample.meanConfusion > (best?.meanConfusion ?? -1) ? sample : best, null);
    if (firstAlertA) events.push(`A 首次预警约在 ${firstAlertA.frame} 帧`);
    if (firstAlertB) events.push(`B 首次预警约在 ${firstAlertB.frame} 帧`);
    if (confusionPeakB && confusionPeakB.meanConfusion > 0.3) events.push(`B 混淆峰值 ${confusionPeakB.meanConfusion.toFixed(2)}`);
    return events.length ? ` 关键事件：${events.join('，')}。` : '';
}

function renderBatchCompareChart() {
    const svg = document.getElementById('batch-compare-chart');
    const summary = document.getElementById('batch-compare-summary');
    const batch = summarizeLatestBatchRuns();
    if (!batch) {
        svg.innerHTML = '';
        summary.textContent = '批量运行 A/B 后，这里会显示均值与波动范围。';
        return;
    }

    const metrics = [
        { key: 'expCaptureRate', label: '捕获率', format: value => value.toFixed(3) },
        { key: 'avgReaction', label: '反应', format: value => `${value.toFixed(0)} 帧` },
        { key: 'successRate', label: '成功率', format: value => `${(value * 100).toFixed(1)}%` },
    ];
    const width = 320;
    const rowHeight = 42;
    const leftPad = 62;
    const rightPad = 18;
    const topPad = 18;
    const values = metrics.flatMap(metric => [
        ...batch.runs.map(record => record.resultA.stats[metric.key]),
        ...batch.runs.map(record => record.resultB.stats[metric.key]),
    ]);
    const maxValue = Math.max(...values, 0.001);
    const toX = value => leftPad + (value / maxValue) * (width - leftPad - rightPad);

    const fragments = [];
    metrics.forEach((metric, index) => {
        const y = topPad + index * rowHeight;
        const aStats = summarizeSeries(batch.runs.map(record => record.resultA.stats[metric.key]));
        const bStats = summarizeSeries(batch.runs.map(record => record.resultB.stats[metric.key]));
        fragments.push(batchRangeSvg(y, metric.label, aStats, bStats, toX));
    });

    svg.innerHTML = fragments.join('');
    summary.textContent =
        `${batch.mechanism}：最近批量共 ${batch.runs.length} 组 pair。圆点是均值，横线表示最近批次范围。`;
}

function summarizeSeries(series) {
    const clean = series.filter(value => Number.isFinite(value));
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
    return { min, max, mean };
}

function batchRangeSvg(y, label, aStats, bStats, toX) {
    const ay = y + 10;
    const by = y + 24;
    return `
        <text x="8" y="${(y + 18).toFixed(2)}" fill="#7878a0" font-size="10">${label}</text>
        <text x="44" y="${(ay + 3).toFixed(2)}" fill="#4fc3f7" font-size="9">A</text>
        <line x1="${toX(aStats.min).toFixed(2)}" y1="${ay}" x2="${toX(aStats.max).toFixed(2)}" y2="${ay}" stroke="#4fc3f7" stroke-width="2"></line>
        <circle cx="${toX(aStats.mean).toFixed(2)}" cy="${ay}" r="4" fill="#4fc3f7"></circle>
        <text x="44" y="${(by + 3).toFixed(2)}" fill="#66bb6a" font-size="9">B</text>
        <line x1="${toX(bStats.min).toFixed(2)}" y1="${by}" x2="${toX(bStats.max).toFixed(2)}" y2="${by}" stroke="#66bb6a" stroke-width="2"></line>
        <circle cx="${toX(bStats.mean).toFixed(2)}" cy="${by}" r="4" fill="#66bb6a"></circle>
    `;
}

function summarizeLatestBatchRuns() {
    if (!experimentRecords.length) return null;
    const latest = experimentRecords[0];
    const runs = experimentRecords.filter(record => record.pairLabel === latest.pairLabel).slice(0, 8);
    if (runs.length < 2) return null;
    return {
        pairLabel: latest.pairLabel,
        mechanism: latest.mechanism,
        runs,
    };
}

function updateABSummary() {
    const el = document.getElementById('ab-summary');
    const pair = experimentRecords[0];
    if (!pair) {
        el.textContent = '等待 A/B 实验对。';
        return;
    }

    const verdict = buildMechanismVerdict(pair);
    el.textContent = `${pair.mechanism}：A=${pair.resultA.label}，B=${pair.resultB.label}。${verdict}`;
}

function buildMechanismVerdict(pair) {
    if (pair.family === 'manyeyes') {
        return `B 的平均反应时间比 A ${pair.delta.avgReaction < 0 ? '快' : '慢'} ${Math.abs(pair.delta.avgReaction).toFixed(0)} 帧，警戒覆盖率高 ${(pair.delta.alertCoverage * 100).toFixed(1)}%，符合群体预警更快的预期。`;
    }
    if (pair.family === 'dilution') {
        const aliveDelta = pair.delta.aliveCount;
        const rateDelta = -pair.delta.expCaptureRate;
        return `B 比 A 多保留 ${aliveDelta.toFixed(0)} 只活跃个体，实验捕获率低 ${rateDelta.toFixed(3)}，更接近稀释效应预期。`;
    }
    if (pair.family === 'confusion') {
        const successDelta = -pair.delta.successRate * 100;
        const confusionDelta = pair.delta.meanConfusion;
        return `B 的攻击成功率低 ${successDelta.toFixed(1)}%，平均混淆强度高 ${confusionDelta.toFixed(2)}，说明目标锁定更不稳定。`;
    }
    if (pair.family === 'selfish') {
        const compactDelta = -pair.delta.compactness;
        const edgeDelta = pair.delta.edgeRatio * 100;
        return `B 的群体紧密度更高（距离低 ${compactDelta.toFixed(1)} px），边缘被捕比例高 ${edgeDelta.toFixed(1)}%，更符合中心更安全的预期。`;
    }
    return '已形成最近的 A/B 对比结果。';
}

function exportRecords(format) {
    if (!experimentRecords.length) return;

    const filename = `boids-experiments-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
    let content = '';
    let mime = 'application/json';

    if (format === 'json') {
        content = JSON.stringify(experimentRecords, null, 2);
    } else {
        mime = 'text/csv;charset=utf-8';
        content = pairRunsToCsv({ runs: experimentRecords });
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function readSeedInput() {
    const input = document.getElementById('seedInput');
    const raw = parseInt(input.value, 10);
    return Number.isFinite(raw) && raw > 0 ? raw >>> 0 : 1;
}

function syncSeedDisplay() {
    if (!sim) return;
    document.getElementById('current-seed').textContent = sim.getSeed();
}

function ensureSimulationRunning() {
    if (timeScale === 0) {
        setTimeScale(1);
        document.getElementById('btn-pause').textContent = '暂停';
        document.getElementById('btn-pause').classList.remove('paused');
    }
}

function setTimeScale(value) {
    timeScale = value;
    slowCounter = 0;
    document.getElementById('timeScale').value = value;
    document.getElementById('val-timeScale').textContent = value < 0 ? '1/' + Math.abs(value) : String(value);
}

function updateTimeIndicator() {
    const indicator = document.getElementById('time-indicator');
    if (activeRun?.kind === 'pair' && activeRun.mode === 'batch') {
        indicator.textContent = `⏩ A/B 批量 ${activeRun.completedRuns}/${activeRun.totalRuns}`;
        return;
    }
    if (activeRun?.kind === 'pair' && activeRun.mode === 'single') {
        indicator.textContent = '⏩ A/B 计算中';
        return;
    }
    if (compareMode) {
        indicator.textContent = '⇄ 同屏对照';
        return;
    }

    if (timeScale === 0) {
        indicator.textContent = '⏸ 暂停';
    } else if (timeScale < 0) {
        indicator.textContent = `⏪ 1/${Math.abs(timeScale)}x 慢放`;
    } else if (timeScale > 1) {
        indicator.textContent = `⏩ ${timeScale}x 快进`;
    } else {
        indicator.textContent = '';
    }
}

function lockRunControls(locked) {
    const lockIds = [
        ...Object.keys(PARAM_MAP),
        'preferEdge',
        'compareMode',
        'useFixedSeed',
        'seedInput',
        'btn-randomize-seed',
        'btn-run',
        'btn-batch',
        'btn-compare-run',
        'btn-reset',
        'batchCount',
        'compareLeftPreset',
        'compareRightPreset',
    ];

    for (const id of lockIds) {
        const el = document.getElementById(id);
        if (el) el.disabled = locked;
    }

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.disabled = locked;
    });

    document.querySelectorAll('#experiment-body, #presets-body, #boid-params-body, #pred-params-body').forEach(el => {
        el.classList.toggle('is-locked', locked);
    });
}

function resetExperimentStatus() {
    document.getElementById('exp-progress-bar').style.width = '0%';
    document.getElementById('exp-status').textContent = compareMode
        ? '当前为双画布同屏对照模式。A/B 模板用于可视观察；正式实验仍使用“运行 A/B”。'
        : '先选择 A/B 条件模板，再手动运行 A/B 实验。';
    document.getElementById('exp-status').className = 'exp-status';
    document.getElementById('stat-exp-rate').textContent = '--';
}

function getActivePreset() {
    if (activePresetMeta) return activePresetMeta;
    if (activePresetKey && PRESETS[activePresetKey]) return PRESETS[activePresetKey];
    return null;
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

function bindParamHelp() {
    const tooltip = document.createElement('div');
    tooltip.className = 'param-help-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltip);
    paramHelpTooltip = tooltip;

    for (const [id, copy] of Object.entries(PARAM_HELP)) {
        const valueEl = document.getElementById('val-' + id);
        const label = valueEl ? valueEl.closest('label') : null;
        if (!label) continue;

        const labelText = Array.from(label.childNodes)
            .filter(node => node !== valueEl)
            .map(node => node.textContent || '')
            .join('')
            .trim();

        const left = document.createElement('span');
        left.className = 'param-label-info';

        const title = document.createElement('span');
        title.className = 'param-label-text';
        title.textContent = labelText;

        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'help-trigger';
        helpBtn.dataset.helpKey = id;
        helpBtn.setAttribute('aria-label', `${copy.title} 参数解释`);
        helpBtn.setAttribute('aria-expanded', 'false');
        helpBtn.textContent = '?';

        left.appendChild(title);
        left.appendChild(helpBtn);
        label.prepend(left);
        label.appendChild(valueEl);

        helpBtn.addEventListener('mouseenter', () => showParamHelp(helpBtn));
        helpBtn.addEventListener('focus', () => showParamHelp(helpBtn));
        helpBtn.addEventListener('mouseleave', () => {
            if (pinnedHelpButton !== helpBtn) hideParamHelp(helpBtn);
        });
        helpBtn.addEventListener('blur', () => {
            if (pinnedHelpButton !== helpBtn) hideParamHelp(helpBtn);
        });
        helpBtn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (pinnedHelpButton === helpBtn) {
                clearPinnedParamHelp();
                return;
            }
            pinnedHelpButton = helpBtn;
            showParamHelp(helpBtn, true);
        });
    }

    document.addEventListener('click', event => {
        if (!pinnedHelpButton) return;
        if (event.target.closest('.help-trigger')) return;
        clearPinnedParamHelp();
    });

    document.querySelector('#panel .panel-scroll')?.addEventListener('scroll', () => {
        if (activeHelpButton) positionParamHelp(activeHelpButton);
    }, { passive: true });
    window.addEventListener('resize', () => {
        if (activeHelpButton) positionParamHelp(activeHelpButton);
    });
}

function showParamHelp(button, pinned = false) {
    const key = button.dataset.helpKey;
    const copy = PARAM_HELP[key];
    if (!copy || !paramHelpTooltip) return;

    if (activeHelpButton && activeHelpButton !== button) {
        activeHelpButton.classList.remove('active');
        activeHelpButton.setAttribute('aria-expanded', 'false');
    }

    activeHelpButton = button;
    if (pinned) pinnedHelpButton = button;

    button.classList.add('active');
    button.setAttribute('aria-expanded', 'true');
    paramHelpTooltip.innerHTML = `
        <div class="param-help-title">${copy.title}</div>
        <p>${copy.definition}</p>
        <p>${copy.impact}</p>
    `;
    paramHelpTooltip.classList.add('is-visible');
    paramHelpTooltip.setAttribute('aria-hidden', 'false');
    positionParamHelp(button);
}

function hideParamHelp(button) {
    if (pinnedHelpButton === button) return;
    if (activeHelpButton !== button || !paramHelpTooltip) return;

    activeHelpButton.classList.remove('active');
    activeHelpButton.setAttribute('aria-expanded', 'false');
    activeHelpButton = null;
    paramHelpTooltip.classList.remove('is-visible');
    paramHelpTooltip.setAttribute('aria-hidden', 'true');
}

function clearPinnedParamHelp() {
    if (!paramHelpTooltip) return;
    if (pinnedHelpButton) {
        pinnedHelpButton.classList.remove('active');
        pinnedHelpButton.setAttribute('aria-expanded', 'false');
    }
    pinnedHelpButton = null;
    activeHelpButton = null;
    paramHelpTooltip.classList.remove('is-visible');
    paramHelpTooltip.setAttribute('aria-hidden', 'true');
}

function positionParamHelp(button) {
    if (!paramHelpTooltip) return;
    const rect = button.getBoundingClientRect();
    const tooltipRect = paramHelpTooltip.getBoundingClientRect();
    const margin = 12;

    let left = rect.left;
    let top = rect.bottom + 10;

    if (left + tooltipRect.width > window.innerWidth - margin) {
        left = window.innerWidth - tooltipRect.width - margin;
    }
    if (left < margin) left = margin;

    if (top + tooltipRect.height > window.innerHeight - margin) {
        top = rect.top - tooltipRect.height - 10;
    }
    if (top < margin) top = margin;

    paramHelpTooltip.style.left = `${left}px`;
    paramHelpTooltip.style.top = `${top}px`;
}

function formatSigned(value, digits) {
    const formatted = value.toFixed(digits);
    return value > 0 ? `+${formatted}` : formatted;
}

main();
