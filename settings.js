document.addEventListener("DOMContentLoaded", async () => {
  const profile = await getCurrentProfile();

  if (profile.role !== "admin") {
    location.replace("top.html");
    return;
  }

  await loadFestivalInfo();
  await loadFestivalSettings();
});

//========================================
// キャッシュ
//========================================

let festivalInfo = null;

// 学祭情報を取得してキャッシュ
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
    alert("設定の取得に失敗しました。");
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
    alert("学園祭情報の取得に失敗しました。");
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

//========================================
// 画面表示
//========================================

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
    alert("日程の取得に失敗しました。");
    return;
  }

  document.getElementById("festivalDates").textContent = dates.map(d => formatDate(d.target_date)).join("、");
}

function formatDate(dateString) {
  if (!dateString) { return ""; }
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

//========================================
// ボタン
//========================================

function changeFestival() {

  document.getElementById("currentFestivalText").textContent =
    festivalInfo.currentFestival
      ? festivalInfo.currentFestival.festival_name
      : "（未設定）";

  loadFestivalSelect();
  document.getElementById("festivalModal").style.display = "flex";

}

// プルダウン生成
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

function closeFestivalModal() {

  document.getElementById("festivalModal").style.display = "none";

}

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
    alert("現在の学園祭の変更に失敗しました。");
    return;
  }

  // キャッシュ更新
  await loadFestivalInfo();

  // 画面更新
  await loadFestivalSettings();

  // モーダルを閉じる
  closeFestivalModal();

  showToast("現在の学園祭を変更しました。");
}

function openAddFestivalModal() {

  // TODO

}

async function editFestivalDates() {
  loadDateFestivalSelect();
  await loadFestivalDatesForEdit();
  document.getElementById("dateEditModal").style.display = "flex";
}

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

  const festivalId = Number(
    document.getElementById("dateFestivalSelect").value
  );

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
    alert("日程の取得に失敗しました。");
    return;
  }

  const container =
    document.getElementById("dateInputContainer");

  container.innerHTML = "";

  data.forEach(date => {

    addDateInput(date.target_date);

  });

}

function addDateInput(value = "") {

  const container =
    document.getElementById("dateInputContainer");

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
    class="date-delete-button"s
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

}

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

function removeDateInput(button) {

  button.parentElement.remove();

}

function closeDateEditModal() {

  document.getElementById("dateEditModal").style.display = "none";

}

function confirmDateEdit() {

  // TODO

}



let toastTimer = null;

// トーストの表示
function showToast(message) {
  const toast = document.getElementById("toastMessage");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
