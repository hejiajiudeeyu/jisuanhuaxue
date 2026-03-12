# 标准预设说明：现实参考参数

这个“标准：椋鸟群飞 vs 游隼”预设不是把现实世界的米、秒直接搬进画布，而是基于实证研究做了一次**缩放映射**。目标是让当前单屏仿真在可运行、可观察的前提下，更接近“欧洲椋鸟群飞 + 游隼追击”的相对关系。

## 建模对象

- 猎物：欧洲椋鸟（European starling, *Sturnus vulgaris*）
- 捕食者：游隼（Peregrine falcon, *Falco peregrinus*）

## 采用文献依据

1. Ballerini, M. et al. (2008). *Interaction ruling animal collective behaviour depends on topological rather than metric distance: evidence from a field study*. PNAS.
   关键依据：每只鸟平均只与固定数量的邻居互动，数量大约为 6-7 个；这支持我们使用中等视野范围和较强对齐/聚合，而不是无限半径感知。
   链接：
   - https://pubmed.ncbi.nlm.nih.gov/18227508/
   - https://arxiv.org/abs/0709.1916

2. Ballerini, M. et al. (2008). *Empirical investigation of starling flocks: a benchmark study in collective animal behaviour*. Animal Behaviour.
   关键依据：实地三维重建显示，自然椋鸟群可达数千只；个体之间保持与翼展同量级的最小距离；群体边缘通常比中心更密。
   链接：
   - https://arxiv.org/abs/0802.1667
   - https://www.sciencedirect.com/science/article/abs/pii/S0003347208001176

3. Cavagna, A. et al. (2022). *Marginal speed confinement resolves the conflict between correlation and control in collective behaviour*. Nature Communications.
   关键依据：实地数据中，椋鸟群的典型平均群速约为 12 m/s，波动大约 2 m/s，且不同群体规模下平均速度变化不大。
   链接：
   - https://www.nature.com/articles/s41467-022-29883-4

4. Mills, R., Taylor, G. K., & Hemelrijk, C. K. (2018). *Physics-based simulations of aerial attacks by peregrine falcons reveal that stooping at high speed maximizes catch success against agile prey*. PLOS Computational Biology.
   关键依据：文中给出的模型参数与经验值对照里，游隼最低持续飞行速度约 7.3 m/s，水平高速约 27.6 m/s；椋鸟最低飞行速度约 4.5 m/s，最高速度约 24 m/s。
   链接：
   - https://pmc.ncbi.nlm.nih.gov/articles/PMC5896925/
   - https://doi.org/10.1371/journal.pcbi.1006044

## 从文献到当前仿真的映射

由于本项目的单位是“画布像素 / 仿真步”，而不是“米 / 秒”，标准预设使用的是**相对比例映射**：

- `numBoids = 180`
  现实中椋鸟群可大得多，但单屏仿真需要在可读性和性能之间折中，因此采用“缩小后的中型群体”。

- `maxSpeed = 5.5`, `minSpeed = 4.0`
  对应“椋鸟群速较稳定、波动不大”的特征，保持群体速度集中，而不是极端慢快混杂。

- `predatorSpeed = 7.0`
  保留游隼相对椋鸟的速度优势，但不直接使用俯冲极值，否则当前画布尺度下会失真得过于剧烈。

- `visualRange = 82`, `viewAngle = 270`
  用来表达高密度群飞中的邻居感知与威胁感知能力；这是生物学启发参数，不是直接实测角度。

- `protectedRange = 14`, `avoidanceFactor = 0.055`
  对应“个体保持与翼展同量级最小间距”的经验事实，在当前缩放下表现为中等强度的局部避碰。

- `matchingFactor = 0.065`, `centeringFactor = 0.006`
  让群体维持稳定一致的群速和凝聚性，贴近实地观测中高度有序的椋鸟群飞。

- `fleeRange = 160`, `fleeFactor = 0.65`, `alertSpread = 0.90`
  用来近似表达捕食压力下的高警戒传播和快速逃逸；这部分更多是机制化映射，不是单篇论文的直接测量值。

- `predatorTurnRate = 0.14`, `chaseFactor = 0.04`, `preferEdge = true`
  目的是让捕食者保留速度优势，但在近距离机动上仍受限制，并更倾向攻击边缘暴露个体，符合“快但不一定比猎物更灵活”的总体经验。

## 使用建议

- 这个标准预设适合当作“现实启发的默认场景”，而不是“精确复现实验”。
- 如果要做严格论文复现实验，仍需要把画布单位、时间步长、转向半径和群体尺度全部重标定。
- 当前版本更适合作为课程展示和机制比较的现实参考基线。
