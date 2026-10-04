// 演示项目「马克代办」的初始文件内容（与教程示例一致，含可用于制造冲突的按钮行）

export const ADD_BTN_LINE = '      <button type="submit" id="add-btn">添加</button>';

export const SAMPLE_FILES: Record<string, string> = {
  'index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>马克代办</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="app">
    <h1>马克代办</h1>
    <form id="add-form">
      <input id="todo-input" placeholder="添加一条待办…">
${ADD_BTN_LINE}
    </form>
    <ul id="todo-list"></ul>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
  'app.js': `const todos = [];

function addTodo(text) {
  todos.push({ text, done: false });
  render();
}

function render() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  for (const todo of todos) {
    const li = document.createElement('li');
    li.textContent = todo.text;
    list.appendChild(li);
  }
}

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  addTodo(document.getElementById('todo-input').value);
});
`,
  'styles.css': `body { font-family: sans-serif; background: #f6f8fb; }
.app { max-width: 480px; margin: 40px auto; background: #fff; padding: 24px; border-radius: 12px; }
#todo-list li { padding: 8px 0; border-bottom: 1px solid #eee; }
`,
  'README.md': `# 马克代办

一个极简的待办事项小页面，用于 Git 可视化实验室的演示。

## 使用

直接用浏览器打开 index.html 即可。

## 后续计划

- 具体内容待补充
`,
};

export function initialWorkFiles(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(SAMPLE_FILES)) out[k] = v.split('\n');
  return out;
}

/** 在文件中找到 find 行，替换为 replaceLines（找不到返回 false） */
export function editLine(lines: string[], find: string, replaceLines: string[]): boolean {
  const i = lines.indexOf(find);
  if (i === -1) return false;
  lines.splice(i, 1, ...replaceLines);
  return true;
}
