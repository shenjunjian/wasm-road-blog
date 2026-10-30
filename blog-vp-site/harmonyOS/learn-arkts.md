# ArkTS 速成指南（写给有 TypeScript / 前端经验的开发者）

> 资料来源：华为开发者联盟 ArkTS 官网与 HarmonyOS 文档中心（ArkTS 简介、ArkTS 语言介绍、从 TypeScript 到 ArkTS 的适配规则、声明式 UI 描述、创建自定义组件、状态管理概述、if/else 与 ForEach 渲染控制、@Builder 装饰器）。
> 只收录日常开发高频用法，冷门语法（源码态注解、FrameNode 自定义渲染、跨语言 NAPI 交互等）留到需要时再查。

---

## 0. 先建立正确的心智模型

一句话：**ArkTS = TypeScript 的"静态子集" + ArkUI 的声明式 UI 扩展语法**。

```
JavaScript  →  TypeScript  →  ArkTS
    （扩展）       （再扩展 + 做减法）
```

- **做减法**：ArkTS 砍掉了 TS/JS 里所有"运行时才确定"的动态特性（`any`、解构、运行时改对象结构、structural typing……）。目的是让所有类型在编译期已知，从而被 AOT 编译为方舟字节码（`*.abc`），换来更快的启动、更低的功耗和更好的稳定性。
- **做加法**：ArkTS 在 `.ets` 文件里加入了 `struct` 自定义组件、`build()` 声明式 UI 描述、`@Entry/@Component/@State/@Builder` 等装饰器，用来写界面。
- **文件后缀**：UI 页面/组件用 `.ets`；纯逻辑代码可以是 `.ts`。规则：`.ets` 可以 import `.ts/.js`，**反过来不行**。
- **好消息**：未在适配规则里被明确约束的 TS 特性，ArkTS 完全支持（例如自定义装饰器语法与 TS 一致）。所以你 90% 的 TS 直觉是对的，只需要记住下面第 2 节那份"黑名单"。

对比 React 的类比（帮你快速迁移）：

| React / 前端概念 | ArkTS + ArkUI 对应 |
|---|---|
| JSX 里的 `<div>` | `Column()` / `Row()` / `Stack()` 等组件函数 + `{}` 尾随闭包 |
| `className` / CSS | 组件后面链式 `.width(100).fontSize(20)` 属性方法 |
| `onClick={fn}` | `.onClick(() => {...})` |
| `useState` | `@State`（V1）/ `@Local`（V2）装饰的类字段 |
| props 单向传递 | `@Prop`（V1）/ `@Param`（V2） |
| props 双向 / 回调上抛 | `@Link` + `$`（V1）/ `@Param` + `@Event` 或 `!!`（V2） |
| Context | `@Provide` / `@Consume`（V1）/ `@Provider` / `@Consumer`（V2） |
| Redux / 全局 store | `AppStorage` / `LocalStorage` / `PersistenceV2` |
| 片段复用（renderXxx） | `@Builder` |
| `list.map(...)` | `ForEach(arr, (item) => {...})` |
| `condition && <X/>` | `if (condition) { X() }`（写在 build 里） |
| `useEffect` | `@Watch`（V1）/ `@Monitor`（V2） |

---

## 1. 与 TypeScript 相同的部分（会 TS 就会，5 分钟扫完）

### 1.1 声明与基本类型

```typescript
let count: number = 0;        // 变量：用 let（var 已被禁用）
const NAME: string = 'Ark';   // 常量：只能赋值一次，重复赋值是编译错误
count = 1;                    // 有类型推断：let x = 'hi' 就是 string

// 基本类型：number / string / boolean / bigint / Object / void / null / undefined
// 引用类型：class / interface / 数组 / 函数 / 泛型
```

`number` 同时表示整数和浮点数。超过 `Number.MAX_SAFE_INTEGER` 的大整数用 `bigint`。

### 1.2 复合类型

```typescript
// 数组：两种写法都行
let names: string[] = ['Alice', 'Bob'];
let nums: Array<number> = [1, 2, 3];

// 元组
let pair: [string, number] = ['id', 1];

// 联合类型（注意：用 | 而不是交叉类型 &）
type Pet = Cat | Dog;

// 类型别名：给匿名类型起名
type Matrix = number[][];
type TrigFn = (x: number) => number;

// 枚举：成员必须用常量表达式初始化
enum ColorSet { White = 0xFF, Grey = 0x7F, Black = 0x00 }
let c: ColorSet = ColorSet.Grey;   // 使用时必须带枚举名前缀

// Record<K, V>：ArkTS 里替代"任意键值对象"的标准写法
let map: Record<string, number> = { 'John': 25, 'Mary': 21 };
```

