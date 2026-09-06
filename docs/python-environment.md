# Python 开发环境

网页运行不需要 Python。Python 只用于离线训练、生成验证图片、字体分片及 DDS 构建。

本机使用 `D:\TrickTrace\.venv`，Python 3.11.6。现有环境启用了 `--system-site-packages`，复用已安装的 PyTorch 2.5.0+cu121；它不是完全隔离的环境。项目专用补充依赖装入 `.venv`，没有修改全局依赖。2026-09-06 检查 `pip check` 通过。

新机器推荐创建隔离环境，在项目根目录执行：

```powershell
py -3.11 -m venv .venv
.venv/Scripts/python.exe -m pip install torch==2.5.0 --index-url https://download.pytorch.org/whl/cu121
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe -m pip check
```

无 NVIDIA GPU 时，PyTorch 安装源改为 `https://download.pytorch.org/whl/cpu`。训练脚本自动选择 CUDA 或 CPU。运行命令统一使用虚拟环境解释器，无需激活环境：

```powershell
.venv/Scripts/python.exe scripts/train_glyphs.py
.venv/Scripts/python.exe scripts/generate_ocr_validation.py
.venv/Scripts/python.exe scripts/vendor_fonts.py
.venv/Scripts/python.exe scripts/subset_fonts.py
```

训练读取 Windows 字体和 `.tools/fonts` 中的可选字体；具体字体清单写入模型 JSON。缺少字体会改变训练数据，不能声称跨机器逐字节复现。随机种子为 418。新模型先写入 `.cache/models-v3`，通过整图对照后才复制到 `public/models`。合成字符准确率不能替代整图准确率；原始用户截图不参加训练。

`.venv`、`.tools`、`.cache` 和训练中间产物均不提交到 Git；部署只包含已验证的模型和浏览器资源。
