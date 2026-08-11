import { exigirSupabaseConfigurado, supabase, supabaseConfigurado } from "../js/supabase-client.js";
import { formatBytes, processImage } from "./image-processor.js";

const BUCKET = "galeria";
const categories = {
    joia_titanio: "Joias — Titânio",
    joia_gold: "Joias — PVD Gold",
    perfuracao_orelha: "Perfurações — Orelha",
    perfuracao_outras: "Perfurações — Outras"
};

const elements = {
    configAlert: document.querySelector("#config-alert"),
    globalFeedback: document.querySelector("#global-feedback"),
    userEmail: document.querySelector("#user-email"),
    logout: document.querySelector("#logout-button"),
    newButton: document.querySelector("#new-button"),
    search: document.querySelector("#search"),
    categoryFilter: document.querySelector("#category-filter"),
    statusFilter: document.querySelector("#status-filter"),
    totalCount: document.querySelector("#total-count"),
    publishedCount: document.querySelector("#published-count"),
    hiddenCount: document.querySelector("#hidden-count"),
    loading: document.querySelector("#loading"),
    empty: document.querySelector("#empty-state"),
    grid: document.querySelector("#gallery-grid"),
    dialog: document.querySelector("#item-dialog"),
    form: document.querySelector("#item-form"),
    dialogTitle: document.querySelector("#dialog-title"),
    closeDialog: document.querySelector("#close-dialog"),
    cancel: document.querySelector("#cancel-button"),
    formFeedback: document.querySelector("#form-feedback"),
    id: document.querySelector("#item-id"),
    currentFileId: document.querySelector("#current-file-id"),
    file: document.querySelector("#image-file"),
    preview: document.querySelector("#image-preview"),
    placeholder: document.querySelector("#upload-placeholder"),
    imageStats: document.querySelector("#image-stats"),
    title: document.querySelector("#title"),
    description: document.querySelector("#description"),
    category: document.querySelector("#category"),
    sortOrder: document.querySelector("#sort-order"),
    active: document.querySelector("#is-active"),
    save: document.querySelector("#save-button"),
    deleteDialog: document.querySelector("#delete-dialog"),
    deleteFeedback: document.querySelector("#delete-feedback"),
    cancelDelete: document.querySelector("#cancel-delete"),
    confirmDelete: document.querySelector("#confirm-delete")
};

let items = [];
let processedImage = null;
let previewUrl = null;
let deletingItem = null;

function showMessage(target, message, type = "error") {
    target.textContent = message;
    target.className = `alert alert-${type}`;
    target.hidden = false;
}

function hideMessage(target) {
    target.hidden = true;
    target.textContent = "";
}

function publicUrl(path) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function imagePath(fileId) {
    return `imagens/${fileId}.webp`;
}

function thumbnailPath(fileId) {
    return `miniaturas/${fileId}.webp`;
}

function setPreview(src) {
    elements.preview.src = src;
    elements.preview.hidden = false;
    elements.placeholder.hidden = true;
}

function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    elements.preview.removeAttribute("src");
    elements.preview.hidden = true;
    elements.placeholder.hidden = false;
    elements.imageStats.textContent = "";
}

async function requireAdmin() {
    exigirSupabaseConfigurado();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        window.location.replace("index.html");
        return null;
    }

    const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (adminError || !admin) {
        await supabase.auth.signOut();
        throw new Error("Esta conta não possui permissão administrativa.");
    }

    elements.userEmail.textContent = session.user.email;
    return session;
}

async function loadItems() {
    elements.loading.hidden = false;
    elements.grid.replaceChildren();
    elements.empty.hidden = true;
    hideMessage(elements.globalFeedback);

    const { data, error } = await supabase
        .from("galeria")
        .select("id,arquivo_id,categoria,titulo,descricao,ordem,ativo,created_at")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

    elements.loading.hidden = true;
    if (error) {
        showMessage(elements.globalFeedback, `Não foi possível carregar a galeria: ${error.message}`);
        return;
    }

    items = data ?? [];
    updateSummary();
    renderItems();
}

function updateSummary() {
    elements.totalCount.textContent = items.length;
    elements.publishedCount.textContent = items.filter((item) => item.ativo).length;
    elements.hiddenCount.textContent = items.filter((item) => !item.ativo).length;
}