### 1.3 对象字面量：必须有可推断的目标类型

这是 TS 转过来最常踩的坑。ArkTS 里对象字面量**不能凭空出现**，必须在能推断出类型的上下文里：

```typescript
class Point { x: number = 0; y: number = 0; }

let p: Point = { x: 1, y: 2 };   // ✅ 有变量类型标注
foo({ x: 1, y: 2 });             // ✅ 参数类型是 Point
function bar(): Point { return { x: 1, y: 2 }; }  // ✅ 返回类型
let arr: Point[] = [{ x: 1, y: 1 }, { x: 2, y: 2 }]; // ✅ 数组元素类型

let o = { x: 1, y: 2 };  // ❌ 无类型上下文（会被推断成匿名类型，ArkTS 不允许）
let bad: { x: number } = { x: 1 };  // ❌ 对象字面量不能用作类型声明
```

**对策**：先写 `interface` 或 `class`，再用它标注。

```typescript
interface UserInfo { name: string; age: number; }
const user: UserInfo = { name: 'Bob', age: 20 };
```

数组字面量同理：`[1, 'a', true]` 这种混合类型数组不允许，必须同质或显式标注。

### 1.4 函数

```typescript
function add(x: string, y: string): string { return `${x} ${y}`; }

// 可选参数
function hello(name?: string) { if (name === undefined) { /* ... */ } }

// 默认参数
function multiply(n: number, coeff: number = 2): number { return n * coeff; }

// rest 参数（只能是最后一个）
function sum(...numbers: number[]): number { let r = 0; for (let n of numbers) r += n; return r; }

// 箭头函数：日常首选（函数表达式 function(){} 已被限制）
let sum2 = (x: number, y: number) => x + y;

// 闭包、回调函数类型都照旧
function doAction(f: (x: number) => number) { f(3.14); }

// 重载：多个同名签名 + 一个实现签名
function foo(x: number): void;
function foo(x: string): void;
function foo(x: number | string): void { /* 实现 */ }
```

**ArkTS 里函数的额外规矩**：
- 每个参数都必须标注类型。
- 不能在函数内部再声明函数。
- 不能用 `function.apply / call / bind`（`bind` 在 UI 事件里也不推荐，用箭头函数）。
- 不支持生成器函数 `function*`。
- 返回类型可省略（能推断时），但推荐显式写。

### 1.5 类

和 TS 高度一致：字段、方法、构造函数、`static`、`getter/setter`、`private/protected/public`、继承 `extends`、`super`、方法重写、抽象类 `abstract`。

```typescript
class Animal {
  protected name: string = '';
  constructor(name: string) { this.name = name; }
  move(): void { console.info(`${this.name} is moving`); }
}

class Bird extends Animal {
  constructor(name: string) { super(name); }
  override move(): void { /* ... */ }
}
```

**与 TS 的关键差异**：
- **所有字段必须在声明时或构造函数里显式初始化**（等价于 TS 的 `strictPropertyInitialization`，且没有 `declare`/`!` 后门）。
  ```typescript
  class Person {
    name: string;              // ❌ 编译错误
    name?: string;             // ✅ 可选，但返回类型也要写成 string | undefined
    name: string = '';         // ✅ 推荐
  }
  ```
- **不支持"参数属性"**：TS 习惯写的 `constructor(private name: string)` 在 ArkTS 里非法，字段必须单独声明（`arkts-no-ctor-prop-decls`）。
  ```typescript
  // ❌ ArkTS 报错
  class Person {
    constructor(protected ssn: string, private firstName: string) { }
  }
  // ✅ 改成显式声明
  class Person {
    protected ssn: string;
    private firstName: string;
    constructor(ssn: string, firstName: string) {
      this.ssn = ssn;
      this.firstName = firstName;
    }
  }
  ```
- 私有成员用 `private` 关键字，**不支持 `#name` 语法**。
- 不支持类表达式 `const C = class {}`（`arkts-no-class-expr`）；class 不能被当作普通对象传递（`arkts-class-not-as-obj`）。
- 接口（`interface`）里不能有静态成员、不能有构造函数、不能有方法实现，也不能包含 call signature / construct signature（用 `class` 或函数类型别名替代）。
- `implements` **只能针对接口**，不能 `class B implements A`（A 是类）——`arkts-implements-only-iface`。
- 抽象类与接口的取舍同 TS：抽象类可含实现/构造函数/静态成员，接口只做行为约定。

### 1.6 泛型

照 TS 用：泛型类、泛型接口、泛型函数、`extends` 约束、默认类型参数。

