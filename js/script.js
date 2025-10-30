document.addEventListener("DOMContentLoaded", () => {
    const botoesAbrir = document.querySelectorAll("[id^='abrirCatalogo']");
    const botoesFechar = document.querySelectorAll(".fechar");

    botoesAbrir.forEach(btn => {
        btn.addEventListener("click", () => {
            const modalId = btn.getAttribute("data-modal-id");
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = "flex";
        });
    });

    botoesFechar.forEach(btn => {
        btn.addEventListener("click", () => {
            const modal = btn.closest(".modal");
            if (modal) modal.style.display = "none";
        });
    });

    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal")) {
            e.target.style.display = "none";
        }
    });
});