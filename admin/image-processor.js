const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Não foi possível ler a imagem selecionada."));
        };
        image.src = url;
    });
}

function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error("Falha ao converter a imagem.")),
            "image/webp",
            quality
        );
    });
}

async function resize(image, maxDimension, initialQuality, targetBytes) {
    const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * ratio));
    let height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");

    for (let attempt = 0; attempt < 20; attempt += 1) {
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, width, height);

        let quality = initialQuality;
        let blob = await canvasToBlob(canvas, quality);
        while (blob.size > targetBytes && quality > 0.36) {
            quality = Math.max(0.36, quality - 0.06);
            blob = await canvasToBlob(canvas, quality);
        }

        if (blob.size <= targetBytes) return blob;

        width = Math.max(1, Math.round(width * 0.85));
        height = Math.max(1, Math.round(height * 0.85));
    }

    throw new Error("Não foi possível preparar esta foto. Escolha uma imagem de até 15 MB ou uma versão com resolução menor.");
}

export async function processImage(file) {
    if (!ACCEPTED_TYPES.has(file.type)) {
        throw new Error("Use uma imagem JPEG, PNG ou WebP.");
    }
    if (file.size > MAX_INPUT_BYTES) {
        throw new Error("A imagem original deve ter no máximo 15 MB.");
    }

    const image = await loadImage(file);
    const [main, thumbnail] = await Promise.all([
        resize(image, 1600, 0.78, 850 * 1024),
        resize(image, 480, 0.72, 140 * 1024)
    ]);

    return {
        main,
        thumbnail,
        originalBytes: file.size,
        optimizedBytes: main.size + thumbnail.size
    };
}

export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