```typescript
class Stack<T> { push(e: T): void { /* ... */ } }
const s = new Stack<string>();      // 类型实参尽量显式写出

interface Hashable { hash(): number }
class Map_<K extends Hashable, V> { /* ... */ }   // 约束

function last<T>(arr: T[]): T { return arr[arr.length - 1]; }
last<number>([1, 2, 3]);    // ✅ 显式
```

**泛型实参的省略规则**（`arkts-no-inferred-generic-params`）：能从实参推断出来时可以省略（`last([1,2,3])` 没问题），但**禁止只靠返回类型去推断**——这类写法在 TS 里合法，在 ArkTS 里是编译错误。拿不准就显式写类型实参。

**不支持的高级类型体操**（这些基本都用不了，别再写了）：条件类型 `T extends X ? A : B`、映射类型 `{[K in keyof T]: ...}`、索引访问类型 `T['key']`、`this` 类型、交叉类型 `&`（用继承替代）、`as const` 断言、大部分依赖前者的 utility 类型（`Partial`/`Pick`/`Omit`/`Record` 中 `Record` 是**内置支持**的）。

### 1.7 空安全（比 TS 的 strictNullChecks 更严）

所有类型默认**不可为空**：

```typescript
let x: number = null;   // ❌
let y: string = null;   // ❌
let z: number | null = null;  // ✅ 想为空就显式联合
```

三个运算符：

```typescript
a!.value        // 非空断言：编译器放行，运行时为空则抛异常
this.nick ?? '' // 空值合并：左侧为 null/undefined 时取右侧
p.spouse?.nick  // 可选链：可任意长，返回类型要写成 string | null | undefined
```

### 1.8 模块与导入

```typescript
export class Point { /* ... */ }
export default new Demo();
export function add(a: number, b: number): number { /* ... */ }

import { X, Y } from './Utils';
import * as Utils from './Utils';
import { X as Z } from './Utils';

// 动态导入（返回 Promise，可在 async 函数里 await）
const ns = await import('./Say');
```

**SDK 开放能力导入——这是鸿蒙开发的日常写法**：

```typescript
// 旧写法：导入具体模块
import UIAbility from '@ohos.app.ability.UIAbility';

// 推荐写法：导入 Kit
import { UIAbility } from '@kit.AbilityKit';
import { UIAbility, Ability, Context } from '@kit.AbilityKit';
import * as module from '@kit.AbilityKit';   // 全量导入会增大 HAP 包，慎用
```

模块相关限制：不支持 `require`/`import = `、`export =`、UMD、ambient module（`declare module 'x' {}`）、导入断言、模块名通配符；import 语句必须在文件最前面（前面不能有其他语句）。

---

## 2. TS → ArkTS 必背"黑名单"

这一节是适配成本最高的地方。踩坑时回来看即可。

### 2.1 强制静态类型

| ❌ 不合法 | ✅ 改成 |
|---|---|
| `let a: any` | 用具体类型 |
| `let a: unknown` | 用具体类型 + `as` 收窄 |
| `// @ts-ignore` / `@ts-nocheck` | 无后门，必须改代码 |
| `let o = {}`（匿名类型） | 定义 `interface` 再标注 |
| `let x: { a: number }` | 定义 `interface` |
| `obj['key']` 索引访问字段 | `obj.key` |
| `[key: string]: any` index signature | `Record<K, V>` |
| `catch (e: Error)` | `catch (e)`（不能标注类型），内部用 `e as Error` |
| 类型转换 `<T>value` | `value as T` |

### 2.2 禁止运行时变更对象布局

对象的属性集在编译期固定，运行期不能增删。

```typescript
obj.newProp = 1;        // ❌
delete obj.prop;        // ❌ delete 运算符整体不支持
obj.method = fn;        // ❌ 不能修改对象的方法
Object.assign(target, src); // ❌ 涉及动态属性写入的场景要改写
Person.prototype.say = ...  // ❌ 不支持在原型上赋值
```

### 2.3 不支持 structural typing（鸭子类型）

TS 里"形状相同即可赋值"在 ArkTS 不成立——**必须显式声明 `implements` 或继承关系**。

```typescript
interface Person { name: string; age: number }
class Employee { name: string = ''; age: number = 0 }  // 形状一样
let p: Person = new Employee();   // ❌ ArkTS 报错
class Employee implements Person {/* ... */}  // ✅ 加上 implements 才行
```

### 2.4 语法糖的削减

