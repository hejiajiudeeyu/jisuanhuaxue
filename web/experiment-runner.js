import init, { Simulation } from '../boids-wasm/pkg/boids_wasm.js';
import {
    DEFAULT_SIM_HEIGHT,
    DEFAULT_SIM_WIDTH,
    EXPERIMENT_FRAMES,
    PARAM_MAP,
    PRESETS,
    applyConditionToSimulation,
    cloneCondition,
    randomSeed,
    readStatsFromData,
    resolvePreset,
} from './sim-shared.js';

const METRIC_KEYS = [
    'expCaptureRate',
    'successRate',
    'avgReaction',
    'alertCoverage',
    'compactness',
    'edgeRatio',
    'meanConfusion',
    'aliveCount',
    'avgLockDuration',
    'firstAlertDelay',
    'switches',
    'captures',
];

let initPromise = null;

export async function ensureExperimentRuntime() {
    if (!initPromise) {
        initPromise = initializeWasmRuntime();
    }
    await initPromise;
}

export async function runSingleCondition(options = {}) {
    await ensureExperimentRuntime();

    const width = options.width ?? DEFAULT_SIM_WIDTH;
    const height = options.height ?? DEFAULT_SIM_HEIGHT;
    const durationFrames = options.durationFrames ?? EXPERIMENT_FRAMES;
    const seed = options.seed ?? randomSeed();
    const includeTimeline = options.includeTimeline !== false;
    const yieldEvery = options.yieldEvery ?? 240;
    const condition = resolvePreset(options.condition) ?? resolvePreset(options.presetKey);

    if (!condition) {
        throw new Error('runSingleCondition requires a condition or presetKey.');
    }

    const sim = new Simulation(width, height, condition.numBoids ?? 200, condition.numPredators ?? 1);
    sim.setSeed(seed);
    applyConditionToSimulation(sim, condition);
    sim.setExperimentDuration(durationFrames);
    sim.resetSimulation();

    const timeline = [];
    const timelineStep = options.timelineStep ?? 30;
    let lastTimelineFrame = -timelineStep;
    let finalData = null;

    let steps = 0;
    while (!sim.isExperimentDone()) {
        finalData = sim.tick();
        steps += 1;
        if (includeTimeline) {
            const stats = readStatsFromData(finalData);
            const frame = Math.round(stats.expProgress * durationFrames);
            if (frame - lastTimelineFrame >= timelineStep || stats.expProgress >= 1) {
                timeline.push({
                    frame,
                    captureRate: stats.expCaptureRate,
                    alertCoverage: stats.alertCoverage,
                    meanConfusion: stats.meanConfusion,
                });
                lastTimelineFrame = frame;
            }
        }
        if (yieldEvery > 0 && steps % yieldEvery === 0) {
            await yieldToEventLoop();
        }
    }

    if (!finalData) {
        finalData = sim.tick();
    }

    return {
        label: condition.label ?? options.label ?? '自定义条件',
        family: condition.family ?? 'custom',
        variant: condition.variant ?? 'custom',
        mechanism: condition.mechanism ?? '自定义参数',
        seed,
        conditionSource: condition.conditionSource ?? options.conditionSource ?? 'custom',
        params: captureConditionParams(condition),
        stats: readStatsFromData(finalData),
        timeline,
    };
}

export async function runPairExperiment(options = {}) {
    const conditionA = resolvePreset(options.conditionA ?? options.presetA);
    const conditionB = resolvePreset(options.conditionB ?? options.presetB);
    if (!conditionA || !conditionB) {
        throw new Error('runPairExperiment requires conditionA and conditionB.');
    }

    const seed = options.seed ?? randomSeed();
    const durationFrames = options.durationFrames ?? EXPERIMENT_FRAMES;
    const baseMeta = derivePairMeta(conditionA, conditionB, options);
    const includeTimeline = options.includeTimeline !== false;

    const resultA = await runSingleCondition({
        condition: conditionA,
        seed,
        durationFrames,
        includeTimeline,
        width: options.width,
        height: options.height,
    });
    const resultB = await runSingleCondition({
        condition: conditionB,
        seed,
        durationFrames,
        includeTimeline,
        width: options.width,
        height: options.height,
    });

    return {
        experimentId: options.experimentId ?? createExperimentId(baseMeta.family),
        pairLabel: baseMeta.pairLabel,
        family: baseMeta.family,
        mechanism: baseMeta.mechanism,
        seed,
        repeatIndex: options.repeatIndex ?? 1,
        durationFrames,
        sweepKey: options.sweepKey ?? '',
        paramOverrides: cloneCondition(options.paramOverrides ?? {}),
        conditionA: summarizeCondition(conditionA),
        conditionB: summarizeCondition(conditionB),
        resultA,
        resultB,
        delta: buildDelta(resultA.stats, resultB.stats),
        timestamp: new Date().toISOString(),
    };
}

