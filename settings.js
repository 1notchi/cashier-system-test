//========================================
// 初期化・キャッシュ
//========================================

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await getCurrentProfile();

  if (profile.role !== "admin") {
    location.replace("top.html");
    return;
  }

  await loadFestivalInfo();
  await loadFestivalSettings();
});

let festivalInfo = null;

//========================================
// 学園祭情報の取得・表示
//========================================

// 学園祭情報を取得してキャッシュ
async function loadFestivalInfo() {

  // settings取得
  const {
    data: settings,
    error: settingsError
  } = await mySupabase
    .from("settings")
    .select("current_festival_id")
    .single();

  if (settingsError) {
    console.error(settingsError);
    Toast.error("現在の学園祭の変更に失敗しました。");
    return;
  }

  // festivals一覧取得
  const {
    data: festivals,
    error: festivalsError
  } = await mySupabase
    .from("festivals")
    .select("festival_id, festival_name")
    .order("festival_id", { ascending: true });

  if (festivalsError) {
    console.error(festivalsError);
    Toast.error("学園祭情報の取得に失敗しました。");
    return;
  }

  const currentFestival = festivals.find(
    f => f.festival_id === settings.current_festival_id
  );

  festivalInfo = {
    currentFestivalId: settings.current_festival_id,
    currentFestival,
    festivals
  };

}

// 設定画面に学園祭名・日程を表示
async function loadFestivalSettings() {

  document.getElementById("currentFestivalName").textContent =
    festivalInfo.currentFestival
      ? festivalInfo.currentFestival.festival_name
      : "（未設定）";

  const {
    data: dates,
    error: datesError
  } = await mySupabase
    .from("festival_dates")
    .select("target_date")
    .eq("festival_id", festivalInfo.currentFestivalId)
    .order("target_date", { ascending: true });

  if (datesError) {
    console.error(datesError);
    Toast.error("日程の取得に失敗しました。");
    return;
  }

  document.getElementById("festivalDates").textContent = dates.map(d => formatDate(d.target_date)).join("、");
}

// 日付を yyyy/mm/dd 形式に整形
function formatDate(dateString) {
  if (!dateString) { return ""; }
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}


//========================================
// 学園祭変更
//========================================

// 学園祭変更モーダルを開く
function changeFestival() {

  document.getElementById("currentFestivalText").textContent =
    festivalInfo.currentFestival
      ? festivalInfo.currentFestival.festival_name
      : "（未設定）";

  loadFestivalSelect();
  document.getElementById("festivalModal").style.display = "flex";

}

// 学園祭の選択肢を生成
function loadFestivalSelect() {

  const select = document.getElementById("festivalSelect");
  select.innerHTML = "";

  festivalInfo.festivals.forEach(festival => {
    const option = document.createElement("option");
    option.value = festival.festival_id;
    option.textContent = festival.festival_name;
    if (festival.festival_id === festivalInfo.currentFestivalId) {
      option.selected = true;
    }
    select.appendChild(option);
  });

}

// 学園祭変更モーダルを閉じる
function closeFestivalModal() {
  document.getElementById("festivalModal").style.display = "none";
}

// 学園祭変更を保存
async function confirmFestivalChange() {

  const festivalId = Number(
    document.getElementById("festivalSelect").value
  );

  const { error } = await mySupabase
    .from("settings")
    .update({
      current_festival_id: festivalId
    })
    .eq("id", 1);

  if (error) {
    console.error(error);
    Toast.error("現在の学園祭の変更に失敗しました。");
    return;
  }

  // キャッシュ更新
  await loadFestivalInfo();

  // 画面更新
  await loadFestivalSettings();

  // モーダルを閉じる
  closeFestivalModal();

  Toast.success("現在の学園祭を変更しました。");
}

// 新しい学園祭追加モーダルを開く
function openAddFestivalModal() {

  // TODO

}

//========================================
// 名称変更
//========================================

// 名称変更モーダルを開く
function changeFestivalName() {
  if (!festivalInfo) {
    Toast.error("学園祭情報が読み込まれていません。");
    return;
  }

  loadNameFestivalSelect();
  loadFestivalNameForEdit();

  document.getElementById("nameEditModal").style.display = "flex";
}

// 編集対象の学園祭の選択肢を生成
function loadNameFestivalSelect() {
  const select = document.getElementById("nameFestivalSelect");
  select.innerHTML = "";

  festivalInfo.festivals.forEach(festival => {
    const option = document.createElement("option");
    option.value = festival.festival_id;
    option.textContent = festival.festival_name;
    select.appendChild(option);
  });

  select.value = String(festivalInfo.currentFestivalId ?? "");
}