- **解构全部不能用**：`let [a,b] = arr`、`let {x,y} = obj`、`const {name: alias} = user`、函数参数解构 `function f({a, b})` —— ❌ 逐条取字段即可。
- **确定赋值断言** `let x!: number` —— ❌ 老老实实初始化。
- `for...in` —— ❌ 用 `for...of` 遍历数组，或 `Object.keys()` + 索引。
- `with` 语句 —— ❌。
- 逗号运算符 `,` —— 只允许出现在 `for` 循环里。
- `throw` —— 只能抛 `Error` 及其子类（`throw 'oops'` ❌）。
- 一元 `+ - ~` 只作用于 number：`+str` ❌，要写 `Number(str)`。
- `in` 运算符 ❌；`typeof` 只能用在表达式中（不能当类型用：`typeof x` 作类型标注 ❌）；`instanceof` 部分支持。
- 展开运算符 `...` **只支持展开数组、Array 子类和 TypedArray**，且只能用在"传给剩余参数"和"复制到数组字面量"两种场景。**对象展开 `{...obj}` 不支持**，改用显式字段赋值或构造函数。
- **一批 JS 标准库 API 被禁用**（`arkts-limited-stdlib`）：`eval`；`Object` 上的 `assign` / `create` / `freeze` / `fromEntries` / `defineProperty(s)` / `getPrototypeOf` / `getOwnPropertyDescriptor(s)` / `getOwnPropertySymbols` / `hasOwnProperty` / `isPrototypeOf` / `is` / `isExtensible` / `isFrozen` / `isSealed` / `preventExtensions` / `__proto__` / `__defineGetter__` / `__defineSetter__` / `__lookupGetter__` / `__lookupSetter__`。遍历 `Record` 的键请用 `Object.keys()`。完整清单见文档"限制使用标准库"一节。
- `Symbol()` API、`globalThis`、`new.target`、枚举/声明合并、JSX 表达式、构造函数类型 `type F = new () => T` —— ❌。
- 命名空间不能当对象使用，命名空间内只能有声明语句。
- `ESObject` 类型受限制（它用于跨语言交互，日常不用）。

### 2.5 `this` 的收紧

```typescript
class A {
  n: number = 0;
  f(arg1: this) {}        // ❌ this 不能作为类型
  static s(x: number) { this.n = x; }  // ❌ 静态方法里不能用 this
}
function foo() { this.n = 1; }  // ❌ 顶层函数里不能用 this
```

`this` 只能在**类的实例方法**中使用。UI 事件回调里用箭头函数（词法 `this` 自动指向组件），不要用匿名 `function`。

---

## 3. ArkUI 声明式 UI：核心中的核心

### 3.1 UI 描述长什么样

组件调用**不需要 `new`**，直接写名字加括号；属性/事件用 `.` 链式调用；子组件写在 `{}` 尾随闭包里。

```typescript
Column() {                       // 容器组件 + 子组件
  Text('Hello')
    .fontSize(100)               // 属性方法
  Divider()
  Text(this.myText)
    .fontSize(100)
    .fontColor(Color.Red)
}
.width('100%')
```

**参数**：有必选构造参数的组件要传（如 `Image(src)`、`Text('内容')`、`Button('点我')`）；无必选参数则 `Column()`。参数可以是变量和表达式：

```typescript
Image(this.imagePath)
Text(`count: ${this.count}`)
Text($r('app.string.title_value'))    // $r 引入资源，做多语言/主题必备
```

**属性值支持枚举常量**，这是 ArkUI 属性的风格：

```typescript
Text('hello')
  .fontSize(20)
  .fontColor(Color.Red)
  .fontWeight(FontWeight.Bold)
```

**事件**：一律传箭头函数。

```typescript
Button('add')
  .onClick(() => { this.counter += 1; })
```

### 3.2 自定义组件：`struct` + `build()`

```typescript
@Component
struct HelloComponent {
  @State message: string = 'Hello, World!';

  build() {
    Row() {
      Text(this.message)
        .fontSize(20)
        .margin(10)
        .onClick(() => { this.message = 'Hello, ArkUI!'; })
    }
  }
}
```

规则与要点：

- 用 `struct` 而非 `class`，**组件之间不允许继承**。实例化时可省略 `new`。
- `build()` 是必须的，且**只有一个根节点**。
- `@Entry` 装饰的是**页面入口**，一个页面只允许一个 `@Entry`；它的 `build()` 根节点**必须是容器组件**（普通 `@Component` 的根节点可以是非容器组件）。`ForEach` 不能当根节点。
- 组件名 / 类名 / 函数名**不能与系统组件重名**（别自己写个 `Text`）。
- 跨文件复用：`export` 导出组件，用的时候 `import`。
- 成员函数/成员变量只从组件内部访问，不建议声明为 `static`。

页面骨架（新建工程默认给你的东西）：

