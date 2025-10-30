const btnAbrir = document.getElementById('abrirCatalogo');
const popup = document.getElementById('popupCatalogo');
const btnFechar = document.getElementById('fecharPopup');

btnAbrir.addEventListener('click', () => {
    popup.style.display = 'flex';
});

btnFechar.addEventListener('click', () => {
    popup.style.display = 'none';
});

// Fecha ao clicar fora do conteúdo
window.addEventListener('click', (e) => {
    if (e.target === popup) {
        popup.style.display = 'none';
    }
}); 