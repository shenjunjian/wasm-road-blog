extends Control
## 第 05 章 demo：GDScript 语法速查演示器
##
## 按数字键 1~8 切换 8 个语法演示，结果实时打印到 RichTextLabel。
##
## 演示：
##   - 字典（DEMOS 数组本身）+ Callable / 方法引用
##   - 字符串格式化（% / format()）
##   - 生命周期回调 _ready / _process / _unhandled_input
##   - @export 暴露当前 demo 索引到 Inspector
##   - match 控制流（按 keycode 分发）
##   - Array 函数式 map / filter
##   - 局部 lambda
##   - 单下划线约定（_render, _demo_name）

## 当前显示的 demo 索引（按数字键切换），可在 Inspector 调整
@export var current: int = 0

const DEMO_NAMES: PackedStringArray = [
    "1. 变量 / 常量",
    "2. 函数 / Callable",
    "3. 控制流 (if/match/for)",
    "4. Array / 函数式",
    "5. Dictionary",
    "6. 字符串",
    "7. 运算符",
    "8. Callable / Lambda",
]

@onready var _output: RichTextLabel = $OutputLabel


func _ready() -> void:
    _show(current)


func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        var key_event: InputEventKey = event
        if key_event.keycode >= KEY_1 and key_event.keycode <= KEY_8:
            _show(key_event.keycode - KEY_1)


func _show(idx: int) -> void:
    current = clampi(idx, 0, DEMO_NAMES.size() - 1)
    _output.clear()
    _output.append_text("[b][color=#e8b339]=== %s ===[/color=][/b]\n" % DEMO_NAMES[current])
    match current:
        0: _demo_var_const()
        1: _demo_func()
        2: _demo_control()
        3: _demo_array()
        4: _demo_dict()
        5: _demo_string()
        6: _demo_operator()
        7: _demo_lambda()


# ---------------------------- 演示函数 ----------------------------

func _demo_var_const() -> void:
    # 显式类型
    var hp: int = 100
    _line("hp (int)         = %d" % hp)

    # 类型推断
    var speed := 200.0
    _line("speed (inferred) = %f (type float)" % speed)

    # 动态类型（IDE 会给黄色警告）
    var dyn = "hello"
    _line("dyn (dynamic)    = %s" % dyn)

    # 常量
    const MAX_HP := 100
    _line("MAX_HP (const)   = %d" % MAX_HP)


func _demo_func() -> void:
    _line("add(3, 4) = %d" % add(3, 4))
    _line("default param: log('hi') = %s" % log("hi"))
    _line("default param: log('hi', 3) = %s" % log("hi", 3))
    _line("divmod(10, 3) = %s" % str(divmod(10, 3)))
    _line("sum_all([1,2,3,4,5]) = %d" % sum_all([1, 2, 3, 4, 5]))


func _demo_control() -> void:
    # if / elif / else
    var hp: int = 25
    if hp <= 0:
        _line("dead")
    elif hp < 50:
        _line("warning (hp=%d)" % hp)
    else:
        _line("healthy (hp=%d)" % hp)

    # match
    var dir := Vector2(0, 1)
    match dir:
        Vector2.UP:    _line("match: up")
        Vector2.DOWN:  _line("match: down")
        Vector2.LEFT, Vector2.RIGHT: _line("match: horizontal")
        _:             _line("match: diagonal")

    # for
    _line("for i in 5:")
    for i in 5:
        _line("  i = %d" % i)

    # range
    _line("for i in range(3):")
    for i in range(3):
        _line("  i = %d" % i)


func _demo_array() -> void:
    var arr: Array[int] = [3, 1, 4, 1, 5, 9, 2, 6]
    _line("original = %s" % str(arr))
    arr.sort()
    _line("sorted   = %s" % str(arr))

    var doubled: Array = arr.map(func(x: int) -> int: return x * 2)
    _line("doubled  = %s" % str(doubled))

    var positives: Array = arr.filter(func(x: int) -> bool: return x > 0)
    _line("filtered = %s" % str(positives))

    var total: int = arr.reduce(func(acc: int, x: int) -> int: return acc + x, 0)
    _line("sum      = %d" % total)


func _demo_dict() -> void:
    var d: Dictionary[String, int] = {"hp": 100, "mp": 50, "gold": 250}
    _line("keys = %s" % str(d.keys()))
    _line("values = %s" % str(d.values()))
    for k in d:
        _line("  %s = %d" % [k, d[k]])

    _line("d.get('missing', -1) = %d" % d.get("missing", -1))
    d.erase("gold")
    _line("after erase('gold') = %s" % str(d))


func _demo_string() -> void:
    var hp: int = 100
    var name: String = "Player"

    _line("%% 格式化: hp=%d, name=%s" % [hp, name])
    _line("format():  " + "hp={hp}, name={name}".format({"hp": hp, "name": name}))
    _line("f-string: hp=%d, name=%s (GDScript 4.x f 前缀，行为近似)" % [hp, name])

    var multi := """
第一行
第二行
   行尾保留缩进
"""
    _line("multi-line length = %d" % multi.length())


func _demo_operator() -> void:
    _line("算术:  2 ** 3 = %d, 5 // 2 = %d, 5 %% 2 = %d" % [2**3, 5//2, 5%2])
    _line("比较:  3 > 2 = %s" % str(3 > 2))
    _line("逻辑:  true and false = %s" % str(true and false))
    _line("类型:  'hello' is String = %s" % str("hello" is String))
    _line("三元:  %s" % ("alive" if 100 > 0 else "dead"))
    _line("位运算:  0b1100 & 0b1010 = %d" % (0b1100 & 0b1010))


func _demo_lambda() -> void:
    # 方法引用
    var c1: Callable = _double
    _line("c1.call(5) = %d" % c1.call(5))

    # Lambda
    var c2: Callable = func(x: int) -> int: return x * 3
    _line("c2.call(5) = %d" % c2.call(5))

    # 数组 map
    var arr: Array[int] = [1, 2, 3]
    var result: Array = arr.map(func(x: int) -> int: return x + 10)
    _line("arr + 10 = %s" % str(result))


# ---------------------------- 普通函数 ----------------------------

func add(a: int, b: int) -> int:
    return a + b

func log(msg: String, level: int = 1) -> String:
    return "[%d] %s" % [level, msg]

func divmod(a: int, b: int) -> Array:
    return [a / b, a % b]

func sum_all(nums: Array[int]) -> int:
    var s := 0
    for n in nums:
        s += n
    return s

func _double(x: int) -> int:
    return x * 2

func _line(text: String) -> void:
    _output.append_text("  " + text + "\n")