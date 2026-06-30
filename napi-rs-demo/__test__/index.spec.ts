import test from 'ava'

import { plus100, asyncTask, Calculator, divide } from '../index'

test('同步函数：plus100 对输入加 100', (t) => {
  const fixture = 42
  t.is(plus100(fixture), fixture + 100)
})

test('异步函数：asyncTask 返回带前缀的处理结果', async (t) => {
  const result = await asyncTask('hello')
  t.is(result, 'processed: hello')
})

test('Rust 导出类：Calculator 累加器', (t) => {
  const calculator = new Calculator()
  t.is(calculator.add(10), 10)
  t.is(calculator.add(10), 20)
})

test('错误处理：divide 除零应抛出异常', (t) => {
  t.is(divide(10, 2), 5)
  t.throws(() => divide(1, 0), { message: /division by zero/ })
})