```typescript
@Entry
@Component
struct Index {
  @State message: string = 'Hello World';

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('HelloWorld')
        .fontSize($r('app.float.page_text_font_size'))
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
        .onClick(() => { this.message = 'Welcome'; })
    }
    .height('100%')
    .width('100%')
  }
}
```

### 3.3 `build()` 里的硬性约束（写错就编译不过）

| 不允许 | 替代做法 |
|---|---|
| 声明局部变量 `let n = 1` | 放到成员变量里 |
| `switch` 语法 | 用 `if / else if / else` |
| 直接写 `console.info(...)` | 放进普通方法里调用 |
| 独立的 `{}` 局部作用域 | 去掉 |
| 调用非 `@Builder` 方法产出 UI | 加 `@Builder`；或把方法返回值当组件参数（`Text(this.calc())` ✅） |

### 3.4 给自定义组件传参

普通成员变量：本地初始化必选，父组件可覆盖传入。

```typescript
@Component
struct MyBox {
  countDownFrom: number = 0;
  color: Color = Color.Blue;
  build() {
    Column() { Text(`${this.countDownFrom}`).backgroundColor(this.color) }
  }
}

@Entry
@Component
struct Parent {
  private someColor: Color = Color.Pink;
  build() {
    Column() {
      MyBox({ countDownFrom: 10, color: this.someColor })
    }
  }
}
```

**子组件回调父组件**（等价于 `onXxx` 事件）：

```typescript
@Entry
@Component
struct Parent {
  @State cnt: number = 0;
  submit: () => void = () => { this.cnt++; };

  build() {
    Column() {
      Text(`${this.cnt}`)
      Son({ submitArrow: this.submit })     // 把函数传下去
    }
  }
}

@Component
struct Son {
  submitArrow?: () => void;
  build() {
    Row() {
      Button('add').onClick(() => { this.submitArrow?.(); })
    }
  }
}
```

各装饰器的初始化规则速记（V1）：普通变量/`@State` 必须本地初始化、父组件可覆盖；`@Prop` 可本地可传入；`@Link`/`@ObjectLink` **不能本地初始化，必须由父组件传入**；`@Provide` 必须本地初始化；`@Consume` 不初始化，靠别名匹配上游。

### 3.5 `@Builder`：轻量 UI 片段复用

比自定义组件更轻，适合"结构固定、只换数据"的片段。**禁止在 `@Builder` 内定义状态变量**。

```typescript
// 组件内的私有 Builder
@Entry
@Component
struct BuilderDemo {
  @Builder showTextBuilder() {
    Text('Hello World').fontSize(30).fontWeight(FontWeight.Bold)
  }
  @Builder showTextValueBuilder(param: string) {
    Text(param).fontSize(30)
  }
  build() {
    Column() {
      this.showTextBuilder()
      this.showTextValueBuilder('Hello @Builder')
    }
  }
}

// 全局 Builder
@Builder
function globalHeader() { Text('Header').fontSize(24) }
```

**参数传递的坑（务必记）**：
- **按值传递**（默认，直接传状态变量）：状态变量变化 **不会** 刷新 Builder 内 UI。
- **按引用传递**（只传一个参数且传对象字面量 `{ ... }`）：**会** 刷新。✅ 日常推荐这个写法。
- **按回调传递**（`UIUtils.makeBinding`，API 20+）：需要读写联动时用，最灵活。

```typescript
class Tmp { public paramA1: string = ''; }

@Builder
function labelBuilder(params: Tmp) { Text(`value: ${params.paramA1}`) }

@Component
struct Demo {
  @State label: string = 'Hello';
  build() {
    Column() {
      labelBuilder({ paramA1: this.label })   // 引用传递，label 变化会刷新
      Button('Change').onClick(() => { this.label = 'ArkUI'; })
    }
  }
}
```

限制：Builder 内不能改参数（会运行时报错）；参数 ≥2 个且未用回调传递时不触发刷新。

---

## 4. 状态管理：驱动 UI 刷新

核心原理一句话：**只有被装饰器装饰的"状态变量"改变，才会触发 `build()` 重新渲染。** 不用状态变量，UI 只在初始化渲染一次，之后再也不刷新。

> 状态管理只能在 UI 主线程使用，不能在 Worker / TaskPool 里用。

### 4.1 V1 与 V2 怎么选

- **新项目直接用 V2**（官方建议）。V2 支持深度观测、属性级精准更新、数组元素最小化更新，装饰器职责更清晰（明确区分输入/输出），性能更好。
- V1 存量代码没必要立刻迁移。
- **同一个 `struct` 不能混用** `@Component` 与 `@ComponentV2`。