function filteredItems() {
    const query = elements.search.value.trim().toLocaleLowerCase("pt-BR");
    const category = elements.categoryFilter.value;
    const status = elements.statusFilter.value;
    return items.filter((item) => {
        const text = `${item.titulo} ${item.descricao ?? ""}`.toLocaleLowerCase("pt-BR");
        return (!query || text.includes(query)) &&
            (!category || item.categoria === category) &&
            (!status || (status === "published" ? item.ativo : !item.ativo));
    });
}

function makeButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
}

function renderItems() {
    const filtered = filteredItems();
    elements.grid.replaceChildren();
    elements.empty.hidden = filtered.length !== 0;

    filtered.forEach((item) => {
        const card = document.createElement("article");
        card.className = "admin-card";

        const imageBox = document.createElement("div");
        imageBox.className = "admin-card-image";
        const image = document.createElement("img");
        image.src = publicUrl(thumbnailPath(item.arquivo_id));
        image.alt = item.titulo;
        image.loading = "lazy";
        image.decoding = "async";
        const badge = document.createElement("span");
        badge.className = `status-badge${item.ativo ? "" : " hidden"}`;
        badge.textContent = item.ativo ? "Publicada" : "Oculta";
        imageBox.append(image, badge);

        const body = document.createElement("div");
        body.className = "admin-card-body";
        const title = document.createElement("h2");
        title.textContent = item.titulo;
        const meta = document.createElement("p");
        meta.className = "admin-card-meta";
        meta.textContent = `${categories[item.categoria]} · Ordem ${item.ordem}`;
        const actions = document.createElement("div");
        actions.className = "card-actions";
        actions.append(
            makeButton("Editar", "button button-secondary button-small", () => openEdit(item)),
            makeButton("Excluir", "button button-danger button-small", () => openDelete(item))
        );
        body.append(title, meta, actions);
        card.append(imageBox, body);
        elements.grid.append(card);
    });
}

function openNew() {
    elements.form.reset();
    elements.id.value = "";
    elements.currentFileId.value = "";
    elements.sortOrder.value = "0";
    elements.active.checked = true;
    elements.file.required = true;
    elements.dialogTitle.textContent = "Nova foto";
    processedImage = null;
    resetPreview();
    hideMessage(elements.formFeedback);
    elements.dialog.showModal();
}

function openEdit(item) {
    elements.form.reset();
    elements.id.value = item.id;
    elements.currentFileId.value = item.arquivo_id;
    elements.title.value = item.titulo;
    elements.description.value = item.descricao ?? "";
    elements.category.value = item.categoria;
    elements.sortOrder.value = item.ordem;
    elements.active.checked = item.ativo;
    elements.file.required = false;
    elements.dialogTitle.textContent = "Editar foto";
    processedImage = null;
    resetPreview();
    setPreview(publicUrl(imagePath(item.arquivo_id)));
    hideMessage(elements.formFeedback);
    elements.dialog.showModal();
}

function closeEditDialog() {
    if (elements.save.disabled) return;
    elements.dialog.close();
    resetPreview();
    processedImage = null;
}

