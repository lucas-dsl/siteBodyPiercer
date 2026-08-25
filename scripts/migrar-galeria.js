import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const INVENTORY_PATH = path.join(ROOT, "migration", "inventario.json");
const RESULT_PATH = path.join(ROOT, "migration", "resultado.json");
const ENV_PATH = path.join(ROOT, ".env.local");
const BUCKET = "galeria";
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAIN_TARGET_BYTES = 850 * 1024;
const THUMBNAIL_TARGET_BYTES = 140 * 1024;
const ACCEPTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DRY_RUN = process.argv.includes("--dry-run");
const ALLOWED_ARGS = new Set(["--dry-run", "--help"]);

function showHelp() {
    console.log(`Uso:
  node scripts/migrar-galeria.js --dry-run  Simula e valida sem acessar o Supabase
  node scripts/migrar-galeria.js            Executa a migração real

Variáveis exigidas em .env.local para a migração real:
  SUPABASE_URL=https://seu-projeto.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta`);
}

function assertArguments() {
    const invalid = process.argv.slice(2).filter((argument) => !ALLOWED_ARGS.has(argument));
    if (invalid.length > 0) {
        throw new Error(`Argumento desconhecido: ${invalid.join(", ")}. Use --help para consultar o uso.`);
    }
}

async function loadLocalEnv() {
    let content;
    try {
        content = await fs.readFile(ENV_PATH, "utf8");
    } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
    }

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const separator = line.indexOf("=");
        if (separator < 1) continue;

        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!(key in process.env)) process.env[key] = value;
    }
}

function deterministicUuid(item) {
    const hash = crypto
        .createHash("sha256")
        .update(`site-body-piercer:${item.categoria}:${item.arquivo_local}`)
        .digest();

    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function loadInventory() {
    const inventory = JSON.parse(await fs.readFile(INVENTORY_PATH, "utf8"));
    if (!Array.isArray(inventory) || inventory.length === 0) {
        throw new Error("O inventario.json está vazio ou inválido.");
    }
    return inventory;
}

async function validateInventory(inventory) {
    const validCategories = new Set([
        "joia_titanio",
        "joia_gold",
        "perfuracao_orelha",
        "perfuracao_outras"
    ]);
    const orderKeys = new Set();
    const errors = [];
    const warnings = [];

    for (const [index, item] of inventory.entries()) {
        const label = `Item ${index + 1}`;
        if (!item.arquivo_local || !item.titulo || !item.categoria || !Number.isInteger(item.ordem)) {
            errors.push(`${label}: campos obrigatórios inválidos.`);
            continue;
        }
        if (!validCategories.has(item.categoria)) {
            errors.push(`${label}: categoria inválida (${item.categoria}).`);
        }
        if (item.ordem < 0 || item.ordem > 9999) {
            errors.push(`${label}: ordem fora do intervalo de 0 a 9999.`);
        }
        if (item.titulo.length > 100 || (item.descricao || "").length > 500) {
            errors.push(`${label}: título ou descrição excede o limite do banco.`);
        }

        const orderKey = `${item.categoria}:${item.ordem}`;
        if (orderKeys.has(orderKey)) errors.push(`${label}: ordem duplicada (${orderKey}).`);
        orderKeys.add(orderKey);

        const absolutePath = path.resolve(ROOT, item.arquivo_local);
        const relativePath = path.relative(ROOT, absolutePath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            errors.push(`${label}: arquivo fora do projeto.`);
        } else {
            try {
                const stat = await fs.stat(absolutePath);
                const extension = path.extname(absolutePath).toLowerCase();
                if (!stat.isFile()) errors.push(`${label}: caminho não é um arquivo.`);
                if (!ACCEPTED_EXTENSIONS.has(extension)) errors.push(`${label}: formato não aceito (${extension}).`);
                if (stat.size > MAX_INPUT_BYTES) errors.push(`${label}: imagem original excede 15 MB.`);
            } catch (error) {
                if (error.code === "ENOENT") errors.push(`${label}: arquivo não encontrado (${item.arquivo_local}).`);
                else throw error;
            }
        }

        if (item.possivel_duplicidade) {
            warnings.push(`${label} (${item.arquivo_local}): ${item.possivel_duplicidade}`);
        }
    }

    return { errors, warnings };
}

async function optimizeImage(inputPath, maxDimension, initialQuality, targetBytes) {
    const metadata = await sharp(inputPath).metadata();
    let width = metadata.width;
    let height = metadata.height;
    if (!width || !height) throw new Error("Não foi possível identificar as dimensões da imagem.");

    const ratio = Math.min(1, maxDimension / Math.max(width, height));
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));

    for (let attempt = 0; attempt < 20; attempt += 1) {
        for (let quality = initialQuality; quality >= 36; quality -= 6) {
            const buffer = await sharp(inputPath)
                .rotate()
                .flatten({ background: "#ffffff" })
                .resize({ width, height, fit: "inside", withoutEnlargement: true })
                .webp({ quality })
                .toBuffer();

            if (buffer.length <= targetBytes) return buffer;
        }

        width = Math.max(1, Math.round(width * 0.85));
        height = Math.max(1, Math.round(height * 0.85));
    }

    throw new Error(`Não foi possível reduzir a imagem para ${Math.round(targetBytes / 1024)} KB.`);
}

async function prepareItem(item) {
    const inputPath = path.resolve(ROOT, item.arquivo_local);
    const stat = await fs.stat(inputPath);
    const [main, thumbnail] = await Promise.all([
        optimizeImage(inputPath, 1600, 78, MAIN_TARGET_BYTES),
        optimizeImage(inputPath, 480, 72, THUMBNAIL_TARGET_BYTES)
    ]);

    return {
        ...item,
        arquivo_id: deterministicUuid(item),
        inputPath,
        originalBytes: stat.size,
        main,
        thumbnail
    };
}