### 4.2 V2 装饰器（推荐）

| 装饰器 | 作用 |
|---|---|
| `@ComponentV2` | 声明 V2 自定义组件 |
| `@Local` | 组件内部状态，**不能从外部初始化** |
| `@Param` | 组件输入，可从父组件传入并同步（复杂类型是**引用**，不是深拷贝） |
| `@Once` | 与 `@Param` 连用，仅初始化时同步一次 |
| `@Event` | 组件输出（方法），子组件借此影响父组件变量 |
| `@Provider` / `@Consumer` | 跨层级双向同步 |
| `@Monitor` | 深度监听状态变量变化（一次事件多次变化只按最终值触发） |
| `@Computed` | 计算属性，依赖变化时只算一次（避免重复计算） |
| `!!` | 双向绑定的语法糖 |
| `@ObservedV2` | 装饰 class，使其具备深度监听能力（本身无观察能力） |
| `@Trace` | 装饰 `@ObservedV2` class 的属性，让该属性可被深度观测 |
| `PersistenceV2` | 数据持久化（可独立使用） |

```typescript
@Entry
@ComponentV2
struct Counter {
  @Local count: number = 0;
  @Param @Once title: string = '';
  @Event onCountChange: (n: number) => void = (n: number) => {};

  @Monitor('count')
  onCountChangeMonitor(monitor: IMonitor) {
    // monitor.value<number>()?.before / .now
  }

  build() {
    Column({ space: 12 }) {
      Text(this.title)
      Text(`count = ${this.count}`)
      Button('+1').onClick(() => { this.count++; this.onCountChange(this.count); })
    }
  }
}

// 嵌套对象的深度观测
@ObservedV2
class Task {
  @Trace title: string = '';
  @Trace done: boolean = false;
}
```

### 4.3 V1 装饰器（读老代码要用）

组件内：

| 装饰器 | 作用 |
|---|---|
| `@State` | 组件自己的数据源，变化触发本组件与子组件刷新；必须本地初始化 |
| `@Prop` | 与父组件**单向**同步（复杂类型深拷贝）；子组件可改，但改动不回传 |
| `@Link` | 与父组件**双向**同步；父传子时用 `$变量名` |
| `@Provide` / `@Consume` | 跨多层组件同步，靠别名/属性名匹配，无需逐层传参 |
| `@ObjectLink` + `@Observed` | 观察嵌套对象（其他 V1 装饰器只观察第一层） |
| `@Watch('cb')` | 监听状态变量变化 |
| `$$` | 把 TS 变量引用交给系统组件做双向同步 |

应用/页面级：

| 机制 | 作用 |
|---|---|
| `AppStorage` + `@StorageLink`/`@StorageProp` | 应用级全局状态（与进程绑定），Link 双向、Prop 单向 |
| `LocalStorage` + `@LocalStorageLink`/`@LocalStorageProp` | 页面级状态共享 |
| `PersistentStorage` | 与 AppStorage 耦合的持久化 |
| `Environment` | 环境变量（深色模式等） |

V1 → V2 对照：`@Component→@ComponentV2`、`@State→@Local`、`@Prop→@Param`、`@Link→@Param+@Event`(或 `!!`)、`@ObjectLink→@Param`、`@Provide/@Consume→@Provider/@Consumer`、`@Watch→@Monitor`、`@Observed→@ObservedV2+@Trace`、`$$→!!`。

```typescript
// V1 父子双向传值的典型写法
@Entry
@Component
struct ParentV1 {
  @State counter: number = 0;
  build() {
    Column() {
      ChildV1({ counter: $counter })     // 注意 $ 前缀
      Text(`parent: ${this.counter}`)
    }
  }
}

@Component
struct ChildV1 {
  @Link counter: number;                 // 不能本地初始化
  build() {
    Button(`child ${this.counter} +1`).onClick(() => { this.counter++; })
  }
}
```

### 4.4 生命周期（V1/V2 都支持）

```typescript
aboutToAppear()      // 组件创建后、build() 前：初始化数据、订阅
onDidBuild()         // build() 之后
aboutToDisappear()   // 组件销毁前：清理定时器、取消订阅
// 页面级（仅 @Entry）
onPageShow() / onPageHide() / onBackPress(): boolean
// 组件复用（@Reusable / @ReusableV2）
aboutToReuse(params) / aboutToRecycle()
```

---

## 5. 渲染控制

### 5.1 `if / else if / else`：条件渲染

写在容器组件的 `{}` 里，条件可用状态变量或普通变量（只有状态变量变化才会重渲染）。

