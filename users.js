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
  document.getElementById("cancelResetPasswordButton").addEventListener("click", closeResetPasswordModal);
  document.getElementById("closeResetPasswordButton").addEventListener("click", closeResetPasswordModal);

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

  try {
    const profile = await getCurrentProfile();

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
        disabled: false
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
// パスワードリセットモーダル
// ==========================

function openResetPasswordModal(user) {
  const modal = document.getElementById("resetPasswordModal");

  if (modal.open) {
    return;
  }

  document.getElementById("resetPasswordName").textContent =
    String(user.display_name ?? "");

  document.getElementById("resetPasswordEmail").textContent =
    String(user.email ?? "—");

  modal.showModal();
}

function closeResetPasswordModal() {
  document.getElementById("resetPasswordModal").close();
}
