const mySupabase = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_KEY
);

let isCreatingAccount = false;
let isAccountCreated = false;

const signupInputIds = ["email", "password", "display-name"];

document.getElementById("create-account")
  .addEventListener("click", createAccount);

function clearSignupError(id) {
  const input = document.getElementById(id);

  input.classList.remove("input-error");
  input.removeAttribute("aria-invalid");
  document.getElementById(`${id}-error`).textContent = "";
}

function showSignupError(id, message) {
  const input = document.getElementById(id);

  input.classList.add("input-error");
  input.setAttribute("aria-invalid", "true");
  document.getElementById(`${id}-error`).textContent = message;
}

// 入力を修正した欄のエラー表示を解除
signupInputIds.forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    clearSignupError(id);
  });
});

function validateSignupInputs() {
  signupInputIds.forEach(clearSignupError);

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const nameInput = document.getElementById("display-name");

  emailInput.value = emailInput.value.trim();
  nameInput.value = nameInput.value.trim();

  const errors = {};

  // メールアドレス
  if (!emailInput.value) {
    errors.email = "メールアドレスを入力してください。";
  } else if (emailInput.value.length > 254) {
    errors.email = "メールアドレスは254文字以内で入力してください。";
  } else if (emailInput.validity.typeMismatch) {
    errors.email = "メールアドレスの形式が正しくありません。";
  }

  // パスワード
  // 半角英数字と指定された記号のみ許可（スペースは不可）
  const allowedPasswordPattern =
    /^[A-Za-z0-9!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~]+$/;

  if (passwordInput.value.length < 4) {
    errors.password = "パスワードは4文字以上で入力してください。";
  } else if (passwordInput.value.length > 64) {
    errors.password = "パスワードは64文字以内で入力してください。";
  } else if (!allowedPasswordPattern.test(passwordInput.value)) {
    errors.password = "パスワードには半角英数字と一部の記号のみ使用できます。スペースは使用できません。";
  }

  // ユーザー名
  if (!nameInput.value) {
    errors["display-name"] = "ユーザー名を入力してください。";
  } else if (nameInput.value.length > 32) {
    errors["display-name"] = "ユーザー名は32文字以内で入力してください。";
  }

  Object.entries(errors).forEach(([id, message]) => {
    showSignupError(id, message);
  });

  const firstErrorId = Object.keys(errors)[0];

  if (firstErrorId) {
    document.getElementById(firstErrorId).focus();
    return false;
  }

  return true;
}

async function createAccount() {
  if (isCreatingAccount || isAccountCreated) return;
  if (!validateSignupInputs()) return;

  const createButton = document.getElementById("create-account");
  const originalButtonText = createButton.textContent;
  const inputs = signupInputIds.map(id => document.getElementById(id));
  const revealButton = document.getElementById("reveal-password");

  isCreatingAccount = true;
  createButton.disabled = true;
  createButton.textContent = "送信中...";
  createButton.setAttribute("aria-busy", "true");

  inputs.forEach(input => {
    input.disabled = true;
  });

  hidePassword();
  revealButton.disabled = true;

  try {
    const { data, error } = await mySupabase.functions.invoke(
      "create-user",
      {
        body: {
          mode: "signup",
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
          display_name: document.getElementById("display-name").value
        }
      }
    );

    if (error) {
      let message =
        "作成結果を確認できませんでした。通信状態を確認してください。";

      if (error.context instanceof Response) {
        const result = await error.context.json().catch(() => null);

        if (typeof result?.error?.message === "string") {
          message = result.error.message;
        }
      }

      Toast.error(message);
      return;
    }

    if (data?.success !== true || !data?.user?.user_id) {
      Toast.error(
        "作成結果を確認できませんでした。管理者に確認してください。"
      );
      return;
    }

    isAccountCreated = true;
    document.getElementById("password").value = "";
    createButton.textContent = "リクエスト送信済み";

    // 成功メッセージをログイン画面へ渡す
    sessionStorage.setItem(
      "signupMessage",
      "アカウント作成のリクエストを受け付けました。管理者の承認をお待ちください。"
    );

    location.href = "login.html";
  } catch {
    Toast.error(
      isAccountCreated
        ? "アカウントは作成されましたが、画面を切り替えられませんでした。「ログイン画面に戻る」からお戻りください。"
        : "作成結果を確認できませんでした。通信状態を確認してください。"
    );
  } finally {
    isCreatingAccount = false;
    createButton.removeAttribute("aria-busy");

    if (!isAccountCreated) {
      createButton.disabled = false;
      createButton.textContent = originalButtonText;

      inputs.forEach(input => {
        input.disabled = false;
      });

      revealButton.disabled = false;
    }
  }
}

//==============================
//  パスワードのマスク処理
//==============================

const passwordField = document.getElementById("password");
const revealPasswordButton = document.getElementById("reveal-password");

function showPassword() {
  passwordField.type = "text";
}

function hidePassword() {
  passwordField.type = "password";
}

// マウス・タッチ・ペンで押している間だけ表示
revealPasswordButton.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;

  revealPasswordButton.setPointerCapture(event.pointerId);
  showPassword();
});

revealPasswordButton.addEventListener("pointerup", hidePassword);
revealPasswordButton.addEventListener("pointercancel", hidePassword);
revealPasswordButton.addEventListener("lostpointercapture", hidePassword);

// キーボードで押している間だけ表示
revealPasswordButton.addEventListener("keydown", event => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();

    if (!event.repeat) {
      showPassword();
    }
  }
});

revealPasswordButton.addEventListener("keyup", event => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    hidePassword();
  }
});

// フォーカス移動や画面切り替えでもマスクに戻す
revealPasswordButton.addEventListener("blur", hidePassword);
window.addEventListener("blur", hidePassword);
window.addEventListener("pagehide", hidePassword);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hidePassword();
  }
});

// 長押し時のコンテキストメニューを抑止
revealPasswordButton.addEventListener("contextmenu", event => {
  event.preventDefault();
});