```typescript
@Entry
@Component
struct IfExample {
  @State count: number = 0;
  build() {
    Column() {
      Text(`count=${this.count}`)
      if (this.count > 0) {
        Text('count is positive').fontColor(Color.Green)
      }
      Button('increase').onClick(() => { this.count++; })
    }
  }
}
```

**重要行为**：分支切换会**销毁旧组件、创建新组件**，所以子组件的 `@State` 会丢失。想保留状态就把状态提升到父组件，用 `@Link`（V1）/ `@Param+@Event`（V2）传引用。

```typescript
// 保留 counter 的写法：状态归父组件所有
KeepCounterView({ counter: $counter, label: 'A' })   // 两个分支共用同一个 $counter
```

条件渲染对父子组件关系是"透明"的：`Grid` 里只能放 `GridItem`，那么 `if` 分支里也只能放 `GridItem`。

### 5.2 `ForEach`：数组循环渲染

```typescript
ForEach(
  arr: Array<any>,                              // 数据源
  itemGenerator: (item: any, index?: number) => void,  // UI 模板
  keyGenerator?: (item: any, index?: number) => string // 键值生成
)
```

完整例子：

```typescript
interface ChildItemType { str: string; num: number }

@Entry
@Component
struct ListDemo {
  @State simpleList: Array<ChildItemType> = [
    { str: 'one', num: 1 },
    { str: 'two', num: 2 },
    { str: 'three', num: 3 }
  ];

  build() {
    Column() {
      ForEach(this.simpleList, (item: ChildItemType, index: number) => {
        ChildItem({ str: item.str, num: index })
      }, (item: ChildItemType, index: number) => item.str)  // 用与 UI 相关的稳定属性做 key
    }
    .width('100%')
  }
}
```

实践要点（照做就行）：
- **key 必须唯一且稳定**，建议用数据的业务 id（`item.id`），不要 `JSON.stringify`，框架默认实现是 `index + '__' + JSON.stringify(item)`，性能差。
- **不要在 key 里掺 `index`**：增删/换位会导致渲染错乱和性能下降。
- `itemGenerator` 声明了 `index`，`keyGenerator` 也要声明 `index`，否则框架会自动拼接 index。
- 数据源是对象数组、且有插入/删除/换位时，key 用对象的唯一 ID。
- `ForEach` 用于 `List` 时，子组件必须是 `ListItem`；用于 `Grid` 时必须是 `GridItem`。
- 长列表 / 需要懒加载时改用 **`LazyForEach`**（配合 `IDataSource`）+ `@Reusable` 组件复用。

### 5.3 `@BuilderParam` / `wrapBuilder`（进阶，知道有这个东西即可）

`@BuilderParam` 让父组件向子组件传入一段 UI（等价于 React 的 `children` / slot）；`@Styles` / `@Extend` 用于抽离公共样式和扩展系统组件属性。

---

## 6. 常用布局与组件速查

**布局容器**：`Column`（竖）、`Row`（横）、`Stack`（层叠）、`Flex`（弹性）、`RelativeContainer`（相对约束）、`List`+`ListItem`、`Grid`+`GridItem`、`Scroll`、`Swiper`。

```typescript
Column({ space: 12 }) {        // space：子项间距
  Text('A')
  Text('B')
}
.width('100%')
.height('100%')
.justifyContent(FlexAlign.Center)   // 主轴
.alignItems(HorizontalAlign.Start)   // 交叉轴
.padding(20)
.backgroundColor('#F1F3F5')
```

**高频通用属性**：`width` / `height` / `size` / `padding` / `margin` / `backgroundColor` / `borderRadius` / `border({ width: 1 })` / `opacity` / `visibility` / `offset` / `constraintSize`。
数字是 vp 单位，字符串 `'100%'` 是百分比；颜色支持 `Color.Red`、`'#FF0000'`、`0xF1F3F5`。

**基础组件**：`Text`（`fontSize`/`fontColor`/`fontWeight`/`maxLines`/`textOverflow`）、`Image`（网络图要配 `.alt()`）、`Button`、`TextInput`（`.onChange(v => ...)`）、`Toggle`、`Slider`、`Progress`、`Divider`、`Blank`、`Spacer`、`LoadingProgress`。

**资源引用**：`$r('app.string.title_value')`、`$r('app.media.icon')`、`$r('app.float.page_text_font_size')` —— 多语言、深色模式、屏幕适配都靠它。

---

## 7. 一个"能跑通"的最小完整页面

把上面串起来：计数器 + 列表 + 子组件 + 状态提升。