async function handleImageSelection() {
    const file = elements.file.files[0];
    if (!file) return;
    elements.imageStats.textContent = "Preparando a imagem...";
    hideMessage(elements.formFeedback);

    try {
        processedImage = await processImage(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(processedImage.main);
        setPreview(previewUrl);
        const economy = Math.max(0, 100 - (processedImage.optimizedBytes / processedImage.originalBytes * 100));
        elements.imageStats.textContent = `Original: ${formatBytes(processedImage.originalBytes)} · Site: ${formatBytes(processedImage.optimizedBytes)} · Economia: ${economy.toFixed(0)}%`;
    } catch (error) {
        processedImage = null;
        elements.file.value = "";
        elements.imageStats.textContent = "";
        showMessage(elements.formFeedback, error.message);
    }
}

async function uploadImages() {
    const fileId = crypto.randomUUID();
    const mainPath = imagePath(fileId);
    const thumbPath = thumbnailPath(fileId);

    const { error: imageError } = await supabase.storage
        .from(BUCKET)
        .upload(mainPath, processedImage.main, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (imageError) throw imageError;

    const { error: thumbnailError } = await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, processedImage.thumbnail, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (thumbnailError) {
        await supabase.storage.from(BUCKET).remove([mainPath]);
        throw thumbnailError;
    }
    return { fileId, mainPath, thumbPath };
}

async function removeFiles(paths) {
    const validPaths = paths.filter(Boolean);
    if (!validPaths.length) return null;
    const { error } = await supabase.storage.from(BUCKET).remove(validPaths);
    return error;
}

async function saveItem(event) {
    event.preventDefault();
    hideMessage(elements.formFeedback);
    const editing = Boolean(elements.id.value);
    if (!editing && !processedImage) {
        showMessage(elements.formFeedback, "Selecione uma foto.");
        return;
    }

    elements.save.disabled = true;
    elements.save.textContent = processedImage ? "Otimizando e enviando..." : "Salvando...";
    let uploaded = null;

    try {
        if (processedImage) uploaded = await uploadImages();
        const payload = {
            categoria: elements.category.value,
            titulo: elements.title.value.trim(),
            descricao: elements.description.value.trim() || null,
            ordem: Number(elements.sortOrder.value),
            ativo: elements.active.checked
        };
        if (uploaded) {
            payload.arquivo_id = uploaded.fileId;
        }

        const query = editing
            ? supabase.from("galeria").update(payload).eq("id", elements.id.value)
            : supabase.from("galeria").insert(payload);
        const { error } = await query;
        if (error) throw error;

        if (editing && uploaded) {
            const cleanupError = await removeFiles([
                imagePath(elements.currentFileId.value),
                thumbnailPath(elements.currentFileId.value)
            ]);
            if (cleanupError) console.warn("Arquivos antigos pendentes de limpeza:", cleanupError.message);
        }

        elements.dialog.close();
        resetPreview();
        processedImage = null;
        await loadItems();
        showMessage(elements.globalFeedback, editing ? "Foto atualizada com sucesso." : "Foto cadastrada com sucesso.", "success");
    } catch (error) {
        if (uploaded) await removeFiles([uploaded.mainPath, uploaded.thumbPath]);
        showMessage(elements.formFeedback, `Não foi possível salvar: ${error.message}`);
    } finally {
        elements.save.disabled = false;
        elements.save.textContent = "Salvar";
    }
}

function openDelete(item) {
    deletingItem = item;
    hideMessage(elements.deleteFeedback);
    elements.deleteDialog.showModal();
}

async function confirmDelete() {
    if (!deletingItem) return;
    elements.confirmDelete.disabled = true;
    elements.confirmDelete.textContent = "Excluindo...";

    const { error: databaseError } = await supabase
        .from("galeria")
        .delete()
        .eq("id", deletingItem.id);

    if (databaseError) {
        showMessage(elements.deleteFeedback, `Não foi possível excluir: ${databaseError.message}`);
        elements.confirmDelete.disabled = false;
        elements.confirmDelete.textContent = "Excluir definitivamente";
        return;
    }

    const storageError = await removeFiles([
        imagePath(deletingItem.arquivo_id),
        thumbnailPath(deletingItem.arquivo_id)
    ]);
    elements.deleteDialog.close();
    deletingItem = null;
    elements.confirmDelete.disabled = false;
    elements.confirmDelete.textContent = "Excluir definitivamente";
    await loadItems();
    showMessage(
        elements.globalFeedback,
        storageError ? "Registro excluído, mas alguns arquivos precisarão de limpeza técnica." : "Foto excluída com sucesso.",
        storageError ? "warning" : "success"
    );
}

elements.logout.addEventListener("click", async () => {
    await supabase?.auth.signOut();
    window.location.replace("index.html");
});
elements.newButton.addEventListener("click", openNew);
elements.closeDialog.addEventListener("click", closeEditDialog);
elements.cancel.addEventListener("click", closeEditDialog);
elements.file.addEventListener("change", handleImageSelection);
elements.form.addEventListener("submit", saveItem);
elements.search.addEventListener("input", renderItems);
elements.categoryFilter.addEventListener("change", renderItems);
elements.statusFilter.addEventListener("change", renderItems);
elements.cancelDelete.addEventListener("click", () => elements.deleteDialog.close());
elements.confirmDelete.addEventListener("click", confirmDelete);
elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) closeEditDialog();
});
elements.deleteDialog.addEventListener("click", (event) => {
    if (event.target === elements.deleteDialog) elements.deleteDialog.close();
});

if (!supabaseConfigurado) {
    elements.configAlert.textContent = "Configure a URL e a chave publicável em js/supabase-client.js antes de usar o painel.";
    elements.configAlert.hidden = false;
    elements.loading.hidden = true;
    elements.newButton.disabled = true;
} else {
    try {
        const session = await requireAdmin();
        if (session) await loadItems();
    } catch (error) {
        elements.loading.hidden = true;
        showMessage(elements.globalFeedback, error.message);
    }
}
