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
  if (!validateSignupInputs()) return;

  // アカウント作成処理は後で実装します。
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
