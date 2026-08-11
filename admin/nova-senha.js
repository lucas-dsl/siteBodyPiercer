import { supabase, supabaseConfigurado } from "../js/supabase-client.js";

const form = document.querySelector("#password-form");
const feedback = document.querySelector("#feedback");
const configAlert = document.querySelector("#config-alert");
const button = document.querySelector("#save-password-button");

function mensagem(text, type = "error") {
    feedback.textContent = text;
    feedback.className = `alert alert-${type}`;
    feedback.hidden = false;
}

if (!supabaseConfigurado) {
    configAlert.textContent = "Integração pendente: configure o Supabase em js/supabase-client.js.";
    configAlert.hidden = false;
    form.querySelectorAll("input, button").forEach((element) => element.disabled = true);
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#new-password").value;
    const confirmation = document.querySelector("#confirm-password").value;

    if (password !== confirmation) {
        mensagem("As senhas não são iguais.");
        return;
    }

    button.disabled = true;
    button.textContent = "Salvando...";
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
        mensagem("O link expirou ou não foi possível alterar a senha. Solicite outro link.");
        button.disabled = false;
        button.textContent = "Salvar nova senha";
        return;
    }

    mensagem("Senha alterada. Redirecionando para o painel...", "success");
    window.setTimeout(() => window.location.replace("painel.html"), 1200);
});
