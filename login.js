const mySupabase = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_KEY
);

window.onload = async () => {
  const { data: { session } } = await mySupabase.auth.getSession();
  if (session) {
    location.href = "top.html";
  }
};

function clearLoginError() {
  ["email", "password"].forEach(id => {
    const input = document.getElementById(id);
    input.classList.remove("input-error");
    input.removeAttribute("aria-invalid");
  });

  document.getElementById("login-error").textContent = "";
}

async function login() {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  clearLoginError();
  emailInput.value = emailInput.value.trim();

  if (!emailInput.reportValidity()) return;

  if (passwordInput.value.trim() === "") {
    passwordInput.classList.add("input-error");
    passwordInput.setAttribute("aria-invalid", "true");

    document.getElementById("login-error").textContent = "パスワードを入力してください。";
    return;
  }

  const { error } = await mySupabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  if (error) {
    [emailInput, passwordInput].forEach(input => {
      input.classList.add("input-error");
      input.setAttribute("aria-invalid", "true");
    });

    document.getElementById("login-error").textContent =
      "メールアドレスまたはパスワードが正しくありません。";
    return;
  }

  location.href = "top.html";
}

// 入力を修正したらエラー表示を解除する
["email", "password"].forEach(id => {
  document.getElementById(id).addEventListener("input", clearLoginError);
});


// ===================================
// パスワードリセット画面からの遷移
// ===================================

const passwordResetMessage = sessionStorage.getItem("passwordResetMessage");

//reset.htmlで、パスワードリセットに成功した場合の処理
if (passwordResetMessage) {
  sessionStorage.removeItem("passwordResetMessage");
  Toast.success(passwordResetMessage);
}