export async function runBatchPairExperiments(options = {}) {
    const repeatCount = options.repeatCount ?? options.repeats ?? 1;
    const seeds = buildSeedList(options.seeds, repeatCount, options.baseSeed);
    const runs = [];

    for (let index = 0; index < repeatCount; index++) {
        if (options.shouldStop?.()) {
            break;
        }
        const seed = seeds[index] ?? randomSeed();
        const pair = await runPairExperiment({
            ...options,
            seed,
            repeatIndex: index + 1,
            includeTimeline: Boolean(options.includeTimeline),
        });
        runs.push(pair);
        if (options.onProgress) {
            options.onProgress({
                completed: index + 1,
                total: repeatCount,
                seed,
                pair,
            });
        }
    }

    const aggregates = summarizePairRuns(runs);
    return {
        experimentId: createExperimentId('batch'),
        pairLabel: runs[0]?.pairLabel ?? options.pairLabel ?? 'A/B 对照',
        family: runs[0]?.family ?? options.family ?? 'custom',
        mechanism: runs[0]?.mechanism ?? options.mechanism ?? '自定义对照',
        runs,
        aggregates,
        csv: toCsv({ runs }),
    };
}

export async function runParameterSweep(options = {}) {
    const mode = options.mode ?? 'pair';
    if (mode !== 'pair') {
        throw new Error('Only pair sweep mode is supported in the first phase.');
    }

    const baseA = resolvePreset(options.basePresetA ?? options.conditionA);
    const baseB = resolvePreset(options.basePresetB ?? options.conditionB);
    if (!baseA || !baseB) {
        throw new Error('runParameterSweep requires basePresetA and basePresetB.');
    }

    const combinations = expandSweep(options.sweep);
    const runs = [];

    for (const combination of combinations) {
        const nextA = cloneCondition(baseA);
        const nextB = cloneCondition(baseB);
        applySweepOverrides(nextA, nextB, combination.values, combination.applyTo);

        const batch = await runBatchPairExperiments({
            conditionA: nextA,
            conditionB: nextB,
            repeatCount: options.repeats ?? 1,
            seeds: options.seeds,
            baseSeed: options.baseSeed,
            durationFrames: options.durationFrames,
            includeTimeline: false,
            pairLabel: options.pairLabel,
            family: nextA.family ?? nextB.family ?? 'custom',
            mechanism: nextA.mechanism ?? nextB.mechanism ?? '参数扫描',
            sweepKey: combination.key,
            paramOverrides: combination.values,
        });

        runs.push(...batch.runs);
    }

    return {
        experimentId: createExperimentId('sweep'),
        mode,
        runs,
        aggregates: summarizeSweepRuns(runs),
        csv: toCsv({ runs }),
    };
}

