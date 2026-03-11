# 鸟群仿真系统（Boids Flocking Simulation）

一个基于 **Rust + WebAssembly + 原生 JavaScript + Canvas** 的交互式鸟群仿真项目，用于演示和对比群体在捕食压力下的行为机制。

项目支持四组 A/B 预设实验：

- 多眼效应（Many-Eyes）
- 稀释效应（Dilution）
- 混淆效应（Confusion）
- 自私兽群（Selfish Herd）

## 技术栈

- Rust（仿真核心）
- wasm-bindgen / wasm-pack（WASM 构建与 JS 绑定）
- JavaScript（UI 控制与渲染）
- HTML/CSS（页面与控制面板）

## 快速开始

### 1) 环境准备

- Rust 工具链（`rustc` + `cargo`）
- `wasm-pack`
- Python 3（用于本地静态服务器）
- 现代浏览器（Chrome / Firefox / Safari / Edge）

安装 `wasm-pack`（如未安装）：

```bash
cargo install wasm-pack
```

### 2) 编译 WASM

```bash
cd boids-wasm
wasm-pack build --target web --release
```

编译产物会输出到 `boids-wasm/pkg/`。

### 3) 启动本地服务

回到项目根目录后启动静态服务器：

```bash
python3 -m http.server 8080
```

浏览器打开：

`http://localhost:8080/web/`

## 使用说明

- 左侧是仿真画布，右侧是参数控制与统计面板。
- 点击预设按钮会自动套用参数并启动 30 秒定时实验。
- 可实时调节鸟群/捕食者参数，观察指标变化。
- 支持暂停、重置、显示感知范围、尾迹、边缘高亮等可视化选项。

更详细的操作说明见：`docs/usage.md`

## 项目结构

```text
jisuanhuaxue/
├── boids-wasm/        # Rust + WASM 仿真内核
├── web/               # 前端页面与渲染逻辑
├── docs/              # 机制说明、预设参数、使用文档
├── LICENSE            # MIT License
└── README.md
```

## 文档索引

- `docs/usage.md`：运行与界面使用指南
- `docs/mechanisms.md`：四大抗捕食机制解释
- `docs/presets.md`：各预设参数与实验建议

## 许可证

本项目采用 [MIT License](./LICENSE)。
