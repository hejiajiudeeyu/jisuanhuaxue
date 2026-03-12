export const HEADER = 2;
export const STATS_COUNT = 14;
export const EXPERIMENT_FRAMES = 1800;
export const DEFAULT_SIM_WIDTH = 960;
export const DEFAULT_SIM_HEIGHT = 640;

export const PRESETS = {
    'manyeyes-a': {
        label: '多眼A: 个体',
        family: 'manyeyes',
        variant: 'A',
        mechanism: '多眼效应',
        hypothesis: '个体模式的视野更窄、警报传播更弱，预期首次预警更慢，整体警戒覆盖率更低。',
        keyMetrics: ['首次预警延迟', '警戒覆盖率', '平均反应时间'],
        defaultSeed: 42011,
        numBoids: 200, numPredators: 1,
        visualRange: 30, viewAngle: 150, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.01, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.72,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.16,
        captureRadius: 10, confusionThreshold: 999, lockFrames: 18,
        preferEdge: false,
        conditionSource: 'preset',
    },
    'manyeyes-b': {
        label: '多眼B: 群体',
        family: 'manyeyes',
        variant: 'B',
        mechanism: '多眼效应',
        hypothesis: '群体模式应更快形成全群警戒，反应时间更短，预警覆盖率更高。',
        keyMetrics: ['首次预警延迟', '警戒覆盖率', '平均反应时间'],
        defaultSeed: 42011,
        numBoids: 200, numPredators: 1,
        visualRange: 100, viewAngle: 290, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.08, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.96,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.16,
        captureRadius: 10, confusionThreshold: 999, lockFrames: 18,
        preferEdge: false,
        conditionSource: 'preset',
    },
    'dilution-a': {
        label: '稀释A: 小群',
        family: 'dilution',
        variant: 'A',
        mechanism: '稀释效应',
        hypothesis: '小群个体暴露更明显，实验捕获率和单位个体风险通常更高。',
        keyMetrics: ['实验捕获率', '存活鸟数', '边缘被捕比例'],
        defaultSeed: 31807,
        numBoids: 30, numPredators: 1,
        visualRange: 75, viewAngle: 240, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.88,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.16,
        captureRadius: 10, confusionThreshold: 999, lockFrames: 16,
        preferEdge: false,
        conditionSource: 'preset',
    },
    'dilution-b': {
        label: '稀释B: 大群',
        family: 'dilution',
        variant: 'B',
        mechanism: '稀释效应',
        hypothesis: '大群会稀释个体风险，虽然总接触更多，但单体暴露通常更低。',
        keyMetrics: ['实验捕获率', '存活鸟数', '边缘被捕比例'],
        defaultSeed: 31807,
        numBoids: 300, numPredators: 1,
        visualRange: 75, viewAngle: 240, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.88,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.16,
        captureRadius: 10, confusionThreshold: 999, lockFrames: 16,
        preferEdge: false,
        conditionSource: 'preset',
    },
    'confusion-a': {
        label: '混淆A: 无混淆',
        family: 'confusion',
        variant: 'A',
        mechanism: '混淆效应',
        hypothesis: '无混淆时，捕食者更稳定锁定单一目标，成功率更高、切换更少。',
        keyMetrics: ['攻击成功率', '平均锁定时长', '平均混淆强度'],
        defaultSeed: 51991,
        numBoids: 200, numPredators: 1,
        visualRange: 75, viewAngle: 220, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.88,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.18,
        captureRadius: 10, confusionThreshold: 999, lockFrames: 14,
        preferEdge: false,
        conditionSource: 'preset',
    },
    'confusion-b': {
        label: '混淆B: 有混淆',
        family: 'confusion',
        variant: 'B',
        mechanism: '混淆效应',
        hypothesis: '有混淆时，目标更易丢失，预期平均混淆强度更高、攻击成功率更低。',
        keyMetrics: ['攻击成功率', '平均锁定时长', '平均混淆强度'],
        defaultSeed: 51991,
        numBoids: 200, numPredators: 1,
        visualRange: 75, viewAngle: 220, protectedRange: 15,
        avoidanceFactor: 0.05, matchingFactor: 0.05, centeringFactor: 0.005,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.88,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.18,
        captureRadius: 10, confusionThreshold: 3, lockFrames: 20,
        preferEdge: false,
        conditionSource: 'preset',
    },
    'selfish-a': {
        label: '自私A: 松散',
        family: 'selfish',
        variant: 'A',
        mechanism: '自私兽群',
        hypothesis: '松散群体边缘暴露更分散，群体紧密度较低，中心保护弱。',
        keyMetrics: ['群体紧密度', '边缘被捕比例', '存活鸟数'],
        defaultSeed: 64217,
        numBoids: 200, numPredators: 1,
        visualRange: 75, viewAngle: 240, protectedRange: 15,
        avoidanceFactor: 0.15, matchingFactor: 0.05, centeringFactor: 0.001,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.86,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.16,
        captureRadius: 10, confusionThreshold: 999, lockFrames: 15,
        preferEdge: true,
        conditionSource: 'preset',
    },
    'selfish-b': {
        label: '自私B: 紧密',
        family: 'selfish',
        variant: 'B',
        mechanism: '自私兽群',
        hypothesis: '紧密群体应更快挤向局部安全区，整体紧密度更高，边缘风险更集中。',
        keyMetrics: ['群体紧密度', '边缘被捕比例', '存活鸟数'],
        defaultSeed: 64217,
        numBoids: 200, numPredators: 1,
        visualRange: 75, viewAngle: 260, protectedRange: 15,
        avoidanceFactor: 0.03, matchingFactor: 0.05, centeringFactor: 0.01,
        maxSpeed: 6, minSpeed: 3,
        fleeRange: 150, fleeFactor: 0.5, alertSpread: 0.92,
        predatorSpeed: 5.0, chaseFactor: 0.03, predatorTurnRate: 0.16,
        captureRadius: 10, confusionThreshold: 999, lockFrames: 15,
        preferEdge: true,
        conditionSource: 'preset',
    },
    'standard-realistic': {
        label: '标准：椋鸟群飞 vs 游隼',
        family: 'standard',
        variant: 'Std',
        mechanism: '现实参考',
        hypothesis: '基于欧洲椋鸟群飞与游隼追击文献做缩放映射，表现为较一致的群体速度、中高警戒传播，以及具明显速度优势的捕食者。',
        keyMetrics: ['平均反应时间', '警戒覆盖率', '攻击成功率'],
        defaultSeed: 20260312,
        references: '参考文献：Ballerini et al. (2008), Cavagna et al. (2022), Tucker et al. (2018)。详见 docs/standard-preset.md',
        numBoids: 180, numPredators: 1,
        visualRange: 82, viewAngle: 270, protectedRange: 14,
        avoidanceFactor: 0.055, matchingFactor: 0.065, centeringFactor: 0.006,
        maxSpeed: 5.5, minSpeed: 4.0,
        fleeRange: 160, fleeFactor: 0.65, alertSpread: 0.90,
        predatorSpeed: 7.0, chaseFactor: 0.04, predatorTurnRate: 0.14,
        captureRadius: 9, confusionThreshold: 7, lockFrames: 14,
        preferEdge: true,
        conditionSource: 'preset',
    },
};

