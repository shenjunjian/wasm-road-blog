# HarmonyOS ArkUI 学习指南（面向 TypeScript / 前端开发者）

> 资料来源：OpenHarmony 官方 ArkUI 文档仓库（`openharmony/docs`，与华为开发者官网 ArkUI 栏目同源，zh-cn/application-dev 全量），以及华为 HarmonyOS 文档中心的专有 Kit 页面（Scan Kit、IAP Kit、Payment Kit、Push Kit）。API 名称、装饰器、配置字段均取自上述文档原文；文档未给出的写法一律不写。
> 版本口径：ArkTS API version 18~20 区间的文档（Router 大面积标注 deprecated、状态管理 V2 已稳定）。
> 阅读方式：第一、三章是「心智模型」，第二、四~七章是「查手册」，第八章是落地清单。

## 0. 模块地图：ArkUI 相关的能力包

HarmonyOS 的应用能力被切成一组以 `@kit.*` 结尾的聚合模块，`import` 时只写 Kit 名，不写具体文件（这与 npm 的 barrel 导出很像）：

| Kit | 内容 | 本文位置 |
| --- | --- | --- |
| `@kit.ArkUI` | 声明式 UI：`promptAction`、`window`、Curves、mediaquery、自定义组件基类 | 一、四、五、六 |
| `@kit.ArkTS` | 语言运行时：`taskpool`、`Worker`、`util`、`processInfo`、容器 | 二、八 |
| `@kit.AbilityKit` | Stage 模型：`UIAbility`、`Want`、`common` 上下文、`abilityAccessCtrl` 权限、`wantAgent`、意图框架 | 二、七 |
| `@kit.BasicServicesKit` | 基础服务：`BusinessError`、`hilog` 之外的通用类型、`i18n`/`intl` | 全程（错误处理） |
| `@kit.PerformanceAnalysisKit` | `hilog` 日志、性能打点、_hidumper_ | 八 |
| `@kit.CoreFileKit` | `fileIo(fs)`、`picker` 文件选择、`hash`、`fs 监听` | 七 |
| `@kit.MediaLibraryKit` | `photoAccessHelper` 相册、媒体库 | 七 |
| `@kit.CameraKit` | `camera` 相机流水线、`cameraPicker` | 七 |
| `@kit.ConnectivityKit` | `ble`/`bluetoothManager` 蓝牙、`connection`、NFC | 七 |
| `@kit.NotificationKit` | `notificationManager` 通知 | 七 |
| `@kit.ScanKit` | 扫码/识码/生成码图（华为专有） | 七 |
| `@kit.IAPKit` | 应用内购买与订阅（华为专有） | 七 |
| `@kit.PaymentKit` | 华为支付收银台（华为专有） | 七 |
| `@kit.PushKit` | 推送 token 管理（华为专有） | 七 |
| `@kit.ArkWeb` / `@kit.LocalizationKit` | Web 组件、定位 | 未展开 |

一句话架构：**ArkTS 语言（第一章）→ 声明式组件与布局（四、五章）→ 状态驱动更新（第三章）→ 事件与动画（第六章）→ Stage 模型承载页面与生命周期（第二章）→ Kit 调系统能力（第七章）**。

## 目录

- 一、全景：ArkUI 是什么、开发范式与 ArkTS 语法（含 UI 更新机制概述）
- 二、Stage 模型、模块配置、页面导航与 Intent 意图框架
- 三、状态管理与 UI 更新机制（V1 / V2 全量装饰器）
- 四、组件清单与自定义组件
- 五、布局体系
- 六、消息事件、手势与动画
- 七、调用系统能力（权限、蓝牙、相机、相册、文件、扫码、支付、推送）
- 八、工程实践：IDE、构建、调试与迁移建议

---

## 一、全景：ArkUI 是什么，开发范式与 ArkTS 语法

### 1.1 一句话定位

ArkUI 是 HarmonyOS/OpenHarmony 的 **UI 开发 SDK**：它不是一门独立语言，而是「ArkTS 声明式语法 + 组件体系 + 布局/动画/交互能力 + UI 渲染引擎 + 状态管理机制」的组合。你写的是 `.ets` 文件，编译器把它翻译成能在方舟（Ark）运行时上执行的 UI 描述。

两套官方范式，当前主流是前者：

| 范式 | 语言 | 说明 |
| --- | --- | --- |
| **ArkTS 声明式开发范式** | ArkTS（`.ets`） | 本文全部内容。跨设备统一 UI，开发效率优先 |
| ArkUI 端云协同 / C·C++（NDK）范式 | C/C++ | `napi` 接口自建组件、绘制类高性能场景（Canvas/Camera 帧处理）才需要 |

早期 JS 范式（基于 webpack 的 `*.js` + HML/CSS）在文档里已被标记为不推荐继续用于新工程，Stage 模型只支持 ArkTS 范式。

### 1.2 ArkTS 与 TypeScript 的关系（前端最需要重新校准的一节）

ArkTS = **保留 TypeScript 基本语法风格** + **补充声明式 UI 与状态管理语法** + **收紧为静态类型子集**。

保留的：`class/interface/enum/generic`、箭头函数、`async/await`、`Promise`、模块 `import/export`、装饰器语法。

被收紧的部分（`quick-start/typescript-to-arkts-migration-guide.md` 明确列出），核心动机是「让类型在运行时也成立，从而支持 AOT 编译、消除动态查找开销」：

```ts
// ❌ TS 能写，ArkTS 不允许
let x: any = getValue();
function wrap(o: object) { ... }              // 禁止用 object 作类型
const t = { a: 1 }; (t as any).b = 2;          // 禁止运行时增删属性
let u: string | number = v;                    // 联合类型需要显式收窄；禁止 unknown
function f(a: number, b?: number) {} f(...args) // 禁止 rest/spread 到函数参数
const { a, b } = obj;                          // 解构语句受限（部分场景不支持）
let s = Symbol(); obj[s] = 1;                  // 禁止 Symbol 作属性键
for (const k in obj) { ... }                   // 禁止 for..in 遍历对象属性
class C { constructor(private x = 1) {} }      // 禁止参数属性简写
```

改成 ArkTS 的写法：

```ts
// ✅ 用明确的类型替代 any/object
interface Item { id: number; title: string }
let item: Item = { id: 1, title: 'a' };

// ✅ 需要动态字段 → 用 Map
let props: Map<string, string> = new Map();
props.set('k', 'v');

// ✅ 需要「可能是 A 也可能是 B」→ 显式类型 + 判别字段
type Shape = Circle | Rect;   // Circle/Rect 各自带 kind: 'circle' | 'rect'

// ✅ 默认参数 + 显式签名，不要用 ...args
function add(a: number, b: number): number { return a + b; }

// ✅ 不支持的内置能力（如 Object.assign 任意对象、Reflect）在文档里列为「不支持」
```

其他约束值得记住：
- **仅支持在 `.ets` 中使用的语法**：`struct`、`build()`、装饰器。`.ts` 文件里写不了组件。
- `struct` 不是 `class`：`@Component struct` 不能用 `new` 实例化，也不能有 constructor（用成员默认值初始化）。
- 代码规范单列一份文档（`quick-start/arkts-coding-style-guide.md`），并把「高性能写法」单列（`arkts-high-performance-programming.md`：对象数组避免频繁增删、优先值类型、避免装箱类型等）。

> 对前端的实际体感：**把它当成「类型检查更严的 TS + 一套 Vue 式模板语法」即可**。真正需要改习惯的是「不能随手挂属性」「必须给每个变量类型」。

### 1.3 最小可运行页面

```ts
// entry/src/main/ets/pages/Index.ets
@Entry          // 页面入口：该组件是路由可指向的一个页面，一个页面只允许一个 @Entry
@Component      // 声明这是一个自定义组件
struct Index {  // UI 描述写在 struct 里，不是 class
  @State message: string = 'Hello World';   // 状态变量：变了会驱动 UI 刷新

  build() {                                  // build() 描述 UI 结构，只能有一个根节点
    Column() {                               // 容器组件，参数()，子组件用 {} 包裹
      Text(this.message)                     // 组件：属性用链式调用附加
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
      Button() {                             // Button 也可以带子组件
        Text('Tap me')
          .fontSize(20)
          .fontColor(Color.White)
      }
      .onClick(() => {                       // 事件也是链式方法
        this.message = 'Hi ArkUI';
      })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
```

逐行拆解这套语法：

| 写法 | 含义 | 类比 |
| --- | --- | --- |
| `Text('x')` | 创建系统组件 | JSX `<Text>x</Text>` |
| `{ ... }` 紧跟组件 | 容器组件的子节点 | JSX children |
| `.fontSize(50)` | 组件的属性/样式，链式 | CSS 内联，但类型安全（参数是枚举/类） |
| `.onClick(cb)` | 事件回调 | `@click` / `onClick` |
| `if (cond) { Text('a') }` | 条件渲染，写在 `build()` 里 | `v-if` |
| `ForEach(arr, item => ListItem(){...})` | 循环渲染 | `v-for` |
| `@Builder function header()` | 抽取可复用 UI 片段 | 无状态子组件 / slot |
| `this.count` | 读状态变量，同时登记依赖 | Vue 模板里的 ref 自动解包 |

### 1.4 UI 更新机制（官方表述 + 机制要点）