// 選択した学園祭のID・名称を入力欄に表示
function loadFestivalNameForEdit() {
  const festivalId = document.getElementById("nameFestivalSelect").value;

  const festival = festivalInfo.festivals.find(
    f => String(f.festival_id) === festivalId
  );

  document.getElementById("festivalIdInput").value =
    festival ? festival.festival_id : "";

  document.getElementById("festivalNameInput").value =
    festival ? festival.festival_name : "";
}

let isSavingFestivalName = false;

// 名称変更を保存
async function confirmFestivalNameEdit() {
  if (isSavingFestivalName) return;

  const originalIdValue =
    document.getElementById("nameFestivalSelect").value;

  const newName =
    document.getElementById("festivalNameInput").value;

  if (originalIdValue === "") {
    Toast.error("学園祭を選択してください。");
    return;
  }

  if (newName.trim() === "") {
    Toast.error("学園祭の名称を入力してください。");
    return;
  }

  const originalId = Number(originalIdValue);

  isSavingFestivalName = true;

  let errorMessage = "学園祭の名称の保存に失敗しました。";

  try {
    const { data, error } = await mySupabase
      .from("festivals")
      .update({ festival_name: newName })
      .eq("festival_id", originalId)
      .select("festival_id")
      .single();

    if (error) throw error;

    if (!data) {
      Toast.error("更新対象の学園祭が見つかりません。");
      return;
    }

    closeNameEditModal();
    Toast.success("学園祭の名称を保存しました。");

    errorMessage =
      "保存は完了しましたが、画面の更新に失敗しました。再読み込みしてください。";

    await loadFestivalInfo();
    await loadFestivalSettings();
  } catch (error) {
    console.error(error);
    Toast.error(errorMessage);
  } finally {
    isSavingFestivalName = false;
  }
}

// 名称変更モーダルを閉じる
function closeNameEditModal() {
  document.getElementById("nameEditModal").style.display = "none";
}

//========================================
// 日程編集
//========================================

// 日程編集モーダルを開く
async function editFestivalDates() {
  loadDateFestivalSelect();
  await loadFestivalDatesForEdit();
  document.getElementById("dateEditModal").style.display = "flex";
}

// 編集対象の学園祭の選択肢を生成
function loadDateFestivalSelect() {

  const select = document.getElementById("dateFestivalSelect");

  select.innerHTML = "";

  festivalInfo.festivals.forEach(festival => {

    const option = document.createElement("option");
    option.value = festival.festival_id;
    option.textContent = festival.festival_name;

    if (festival.festival_id === festivalInfo.currentFestivalId) {
      option.selected = true;
    }

    select.appendChild(option);
  });

}

async function loadFestivalDatesForEdit() {

  const festivalId = Number(document.getElementById("dateFestivalSelect").value);

  const {
    data,
    error
  } = await mySupabase
    .from("festival_dates")
    .select("target_date")
    .eq("festival_id", festivalId)
    .order("target_date", { ascending: true });

  if (error) {
    console.error(error);
    Toast.error("日程の取得に失敗しました。");
    return;
  }

  const container = document.getElementById("dateInputContainer");
  container.innerHTML = "";
  data.forEach(date => {
    addDateInput(date.target_date);
  });

  updateDateButtonState();
}

// 日程入力欄を追加
function addDateInput(value = "") {

  const container = document.getElementById("dateInputContainer");

  // 7日ある場合は追加しない
  if (container.children.length >= 7) {
    return;
  }

  const row = document.createElement("div");

  row.className = "festival-row date-row";

  row.innerHTML = `
  <div class="date-input-area">
    <input
      type="text"
      class="date-input"
      value="${formatDate(value)}"
      placeholder="yyyy/mm/dd"
      maxlength="10"
    >

    <div class="date-error"></div>
  </div>

  <button
    class="date-delete-button"
    onclick="removeDateInput(this)">
    削除
  </button>
`;

  container.appendChild(row);

  const input = row.querySelector(".date-input");

  input.addEventListener("blur", () => {
    normalizeDateInput(input);
  });

  input.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {

      event.preventDefault();

      input.blur();

    }

  });

  updateDateButtonState();

}

