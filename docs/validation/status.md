# 验证说明

## 核心与求解器

初始化 `vendor/dds` 子模块，并用 `python scripts/build_dds.py --native` 生成原生对照程序后，运行 `npm test`。

测试包括牌谱解析、牌号、叫牌约束、采样、Worker 通信和出牌规则；求解测试覆盖独立穷举残局、上游 100 副定约表，以及原生 DDS 与 WASM 的逐张结果比较。原生与 WASM 使用同一上游，因此另外保留独立穷举检查。

## 浏览器

安装 Chrome、运行 `npm run dev`，再在另一个终端执行：

```sh
node scripts/validate_interactions.mjs
node scripts/validate_revision.mjs
npm run test:lead
```

前两个脚本支持 `TRICKTRACE_URL` 指向待验证站点，默认连接 `http://127.0.0.1:5173/`。它们会操作测试浏览器中的牌例及本地存储。截图和报告保存在忽略的产物目录中。

`npm run test:browser` 是 Playwright Test 入口；当前未配置对应的浏览器测试套件，请使用以上脚本。

## OCR

开源仓库不提供私人截图。`tests/fixtures/recognition.json` 保留牌张及状态标注，用于说明输入格式；`npm run test:ocr`、`validate_browser.mjs`、`validate_release.mjs` 和变体脚本需要 `images/` 中匹配的输入。缺少原图时不能复现该部分回归，也不要用不同图片套用旧标注。

可以从 DDS 上游牌例生成合成文字牌谱。当前生成脚本使用 Windows 系统字体，需要 Python 环境及相应字体；详见 [Python 环境](../python-environment.md)。

```sh
python scripts/generate_ocr_validation.py --count 80
node scripts/validate_ocr_independent.mjs
```

验证脚本需要已启动的 Vite 开发服务器和 Chrome。生成图片、标注及结果位于 `artifacts/ocr-independent/`。另外使用 `--start 80 --count 20 --output artifacts/ocr-holdout` 生成一组样本，并通过环境变量 `OCR_DIRECTORY=artifacts/ocr-holdout` 指定验证目录。

该脚本输出整图和牌张统计，但没有设定准确率通过门槛；进程正常结束不代表全部图片识别正确。曾用于调试的样本应作为开发回归集，不能继续声称是未接触的留出集。

OCR 变更应分别报告原图、合成开发样本、独立样本与压缩变体的结果，保留漏牌、误牌和状态错误。不要把合成字符分类准确率换算为真实截图准确率。机器专属报告、原图和历史发布快照不随开源仓库分发。

## 范围限制

桌面浏览器的移动视口检查不能替代真实手机测试。战术正反例只验证已实现结构；复杂挤牌尚未全面覆盖。识牌仍可能在低清、扇形、旋转和压缩图片上失败，必须保留手工校对入口。
