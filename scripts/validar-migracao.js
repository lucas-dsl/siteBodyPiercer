import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const INVENTORY_PATH = path.join(ROOT, "migration", "inventario.json");
const VALIDATION_PATH = path.join(ROOT, "migration", "validacao.json");
const BUCKET = "galeria";

async function loadLocalEnv() {
    const content = await fs.readFile(ENV_PATH, "utf8");
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

function credentials() {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Credenciais ausentes no .env.local.");
    return { url, key };
}

function headers(config, extra = {}) {
    return {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        ...extra
    };
}

async function request(url, options, label) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    throw new Error(`${label} falhou (${response.status}): ${await response.text()}`);
}

async function listStorage(folder, config) {
    const response = await request(
        `${config.url}/storage/v1/object/list/${BUCKET}`,
        {
            method: "POST",
            headers: headers(config, { "Content-Type": "application/json" }),
            body: JSON.stringify({
                prefix: folder,
                limit: 1000,
                offset: 0,
                sortBy: { column: "name", order: "asc" }
            })
        },
        `Listagem de ${folder}`
    );
    return response.json();
}

async function validateUrls(urls, concurrency = 10) {
    const failures = [];
    let cursor = 0;

    async function worker() {
        while (cursor < urls.length) {
            const current = urls[cursor];
            cursor += 1;
            try {
                const response = await fetch(current.url, { method: "HEAD" });
                if (!response.ok) failures.push({ caminho: current.path, status: response.status });
            } catch (error) {
                failures.push({ caminho: current.path, erro: error.message });
            }
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return failures;
}

async function main() {
    await loadLocalEnv();
    const config = credentials();
    const inventory = JSON.parse(await fs.readFile(INVENTORY_PATH, "utf8"));
    const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
    const htmlItems = [...html.matchAll(/src="imgs\/(?:catalogoJoias|portfolio)\//g)].length;
    const expectedIds = new Set(inventory.map(deterministicUuid));

    const rowsResponse = await request(
        `${config.url}/rest/v1/galeria?select=arquivo_id,categoria,ordem&order=categoria.asc,ordem.asc`,
        { headers: headers(config) },
        "Consulta da galeria"
    );
    const rows = await rowsResponse.json();
    const [mainObjects, thumbnailObjects] = await Promise.all([
        listStorage("imagens", config),
        listStorage("miniaturas", config)
    ]);

    const mainNames = new Set(mainObjects.map((item) => item.name));
    const thumbnailNames = new Set(thumbnailObjects.map((item) => item.name));
    const expectedNames = new Set([...expectedIds].map((id) => `${id}.webp`));
    const unexpectedRows = rows.filter((row) => !expectedIds.has(row.arquivo_id));
    const missingRows = [...expectedIds].filter((id) => !rows.some((row) => row.arquivo_id === id));
    const missingMain = [...expectedNames].filter((name) => !mainNames.has(name));
    const missingThumbnails = [...expectedNames].filter((name) => !thumbnailNames.has(name));
    const unexpectedMain = [...mainNames].filter((name) => !expectedNames.has(name));
    const unexpectedThumbnails = [...thumbnailNames].filter((name) => !expectedNames.has(name));

    const urls = [...expectedIds].flatMap((id) => [
        {
            path: `imagens/${id}.webp`,
            url: `${config.url}/storage/v1/object/public/${BUCKET}/imagens/${id}.webp`
        },
        {
            path: `miniaturas/${id}.webp`,
            url: `${config.url}/storage/v1/object/public/${BUCKET}/miniaturas/${id}.webp`
        }
    ]);
    const urlFailures = await validateUrls(urls);

    const checks = {
        itens_html: htmlItems,
        registros_inventario: inventory.length,
        registros_banco: rows.length,
        imagens_principais: mainObjects.length,
        miniaturas: thumbnailObjects.length,
        urls_testadas: urls.length,
        urls_com_erro: urlFailures.length
    };
    const valid =
        Object.values(checks).slice(0, 5).every((count) => count === inventory.length) &&
        checks.urls_testadas === inventory.length * 2 &&
        checks.urls_com_erro === 0 &&
        unexpectedRows.length === 0 && missingRows.length === 0 &&
        missingMain.length === 0 && missingThumbnails.length === 0 &&
        unexpectedMain.length === 0 && unexpectedThumbnails.length === 0;

    const result = {
        valida: valid,
        validado_em: new Date().toISOString(),
        contagens: checks,
        divergencias: {
            registros_inesperados: unexpectedRows,
            registros_ausentes: missingRows,
            imagens_ausentes: missingMain,
            miniaturas_ausentes: missingThumbnails,
            imagens_inesperadas: unexpectedMain,
            miniaturas_inesperadas: unexpectedThumbnails,
            urls_com_erro: urlFailures
        }
    };
    await fs.writeFile(VALIDATION_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

    console.table(checks);
    console.log(valid ? "Migração validada com sucesso." : "Migração possui divergências.");
    if (!valid) process.exitCode = 1;
}

main().catch((error) => {
    console.error(`Erro: ${error.message}`);
    process.exitCode = 1;
});
