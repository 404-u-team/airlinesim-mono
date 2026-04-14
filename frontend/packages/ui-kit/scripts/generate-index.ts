import { readdir } from "node:fs/promises";
import { join } from "node:path";

// Путь к папке components
const componentsDir = join(import.meta.dir, "../src/components");

async function generate() {
  // Читаем всё, что есть в папке components
  const files = await readdir(componentsDir, { withFileTypes: true });

  const componentNames = files
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  if (componentNames.length === 0) {
    console.log("Компоненты не найдены.");
    return;
  }

  let fileContent = `// THIS FILE IS GENERATED!\n`;
  fileContent += `// DO NOT EDIT!!\n`;
  fileContent += `/* oxlint-disable */\n\n`

  // 1. Генерируем импорты
  componentNames.forEach(name => {
    fileContent += `import { ${name}, register${name} } from './${name}';\n`;
  });

  // 2. Генерируем функцию массовой регистрации
  fileContent += `\nexport function registerAllComponents() {\n`;
  componentNames.forEach(name => {
    fileContent += `  register${name}();\n`;
  });
  fileContent += `}\n\n`;

  // 3. Генерируем экспорты
  fileContent += `export {\n`;
  componentNames.forEach(name => {
    fileContent += `  ${name},\n  register${name},\n`;
  });
  fileContent += `};\n`;

  // Записываем собранный код в src/components/index.ts
  const outputPath = join(componentsDir, "index.ts");
  await Bun.write(outputPath, fileContent);

  console.log(`✅ Сгенерирован index.ts для ${componentNames.length} компонентов!`);
}

generate();