export function toCsv(result) {
    const runs = Array.isArray(result) ? result : result?.runs ?? [];
    const header = [
        'experiment_id',
        'mechanism',
        'pair_label',
        'seed',
        'repeat_index',
        'sweep_key',
        'param_overrides',
        'a_label',
        'b_label',
        'a_condition_source',
        'b_condition_source',
        'a_exp_capture_rate',
        'b_exp_capture_rate',
        'delta_exp_capture_rate',
        'a_success_rate',
        'b_success_rate',
        'delta_success_rate',
        'a_avg_reaction',
        'b_avg_reaction',
        'delta_avg_reaction',
        'a_alert_coverage',
        'b_alert_coverage',
        'delta_alert_coverage',
        'a_compactness',
        'b_compactness',
        'delta_compactness',
        'a_edge_ratio',
        'b_edge_ratio',
        'delta_edge_ratio',
        'a_mean_confusion',
        'b_mean_confusion',
        'delta_mean_confusion',
    ];

    const rows = runs.map(run => [
        run.experimentId,
        run.mechanism,
        run.pairLabel,
        run.seed,
        run.repeatIndex ?? '',
        run.sweepKey ?? '',
        JSON.stringify(run.paramOverrides ?? {}),
        run.resultA?.label ?? '',
        run.resultB?.label ?? '',
        run.resultA?.conditionSource ?? '',
        run.resultB?.conditionSource ?? '',
        run.resultA?.stats?.expCaptureRate ?? '',
        run.resultB?.stats?.expCaptureRate ?? '',
        run.delta?.expCaptureRate ?? '',
        run.resultA?.stats?.successRate ?? '',
        run.resultB?.stats?.successRate ?? '',
        run.delta?.successRate ?? '',
        run.resultA?.stats?.avgReaction ?? '',
        run.resultB?.stats?.avgReaction ?? '',
        run.delta?.avgReaction ?? '',
        run.resultA?.stats?.alertCoverage ?? '',
        run.resultB?.stats?.alertCoverage ?? '',
        run.delta?.alertCoverage ?? '',
        run.resultA?.stats?.compactness ?? '',
        run.resultB?.stats?.compactness ?? '',
        run.delta?.compactness ?? '',
        run.resultA?.stats?.edgeRatio ?? '',
        run.resultB?.stats?.edgeRatio ?? '',
        run.delta?.edgeRatio ?? '',
        run.resultA?.stats?.meanConfusion ?? '',
        run.resultB?.stats?.meanConfusion ?? '',
        run.delta?.meanConfusion ?? '',
    ]);

    return [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
}

function captureConditionParams(condition) {
    const params = {};
    for (const key of Object.keys(PARAM_MAP)) {
        params[key] = condition[key] ?? null;
    }
    params.preferEdge = condition.preferEdge ?? false;
    return params;
}

function summarizeCondition(condition) {
    return {
        label: condition.label ?? '自定义条件',
        family: condition.family ?? 'custom',
        variant: condition.variant ?? 'custom',
        mechanism: condition.mechanism ?? '自定义参数',
        conditionSource: condition.conditionSource ?? 'custom',
        params: captureConditionParams(condition),
    };
}

function derivePairMeta(conditionA, conditionB, options) {
    return {
        family: options.family ?? conditionA.family ?? conditionB.family ?? 'custom',
        mechanism: options.mechanism ?? conditionA.mechanism ?? conditionB.mechanism ?? '自定义对照',
        pairLabel: options.pairLabel ?? `${conditionA.label ?? 'A'} vs ${conditionB.label ?? 'B'}`,
    };
}

function buildDelta(statsA, statsB) {
    const delta = {};
    for (const key of METRIC_KEYS) {
        const a = statsA[key];
        const b = statsB[key];
        delta[key] = Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
    }
    return delta;
}

function summarizePairRuns(runs) {
    const aggregates = {};
    for (const key of METRIC_KEYS) {
        aggregates[key] = {
            a: summarizeSeries(runs.map(run => run.resultA.stats[key])),
            b: summarizeSeries(runs.map(run => run.resultB.stats[key])),
            delta: summarizeSeries(runs.map(run => run.delta[key])),
        };
    }
    return aggregates;
}

function summarizeSweepRuns(runs) {
    const grouped = new Map();
    for (const run of runs) {
        const key = run.sweepKey || 'default';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(run);
    }

    return Array.from(grouped.entries()).map(([key, group]) => ({
        sweepKey: key,
        runCount: group.length,
        aggregates: summarizePairRuns(group),
    }));
}

function summarizeSeries(series) {
    const clean = series.filter(value => Number.isFinite(value));
    if (!clean.length) {
        return { mean: null, min: null, max: null, stdDev: null };
    }
    const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
    const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length;
    return {
        mean,
        min: Math.min(...clean),
        max: Math.max(...clean),
        stdDev: Math.sqrt(variance),
    };
}

function buildSeedList(seeds, repeatCount, baseSeed) {
    if (Array.isArray(seeds) && seeds.length) {
        return seeds.slice(0, repeatCount);
    }
    const start = baseSeed ?? randomSeed();
    return Array.from({ length: repeatCount }, (_, index) => (start + index) >>> 0);
}

function expandSweep(sweep) {
    if (!sweep) {
        return [{ key: '', values: {}, applyTo: 'both' }];
    }

    if (sweep.param && Array.isArray(sweep.values)) {
        return sweep.values.map(value => ({
            key: `${sweep.param}=${value}`,
            values: { [sweep.param]: value },
            applyTo: sweep.applyTo ?? 'both',
        }));
    }

    const params = sweep.params ?? sweep;
    const applyTo = sweep.applyTo ?? 'both';
    const entries = Object.entries(params).filter(([, values]) => Array.isArray(values));
    if (!entries.length) {
        return [{ key: '', values: {}, applyTo }];
    }

    const combinations = [];
    buildCartesian(entries, 0, {}, combinations, applyTo);
    return combinations;
}

function buildCartesian(entries, index, current, out, applyTo) {
    if (index >= entries.length) {
        const values = cloneCondition(current);
        const key = Object.entries(values).map(([param, value]) => `${param}=${value}`).join('|');
        out.push({ key, values, applyTo });
        return;
    }

    const [param, values] = entries[index];
    for (const value of values) {
        current[param] = value;
        buildCartesian(entries, index + 1, current, out, applyTo);
    }
    delete current[param];
}

function applySweepOverrides(conditionA, conditionB, overrides, applyTo) {
    for (const [key, value] of Object.entries(overrides)) {
        if (applyTo === 'a' || applyTo === 'both') {
            conditionA[key] = value;
        }
        if (applyTo === 'b' || applyTo === 'both') {
            conditionB[key] = value;
        }
    }
}

function escapeCsv(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
}

function createExperimentId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function yieldToEventLoop() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

async function initializeWasmRuntime() {
    const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
    if (!isNode) {
        return init();
    }

    const fs = await import('node:fs/promises');
    const wasmUrl = new URL('../boids-wasm/pkg/boids_wasm_bg.wasm', import.meta.url);
    const wasmBytes = await fs.readFile(wasmUrl);
    return init({ module_or_path: wasmBytes });
}

export { PRESETS };
