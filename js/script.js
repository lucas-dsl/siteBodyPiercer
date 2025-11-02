document.addEventListener("DOMContentLoaded", () => {
    // Botões para abrir (via data-modal-id)
    const botoesAbrir = document.querySelectorAll("[data-modal-id]");
    // Botões "X" para fechar (qualquer .fechar dentro do modal)
    const botoesFechar = document.querySelectorAll(".fechar");

    function abrirModal(modal) {
        if (!modal) return;
        modal.classList.add("visivel");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("body-trava-scroll"); // Trava scroll de fundo
    }

    function fecharModal(modal) {
        if (!modal) return;
        modal.classList.remove("visivel");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("body-trava-scroll");
    }

    // Abrir o modal correto
    botoesAbrir.forEach(btn => {
        btn.addEventListener("click", () => {
            const modalId = btn.getAttribute("data-modal-id");
            const modal = document.getElementById(modalId);
            abrirModal(modal);
        });
    });

    // Fechar pelo botão X
    botoesFechar.forEach(btn => {
        btn.addEventListener("click", () => {
            const modal = btn.closest(".modal");
            fecharModal(modal);
        });
    });

    // Fechar ao tocar/clicar fora do conteúdo:
    // Fecha se tocou em qualquer área que NÃO esteja dentro de .conteudo
    function backdropHandler(e) {
        const modalAberto = e.target.closest(".modal");
        const tocouDentro = e.target.closest(".conteudo");
        if (modalAberto && !tocouDentro && modalAberto.classList.contains("visivel")) {
            fecharModal(modalAberto);
        }
    }
    document.addEventListener("click", backdropHandler);
    document.addEventListener("touchstart", backdropHandler, { passive: true }); // iOS/Android

    // Fechar com ESC
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal.visivel").forEach(fecharModal);
        }
    });
});

// Animação de entrada de elementos
const sr = ScrollReveal({
    distance: "8rem",
    duration: 1000,
    delay: 200
});

// ANIMAÇÃO HERO
sr.reveal('.logo-estudio', {origin: 'top'});
sr.reveal('h1', {origin: 'right'});
sr.reveal('.heroConteudo nav', {origin: 'bottom'});
sr.reveal('.mouse', {origin: 'left'});

// ANIMAÇÃO SOBRE
sr.reveal('.sobre-esquerda', {origin: 'left'});
sr.reveal('.sobre-direita', {origin: 'right'});

// ANIMAÇÃO CATÁLOGO
sr.reveal('section header', {origin: 'top'});
sr.reveal('.caixaCatalogo:nth-of-type(1)', {origin: 'left'});
sr.reveal('.caixaCatalogo:nth-of-type(2)', {origin: 'right'});

// ANIMAÇÃO PORTFOLIO
sr.reveal('.caixaPerfuracoes:nth-of-type(1)', {origin: 'left'});
sr.reveal('.caixaPerfuracoes:nth-of-type(2)', {origin: 'right'});

// ANIMAÇÃO LOCALIZAÇÃO E HORÁRIO
sr.reveal('.caixa:nth-of-type(1)', {origin: 'left'});
sr.reveal('.caixa:nth-of-type(2)', {origin: 'right'});
sr.reveal('.mapa', {origin: 'bottom'});

// FOOTER
sr.reveal('footer', {origin: 'bottom'});