function getCredentials() {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
        throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
    }
    if (!url.startsWith("https://")) throw new Error("SUPABASE_URL inválida.");
    return { url, serviceRoleKey };
}

function authHeaders(credentials, extra = {}) {
    return {
        apikey: credentials.serviceRoleKey,
        Authorization: `Bearer ${credentials.serviceRoleKey}`,
        ...extra
    };
}

async function request(url, options, action) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    const detail = await response.text();
    throw new Error(`${action} falhou (${response.status}): ${detail}`);
}

async function ensureNoRemoteOrderConflicts(inventory, credentials) {
    const response = await request(
        `${credentials.url}/rest/v1/galeria?select=arquivo_id,categoria,ordem`,
        { headers: authHeaders(credentials) },
        "Consulta de conflitos"
    );
    const existing = await response.json();
    const expectedIds = new Set(inventory.map(deterministicUuid));
    const desiredOrders = new Set(inventory.map((item) => `${item.categoria}:${item.ordem}`));
    const conflicts = existing.filter((row) =>
        desiredOrders.has(`${row.categoria}:${row.ordem}`) && !expectedIds.has(row.arquivo_id)
    );

    if (conflicts.length > 0) {
        const details = conflicts
            .map((row) => `${row.categoria}, ordem ${row.ordem}, arquivo_id ${row.arquivo_id}`)
            .join("; ");
        throw new Error(`Existem ordens ocupadas por registros fora deste inventário: ${details}`);
    }
}

async function uploadObject(storagePath, buffer, credentials) {
    await request(
        `${credentials.url}/storage/v1/object/${BUCKET}/${storagePath}`,
        {
            method: "POST",
            headers: authHeaders(credentials, {
                "Content-Type": "image/webp",
                "x-upsert": "true"
            }),
            body: buffer
        },
        `Upload de ${storagePath}`
    );
}

async function upsertRow(item, credentials) {
    const row = {
        arquivo_id: item.arquivo_id,
        categoria: item.categoria,
        titulo: item.titulo,
        descricao: item.descricao || null,
        ordem: item.ordem,
        ativo: true
    };

    await request(
        `${credentials.url}/rest/v1/galeria?on_conflict=arquivo_id`,
        {
            method: "POST",
            headers: authHeaders(credentials, {
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=minimal"
            }),
            body: JSON.stringify(row)
        },
        `Cadastro de ${item.arquivo_local}`
    );
}

async function migrateItem(item, credentials) {
    const mainPath = `imagens/${item.arquivo_id}.webp`;
    const thumbnailPath = `miniaturas/${item.arquivo_id}.webp`;
    await uploadObject(mainPath, item.main, credentials);
    await uploadObject(thumbnailPath, item.thumbnail, credentials);
    await upsertRow(item, credentials);
}

async function saveResult(result) {
    await fs.writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main() {
    assertArguments();
    if (process.argv.includes("--help")) {
        showHelp();
        return;
    }

    await loadLocalEnv();
    const inventory = await loadInventory();
    const validation = await validateInventory(inventory);
    if (validation.errors.length > 0) {
        throw new Error(`Inventário inválido:\n- ${validation.errors.join("\n- ")}`);
    }

    console.log(`Modo: ${DRY_RUN ? "simulação" : "migração real"}`);
    console.log(`Itens: ${inventory.length}`);
    if (validation.warnings.length > 0) {
        console.log(`Avisos de possível duplicidade: ${validation.warnings.length}`);
    }

    if (!DRY_RUN && validation.warnings.length > 0) {
        throw new Error(
            "O inventário ainda possui possíveis duplicidades. Revise-as e remova os avisos antes da migração real."
        );
    }

    const credentials = DRY_RUN ? null : getCredentials();
    if (credentials) await ensureNoRemoteOrderConflicts(inventory, credentials);

    const results = [];
    for (const [index, inventoryItem] of inventory.entries()) {
        process.stdout.write(`[${index + 1}/${inventory.length}] ${inventoryItem.arquivo_local} ... `);
        try {
            const item = await prepareItem(inventoryItem);
            if (credentials) await migrateItem(item, credentials);
            results.push({
                arquivo_local: item.arquivo_local,
                arquivo_id: item.arquivo_id,
                status: DRY_RUN ? "simulado" : "migrado",
                bytes_original: item.originalBytes,
                bytes_principal: item.main.length,
                bytes_miniatura: item.thumbnail.length
            });
            console.log("ok");
        } catch (error) {
            results.push({
                arquivo_local: inventoryItem.arquivo_local,
                arquivo_id: deterministicUuid(inventoryItem),
                status: "erro",
                erro: error.message
            });
            console.log("erro");
            if (!DRY_RUN) break;
        }
    }

    const result = {
        modo: DRY_RUN ? "dry-run" : "real",
        executado_em: new Date().toISOString(),
        total: inventory.length,
        sucessos: results.filter((item) => item.status !== "erro").length,
        erros: results.filter((item) => item.status === "erro").length,
        avisos: validation.warnings,
        itens: results
    };
    await saveResult(result);

    console.log(`Resultado salvo em ${path.relative(ROOT, RESULT_PATH)}.`);
    if (result.erros > 0) process.exitCode = 1;
}

main().catch(async (error) => {
    console.error(`Erro: ${error.message}`);
    try {
        await saveResult({
            modo: DRY_RUN ? "dry-run" : "real",
            executado_em: new Date().toISOString(),
            status: "bloqueado",
            erro: error.message
        });
    } catch {
        // A mensagem principal já foi exibida; falha ao gravar o relatório não a substitui.
    }
    process.exitCode = 1;
});
