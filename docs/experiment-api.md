# 无图形实验 API

文件位置：

- `web/experiment-api.js`
- `web/experiment-runner.js`
- `scripts/run-experiment.mjs`

## 目标

这套 API 用于在**不打开图形界面**的情况下，直接运行：

- 单次 A/B 对照实验
- 多次重复的 A/B 批量实验
- 单参数或多参数扫描实验

默认输出是：

- 结构化结果对象
- 可直接写文件的 CSV 字符串

## 可用函数

### `runPairExperiment(options)`

运行一组 A/B 对照，A 和 B 自动共用同一个 `seed`。

```js
import { runPairExperiment } from '../web/experiment-api.js';

const result = await runPairExperiment({
  conditionA: 'manyeyes-a',
  conditionB: 'manyeyes-b',
  seed: 42011,
  durationFrames: 1800,
  includeTimeline: true,
});
```

### `runBatchPairExperiments(options)`

高速无渲染批量运行多组 A/B。

```js
import { runBatchPairExperiments } from '../web/experiment-api.js';

const batch = await runBatchPairExperiments({
  conditionA: 'confusion-a',
  conditionB: 'confusion-b',
  repeatCount: 20,
  baseSeed: 51991,
  durationFrames: 1800,
});

console.log(batch.csv);
```

### `runParameterSweep(options)`

对基准 A/B 条件做单参数或多参数扫描。

```js
import { runParameterSweep } from '../web/experiment-api.js';

const sweep = await runParameterSweep({
  basePresetA: 'manyeyes-a',
  basePresetB: 'manyeyes-b',
  sweep: {
    params: {
      visualRange: [50, 70, 90],
      alertSpread: [0.75, 0.85, 0.95],
    },
    applyTo: 'both',
  },
  repeats: 8,
  baseSeed: 42011,
  durationFrames: 1800,
});
```

### `toCsv(result)`

把 `runBatchPairExperiments()` 或 `runParameterSweep()` 的结果转成 CSV。

## 直接脚本入口

如果不想自己写 JS，可以直接用：

```bash
node scripts/run-experiment.mjs pair \
  --a manyeyes-a \
  --b manyeyes-b \
  --seed 42011 \
  --out out/manyeyes-pair.json
```

批量：

```bash
node scripts/run-experiment.mjs batch \
  --a confusion-a \
  --b confusion-b \
  --repeats 20 \
  --base-seed 51991 \
  --csv out/confusion-batch.csv \
  --out out/confusion-batch.json
```

扫参：

```bash
node scripts/run-experiment.mjs sweep \
  --config docs/examples/manyeyes-sweep.json \
  --csv out/manyeyes-sweep.csv \
  --out out/manyeyes-sweep.json
```

## 输入说明

### 条件输入

`conditionA` / `conditionB` / `basePresetA` / `basePresetB` 可以是：

- 预设 key，例如 `'manyeyes-a'`
- 直接传完整参数对象

参数对象可包含当前仿真支持的字段，例如：

- `numBoids`
- `visualRange`
- `viewAngle`
- `protectedRange`
- `avoidanceFactor`
- `matchingFactor`
- `centeringFactor`
- `fleeRange`
- `fleeFactor`
- `alertSpread`
- `predatorSpeed`
- `predatorTurnRate`
- `captureRadius`
- `confusionThreshold`
- `lockFrames`
- `preferEdge`

### sweep 结构

单参数：

```js
{
  param: 'visualRange',
  values: [40, 60, 80, 100],
  applyTo: 'both'
}
```

多参数：

```js
{
  params: {
    visualRange: [40, 60, 80],
    alertSpread: [0.75, 0.9],
  },
  applyTo: 'both'
}
```

`applyTo` 可选：

- `'both'`
- `'a'`
- `'b'`

## 输出结构

### Pair result

`runPairExperiment()` 返回：

```js
{
  experimentId,
  pairLabel,
  family,
  mechanism,
  seed,
  repeatIndex,
  durationFrames,
  sweepKey,
  paramOverrides,
  conditionA,
  conditionB,
  resultA,
  resultB,
  delta,
  timestamp
}
```

其中：

- `resultA.stats` / `resultB.stats` 是单条件汇总指标
- `delta` 是 **B - A**

### Batch / Sweep result

批量与扫描结果都包含：

- `runs`
- `aggregates`
- `csv`

`aggregates` 中会给出主要指标的：

- `mean`
- `min`
- `max`
- `stdDev`

## 默认 CSV 字段

每一行对应一组 A/B 实验单元，主要包含：

- `experiment_id`
- `mechanism`
- `pair_label`
- `seed`
- `repeat_index`
- `sweep_key`
- `param_overrides`
- `a_label`
- `b_label`
- `a_condition_source`
- `b_condition_source`
- `a_exp_capture_rate`
- `b_exp_capture_rate`
- `delta_exp_capture_rate`
- `a_success_rate`
- `b_success_rate`
- `delta_success_rate`
- `a_avg_reaction`
- `b_avg_reaction`
- `delta_avg_reaction`
- `a_alert_coverage`
- `b_alert_coverage`
- `delta_alert_coverage`
- `a_compactness`
- `b_compactness`
- `delta_compactness`
- `a_edge_ratio`
- `b_edge_ratio`
- `delta_edge_ratio`
- `a_mean_confusion`
- `b_mean_confusion`
- `delta_mean_confusion`

## 当前边界

- 第一阶段默认输出**汇总结果**，不输出每帧全量状态
- `includeTimeline: true` 只会带简化时间线采样，不会导出 boid/predator 全量坐标
- 这套 API 目前首先服务浏览器模块调用；如需纯 Node 命令行批处理，可在下一阶段补专门入口
