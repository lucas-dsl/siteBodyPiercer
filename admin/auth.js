import { exigirSupabaseConfigurado, supabase, supabaseConfigurado } from "../js/supabase-client.js";

const form = document.querySelector("#login-form");
const feedback = document.querySelector("#feedback");
const configAlert = document.querySelector("#config-alert");
const loginButton = document.querySelector("#login-button");

function mostrarMensagem(message, type = "error") {
    feedback.textContent = message;
    feedback.className = `alert alert-${type}`;
    feedback.hidden = false;
}

function traduzirErro(error) {
    const message = error?.message?.toLowerCase() ?? "";
    if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
    if (message.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos.";
    return "Não foi possível concluir a operação. Tente novamente.";
}

function alternarCarregamento(button, loading, label) {
    button.disabled = loading;
    button.textContent = loading ? "Aguarde..." : label;
}

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "Ocultar" : "Mostrar";
        button.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    });
});

if (!supabaseConfigurado) {
    configAlert.textContent = "Integração pendente: configure o Supabase em js/supabase-client.js.";
    configAlert.hidden = false;
    form.querySelectorAll("input, button").forEach((element) => element.disabled = true);
} else {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) window.location.replace("painel.html");
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.hidden = true;
    alternarCarregamento(loginButton, true, "Entrar");

    try {
        exigirSupabaseConfigurado();
        const formData = new FormData(form);
        const { error } = await supabase.auth.signInWithPassword({
            email: formData.get("email").trim(),
            password: formData.get("password")
        });
        if (error) throw error;
        window.location.replace("painel.html");
    } catch (error) {
        mostrarMensagem(traduzirErro(error));
        alternarCarregamento(loginButton, false, "Entrar");
    }
});
