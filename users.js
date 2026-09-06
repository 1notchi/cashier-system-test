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

// ==========================
// 初期化・権限確認
// ==========================

document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("users-status");
  const content = document.getElementById("users-content");

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
  const { data, error } = await mySupabase
    .from("profiles")
    .select("user_id, circle_id, display_name, role, status")
    .order("circle_id", { ascending: true })
    .order("user_id", { ascending: true });

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
      user.user_id,
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
      { label: "認証", className: "users-verify-button" },
      { label: "パスワードリセット", className: "users-reset-button" },
      { label: "ユーザー設定変更", className: "users-settings-button" }
    ];

    buttonDefinitions.forEach(({ label, className }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `users-action-button ${className}`;
      button.textContent = label;

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
