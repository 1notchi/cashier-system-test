// ==========================
// 表示名
// ==========================

const USER_ROLE_LABELS = new Map([
  ["admin", "管理者"],
  ["staff", "スタッフ"],
  ["viewer", "閲覧専用"]
]);

const USER_STATUS_LABELS = new Map([
  ["pending", "承認待ち"],
  ["active", "有効"],
  ["inactive", "無効"]
]);

let verifyTargetUserId = null;
let isReviewingUser = false;
let resetPasswordTarget = null;
let isProcessingPasswordReset = false;
let currentAdminUserId = null;
let userSettingsTarget = null;
let isSavingUserSettings = false;

// ==========================
// 初期化・権限確認
// ==========================

document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("users-status");
  const content = document.getElementById("users-content");

  document.getElementById("cancelVerifyUserButton").addEventListener("click", closeVerifyUserModal);
  document.getElementById("closeVerifyUserButton").addEventListener("click", closeVerifyUserModal);
  document.getElementById("verifyAsStaffButton").addEventListener("click", () => submitUserReview("staff"));
  document.getElementById("verifyAsViewerButton").addEventListener("click", () => submitUserReview("viewer"));
  document.getElementById("rejectVerifyUserButton").addEventListener("click", () => submitUserReview("reject"));

  document.getElementById("cancelUserSettingsButton").addEventListener("click", closeUserSettingsModal);
  document.getElementById("closeUserSettingsButton").addEventListener("click", closeUserSettingsModal);
  document.getElementById("confirmUserSettingsButton").addEventListener("click", saveUserSettings);
  const settingsModal = document.getElementById("userSettingsModal");

  settingsModal.addEventListener("cancel", event => {
    if (isSavingUserSettings) {
      event.preventDefault();
    }
  });

  settingsModal.addEventListener("close", () => {
    userSettingsTarget = null;
  });

  document.getElementById("cancelResetPasswordButton").addEventListener("click", closeResetPasswordModal);
  document.getElementById("closeResetPasswordButton").addEventListener("click", closeResetPasswordModal);
  document.getElementById("confirmResetPasswordButton").addEventListener("click", openIssuedPasswordModal);
  document.getElementById("closeIssuedPasswordButton").addEventListener("click", closeIssuedPasswordModal);
  document.getElementById("rejectResetPasswordButton").addEventListener("click", rejectPasswordReset);

  const resetModal = document.getElementById("resetPasswordModal");

  resetModal.addEventListener("cancel", event => {
    if (isProcessingPasswordReset) {
      event.preventDefault();
    }
  });

  resetModal.addEventListener("close", () => {
    resetPasswordTarget = null;
  });

  const verifyModal = document.getElementById("verifyUserModal");

  // 更新中はEscキーでも閉じない
  verifyModal.addEventListener("cancel", event => {
    if (isReviewingUser) {
      event.preventDefault();
    }
  });

  // Escキーで閉じた場合も対象を解除する
  verifyModal.addEventListener("close", () => {
    verifyTargetUserId = null;
  });

  document.getElementById("issuedPasswordModal")
    .addEventListener("close", () => {
      document.getElementById("issuedPasswordValue").textContent = "";

      const warning = document.getElementById("issuedPasswordWarning");
      warning.textContent = "";
      warning.hidden = true;
    });

  try {
    const profile = await getCurrentProfile();
    currentAdminUserId = profile.user_id;

    if (profile.role !== "admin") {
      location.replace("top.html");
      return;
    }

    status.textContent = "ユーザー一覧を読み込んでいます...";

    await loadUsers();

    status.hidden = true;
    content.hidden = false;
  } catch (error) {
    console.error("ユーザー一覧の取得に失敗しました。", error);

    status.hidden = false;
    status.textContent =
      "ユーザー一覧を取得できませんでした。再読み込みしてください。";
    content.hidden = true;
  }
});

// ==========================
// データ取得
// ==========================

async function loadUsers() {
  const { data, error } = await mySupabase.rpc("get_admin_users");

  if (error) {
    throw error;
  }

  renderUsers(data ?? []);
}

