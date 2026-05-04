import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = process.cwd();
const schemaDir = join(packageRoot, "schema");
const outputPath = join(packageRoot, "ERD.md");

const SCALAR_TYPES = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
]);

function cleanType(rawType) {
  return rawType.replace(/[?\[\]]/g, "");
}

function fieldCardinality(rawType) {
  if (rawType.endsWith("[]")) return "many";
  if (rawType.endsWith("?")) return "optional";
  return "one";
}

function mermaidSide(cardinality) {
  if (cardinality === "many") return "o{";
  if (cardinality === "optional") return "o|";
  return "||";
}

function extractBlocks(schema, keyword) {
  const regex = new RegExp(`${keyword}\\s+(\\w+)\\s*\\{([\\s\\S]*?)\\n\\}`, "g");
  return [...schema.matchAll(regex)].map((match) => ({
    name: match[1],
    body: match[2],
  }));
}

function parseModelFields(body) {
  const fields = [];

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

    const tokens = line.split(/\s+/);
    if (tokens.length < 2) continue;

    const [name, rawType] = tokens;
    if (name.startsWith("@")) continue;

    fields.push({
      name,
      rawType,
      type: cleanType(rawType),
      cardinality: fieldCardinality(rawType),
      isRelation: false,
    });
  }

  return fields;
}

async function loadMergedSchema() {
  const entries = await readdir(schemaDir);
  const prismaFiles = entries.filter((file) => file.endsWith(".prisma"));
  const orderedFiles = [
    ...prismaFiles.filter((file) => file === "schema.prisma"),
    ...prismaFiles.filter((file) => file !== "schema.prisma").sort(),
  ];

  const contents = await Promise.all(
    orderedFiles.map((file) => readFile(join(schemaDir, file), "utf8")),
  );

  return contents.join("\n\n");
}

function buildErd(schema) {
  const modelBlocks = extractBlocks(schema, "model");
  const enumBlocks = extractBlocks(schema, "enum");
  const modelNames = new Set(modelBlocks.map((block) => block.name));

  const models = modelBlocks.map((block) => {
    const fields = parseModelFields(block.body).map((field) => ({
      ...field,
      isRelation: modelNames.has(field.type),
    }));
    return { name: block.name, fields };
  });

  const relationLines = [];
  const seen = new Set();

  for (const model of models) {
    for (const field of model.fields.filter((item) => item.isRelation)) {
      const target = models.find((item) => item.name === field.type);
      if (!target) continue;

      const backField = target.fields.find((item) => item.type === model.name);
      const leftModel = backField ? target.name : model.name;
      const rightModel = backField ? model.name : target.name;
      const leftCardinality = backField
        ? mermaidSide(backField.cardinality)
        : mermaidSide(field.cardinality);
      const rightCardinality = backField
        ? mermaidSide(field.cardinality)
        : mermaidSide(target.fields.find((item) => item.type === model.name)?.cardinality ?? "many");

      const relationKey = [leftModel, rightModel].sort().join(":");
      if (seen.has(relationKey)) continue;
      seen.add(relationKey);

      relationLines.push(
        `  ${leftModel} ${leftCardinality}--${rightCardinality} ${rightModel} : relates_to`,
      );
    }
  }

  const lines = ["# ERD", "", "```mermaid", "erDiagram"];

  for (const model of models) {
    lines.push(`  ${model.name} {`);
    for (const field of model.fields.filter((item) => !item.isRelation)) {
      const fieldType = enumBlocks.some((block) => block.name === field.type)
        ? "enum"
        : SCALAR_TYPES.has(field.type)
          ? field.type
          : field.type;
      lines.push(`    ${fieldType} ${field.name}`);
    }
    lines.push("  }");
  }

  if (relationLines.length) {
    lines.push("");
    lines.push(...relationLines.sort());
  }

  lines.push("```", "");
  return lines.join("\n");
}

async function main() {
  const schema = await loadMergedSchema();
  const erd = buildErd(schema);
  await writeFile(outputPath, erd, "utf8");
  console.log(`ERD written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
