import { supabase, supabaseConfigurado } from "./supabase-client.js";

const BUCKET_GALERIA = "galeria";
const statusGaleria = document.getElementById("galeria-status");
const visualizador = document.getElementById("visualizador-galeria");
const imagemAmpliada = document.getElementById("visualizador-imagem");
const tituloAmpliado = document.getElementById("visualizador-titulo");
const descricaoAmpliada = document.getElementById("visualizador-descricao");

function obterUrlPublica(caminho) {
    return supabase.storage.from(BUCKET_GALERIA).getPublicUrl(caminho).data.publicUrl;
}

function criarImagem(item) {
    const imagem = document.createElement("img");
    imagem.src = obterUrlPublica(`miniaturas/${item.arquivo_id}.webp`);
    imagem.alt = item.titulo;
    imagem.loading = "lazy";
    imagem.decoding = "async";
    imagem.className = "imagem-galeria-interativa";
    imagem.tabIndex = 0;
    imagem.setAttribute("role", "button");
    imagem.setAttribute("aria-label", `Ampliar foto: ${item.titulo}`);

    const abrir = () => abrirImagem(item);
    imagem.addEventListener("click", abrir);
    imagem.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            abrir();
        }
    });

    return imagem;
}

function criarCardJoia(item) {
    const card = document.createElement("div");
    card.className = "item";

    const informacoes = document.createElement("div");
    informacoes.className = "item-info";

    const titulo = document.createElement("h3");
    titulo.textContent = item.titulo;
    informacoes.append(titulo);

    if (item.descricao) {
        const descricao = document.createElement("p");
        descricao.textContent = item.descricao;
        informacoes.append(descricao);
    }

    card.append(criarImagem(item), informacoes);
    return card;
}

function criarCardPerfuracao(item) {
    const card = document.createElement("div");
    card.className = "item-perfuracao";

    const informacoes = document.createElement("div");
    informacoes.className = "desc-perfuracao";

    const titulo = document.createElement("h3");
    titulo.textContent = item.titulo;
    informacoes.append(titulo);

    if (item.descricao) {
        const descricao = document.createElement("span");
        descricao.textContent = item.descricao;
        informacoes.append(descricao);
    }

    card.append(criarImagem(item), informacoes);
    return card;
}

function abrirImagem(item) {
    imagemAmpliada.src = obterUrlPublica(`imagens/${item.arquivo_id}.webp`);
    imagemAmpliada.alt = item.titulo;
    tituloAmpliado.textContent = item.titulo;
    descricaoAmpliada.textContent = item.descricao || "";
    visualizador.showModal();
}

function fecharImagem() {
    visualizador.close();
    imagemAmpliada.removeAttribute("src");
}

function prepararVisualizador() {
    visualizador.querySelector(".visualizador-fechar").addEventListener("click", fecharImagem);
    visualizador.addEventListener("click", (event) => {
        if (event.target === visualizador) fecharImagem();
    });
    visualizador.addEventListener("close", () => {
        imagemAmpliada.removeAttribute("src");
    });
}

function exibirAviso() {
    statusGaleria.textContent =
        "Não foi possível atualizar as galerias agora. Exibindo o conteúdo disponível.";
    statusGaleria.hidden = false;
}

async function carregarGalerias() {
    if (!supabaseConfigurado || !supabase) {
        exibirAviso();
        return;
    }

    const { data, error } = await supabase
        .from("galeria")
        .select("arquivo_id, categoria, titulo, descricao, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });

    if (error) {
        console.error("Não foi possível carregar as galerias públicas.", error);
        exibirAviso();
        return;
    }

    const itensPorCategoria = data.reduce((grupos, item) => {
        (grupos[item.categoria] ||= []).push(item);
        return grupos;
    }, {});

    document.querySelectorAll("[data-gallery-category]").forEach((grade) => {
        const categoria = grade.dataset.galleryCategory;
        const itens = itensPorCategoria[categoria] || [];

        if (itens.length === 0) return;

        const criarCard = categoria.startsWith("joia_")
            ? criarCardJoia
            : criarCardPerfuracao;

        grade.replaceChildren(...itens.map(criarCard));
    });
}

prepararVisualizador();
carregarGalerias().catch((error) => {
    console.error("Erro inesperado ao carregar as galerias públicas.", error);
    exibirAviso();
});