ArkUI 的更新不是「重新执行 render 函数 + 虚拟 DOM diff」，官方文档（ui/state-management/arkts-state-management-introduce.md`）给出的机制是**依赖收集 + 标脏 + 定向 rerender**：

1. **收集依赖**：状态变量在 `build()` 中被读取时，框架把「当前正在渲染的系统组件唯一标识 `elementId`」记进该变量维护的 Set。
   例：`Text(\`${this.name} ${this.age}\`)` 渲染时，`name` 和 `age` 都记下这个 Text 的 `elementId`。
2. **触发更新**：改值时，把依赖集合里的 `elementId` 加入所属自定义组件的「脏系统组件集合」，并把该自定义组件加入「脏自定义组件列表」，请求一次刷新信号；下一个 UI 更新周期遍历列表，调用**系统生成的 `rerender`** 方法，只更新脏节点。
3. **单位是自定义组件**：原文明确「更新是以自定义组件为单位的」——这也是把大页面拆小组件的性能依据。

华为 ArkUI 官网介绍页另外强调的两点（官方开源文档未以同样措辞收录，作为设计目标理解即可）：
- 编译器把 UI 描述**生成为「创建 + 更新」两组函数**（函数式更新），而不是运行时 diff 一棵节点树；
- 相比早期 COMPONENT/ELEMENT 层的树形对比，更新粒度收敛到**单节点（NODE）级别**，即「按需更新」。

对日常开发的可操作结论（详见状态管理章）：
- 只有**被装饰器装饰的变量**改变才刷新 UI；普通成员变量改了不刷新。
- V1 装饰器只能观察**第一层**属性变化，嵌套对象要 `@Observed + @ObjectLink`，V2 的 `@ObservedV2 + @Trace` 支持深度观测。
- 数组「整体赋值」与「push/splice」都能触发 `@State` 更新；但 `ForEach` 靠 key 判断是否复用，key 不变则子组件不会收到新数据（最常见的坑）。

### 1.5 工程结构与文件类型

```
MyApp/
├─ AppScope/
│  ├─ app.json5                    # 应用级配置：bundleName、versionCode、icon、label
│  └─ resources/base/{element,media}/
├─ entry/                          # 一个 HAP 模块（type=entry）
│  ├─ src/main/
│  │  ├─ ets/
│  │  │  ├─ entryability/EntryAbility.ets   # UIAbility：进程内组件调度/生命周期单元
│  │  │  ├─ pages/Index.ets                 # 页面（@Entry 组件）
│  │  │  └─ viewmodel/、common/...          # 普通 .ts/.ets 逻辑代码
│  │  ├─ resources/
│  │  │  ├─ base/element/{string,color,float}.json5   # 字符串/颜色/尺寸资源
│  │  │  ├─ base/media/                     # 图片等
│  │  │  ├─ base/profile/main_pages.json    # 路由页面清单（Router 用）
│  │  │  └─ rawfile/                        # 任意格式原始文件
│  │  └─ module.json5                       # 模块配置：abilities、权限、metadata
│  └─ build-profile.json5
├─ feature/                        # 另一个 HAP（type=feature）
├─ myhar/                          # HAR 静态共享包
└─ build-profile.json5 / hvigorfile.ts / oh-package.json5   # 构建（hvigor ≈ webpack/vite 角色）
```

后缀约定：`.ets` 写 UI（可用装饰器/struct），`.ts` 写纯逻辑，`.json5` 是带注释、允许尾逗号的 JSON 超集。资源访问（`quick-start/resource-categories-and-access.md`）：

```ts
Text($r('app.string.string_hello'))
  .fontColor($r('app.color.color_emphasize'))
  .fontSize($r('app.float.text_size_headline1'))
Image($r('app.media.logo'))            // 自动按限定词目录（如 device/、en_US/）匹配
Image($rawfile('demo/demo.png'))       // rawfile：相对路径，含后缀，不能以 / 开头
// 运行时动态取：ResourceManager 的 getString/getMediaContent/getRawFileContent
```

---

## 二、Stage 模型、模块与 Intent 意图框架

### 2.1 Stage 模型的对象层级

Stage 是当前唯一推荐的应用模型（FA 模型只在 OpenHarmony 小设备保留）。它把一个应用拆成这几层（`application-models/stage-model-development-overview.md`、`abilitykit-overview.md`）：

```
Application（进程）
 ├─ AbilityStage            一个 HAP 模块的容器，模块加载时创建，一个模块一个实例
 │   └─ UIAbility           面向用户的功能入口，与窗口绑定，可多实例
 │        └─ WindowStage    UIAbility 的窗口管理器（应用窗口生命周期）
 │             └─ 页面（@Entry 组件 / Navigation）由 loadContent 装载
 ├─ ExtensionAbility        不面向完整界面的能力扩展（服务/表单/输入等）
 └─ Context（四类，逐级收窄）
     ApplicationContext → AbilityStageContext → UIAbilityContext / ExtensionContext
```

前端类比（仅帮助理解，不对应严格等价）：Application ≈ 浏览器进程；AbilityStage ≈ 一个 JS bundle 的加载入口；UIAbility ≈ 一个标签页/窗口实例；WindowStage ≈ 该标签页的窗口；Context ≈ 一个作用域内可访问的能力集合（类似注入的 app/store/路由实例）。

**UIAbility** 关键行为：
- 一个 UIAbility 对应一类任务（如「编辑文档」），多窗口场景下同一 UIAbility 可多实例。
- 生命周期回调（`application-models/uiability-lifecycle.md`）：

```ts
import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onCreate');
  }
  onDestroy(): void { }
  onWindowStageCreate(windowStage: window.WindowStage): void {
    // 在这里装载页面：应用启动的核心动作
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) { return; }
      hilog.info(0x0000, 'testTag', '%{public}s', 'Succeeded in loading the content.');
    });
  }
  onWindowStageDestroy(): void { }
  onForeground(): void { }
  onBackground(): void { }
  // singleton 模式下再次拉起该能力时触发，收到新的 Want
  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void { }
}
```

文档给出的顺序（原文）：
- 启动：依次触发 `onCreate()` → `onWindowStageCreate()` → `onForeground()`；
- 已在前台的能力被再次拉起：`onNewWant()` → `onForeground()`；
- 从后台回到前台：`onNewWant()` → `onWindowStageCreate()` → `onForeground()`（对应进程保活但窗口已销毁的情形）；
- 退到后台：`onBackground()`。

**ExtensionAbility** 派生类型（文档中出现的）：ServiceExtensionAbility（无界面后台服务）、FormExtensionAbility（服务卡片）、InputMethodExtensionAbility、UIExtensionAbility、DataShareExtensionAbility 等。入口同样是继承 + `onCreate`/`onSessionCreate` 等回调。

### 2.2 模块配置 module.json5（≈ 每个包的 package.json + manifest）

摘自 `quick-start/module-configuration-file.md`：

```json5
{
  "module": {
    "name": "entry",                     // 模块名，与目录名一致
    "type": "entry",                     // entry / feature / shared
    "srcEntry": "./ets/entryability/EntryAbility.ets",   // AbilityStage / UIAbility 代码入口
    "mainElement": "EntryAbility",       // 默认入口元素
    "deviceTypes": ["phone", "tablet", "2in1"],
    "deliveryWithInstall": true,
    "installationFree": false,
    "pages": "$profile:main_pages",      // Router 页面清单
    "abilities": [
      {
        "name": "EntryAbility",
        "srcEntry": "./ets/entryability/EntryAbility.ets",
        "description": "$string:EntryAbility_desc",
        "icon": "$media:icon",
        "label": "$string:EntryAbility_label",
        "startWindowIcon": "$media:icon",
        "startWindowBackground": "$color:start_window_background",
        "launchType": "singleton",       // singleton / multiton / specified（多实例见 multiInstance.md）
        "exported": true,                // 是否允许被其他应用拉起
        "continuable": true,             // 是否支持跨设备迁移
        "skills": [                      // 隐式 Want 匹配规则：动作/实体/URI
          {
            "entities": ["entity.system.home"],
            "actions": ["action.system.home"],
            "uris": [{ "scheme": "https", "host": "www.example.com", "path": "detail" }]
          }
        ]
      }
    ],
    "requestPermissions": [               // 权限静态声明（见第七章）
      { "name": "ohos.permission.INTERNET" }
    ],
    "extensionAbilities": [ /* Form/Service 等 */ ],
    "metadata": [ /* 意图框架等配置索引 */ ]
  }
}
```

### 2.3 应用包形态：HAP / HAR / HSP

| 形态 | 全称 | 打包阶段 | 能否独立运行 | 类比 |
| --- | --- | --- | --- | --- |
| **HAP** | Harmony Ability Package | 编译期 | 可以（entry/feature 都是应用内的模块） | 应用的一个功能模块 |
| **HAR** | Harmony Archive（静态共享包） | 编译期打进调用方 | 否 | 被 bundle 进产物的 npm 包 |
| **HSP** | Harmony Shared Package（动态共享包） | 运行期共享加载 | 否 | external 化的公共依赖，多模块共用一份 |

选型要点：HAR 会随每个引用方复制一份（包体积膨胀）；HSP 适合多个 HAP 共用的大体积公共代码。跨应用发布用原子化服务（`in-app-hsp.md`、`har-package.md`、`hap-package.md`）。

### 2.4 Ability 间跳转：Want

`Want` 是「我想做什么」的意图描述对象（`application-models/want-overview.md`）：

```ts
// 显式 Want：指定目标包与目标 Ability
import { common } from '@kit.AbilityKit';
const context = getContext(this) as common.UIAbilityContext;
context.startAbility({
  bundleName: 'com.example.myapp',
  abilityName: 'DetailAbility',
  parameters: { id: 42 }            // 自定义参数，目标侧从 want.parameters 读取
}).then(() => { /* 跳转成功 */ });

// 需要结果：startAbilityForResult，返回 { resultCode, want }
const res = await context.startAbilityForResult({ bundleName: '...', abilityName: '...' });

// 隐式 Want：只给 action / entities / uri，由系统按 module.json5 的 skills 匹配
context.startAbility({
  action: 'ohos.want.action.viewData',
  entities: ['entity.system.browsable'],
  uri: 'https://www.example.com/detail?id=42'
});

context.terminateSelf();           // 结束当前 Ability
```

`actions-entities.md` 列了系统预置的 action/entity 常量（如 `action.system.home`、`entity.system.home`、`ohos.want.action.viewData`），匹配规则见 `explicit-implicit-want-mappings.md`。

Deep Linking（URI 直跳，需在 AGC/`module.json5` 的 skills.uris 声明 scheme）与 App Linking（域名需与应用做归属校验，防仿冒）的区别：前者任意应用可抢注 scheme，后者要求域名验证，安全性更高，适合从网页/H5 拉起原生页。

### 2.5 页面导航：Router 与 Navigation

两套并行体系。**Router 是页面级（一个 @Entry 组件 = 一个页面，需在 `main_pages.json` 登记）**；**Navigation 是组件级（NavDestination 可不在 `main_pages.json` 声明）**。ui/arkts-router-to-navigation.md` 专门讲从 Router 迁到 Navigation；Router 的接口在 API 参考里大面积标注 `deprecated`（`reference/apis-arkui/js-apis-router.md`），推荐改为通过 `UIContext` 获取 Router/Navigation：

```ts
// —— Router ——
// resources/base/profile/main_pages.json: { "src": ["pages/Index", "pages/PageOne"] }
this.getUIContext().getRouter().pushUrl({ url: 'pages/PageOne', params: { id: 1 } });
this.getUIContext().getRouter().replaceUrl({ url: 'pages/PageOne' });
this.getUIContext().getRouter().back();
// 目标页面取参：
const params = this.getUIContext().getRouter().getParams() as Record<string, number>;

// —— Navigation（推荐）——
@Entry
@Component
struct Home {
  pageStack: NavPathStack = new NavPathStack();     // 路由栈，与 Navigation 一一对应，不可复用

  @Builder pageMap(name: string) {                  // 名字 → NavDestination 的映射
    if (name === 'detail') {
      DetailPage()
    }
  }

  build() {
    Navigation(this.pageStack) {                    // 首页内容（NavBar）
      Column({ space: 8 }) {
        Button('去详情').onClick(() => {
          this.pageStack.pushPath({ name: 'detail', param: { id: 42 } });
        })
      }
    }
    .navBarWidth(400)                                // 分栏时左侧宽度
    .mode(NavigationMode.Auto)                       // Auto：宽屏自动分栏，窄屏 Stack
    .title('首页')
    .navDestination(this.pageMap)
  }
}

@Component
struct DetailPage {
  build() {
    NavDestination() {                               // 每个子页面的根容器
      Column() {
        Text('详情页')
          .onClick(() => {
            this.pageStack.pop();                    // 返回：pop / popToName / popToIndex / clear
          })
      }
    }
    .title('详情')
    .menus([{ value: '更多', icon: $r('app.media.icon'), action: () => {} }])
  }
}
```

要点：
- `NavPathStack` 是导航栈：`pushPath` / `pushDestination`（后者传 builder 而非注册名）/ `pop` / `popToName` / `replacePath` / `clear`；也可 `AppStorage.setOrCreate<NavPathStack>('stack', this.navStack)` 让子组件用 `@StorageLink` 拿到栈。
- NavDestination 内置标题栏、菜单栏、工具栏、内容区四段；支持 `.customTitleBar()`。
- **分栏模式**：文档明确「Navigation 容器宽度 ≥ 600vp 时建议使用分栏模式」，此时左侧 NavBar、右侧子页，路由只替换右侧——这是平板/2in1 自适应的核心机制（`arkts-navigation-split-mode.md`）。
- 跨包/跨模块路由通过 `routeMap` 注册表（`arkts-navigation-cross-package.md`）。
- 应用内底部 Tab 导航仍用 Tabs 组件；转场动画可自定义（Nav 自定义转场见动画章）。

### 2.6 意图框架 Insight Intent（@kit.AbilityKit 中的意图能力）

意图框架是把「应用能力」以**语义化意图**注册给系统，让小艺建议、智慧搜索、意图面板等入口能直接调到应用内功能——比 Deep Linking 更结构化。两条开发路径（`application-models/insight-intent-*.md`）：

**A. 装饰器方式（代码声明）**

```ts
import { InsightIntentExecutor, insightIntent, InsightIntentEntry } from '@kit.AbilityKit';

class ViewLogisticsResultDef {
  result: string = '';
}

@InsightIntentEntry({
  intentName: 'ViewLogistics',        // 意图名（标准意图名由系统定义，见 access-specifications）
  domain: 'LogisticsDomain',
  intentVersion: '1.0.0',
  module: "entry",
  icon: $r('app.media.icon'),
  displayName: '查看快递',
  insertionSeq: 1,
  uiLaunchMode: 'background'
})
export class ViewLogisticsIntentExecutor extends InsightIntentExecutor {
  onExecuteInUIAbilityForegroundMode(intentName: string, params: Record<string, object>): Promise<ViewLogisticsResultDef> {
    // 在 UIAbility 前台执行意图逻辑，例如跳转快递详情页
    return Promise.resolve(new ViewLogisticsResultDef());
  }
}
```

同一组文档列出的其他装饰器：`@InsightIntentLink`（URI 跳转意图）、`@InsightIntentPage`（页面跳转意图，配 UIAbility + 页面路径）、`@InsightIntentFunctionMethod`（把静态方法暴露成意图）、`@InsightIntentForm`（服务卡片意图）。

**B. 配置方式（JSON 声明）**：在 DevEco Studio 里生成 `resources/base/profile/insight_intent.json`，配置意图的 domain、intentName、execution（指向继承 `InsightIntentExecutor` 的类），并可挂 `UIExtensionContentSession` 场景。文档中的执行类骨架：

```ts
import { InsightIntentExecutor, insightIntent, UIExtensionContentSession } from '@kit.AbilityKit';

export default class PlayMusicExecutor extends InsightIntentExecutor {
  onExecute(intentName: string, params: Record<string, object>,
             callback: (result: insightIntent.IntentResult) => void): void {
    // 具体业务
    callback();
  }
}
```

意图分**标准意图**（系统预定义名称与语义，需在 AGC 侧勾选能力）与**自定义意图**（应用自定义名称）。调试：`insight-intent-debug.md` 给出用 `hdc shell` 触发意图面板/意图调用的方法。

> 华为 HarmonyOS 侧另有一套面向 AGC 的 Intents Kit 文档（意图投递、场景化建议），与本节 OpenHarmony Insight Intent 属同一体系不同侧；本文只收录官方开源文档可核实的写法。

### 2.7 进程/线程模型与并发

- 一个应用在一个设备上通常对应一个进程，进程内多个 UIAbility 共享主线程（`process-model-stage.md`）。
- **主线程**承担 UI 与状态管理；耗时计算/IO 建议放子线程（`thread-model-stage.md`）。
- 并发 API 首选 **TaskPool**（`arkts-utils/taskpool-introduction.md`），无需自己管线程生命周期：

```ts
import { taskpool } from '@kit.ArkTS';

@Concurrent                    // 只有 @Concurrent 标注的函数能跨线程执行，且仅支持 .ets
function heavy(buf: ArrayBuffer): number {
  return buf.byteLength;
}

async function run() {
  const task = new taskpool.Task(heavy, new ArrayBuffer(1024));
  const result = await taskpool.execute(task);          // 也可 new taskpool.TaskGroup() 并发一批
}
```

- Worker 适合长期驻留的线程（模型推理、常驻解析），代价是内存与创建成本，文档建议优先 TaskPool。
- 状态管理只能在主线程使用；跨线程更新 UI 需要回到主线程。

---

## 三、状态管理与 UI 更新机制（V1 / V2）

> 面向有 TypeScript / Vue / React 经验的开发者。内容取自 OpenHarmony / HarmonyOS 官方开发文档（ArkUI 指南与 API 参考、华为 Kit 指南），每个示例后注明来源文件；官方文档未覆盖的机制，本文标注「文档未明确」。

### 3.1 更新原理：依赖收集 → 标脏 → rerender

ArkUI 是数据驱动的声明式 UI：**只有被装饰器装饰的变量（状态变量）改变才会引起渲染刷新**；不使用状态变量，「UI 只能在初始化时渲染，后续将不会再刷新」（`arkts-state-management-overview.md`）。

更新分两步（`arkts-state-management-introduce.md`）：

1. **收集依赖**：状态变量被读取时，收集「当前正在渲染的系统组件的唯一标识 `elementId`」，存入该变量维护的 `Set`。例如 `Text(\`${this.name}'s age is ${this.age}\`)` 渲染时，`name`、`age` 同时记下 `Text1` 的 `elementId1`。
2. **触发更新**：改值时把依赖集合里的 `elementId` 加入所属自定义组件的「脏系统组件集合」，再把自定义组件加入「脏自定义组件列表」并请求刷新信号；下一个 UI 更新周期遍历该列表，调用**系统生成的 `rerender`** 方法，只刷新脏节点，实现最小化更新。原文明确「更新是以自定义组件为单位的」。

> **编译器生成函数**：`updateExtraBuilder` / `observeComponentCreation2` 在官方文档中 grep 无命中，故不断言「组件被编译成创建+更新两个函数」。文档可证实的只有：`rerender` 由系统生成；`@Builder`/`@BuilderParam` 是「细粒度的封装和复用 UI 描述」。「UI 更新机制从 COMPONENT/ELEMENT 树形 Diff 升级为单节点 NODE 函数式更新、编译器生成特定函数实现细粒度绑定」——**官网 ArkUI 介绍页提及，官方开源文档未收录**（`arkui-overview`、`arkts-ui-development-overview` 两篇均无此原文）。

约束：状态管理**仅支持 UI 主线程**，不能在子线程、Worker、TaskPool 中使用。

### 3.2 V1 装饰器全家福

依据 overview：**仅 `@Observed/@ObjectLink` 可观察嵌套场景，其他状态变量只能观察第一层**。

| 装饰器 | 作用 | 数据流向 | 双向 | 观察层级 | 典型场景 |
| --- | --- | --- | --- | --- | --- |
| `@Entry` | 页面入口；根节点必须是容器组件，`ForEach` 禁作根 | — | — | — | 页面顶部 |
| `@Component` | 声明自定义组件（搭配 V1 状态变量） | — | — | — | struct |
| `@CustomDialog` | 自定义弹窗组件 | 父子 | — | — | 弹窗（V2 改 `openCustomDialog`） |
| `@State` | 组件自身状态，可作子组件单向/双向同步的数据源 | 组件内→子 | 源 | 第一层 | 计数、表单 |
| `@Prop` | 单向同步，本地可改但**不回传** | 父→子 | ✗ | 第一层（复杂类型深拷贝） | 只读配置 |
| `@Link` | 双向同步，禁止本地初始化 | 父↔子 | ✓ | 第一层 | 受控子组件 |
| `@Provide`/`@Consume` | 跨层级同步，按 key/alias 绑定，不走参数 | 祖先↔后代 | ✓ | 第一层 | 深层状态、主题 |
| `@Observed` | 装饰 class，单独使用无作用，须联用 `@ObjectLink`/`@Prop` | — | — | 使嵌套可观察 | 数组项/嵌套对象 |
| `@ObjectLink` | 接收 `@Observed` 实例，与源双向；禁止整体赋值 | 父↔子 | ✓ | **嵌套** | 列表项组件 |
| `@Watch('cb')` | 监听状态变量变化，同步执行 | 组件内 | — | 变量+第一层 | 变化后副作用 |
| `@Track` | class 属性级更新；未加的属性不能在 UI 用 | 组件内 | — | 属性级，无深度 | 大对象局部绑定 |
| `@Require` | 变量必须由外部传入初始化 | 父→子 | — | — | 必填参数 |
| `@Reusable` | V1 组件复用，回收进父组件缓存池 | — | — | — | 长列表项 |
| `@Builder`/`@BuilderParam` | 封装 UI 片段 / 将 UI 片段作参数传入 | 父→子 | — | 见 §6.5 | 插槽、局部复用 |
| `@Styles`/`@Extend` | 复用公共样式 / 扩展指定系统组件 | — | — | — | 样式收敛 |
| `stateStyles` | 多态样式（focused/normal/pressed/disabled/clicked/selected） | — | — | — | 按压/选中态 |
| `@StorageProp`/`@StorageLink` | 与 AppStorage 某 key 单向/双向同步 | 全局↔组件 | 单向/双向 | 第一层 | 跨页面、跨 Ability |
| `@LocalStorageProp`/`@LocalStorageLink` | 与 LocalStorage 某 key 单向/双向同步 | 页面级↔组件 | 单向/双向 | 第一层 | 页面内共享 |
| `@ObservedV2`/`@Trace` | V2：class 可观察 + 属性深度观测 | — | — | **深度** | 见 §4 |

`$$` 运算符（V1）「给系统组件提供 TS 变量的引用，使得 TS 变量和系统组件的内部状态保持同步」。

### 3.3 单向 vs 双向：四种同步语义

#### 3.3.1 `@Prop`：本地可改但不回传，且会被父覆盖

框架行为原文（`arkts-prop.md`）：「子组件 @Prop 更新时，更新仅停留在当前子组件，不会同步回父组件」；父数据源更新时，`@Prop`「将被来自父组件的数据源重置，所有 @Prop 装饰变量的本地修改将被父组件的更新覆盖」。

```ts
@Component
struct Son {
  @Prop message: string = 'Hi';
  build() { Column() { Text(this.message) } }
}

@Entry
@Component
struct Father {
  @State message: string = 'Hello';
  build() {
    Column() {
      Text(this.message)
      Button(`father click`).onClick(() => { this.message += '*'; })
      // 父组件@State装饰的message传给子组件的message
      Son({ message: this.message })
    }
  }
}
```
> 来源：`ui/state-management/state-management_arkts-prop.md`「框架行为」

坑：`@Prop` 深拷贝时除基本类型/Map/Set/Date/Array 外会丢类型（`PixelMap`、`RegExp`）；应用进后台无法触发刷新，`@Prop` 无法从数据源更新，官方建议改用 `@Link`；不支持装饰 Function。

#### 3.3.2 `@Link`：双向，属性与整体赋值都回传

```ts
class GreenButtonState {
  public width: number = 0;
  constructor(width: number) { this.width = width; }
}

@Component
struct GreenButton {
  @Link greenButtonState: GreenButtonState;
  build() {
    Button('Green Button').width(this.greenButtonState.width).onClick(() => {
      if (this.greenButtonState.width < 700) {
        this.greenButtonState.width += 60;   // 属性变化同步回父组件
      } else {
        this.greenButtonState = new GreenButtonState(180); // 整体赋值同样同步
      }
    })
  }
}
```
> 来源：`ui/state-management/state-management_arkts-link.md`「简单类型和类对象类型的@Link」

`@Link` 禁止本地初始化；只能观察对象本身及一层属性，嵌套需转 `@Observed`/`@ObjectLink`。

#### 3.3.3 `@Observed` + `@ObjectLink`：V1 唯一能观察嵌套的组合

```ts
@Observed class Book { public name: string; constructor(n: string) { this.name = n; } }
@Observed class Bag { public book: Book; constructor(b: Book) { this.book = b; } }

@Component
struct BookCard {
  @ObjectLink book: Book;
  build() {
    Column() {
      Text(`BookCard: ${this.book.name}`)  // 可以观察到name的变化
      Button('change book.name').onClick(() => { this.book.name = 'C++'; })
    }
  }
}

@Entry
@Component
struct Index {
  @State bag: Bag = new Bag(new Book('JS'));
  build() {
    Column() {
      Text(`Index: ${this.bag.book.name}`) // 无法观察到name的变化
      Button('change bag.book.name').onClick(() => { this.bag.book.name = 'TS'; })
      BookCard({ book: this.bag.book })
    }
  }
}
```
> 来源：`ui/state-management/state-management_arkts-observed-and-objectlink.md`「嵌套对象」

文档结论：`@State` 感知外层 `Bag` 第一层变化，`@ObjectLink + @Observed` 感知内层 `Book` 属性变化。`@ObjectLink` **只读**：允许 `this.objLink.a = ...`，禁止 `this.objLink = ...`，赋值会打断同步链。API 19 起可接收无 `@Observed` 的复杂类型，但观察嵌套仍需 `@Observed` 实例或 `makeV1Observed()` 返回值。

#### 3.3.4 `@Provide` / `@Consume`：跳过中间层

```ts
@Component
struct ToDoItem {
  // 通过相同的属性名绑定其祖先组件ToDo内的@Provide装饰的变量
  @Consume count: number;
  build() {
    Column() {
      Text(`count(${this.count})`)
      Button(`count(${this.count}), count + 1`).onClick(() => this.count += 1)
    }
  }
}
@Component struct ToDoList { build() { Row() { ToDoItem(); ToDoItem() } } }

@Entry
@Component
struct ToDo {
  @Provide count: number = 0; // 由入口组件提供给其后代组件
  build() {
    Column() {
      Button(`count(${this.count}), count + 1`).onClick(() => this.count += 1)
      ToDoDemo()
    }
  }
}
```
> 来源：`ui/state-management/state-management_arkts-provide-and-consume.md`（中间层 `ToDoDemo` 省略，示例原文如此）

框架行为：`@Provide` 以 Map 传给所有子组件，`@Consume` 按变量名/alias 查找并把自己注册给 `@Provide`，实现双向。key 必须为 string；API 20 起 `@Consume` 支持默认值；`@Provide` 支持 `allowOverride`。文档提醒：它「相当于把组件粘合在一起了，从组件独立角度考虑，应减少使用」。

### 3.4 状态管理 V2

V1 局限（overview 原文）：用代理观察数据，「状态变量不能独立于 UI 存在，同一个数据被多个视图代理时，其中一个视图的更改不会通知其他视图更新」；只能感知第一层；改对象属性与数组元素存在冗余更新；装饰器配合限制多。V2 增强：状态变量独立于 UI、深度观测与深度监听（不影响观测性能）、属性级精准更新与数组最小化更新、组件输入输出明确。

#### 3.4.1 V1→V2 能力对照（照抄 overview 表格结论）

| V1 | V2 | 关键差异 |
| --- | --- | --- |
| `@Observed` | `@ObservedV2` | `@ObservedV2` 本身无观察能力，仅代表 class 可观察，需配 `@Trace` |
| `@Track` | `@Trace` | V2 属性级精确跟踪 |
| `@Component` | `@ComponentV2` | 分别搭配 V1 / V2 状态变量 |
| `@State` | `@Local` / `@Param @Once` | `@Local` 不可外部初始化，`@State` 可以 |
| `@Prop` | `@Param` | 复杂类型时 `@Prop` 深拷贝、`@Param` **引用** |
| `@Link` | `@Param` + `@Event`（或 `!!`） | V2 由开发者显式实现双向 |
| `@ObjectLink` | `@Param` | 直接兼容，`@Param` 无 `@Observed` 限制 |
| `@Provide`/`@Consume` | `@Provider`/`@Consumer` | `@Consumer` 必须有本地默认值；`@Provider` 默认允许同名重载 |
| `@Watch` | `@Monitor` | `@Monitor` 可深层监听；一次事件多次变化仅以最终结果判断是否触发 |
| AppStorage / Environment / PersistentStorage | AppStorageV2 / 调 Ability 接口 / PersistenceV2 | V2 持久化不再与 AppStorage 耦合 |
| `$$` | `!!` | 双向绑定语法糖（API 12+） |
| `@Reusable` | `@ReusableV2` | API 18+ |
| `@CustomDialog` | `openCustomDialog` 接口 | V2 推荐接口式弹窗 |

迁移：`arkts-v1-v2-migration.md` 提供「V1与V2能力对照迁移表」与「逐步迁移策略」；overview 明确「新开发的应用建议直接用 V2」，已用 V1 且功能性能满足则「不必立即切换」；混用见 `arkts-v1-v2-mixusage.md`；更新时序差异见 `arkts-v1-v2-update-difference.md`。

#### 3.4.2 `@ObservedV2` + `@Trace`

```ts
@ObservedV2
class Son { @Trace public age: number = 100; }
class Father { public son: Son = new Son(); }

@Entry
@ComponentV2
struct Index {
  father: Father = new Father();   // 普通成员，非状态变量
  build() {
    Column() {
      // 当点击改变age时，Text组件会刷新
      Text(`${this.father.son.age}`).onClick(() => { this.father.son.age++; })
    }
  }
}
```
> 来源：`ui/state-management/arkts-new-observedV2-and-trace.md`「观察变化」

`@Trace` 支持 number/string/boolean/class/Array/Date/Map/Set，**不支持 Function**；嵌套类与继承类中的 `@Trace` 属性同样可观察。

#### 3.4.3 `@Local` / `@Param` / `@Once` / `@Event` / `!!`

`@Param`：能否本地修改＝**否**；同步类型＝**由父到子单向同步**；需本地改配 `@Once`（仅初始化时同步一次），需回传配 `@Event`（组件输出）；无本地初始化时必须配 `@Require`。

```ts
@Entry
@ComponentV2
struct Index {
  @Local infoList: Info[] = [new Info('Alice', 8, 0, 0), new Info('Barry', 10, 1, 20)];
  build() {
    Column() {
      ForEach(this.infoList, (info: Info) => { MiddleComponent({ info: info }) })
      Button('change').onClick(() => {
        this.infoList[0] = new Info('Atom', 40, 27, 90); // 数组项整体替换
        this.infoList[1].name = 'Bob';                   // @Trace 属性
        this.infoList[2].region = new Region(7, 9);
      })
    }
  }
}

@ComponentV2
struct MiddleComponent {
  @Require @Param info: Info;                       // 数据源变化时子组件更新
  build() {
    Column() {
      Text(`name: ${this.info.name}`)
      SubComponent({ region: this.info.region })     // 引用继续下传
    }
  }
}
```
> 来源：`ui/state-management/state-management_arkts-new-param.md`「从父组件到子组件变量传递与同步」

双向写法（`arkts-new-binding.md`）：

```ts
@ComponentV2
struct Child {
  @Param value: number = 0;
  @Event $value: (val: number) => void = (val: number) => {};
  build() { Button('change in child').onClick(() => { this.$value(10); }) }
}
Child({ value: this.value, $value: (val: number) => { this.value = val; } })
Star({ value: this.value!! })   // !! 语法糖，等价于上一行
```

#### 3.4.4 `@Computed` / `@Monitor` / `@SyncMonitor` / 同步刷新

```ts
@Entry
@ComponentV2
struct CustomComponentUse {
  @Local firstName: string = 'Li';
  @Local lastName: string = 'Hua';
  age: number = 20; // 无法触发Computed

  @Computed
  get fullName() { return this.firstName + ' ' + this.lastName + this.age; }

  @Monitor('message', 'name')
  onStrChange(monitor: IMonitor) {
    monitor.dirty.forEach((path: string) => {
      hilog.info(0xFF00, 'testTag', `${path}: ${monitor.value(path)?.before} -> ${monitor.value(path)?.now}`);
    });
  }
  build() {
    Column() {
      Text(this.lastName + ' ' + this.firstName)  // 直接求解，算两次
      Text(this.lastName + ' ' + this.firstName)
      Text(this.fullName)                          // 走计算属性，只算一次
      Text(this.fullName)
    }
  }
}
```
> 来源：`ui/state-management/state-management_arkts-new-computed.md`、`ui/state-management/state-management_arkts-new-monitor.md`

`@Computed` 取舍（原文）：「对于简单的计算逻辑，可以不使用计算属性；如果计算逻辑在视图中仅使用一次，则不使用计算属性，直接求解」。`@Monitor` 的入参必须是被 `@Local`/`@Param`/`@Provider`/`@Consumer`/`@Computed` 装饰的状态变量，多个用 `,` 隔开；监听类对象仅能监听整体，监听属性需属性带 `@Trace`；支持通配符路径监听嵌套对象/数组/Date/Map/Set。`@SyncMonitor` 用于「状态变量修改同步监听」（`arkts-new-syncmonitor.md`）。

**更新时序差异**（`arkts-new-applySync-flushUpdates-flushUIUpdates.md`，API 22+）：V2 改状态变量后**不立即标脏**，而是抛出 Promise 微任务（优先级低于宏任务），当前宏任务结束后才处理标脏；`animateTo` 却立刻刷新已标脏节点决定动效首帧，故首帧不符预期。解决接口（`import { UIUtils } from '@kit.ArkUI';`）：
- `UIUtils.applySync(() => {...})`：只同步刷新闭包内的修改（含 `@Computed`、`@Monitor`、UI 节点）；
- `UIUtils.flushUpdates()`：同步刷新此前所有修改（同样执行 `@Computed` 与 `@Monitor`）；
- `UIUtils.flushUIUpdates()`：**只**同步刷新 UI 节点，不执行 `@Computed` 与 `@Monitor`（避免一次点击触发两次回调）。

`makeObserved`（`arkts-new-makeObserved.md`）：用于 `@ObservedV2/@Trace` 覆盖不了的场景——class 在三方包中、成员属性不可修改（`@Sendable`）、interface 或 `JSON.parse` 的匿名对象。写法 `@Local message: Info = UIUtils.makeObserved(new Info(20));`；仅支持非空对象入参，`undefined`/`null` 返回自身，非 Object 编译报错；入参已是 `@Observed` 实例则直接返回自身。（未收录 `canBeObserved` 的说明，此处不作描述。）

### 3.5 应用级 / 页面级存储

| 能力 | 版本 | 真实 API | 文档要点 |
| --- | --- | --- | --- |
| AppStorage | V1 | `AppStorage.setOrCreate('propA', 47)`；`@StorageProp('k')`/`@StorageLink('k')` | 应用内单例 LocalStorage，与进程绑定；`@StorageLink` 改动写回，AppStorage 变动同步给所有单向+双向绑定；key 必须 string；不支持 Function |
| LocalStorage | V1 | `new LocalStorage()`、`storage.setOrCreate(...)`、`@LocalStorageProp`/`@LocalStorageLink`、`@Entry(storage)` | 页面级内存「数据库」；装饰器不支持从父节点初始化，只能按 key 从 LocalStorage 取，无 key 用本地默认值 |
| PersistentStorage | V1 | `PersistentStorage.persistProp(key, defaultValue)`、`deleteProp`、`persistProps`、`keys` | 先建 AppStorage 属性再调 `persistProp` 会用内存值覆盖磁盘值，建议相反顺序 |
| Environment | V1 | `Environment.envProp('languageCode', 'en')`、`envOverride` | 更新链 Environment → AppStorage → Component；须与 UIContext 关联，文档示例在 `UIContext.runScopedTask` 内调用；属性为不可变简单类型 |
| AppStorageV2 | V2 | `AppStorageV2.connect<Message>(Message, () => new Message())!`、`remove`、`keys` | 只支持 class；不支持基本类型、`collections.Set/Map`、PixelMap 等 Native 类型；需 UI 线程；同 key 连不同类型会导致应用异常 |
| PersistenceV2 | V2 | `connect` / `globalConnect` / `save` / `notifyOnError` / `keys` | 关联 `@ObservedV2` 对象的 `@Trace` 属性变化触发**整个对象自动持久化**；被持久化属性必须有初值；建议用 `globalConnect`（`connect` 为 module 级路径，多 module 会有多份副本） |

AppStorage 是「中枢」，把持久化数据与环境变量中转给 UI。仅用于消息传递、不驱动 UI 的场景，官方推荐 `emitter`，不要借 `@StorageLink` 的双向同步做事件通知。

```ts
AppStorage.setOrCreate('propA', 47);
AppStorage.setOrCreate('propB', new Data(50));
let storage = new LocalStorage();
storage.setOrCreate('linkA', 48);

@Entry(storage)
@Component
struct TestStorageProp {
  @StorageLink('propA') storageLink: number = 1;
  @StorageProp('propA') storageProp: number = 1;
  @StorageLink('propB') storageLinkObject: Data = new Data(1);
}
```
> 来源：`ui/state-management/state-management_arkts-appstorage.md`「从UI内部使用AppStorage」

### 3.6 渲染控制

| 能力 | 加载 | 复用 | 约束 |
| --- | --- | --- | --- |
| `if/else` | 按分支构建 | — | 条件可用状态变量或常规变量，**常规变量变化不重渲染** |
| `ForEach` | 全量 | 需配 `@Reusable`/`@ReusableV2` | 键值生成规则严格 |
| `LazyForEach` | 懒加载 | ✗（自管） | 必须实现 `IDataSource` |
| `Repeat` | 懒加载/全量可选 | ✓ 默认开启 | V2，在 `@ComponentV2` 中使用 |

**if/else**：`if (this.count > 0) { Text('...') }`。更新机制——先评估分支条件，分支未变化则不做任何后续；分支变化则删除旧分支节点并执行新分支构造函数。

**ForEach 键生成**：未定义 `keyGenerator` 时框架默认为 `(item: Object, index: number) => { return index + '__' + JSON.stringify(item); }`，复杂对象 JSON 序列化会得到长字符串、占用更多内存；若 `itemGenerator` 声明了 `index` 而 `keyGenerator` 没有，框架会在 key 上拼接 `index`，引入移动元素即重建的问题。

```ts
ForEach(this.simpleList, (item: ChildItemType, index: number) => {
  ChildItem({ item: item.item })
}, (item: ChildItemType, index: number) => {
  return JSON.stringify(item) + index.toString();
})
```
> 来源：`ui/rendering-control/rendering-control_arkts-rendering-control-foreach.md`

**「引用不变但内容变化」的坑**（同文件「常见问题→数据变化不渲染」）：`Replace first article` 用同 id 新对象替换 `articleList[0]` 后，再点 `Like/Unlike first article` 就不生效。原文解释：替换使 `articleList` 变化并触发 ForEach 重新渲染，**但新的 `articleList[0]` 生成的 key 没变，ForEach 不会将数据更新同步给子组件**，该组件仍绑定旧数组项；而直接修改数组项属性时组件能感知并重新渲染。同文件另有「渲染结果非预期」「渲染性能降低」「键值生成失败」「非必要内存消耗」等专章。

**LazyForEach + IDataSource**：必须实现 `totalCount`、`getData`、`registerDataChangeListener`、`unregisterDataChangeListener` 并主动通知 `DataChangeListener`。

```ts
// BasicDataSource实现了IDataSource接口，用于管理listener监听，以及通知LazyForEach数据更新
export class BasicDataSource implements IDataSource {
  private listeners: DataChangeListener[] = [];
  private originDataArray: string[] = [];
  public totalCount(): number { return this.originDataArray.length; }
  public getData(index: number): string { return this.originDataArray[index]; }
  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) { this.listeners.push(listener); }
  }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const pos = this.listeners.indexOf(listener);
    if (pos >= 0) { this.listeners.splice(pos, 1); }
  }
  notifyDataReload(): void { this.listeners.forEach(l => l.onDataReloaded()); }
  notifyDataAdd(index: number): void { this.listeners.forEach(l => l.onDataAdd(index)); }
  notifyDataChange(index: number): void { this.listeners.forEach(l => l.onDataChange(index)); }
  notifyDataDelete(index: number): void { this.listeners.forEach(l => l.onDataDelete(index)); }
}
```
> 来源：`ui/rendering-control/rendering-control_arkts-rendering-control-lazyforeach.md`「BasicDataSource示例代码」

三条硬性约束：必须通过 `DataChangeListener` 更新，**重新赋值第一个参数 `dataSource` 会导致异常**；`dataSource` 用状态变量时，状态变量改变**不会**触发 LazyForEach 刷新；调 `onDataChange` 时需生成不同于原来的键值才能触发重建。

**Repeat（V2）**：

```ts
@Entry
@ComponentV2
struct RepeatLazyLoadingLongData {
  @Local arr: Array<string> = [];   // 假设总长1000，初始无数据
  scroller: Scroller = new Scroller();
  build() {
    List({ scroller: this.scroller, space: 5, initialIndex: 100 }) {
      Repeat(this.arr)
        .virtualScroll({
          onTotalCount: () => { return 1000; },
          onLazyLoading: (index: number) => { this.arr[index] = index.toString(); }
        })
        .each((obj: RepeatItem<string>) => {
          ListItem() { Text(`${obj.index}: Item_${obj.item}`) }.height(50)
        })
    }
  }
}
```
> 来源：`ui/rendering-control/rendering-control_arkts-new-rendering-control-repeat.md`「数据精准懒加载」

要点：`.each()` 等价于 template type 为空字符串的 `.template()`；多类型子组件用 `.templateId()` 求 type，type 不存在回落默认模板；`.key()` 缺省时生成随机键值，发现重复 key 会递归生成新键值；允许在 `.key()` 用 index 但**不建议**（移动时 index 与 key 同变，被判定为数据变化而重建）；懒加载默认开启节点复用，API 18 起可用 `.virtualScroll()` 的 `reusable` 字段关闭；长列表（数据长度大于 30）关闭懒加载会一次性全量加载，官方「不建议使用」。Repeat 文档中**未出现 `twoWayBinding`**（全库 grep 无命中），故不描述。

**@Builder / @BuilderParam**：`@Builder` 分组件内私有与全局两种，参数传递有按引用（随状态刷新）、按值（不随状态刷新）、按回调三种规则；文档「常见问题」列出多参数、`@Builder` 嵌套、在其内创建自定义组件传参不刷新、在 UI 语句外调用影响节点刷新、在其内修改入参、在 `@Watch` 中执行 `@Builder` 等真实坑位。`@BuilderParam` 作插槽，常配空 `@Builder` 作默认值：

```ts
@Component
struct CustomLayout {
  @Builder doNothingBuilder() { };
  @BuilderParam builder: () => void = this.doNothingBuilder;
}
```
> 来源：`ui/state-management/state-management_arkts-page-custom-components-layout.md`

**@Styles vs @Extend vs stateStyles**：`@Styles` 只封装公共属性/事件、不支持传参（编译期报错）、不支持内部使用逻辑组件、只能在当前文件内使用且不支持 `export`；`@Extend(UIComponentName)` 可封装指定组件的私有属性、私有事件与自身全局方法、可带参数、可互相调用，但不支持与 `@Styles` 混用；`stateStyles` 是属性方法，「类似于 css 伪类，但语法不同」，六种状态可与 `@Styles` 联用（`.stateStyles({ normal: this.normalStyle, pressed: this.pressedStyle })`）。

```ts
@Extend(Text) function fancy() { .fontColor(Color.Red) }
@Extend(Text) function superFancyText(size: number) { .fontSize(size).fancy() }
```
> 来源：`ui/state-management/state-management_arkts-extend.md`

### 3.7 组件复用与按需更新

- **`@Reusable`（V1）**：组件下树时「自定义组件（包含视图节点、组件实例和状态上下文）将被放入其**父自定义组件**的缓存池」，新建节点优先复用。提供 `aboutToRecycle`/`aboutToReuse`，且会**递归调用所有子组件**这两个回调（与子组件是否被标记无关）。限制：仅用于自定义组件；复用前后结构需一致，结构差异用 `reuseId` 区分；不支持 `ComponentContent`；不建议嵌套使用；在子组件 `aboutToReuse` 中改父组件状态变量不生效，需 `setTimeout` 移出复用作用域。
- **`@ReusableV2`（API 18+）**：只装饰 `@ComponentV2` 组件，且只能作为 V2 组件的子组件（放进 V1 组件会编译期报错）。`aboutToReuse` **无入参**；回收期间组件保持冻结——无法触发 UI 刷新、无法触发 `@Monitor`，且解冻后不补做延后刷新（与 `freezeWhenInactive` 的区别）；复用前自动重置组件内状态变量并重算相关 `@Computed`/`@Monitor`，所有 V2 组件无论是否标记都经历该重置；不建议在 `aboutToRecycle` 中改状态变量。
- **组件冻结**（`arkts-custom-components-freeze.md`）：`@Component({ freezeWhenInactive: true })` 激活后「系统将仅对处于激活状态的自定义组件进行更新」，把更新范围缩到 active 组件；inactive 重新变 active 时状态管理框架补做必要刷新。active/inactive **不等于可见性**，目前仅 6 类场景：页面路由（栈顶 active）、TabContent、LazyForEach（屏上 active、缓存节点 inactive）、Navigation、组件复用（进池 inactive、上树 active）、以及它们的混用（API 17 及以下切 Tab 时 LazyForEach 全部置 active，API 18 起仅屏上节点 active）。限制：`BuilderNode` 无法继承父组件冻结；冻结与复用混用时解冻不会触发 `@Watch`。
- **按需更新组合拳**：`@Track`（V1 属性级）解决「只改 `name` 却刷新绑定 `age` 的 Text」；`@Computed` 解决多处重复计算；V2 `@Param/@Event` 明确输入输出减少无谓同步；`freezeWhenInactive` 与 `@ReusableV2` 复用期冻结消除不可见组件刷新。UI 高性能文档给出的思路含「惰性加载优先」「更新代替重建」（指向组件复用）「状态精确控制」；可用 DevEco Studio Profiler 的状态管理打点定位（`arkts-state-management-introduce.md` 附 trace 图）。

### 3.8 与 Vue3 / React 对照（只到语法层）

| ArkUI | Vue 3 | React | 不一样在哪 |
| --- | --- | --- | --- |
| `@State` / `@Local` | `ref()` / `reactive()` | `useState()` | ArkUI 必须在变量上写装饰器；Vue 靠 Proxy 依赖收集，React 靠重新执行函数 + diff |
| `@Prop` | `props` | props | ArkUI `@Prop` 允许本地改但不回传；Vue/React 的 props 只读 |
| `@Link` / `!!` | `v-model` | 受控 value + onChange | ArkUI V1 由框架封装双向，V2 需自己写 `@Param`+`@Event` |
| `@Provide`/`@Consume` | `provide/inject` | Context | ArkUI 是**双向**同步；Vue 的 provide 默认不回传 |
| `@Observed`+`@ObjectLink` | 深层 `reactive` | 无对应（需换新引用） | ArkUI 需专门组合才能观察第二层 |
| `@Watch` / `@Monitor` | `watch` / `watchEffect` | `useEffect` | V2 `@Monitor` 异步、多次变化只看最终值 |
| `@Computed` | `computed()` | `useMemo()` | ArkUI 文档同样主张「仅一处使用就别加」 |
| AppStorage / PersistentStorage | Pinia / persist 插件 | 外部 store | ArkUI 内置、按 key 绑定装饰器，且限定 UI 主线程 |
| ForEach / LazyForEach / Repeat | `v-for` + 虚拟列表 | `map` + `key` + 虚拟化库 | LazyForEach 必须自己实现 `IDataSource` |

收束：ArkUI 的响应式**由装饰器声明、由框架生成的 `rerender` 驱动、以自定义组件为单位标脏**；它既非 Vue 的 Proxy 拦截 + 依赖收集，也非 React 的函数重跑 + 树 diff。搬直觉时最容易踩的两点：V1 只能观察第一层、ForEach 靠 key 判定是否把新数据同步给子组件。

---

## 四、组件清单与自定义组件

> 本章内容取自 OpenHarmony ArkUI API 参考与开发指南，每个示例后注明源文件名，示例为原文节选（保留原注释与写法）。
>
> **关于「HarmonyOS 扩展高级组件」**：OpenHarmony 仓库不含 `ohos-arkui-advanced-*`（Dialog、SplitLayout、ComposeTitleBar 等属 HarmonyOS 侧 ArkUI 扩展），因此 1.6 节按官方文档实际收录、且带特殊系统能力/设备形态约束的组件归集，不虚构该系列。

### 4.1 组件分类总表

只列 ArkUI API 参考中**有独立文档页**的组件；文件前缀统一为 `reference/apis-arkui/arkui-ts/ts-`，表中省略。

#### 4.1.1 基础组件（`ts-basic-components-*.md`，共 30 个文件）

| 组件名 | 用途（文档原文） | 代表性属性 / 事件 |
| --- | --- | --- |
| `Text` | 显示一段文本的组件 | `fontSize`/`fontColor`/`maxLines`；`onCopy`、`onTextSelectionChange` |
| `Button` | 按钮组件，可快速创建不同样式的按钮 | `type`(`ButtonType`)、`stateEffect`、`buttonStyle`；`onClick`、`gesture` |
| `Image` | 加载并显示 png/gif/svg/jpg 等图片（网络图需 `ohos.permission.INTERNET`） | `objectFit`、`alt`、`interpolation`；`onComplete`、`onError` |
| `TextInput` | 单行文本输入框组件 | `type`(`InputType`)、`placeholderFont`、`enterKeyType`；`onChange`、`onSubmit` |
| `TextArea` | 多行文本输入框，超宽自动换行 | `placeholderColor`、`textAlign`；`onChange`、`onEditChange` |
| `Toggle` | 提供勾选框、状态按钮、开关三种样式 | `selectedColor`、`switchStyle`；`onChange` |
| `Checkbox` | 多选框，用于选项的打开或关闭 | `select`、`selectedColor`、`shape`；`onChange` |
| `Radio` | 单选框，提供交互选择项（需 `RadioOptions.group`） | `checked`、`radioStyle`；`onChange` |
| `Slider` | 滑动条，用于音量/亮度等快速调节 | `blockColor`、`trackColor`、`style`；`onChange` |
| `Progress` | 进度条，显示加载或处理进度 | `value`、`total`、`style`(`ProgressStyleOptions`) |
| `LoadingProgress` | 显示加载动效的组件 | `color`、`enableLoading`、`contentModifier` |
| `Gauge` | 数据量规图表，环形展示数据 | `value`/`min`/`max`、`startAngle`、`colors` |
| `QRCode` | 显示单个二维码 | `color`、`backgroundColor`、`contentOpacity` |
| `Divider` | 分割线，分割内容块 | `vertical`、`color`、`strokeWidth`、`lineCap` |
| `Blank` | 空白填充，在容器主轴方向填充空余（仅 Row/Column/Flex 生效） | `color` + 通用 `layoutWeight` |
| `Marquee` | 跑马灯，单行文本滚动展示 | `fontColor`、`start`、`step`；`onStart`、`onBounce`、`onFinish` |
| `ImageAnimator` | 帧动画，逐帧播放图片列表 | `images`(`ImageFrameInfo[]`)、`state`、`duration`；`onStart`、`onPause` |
| `Search` | 搜索框组件 | `searchButton`、`placeholderFont`、`textFont`；`onSubmit`、`onChange` |
| `SymbolGlyph` | 显示图标小符号 | `fontColor`、`fontSize`、`fontWeight` |
| `Rating` | 在给定范围内选择评分 | `stars`、`stepSize`；`onChange` |
| `PatternLock` | 九宫格图案密码锁 | `sideLength`、`circleRadius`、`regularColor`；`onPatternComplete` |
| `DatePicker` | 滑动选择日期 | `lunar`、`start`/`end`；`onDateChange` |
| `TimePicker` | 滑动选择时间 | `useMilitaryTime`；`onChange` |
| `TextPicker` | 滑动选择文本/图片/图文混排 | `defaultPickerItemHeight`；`onChange`、`onScrollStop` |
| `CalendarPicker` | 日历选择器，下拉日历弹窗选日期 | `start`/`end`、`selected`；`onChange` |
| `Menu` | 以垂直列表形式显示的菜单（配 `bindMenu`/`bindContextMenu` 使用） | `font`、`radius`；子组件 `MenuItem`/`MenuItemGroup`/`SubMenu` |
| `RichEditor` | 图文混排与文本交互式编辑 | `copyOptions`、`bindSelectionMenu`；`onReady`、`onSelect` |
| `RichText` | 解析并显示 HTML 格式文本（ArkWeb） | 子组件解析；`onStart`、`onComplete` |
| `NodeContainer` | 挂载 `FrameNode`/`BuilderNode`，由 `NodeController` 控制上下树 | 接口 `NodeContainer(controller: NodeController)` |
| `XComponent` | 提供用于图形绘制与媒体数据写入的 Surface | `type`/`libraryname`/`id`；`onLoad`、`onDestroy` |

#### 4.1.2 容器与滚动（`ts-container-*.md`，共 28 个文件）

| 组件名 | 用途（文档原文） | 代表性属性 / 事件 |
| --- | --- | --- |
| `Column` | 沿垂直方向布局的容器 | `alignItems`、`justifyContent`、`reverse`；`space`(`ColumnOptions`) |
| `Row` | 沿水平方向布局的容器 | `alignItems`、`justifyContent`、`reverse`；`space` |
| `Flex` | 弹性布局容器 | `direction`、`wrap`、`alignItems`、`justifyContent`（`FlexOptions`） |
| `Stack` | 堆叠容器，后入子组件覆盖前者 | `alignContent`、`syncLoad` |
| `RelativeContainer` | 相对布局，用于复杂场景元素对齐 | `alignRules`、`guideLine`、`barrier` |
| `List` | 列表，适合连续多行呈现同类数据 | `space`、`divider`、`lanes`、`alignListItem`；`onScrollIndex`、`onReachStart` |
| `ListItem` | 列表项，必须配合 List 使用 | `selectable`、`selected`；`onSelect`、`transition` |
| `ListItemGroup` | 列表分组（`header`/`footer`/`space`） | 配合 `List` 与 `LazyForEach` |
| `Grid` | 网格容器，行列单元格布局 | `columnsTemplate`、`rowsTemplate`、`columnsGap`；`onScrollIndex`、`onItemDragStart` |
| `GridItem` | 网格中单项内容容器 | `rowStart`/`rowEnd`/`columnStart`/`columnEnd`；`onSelect` |
| `WaterFlow` | 瀑布流容器，紧密布局 | `columnsTemplate`、`itemConstraintSize`；`onReachStart`、`onScrollFrameBegin` |
| `FlowItem` | 瀑布流单项 | 配合 `WaterFlow`，支持单个子组件 |
| `Scroll` | 可滚动容器，子组件超出时可滚动 | `scrollable`、`scrollBar`、`scrollBarColor`；`onScrollFrameBegin`、`onWillScroll` |
| `Swiper` | 滑块视图容器，轮播 | `index`、`autoPlay`、`indicator`、`loop`；`onChange`、`onAnimationStart` |
| `Tabs` | 页签切换内容视图容器 | `vertical`、`scrollable`、`barMode`；`onChange`、`onTabBarClick` |
| `TabContent` | Tabs 中一个页签的内容视图 | `tabBar`；`onWillShow`、`onWillHide` |
| `Refresh` | 下拉刷新容器（单子组件） | `refreshing`(`$$`)、`pullToRefresh`；`onStateChange`、`onRefreshing` |
| `Panel` | 可滑动面板，轻量内容展示窗口 | `type`、`mode`、`dragBar`、`customHeight`；`onChange`、`onHeightChange` |
| `Badge` | 信息标记，附加在单个组件上 | `count`、`position`、`style`(`BadgeParamWithNumber`) |
| `AlphabetIndexer` | 字母索引，与容器联动快速定位 | `arrayValue`、`selectedColor`；`onSelect`、`onRequestPopupData` |
| `Counter` | 计数器，增减操作 | `enableInc`、`enableDec`；`onInc`、`onDec` |
| `Hyperlink` | 超链接，组件范围内点击跳转 | `color`；接口 `Hyperlink(address, content)` |
| `FormLink` | 静态卡片交互（router/message/call） | `FormLinkOptions` |
| `WithTheme` | 为主题作用域（`colorMode`/`theme`）容器 | `WithThemeOptions` |
| `DynamicLayout` | 运行时动态切换布局算法，不改变子组件状态 | `algorithm`(`LayoutAlgorithm`) |
| `ArcList` | 弧形列表 | `space`、`scrollBar`、`cachedCount`；`onScrollIndex` |
| `ArcSwiper` | 弧形滑块视图容器 | `index`、`indicator`、`duration`；`onChange` |
| `FolderStack` | 折叠屏悬停堆叠容器 | `alignContent`、`enableAnimation`、`autoHalfFold`；`onFolderStateChange` |

#### 4.1.3 图形绘制

| 组件名 | 用途 | 代表性属性 / 事件 |
| --- | --- | --- |
| `Canvas`（`ts-components-canvas-canvas.md`） | 画布组件，用于自定义绘制图形 | `enableAnalyzer`；`onReady`；上下文 `CanvasRenderingContext2D` / `DrawingRenderingContext` |
| SVG 标签（`ts-basic-svg.md`） | SVG 解析能力说明：`<rect>`/`<circle>`/`<ellipse>`/`<line>`/`<polyline>`/`<polygon>`/`<path>`，以及滤镜、遮罩、裁剪、图案、渐变色 | 通用属性 `id`、`fill`、`stroke`、`stroke-width`、`opacity`、`transform`（API 21+ 配合 `Image.supportSvg2(true)` 支持旋转/缩放/倾斜/矩阵） |

#### 4.1.4 媒体

| 组件名 | 用途 | 代表性属性 / 事件 |
| --- | --- | --- |
| `Video`（`ts-media-components-video.md`） | 播放视频并控制播放状态 | `src`/`previewUri`/`currentProgressRate`/`controller`；`autoPlay`、`controls`、`objectFit`；`onStart`、`onPause`、`onFinish`、`onError`、`onPrepared` |
| `ImageAnimator`（文件在 basic-components 目录） | 帧动画播放 | `images`、`state`、`duration`、`reverse`；`onStart`、`onPause`、`onRepeat` |
| `XComponent` | Surface 嵌入视图，自定义渲染 | `type`(`XComponentType`)、`id`；`onLoad`、`onDestroy` |

#### 4.1.5 安全组件（`ts-security-components-*.md`）

| 组件名 | 用途 | 代表性属性 / 事件 |
| --- | --- | --- |
| `SaveButton` | 安全控件的保存控件：用户首次点击弹窗授权后，应用短时间内获得访问媒体库特权接口授权（API19- 为 10 秒，API20+ 为 1 分钟） | `icon`(`SaveIconStyle`)、`text`(`SaveDescription`)、`buttonType`；`onClick(SaveButtonCallback)`、`userCancelEvent` |
| `PasteButton` | 安全控件的粘贴控件：用户点击后应用临时获取读取剪贴板权限 | `icon`(`PasteIconStyle`)、`text`(`PasteDescription`)、`buttonType`；`onClick(PasteButtonCallback)` |

#### 4.1.6 高级/受限组件（文档实际收录）

官方文档没有 ohos-arkui-advanced 系列文件；以下组件在官方文档中带**非 Full 系统能力**或**特定设备形态**约束，可视为"扩展能力"清单。

| 组件名 | 约束（文档原文） | 代表属性 / 事件 |
| --- | --- | --- |
| `ArcList` / `ArcSwiper` / `ArcListItem` / `ArcText` | **系统能力：SystemCapability.ArkUI.ArkUI.Circle**（非 Full），面向圆形屏 | `digitalCrownSensitivity`、`space`；`onChange` |
| `EmbeddedComponent` | 「仅支持在拥有多进程权限的设备上使用」；不支持 `onClick` 等通用事件 | `loader`(`Want`)、`type`(`EmbeddedType`)；`onTerminated`、`onError` |
| `FolderStack` | 折叠屏悬停场景，配合 `SafeAreaType.SYSTEM` 避让 | `enableAnimation`、`autoHalfFold`；`onFolderStateChange`、`onHoverStatusChange` |
| `SideBarContainer` | 侧边栏显隐容器，第一子组件为侧边栏、第二为内容区 | `showSideBar`、`controlButton`、`sideBarWidth`、`minSideBarWidth`；`onChange` |
| `UIPickerComponent` | 通用选择器容器，选中项由 `options.selectedIndex` 决定 | `canLoop`、`enableHapticFeedback`、`selectionIndicator`；`onChange`、`onScrollStop` |
| `WithTheme` | 局部主题作用域（深色/浅色/自定义 theme） | `colorMode`(`ThemeColorMode`)、`theme`(`CustomTheme`) |
| `DynamicLayout` | 运行时切换布局算法 | `algorithm`、`alignment`、`space` |
| `Counter` / `Panel` / `AlphabetIndexer` | 平台形态相关（输入法栏、轻面板、索引列表） | `onInc`/`onDec`；`mode`/`dragBar`；`arrayValue`/`onSelect` |

### 4.2 典型写法（照抄文档示例）

#### 4.2.1 基础组件

**Button**（`reference/arkui-ts/ts-basic-components-button.md` 示例1，节选）

```ts
Button('OK', { type: ButtonType.Normal, stateEffect: true })
  .borderRadius(8)
  .backgroundColor(0x317aff)
  .width(90)
  .onClick(() => {
    console.info('ButtonType.Normal');
  })
// 子组件写法：Button 内含 Row + LoadingProgress + Text
Button({ type: ButtonType.Circle, stateEffect: true }) {
  LoadingProgress().width(20).height(20).color(0xFFFFFF)
}.width(55).height(55).backgroundColor(0x317aff)
```

**Text**（`ts-basic-components-text.md` 示例2，节选；同时展示 `@Extend`）

```ts
@Extend(Text)
function style() {
  .font({ size: 12 }, { enableVariableFontWeight: true })
  .border({ width: 1 })
  .padding(10)
  .width('100%')
}
// build() 内：decoration 支持 type/color/style 三个字段
Text('This is the text content with the decoration set to LineThrough and the color set to Red.')
  .decoration({
    type: this.textDecorationType[this.changeDecorationIndex],
    color: Color.Red,
    style: this.textDecorationStyle[this.changeDecorationIndex]
  })
  .style()
```

**Image**（`ts-basic-components-image.md` 示例1，节选）

```ts
@Entry
@Component
struct ImageExample1 {
  build() {
    Column() {
      Row() {
        // 加载png格式图片
        Image($r('app.media.ic_camera_master_ai_leaf'))
          .width(110).height(110).margin(15)
          .overlay('png', { align: Alignment.Bottom, offset: { x: 0, y: 20 } })
      }
    }.height(320).width(360).padding({ right: 10, top: 10 })
  }
}
```

**TextInput**（`ts-basic-components-textinput.md` 示例4，节选）

```ts
@Entry
@Component
struct TextInputExample {
  @State text: string = '';
  controller: TextInputController = new TextInputController();

  build() {
    Column() {
      TextInput({ placeholder: 'input ...', controller: this.controller })
        .width(380)
        .height(60)
        .cancelButton({
          style: CancelButtonStyle.CONSTANT,
          icon: { size: 45, src: $r('app.media.startIcon'), color: Color.Blue }
        })
        .onChange((value: string) => { this.text = value; })
    }
  }
}
```

**Toggle**（`ts-basic-components-toggle.md`，节选）

```ts
Toggle({ type: ToggleType.Switch, isOn: false })
  .selectedColor('#007DFF')
  .switchStyle({
    pointRadius: 15,
    trackBorderRadius: 10,
    pointColor: '#D2B48C',
    unselectedColor: Color.Pink
  })
  .onChange((isOn: boolean) => {
    console.info('Component status:' + isOn);
  })
```

**QRCode**（`ts-basic-components-qrcode.md` 示例1，节选）

```ts
QRCode(this.value).width(140).height(140)          // 默认
QRCode(this.value).color(0xF7CE00).width(140).height(140)          // 二维码颜色
QRCode(this.value).width(140).height(140).backgroundColor(Color.Orange)   // 背景色
QRCode(this.value).width(140).height(140).color(Color.Black).contentOpacity(0.1)
```

**Progress / Search / Slider 接口签名**（各文件 `## 接口` 原文）：`Progress(options: ProgressOptions)`（`value`、`total`、`type: ProgressType`）、`Search(options?: SearchOptions)`（`searchButton`、`placeholderFont`；`onSubmit`、`onChange`）、`Slider(options?: SliderOptions)`（`min`/`max`/`step`、`blockColor`；`onChange`）。无障碍相关字段见 `SliderCustomContentOptions`：`accessibilityText`、`accessibilityDescription`、`accessibilityLevel`、`accessibilityGroup`（`ts-basic-components-slider.md`）。

#### 4.2.2 容器与滚动

**Stack**（`ts-container-stack.md`，完整示例）

```ts
@Entry
@Component
struct StackExample {
  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Text('First child, show in bottom').width('90%').height('100%').backgroundColor(0xd2cab3).align(Alignment.Top)
      Text('Second child, show in top').width('70%').height('60%').backgroundColor(0xc1cbac).align(Alignment.Top)
    }.width('100%').height(150).margin({ top: 5 })
    // 从API版本26.0.0开始，新增syncLoad属性。
    .syncLoad(true)
  }
}
```

**List**（`ts-container-list.md` 示例2，节选）

```ts
List({ space: 20, initialIndex: 0 }) {
  LazyForEach(this.arr, (item: string) => {
    ListItem() {
      Text('' + item)
        .width('100%').height(100).fontSize(16)
        .textAlign(TextAlign.Center).borderRadius(10).backgroundColor(0xFFFFFF)
    }
    .border({ width: 2, color: Color.Green })
  }, (item: string) => item)
}
.height(300).width('90%').friction(0.6)
.lanes({ minLength: 40, maxLength: 40 })
.alignListItem(this.alignListItem)
.scrollBar(BarState.Off)
```

**Grid**（`ts-container-grid.md` 示例1，节选）

```ts
Grid() {
  ForEach(this.numbers1, (day: string) => {
    GridItem() {
      Text(day).fontSize(16).backgroundColor(0xF9CF93).width('100%').height('100%').textAlign(TextAlign.Center)
    }
  }, (day: string) => day)
}
.columnsTemplate('1fr 1fr 1fr 1fr 1fr')
.rowsTemplate('1fr 1fr 1fr 1fr 1fr')
.columnsGap(10)
.rowsGap(10)
.zIndex(this.dragItem == item ? 1 : 0)   // 同文档拖拽示例：用 zIndex 控制层叠
```

**Refresh**（`ts-container-refresh.md` 示例，节选；`$$` 双向绑定 `refreshing`）

```ts
@Entry
@Component
struct RefreshExample {
  @State isRefreshing: boolean = false;
  build() {
    Refresh({ refreshing: $$this.isRefreshing }) {
      List() {
        ForEach(this.arr, (item: string) => { ListItem() { Text('' + item) } }, (item: string) => item)
      }
    }
  }
}
```

**RelativeContainer**（`ts-container-relativecontainer.md` / `ui/state-management/state-management_arkts-create-custom-components.md` 中的 `alignRules` 用法）：`RelativeContainer()` 内子组件用 `.id('HelloWorld')` + `.alignRules({ center: { anchor: '__container__', align: VerticalAlign.Center }, middle: { anchor: '__container__', align: HorizontalAlign.Center } })`。

**Swiper / Tabs / Scroll / WaterFlow 签名**：`Swiper(controller?: SwiperController)`、`Tabs(options?: TabsOptions)` + `TabContent().tabBar(...)`、`Scroll(scroller?: Scroller)`、`WaterFlow(options?: WaterFlowOptions)`（源文件同名）。

#### 4.2.3 图形绘制

**Canvas**（`ts-components-canvas-canvas.md` 示例1）

```ts
@Entry
@Component
struct CanvasExample {
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private context: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  build() {
    Flex({ direction: FlexDirection.Column, alignItems: ItemAlign.Center, justifyContent: FlexAlign.Center }) {
      Canvas(this.context)
        .width('100%').height('100%').backgroundColor('#ffff00')
        .onReady(() => { this.context.fillRect(0, 30, 100, 100) })
    }.width('100%').height('100%')
  }
}
```

**SVG 标签**（`ts-basic-svg.md`「基础形状」，节选 xml）

```xml
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" style="background:#f0f0f0">
    <!-- 1. <rect> 矩形 -->
    <rect x="50" y="50" width="100" height="60" id="myRect" fill="#4CAF50" stroke="#333" />
</svg>
```

> 基础形状标签：`<rect>`、`<circle>`、`<ellipse>`、`<line>`、`<polyline>`、`<polygon>`、`<path>`；另有「图形效果」章节的滤镜/遮罩/裁剪/图案/渐变色。API 21+ 将 `Image.supportSvg2` 置 true 后 `transform` 支持平移、旋转、缩放、倾斜、矩阵变换。

#### 4.2.4 媒体

**Video**（`ts-media-components-video.md`「基础用法」，节选）

```ts
@Entry
@Component
struct VideoCreateComponent {
  @State videoSrc: Resource = $rawfile('video1.mp4');
  @State previewUri: Resource = $r('app.media.poster1');
  @State isAutoPlay: boolean = false;
  @State showControls: boolean = true;
  controller: VideoController = new VideoController();

  build() {
    Column() {
      Video({ src: this.videoSrc, previewUri: this.previewUri, controller: this.controller })
        .width('100%').height(600)
        .autoPlay(this.isAutoPlay)
        .controls(this.showControls)
        .onStart(() => { console.info('onStart'); })
        .onPause(() => { console.info('onPause'); })
        .onFinish(() => { console.info('onFinish'); })
        .onError(() => { console.error('onError'); })
    }
  }
}
```

#### 4.2.5 安全组件

**SaveButton**（`ts-security-components-savebutton.md` 示例1，节选）

```ts
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo } from '@kit.CoreFileKit';

@Entry
@Component
struct Index {
  handleSaveButtonClick: SaveButtonCallback =
    async (event: ClickEvent, result: SaveButtonOnClickResult, error?: BusinessError) => {
      if (result === SaveButtonOnClickResult.SUCCESS) {
        let helper = photoAccessHelper.getPhotoAccessHelper(this.getUIContext().getHostContext());
        let uri = await helper.createAsset(photoAccessHelper.PhotoType.IMAGE, 'png');
        // ... 写文件
      }
    };

  build() {
    Row() {
      Column({ space: 10 }) {
        SaveButton().onClick((this.handleSaveButtonClick))
        SaveButton({ icon: SaveIconStyle.FULL_FILLED, text: SaveDescription.DOWNLOAD, buttonType: ButtonType.Capsule })
      }.width('100%')
    }.height('100%')
  }
}
```

**PasteButton**（`ts-security-components-pastebutton.md` 示例，节选）

```ts
@Entry
@Component
struct Index {
  handlePasteButtonClick: PasteButtonCallback =
    (event: ClickEvent, result: PasteButtonOnClickResult, error?: BusinessError<void>) => {
      if (result === PasteButtonOnClickResult.SUCCESS) { console.info("success"); }
    };

  build() {
    Row() {
      Column({ space: 10 }) {
        PasteButton().onClick(this.handlePasteButtonClick)
        PasteButton({ icon: PasteIconStyle.LINES, text: PasteDescription.PASTE, buttonType: ButtonType.Capsule })
      }.width('100%')
    }.height('100%')
  }
}
```

#### 4.2.6 高级/受限组件

**FolderStack**（`ts-container-folderstack.md`，节选）

```ts
FolderStack() {
  // ... 子组件堆叠
}
.alignContent(Alignment.Bottom)
.height("100%").width("100%")
.enableAnimation(true)      // 是否启动动效
.autoHalfFold(true)         // 是否自动旋转
.onFolderStateChange((msg) => {
  if (msg.foldStatus === FoldStatus.FOLD_STATUS_EXPANDED) {
    console.info("The device is currently in the expanded state")
  }
})
.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
```

**SideBarContainer**（`ts-container-sidebarcontainer.md`，节选）

```ts
SideBarContainer(SideBarContainerType.Embed) {
  Column() {                       // 第一个子组件：侧边栏
    ForEach(this.arr, (item: number) => {
      Column({ space: 5 }) {
        Image(this.current === item ? this.selectedIcon : this.normalIcon).width(64).height(64)
        Text("Index0" + item).fontSize(25).fontColor(this.current === item ? '#0A59F7' : '#999')
      }.onClick(() => { this.current = item; })
    }, (item: string) => item)
  }.width('100%').backgroundColor('#19000000')

  Column() {                       // 第二个子组件：内容区
    Text('SideBarContainer content text1').fontSize(25)
  }.margin({ top: 50, left: 20, right: 30 })
}
.controlButton({ position: ControlButtonPosition.Default, icons: { startIcon: this.normalIcon } })
```

**Counter**（`ts-container-counter.md`，节选）

```ts
Column({ space: 50 }) {
  Counter() { Text(this.value1.toString()) }
    .onInc(() => { this.value1++; })
    .onDec(() => { this.value1--; })
  Counter() { Text(this.value2.toString()) }
    .onInc(() => { this.value2++; })
    .onDec(() => { this.value2--; })
    .enableInc(true)
    .enableDec(false)
}.width('100%').height('100%').justifyContent(FlexAlign.Center)
```

**WithTheme**（`ts-container-with-theme.md` 示例1，节选）

```ts
Column() {
  WithTheme({ colorMode: ThemeColorMode.DARK }) {
    Column() {
      Text('WithTheme').fontSize(40).fontWeight(FontWeight.Bold)
      Text('DARK').fontSize(40).fontWeight(FontWeight.Bold)
    }
    .justifyContent(FlexAlign.Center).width('100%').height('33%')
    .backgroundColor($r('sys.color.background_primary'))
  }
}
.height('100%')
.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.END, SafeAreaEdge.BOTTOM, SafeAreaEdge.START])
```

**Menu + bindMenu**（`ts-basic-components-menu.md` 示例1，节选；Menu 不能单独使用）

```ts
@Builder
MyMenu() {
  Menu() {
    MenuItem({ startIcon: this.iconStr, content: "菜单选项" })
    MenuItemGroup() {
      MenuItem({ content: "菜单选项", endIcon: this.iconStr2, builder: (): void => this.SubMenu() })
    }
  }
}
build() {
  Row() {
    Column() { Text('click to show menu').fontSize(50) }.bindMenu(this.MyMenu).width('100%')
  }.height('100%')
}
```

**ArcList**（`ts-container-arclist.md`，节选；系统能力为 `ArkUI.Circle`）

```ts
ArcList({ initialIndex: 0, header: this.tabBar1 }) {
  ForEach(this.numItems, (item: number, index: number) => {
    ArcListItem() {
      Button('' + item, { type: ButtonType.Capsule })
        .width(this.listSize)
        .focusable(true)
        .focusOnTouch(true)
        .backgroundColor(0x17A98D)
    }.align(Alignment.Center)
  }, (item: number, index: number) => (item + index).toString())
}
.space(LengthMetrics.px(10))
.focusable(true).defaultFocus(true)
```

### 4.3 自定义组件与 UI 片段复用

#### 4.3.1 `@Entry` / `@Component` / `struct` / `build()`

源：`ui/state-management/state-management_arkts-create-custom-components.md`。

```ts
@Component
struct HelloComponent {
  @State message: string = 'Hello, World!';

  build() {
    // HelloComponent自定义组件组合系统组件Row和Text
    Row() {
      Text(this.message)
        .onClick(() => {
          // 状态变量message的改变驱动UI刷新
          this.message = 'Hello, ArkUI!';
        })
    }
  }
}

@Entry            // @Entry 装饰的组件是页面入口，单页面仅允许一个
@Component
struct ParentComponent {
  build() {
    Column() {
      Text('ArkUI message')
      HelloComponent({ message: 'Hello World!' })   // struct 实例化可省略 new
      Divider()
      HelloComponent({ message: 'Hello ArkTS!' })
    }
  }
}
```

要点（原文）：「自定义组件基于 struct 实现，struct + 自定义组件名 + {...} 的组合构成自定义组件，不能有继承关系」；「自定义组件名、类名、函数名不得与系统组件名重复」；`@Entry` 可接受可选 `LocalStorage` 或 `EntryOptions`（`@Entry({ routeName: 'myPage' })`）；`@ComponentV2`（API 12+）装饰的组件内只能使用 V2 状态变量（`@Local`/`@Param`/`@Once`/`@Event`/`@Provider`/`@Consumer`），且不能与 `@Component` 混用于同一 struct。

#### 4.3.2 `@Builder`

源：`ui/state-management/state-management_arkts-builder.md`「自定义组件内使用自定义构建函数」。

```ts
@Entry
@Component
struct PrivateBuilder {
  @State builderValue: string = 'Hello';

  @Builder
  builder() {
    Column() {
      Text(this.builderValue).width(230).height(40).backgroundColor('#ffeae5e5').borderRadius(20).margin(12)
    }
  }

  build() {
    Row() {
      Column() {
        this.builder()                    // 私有 builder 用 this.xxx() 调用
        Button('Click to change the builderValue').onClick(() => {
          this.builderValue = 'builderValue was clicked';
        })
      }
    }
  }
}
```

全局写法：`@Builder function overBuilder(param: ParamTmp) {...}`，在 `build()` 中直接 `overBuilder(...)`；需存入数组/传参给子组件时用 `wrapBuilder` 得到 `WrappedBuilder<[T1, T2]>`（源：`ui/state-management/arkts-wrapBuilder.md`：`let builderVar: WrappedBuilder<[string, number]> = wrapBuilder(MyBuilder);`）。

#### 4.3.3 `@Builder` 参数传递：值传递 vs 引用传递 vs 回调传递

规则原文（`ui/state-management/state-management_arkts-builder.md`）：「按回调传递和按引用传递时，支持 @Builder 函数内 UI 组件刷新。**按引用传递只在传入一个参数且该参数直接传入对象字面量时生效，有多个参数时不支持 @Builder 函数内 UI 组件刷新**」；「调用 @Builder 装饰的函数默认按值传递。当传递的参数为状态变量时，状态变量的改变**不会**引起 @Builder 函数内的 UI 刷新」；「使用引用传递时，在 @Builder 函数中不能修改参数的属性」。

```ts
// 按引用传递（会刷新）：单个参数 + 对象字面量
class Tmp { public paramA1: string = ''; }

@Builder
function overBuilderByReference(params: Tmp) {
  Row() { Text(`UseStateVarByReference: ${params.paramA1} `) }
}

@Entry
@Component
struct ParameterReference {
  @State label: string = 'Hello';
  build() {
    Column() {
      overBuilderByReference({ paramA1: this.label })   // 关键：传的是字面量对象
      Button('Click me').onClick(() => { this.label = 'ArkUI'; })  // 点击后 @Builder 内文本变为 ArkUI
    }
  }
}
```

```ts
// 按值传递（不会刷新）
@Builder
function overBuilderByValue(paramA1: string) {
  Row() { Text(`UseStateVarByValue: ${paramA1} `) }
}
// build() 中 overBuilderByValue(this.label) —— this.label 改变不会刷新该 Text
```

按回调传递（API 20+，`ui/state-management/state-management_arkts-builder.md`）：`UIUtils.makeBinding<T>(() => this.number1)` 返回 `Binding<T>` 支持内部刷新；再传一个写回调则返回 `MutableBinding<T>`，可在 `@Builder` 内改值并同步回调用方（`num2.value += 1;`）。限制条件另需注意：`@Builder` 参数类型不允许 `undefined`/`null`；两个及以上参数且未用回调传递时不触发动态渲染；在 `@Builder` 内改参数属性会抛运行时错误（API 23+ 错误码 140109）。

#### 4.3.4 `@BuilderParam`

源：`reference/arkui-ts/ts-basic-components-richeditor.md`（示例中把 `@Builder` 作为 `@BuilderParam` 成员并给默认值）。

```ts
@Entry
@Component
struct Index {
  @BuilderParam my_builder2: () => void = placeholderBuilder2;   // 默认值 + 可由外部覆盖

  @Builder
  placeholderBuilder() {
    Row({ space: 2 }) {
      Image($r('app.media.startIcon')).width(24).height(24)
      Text('Custom Popup').fontSize(10)
    }.width(100).height(50).padding(5)
  }
}
```

`ui/state-management/state-management_arkts-provide-and-consume.md` 专门提示尾随闭包场景下 `this` 指向问题：`CustomWidget() { CustomWidgetChild({ builder: this.builder2 }) }` 中尾随闭包里的 `this` 指向 HomePage 而非 CustomWidget，导致子组件 `@Consume` 找不到 CustomWidget 的 `@Provide`。

#### 4.3.5 `@Styles` 与 `@Extend`

源：`ui/state-management/state-management_arkts-style.md`、`ui/state-management/state-management_arkts-extend.md`。

```ts
// 定义在全局的@Styles封装的样式
@Styles
function globalFancy1() {
  .width(150).height(100).backgroundColor(Color.Pink)
}

@Entry
@Component
struct GlobalFancy {
  @State heightValue: number = 100;

  @Styles                    // 组件内@Styles可引用状态变量、可写事件
  fancy() {
    .width(200).height(this.heightValue).backgroundColor(Color.Gray)
    .onClick(() => { this.heightValue = 200; })
  }

  build() {
    Column({ space: 10 }) {
      Text('FancyA').globalFancy1().fontSize(30)
      Text('FancyB').fancy().fontSize(30)
    }.width('100%')
  }
}
```

```ts
// @Extend 语法：@Extend(UIComponentName) function functionName { ... }
@Extend(Text)
function fancy() {
  .fontColor(Color.Red)
}
// superFancyText 可以调用预定义的 fancy —— @Extend 支持封装私有属性、私有事件和自身定义的全局方法
@Extend(Text)
function superFancyText(size: number) {
  .fontSize(size)
  .fancy()
}
```

差异（原文）：`@Extend` 支持传参且可封装指定组件的私有属性/私有事件；但封装私有属性/事件时**不支持和 `@Styles` 混用**。

#### 4.3.6 `@Require`

源：`arkts-new-param.md`（`@Require` 无独立文档页，此处以其在 V2/V1 中的实际用法为准）。

```ts
@Entry
@Component
struct Parent {
  @Local count: number = 0;
  @Local message: string = 'Hello';
  @Local flag: boolean = true;
  build() {
    Column() {
      Child({ count: this.count, message: this.message, flag: this.flag })
    }
  }
}

@ComponentV2
struct Child {
  @Require @Param count: number;      // 必须外部传入初始化，否则编译/运行报错
  @Require @Param message: string;
  @Require @Param flag: boolean;
  build() { Column() { Text(`Param ${this.count}`); Text(`Param ${this.flag}`) } }
}
```

V1 同理：`@Require @Prop text: string`（见 `ts-container-flex.md`）。`arkts-new-param.md` 原文：「允许本地初始化，若不在本地初始化，则需要和 `@Require` 装饰器一起使用，要求必须从外部传入初始化」。

### 4.4 组件生命周期

#### 4.4.1 时序表（源：`ts-custom-component-lifecycle.md` + `ui/state-management/state-management_arkts-page-custom-components-lifecycle.md`）

| 时机 | 回调 | 说明（文档要点） |
| --- | --- | --- |
| 组件实例创建后、`build()` 前 | `aboutToAppear()` | 允许在此改状态变量，更改在随后 `build()` 生效；建议只做本节点初始化，避免高耗时 |
| `build()` 后 | `onDidBuild()`（API 12+） | 适合埋点上报等不影响实际 UI 的逻辑 |
| 页面每次显示/隐藏 | `onPageShow()` / `onPageHide()` | 仅对 `@Entry` + router 页面生效 |
| 点击返回键 | `onBackPress(): void \| boolean` | 返回 true 表示自行处理，不做路由返回 |
| 主题应用（`build()` 前） | `onWillApplyTheme(theme: Theme)`（API 12+） | 可改状态变量；API 18 起支持 V2 组件 |
| 路由单实例移到栈顶 | `onNewParam(param)`（API 19+） | 仅 `@Entry` 且作为 router 页面时生效 |
| 复用组件入树 | `aboutToReuse(params)`（API 10+）/ `aboutToReuse()`（API 18+ 无参重载） | 构造参数通过 `params` 传入；避免对 `@Link/@ObjectLink/@Prop` 重复赋值 |
| 复用组件进缓存 | `aboutToRecycle()`（API 10+） | 加入复用缓存前调用 |
| 析构销毁 | `aboutToDisappear()` | 禁止改状态变量（尤其 `@Link`）；不建议在其后创建弹窗；不建议 `async await`（阻塞 GC） |
| ArkTS 卡片表单 | `onFormRecycle()` / `onFormRecover()`（API 11+） | 卡片场景复用/恢复 |
| 页面转场 | `pageTransition()`（API 9+） | 进入/离开页面时实现动画 |

删除机制原文：「在删除组件之前，将调用其 `aboutToDisappear` 生命周期函数……后端节点直接从组件树上摘下，后端节点被销毁，对前端节点解引用，前端节点已经没有引用时，将被 Ark 虚拟机垃圾回收」。

#### 4.4.2 代码（V1 复用；源：`ts-custom-component-lifecycle.md#aboutToReuse`）

```ts
@Reusable
@Component
struct Child {
  @State message: Message = new Message('AboutToReuse');

  aboutToReuse(params: Record<string, ESObject>) {
    console.info("Recycle Child")
    this.message = params.message as Message
  }

  build() {
    Column() { Text(this.message.value).fontSize(20) }.borderWidth(2).height(100)
  }
}
```

#### 4.4.3 V2 侧实际出现的回调

源：`ui/state-management/arkts-new-reusableV2.md`。V2 组件仍可用 `aboutToAppear`/`aboutToDisappear`，`@ReusableV2` 提供 `aboutToRecycle`/`aboutToReuse`，**与 `@Reusable` 不同的是 `aboutToReuse` 没有入参**；回收/复用阶段会递归调用所有子组件的对应回调（即使子组件未标记可复用）；`@ReusableV2` 复用时自动重置组件内状态变量、重算 `@Computed` 及相关 `@Monitor`。文档不建议在 `aboutToRecycle` 中改状态变量。

```ts
@ReusableV2
@ComponentV2
struct ReusableV2Component {
  aboutToAppear() { hilog.info(DOMAIN, TAG, 'ReusableV2Component aboutToAppear called'); }
  aboutToDisappear() { hilog.info(DOMAIN, TAG, 'ReusableV2Component aboutToDisappear called'); }
  aboutToRecycle() { hilog.info(DOMAIN, TAG, 'ReusableV2Component aboutToRecycle called'); }
  aboutToReuse() { hilog.info(DOMAIN, TAG, 'ReusableV2Component aboutToReuse called'); }
  build() { Column() { Text('ReusableV2Component') } }
}
```

V2 的 `@Monitor` 是**异步监听**装饰器（不是生命周期回调）；`ts-custom-component-lifecycle.md` 未把 `onDidBuild` 列为 V2 可用回调。

### 4.5 通用属性 / 通用事件速查

索引文件：`ts-component-general-attributes.md`、`ts-component-general-events.md`（这两页只给分类索引，`## ` 级条目即下表分类；具体函数名以下表「来源」列的实现文件为准）。

| 分组 | 分类（索引原文） | 函数/属性名 + 来源 |
| --- | --- | --- |
| 尺寸/布局约束 | 尺寸设置、布局约束 | `width`/`height`/`size`/`padding`/`margin`/`safeAreaPadding`/`layoutWeight`/`constraintSize`（`ts-universal-attributes-size.md`）；`aspectRatio`（richeditor 属性白名单） |
| 位置与对齐 | 位置设置、Flex布局 | `align`/`direction`/`position`/`markAnchor`/`offset`/`alignRules`/`layoutGravity`/`chainMode`（`ts-universal-attributes-location.md`）；`justifyContent`/`alignItems`（Row/Column/Flex） |
| 边框与背景 | 边框设置、背景设置、外描边 | `.border({ width: 2, color: Color.Green })`、`.borderRadius(8)`、`.borderWidth(1)`、`.borderColor(...)`、`.backgroundColor(0x317aff)`、`.shadow(...)`（见 button/list/grid/with-theme 示例） |
| 透明度/显隐/禁用 | 透明度设置、显隐控制、禁用控制 | `.opacity(0.4)`、`.visibility(...)`；禁用控制索引为「禁用控制」（该函数无独立文档页） |
| Z 序 | Z序控制 | `.zIndex(this.dragItem == item ? 1 : 0)`（`ts-container-grid.md`；`ts-container-swiper.md` 亦说明 zIndex 与 offset 的遮挡关系） |
| 变换与裁剪 | 图形变换、形状裁剪、图像效果、视效设置 | `.rotate(...)`/`.scale(...)`/`.translate(...)`、`.clip(true)`、`.clipShape(new CircleShape({ width: '100%', height: '100%' }))`（`ts-container-arclist.md`） |
| 渐变 | 颜色渐变 | `.linearGradient(...)`（`ts-basic-components-image.md`）、`.colorGradient(...)`（`ts-basic-components-slider.md` 示例4） |
| 点击/长按/触摸 | 触摸交互控制、拖拽控制 | `.onClick((event?: ClickEvent) => {...})`（`ts-universal-events-click.md`）、`.onTouch((event?: TouchEvent) => {...})`（`ts-universal-events-touch.md`）；长按通过 `.gesture(LongPressGesture(...))`（`ts-gesture-common.md`，`type GestureType = TapGesture \| LongPressGesture \| PanGesture \| PinchGesture \| SwipeGesture \| RotationGesture \| GestureGroup`；官方文档中无 `onLongPress` 写法）；拖拽 `onDragStart`/`onDragEnter`/`onDragMove`/`onDragLeave`/`onDrop`/`onDragEnd`/`onPreDrag`（`ts-universal-events-drag-drop.md`） |
| 悬浮/按键 | 悬浮态效果 | `.onHover((isHover: boolean, event: HoverEvent) => {...})`、`.onHoverMove(...)`（`ts-universal-events-hover.md`）；`.onKeyEvent(...)`、`.onKeyPreIme(...)`、`.onKeyEventDispatch(...)`（`ts-universal-events-key.md`） |
| 焦点 | 焦点控制 | `.focusable(true)`、`.defaultFocus(true)`、`.focusOnTouch(true)`（`ts-container-arclist.md`/`ts-basic-components-search.md` 示例）；`onFocus(event: () => void)`、`onBlur(event: () => void)`、`getUIContext().getFocusController().requestFocus('Row 2')`（`ui/arkts-common-events-focus-event.md`） |
| 无障碍 | 无障碍属性 | `accessibilityGroup`、`accessibilityText`、`accessibilityDescription`、`accessibilityLevel`（`ts-basic-components-richeditor.md` 通用属性白名单原文；字段定义另见 `ts-basic-components-slider.md`） |
| 组件/复用标识 | 组件标识、复用标识 | `.id('HelloWorld')`（`ui/state-management/state-management_arkts-create-custom-components.md`）；`.reuseId('ReuseA')`（`ui/state-management/state-management_arkts-reusable.md`，注释「通过 reuseId 区分不同结构的复用组件」） |
| 多态样式 | 多态样式 | `.stateStyles({ ... })`（`ts-container-list.md`、`ts-container-grid.md` 示例） |
| 动效 | 显式动画、组件转场 | `.transition(TransitionEffect.OPACITY.animation({ duration: 2000, curve: Curve.Ease }).combine(TransitionEffect.rotate({ z: 1, angle: 180 })))`（`ts-transition-animation-component.md`，签名 `transition(value: TransitionOptions \| TransitionEffect): T`）；`animation(...)` 见 `ts-explicit-animation.md` |
| 安全区域 | 安全区域 | `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])`（`ts-basic-components-xcomponent.md`、`ts-container-folderstack.md`、`ts-container-with-theme.md`）；`Tabs` 文档说明其默认值即 `expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])` |
| 挂载/区域 | 挂载卸载事件、组件区域变化事件 | `.onAreaChange(...)`（`ts-basic-components-text.md`、`ts-basic-components-richeditor.md`）；`onVisibleAreaChange` 被 `ImageAnimator.monitorInvisibleArea` 引用 |
| 动态属性 | 动态属性设置、自定义内容 | `.attributeModifier(...)`（`ts-basic-components-slider.md`、`ts-components-canvas-canvas.md` 示例3）、`.contentModifier(...)`（`button`/`progress`/`radio`/`toggle` 文档） |

其余仅出现在索引、无独立实现文档的分类（`图片边框设置`、`浮层`、`Popup控制`、`菜单控制`、`全屏/半模态转场`、`隐私遮罩`、`分布式迁移标识`、`拖拽排序`、`组件内容填充方式`、`事件独占控制`、`鼠标光标控制`、`特效绘制合并`、`点光源设置`、`图像效果(系统接口)` 等）不在此展开函数名，避免虚构。

### 4.6 弹窗与选择

官方文档收录：`ts-methods-alert-dialog-box.md`（AlertDialog）、`ts-methods-custom-dialog-box.md`（CustomDialog）、`ts-methods-action-sheet.md`（ActionSheet）、`js-apis-promptAction.md`、`arkts-create-toast.md`、`arkts-dialog-overview.md`、`arkts-modal-overview.md`、`arkts-menu-overview.md`、`arkts-popup-overview.md`、`ts-basic-components-menu.md`。

| 能力 | 官方文档 | 推荐调用方式（原文要点） |
| --- | --- | --- |
| 警告弹窗 | `ts-methods-alert-dialog-box.md` | `this.getUIContext().showAlertDialog({...})`；`AlertDialog.show()` 已 deprecated |
| 列表选择弹窗 | `ts-methods-action-sheet.md` | `this.getUIContext().showActionSheet({ sheets: [...] })`；`ActionSheet.show()` 已 deprecated |
| 自定义弹窗 | `ts-methods-custom-dialog-box.md` | `@CustomDialog` + `CustomDialogController`（`open()`/`close()`/`getState()`），controller 须作为 struct 成员变量在内部定义赋值才有效 |
| 即时反馈 | `ui/arkts-create-toast.md`、`js-apis-promptAction.md` | `this.getUIContext().getPromptAction().showToast({...})`；全局 `promptAction.showToast` 自 API 18 起废弃 |
| 半模态/全模态 | `ui/arkts-modal-overview.md` | `bindSheet` 半模态、`bindContentCover` 全屏模态；不依赖 UI 组件的场景用 `openBindSheet`/`updateBindSheet`/`closeBindSheet` |
| 菜单/气泡 | `ui/arkts-menu-overview.md`、`ui/arkts-popup-overview.md` | `bindMenu`/`bindContextMenu` + `Menu`；`bindPopup` 或 `openPopup`（需有效 `TargetInfo`） |

**AlertDialog**（`ts-methods-alert-dialog-box.md` 示例1，节选）

```ts
Button('one button dialog')
  .onClick(() => {
    this.getUIContext().showAlertDialog(
      {
        title: 'title',
        message: 'text',
        autoCancel: true,
        alignment: DialogAlignment.Bottom,
        offset: { dx: 0, dy: -20 },
        gridCount: 3,
        confirm: { value: 'button', action: () => { console.info('Button-clicking callback'); } },
        cancel: () => { console.info('Closed callbacks'); },
        onWillDismiss: (dismissDialogAction: DismissDialogAction) => {
          if (dismissDialogAction.reason === DismissReason.PRESS_BACK) { dismissDialogAction.dismiss(); }
          if (dismissDialogAction.reason === DismissReason.TOUCH_OUTSIDE) { dismissDialogAction.dismiss(); }
        }
      }
    )
  })
  .backgroundColor(0x317aff)
```

**CustomDialog**（`ts-methods-custom-dialog-box.md` 示例1，节选）

```ts
@CustomDialog
struct CustomDialogExample {
  controller?: CustomDialogController;
  cancel: () => void = () => {}
  confirm: () => void = () => {}

  build() {
    Column() {
      Text('Change text').fontSize(20).margin({ top: 10, bottom: 10 })
      TextInput({ placeholder: '', text: this.textValue }).height(60).width('90%')
        .onChange((value: string) => { this.textValue = value; })
      Flex({ justifyContent: FlexAlign.SpaceAround }) {
        Button('cancel').onClick(() => { if (this.controller != undefined) { this.controller.close(); this.cancel(); } })
          .backgroundColor(0xffffff).fontColor(Color.Black)
        Button('confirm').onClick(() => { if (this.controller != undefined) { this.controller.close(); this.confirm(); } })
          .backgroundColor(0xffffff).fontColor(Color.Red)
      }.margin({ bottom: 10 })
    }.borderRadius(10)
  }
}

@Entry
@Component
struct CustomDialogUser {
  @State textValue: string = ''
  dialogController: CustomDialogController | null = new CustomDialogController({
    builder: CustomDialogExample({ cancel: () => { this.onCancel(); }, confirm: () => { this.onAccept(); },
      textValue: this.textValue, inputValue: this.inputValue }),
    autoCancel: true,
    onWillDismiss: (dismissDialogAction: DismissDialogAction) => {
      if (dismissDialogAction.reason == DismissReason.PRESS_BACK) { dismissDialogAction.dismiss(); }
    },
  })
}
```

**ActionSheet**（`ts-methods-action-sheet.md` 示例1，节选）

```ts
this.getUIContext().showActionSheet({
  title: 'ActionSheet title',
  subtitle: 'ActionSheet subtitle',
  message: 'message',
  autoCancel: true,
  confirm: { defaultFocus: true, value: 'Confirm button', action: () => { console.info('Get ActionSheet handled'); } },
  cancel: () => { console.info('ActionSheet canceled'); },
  alignment: DialogAlignment.Bottom,
  offset: { dx: 0, dy: -10 },
  sheets: [
    { title: 'apples', action: () => { console.info('apples'); } },
    { title: 'bananas', action: () => { console.info('bananas'); } }
  ]
})
```

**Toast**（`ui/arkts-create-toast.md`，节选）

```ts
import { promptAction } from '@kit.ArkUI';

Button('Toast of the DEFAULT type')
  .fontSize(20).fontWeight(FontWeight.Bold)
  .onClick(() => {
    try {
      this.getUIContext().getPromptAction().showToast({
        message: 'ok, I am DEFAULT toast',
        duration: 2000,
        showMode: promptAction.ToastShowMode.DEFAULT,
        bottom: 80
      });
    } catch (error) {
      let message = (error as BusinessError).message;
    }
  })
```

> 层级与选型（`ui/arkts-dialog-overview.md`）：Overlay 浮层、弹窗、模态、带 Order 的 Overlay 都挂载在 Root 节点下，按层级数字逐层显示；「多个弹窗组件先后弹出时，后弹出的组件的层级高于先弹出的层级，退出时按层级从高到低逐次退出」；支持页面级能力的当前只有 Dialog 与 `bindSheet`；PC/2in1 可用 `showInSubWindow`（自定义弹窗为 `showInSubwindow`）显示到主窗外。

---

## 五、ArkUI 布局体系

本章所有属性名、枚举值、接口签名均取自官方文档（ui/arkts/layout-development/*` 与 `reference/apis-arkui/arkui-ts/ts-container-*.md`），每段示例后标注来源文件；官方文档未收录的写法一律不写。

### 5.1 布局能力全景

官方《布局概述》给出的选择依据（表内容摘自 `ui/arkts-layout-development-overview.md`「如何选择布局」），右列关键属性由后续小节逐一落实。

| 布局方式 | 适用场景（文档原文要义） | 关键属性 / 接口 |
| --- | --- | --- |
| 线性布局 Row、Column | 布局内子元素超过 1 个且能线性排列时优先考虑 | `space`、`justifyContent(FlexAlign.*)`、`alignItems`、`reverse`、`layoutWeight`、`Blank` |
| 层叠布局 Stack | 需要堆叠效果；堆叠不占用其他子组件布局空间（如 Panel 弹出覆盖） | `StackOptions.alignContent`、`alignContent(value)`、`zIndex` |
| 弹性布局 Flex | 与线性布局类似，区别在于默认能使子组件压缩或拉伸；需计算拉伸/压缩比例时优先 | `FlexOptions{direction,wrap,justifyContent,alignItems,alignContent,space}`、`flexGrow/flexShrink/flexBasis` |
| 相对布局 RelativeContainer | 二维空间布局，锚点规则可天然支持压缩、拉伸、堆叠或多行；元素分布复杂或线性布局嵌套过深时推荐 | `alignRules`、`id`、`__container__`、`guideLine`、`barrier`、`bias`/`offset` |
| 栅格布局 GridRow、GridCol | 多设备通用辅助定位工具；不同于网格布局固定的空间划分，可实现不同设备下不同布局 | `columns`、`breakpoints`、`gutter`、`direction`、`span`、`offset`、`order`、`onBreakpointChange` |
| 动态布局 DynamicLayout | 运行时切换布局算法且保持子组件状态不变（横竖屏切换、瀑布流/标签云等自定义布局）。从 API version 24 开始支持 | `DynamicLayout(algorithm: LayoutAlgorithm)` |
| 选项卡 Tabs | 一个页面内快速切换视图，精简单次信息量 | `barPosition`、`vertical`、`barWidth`、`TabContent().tabBar()` |

同文件把布局元素拆成四层：**组件区域**（`width`/`height`）→ **组件内容区**（组件区域减去 `border`）→ **组件内容**（内容本身大小，与内容区不一致时由 `align` 决定对齐）→ **组件布局边界**（组件区域加 `margin`）。对子元素的约束分四类：拉伸用 `flexGrow`/`flexShrink`；缩放用 `aspectRatio`，公式 `aspectRatio = width / height`；占比用百分比或 `layoutWeight`；隐藏用 `displayPriority` 按预设显示优先级随容器尺寸变化显示或隐藏。

### 5.2 线性布局 Row / Column

`Row` 子元素按水平方向排列，`Column` 按垂直方向排列；主轴即排列方向，交叉轴为其垂直方向（源：`ui/arkts-layout-development-linear.md`）。

**间距** `space` 设置排列方向上的等间距；**主轴对齐** `justifyContent(FlexAlign.*)` 默认 `FlexAlign.Start`，另有 `Center`、`End`、`SpaceBetween`（首尾贴边、间距均分）、`SpaceAround`（两端间距是中间的一半）、`SpaceEvenly`（所有间距相同）。

```typescript
Column({ space: 20 }) {
  Row().width('90%').height(50).backgroundColor(0xF5DEB3)
  Row().width('90%').height(50).backgroundColor(0xD2B48C)
}.width('100%').height(300).justifyContent(FlexAlign.SpaceBetween)
```

**交叉轴对齐** `alignItems`：`Column` 取 `HorizontalAlign.Start/Center/End`（默认 Center），`Row` 取 `VerticalAlign.Top/Center/Bottom`（默认 Center）。`alignSelf` 控制单个子元素在交叉轴的对齐，**优先级高于 `alignItems`**，设置后在该子元素上覆盖 `alignItems`。

**反转** `reverse(isReversed: Optional<boolean>)`（API 12+，默认值 true）。`Column` 文档补充：通用属性 `direction` 只改变交叉轴、不改主轴，因此与 `reverse` 互不影响；`Row` 文档补充：若同时设置 `direction`，`reverse(true)` 总在 `direction` 生效结果上再反转一次（源：`reference/arkui-ts/ts-container-column.md`、`..._ts-container-row.md`）。

**自适应**：主轴填充用 `Blank()` 自动吃掉空白；父容器尺寸确定时用 `layoutWeight` 自适应占满剩余空间；或用百分比固定占比。

```typescript
Row() {
  Text('Bluetooth').fontSize(18)
  Blank()
  Toggle({ type: ToggleType.Switch, isOn: true })
}.width('100%').padding({ left: 12 })

Row() {
  Column() {}.layoutWeight(1).height('100%')
  Column() {}.layoutWeight(2).height('100%')
  Column() {}.layoutWeight(3).height('100%')
}.height('30%')
```

> 源：`ui/arkts-layout-development-linear.md`（BlankExample、LayoutWeightExample 两段原样摘录）。官方告诫：线性布局嵌套层数过深或组件数过多会产生额外开销，建议谨慎使用。

### 5.3 弹性布局 Flex

`Flex(value?: FlexOptions)`，`FlexOptions` 六字段的官方默认值（源：`reference/arkui-ts/ts-container-flex.md`）：

| 字段 | 类型 | 默认值 |
| --- | --- | --- |
| direction | FlexDirection | `FlexDirection.Row`（另有 RowReverse/Column/ColumnReverse） |
| wrap | FlexWrap | `FlexWrap.NoWrap`（另有 Wrap/WrapReverse；NoWrap 下子元素宽度总和超父则被压缩宽度） |
| justifyContent | FlexAlign | `FlexAlign.Start` |
| alignItems | ItemAlign | `ItemAlign.Start`（示例出现 `ItemAlign.Auto`/`Start`/`Center`） |
| alignContent | FlexAlign | `FlexAlign.Start`，**仅在 wrap 为 Wrap 或 WrapReverse 下生效** |
| space | FlexSpaceOptions (12+) | `{main: LengthMetrics.px(0), cross: LengthMetrics.px(0)}`；为负数、百分比或 justifyContent 设为三种 Space* 时不生效 |

子元素侧伸缩属性（源：`ui/arkts-layout-development-flex-layout.md`「自适应拉伸」）：`flexBasis` 为主轴基准尺寸，设置了则占用空间取该值、未设置则取 `width/height`，且 `flexBasis(100)` 会覆盖 `width(200)`；`flexGrow` 按剩余空间比例分配拉伸（文档算例：父 360vp、三子元素各 100vp 加左右 padding 20vp、总和 320vp，剩余 40vp 按 `flexGrow` 占比分配，未设置的子元素不参与）；`flexShrink` 为空间不足时的压缩比例。

与 `Column/Row` 的区别，官方在 Flex 参考页「说明」中写明三条：① Flex 渲染存在**二次布局过程**，对性能有严格要求的场景建议用 Column、Row 代替；② Flex 主轴不设置长度时**默认撑满父容器**（若含设置 `position` 的子组件则不撑满），Column/Row 主轴不设长度时**默认跟随子节点大小**；③ Flex、Column、Row 在无子节点且不设宽高时默认宽高为 -1，主轴长度可设为 `auto` 自适应子组件，此时受 `constraintSize` 与父容器最大最小长度限制且 `constraintSize` 优先级更高。

```typescript
Flex({
  direction: FlexDirection.Row, wrap: FlexWrap.NoWrap,
  justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Center
}) {
  Text('1').width('30%').height(50)
  Text('2').width('30%').height(50)
}.height(70).width('90%')
```

### 5.4 层叠布局 Stack

`Stack(options?: StackOptions)`，子组件按顺序依次入栈、**后一个覆盖前一个**；`alignContent` 默认 `Alignment.Center`，支持九种对齐（`Alignment.TopStart` 等）。`alignContent` 属性与通用属性 `align` 同时设置时**后设置的生效**；与构造入参同时设置时**属性生效**（源：`reference/arkui-ts/ts-container-stack.md`）。

```typescript
Stack({ alignContent: Alignment.TopStart }) {
  Text('Stack').width('90%').height('100%').align(Alignment.BottomEnd)
  Text('Item 1').width('70%').height('80%').align(Alignment.BottomEnd)
}.width('100%').height(150)
```

Z 序：兄弟组件显示层级由 `zIndex` 改变，值越大层级越高；层叠布局中若后面的子元素尺寸大于前面的，前面子元素会**完全隐藏**，此时改 `zIndex` 可将其展示出来。官方提示：过多嵌套组件数会导致性能劣化，部分场景可直接用组件属性或系统 API 能力替代层叠效果（源：`ui/arkts-layout-development-stack-layout.md`）。

### 5.5 相对布局 RelativeContainer

三个概念（源：`ui/arkts-layout-development-relative-layout.md`）：**参考边界**（水平 `left/middle/right`，只设 `left`+`middle` 生效；垂直 `top/center/bottom`，只设 `top`+`center` 生效）、**锚点**（父容器、辅助线、屏障或其他子元素）、**对齐位置**（`HorizontalAlign.Start/Center/End`、`VerticalAlign.Top/Center/Bottom`）。

> 父容器标识默认为 `__container__`，其他子元素必须用 `id` 设置组件标识才能被引用为锚点；`guideline`/`barrier` 的 id 需全局唯一，重复时优先级为 组件 > guideline > barrier。组件间锚点不得形成依赖循环，否则子组件缺乏定位基准、最终无法绘制。

```typescript
RelativeContainer() {
  Row() { Text('row1') }
    .alignRules({
      top: { anchor: '__container__', align: VerticalAlign.Top },
      left: { anchor: '__container__', align: HorizontalAlign.Start }
    }).id('row1')
  Row() { Text('row3') }
    .alignRules({
      top: { anchor: 'row1', align: VerticalAlign.Bottom },
      left: { anchor: '__container__', align: HorizontalAlign.Start }
    }).id('row3')
  Row() { Text('row4') }
    .alignRules({
      top: { anchor: 'row3', align: VerticalAlign.Bottom },
      left: { anchor: 'row1', align: HorizontalAlign.End },
      right: { anchor: '__container__', align: HorizontalAlign.End },
      bottom: { anchor: '__container__', align: VerticalAlign.Bottom }
    }).id('row4')
}.width(300).height(300).border({ width: 2, color: '#6699FF' })
```

对齐后位置不足时可加偏移 `offset({x, y})`；**从 API Version 11 起官方新增 `Bias` 对象，建议 11+ 版本用 bias 设置额外偏移**。注意「当使用 offset 调整位置的组件作为锚点时，对齐位置为设置 offset 之前的位置」。

**辅助线** `guideLine(value: Array<GuideLineStyle>)`：容器内虚拟的额外水平/垂直锚点，避免逐组件写重复偏移。垂直线用 `Axis.Vertical`、水平线用 `Axis.Horizontal`；`position` 用 `start`/`end` 指定距容器左侧（或顶部）的距离，两者冲突时**仅 start 生效**；容器某方向尺寸为 `auto` 时该方向只能使用 `start`（不允许百分比）。

```typescript
RelativeContainer() {
  Row().width(100).height(100)
    .alignRules({ left: { anchor: 'guideline1', align: HorizontalAlign.End },
                  top: { anchor: 'guideline2', align: VerticalAlign.Top } }).id('row1')
}
.width(300).height(300)
.guideLine([{ id: 'guideline1', direction: Axis.Vertical, position: { start: 50 } },
  { id: 'guideline2', direction: Axis.Horizontal, position: { start: 50 } }])
```

**屏障** `barrier(value: Array<BarrierStyle>)`（API 12+）：基于 `referencedId` 一组组件的实际位置，计算它们在特定方向上的公共最远边界，**会随参照组件位置变化自动更新**（与静态 guideline 相对）。方向取 `BarrierDirection.LEFT/RIGHT/TOP/BOTTOM`；垂直方向（TOP、BOTTOM）的屏障只能作水平锚点，作垂直锚点时值为 0，水平方向（LEFT、RIGHT）反之。

```typescript
RelativeContainer() {
  Text('outer 1').alignRules({
    top: { anchor: 'barrier_bottom', align: VerticalAlign.Top },
    left: { anchor: 'barrier_left', align: HorizontalAlign.Start }
  })
}.barrier([
  { id: 'barrier_left', direction: BarrierDirection.LEFT, referencedId: ['item1', 'item2', 'item3'] },
  { id: 'barrier_bottom', direction: BarrierDirection.BOTTOM, referencedId: ['item1', 'item2', 'item3'] },
])
```

### 5.6 栅格布局 GridRow / GridCol

断点以设备水平宽度（单位 vp）划分，官方默认四档（源：`ui/arkts-layout-development-grid-layout.md`）：

| 断点 | 取值范围（vp） | 设备描述 |
| --- | --- | --- |
| xs | [0, 320) | 最小宽度类型设备 |
| sm | [320, 600) | 小宽度类型设备 |
| md | [600, 840) | 中等宽度类型设备 |
| lg | [840, +∞) | 大宽度类型设备 |

`BreakPoints` 最多支持 6 个断点（追加 `xl` 特大、`xxl` 超大），默认断点数组为 `["320vp", "600vp", "840vp"]`；自定义传入单调递增数组 `[n0,n1,n2,n3,n4]` 时 xs=[0,n0)、sm=[n0,n1)…xxl=[n4,INF)。断点切换参照物可取 `reference: BreakpointsReference.WindowSize`（以应用窗口宽度为参照，比屏幕宽度更通用）。

```typescript
GridRow({
  columns: { xs: 2, sm: 4, md: 8, lg: 12, xl: 12, xxl: 12 },
  breakpoints: { value: ['100vp', '200vp', '300vp', '400vp', '500vp'],
    reference: BreakpointsReference.WindowSize }
}) {
  ForEach(this.bgColors, (color: ResourceColor, index?: number | undefined) => {
    GridCol({ span: 1 }) { Row() { Text(`${index}`) }.width('100%').height('50vp') }
      .backgroundColor(color)
  })
}.height(200).onBreakpointChange((breakpoint) => { this.currentBp = breakpoint })
```

- `columns`：number 或 `GridRowColumnOption`。**API 20 之前默认 12 列；API 20 及以后默认 `{xs:2, sm:4, md:8, lg:12, xl:12, xxl:12}`**。
- `direction`：`GridRowDirection.Row`（默认，从左往右）/ `GridRowDirection.RowReverse`；`gutter`：number 同时设水平垂直间距，`GutterOption` 用 `{x:20, y:50}` 分别设置。
- `GridCol` 的 `span`（占列数）、`offset`（偏移列数）、`order`（序号）可用构造参数或同名属性设置，类型支持 number 与 `GridColColumnOption`（六断点分别取值）。order 规则：未设置或相同则按代码顺序；部分设置时**未设置 order 的依次排前**，已设置的按数值从小到大。
- 栅格可嵌套，内层 `GridRow` 的列数按上一层父 `GridCol` 的空间再划分。文档结论：明确各断点的 `columns`、`margin`、`gutter` 及 `span` 即可确定最终布局，无需关心设备类型与横竖屏状态。

### 5.7 网格 Grid、列表 List、瀑布流 WaterFlow

**Grid**（源：`ui/arkts-layout-development-create-grid.md`）：子组件必须是 `GridItem`。`rowsTemplate`/`columnsTemplate` 是「空格分隔的 数字+fr」字符串，fr 个数即行列数，数值决定该行列占比，如 `'1fr 2fr 1fr'`。三种情形：行列占比同时设置 → 只展示固定行列数元素且**不可滚动**（官方推荐）；只设一个 → 超出可滚动（设 columnsTemplate 滚动方向为垂直，设 rowsTemplate 为水平）；都不设 → 行列数由布局方向与单个网格宽高共同决定，超出部分不展示且不可滚动。设置两个 template 时 `layoutDirection`、`maxCount`、`minCount`、`cellLength` **不生效**；`layoutDirection(GridDirection.Row/Column)` 仅在不设 template 时生效。跨行跨列用 `GridLayoutOptions`：`regularSize: [1, 1]` + `onGetRectByIndex` 返回 `[rowStart, columnStart, rowSpan, columnSpan]`（标号从 0 开始）；`irregularIndexes`/`onGetIrregularSizeByIndex` 仅用于只设一个 template 的 Grid。间距用 `columnsGap(10)`/`rowsGap(15)`。

**List**：子组件必须是 `ListItemGroup` 或 `ListItem`。`ListOptions` 关键参数：`space`（主轴间隔，number 时单位 vp，默认 0）、`initialIndex`（默认 0）、`scroller: Scroller`（**不允许与 ArcList/List/Grid/Scroll/WaterFlow 绑定同一控制器对象**）。

```typescript
List({ space: 20, scroller: this.listScroller }) { /* ListItemGroup / ListItem */ }
  .cachedCount(3)
  .listDirection(Axis.Horizontal)            // 默认 Axis.Vertical
  .lanes(2)                                  // 或 LengthConstrain {minLength:200, maxLength:300}
  .alignListItem(ListItemAlign.Center)       // 默认 ListItemAlign.Start
  .divider({ strokeWidth: 1, color: '#ffe9f0f0', startMargin: 60, endMargin: 10 })
  .sticky(StickyStyle.Header)                // 配合 ListItemGroup，默认 StickyStyle.None
  .onScrollIndex((firstIndex: number) => { /* ... */ })
  .onReachEnd(() => { /* 触底加载 */ })
```

分组与粘性标题：`ListItemGroup({ header: this.itemHead('A') })`；`sticky` 可设为 `StickyStyle.Header | StickyStyle.Footer` 以同时生效（API 20 起另有 `StickyStyle.BOTH`）。侧滑：`ListItem().swipeAction({ end: { builder: () => { this.itemEnd(this.index) } } })`，`start` 为右滑起始端滑出组件、`end` 为左滑尾端滑出组件。下拉刷新官方明确推荐用 `Refresh` 组件，而非手写触摸事件。

**WaterFlow**（源：`ui/arkts-layout-development-create-waterflow.md`）：纵向用 `columnsTemplate` 设列数、横向用 `rowsTemplate` 设行数；纵向排布规则是第一行从左到右，从第二行起每个子节点放在**当前总高度最小**的列，等高则从左到右填充。动态切列数建议 `layoutMode: WaterFlowLayoutMode.SLIDING_WINDOW` 以获得更快转换。

```typescript
WaterFlow({ footer: this.itemFoot(), layoutMode: WaterFlowLayoutMode.SLIDING_WINDOW }) {
  LazyForEach(this.dataSource, (item: number) => {
    FlowItem() { ReusableFlowItem({ item: item }) }
      .width('100%').aspectRatio(this.itemHeightArray[item % 100] / this.itemWidthArray[item % 100])
  }, (item: string) => item)
}
.columnsTemplate('1fr '.repeat(this.columns)).layoutWeight(1)
.onScrollIndex((first: number, last: number) => { if (last + 20 >= this.dataSource.totalCount()) { /* 提前新增数据 */ } })
```

文档对无限滚动有明确告诫：应在数据末尾追加元素，并用 `onDataAdd` 通知，**不可**直接改数据源后用 `onDataReloaded` 触发整体重载——各子节点高度不一致、下面节点依赖上面节点，整体重载会触发整个瀑布流重新计算布局导致卡顿；等到 `onReachEnd` 才加载会有明显停顿，故推荐在 `onScrollIndex` 中提前若干条加载。

### 5.8 Scroll / Swiper / Tabs / Refresh

- **Scroll**：`Scroll(scroller?: Scroller)`，常用 `.scrollable(ScrollDirection.Vertical)`（默认 Vertical，枚举另有 Horizontal、Free(9 起废弃)、None、`FREE`(20+)）、`.scrollBar(BarState.On)`、`.scrollBarColor(Color.Gray)`、`.scrollBarWidth(10)`、`.friction(0.6)`、`.edgeEffect(EdgeEffect.None)`、`.onWillScroll((xOffset, yOffset, scrollState) => {})`。`Scroller` 同一控制器不可控多个容器；`scrollTo(options: ScrollOptions)` 字段为 `xOffset`/`yOffset`（不支持百分比）与 `animation`（默认 `{duration: 1000, curve: Curve.Ease, canOverScroll: false}`）；`scrollToIndex(value, smooth?, align?: ScrollAlign, options?)` 仅支持 ArcList/Grid/List/WaterFlow。控制器与组件的绑定发生在组件创建阶段，故在自定义组件 `aboutToAppear` 内调用滚动方法不生效，须在滚动组件的 `onAppear` 之后调用。
- **Swiper**：`Swiper(controller?: SwiperController)`，示例属性链 `.index(1).autoPlay(true).interval(4000).loop(true).duration(1000).itemSpace(5).cachedCount(2).indicator(true).indicatorInteractive(true).prevMargin(35)`；`indicator` 可为 `DotIndicator`（圆点，默认）、`DigitIndicator`（数字）、`boolean`（默认 true）或 `IndicatorComponentController`；另有 `vertical`、`effectMode`、`displayCount`、`nextMargin`、`displayMode`、`disableSwipe`、`nestedScroll`。控制器方法 `showNext()`、`showPrevious()`、`changeIndex()`、`finishAnimation()`、`preloadItems()`。
- **Tabs**：`Tabs(options?: TabsOptions)` 支持 `barPosition`（`BarPosition.Start` 默认 / `End`）、`index`、`controller`；属性 `vertical(value: boolean)`（是否纵向 Tab）、`barWidth(value: Length)`（未设置 SubTabBarStyle/BottomTabBarStyle 且 vertical 为 false 时默认取 Tabs 宽度，vertical 为 true 时默认 56vp；BottomTabBarStyle 且 vertical 为 true 时默认 96vp）、`barHeight`、`animationDuration`；子组件 `TabContent().tabBar(SubTabBarStyle.of(this.text))`，底部导航用 `BottomTabBarStyle`。
- **Refresh**：真实写法是双向绑定 `$$`，`refreshing` 默认 false；`promptText`（12+）设置有效时 `refreshOffset` 默认由 64vp 变 96vp；API 12 起建议用 `refreshingContent` 替代 `builder` 自定义刷新区域，以避免刷新中自定义组件销毁重建导致动画中断；`friction` 自 API 11 废弃，建议用 `pullDownRatio` 替代。

```typescript
@State isRefreshing: boolean = false;
Refresh({ refreshing: $$this.isRefreshing, promptText: this.promptText }) {
  List() { /* ... */ }
}.onRefreshing(() => { /* 进入刷新状态时触发 */ })
 .onStateChange((refreshStatus: RefreshStatus) => { console.info('state is ' + refreshStatus) })
```

> 源：`ts-container-scroll.md`、`ts-container-swiper.md`、`ts-container-tabs.md`、`ts-container-refresh.md`

### 5.9 尺寸与单位

ArkUI 提供 4 种像素单位，**采用 vp 为基准数据单位**（下表为 `reference/arkui-ts/ts-pixel-units.md` 原文）：

| 单位 | 官方定义原文 |
| --- | --- |
| px | 屏幕物理像素单位。 |
| vp | 屏幕密度相关像素，根据屏幕像素密度转换为屏幕物理像素，当数值不带单位时，默认单位 vp。 |
| fp | 字体像素，与 vp 类似适用屏幕密度变化，随系统字体大小设置变化。 |
| lpx | 视窗逻辑像素单位，lpx 单位为实际屏幕宽度与逻辑宽度（通过 designWidth 配置）的比值，designWidth 默认值为 720。当 designWidth 为 720 时，在实际宽度为 1440 物理像素的屏幕上，1lpx 为 2px 大小。 |

换算接口 `vp2px/px2vp/fp2px/px2fp/lpx2px/px2lpx` **自 API 18 起废弃**，官方建议先 `getUIContext()` 取 UIContext 实例再调用 `UIContext.vp2px` 等以绑定实例，避免「UI 上下文不明确」。

尺寸能力：`width`/`height`/`size({width, height})`/`padding`/`margin`/`safeAreaPadding`/`layoutWeight`/`constraintSize`（源：`reference/arkui-ts/ts-universal-attributes-size.md`）。`layoutWeight(value: number|string)` 默认 0，**仅在 Row/Column/Flex 中生效**，让生效值大于 0 的子元素按权重从主轴剩余空间分配尺寸、分配时忽略元素本身尺寸；一旦容器内有子元素设置了大于 0 的 layoutWeight，所有子元素**不再基于 `flexShrink` 和 `flexGrow` 布局**。`constraintSize(value: ConstraintSizeOptions)` 默认 `{minWidth:0, maxWidth:Infinity, minHeight:0, maxHeight:Infinity}`、单位 vp，**优先级高于 width/height，也高于 LayoutPolicy**（API 15+ 的尺寸策略 `matchParent`/`wrapContent`）。`aspectRatio` 指定宽高比实现缩放，但 `EmbeddedComponent` 明确不支持该属性。

百分比参照关系（overview 原表的结论）：父组件设置了宽或高、且祖先组件未指定其父组件宽高时，参考**父组件**宽高；一旦祖先组件指定了父组件宽高，则一律参考**祖先组件指定的那个父组件**宽高；父组件未设宽高且祖先也未指定时，参考的是「父组件的百分比参照」，该参照传递自祖先组件。定位属性 `position`（绝对定位：设置后不影响父容器布局，仅在绘制时调整位置，对不同尺寸设备适应性较差）与 `offset`（相对定位：不脱离文档流，原位置保留）见 overview「布局位置」。

### 5.10 自适应与响应式

官方推荐的媒体查询写法（源：`ui/arkts-layout-development-media-query.md` 场景示例一，Stage 模型）：

```typescript
import { mediaquery } from '@kit.ArkUI';

@Entry
@Component
struct MediaQueryExample {
  @State text: string = 'Portrait';
  // 当设备横屏时条件成立
  listener: mediaquery.MediaQueryListener =
    this.getUIContext().getMediaQuery().matchMediaSync('(orientation: landscape)');
  aboutToAppear() {
    this.listener.on('change', (mediaQueryResult: mediaquery.MediaQueryResult) => {
      if (mediaQueryResult.matches as boolean) { /* 若设备为横屏状态，更改相应的页面布局 */ }
    });
  }
  aboutToDisappear() { this.listener.off('change'); }   // 解绑注册的回调
}
```

语法为 `[media-type] [media-logic-operations] [(media-feature)]`，媒体类型未写时默认 `screen` 且必须写在开头；逻辑操作符 `and`、`or`、`not`、`only`、逗号 `,`（等同 or），其中 `not`/`only` **必须搭配 screen 使用**；范围操作符 `<=`、`>=`、`<`、`>`。媒体特征包含 `height/min-height/max-height`、`width/min-width/max-width`、`resolution`、`orientation`（portrait/landscape）、`device-height`、`device-width`、`device-type`（default、phone、tablet、tv、car、wearable、2in1）、`round-screen`、`dark-mode`（深色模式为 true）。**比较 height、width 等宽高尺寸时支持 vp 和 px 单位，无单位时默认为 px**。卡片中使用媒体查询只支持 `height`、`width`；`device-width` 当前仅在应用初始化时保存一次，不会随设备宽度变化实时更新。

文档示例二演示横竖屏切换改变 Flex 方向：`@State dir: FlexDirection` 在回调里于 `FlexDirection.Row`/`Column` 间切换，配 `Flex({ direction: this.dir, space: { main: LengthMetrics.vp(10), cross: LengthMetrics.vp(5) } })` 与子项 `layoutWeight(1)`。

与 Web 的对应关系，只列有文档依据的：① 媒体查询的语法结构、`and/or/not/only` 与 `min-/max-` 前缀特征命名同 CSS，但触发方式是 JS 回调判断 `matches` 后改状态变量，而非样式表级联，且无单位默认 px 这一点需注意；② Flex 容器侧字段与 Web flexbox 命名一一对应，但 ArkUI 交叉轴默认 `ItemAlign.Start`、主轴不设长度时撑满父容器（见 5.3 引用），迁移时以官方文档默认值为准；③ `GridRow/GridCol` 的六断点体系与 `onBreakpointChange` 是 ArkUI 自有能力，CSS 无直接对应。

### 5.11 长列表性能

官方对长列表的结论（`ui/arkts-layout-development-create-list.md`「长列表的处理」）原文：

> 循环渲染适用于短列表，当构建具有大量列表项的长列表时，如果直接采用循环渲染方式，会一次性加载所有的列表元素，会导致页面启动时间过长，影响用户体验。因此，推荐使用数据懒加载（LazyForEach）方式实现按需迭代加载数据，从而提升列表性能。

`@Reusable` 的作用在同文件「使用 LazyForEach 创建 ListItem」一节给出：

> 当 List 组件滑动时，进入预加载及显示区域的 ListItem 将被创建与布局，创建 ListItem 过程中，若 ListItem 内部包含 @Reusable 标记的自定义组件，则会优先从缓存池中复用。滑出预加载及显示区域的 ListItem 将被销毁，其内部若含 @Reusable 标记的自定义组件，则会被回收并加入缓存池。

即 **LazyForEach 决定「创建多少」，@Reusable 决定「创建方式是新建还是复用」**；`ReusableFlowItem`/`ReusableListItem` 在 `aboutToReuse(params: Record<string, number>)` 里重新赋值状态。配合 `cachedCount`：懒加载只预加载显示区域外 `cachedCount` 的内容，无论是否懒加载都只布局「显示区域 + 上下各 cachedCount」，增大 cachedCount 会增大 UI 的 CPU、内存开销；垂直列表下 `ListItemGroup` 内部 ListItem 会计入行数，组内无 ListItem 则整组算一行，LazyForEach 嵌套 ListItemGroup 时按「组」上下各创建 cachedCount 个。

---

## 六、消息事件、手势与动画

### 6.1 事件体系分三层

| 层 | 典型 API | 参数 | 用途 |
| --- | --- | --- | --- |
| 通用事件 | `onClick` / `onTouch` / `onKeyEvent` / `onMouse` / `onHover` / `onSizeChange` / `onAreaChange` / `onVisibleAreaChange` | `ClickEvent`、`TouchEvent`、`KeyEvent`、`MouseTouchEvent`、`HoverEvent` | 语义化交互 |
| 手势事件 | `.gesture(TapGesture())`、`PanGesture`、`PinchGesture`、`RotationGesture`、`LongPressGesture`、`SwipeGesture` | `GestureEvent` | 带阈值/方向的交互；**点击/长按本质是手势，不是内置事件** |
| 拖拽事件 | `draggable(true)` + `onDragStart` / `onDrop` / `onDragEnter` / `onDragLeave` / `onDragEnd` | `DragEvent`、`UniformTransition` | 应用内外拖放 |

```ts
Text('hello')
  .onClick((event: ClickEvent) => {
    // event.x / event.y（组件内坐标）、event.displayX/displayY（屏幕坐标）、event.source
  })
  .onTouch((event: TouchEvent) => {
    switch (event.type) {
      case TouchType.Down: case TouchType.Move: case TouchType.Up: case TouchType.Cancel:
        const t = event.touches[0];      // TouchObject[]：location/priorityDisplayId/force
        console.log(t.displayX, t.displayY, event.timestamp);
    }
  })
  .onKeyEvent((event: KeyEvent) => {     // KeyEvent.type: KeyType.Down/Up/LongPress，keyCode、keyText
    if (event.keyCode === 2012 && event.type === KeyType.Down) { /* Enter */ }
  })
  .onVisibleAreaChange([0.0, 1.0], (isVisible: boolean, currentRatio: number) => {
    // 曝光埋点常用
  })
  .onSizeChange((oldValue: SizeOptions, newValue: SizeOptions) => { })
```

`TouchEvent` 关键字段（`ts-uicommonevent.md` / `ts-universal-events-touch.md`）：`type`(TouchType)、`touches`(全部触点)、`changedTouches`(变化触点)、`target`(目标组件 info：id/x/y/globalX/globalY)、`timestamp`、`source`(SourceType 手指/鼠标)、`mode`(TouchMode)。

触摸 vs 手势的优先级与拦截：`hitTestBehavior(HitTestMode.{Default, Block, Transparent, None})` 控制自身与子节点是否参与命中测试（`Block` = 阻断子节点，`Transparent` = 自己响应但兄弟/父继续响应）；`event.stopPropagation()` 在 `ClickEvent`/`TouchEvent` 里阻止继续向上冒泡。手势之间的竞争由 `gesture`/`priorityGesture`/`parallelGesture` 与 `GestureGroup` 决定，不必碰触摸层。嵌套滚动用 `nestedScroll({ scrollForward: NestedScrollMode.PARENT_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST })`。

### 6.2 手势绑定与组合

```ts
Text('拖我')
  .gesture(
    PanGesture({ direction: PanDirection.Vertical, distance: 5 })
      .onActionStart((e: GestureEvent) => { })
      .onActionUpdate((e: GestureEvent) => {
        // e.fingerList[0].globalX/globalY；e.offsetX/offsetY；e.velocityX/velocityY/velocity
      })
      .onActionEnd((e: GestureEvent) => { })
      .onActionCancel(() => { })
  )
  .priorityGesture(TapGesture({ count: 2 }).onAction(() => { }))   // 父优先于子手势
  .parallelGesture(PinchGesture().onActionUpdate((e) => { /* e.scale */ }))  // 并行识别
  // 也可 .gesture(GestureGroup(GestureMode.Exclusive, a, b))：Exclusive/Sequence/Parallel
```

绑定方法的区别（ui/arkts-gesture-events-binding.md`）：`gesture()` 常规绑定；`priorityGesture()` 与子组件手势竞争时父组件优先；`parallelGesture()` 允许父子同时响应。`gesture(..., mask: GestureMask)` 可临时屏蔽子节点手势（`GestureMask.Normal` / `GestureMask.IgnoreInternal`）。注意：`gesture/priorityGesture/parallelGesture` 不支持用三目运算符切换手势绑定。

`GestureEvent` 字段随手势类型不同：`PinchGesture` → `scale`、`centerX/centerY`；`RotationGesture` → `angle`、`angleAxis`；`PanGesture` → `offsetX/offsetY`、`fingerList`、`velocity`；`SwipeGesture` → `direction`、`velocity`。长按/点击的 `onAction` 无 `fingerList`（部分场景回调参数为 `undefined`，文档示例里写 `(event: GestureEvent|undefined)`）。

### 6.3 键盘与焦点

```ts
// 焦点：可获焦组件默认参与焦点链
Button('ok').focusable(true).onFocus(() => {}).onBlur(() => {})
this.getUIContext().getFocusController().requestFocus('componentId');   // clearFocus() 取消
// 遥控器/键盘方向导航
Column().focusable(true).defaultFocus(true)   // 方向键在父容器上统一用 .onKeyEvent 承接

// 软键盘避让：弹窗/输入类接口有 keyboardAvoidMode 参数（枚举 KeyboardAvoidMode.DEFAULT / NONE）
this.getUIContext().getPromptAction().openCustomDialog({
  builder: this.myBuild, autoCancel: true,
  keyboardAvoidMode: KeyboardAvoidMode.NONE      // 不希望被键盘顶起时设 NONE
});

// 快捷键
Button('复制')
  .keyboardShortcut('c', [ModifierKey.CTRL])            // 第二个参数是修饰键数组
  .onExecuteShortcutEvent(() => { /* 快捷键命中 */ })

// 输入框回车键、是否拦截软键盘
TextInput({ placeholder: '输入' })
  .enterKeyType(EnterKeyType.Search)
  .onSubmit((enterKey: EnterKeyType, e: SubmitEvent) => {})
  .onNeedSoftkeyboard(() => { return true; })   // API 24+：焦点切换时返回 true 表示保留键盘（键盘接续）
```

### 6.4 动画

**属性动画（隐式）**——改状态值即触发，写在组件上：

```ts
Row().width(this.w).height(100).backgroundColor(Color.Pink)
  .animation({ duration: 300, curve: Curve.EaseInOut, delay: 0, iterations: 1, playMode: PlayMode.Normal })
```

**显式动画**——把「改数据」包进回调。注意全局 `animateTo` 从 API 18 起标记 deprecated，推荐 `this.getUIContext().animateTo()`：

```ts
this.getUIContext().animateTo({
  duration: 800,
  curve: curves.springMotion(0.4, 0.9),      // 物理弹簧曲线
  tempo: 1.0,
  iterations: 1,
  playMode: PlayMode.Normal,
  delay: 0,
  onFinish: () => { }
}, () => {
  this.translateValue = 200;                 // 这里改的所有可动画属性一起动
});
```

**关键帧动画**：`this.getUIContext().keyframeAnimateTo({ iterations: 2 }, [{ duration: 300, curve: Curve.EaseIn, event: () => { this.x = 100 } }, { duration: 300, event: () => { this.x = 0 } }])`。

**动画曲线**：枚举 `Curve.Linear/Ease/EaseIn/EaseOut/EaseInOut/FastOutSlowIn/...`；物理曲线用 `curves.springMotion()`、`curves.interpolatingSpring(initialVelocity, mass, stiffness, damping)`（文档大量使用后者），另有 `curves.cubicBezier()`、`curves.steps()`。

**组件转场（进出场）**——`TransitionEffect` 以函数式组合：

```ts
if (this.show) {
  Column() { Text('转场') }
    .transition(
      TransitionEffect.OPACITY.animation({ duration: 2000, curve: Curve.Ease })
        .combine(TransitionEffect.rotate({ z: 1, angle: 180 }))
        .combine(TransitionEffect.move(TransitionEdge.END))
    )
    // 或不对称：TransitionEffect.asymmetric(enterEffect, exitEffect)
    // 可用：translate(TranslateOptions)、scale(ScaleOptions)、opacity、rotate、move、matrix、blend
}
```

**共享元素转场**：`.geometryTransition('sharedId')` 让两个页面里同一 id 的组件在转场时做形变过渡（Router 场景）；**Navigation 场景推荐自定义 Nav 转场** `customNavContentTransition`（提供 `NavContentTransitionHandler`，可拿到 from/to 的页面信息自己算位移与透明度，文档有完整实现）。

**页面转场（Router）**：`pageTransition` + `PageTransitionEnter/Exit`（`.slide(SlideEffect.End)`、`.opacity(1)`），也可用 `customNavigationTransition` 全局接管。

**蒙层转场**：`bindContentCover(isShow, builder, { modalTransition: ModalTransition.NONE })` 可关掉默认转场（本次抓取的文档只出现 `ModalTransition.NONE`）；`Dialog` 与自定义弹层可配 `transition`。

### 6.5 事件速查表

| 事件 | 触发时机 | 回调参数 |
| --- | --- | --- |
| `onClick` | 单击手势完成 | `ClickEvent`（x/y、displayX/displayY、source、target） |
| `onTouch` | 触点 Down/Move/Up/Cancel | `TouchEvent` |
| `onKeyEvent` | 物理/虚拟按键按下、抬起、长按 | `KeyEvent`（keyCode、keyText、type、isPressed） |
| `onMouse` / `onHover` | 鼠标移动·按下·释放 / 移入移出 | `MouseEvent` / `HoverEvent` |
| `onDragStart` / `onDrop` | 开始拖拽 / 释放到目标 | `(DragEvent, DragItem)` / `DragEvent` |
| `onFocus` / `onBlur` | 焦点获得 / 失去 | `boolean`（`hasFocus: boolean`） |
| `onVisibleAreaChange` | 组件可见比例越过阈值数组中的值 | `(isVisible: boolean, currentRatio: number)` |
| `onAppear` / `onDisAppear` | 组件挂载到内存 / 从内存移除 | 无 |
| `onSizeChange` / `onAreaChange` | 尺寸 / 位置+尺寸变化 | `Size` / `(oldValue, newValue: Area)` |
| `TapGesture.onAction` | 点击（含 count 多击） | `GestureEvent | undefined` |
| `PanGesture.onActionUpdate` | 拖动中 | `GestureEvent`（offsetX/Y、velocityX/Y、fingerList） |
| `PinchGesture.onActionUpdate` | 双指缩放中 | `GestureEvent`（scale、centerX/Y） |
| `RotationGesture.onActionUpdate` | 双指旋转中 | `GestureEvent`（angle、angleAxis） |

---

## 七、调用系统能力（权限、蓝牙、相机、相册、文件、扫码、支付、推送）

### 7.1 权限体系（一切系统能力的前提）

三步：**静态声明 → 判断/申请 → 处理拒绝**。

```json5
// module.json5 —— user_grant 权限必须写 reason 与 usedScene
{
  "module": {
    "requestPermissions": [
      {
        "name": "ohos.permission.CAMERA",
        "reason": "$string:camera_reason",
        "usedScene": { "abilities": ["EntryAbility"], "when": "inuse" }
      },
      { "name": "ohos.permission.INTERNET" }           // system_grant：安装即授予，无需 reason
    ]
  }
}
```

运行时申请（`security/AccessToken/request-user-authorization.md`）：

```ts
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';
import { bundleManager } from '@kit.AbilityKit';

const permissions: Permissions[] = ['ohos.permission.CAMERA', 'ohos.permission.MICROPHONE'];

async function ensure(ctx: common.UIAbilityContext) {
  const at = abilityAccessCtrl.createAtManager();
  // 先查（也可跳过，requestPermissionsFromUser 内部会判断已授权则不弹窗）
  const info = bundleManager.getBundleInfoForSelfSync(bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_APPLICATION);
  const status = at.checkAccessTokenSync(info.tokenID, 'ohos.permission.CAMERA'); // GrantStatus.PERMISSION_GRANTED/DENIED
  if (status === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) return true;
  const data = await at.requestPermissionsFromUser(ctx, permissions);
  // data.authResults[i]: 0= granted, -1= denied；data.dialogShownResults[i]: 是否真的弹窗了
  return data.authResults.every(r => r === 0);
}

// 被永久拒绝后：拉起权限设置页引导用户手动开启
await at.requestPermissionOnSetting(ctx, permissions);
```

要点（文档原文口径）：
- `user_grant`（相机、麦克风、位置、媒体读写…）需弹窗；`system_grant`（网络、蓝牙开关、振动…）声明即得。
- **同组权限合并成一个弹窗**；跨组会弹多次（`app-permission-group-list.md`）。
- 用户拒绝后系统**不会再自动弹窗**，需引导到设置页或 `requestPermissionOnSetting`。
- **受限权限**（如 `ohos.permission.READ_PASTEBOARD`、`CUSTOMIZE_SAVE_BUTTON`）需在 AGC 申请并通过 ACL 配置（`declare-permissions-in-acl.md`）。
- **免权限的安全组件**：`SaveButton`（保存图片/文件到图库或 Docs，无需 `WRITE_IMAGEVIDEO`）、`PasteButton`（免权限读剪贴板），用户点击即视为授权；另有「一次性授权」`one-time-authorization`（剪贴板、模糊位置等当次生效）。
- 媒体库推荐走 **Picker/安全组件** 而非申请 `READ_IMAGEVIDEO`（见 7.4）。

### 7.2 蓝牙（@kit.ConnectivityKit）

```ts
import { access, ble } from '@kit.ConnectivityKit';
import { BusinessError } from '@kit.BasicServicesKit';

// 1) 开关与状态（ohos.permission.USE_BLUETOOTH 为 system_grant；扫描/连接需 ohos.permission.ACCESS_BLUETOOTH，user_grant）
try {
  access.enableBluetooth();                                  // 打开蓝牙开关
  let state = access.getState();                             // access.BluetoothState: STATE_ON / STATE_OFF / STATE_TURNING_ON ...
  access.on('stateChange', (s: access.BluetoothState) => { });   // 监听开关变化；用完 access.off('stateChange')
} catch (err) {
  console.error('errCode: ' + (err as BusinessError).code + ', message: ' + (err as BusinessError).message);
}

// 2) 扫描：API 15+ 推荐 createBleScanner（应用可发起并管理多路扫描）
let bleScanner: ble.BleScanner = ble.createBleScanner();
const scanFilter: ble.ScanFilter = { name: 'HRBand', serviceUuids: ['0000180D-0000-1000-8000-00805F9B34FB'] };
bleScanner.on('BLEDeviceFind', (scanReport: ble.ScanReport) => {
  // scanReport.results 是 Array<ble.ScanResult>，字段：deviceId / address / deviceName / rssi / connectable / data
  scanReport.results.forEach(r => console.log(r.deviceName, r.rssi, r.deviceId));
});
const scanOptions: ble.ScanOptions = {
  interval: 0,
  dutyMode: ble.ScanDuty.SCAN_MODE_LOW_POWER,
  matchMode: ble.MatchMode.MATCH_MODE_AGGRESSIVE
};
bleScanner.startScan([scanFilter], scanOptions);
// API 14 及以前是单路扫描：ble.on('BLEDeviceFind', (data: Array<ble.ScanResult>) => {}) + ble.startBLEScan([scanFilter], scanOptions)

// 3) 连接 + GATT 读写（入参是扫描结果里的 deviceId 字符串）
let gattClient: ble.GattClientDevice = ble.createGattClientDevice(deviceId);
gattClient.on('BLEConnectionStateChange', (state: ble.BLEConnectionChangeState) => { });
gattClient.connect();
gattClient.getServices().then((services: Array<ble.GattService>) => {
  const char = services[0].characteristics[0];
  gattClient.setCharacteristicChangeNotification(char, true);          // 打开通知
  gattClient.on('BLECharacteristicChange', (c: ble.BLECharacteristic) => { });
  gattClient.readCharacteristicValue(char);
  gattClient.writeCharacteristicValue(char, ble.GattWriteType.WRITE);
});
gattClient.disconnect();
gattClient.close();
```

经典蓝牙走 `connection`（SPP/A2DP），GATT 服务端用 `ble.createGattServer()`（`on('addService')`/`sendResponse`）；广播用 `ble.startAdvertising` + `ble.AdvertiseData`。用完记得 `stopScan()`、`off('BLEDeviceFind')`、`off('BLECharacteristicChange')`。

### 7.3 相机（@kit.CameraKit）

CameraKit 是「组装流水线」：`CameraManager → CameraDevice(CameraInput) → Profile → PreviewOutput/PhotoOutput → Session → commitConfig → run`。

```ts
import { camera } from '@kit.CameraKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { common } from '@kit.AbilityKit';

// 预览面：XComponent 提供 surfaceId
@Entry
@Component
struct CamPage {
  ctl: XComponentController = new XComponentController();
  surfaceId: string = '';
  build() {
    XComponent({ id: 'cam', type: XComponentType.SURFACE, libraryname: '' })
      .onLoad(() => { this.surfaceId = this.ctl.getXComponentSurfaceId(); /* 此处启动相机 */ })
      .width('100%').height('100%')
  }
}

async function start(ctx: common.BaseContext, surfaceId: string) {
  const mgr = camera.getCameraManager(ctx);
  const cameras: Array<camera.CameraDevice> = mgr.getSupportedCameras();   // cameraId/cameraPosition/cameraType/connectionType
  const cap = mgr.getSupportedOutputCapability(cameras[0], camera.SceneMode.NORMAL_PHOTO);
  const input = mgr.createCameraInput(cameras[0]);
  await input.open();

  const preview = mgr.createPreviewOutput(cap.previewProfiles[0], surfaceId);
  const photo = mgr.createPhotoOutput(cap.photoProfiles[0]);
  const session = mgr.createSession(camera.SceneMode.NORMAL_PHOTO) as camera.PhotoSession;
  session.beginConfig();
  session.addInput(input);
  session.addOutput(preview);
  session.addOutput(photo);
  session.commitConfig();
  session.on('error', (e: BusinessError) => { });
  await session.start();

  // 拍照
  photo.on('photoAvailable', (errCode: BusinessError, photo: camera.Photo): void => { /* 从 photo.image 取 buffer 落地保存 */ });
  const settings: camera.PhotoCaptureSetting = {
    quality: camera.QualityLevel.QUALITY_LEVEL_HIGH,
    rotation: camera.ImageRotation.ROTATION_0, mirror: false
  };
  await photo.capture(settings);
  // 释放：session.stop() → input.close() → preview.release() → photo.release() → session.release()
}
```

**免权限/免开发的两条捷径**：
- `cameraPicker`（@kit.CameraKit）：拉起系统相机拍完把结果 URI 给你，**不需要 CAMERA 权限**，可配 `PickerProfile`（`saveUri` 不填则默认存媒体库）。
- 系统图库/文件选择器同理（见 7.4）。

`camera_status` 监听（相机插拔/被占用）：`mgr.on('cameraStatus', (err, info: camera.CameraStatusInfo) => { info.status === camera.CameraStatus.CAMERA_STATUS_APPEAR ... })`。

### 7.4 相册与媒体库（@kit.MediaLibraryKit）

```ts
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { dataSharePredicates } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';

// 1) Picker 方式（推荐：免权限选图）
const picker = new photoAccessHelper.PhotoViewPicker();
const opts = new photoAccessHelper.PhotoSelectOptions();
opts.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_VIDEO_TYPE;
opts.maxSelectNumber = 9;
const result = await picker.select(opts);            // result.photoUris: string[]，uri 形如 file://media/...

// 2) 有 READ_IMAGEVIDEO（受限权限）时用 Helper 查询
const ph = photoAccessHelper.getPhotoAccessHelper(ctx as common.UIAbilityContext);
const predicates = new dataSharePredicates.DataSharePredicates();
predicates.equalTo(photoAccessHelper.PhotoKeys.DISPLAY_NAME, 'test.jpg');
const fetchOptions: photoAccessHelper.FetchOptions = { fetchColumns: [photoAccessHelper.PhotoKeys.TITLE], predicates };
const fetchResult: photoAccessHelper.FetchResult<photoAccessHelper.PhotoAsset> = await ph.getAssets(fetchOptions);
const asset: photoAccessHelper.PhotoAsset = await fetchResult.getFirstObject();
const title = asset.get(photoAccessHelper.PhotoKeys.TITLE);

// 3) 保存到相册：免权限走 SaveButton 安全组件 + 一次性授权；或 MediaAssetChangeRequest
const uri = await ph.createAsset(photoAccessHelper.PhotoType.IMAGE, 'jpg');   // 需写权限/安全组件场景
```

相册维度：`ph.getAlbums(photoAccessHelper.AlbumType.USER, photoAccessHelper.AlbumSubtype.USER_GENERIC)`；系统相册如收藏夹用 `AlbumType.SYSTEM` + `AlbumSubtype.FAVORITE`；建相册用 `MediaAlbumChangeRequest.createAlbumRequest(context, albumName)`。`getAssets()` / `getAlbums()` 返回 `FetchResult`，翻页用 `fetchResult.getAllObjects()` 或 `getFirstObject()`；取字段用 `asset.get(photoAccessHelper.PhotoKeys.*)`。文件内容读取仍走 `fileIo` + uri（`fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY)`）。

### 7.5 文件（@kit.CoreFileKit）：沙箱与用户文件

```ts
import { fileIo } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';

const ctx = getContext(this) as common.UIAbilityContext;
// 沙箱目录直接是 Context 上的属性：filesDir / cacheDir / preferencesDir（随应用卸载删除）
const path = `${ctx.filesDir}/note.txt`;
const file = fileIo.openSync(path, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE);
fileIo.writeSync(file.fd, 'hello');
fileIo.accessSync(path);              // 是否存在
fileIo.statSync(path).size;           // 大小
fileIo.copyFileSync(path, `${ctx.cacheDir}/note.bak`);
fileIo.mkdirSync(`${ctx.filesDir}/sub`);
fileIo.renameSync(`${ctx.filesDir}/sub`, `${ctx.filesDir}/sub2`);
fileIo.unlinkSync(`${ctx.cacheDir}/note.bak`);
fileIo.rmdirSync(`${ctx.filesDir}/sub2`);
fileIo.closeSync(file);
// 其余 OpenMode：APPEND / TRUNC / DIR / NOFOLLOW / SYNC / UNCACHE / NONBLOCK

// 用户文件（公共目录）必须通过 Picker， uri 形如 file://media/ 或 file://docs/
import { picker } from '@kit.CoreFileKit';
const docPicker = new picker.DocumentViewPicker(ctx);
const sel = new picker.DocumentSelectOptions();
sel.maxSelectNumber = 5;
sel.defaultFilePathUri = 'file://docs/storage/Users/currentUser/test';
sel.fileSuffixFilters = ['.txt', '.pdf'];
const uris = await docPicker.select(sel);
const saveOpt = new picker.DocumentSaveOptions();
saveOpt.newFileNames = ['DocumentViewPicker01.txt'];
const savedUri = await new picker.DocumentViewPicker(ctx).save(saveOpt);   // 返回可写 uri，再用 fs 写
```

`$rawfile` 里的资源用 `ctx.resourceManager.getRawFileContent('demo.json')`。URI 与真实路径不可互换：公共目录只能通过 `file://docs/...`（用户文件）或 `file://media/...`（媒体文件）的 URI + Picker 授权访问。要把自己沙箱里的文件授权给别的应用，用 `@kit.CoreFileKit` 的 `fileShare`：`fileShare.persistPermission(policies)` / `activatePermission(policies)` / `revokePermission(policies)`，模式取 `fileShare.OperationMode.READ_MODE` / `WRITE_MODE`。

临时文件与缓存：`tempDir` 里文件系统在空间紧张时可回收；`cacheDir` 需自行清理；持久数据建议 `preferences`（KV）或关系型数据库 `@kit.ArkData` 的 `relationalStore`。

### 7.6 通知（@kit.NotificationKit）

```ts
import { notificationManager } from '@kit.NotificationKit';
import { wantAgent } from '@kit.AbilityKit';

// 先确认通知总开关（应用被禁用通知时 publish 无效）
const enabled = await notificationManager.isNotificationEnabled();   // 或 requestEnableNotification(ctx)

const agent = await wantAgent.getWantAgent({
  wants: [{ bundleName: 'com.example.myapp', abilityName: 'EntryAbility', parameters: { id: 42 } }],
  operationType: wantAgent.OperationType.START_ABILITY,
  requestCode: 0,
  wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG]
});

const request: notificationManager.NotificationRequest = {
  id: 1,
  slotType: notificationManager.SlotType.SOCIAL_COMMUNICATION,     // 需先 addSlot 自定义
  content: {
    notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
    normal: { title: '标题', text: '正文', additionalText: '摘要' }
  },
  wantAgent: agent
};
await notificationManager.publish(request);
notificationManager.cancel(1);
```

长文本/收件箱/进度条/轮播/红点角标（`setBadgeNumber`）等在 `text-notification.md` 有各自 `NotificationContent` 类型。前台应用内横幅提示用 `Dialog`/`promptAction`，而不是通知。

### 7.7 扫码（Scan Kit @kit.ScanKit，华为专有）

```ts
import { scanCore, scanBarcode, customScan } from '@kit.ScanKit';
import { BusinessError } from '@kit.BasicServicesKit';

// A) 默认界面扫码（系统给 UI，最省事，无需 CAMERA 权限）
let options: scanBarcode.ScanOptions = {
  scanTypes: [scanCore.ScanType.ALL],
  enableMultiMode: true,      // 多码
  enableAlbum: true           // 允许从相册选图识别
};
scanBarcode.startScanForResult(getContext(this), options)
  .then((result: scanBarcode.ScanResult) => { /* 码值与 scanType、scanCodeRect 等字段 */ })
  .catch((error: BusinessError) => { });

// B) 自定义界面扫码：自己出 UI，只借 Scan Kit 的相机流与识别（需 ohos.permission.CAMERA）
let viewControl: customScan.ViewControl = { width: 1920, height: 1080, surfaceId: this.surfaceId }; // surfaceId 取自 XComponent
customScan.init(options);                                // 第一步：初始化
customScan.start(viewControl)                            // 第二步：打开相机流，识别到结果后回调
  .then((result: Array<scanBarcode.ScanResult>) => {
    if (result.length) {
      // result[i].scanCodeRect 给出码的位置框（left/right/top/bottom），可用于在图上画标记
      this.scanResult = result;
      customScan.stop();                                 // 拿到结果先暂停相机流；rescan() 可重新开启
    }
  })
  .catch((error: BusinessError) => { });
customScan.on('lightingFlash', (error: BusinessError, isLightingFlash: boolean) => { }); // 环境光提示开闪光灯
customScan.off('lightingFlash');
customScan.release();                                    // 退出扫码页面时释放

// C) 码图生成：generateBarcode 是 @kit.ScanKit 的顶层导出（不在 scanBarcode 命名空间下）
import { scanCore, generateBarcode } from '@kit.ScanKit';
import { image } from '@kit.ImageKit';

let barcodeParams: scanCore.BarcodeParams = {
  scanType: scanCore.ScanType.QR_CODE,
  content: 'https://developer.huawei.com',
  width: 400, height: 400,        // 二维码/DM/Aztec：宽高需相等且 200~4096(px)
  margin: 2, level: scanCore.ErrorCorrectionLevel.L
};
generateBarcode(barcodeParams, (error: BusinessError, barcode: image.PixelMap) => {
  if (!error && barcode) { /* 把 barcode 作为 Image 的 src 显示 */ }
});
// 一维码（EAN/UPC/Code128/PDF417…）建议 width:height = 2:1 且 width > 400
```
> 自定义界面扫码还可选传入 `frameCallback` 拿 YUV 帧数据；缩放与对焦用 `customScan.setZoom/getZoom/setFocusPoint/resetFocus`，闪光灯用 `openFlashLight/closeFlashLight/getFlashLightStatus`。

「扫码直达」（扫普通链接二维码打开应用）需在 AGC 配置域名并与 App Linking 联动，文档见 `scan-directservice`；`Scan Kit` 属华为 Kit，OpenHarmony 无对应模块。

### 7.8 支付：两条不同产品线（华为专有）

**IAP Kit（@kit.IAPKit）— 应用内数字商品/订阅**（虚拟商品必须走 IAP）：

```ts
import { iap } from '@kit.IAPKit';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';

const ctx = getContext(this) as common.UIAbilityContext;

// 1) 环境检查（未登录/不支持会抛错）
await iap.queryEnvironmentStatus(ctx);

// 2) 查商品（商品 ID 在 AGC 配置）
await iap.queryProducts(ctx, {
  productType: iap.ProductType.CONSUMABLE,          // CONSUMABLE / NONCONSUMABLE / AUTORENEWABLE
  productIds: ['ohos_consume_001']
});

// 3) 发起购买
const res = await iap.createPurchase(ctx, {
  productType: iap.ProductType.CONSUMABLE,
  productId: 'ohos_consume_001'
});

// 4) 解析购买结果：purchaseData 里是 JWS，需解码验签后发货
const jws = JSON.parse(res.purchaseData).jwsPurchaseOrder;
const payload = JSON.parse(JWSUtil.decodeJwsObj(jws));   // 自定义 PurchaseOrderPayload

// 5) 发货完成后必须 finishPurchase，否则订单会重复回调
await iap.finishPurchase(ctx, {
  productType: Number(payload.productType),
  purchaseToken: payload.purchaseToken,
  purchaseOrderId: payload.purchaseOrderId
});
// 订阅场景：productType 用 AUTORENEWABLE，结果字段是 jwsSubscriptionStatus，
// 取 lastSubscriptionStatus.status === '1' 再发货。
// 错误码 iap.IAPErrorCode.PRODUCT_OWNED / SYSTEM_ERROR 需走补发货检查。
```

**Payment Kit（@kit.PaymentKit）— 实物商品/服务的华为支付收银台**：端侧只有一个入口，预下单在**商户服务器**完成（Java SDK：`DefaultPetalPayClient.execute("POST", "/api/v2/aggr/preorder/create/app", ...)`，`bizType` 100001 虚拟商品/100002 实物商品等），拿到 `orderStr` 后拉起收银台：

```ts
import { paymentService } from '@kit.PaymentKit';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';

@Entry
@Component
struct Index {
  context: common.UIAbilityContext = getContext(this) as common.UIAbilityContext;
  requestPaymentPromise() {
    // orderStr 由商户服务端预下单接口生成（含 app_id/merc_no/prepay_id/timestamp/noncestr/sign/auth_id）
    const orderStr = '{"app_id":"***","merc_no":"***","prepay_id":"xxx","timestamp":"1680259863114","noncestr":"...","sign":"***","auth_id":"***"}';
    paymentService.requestPayment(this.context, orderStr)
      .then(() => { console.info('succeeded in paying'); })
      .catch((error: BusinessError) => { console.error(`failed to pay, ${error.code}`); });
  }
  build() {
    Column() { Button('付款').onClick(() => this.requestPaymentPromise()) }
  }
}
```

支付结果**必须以服务端异步回调为准**，端侧 `then` 只代表收银台流程结束。免密支付/签约另有 `payment-password-free-pay`。

### 7.9 推送（Push Kit @kit.PushKit，华为专有）

端侧只做「拿 token + 上报 + 处理点击」，消息由**你的服务端**通过 Push Server API 下发：

```ts
import { pushService } from '@kit.PushKit';
import { UIAbility, AbilityConstant, Want } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';

export default class EntryAbility extends UIAbility {
  async onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): Promise<void> {
    try {
      const pushToken: string = await pushService.getToken();   // 需应用已在 AGC 开通 Push 且设备有华为账号登录
      // 上报 pushToken 到你的服务端（配合用户 ID 存起来）
    } catch (err) {
      const e: BusinessError = err as BusinessError;
      console.error(`Failed to get push token: ${e.code} ${e.message}`);
    }
  }
  async myDeletePushToken() { await pushService.deleteToken(); }
}
```

服务端侧：申请 JWT/OAuth 鉴权 → 调 Push REST 接口（`push-server`、`push-msg-receipt`）；通知点击后的透传/数据消息在 `push-alert`、`push-background`、`push-voip` 等章节。免打扰与时段限制见 `push-msg-freq-control`。

---

## 八、工程实践：IDE、构建、调试与迁移建议

### 8.1 工具链

| 环节 | 工具 | 前端对应物 |
| --- | --- | --- |
| IDE | **DevEco Studio**（基于 IntelliJ/Android Studio 分支） | WebStorm/VS Code |
| 构建 | **hvigor**（`hvigorfile.ts` + `build-profile.json5`） | Vite/Webpack 的任务编排 |
| 包管理 | **ohpm**（`oh-package.json5`，仓库为 ohpm 中心仓库） | npm |
| 语言服务 | ArkTS Compiler（`.ets` → `.abc` 方舟字节码） | tsc |
| 预览 | Previewer（热更新预览，支持多设备模板、参数联动） | Storybook/实时预览 |
| 设备 | Emulator 模拟器 / 真机（USB 调试） | 浏览器/真机调试 |
| 命令行 | **hdc**（HarmonyOS Device Connector） | adb |
| 上架 | AppGallery Connect（AGC）：证书、Profile、权限申请、扫码/支付/推送开通 | 应用商店后台 |

### 8.2 常用 hdc 命令

```bash
hdc list targets                       # 查看设备
hdc install entry-default-signed.hap   # 安装（多模块需 --module 或一次装完）
hdc shell bm dump -n com.example.myapp # 查看应用信息与已授予权限
hdc shell aa start -a EntryAbility -b com.example.myapp   # 拉起 Ability
hdc shell hilog | grep testTag         # 看日志（应用内用 hilog/HiLog，console.log 也能被捕获）
hdc shell "hilog -r"                   # 清日志缓冲
hdc file send local.txt /data/local/tmp/   # 推文件
hdc shell uitest uiInput click 500 800     # 注入点击（自动化）
```

### 8.3 build() 的语法约束（前端容易踩的规则）

ui/state-management/arkts-create-custom-components.md` 与 `arkts-declarative-ui-description.md` 明确列出：

- `build()` **只能有一个根组件**（`Column/Row/Stack` 等容器；`ForEach`/`if` 不能当根）。
- 组件**只能写在 `build()` 或 `@Builder` 内**，不能脱离 UI 上下文存在。
- `build()` / `@Builder` 内**不允许**：声明局部变量、`console.info` 之类打印、写空函数、导入外部模块语句、直接用 `if` 判断非状态变量而不刷新、给组件传 `this` 之外的复杂表达式做非常规副作用。
- 成员函数里可以写普通逻辑，但**不能直接改 UI 结构**（改状态变量才行）。
- 组件名、类名、函数名**不得与系统组件重名**（例如别把组件命名为 `Text`）。
- `@Entry` 在一个页面里**只允许一个**。
- `struct` **不支持继承**，`new` 可省略；不能写 `constructor`，成员用默认值或父组件传参初始化。

```ts
@Component
struct Card {
  // 状态与参数
  @Prop title: string = '';
  @Link expanded: boolean;
  @Require onTap: (id: number) => void;      // @Require：父组件必须传
  private id: number = 0;                     // 普通成员：改了不刷新 UI

  @Builder Label(text: string) {               // 成员 @Builder，可访问 this
    Text(text).fontSize(14).fontColor('#666')
  }

  aboutToAppear(): void {                       // 组件创建后、build 前：初始化/取参
    this.id = (this.getUIContext() ? 0 : 0);
  }

  build() {
    Column({ space: 6 }) {
      this.Label(this.title)                    // 通过 @Builder 复用 UI 片段
      if (this.expanded) {
        ForEach([1, 2, 3], (item: number) => {   // key 生成函数保证增量刷新正确
          Text(`${item}`).key((v: number) => `${v}`)
        }, (item: number) => `${item}`)
      }
    }
    .onClick(() => this.onTap(this.id))
  }
}
```

### 8.4 常见报错与排查方向

| 现象 | 原因方向 |
| --- | --- |
| UI 不刷新 | 变量没加装饰器 / 改的是嵌套第二层（V1 只看第一层）/ `ForEach` key 未变 |
| `'xxx' is not assignable to type ...` | ArkTS 拒绝 `any`/`object`/结构类型，补显式 interface |
| `build() 内不允许 ...` | 把逻辑挪到成员函数或 `aboutToAppear` |
| 页面白屏 | `main_pages.json` 未登记 / `windowStage.loadContent` 路径写错 |
| 权限申请无弹窗 | 未声明 `reason`/`usedScene`；或曾被拒绝需 `requestPermissionOnSetting` |
| 长列表卡顿 | 用 `LazyForEach`/`Repeat` + `@Reusable`；避免每项重建大子树 |
| 图片不显示 | `$r('app.media.x')` 名字与文件后缀不符 / rawfile 路径以 `/` 开头 / uri 未授权 |

### 8.5 给前端同学的学习路径

1. **先跑通一个页面**：`@Entry` + `Column/Text/Button` + `@State`，理解「改数据 → UI 变」。
2. **补 ArkTS 语言差异**：读 `typescript-to-arkts-migration-guide.md` 的限制清单，改掉 `any`/动态属性习惯。
3. **状态管理是分水岭**：把 V1 的 `@State/@Prop/@Link/@Provide/@Observed+@ObjectLink` 与 V2 的 `@ObservedV2/@Trace/@Local/@Param/@Computed/@Monitor` 对照 Vue3 的 `ref/reactive/props/inject/computed/watch` 各写一遍小 demo。
4. **布局与长列表**：`Row/Column/Stack/Flex` → `List + LazyForEach` → `Grid/WaterFlow`。
5. **导航**：直接学 Navigation + NavPathStack，别在 Router 上花时间（大面积 deprecated）。
6. **系统能力**：一律先问「有没有 Picker / 安全组件可以免权限」，再考虑申请权限。
7. **上架相关**：AGC 侧的证书、Profile、扫码直达、IAP/支付/Push 开通，是端侧代码之外必然要过的流程。
8. **性能**：官方 `ui-performance-overview` + `arkts-high-performance-programming`，重点是组件粒度拆分、按需更新、列表复用、避免主线程重计算（用 TaskPool）。

---

---

## 附录 A：前端概念 ↔ ArkUI 概念对照表

| 你熟悉的（TS / Vue / React / Web） | ArkUI / HarmonyOS 对应物 | 关键差异 |
| --- | --- | --- |
| npm package | HAR（静态共享包）/ HSP（动态共享包）/ 原子化服务 | 装到 ohpm 仓库；HAR 会被复制进每个引用方，HSP 运行期共享 |
| package.json | `oh-package.json5`（依赖）+ `module.json5`（模块与能力声明） | 权限、Ability、路由表、意图都在 `module.json5` |
| vite / webpack | **hvigor**（`hvigorfile.ts` + `build-profile.json5`） | 产物是 `.hap` / `.hsp` / `.har`，不是静态文件 |
| JSX `<Text>x</Text>` | `Text('x') { }` 声明式组件 | 属性是链式方法 `.fontSize(20)`，不是字符串 class |
| CSS class / 内联样式 | 通用属性链式调用 + `@Styles` / `@Extend` / `stateStyles` / `attributeModifier` | 无选择器、无层叠、无继承；值受枚举/类约束 |
| `box-sizing` / flex / grid | `Row`/`Column`/`Flex`/`Stack`/`RelativeContainer`/`GridRow`/`GridCol`/`Grid` | 布局约束靠 `constraintSize`/`layoutWeight`/`flexGrow`，不是 `min-width` 等 |
| `vw/vh`、`rem` | `vp`（虚拟像素，密度无关）、`fp`（字体像素）、`lpx`（组件基准尺寸自适应） | `'100%'` 表父容器百分比；`px` 不推荐直接使用 |
| `media query` | `@kit.ArkUI` 的 `mediaquery`（`matchMediaSync`）+ `GridRow/GridCol` 断点 + 分栏模式 | 断点驱动布局重排是系统设计目标，不只为字号 |
| `v-if` / `{cond && ...}` | `build()` 里的 `if/else`（渲染控制） | 只在状态变量变化时决定挂载/卸载 |
| `v-for` / `map()` | `ForEach(arr, itemBuilder, keyBuilder)` | key 决定复用；大列表必须换 `LazyForEach` 或 `Repeat` |
| `ref()` / `useState` | `@State`（V1）/ `@Local`（V2） | 只能观察第一层（V1）；V2 靠 `@Trace` 深度观察 |
| `props`（单向） | `@Prop`（单向，本地可改但会被父覆盖）/ V2 `@Param`（严格只读） | V2 明确区分 `@Param` 与 `@Event` |
| `v-model` / 受控组件 | `@Link`（V1 双向）/ `!!` 或 `@Param`+`@Event`（V2） | `@Link` 禁止本地初始化 |
| `provide` / `inject` | `@Provide` / `@Consume`（按 key 匹配）/ V2 `@Provider`/`@Consumer` | 靠别名/类型匹配，跨任意层级 |
| `computed` | V1 无（用 getter）/ V2 `@Computed` | `@Computed` 只在依赖变化时重算 |
| `watch` | `@Watch('cb')`（V1）/ `@Monitor`（V2，可监听嵌套路径） | V1 拿不到旧值，V2 回调带 `IMonitorValue` |
| Pinia / Redux / 全局 store | `AppStorage`（应用级）/ `LocalStorage`（页面级）/ V2 `AppStorageV2` / `PersistenceV2`（落盘） | 状态管理只能在主线程；跨页面共享用 `@StorageLink` 或传入 `class` |
| DOM diff / 虚拟 DOM | 依赖收集 + 标脏 + 系统生成的 `rerender`，编译期生成创建/更新函数，单节点级按需更新 | 更新单位是自定义组件，因此组件粒度影响性能 |
| 组件复用池 / key | `@Reusable`（V1，父组件级缓存池）/ `@ReusableV2` + 全局复用池 / `@Lazy`（懒加载） | 复用时必须在 `aboutToReuse` 里重新同步状态 |
| `useEffect` 生命周期 / `mounted` | `aboutToAppear` / `onDidBuild` / `aboutToDisappear` / `onAppear` / `onDisAppear` | 复用组件走 `aboutToReuse` / `aboutToRecycle` |
| React Router / Vue Router | **Navigation**（`NavPathStack` + `NavDestination`）为主；`Router`（页面级，大面积 deprecated） | Navigation 是组件级路由，支持分栏、系统返回、转场接管 |
| History API `pushState` | `pathStack.pushPath({name, param})` / `pushDestination` / `pop` / `replacePath` | 栈对象与 Navigation 一一对应，不可复用 |
| `location.href` / 深链 | 显式/隐式 `Want` + `module.json5` 的 `skills.uris`（Deep Linking / App Linking） | App Linking 需域名归属校验 |
| PWA / 快捷指令 / App Intents | **Insight Intent**（`@InsightIntentEntry` 等 + `insight_intent.json`） | 由系统入口（小艺建议、搜索、意图面板）拉起 |
| Service Worker / 后台任务 | `ContinuousTask`（长时任务）/ `WorkScheduler`（延迟异步任务）/ `ServiceExtensionAbility` | 后台受限，需声明 `backgroundTaskManager` 的 `reason`/能力 |
| `Web Worker` / 线程 | `@kit.ArkTS` 的 `taskpool`（`@Concurrent`）/ `Worker` | `@Concurrent` 函数只能定义在顶层，跨线程传值有类型限制 |
| `alert` / `confirm` | `AlertDialog` / `promptAction.showToast/showDialog` / `CustomDialogController`（V1）/ `promptAction.openCustomDialog`（V2） | 系统弹窗与页面级 `bindSheet`/`bindContentCover` 分层 |
| `input type=file` | `DocumentViewPicker`（文件）、`PhotoViewPicker`（相册）、`SaveButton`（免权限保存）、`cameraPicker`（拍照） | 走 Picker 可完全免权限，是官方推荐路径 |
| CSS transition / `@vue/transitions` | `.animation()`（属性动画）、`animateTo`（显式）、`transition(TransitionEffect)`（进出场）、`geometryTransition`（共享元素）、`customNavContentTransition`（导航转场） | 无 keyframes 字符串；曲线用 `Curve` 枚举与 `curves.springMotion` |
| 权限 API（浏览器弹窗） | `module.json5` 静态声明 + `abilityAccessCtrl.requestPermissionsFromUser` | 拒绝后不再自动弹窗，需引导设置页 |
| adb | `hdc`（`list targets` / `install` / `shell aa start` / `shell hilog`） | 命令形态相近，参数不同 |

---

## 附录 B：把各章串起来的综合示例

一个「购物清单」页：V2 状态管理 + Navigation 路由 + 列表复用 + 相册选图 + 权限判断。

```ts
// entry/src/main/ets/model/Item.ets —— 数据模型（第三章：@ObservedV2 + @Trace）
import { ObservedV2, Trace } from '@kit.ArkUI';   // V2 装饰器由状态管理提供

@ObservedV2
export class Item {
  @Trace name: string;
  @Trace count: number;
  @Trace cover?: string;          // 图片 uri，可空
  readonly id: number;

  constructor(id: number, name: string, count: number = 1) {
    this.id = id;
    this.name = name;
    this.count = count;
  }
}

@ObservedV2
export class Cart {
  @Trace items: Item[] = [];
  @Trace remark: string = '';
  get total(): number { return this.items.reduce((s, i) => s + i.count, 0); }

  add(name: string) { this.items.push(new Item(Date.now(), name)); }
  clear() { this.items = []; }
}
```

```ts
// entry/src/main/ets/pages/ListPage.ets —— 列表页（第四、五、六、七章）
import { Cart, Item } from '../model/Item';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { common } from '@kit.AbilityKit';
import { promptAction, router } from '@kit.ArkUI';

@Entry
@ComponentV2
struct ListPage {
  @Local cart: Cart = new Cart();        // @Local：组件私有状态（V2）
  @Local keyword: string = '';

  pickCover(item: Item) {
    // 免权限选图：PhotoViewPicker 不需要 READ_IMAGEVIDEO（第七章 7.4）
    const picker = new photoAccessHelper.PhotoViewPicker();
    const opt = new photoAccessHelper.PhotoSelectOptions();
    opt.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
    opt.maxSelectNumber = 1;
    picker.select(opt).then((r: photoAccessHelper.PhotoSelectResult) => {
      item.cover = r.photoUris[0];       // @Trace 属性赋值 → 该 Text/Image 按需更新
    }).catch((e: Error) => {
      promptAction.showToast({ message: `选图失败：${e.message}` });
    });
  }

  build() {
    Column({ space: 12 }) {
      // 顶部搜索：TextInput + 回车提交（第六章 6.3）
      Row({ space: 8 }) {
        TextInput({ placeholder: '搜索商品', text: this.keyword })
          .layoutWeight(1)
          .onChange((v: string) => { this.keyword = v; })
          .onSubmit(() => this.cart.add(this.keyword))
        Button('添加').onClick(() => this.cart.add(this.keyword))
      }

      Text(`共 ${this.cart.total} 件`).fontSize(14).fontColor('#888')

      // 长列表：List + LazyForEach 思路；小数据量用 ForEach + key（第五章）
      List({ space: 8 }) {
        ForEach(
          this.cart.items.filter((i: Item) => i.name.includes(this.keyword)),
          (item: Item) => {
            ListItem() {
              Row({ space: 10 }) {
                if (item.cover) {
                  Image(item.cover).width(56).height(56).borderRadius(8)
                    .onClick(() => this.pickCover(item))
                } else {
                  SavePlaceholder({ onTap: () => this.pickCover(item) })
                }
                Column({ space: 4 }) {
                  Text(item.name).fontSize(16).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                  Stepper2({ item: item })          // 子组件用 @Param 接收引用（第三章 V2）
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)
              }
              .padding(10)
              .transition(TransitionEffect.OPACITY.animation({ duration: 200 }))
            }
          },
          (item: Item) => `${item.id}`              // key 变化才会重建，避免复用错数据
        )
      }
      .edgeEffect(EdgeEffect.Spring)
      .layoutWeight(1)

      Row({ space: 12 }) {
        Button('去结算').layoutWeight(1)
          .onClick(() => router.pushUrl({ url: 'pages/CheckoutPage' }))  // 演示 Router；新项目用 Navigation
        Button('清空').backgroundColor('#EEE').fontColor('#333')
          .onClick(() => this.cart.clear())
      }
    }
    .width('100%').height('100%').padding(16)
  }
}

// 数量步进器：V2 的 @Param + @Event 组合（第三章 4.3）
@ComponentV2
struct Stepper2 {
  @Require @Param item: Item;
  @Event onChange: (delta: number) => void = (d: number) => { this.item.count += d; };

  build() {
    Row({ space: 8 }) {
      Button('-').width(32).height(32).type(ButtonType.Circle)
        .onClick(() => this.onChange(-1))
      Text(`${this.item.count}`).fontSize(16)
      Button('+').width(32).height(32).type(ButtonType.Circle)
        .onClick(() => this.onChange(1))
    }
  }
}

// 封面占位（第二章：@Builder 抽取 UI 片段）
@ComponentV2
struct SavePlaceholder {
  @Param onTap: () => void = () => {};
  build() {
    Column() { Text('添加图片').fontSize(12).fontColor('#999') }
      .width(56).height(56).borderRadius(8).backgroundColor('#F5F5F5')
      .justifyContent(FlexAlign.Center)
      .onClick(() => this.onTap())
  }
}
```

```ts
// entry/src/main/ets/pages/CheckoutPage.ets —— 页面跳转与支付衔接（第二章、第七章 7.8）
import { common } from '@kit.AbilityKit';
import { iap } from '@kit.IAPKit';
import { paymentService } from '@kit.PaymentKit';
import { BusinessError } from '@kit.BasicServicesKit';

@Entry
@Component
struct CheckoutPage {
  aboutToAppear(): void {
    // 页面级数据可从路由参数拿：
    const p = this.getUIContext().getRouter().getParams() as Record<string, number>;
  }

  buyVirtual() {   // 数字商品 → IAP
    const ctx = getContext(this) as common.UIAbilityContext;
    iap.createPurchase(ctx, { productType: iap.ProductType.CONSUMABLE, productId: 'coin_100' })
      .then((res: iap.CreatePurchaseResult) => {
        const payload = JSON.parse(JSON.parse(res.purchaseData).jwsPurchaseOrder ? '{}' : '{}');
        // 实际应 JWS 解码验签 → 发放权益 → finishPurchase
      })
      .catch((e: BusinessError) => { });
  }

  payPhysical(orderStr: string) {   // 实物商品 → 华为支付收银台（orderStr 来自商户服务器）
    const ctx = getContext(this) as common.UIAbilityContext;
    paymentService.requestPayment(ctx, orderStr)
      .then(() => { /* 以服务端回调结果为准 */ })
      .catch((e: BusinessError) => { });
  }

  build() {
    Column({ space: 12 }) {
      Text('结算页').fontSize(24)
      Button('购买会员（IAP）').onClick(() => this.buyVirtual())
      Button('华为支付').onClick(() => this.payPhysical('{}'))
      Button('返回').onClick(() => this.getUIContext().getRouter().back())
    }.width('100%').height('100%').justifyContent(FlexAlign.Center)
  }
}
```

配套配置：

```json5
// entry/src/main/resources/base/profile/main_pages.json
{ "src": ["pages/ListPage", "pages/CheckoutPage"] }

// entry/src/main/module.json5（节选：权限 + Ability + 深链）
{
  "module": {
    "name": "entry",
    "type": "entry",
    "pages": "$profile:main_pages",
    "abilities": [{
      "name": "EntryAbility",
      "srcEntry": "./ets/entryability/EntryAbility.ets",
      "startWindowIcon": "$media:icon",
      "startWindowBackground": "$color:start_window_background",
      "launchType": "singleton",
      "exported": true,
      "skills": [{ "entities": ["entity.system.home"], "actions": ["action.system.home"] }]
    }],
    "requestPermissions": [{ "name": "ohos.permission.INTERNET" }]
  }
}
```

> 示例中的注释标了每段代码对应本文章节。注意两点：`@ComponentV2` 与 `@Entry` 组合使用是 V2 范式写法；IAP 的 JWS 解码验签必须自行实现（官方示例提供 `JWSUtil`），本文用注释占位以免误导为可直接复制的成品逻辑。
