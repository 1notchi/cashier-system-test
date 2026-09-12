"use strict";

const resetClient = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_KEY
);

const emailInput = document.getElementById("email");
const requestButton = document.getElementById("request-reset");

requestButton.addEventListener("click", async () => {
  emailInput.value = emailInput.value.trim();

  if (!emailInput.reportValidity()) return;
  if (requestButton.disabled) return;

  requestButton.disabled = true;
  requestButton.textContent = "申請中…";

  try {
    const { data, error } = await resetClient.functions.invoke(
      "request-password-reset",
      {
        body: { email: emailInput.value }
      }
    );

    if (error) {
      let message = "申請に失敗しました。時間をおいて再度お試しください。";

      if (error instanceof window.supabase.FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        if (typeof body?.message === "string") {
          message = body.message;
        }
      }

      Toast.error(message);
      return;
    }

    //成功時にlogin.htmlに遷移
    sessionStorage.setItem("passwordResetMessage", data.message);
    location.href = "login.html";
  } catch {
    Toast.error("通信に失敗しました。接続を確認して再度お試しください。");
  } finally {
    requestButton.disabled = false;
    requestButton.textContent = "パスワードリセットを申請";
  }
});
