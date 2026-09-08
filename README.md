# 墩迹 TrickTrace

循牌而行，见墩之迹。

TrickTrace 是一个在浏览器中运行的桥牌分析工具，提供图片识牌、DDS 双明手求解、两家牌分析、单明手首攻分析、逐张回放和最优牌路追踪。图片识别与求解在本地浏览器执行，模型、WASM 和字体由站点提供，无需配置云端 AI API。

[在线体验](https://tricktrace.pages.dev/) · [Apache-2.0 许可证](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md)

## 功能

- **牌例管理**：手动点牌或编辑手牌文本，导入 PBN、DLM、LIN 和项目 JSON，切换、导出及删除牌例。
- **图片识牌**：上传、拖放或粘贴截图，通过 ONNX 字形模型和 Tesseract 识别，支持候选校对；未知手牌保留为未知，不按缺牌清单补齐。
- **双明手分析**：计算四家五种定约的最大墩数与 Par，查看合法出牌、并列最优选择和损失墩数。
- **牌路追踪**：逐张出牌、撤销、分支回放，从当前位置生成一条完整的 DDS 最优样例。
- **两家牌分析**：保留庄家与明手，按约束采样两家防守牌；选择首攻后生成完整的条件牌路，逐墩展示四方出牌和赢墩方，实际出牌改变后可从新局面重新分析。
- **单明手首攻分析**：仅保留首攻方手牌，按约束采样其余三家，比较各候选首攻的定约击败率；快速模式仅计算击败率，精确模式同时计算平均墩数。
- **叫牌与手牌约束**：两家牌和首攻分析共用点力、花色长度及高级条件；CCBA v2.2 叫牌规则可联动部分手牌约束，并支持手动修改。
- **本地保存与主题**：浏览器保存牌例和播放状态，支持明暗主题及移动端布局。

## 快速开始

需要 Node.js 22 LTS、npm 和 Git。项目已包含浏览器运行所需的 DDS WASM、OCR 模型及字体，日常前端开发无需重新训练或编译它们。

```sh
git clone --recurse-submodules https://github.com/bingingingin/TrickTrace.git
cd TrickTrace
npm ci
npm run dev
```

打开终端显示的本地地址，默认是 `http://127.0.0.1:5173/`。已有克隆可通过 `git submodule update --init --recursive` 补齐 DDS 源码和测试牌例。

构建与预览：

```sh
npm run build
npm run preview
```

### 基本用法

1. 导入牌谱、上传截图，或选择方位后连续点牌。文本按黑桃、红桃、方块、梅花排列，例如 `AKQ.JT9.432.A765`；`-` 表示缺门，`?` 表示整家未知。
2. 核对四家手牌、定约、庄家和首攻。截图识别结果须手工检查后使用。
3. 完整发牌可查看定约表，点击至少 7 墩的单元格设置对应定约，再逐张出牌或查看完整最优牌路。
4. 需要隐藏牌分析时，使用两家牌或首攻分析并设置采样约束。结果是给定假设下的估计。

浏览器数据可能随清理站点数据而丢失；需要长期保存的牌例请导出。删除牌例或清空操作会同时删除相应播放分支。

## 开发与验证

| 命令 | 用途与前置条件 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | TypeScript 检查与生产构建，输出到 `dist/` |
| `npm test` | 完整 Vitest 回归；需要 DDS 子模块及原生对照程序 |
| `npm run build:dds` | 重建浏览器 DDS；需要 `.tools/emsdk` 中的 Emscripten |
| `npm run test:lead` | 浏览器首攻验证；先启动本地服务并安装 Chrome |
| `npm run test:ocr` | 私人截图回归；需要自行准备匹配标注的图片，开源仓库不附带这些图片 |

完整求解测试前，准备 Python 3.11 和支持 C++20 的 `g++`，在项目根目录执行：

```sh
python scripts/build_dds.py --native
npm test
```

原生程序输出为 `artifacts/native/dds-reference.exe`，测试按此路径调用。更多验证入口、合成 OCR 样本和私有素材边界见 [验证说明](docs/validation/status.md)。离线训练与字体工具见 [Python 开发环境](docs/python-environment.md)。

## 项目结构

```text
src/core/       牌局数据、格式解析和出牌规则
src/engine/     DDS 封装、Worker、采样、叫牌约束和战术分析
src/vision/     浏览器图片识别
src/components/ 界面组件
native/         DDS 原生与 WASM 桥接代码
public/         随站点分发的模型、运行库、字体和品牌资源
tests/          核心规则、求解器和条件模拟测试
scripts/        构建、训练及验证工具
vendor/dds/     固定版本的上游 DDS 子模块
docs/           功能边界与开发说明
```

## 部署

将 `npm run build` 生成的 `dist/` 部署到支持静态文件的服务。Cloudflare Pages 可设置构建命令 `npm run build`、输出目录 `dist`；也可用 Wrangler 将该目录上传到自己的 Pages 项目。

保留 `public/_headers` 中的 COOP/COEP 配置。使用其他托管平台时，配置等价响应头：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

只部署 `dist/`，不要把项目根目录作为公共静态目录。OCR 和 WASM 资源较大，首次加载耗时取决于网络与设备。

## 已知边界

- 低清、压缩、旋转和扇形布局可能漏牌或错牌；字形模型分数不等于经过校准的正确概率。
- DDS 假设四家手牌已知，最优牌路可能不唯一。两家牌和首攻采样仍存在模型偏差与策略融合误差，不能作为实际隐藏牌下的必胜证明。
- CCBA 推断是部分约定到手牌条件的映射，尚未覆盖所有竞争叫牌和后续进程；未覆盖项会提示，可手工修改。见 [规则来源与覆盖](docs/ccba-inference.md) 和 [条件模拟说明](docs/lead-analysis-comparison.md)。
- 战术标签用于解释牌路；复杂挤牌等结构尚未完成全面验证。见 [功能范围](docs/feature-status.md)。

## 贡献

欢迎提交问题和改进。复现报告请注明操作步骤、浏览器版本和预期结果；牌谱或图片仅提交可公开分享的材料，并去除个人信息。代码修改请运行相关测试及 `npm run build`，OCR 改动应分别比较开发样本和独立验证样本。

私人截图、设计源素材、开发流水账与机器专属验证结果不随源码分发。不要强制添加 `.gitignore` 中排除的个人数据和凭据。

## 许可证

本项目原创代码及随仓库发布的原创资源采用 [Apache License 2.0](LICENSE)。第三方代码、运行库、字体及数据仍遵循各自许可证，不因项目开源而变更；来源与授权见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
