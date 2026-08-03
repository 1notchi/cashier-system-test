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

function editFestivalDates() {

  document.getElementById("dateEditModal").style.display = "flex";

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
