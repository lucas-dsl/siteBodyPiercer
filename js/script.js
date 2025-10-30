document.addEventListener("DOMContentLoaded", () => {
    // Seleciona todos os botões que abrem modal com o atributo data-modal-id
    const botoesAbrir = document.querySelectorAll("[data-modal-id]");
    const botoesFechar = document.querySelectorAll(".fechar");

    // Abrir o modal correto
    botoesAbrir.forEach(btn => {
        btn.addEventListener("click", () => {
            const modalId = btn.getAttribute("data-modal-id");
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = "flex";
        });
    });

    // Fechar ao clicar no botão X
    botoesFechar.forEach(btn => {
        btn.addEventListener("click", () => {
            const modal = btn.closest(".modal");
            if (modal) modal.style.display = "none";
        });
    });

    // Fechar ao clicar fora do conteúdo (overlay)
    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal")) {
            e.target.style.display = "none";
        }
    });
});
