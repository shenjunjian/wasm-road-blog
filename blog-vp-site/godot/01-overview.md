# 01 · Godot 4.x 概览与编辑器入门

> 配套 demo：[`godot-demo/01-overview/`](https://github.com/shenjunjian/wasm-road-blog/tree/main/godot-demo/01-overview/)
>
> 截图清单见文末，每张图按规范命名后放到 `public/godot/`，正文用 `<img src="/godot/01-xx.png" />` 引用。

读这一章的目标是 **30 分钟内把 Godot 4.x 编辑器跑起来，并理解屏幕上每一个面板在干什么**。这一章不写一行 GDScript，但里面提到的概念（场景、节点、根节点、`@export`、Project Settings）会贯穿整个系列。

---

## 1. Godot 是什么：节点式 + 数据驱动的开源引擎

Godot 是 **MIT 协议完全开源** 的游戏引擎。它的最大特征不是「免费」或「轻量」（这两点 Cocos2d-x 也具备），而是**把"场景-节点-树"作为引擎的第一公民**。其他引擎可能是「组件挂在 GameObject 上」，Godot 则是「一棵树，节点就是树上的枝叶；每棵子树可以单独保存成场景，场景之间互相实例化、互相继承」。

引擎自带的渲染、物理、UI、动画、音频、脚本、资源导入全部围绕这套节点树运转。这种设计的好处：

| 收益 | 含义 |
| --- | --- |
| 复用粒度细 | 一个「敌人」或「子弹」是独立 `.tscn` 场景，可以被任意父场景实例化 |
| 关系即结构 | 父子关系决定渲染顺序、物理变换、生命周期，不必再写「对象管理器」 |
| 编辑器所见即所得 | 在编辑器里拖拽节点、保存场景的过程 = 构建运行时场景树的过程 |

Godot 编辑器本体是一个 Godot 程序（`Godot` 二进制既是编辑器也是运行时）。游戏打包出来之后，运行时只携带必要的子系统，编辑器 GUI 不被打包。这就是为什么 Godot 安装包只有 100MB 左右，远小于 Unity / Unreal。

---

## 2. Godot 4.x vs Godot 3.x：必须知道的架构变化

如果你读过 2018 ~ 2022 年的 Godot 教程，必须知道 4.x 是 **几乎完全重写的下一代**：

| 维度 | Godot 3.x | Godot 4.x（本系列基于此） |
| --- | --- | --- |
| 渲染后端 | OpenGL ES 3 / Vulkan（双后端） | **统一走 Vulkan**（桌面）/ OpenGL ES 3（移动回退） |
| 渲染管线 | 内置固定管线 + 部分可编程 | **Forward+ / Mobile / Compatibility** 三套可选管线 |
| 3D API 抽象 | `VisualServer`（自封 RHI） | **RenderingDevice + RenderingServer**（Vulkan-first） |
| GDScript | 动态类型 | **静态类型 + 类型推断**（写 `var x: int = 10` 真的会被检查） |
| 信号 | `connect(sig, target, "method")` | `connect(sig, Callable)`，可接 lambda / await |
| C# | 支持 mono | 支持 .NET 6+（独立安装） |
| 物理 | Godot Physics 2D/3D | Godot Physics 2D/3D + 可选 Jolt Physics 3D |
| 默认 UI 风格 | 拟物 | 扁平 Material-ish |
| 4.x 移除项 | — | **移除 GDNative**（改用 GDExtension）、**移除`.gd`文件加载单文件场景** |

对本系列最重要的两条：

1. **GDScript 现在是带类型推断的 Python-like 语言**——写 `var speed := 200` 是合法的静态类型；写 `var speed = 200` 也合法但 IDE 会给警告。这点在第 05、06 章会详细讲。
2. **渲染管线分三档**：Forward+（桌面最强，有 SDFGI 全局光照）、Mobile（中端安卓、Switch）、Compatibility（老设备，回退到 GLES3）。同一个 `.tscn` 不用改，只要在 Project Settings 切换管线。

> 如果你只是想快速上手，可以先记住一句话：「4.x 整体更现代、更快、更接近 Vulkan/Metal 思维，但概念体系没变」。

---

## 3. 为什么选 Godot（而不是 Unity / Unreal）

这一节是从「要做个游戏」角度做横向对比，方便你判断本系列对你是否有意义。

| 维度 | Godot 4.x | Unity 6 | Unreal 5 |
| --- | --- | --- | --- |
| 安装包 | ~100 MB 单文件 | ~5 GB（Hub + 编辑器） | ~30 GB |
| 启动速度 | < 5 秒 | 30 ~ 60 秒 | 60 ~ 120 秒 |
| 脚本语言 | GDScript / C# / C++ | C# | C++ / Blueprint |
| 渲染能力 | 中端（接近 UE4） | 中端 ~ 高端 | 顶级 |
| 学习曲线 | 平缓 | 中等 | 陡 |
| 单文件场景 | ✅ 内置 | ❌ 必须建工程 | ❌ 必须建工程 |
| 开源协议 | MIT | 私有（runtime 部分 IL2CPP 后闭源） | 源码可见但有版税 |

本系列不打算鼓吹 Godot「碾压」其他引擎——**Unity 的生态、Unreal 的图形能力都更强**。Godot 真正占优的场景是：

- 2D / 中等 3D 游戏
- 个人 / 小团队 / 教学项目
- 需要快速试错、不希望被 SDK 升级绑架
- 想把游戏打包到 HTML5（Web 导出 Godot 是所有引擎里最快的）

如果你最终要做 3A 级写实项目，Godot 暂时不合适——但那时你也不会看这系列。

---

## 4. 安装 Godot 4.x

> 截图占位：`<img src="/godot/01-01-start-window.png" />`（项目启动窗口——Project Manager 空白状态）

**不要用 Microsoft Store / Steam 装的 Godot**——那些版本可能滞后 1 ~ 2 个小版本。直接从官网下载标准版二进制：

```bash
# Windows：下载 godot_v4.3-stable_win64.exe.zip，解压即可
# macOS：下载 godot_v4.3-stable_macos.universal.zip
# Linux：godot_v4.3-stable_linux.x86_64.zip

# 运行
./Godot_v4.3-stable --help   # 查看所有命令行参数
./Godot_v4.3-stable           # 启动 Project Manager
```

**两种版本号**：

- **Standard 版**：只带 GDScript。100 MB。
- **.NET 版**：带 C# 支持。需要本机已装 .NET 6+ SDK。比 Standard 大 200 MB。

本系列全部用 **Standard 版 + GDScript**。如果你坚持用 C#，第 05、06 章语法部分需要自行把示例换成 C#，但 90% 的引擎知识是通用的。

**首次启动**：

1. 双击 `Godot` 可执行文件，看到 Project Manager（项目管理器）。
2. Project Manager 不是编辑器——它只管理「哪些文件夹是项目」。每个 Godot 项目就是一个**普通文件夹**，里面有个 `project.godot` 文件作为入口标记。
3. 点击右上角 **New Project** → 选目录 → 项目名取 `01-overview` → **Create & Edit**。第一次会弹「是否导入项目管理器资源」选 **No**。

> **为什么不推荐"Import"已有 demo**：直接 Import 一个外部项目时，Godot 会扫描其 `addons/` 与 `.import/` 缓存并生成对应 `.import` 文件。第一次打开 demo 时按提示点 Import 即可。

---

## 5. 编辑器五大面板

> 截图占位：`<img src="/godot/01-02-editor-panels.png" />`（首次打开编辑器，全面板红框标注）

第一次打开新项目，编辑器会同时显示 5 个面板（Panel）。理解每个面板的职责是后续所有章节的基础。

```
┌────────────────────────────────────────────────────────────────────────┐
│  顶栏菜单：File / Project / Debug / Editor / Help                       │
├──────────────┬───────────────────────────────────┬─────────────────────┤
│              │                                   │                     │
│   Scene      │                                   │    Inspector        │
│   Dock       │        Viewport（2D/3D 画布）     │   （属性检查器）     │
│ （场景树）    │                                   │                     │
│              │                                   │                     │
│              │                                   │                     │
├──────────────┴───────────────────────────────────┴─────────────────────┤
│  FileSystem Dock（文件系统）                       │   下方面板区域      │
│                                                  │ （Output / Debugger │
│                                                  │  / Animation / …） │
└──────────────────────────────────────────────────────────────────┬─────┘
                                                             │ 状态栏  │
```

### 5.1 Scene Dock（场景树面板）

左上角，叫「Scene Dock」但显示的是**场景树**。每个游戏运行时都对应一棵节点树，这棵树在编辑器里就显示在这个面板。

```text
Main (Node2D)
├── Player (CharacterBody2D)
│   ├── Sprite2D
│   └── CollisionShape2D
└── Enemy (RigidBody2D)
```

- 单击节点 = 选中
- 双击节点 = 在 Inspector 显示其属性
- 右键 = 创建子节点 / 删除 / 复制 / 继承场景（关键操作）

### 5.2 Viewport（视口）

中间最大的区域，叫 Viewport。它是**运行时画布的所见即所得**——2D 模式下显示 2D 场景，3D 模式下显示 3D 场景。

> 关键认知：Viewport 里看到的渲染结果是 **「此刻引擎真实渲染出来的样子」**，不是预览。换句话说，你在这里放个 Sprite2D 配上贴图，它就是游戏运行时玩家会看到的画面。

> 截图占位：`<img src="/godot/01-04-first-scene.png" />`（F5 运行首个场景——可以放一个简单 2D 场景的运行截图）

**4 个切换按钮**（Viewport 左上角）：

- **2D / 3D 切换**：决定编辑器当前工作空间
- **Script**：打开关联脚本
- **暂停 / 继续 / 停止**：控制游戏在编辑器内运行的调试

### 5.3 Inspector（检查器）

右侧大面板，显示**当前选中节点的属性与信号**。这是编辑器最强大的面板。

> 截图占位：`<img src="/godot/01-04-inspector.png" />`（选中 Sprite2D 后 Inspector 的截图，标注位置/旋转/缩放、Texture 字段）

**两个 Tab**：

- **Node**：节点的属性。左侧字段名、右侧值。带 🔗 锁链图标的字段 = 可以拖动场景树里的节点进去绑定（如 `Position`、`Sprite2D.texture`）。
- **Node Signals / Signals**：节点可发出的信号。可以在这里直接 Connect 到脚本方法（详见第 06 章）。

**特殊字段颜色**：

| 颜色 | 含义 |
| --- | --- |
| 灰 | 不可编辑（只读 / 由脚本动态计算） |
| 白 | 普通可编辑 |
| 橙 | 当前被重写（场景实例化时由子场景覆盖） |

### 5.4 FileSystem Dock（文件系统面板）

左下角，列出 `res://` 协议下的所有文件。`res://` 是 Godot 的虚拟文件系统，物理上等于项目根目录。为什么要虚拟？因为 Godot 还支持 `user://`（用户存档目录，跨平台映射到 `AppData` / `Library/Application Support` 等）。

### 5.5 下方面板区域（Output / Debugger / Animation / Shader Errors）

下方 Tab 区，最常用的是：

| Tab | 用途 |
| --- | --- |
| **Output** | `print()` 输出、`push_warning()` 警告、`push_error()` 错误 |
| **Debugger** | 运行时的断点、调用栈、远程调试 |
| **Animation** | 选中 AnimationPlayer 时显示关键帧编辑 |
| **Shader Errors** | shader 编译错误高亮（点击错误可直接跳到行号） |

---

## 6. Project Settings：第一次必须改的 5 项

> 截图占位：`<img src="/godot/01-03-project-settings.png" />`（Project Settings 窗口——General / Display / Rendering 三个 Tab 并排）

按 `Project → Project Settings` 打开。这是**整个项目的全局配置**，所有场景、所有节点都会读这些设置。

最常用的 5 项（第一次新建项目时建议改）：

| 设置项 | 路径 | 推荐值 | 作用 |
| --- | --- | --- | --- |
| Display → Window → Size | `display/window/size/viewport_width` | `1280` | 游戏窗口宽度 |
| 同上 → viewport_height | | `720` | 游戏窗口高度 |
| Rendering → Renderer → Rendering Method | `rendering/renderer/rendering_method` | `forward_plus`（桌面）/`mobile`（移动） | 选择渲染管线 |
| Rendering → Environment → Default Clear Color | `rendering/environment/defaults/default_clear_color` | 暗灰 `#1a1a1a` | 背景色 |
| Application → Run → Main Scene | `application/run/main_scene` | 留空（按 F5 会弹选） | F5 默认启动场景 |

> **Main Scene 必须配**：当你做完一个 demo 后，把它的 `.tscn` 路径填到这里（如 `res://Main.tscn`），以后按 F5 直接运行它。

其他三大类设置（了解即可，第六章/第十二章会再用）：

- **Input Map**：键盘 / 手柄按键到动作名的映射（如 `ui_accept` → Space / Enter）
- **AutoLoad**：游戏启动时自动加载的全局单例脚本（第六章细讲）
- **Layers & Tags**：物理碰撞层、渲染层的命名（第十一章细讲）

---

## 7. 第一个场景：Hello, Godot

跟着我走一遍，做一个会动的最小 demo：

> 截图占位：`<img src="/godot/01-04-first-scene.png" />`（F5 运行结果截图——能看到一个在窗口里左右弹跳的红色矩形）

### 步骤

1. **新建场景**：`Scene → New Scene`（或快捷键 `Ctrl+N`）。
2. **加根节点**：点击 Scene Dock 顶部「+ Other Node」按钮，搜索 `Node2D`，双击加入。这是当前场景的根。
3. **加子节点**：选中根节点，再次「+」搜索 `Sprite2D`，加为子节点。
4. **保存场景**：`Ctrl+S`，保存到项目根目录 `Main.tscn`。`.tscn` = 文本格式场景文件，可以用 git diff 看。
5. **让根节点挂脚本**：选中根节点 → Inspector → 点击 `Script` 属性右侧的 `<empty>` → 选 `New Script` → 路径 `Main.gd` → 语言 `GDScript`。

`Main.gd` 内容：

```gdscript
extends Node2D

@export var speed: float = 200.0   # 暴露到 Inspector，可视化调速
var direction: int = 1              # 1 向右，-1 向左

func _process(delta: float) -> void:
    position.x += speed * delta * direction

    # 碰到屏幕边界反弹
    var screen_size := get_viewport_rect().size
    if position.x > screen_size.x:
        position.x = screen_size.x
        direction = -1
    elif position.x < 0:
        position.x = 0
        direction = 1
```

6. **运行**：按 **F5**（macOS 用 Cmd+R）。弹窗问「是否将当前场景设为 Main Scene」——选 Yes。下次按 F5 直接启动。
7. **停止**：编辑器右上角停止按钮，或 `Ctrl+C` 在输出面板停止。

> **三个你可能踩的坑**：
>
> 1. **F5 没反应**：检查 Output 面板有没有报错。常见是「Script not found」——`Main.gd` 没保存，或 Inspector 里 Script 字段是空的。
> 2. **节点不显示**：Sprite2D 没贴图就不会渲染任何东西。第一章可以先不设贴图，但记得点 Inspector → Sprite2D → Texture 字段随便拖一张图进去（本系列 demo 后期会准备公共素材）。
> 3. **`@export` 不生效**：变量必须**类型明确**或带 `:=` 推断，且不能是 `const`。

---

## 8. 编辑器里你还会常用到的操作

| 操作 | 快捷键 |
| --- | --- |
| 保存场景 | `Ctrl + S` |
| 运行 / 停止 | `F5` / `Ctrl + Shift + F5`（在 Output 面板 stop） |
| 快速搜索节点 | `Ctrl + F`（在 Scene Dock） |
| 节点重命名 | `F2` |
| 删除节点 | `Delete` |
| 复制节点 | `Ctrl + D` |
| 撤销 / 重做 | `Ctrl + Z` / `Ctrl + Shift + Z` |
| 全局搜索 | `Ctrl + Shift + F`（可搜节点名、属性、脚本符号） |
| 切换编辑器主题 | `Editor → Editor Settings → Interface → Theme` |

**Ctrl + Shift + F 全局搜索**是隐藏神器，能搜脚本符号、节点类名、属性名，遇到「这个属性在哪」时比翻文档快。

---

## 9. 调试器与运行时

> 截图占位：`<img src="/godot/01-05-debugger.png" />`（运行时 Debugger 面板——断点 + 变量窗口 + 调用栈）

当游戏在编辑器内运行时（F5），下方 Debugger 面板可用：

| Tab | 用途 |
| --- | --- |
| **Errors** | 实时报错 |
| **Debugger** | 当前调用栈、局部变量、远程节点树 |
| **Profiler** | 每帧 CPU 耗时分布，按函数拆 |

加断点的方法：脚本编辑器里点行号左侧空白处 → 红点出现。下次运行到这一行就暂停。

调试器最重要的两个用法：

1. **远程节点检查**：游戏运行时点 Debugger → Remote → 选节点 → 看实时属性。**修改 Inspector 里的值会同步到游戏中**——这是调 UI 的神器。
2. **Live Editing**：写完一行代码按 `Ctrl + Alt + R`（或点编辑器顶部「Live Edit」按钮），游戏内脚本热重载。某些状态会丢失，UI 脚本里慎用。

---

## 10. 章节小结与下一章预告

这一章你学会了：

- ✅ Godot 4.x 的引擎定位与 4.x vs 3.x 关键差异
- ✅ 编辑器五大面板（Scene / Viewport / Inspector / FileSystem / 下方面板区）的角色
- ✅ Project Settings 的关键 5 项
- ✅ 跑通了第一个「会动的小方块」demo

**容易混淆的术语**（先混个眼熟，后面章节会逐个拆）：

- **场景（Scene）**：磁盘上的 `.tscn` 文件 = 一棵以某节点为根的子树
- **实例（Instance）**：运行时父场景内存里挂的子场景子树
- **继承场景（Inherited Scene）**：编辑器里「右键 → Inherit」做出的子场景，本质上是父 `.tscn` 的覆写层
- **节点（Node）**：场景里的一个对象，有类型、有父子关系、有生命周期回调
- **资源（Resource）**：可序列化数据对象（贴图、材质、脚本…），可被节点引用

> **下一章 [02 · 场景·节点·树·继承](./02-scene-tree.md)**：我会用一张完整的图拆解「场景、节点、实例、继承」这四个概念的关系，并讲清节点生命周期 `_ready` / `_process` / `_physics_process` 的调用时机差异。这是整个 Godot 的灵魂章节。

---

## 📷 本章截图清单（请你截屏后放到 `public/godot/`）

| 文件名 | 内容 | 截屏步骤 |
| --- | --- | --- |
| `01-01-start-window.png` | 首次启动的 Project Manager（项目管理器窗口） | 安装后双击 Godot 二进制，截图 Project Manager |
| `01-02-editor-panels.png` | 编辑器全面板红框标注（5 大面板） | 打开 `01-overview` demo 后，在五个面板上画红框 |
| `01-03-project-settings.png` | Project Settings 窗口（General / Display / Rendering） | `Project → Project Settings` 后截图 |
| `01-04-inspector.png` | Inspector 显示 Sprite2D 节点（红框标注 Texture / Position） | 选中 Sprite2D 节点后截图 Inspector |
| `01-04-first-scene.png` | F5 运行后的窗口（一个红色方块在窗口里左右移动） | 按 F5 跑通 demo 后截图游戏窗口 |
| `01-05-debugger.png` | Debugger 面板——远程节点 + 变量窗口 | F5 运行时切到 Debugger Tab 截图 |

把上面 6 张图命名好后放到 `blog-vp-site/public/godot/`，我会把它们嵌入正文并定稿。
