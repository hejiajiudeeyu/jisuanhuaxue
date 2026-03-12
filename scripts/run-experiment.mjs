#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
    PRESETS,
    runBatchPairExperiments,
    runPairExperiment,
    runParameterSweep,
} from '../web/experiment-api.js';

async function main() {
    const { positionals, options } = parseArgs(process.argv.slice(2));
    const command = positionals[0];

    if (!command || options.help) {
        printHelp();
        process.exit(options.help ? 0 : 1);
    }

    if (command === 'pair') {
        const config = await loadConfig(options.config);
        const result = await runPairExperiment({
            ...config,
            conditionA: resolveCondition(options.a ?? config.conditionA ?? config.presetA),
            conditionB: resolveCondition(options.b ?? config.conditionB ?? config.presetB),
            seed: readNumber(options.seed ?? config.seed),
            durationFrames: readNumber(options.frames ?? config.durationFrames),
            pairLabel: options.label ?? config.pairLabel,
            includeTimeline: readBoolean(options.timeline, config.includeTimeline, true),
        });
        await writeOutputs(result, options);
        printSummary(result);
        return;
    }

    if (command === 'batch') {
        const config = await loadConfig(options.config);
        const result = await runBatchPairExperiments({
            ...config,
            conditionA: resolveCondition(options.a ?? config.conditionA ?? config.presetA),
            conditionB: resolveCondition(options.b ?? config.conditionB ?? config.presetB),
            repeatCount: readNumber(options.repeats ?? config.repeatCount ?? config.repeats, 1),
            baseSeed: readNumber(options['base-seed'] ?? config.baseSeed),
            durationFrames: readNumber(options.frames ?? config.durationFrames),
            pairLabel: options.label ?? config.pairLabel,
            includeTimeline: readBoolean(options.timeline, config.includeTimeline, false),
        });
        await writeOutputs(result, options);
        printBatchSummary(result);
        return;
    }

    if (command === 'sweep') {
        const config = await loadConfig(options.config);
        const result = await runParameterSweep({
            ...config,
            basePresetA: resolveCondition(options.a ?? config.basePresetA ?? config.conditionA),
            basePresetB: resolveCondition(options.b ?? config.basePresetB ?? config.conditionB),
            repeats: readNumber(options.repeats ?? config.repeats, 1),
            baseSeed: readNumber(options['base-seed'] ?? config.baseSeed),
            durationFrames: readNumber(options.frames ?? config.durationFrames),
        });
        await writeOutputs(result, options);
        printSweepSummary(result);
        return;
    }

    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}

function parseArgs(argv) {
    const positionals = [];
    const options = {};

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            positionals.push(token);
            continue;
        }

        const key = token.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            options[key] = true;
            continue;
        }
        options[key] = next;
        i += 1;
    }

    return { positionals, options };
}

async function loadConfig(configPath) {
    if (!configPath) return {};
    const absolutePath = path.resolve(process.cwd(), configPath);
    const content = await fs.readFile(absolutePath, 'utf8');
    return JSON.parse(content);
}

function resolveCondition(input) {
    if (!input) return null;
    if (typeof input === 'string' && PRESETS[input]) return input;
    return input;
}

function readNumber(value, fallback = undefined) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback, defaultValue) {
    if (value === undefined || value === null) {
        if (fallback === undefined) return defaultValue;
        return Boolean(fallback);
    }
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1' || value === 'yes';
}

async function writeOutputs(result, options) {
    if (options.out) {
        await writeJson(options.out, result);
    }
    if (options.csv) {
        await fs.writeFile(path.resolve(process.cwd(), options.csv), result.csv ?? '', 'utf8');
    }
    if (!options.out && !options.csv) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
}

async function writeJson(filePath, data) {
    const absolutePath = path.resolve(process.cwd(), filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify(data, null, 2), 'utf8');
}

function printSummary(result) {
    console.error(
        [
            `pair=${result.pairLabel}`,
            `seed=${result.seed}`,
            `captureΔ=${result.delta.expCaptureRate?.toFixed(3) ?? '--'}`,
            `successΔ=${result.delta.successRate?.toFixed(3) ?? '--'}`,
            `reactionΔ=${result.delta.avgReaction?.toFixed(1) ?? '--'}`,
        ].join(' | ')
    );
}

function printBatchSummary(result) {
    const captureDelta = result.aggregates?.expCaptureRate?.delta?.mean;
    const successDelta = result.aggregates?.successRate?.delta?.mean;
    console.error(
        [
            `pair=${result.pairLabel}`,
            `runs=${result.runs.length}`,
            `mean captureΔ=${captureDelta?.toFixed(3) ?? '--'}`,
            `mean successΔ=${successDelta?.toFixed(3) ?? '--'}`,
        ].join(' | ')
    );
}

function printSweepSummary(result) {
    console.error(`sweep runs=${result.runs.length} | groups=${result.aggregates.length}`);
}

function printHelp() {
    console.log(`
Usage:
  node scripts/run-experiment.mjs pair --a manyeyes-a --b manyeyes-b --seed 42011 --out out/pair.json
  node scripts/run-experiment.mjs batch --a confusion-a --b confusion-b --repeats 20 --base-seed 51991 --csv out/batch.csv
  node scripts/run-experiment.mjs sweep --config configs/manyeyes-sweep.json --out out/sweep.json --csv out/sweep.csv

Options:
  --config PATH       JSON config file for batch or sweep
  --a PRESET          preset key or config-provided condition A
  --b PRESET          preset key or config-provided condition B
  --seed N            seed for single pair run
  --base-seed N       base seed for batch or sweep
  --repeats N         repeat count for batch or sweep
  --frames N          experiment duration in frames
  --label TEXT        override pair label
  --timeline BOOL     whether to include sampled timeline
  --out PATH          write JSON result to file
  --csv PATH          write CSV result to file
  --help              show this help
`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