// 日程入力値をチェック・整形
function normalizeDateInput(input) {

  const error =
    input.parentElement.querySelector(".date-error");

  // 空欄は許可
  if (input.value.trim() === "") {
    input.classList.remove("input-error");
    error.textContent = "";
    error.classList.remove("show");
    return;
  }

  const formatted = normalizeDate(input.value);

  if (formatted) {

    input.value = formatted;

    input.classList.remove("input-error");

    error.textContent = "";
    error.classList.remove("show");

  } else {

    input.classList.add("input-error");

    error.textContent = "正しい日付を入力してください。";
    error.classList.add("show");

  }

}

// 日付として正しいかチェックして yyyy/mm/dd に整形
function normalizeDate(value) {

  const m = value.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (!m) return null;

  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const d = new Date(y, month - 1, day);

  if (
    d.getFullYear() !== y ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  return `${y}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

// 日程入力欄を削除
function removeDateInput(button) {

  const container = document.getElementById("dateInputContainer");

  // 1日しかない場合は削除しない
  if (container.children.length <= 1) {
    return;
  }

  button.parentElement.remove();

  updateDateButtonState();

}

// 日程追加・削除ボタンの有効・無効を更新
function updateDateButtonState() {

  const container = document.getElementById("dateInputContainer");
  const addButton = document.getElementById("addDateButton");
  const rows = container.children.length;

  // 削除ボタン
  const deleteButtons =
    container.querySelectorAll(".date-delete-button");

  deleteButtons.forEach(button => {
    button.disabled = rows <= 1;
  });

  // 追加ボタン
  addButton.disabled = rows >= 7;

}

// 日程を保存
async function confirmDateEdit() {

  const inputs = document.querySelectorAll("#dateInputContainer .date-input");

  //========== 1. 想定外のエラーの検出 ==========

  // 日程が0件の場合
  if (inputs.length === 0) {
    Toast.error("日程を1日以上登録してください。");
    return;
  }

  // 日程が7件より多い場合
  if (inputs.length > 7) {
    Toast.error("日程は7日以内にしてください。");
    return;
  }

  const dates = [];
  let hasError = false;

  //========== 2. 入力チェック ==========
  inputs.forEach(input => {

    const error =
      input.parentElement.querySelector(".date-error");

    const value = input.value.trim();

    // エラー表示をリセット
    input.classList.remove("input-error");
    error.textContent = "";
    error.classList.remove("show");

    // 空欄チェック
    if (value === "") {

      input.classList.add("input-error");
      error.textContent = "日付を入力してください。";
      error.classList.add("show");

      hasError = true;
      return;
    }

    // 日付チェック
    const formatted = normalizeDate(value);

    if (!formatted) {

      input.classList.add("input-error");
      error.textContent = "正しい日付を入力してください。";
      error.classList.add("show");

      hasError = true;
      return;
    }

    // 正規化
    input.value = formatted;
    dates.push(formatted);

  });

  //========== 3. 重複チェック ==========
  const duplicatedDates = dates.filter(
    (date, index) => dates.indexOf(date) !== index
  );

  if (duplicatedDates.length > 0) {

    inputs.forEach(input => {

      const value = input.value.trim();

      if (duplicatedDates.includes(value)) {

        const error =
          input.parentElement.querySelector(".date-error");

        input.classList.add("input-error");
        error.textContent = "同じ日付が重複しています。";
        error.classList.add("show");

        hasError = true;
      }

    });

  }

  // エラーがあれば保存しない
  if (hasError) {
    return;
  }

  //========== 4. 保存 ==========
  const festivalId = Number(
    document.getElementById("dateFestivalSelect").value
  );

  // 既存の日程を全削除
  const { error: deleteError } = await mySupabase
    .from("festival_dates")
    .delete()
    .eq("festival_id", festivalId);

  if (deleteError) {
    console.error(deleteError);
    Toast.error("既存の日程の削除に失敗しました。");
    return;
  }

  // 新しい日程を登録
  const insertData = dates.map(date => ({
    festival_id: festivalId,
    target_date: date
  }));

  const { error: insertError } = await mySupabase
    .from("festival_dates")
    .insert(insertData);

  if (insertError) {
    console.error(insertError);
    Toast.error("日程の保存に失敗しました。");
    return;
  }

  // 画面の日程を更新
  await loadFestivalSettings();

  // モーダルを閉じる
  closeDateEditModal();

  // トースト表示
  Toast.success("学園祭の日程を変更しました。");

}

// 日程編集モーダルを閉じる
function closeDateEditModal() {
  document.getElementById("dateEditModal").style.display = "none";
}