export const PARAM_MAP = {
    numBoids:           { setter: 'setNumBoids',           type: 'int'   },
    numPredators:       { setter: 'setNumPredators',       type: 'int'   },
    visualRange:        { setter: 'setVisualRange',        type: 'float' },
    viewAngle:          { setter: 'setViewAngle',          type: 'float' },
    protectedRange:     { setter: 'setProtectedRange',     type: 'float' },
    avoidanceFactor:    { setter: 'setAvoidanceFactor',    type: 'float' },
    matchingFactor:     { setter: 'setMatchingFactor',     type: 'float' },
    centeringFactor:    { setter: 'setCenteringFactor',    type: 'float' },
    maxSpeed:           { setter: 'setMaxSpeed',           type: 'float' },
    minSpeed:           { setter: 'setMinSpeed',           type: 'float' },
    fleeRange:          { setter: 'setFleeRange',          type: 'float' },
    fleeFactor:         { setter: 'setFleeFactor',         type: 'float' },
    alertSpread:        { setter: 'setAlertSpread',        type: 'float' },
    predatorSpeed:      { setter: 'setPredatorSpeed',      type: 'float' },
    chaseFactor:        { setter: 'setChaseFactor',        type: 'float' },
    predatorTurnRate:   { setter: 'setPredatorTurnRate',   type: 'float' },
    captureRadius:      { setter: 'setCaptureRadius',      type: 'float' },
    confusionThreshold: { setter: 'setConfusionThreshold', type: 'int'   },
    lockFrames:         { setter: 'setLockFrames',         type: 'int'   },
};

export function applyConditionToSimulation(targetSim, condition) {
    for (const [id, { setter, type }] of Object.entries(PARAM_MAP)) {
        if (condition[id] === undefined) continue;
        const value = type === 'int' ? parseInt(condition[id], 10) : parseFloat(condition[id]);
        if (targetSim[setter]) targetSim[setter](value);
    }
    if (condition.preferEdge !== undefined && targetSim.setPreferEdgeTarget) {
        targetSim.setPreferEdgeTarget(condition.preferEdge);
    }
}

export function readStatsFromData(data) {
    const so = HEADER;
    return {
        captures: data[so],
        captureRate: data[so + 1],
        avgReaction: data[so + 2],
        firstAlertDelay: data[so + 3],
        alertCoverage: data[so + 4],
        compactness: data[so + 5],
        edgeRatio: data[so + 6],
        switches: data[so + 7],
        successRate: data[so + 8],
        avgLockDuration: data[so + 9],
        meanConfusion: data[so + 10],
        aliveCount: data[so + 11],
        expCaptureRate: data[so + 12],
        expProgress: data[so + 13],
    };
}

export function cloneCondition(condition) {
    return typeof structuredClone === 'function'
        ? structuredClone(condition)
        : JSON.parse(JSON.stringify(condition));
}

export function resolvePreset(input) {
    if (!input) return null;
    if (typeof input === 'string') {
        return PRESETS[input] ? cloneCondition(PRESETS[input]) : null;
    }
    return cloneCondition(input);
}

export function randomSeed() {
    return Math.max(1, Math.floor(Math.random() * 0xffff_ffff));
}