// ==========================
// 表の描画
// ==========================

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  const tableWrapper = document.getElementById("usersTableWrapper");
  const emptyMessage = document.getElementById("emptyUsersMessage");

  tbody.replaceChildren();

  const isEmpty = users.length === 0;
  tableWrapper.hidden = isEmpty;
  emptyMessage.hidden = !isEmpty;

  if (isEmpty) {
    return;
  }

  // circle_idの昇順に並んだデータに1から採番
  const numberedUsers = users.map((user, index) => ({
    ...user,
    serialNumber: index + 1
  }));

  const fragment = document.createDocumentFragment();

  // 取得した順序のまま、No.の昇順で表示
  numberedUsers.forEach(user => {
    const tr = document.createElement("tr");

    if (user.status === "inactive") {
      tr.classList.add("users-inactive-row");
    }

    const values = [
      user.serialNumber,
      user.circle_id,
      user.display_name,
      user.email ?? "—",
      USER_ROLE_LABELS.get(user.role) ?? user.role,
      USER_STATUS_LABELS.get(user.status) ?? user.status,
      formatLastSignIn(user.last_sign_in_at)
    ];

    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value ?? "");
      tr.appendChild(td);
    });

    // 操作列
    const actionCell = document.createElement("td");
    const actionButtons = document.createElement("div");
    actionButtons.className = "users-action-buttons";

    const buttonDefinitions = [
      {
        label: "承認",
        className: "users-verify-button",
        disabled: ["active", "inactive"].includes(user.status)
      },
      {
        label: "ユーザー設定変更",
        className: "users-settings-button",
        disabled: user.status === "pending"
      },
      {
        label: "パスワードリセット",
        className: "users-reset-button",
        disabled: user.password_change_requested_at == null
      }
    ];

    buttonDefinitions.forEach(({ label, className, disabled }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `users-action-button ${className}`;
      button.textContent = label;
      button.disabled = disabled;

      if (className === "users-verify-button") {
        button.addEventListener("click", () => {
          openVerifyUserModal(user);
        });
      }

      if (className === "users-reset-button") {
        button.addEventListener("click", () => {
          openResetPasswordModal(user);
        });
      }

      actionButtons.appendChild(button);

      if (className === "users-settings-button") {
        button.addEventListener("click", () => {
          openUserSettingsModal(user);
        });
      }
    });

    actionCell.appendChild(actionButtons);
    tr.appendChild(actionCell);

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function formatLastSignIn(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

// ==========================
// 承認モーダル
// ==========================

function openVerifyUserModal(user) {
  const modal = document.getElementById("verifyUserModal");

  if (isReviewingUser || modal.open || user.status !== "pending") {
    return;
  }

  verifyTargetUserId = user.user_id;

  document.getElementById("verifyUserName").textContent =
    String(user.display_name ?? "");

  document.getElementById("verifyUserEmail").textContent =
    String(user.email ?? "—");

  modal.showModal();
}

function closeVerifyUserModal() {
  if (isReviewingUser) {
    return;
  }

  document.getElementById("verifyUserModal").close();
  verifyTargetUserId = null;
}

// 処理中はモーダル内の全ボタンを非活性にする
function setUserReviewBusy(busy) {
  isReviewingUser = busy;

  const modal = document.getElementById("verifyUserModal");
  modal.setAttribute("aria-busy", String(busy));

  modal.querySelectorAll("button").forEach(button => {
    button.disabled = busy;
  });
}

// ==========================
// 承認・拒否
// ==========================

async function submitUserReview(decision) {
  if (isReviewingUser || !verifyTargetUserId) {
    return;
  }

  if (!["staff", "viewer", "reject"].includes(decision)) {
    return;
  }

  const updates = {
    staff: {
      status: "active",
      role: "staff"
    },
    viewer: {
      status: "active",
      role: "viewer"
    },
    reject: {
      status: "inactive",
      role: "viewer"
    }
  };

  const targetUserId = verifyTargetUserId;
  setUserReviewBusy(true);

  try {
    const { data, error } = await mySupabase
      .from("profiles")
      .update(updates[decision])
      .eq("user_id", targetUserId)
      .eq("status", "pending")
      .select("user_id");

    if (error) {
      throw error;
    }

    // 更新0件を成功扱いにしない
    if (!data || data.length !== 1) {
      throw new Error(
        "更新できませんでした。すでに処理済みか、対象が存在しないか、更新権限がありません。"
      );
    }
  } catch (error) {
    console.error("ユーザーの承認・拒否に失敗しました。", error);

    Toast.error(
      error.message || "ユーザーの更新に失敗しました。"
    );

    setUserReviewBusy(false);
    return;
  }

  // 更新成功時にモーダルを閉じる
  document.getElementById("verifyUserModal").close();
  verifyTargetUserId = null;

  if (decision === "reject") {
    Toast.success("ユーザーを拒否しました。");
  } else {
    Toast.success("ユーザーを承認しました。");
  }

  // 一覧と各行のボタンの活性状態を更新
  try {
    await loadUsers();
  } catch (error) {
    console.error("更新後の一覧取得に失敗しました。", error);

    Toast.error("更新は完了しましたが、一覧を再取得できませんでした。再読み込みしてください。");
  } finally {
    setUserReviewBusy(false);
  }
}

// ==========================
// ユーザー設定変更モーダル
// ==========================

function openUserSettingsModal(user) {
  const modal = document.getElementById("userSettingsModal");

  if (isSavingUserSettings || modal.open || user.status === "pending") {
    return;
  }

  userSettingsTarget = {
    userId: user.user_id,
    originalCircleId: user.circle_id
  };

  const values = [
    ["userSettingsUserId", user.user_id],
    ["userSettingsEmail", user.email]
  ];

  values.forEach(([id, value]) => {
    document.getElementById(id).textContent = String(value ?? "—");
  });

  document.getElementById("userSettingsCircleId").value =
    String(user.circle_id ?? "");

  document.getElementById("userSettingsName").value =
    String(user.display_name ?? "");

  const isSelf = user.user_id === currentAdminUserId;

  modal.querySelectorAll('input[name="userSettingsRole"]')
    .forEach(input => {
      input.checked = input.value === user.role;
      input.disabled = isSelf;
    });

  modal.querySelectorAll('input[name="userSettingsStatus"]')
    .forEach(input => {
      input.checked = input.value === user.status;
      input.disabled = isSelf;
    });

  modal.showModal();
}

function closeUserSettingsModal() {
  if (isSavingUserSettings) {
    return;
  }

  document.getElementById("userSettingsModal").close();
}

function setUserSettingsBusy(busy) {
  isSavingUserSettings = busy;

  const modal = document.getElementById("userSettingsModal");
  const isSelf = userSettingsTarget?.userId === currentAdminUserId;

  modal.setAttribute("aria-busy", String(busy));

  modal.querySelectorAll("button, input").forEach(element => {
    const isProtectedField =
      element.name === "userSettingsRole" ||
      element.name === "userSettingsStatus";

    element.disabled = busy || (isSelf && isProtectedField);
  });

  document.getElementById("confirmUserSettingsButton").textContent =
    busy ? "保存中..." : "変更";
}

async function saveUserSettings() {
  const modal = document.getElementById("userSettingsModal");

  if (isSavingUserSettings || !userSettingsTarget || !modal.open) {
    return;
  }

  const target = { ...userSettingsTarget };
  const isSelf = target.userId === currentAdminUserId;

  const updates = {
    circle_id: document.getElementById("userSettingsCircleId").value.trim(),
    display_name: document.getElementById("userSettingsName").value.trim()
  };

  setUserSettingsBusy(true);

  try {
    if (!currentAdminUserId) {
      throw new Error("ログイン情報を確認できません。再読み込みしてください。");
    }

    if (!updates.circle_id || !updates.display_name) {
      throw new Error("作サーIDと名前を入力してください。");
    }

    // 自分自身のロール・ステータスは更新しない
    if (!isSelf) {
      const role = modal.querySelector(
        'input[name="userSettingsRole"]:checked'
      )?.value;

      const status = modal.querySelector(
        'input[name="userSettingsStatus"]:checked'
      )?.value;

      if (!["admin", "staff", "viewer"].includes(role)) {
        throw new Error("ロールを選択してください。");
      }

      if (!["active", "inactive"].includes(status)) {
        throw new Error("ステータスを選択してください。");
      }

      updates.role = role;
      updates.status = status;
    }

    const { data, error } = await mySupabase
      .from("profiles")
      .update(updates)
      .eq("circle_id", target.originalCircleId)
      .eq("user_id", target.userId)
      .select("user_id");

    if (error) {
      if (error.code === "23505") {
        throw new Error("作サーIDなどの一意項目が、既存の登録と重複しています。");
      }

      if (error.code === "23503") {
        throw new Error(
          "関連データの制約により作サーIDを変更できません。"
        );
      }

      throw error;
    }

    if (!data || data.length !== 1) {
      throw new Error(
        "対象が変更・削除されたか、更新権限がありません。一覧を再読み込みしてください。"
      );
    }

    // 自分の名前・作サーIDを変更した場合はプロフィールキャッシュを破棄
    if (isSelf) {
      currentProfileCache = null;
    }
  } catch (error) {
    console.error("ユーザー設定の保存に失敗しました。", error);

    setUserSettingsBusy(false);
    modal.close();

    Toast.error(
      error.message || "ユーザー設定の保存に失敗しました。"
    );
    return;
  }

  modal.close();
  Toast.success("ユーザー設定を変更しました。");

  // 保存成功と一覧の再取得失敗を区別する
  try {
    await loadUsers();
  } catch (error) {
    console.error("保存後の一覧取得に失敗しました。", error);

    Toast.error(
      "保存は完了しましたが、一覧を更新できませんでした。再読み込みしてください。"
    );
  } finally {
    setUserSettingsBusy(false);
  }
}

// ==========================
// パスワードリセットモーダル
// ==========================

function openResetPasswordModal(user) {
  const modal = document.getElementById("resetPasswordModal");

  if (modal.open || isProcessingPasswordReset) {
    return;
  }

  resetPasswordTarget = {
    userId: user.user_id,
    requestedAt: user.password_change_requested_at ?? null
  };

  document.getElementById("resetPasswordName").textContent =
    String(user.display_name ?? "");

  document.getElementById("resetPasswordEmail").textContent =
    String(user.email ?? "—");

  // 既存の日時整形関数を利用して日本時間で表示
  const requestedAtText = formatLastSignIn(
    resetPasswordTarget.requestedAt
  );

  document.getElementById("resetPasswordRequestedAt").textContent =
    requestedAtText === "—" ? "日時不明" : requestedAtText;

  modal.showModal();
}

function setPasswordResetBusy(busy) {
  isProcessingPasswordReset = busy;

  const modal = document.getElementById("resetPasswordModal");
  modal.setAttribute("aria-busy", String(busy));

  modal.querySelectorAll("button").forEach(button => {
    button.disabled = busy;
  });
}

async function rejectPasswordReset() {
  if (isProcessingPasswordReset || !resetPasswordTarget) {
    return;
  }

  const { userId, requestedAt } = resetPasswordTarget;
  setPasswordResetBusy(true);

  try {
    let query = mySupabase
      .from("profiles")
      .update({ password_change_requested_at: null })
      .eq("user_id", userId);

    // 表示した申請が現在も同じ状態であることを確認
    if (requestedAt === null) {
      query = query.is("password_change_requested_at", null);
    } else {
      query = query.eq(
        "password_change_requested_at",
        requestedAt
      );
    }

    const { data, error } = await query.select("user_id");

    if (error) {
      throw error;
    }

    if (!data || data.length !== 1) {
      throw new Error(
        "申請内容が変更されたか、対象が存在しないか、更新権限がありません。一覧を再読み込みしてください。"
      );
    }
  } catch (error) {
    console.error("パスワードリセットの拒否に失敗しました。", error);
    Toast.error(error.message || "拒否処理に失敗しました。");

    setPasswordResetBusy(false);
    return;
  }

  Toast.success("パスワードリセットを拒否しました。");
  document.getElementById("resetPasswordModal").close();
  resetPasswordTarget = null;

  try {
    await loadUsers();
  } catch (error) {
    console.error("一覧の再取得に失敗しました。", error);
    Toast.error(
      "拒否は完了しましたが、一覧を再取得できませんでした。再読み込みしてください。"
    );
  } finally {
    setPasswordResetBusy(false);
  }
}

function closeResetPasswordModal() {
  if (isProcessingPasswordReset) {
    return;
  }

  document.getElementById("resetPasswordModal").close();
  resetPasswordTarget = null;
}

// ==========================
// パスワード発行モーダル
// ==========================

async function openIssuedPasswordModal() {
  const modal = document.getElementById("issuedPasswordModal");

  if (
    isProcessingPasswordReset ||
    modal.open ||
    !resetPasswordTarget
  ) {
    return;
  }

  // モーダルを閉じると対象情報が解除されるため、先に保持する
  const { userId, requestedAt } = resetPasswordTarget;

  if (!requestedAt) {
    closeResetPasswordModal();
    Toast.error(
      "パスワードリセット申請がありません。一覧を再読み込みしてください。"
    );
    return;
  }

  const passwordElement = document.getElementById("issuedPasswordValue");
  const warningElement = document.getElementById("issuedPasswordWarning");
  const resetButton = document.getElementById("confirmResetPasswordButton");

  passwordElement.textContent = "";
  warningElement.textContent = "";
  warningElement.hidden = true;

  const originalButtonText = resetButton.textContent;
  setPasswordResetBusy(true);
  resetButton.textContent = "発行中...";

  try {
    const { data, error } = await mySupabase.functions.invoke(
      "issue-temporary-password",
      {
        body: {
          user_id: userId,
          requested_at: requestedAt
        }
      }
    );

    if (error) {
      let message = "発行結果を確認できませんでした。自動再試行はしていません。再実行前に対象ユーザーの状況を確認してください。";

      // HTTPエラーのJSON本文にある説明を取り出す
      if (error.context instanceof Response) {
        try {
          const responseBody = await error.context.json();

          if (typeof responseBody?.error === "string") {
            message = responseBody.error;
          }
        } catch {
          // 本文を読めない場合は上の案内を使用する
        }
      }

      throw new Error(message);
    }

    if (
      typeof data?.password !== "string" ||
      !/^[A-Za-z0-9]{12}$/.test(data.password)
    ) {
      throw new Error(
        "有効なパスワードを受信できませんでした。変更済みの可能性があるため、再実行前に状況を確認してください。"
      );
    }

    // 登録成功の応答を受け取ってから表示する
    passwordElement.textContent = data.password;

    if (typeof data.warning === "string" && data.warning) {
      warningElement.textContent = data.warning;
      warningElement.hidden = false;
    }

    // 処理中ガードを通さず、成功時に1つ目のモーダルを閉じる
    document.getElementById("resetPasswordModal").close();
    resetPasswordTarget = null;

    modal.showModal();
  } catch (error) {
    // エラー時は成功モーダルを表示しない
    passwordElement.textContent = "";
    document.getElementById("resetPasswordModal").close();
    resetPasswordTarget = null;

    Toast.error(
      error instanceof Error
        ? error.message
        : "パスワード発行の結果を確認できませんでした。"
    );
    return;
  } finally {
    setPasswordResetBusy(false);
    resetButton.textContent = originalButtonText;
  }

  // 発行成功後の一覧取得失敗は、パスワード更新失敗とは分ける
  try {
    await loadUsers();
  } catch {
    const message =
      "一覧を再取得できませんでした。パスワードを共有した後、画面を再読み込みしてください。";

    if (modal.open) {
      warningElement.textContent = [
        warningElement.textContent,
        message
      ].filter(Boolean).join("\n");

      warningElement.hidden = false;
    } else {
      Toast.error(message);
    }
  }
}

function closeIssuedPasswordModal() {
  document.getElementById("issuedPasswordModal").close();
}