```typescript
// Index.ets
@Entry
@ComponentV2
struct Index {
  @Local count: number = 0;
  @Local todos: Array<Todo> = [new Todo('t1', '学习 ArkTS'), new Todo('t2', '写页面')];

  build() {
    Column({ space: 16 }) {
      Text(`Count: ${this.count}`)
        .fontSize(24)
        .fontColor(Color.Blue)

      Row({ space: 12 }) {
        Button('-1').onClick(() => { this.count--; })
        Button('+1').onClick(() => { this.count++; })
      }

      Divider()

      // 循环渲染 + 子组件双向传值
      ForEach(this.todos, (item: Todo) => {
        TodoItem({ task: item })
      }, (item: Todo) => item.id)

      // UI 片段复用（引用传递，会随 count 刷新）
      this.footer(`${this.count} items counted`)
    }
    .width('100%')
    .height('100%')
    .padding(20)
  }

  @Builder
  footer(text: string) {
    Text(text).fontSize(14).fontColor('#999')
  }
}

// 数据模型：V2 深度观测
@ObservedV2
class Todo {
  id: string;
  @Trace title: string;
  @Trace done: boolean = false;
  constructor(id: string, title: string) { this.id = id; this.title = title; }
}

// 子组件：@Param 输入，直接改引用对象（V2 深度观测生效）
@ComponentV2
struct TodoItem {
  @Param task: Todo = new Todo('', '');
  build() {
    Row({ space: 10 }) {
      Checkbox().select(this.task.done)
        .onChange((v: boolean) => { this.task.done = v; })
      Text(this.task.title)
        .decoration({ type: this.task.done ? TextDecorationType.LineThrough : TextDecorationType.None })
    }
  }
}
```

---

## 8. 迁移与上手建议

1. **工具**：DevEco Studio（内置 ArkTS 语法检查和实时预览 Previewer）。ArkTS 的类型检查在开发期就报错，别指望运行时。
2. **写代码的顺序**：先用 `.ets` 写 `@Entry` 页面骨架 → 拆 `@ComponentV2` 子组件 → 用 `@Local/@Param/@Event` 接数据 → 用 `@ObservedV2/@Trace` 建模 → 需要时再学 `AppStorageV2`/`PersistenceV2`。
3. **报错翻译器**：编译器抱怨 "Use explicit types instead of 'any'/'unknown'"、"Object literal must correspond to some explicitly declared class or interface"、"Structural typing is not supported"、"Use 'class' instead of 'interface' for type declaration" 时，回到本文 2.1/2.3 节。
4. **别把这些当成 ArkTS 特性去查**：Ability/Stage 模型、UIAbility 生命周期、路由（`Navigation`/`router`）、权限、网络（`@kit.NetworkKit`）、数据持久化（`@kit.ArkData`）属于**框架/SDK** 层，ArkTS 只是语言。
5. **官方文档入口**：
   - ArkTS 概览：<https://developer.huawei.com/consumer/cn/arkts/>
   - 学习 ArkTS 语言（初识 / 语言介绍 / 编程规范 / 高性能实践）：<https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/learning-arkts>
   - 从 TypeScript 到 ArkTS 的适配规则：<https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/typescript-to-arkts-migration-guide>
   - ArkTS（方舟编程语言）能力指南：<https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/arkts>
   - ArkUI 声明式开发范式（基本语法 / 状态管理 / 渲染控制 / 自定义组件）：<https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/arkts-ui-development>

---

## 附录：一句话记住的 15 条军规

1. 不要写 `any` / `unknown` / `@ts-ignore`，类型必须具体。
2. 对象字面量必须有目标类型（先写 `interface`）。
3. 不能解构，`let {a,b} = obj` 一律改成逐字段赋值。
4. 运行时不能给对象加/删属性，`delete` 完全不能用。
5. class 字段必须显式初始化，没有 `!` 后门；私有用 `private` 不用 `#`。
6. 形状相同不等于类型相同——必须 `implements` 或继承。
7. `var` 改 `let`；`for...in` 改 `for...of`。
8. `this` 只能在类的实例方法里用，事件回调一律箭头函数。
9. 类型转换只写 `value as T`，`catch (e)` 里不能标类型。
10. 页面 = 一个 `@Entry @Component(V2) struct` + 唯一容器根节点 + `build()`。
11. `build()` 里没有局部变量、没有 `switch`、没有裸 `console.info`。
12. UI 不刷新，先检查那个变量有没有被状态装饰器装饰。
13. 新工程用 V2：`@Local`（内部）、`@Param`（输入）、`@Event`（输出）、`@ObservedV2`+`@Trace`（模型）。
14. `ForEach` 的 key 用业务唯一 ID，别掺 `index`；长列表上 `LazyForEach`。
15. SDK 能力统一从 `@kit.XxxKit` 导入。
