document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cancelDeleteButton").addEventListener("click", closeDeleteModal);
  document.getElementById("confirmDeleteButton").addEventListener("click", confirmDelete);
  setupHistoryTableEvents();
  await loadHistory();
});

// ==========================
// データ取得・全体の流れ
// ==========================

let deleteTargetSaleId = null;

async function loadHistory() {
  // 1. 現在開催中のfestival_idを取得
  const { data: settingsData, error: settingsError } = await mySupabase
    .from("settings")
    .select("current_festival_id")
    .single();

  if (settingsError) {
    console.error(settingsError);
    alert("開催情報の取得に失敗しました。");
    return;
  }

  const festivalId = settingsData.current_festival_id;

  // 2. 該当festivalの開催日一覧(target_date)を取得
  const { data: datesData, error: datesError } = await mySupabase
    .from("festival_dates")
    .select("target_date")
    .eq("festival_id", festivalId);

  if (datesError) {
    console.error(datesError);
    alert("開催日情報の取得に失敗しました。");
    return;
  }

  if (!datesData || datesData.length === 0) {
    console.warn("開催日が設定されていません。");
    return;
  }

  // 3. 商品列(festival_products × products)を取得
  const { data: festivalProductsData, error: fpError } = await mySupabase
    .from("festival_products")
    .select(`
          product_id,
          display_order,
          products ( abbreviation )
        `)
    .eq("festival_id", festivalId)
    .order("display_order", { ascending: true });

  if (fpError) {
    console.error(fpError);
    alert("商品情報の取得に失敗しました。");
    return;
  }

  // product_idがnullのレコードは表示対象から除外
  const validFestivalProducts = festivalProductsData.filter(
    fp => fp.product_id !== null
  );

  // 4. 開催日の範囲条件をつくる
  const dateFilters = datesData.map(row => {
    const start = row.target_date;
    const startDate = new Date(start);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString().slice(0, 10);
    return `and(sold_at.gte.${start},sold_at.lt.${end})`;
  });
  const orFilter = dateFilters.join(",");

  // 5. salesを取得
  const { data: salesData, error: salesError } = await mySupabase
    .from("sales")
    .select(`
          sale_id,
          sold_at,
          is_deleted,
          registers ( register_name ),
          profiles!sales_user_id_fkey ( display_name )
        `)
    .or(orFilter)
    .order("sold_at", { ascending: true });

  if (salesError) {
    console.error(salesError);
    alert("会計履歴の取得に失敗しました。");
    return;
  }

  // 6. 上記salesに対応するsale_itemsを取得(status='active'のみ)
  const saleIds = salesData.map(sale => sale.sale_id);

  let saleItemsData = [];
  if (saleIds.length > 0) {
    const { data: itemsData, error: itemsError } = await mySupabase
      .from("sale_items")
      .select("sale_id, product_id, quantity")
      .eq("status", "active")
      .in("sale_id", saleIds);

    if (itemsError) {
      console.error(itemsError);
      alert("会計明細の取得に失敗しました。");
      return;
    }
    saleItemsData = itemsData;
  }

  // 7. 見出し・表の描画
  renderTableHeader(validFestivalProducts);
  renderHistory(salesData, validFestivalProducts, saleItemsData);
}

// ==========================
// 集計
// ==========================
// sale_id × product_id ごとの個数を集計する
// 例: quantityMap[12][3] = 5 (sale_id=12でproduct_id=3が5個)
function buildQuantityMap(saleItemsData) {
  const quantityMap = {};
  saleItemsData.forEach(item => {
    const saleKey = item.sale_id;
    const productKey = item.product_id;
    if (!quantityMap[saleKey]) {
      quantityMap[saleKey] = {};
    }
    if (!quantityMap[saleKey][productKey]) {
      quantityMap[saleKey][productKey] = 0;
    }
    quantityMap[saleKey][productKey] += item.quantity;
  });
  return quantityMap;
}

// ==========================
// 表の描画
// ==========================
// 見出し行に商品列・操作列を追加する
function renderTableHeader(festivalProductsData) {
  const headerRow = document.getElementById("historyTableHeaderRow");

  headerRow.innerHTML = `
    <th>No.</th>
    <th>レジ</th>
    <th>ユーザー</th>
    <th>会計時刻</th>
`;

  festivalProductsData.forEach(fp => {
    const th = document.createElement("th");
    th.textContent = fp.products ? fp.products.abbreviation : "";
    headerRow.appendChild(th);
  });

  const thAction = document.createElement("th");
  thAction.textContent = "操作";
  headerRow.appendChild(thAction);
}

// 会計履歴の表本体を描画する(表示専任)
function renderHistory(salesData, festivalProductsData, saleItemsData) {
  const tbody = document.getElementById("historyTableBody");
  tbody.innerHTML = "";

  const quantityMap = buildQuantityMap(saleItemsData);

  // 古い順に通し番号を1から振る
  const numbered = salesData.map((sale, index) => ({
    ...sale,
    serialNumber: index + 1
  }));

  // 表示は新しい順
  numbered.reverse().forEach(sale => {
    const tr = document.createElement("tr");
    if (sale.is_deleted) {
      tr.classList.add("deleted-row");
    }
    tr.innerHTML = buildRowHtml(sale, festivalProductsData, quantityMap);
    tbody.appendChild(tr);
  });
}

// 1行分のHTML(文字列)を組み立てる
function buildRowHtml(sale, festivalProductsData, quantityMap) {
  const registerName = sale.registers ? sale.registers.register_name : "";
  const userName = sale.profiles ? sale.profiles.display_name : "";
  const soldAtText = formatDateTime(sale.sold_at);

  let rowHtml = `
        <td>${sale.serialNumber}</td>
        <td>${registerName}</td>
        <td>${userName}</td>
        <td>${soldAtText}</td>
      `;

  festivalProductsData.forEach(fp => {
    const qty = (quantityMap[sale.sale_id] && quantityMap[sale.sale_id][fp.product_id])
      ? quantityMap[sale.sale_id][fp.product_id]
      : 0;
    rowHtml += `<td>${qty}</td>`;
  });

  rowHtml += `
        <td>
          <button
            type="button"
            class="edit-button"
            data-sale-id="${sale.sale_id}"
            ${sale.is_deleted ? "disabled" : ""}>
            編集
          </button>

          <button
            type="button"
            class="delete-button"
            data-sale-id="${sale.sale_id}"
            ${sale.is_deleted ? "disabled" : ""}>
            削除
          </button>
        </td>
      `;

  return rowHtml;
}

// ==========================
// ボタンの挙動(イベント委任)
// ==========================
function setupHistoryTableEvents() {
  const tbody = document.getElementById("historyTableBody");

  tbody.addEventListener("click", (event) => {
    const editButton = event.target.closest(".edit-button");
    if (editButton) {
      onEditClick(editButton.dataset.saleId);
      return;
    }

    const deleteButton = event.target.closest(".delete-button");
    if (deleteButton) {
      onDeleteClick(deleteButton.dataset.saleId);
      return;
    }
  });
}

// 編集ボタン押下時の処理(未実装)
function onEditClick(saleId) {
  // TODO: 編集画面への遷移、または編集モーダルの表示などを実装予定
}

// 削除ボタン押下時の処理
function onDeleteClick(saleId) {
  deleteTargetSaleId = saleId;
  document.getElementById("deleteModal").classList.add("show");
}

// 削除確定時の処理
async function confirmDelete() {

  const profile = await getCurrentProfile();

  // salesを削除済みに更新
  const { error: salesError } = await mySupabase
    .from("sales")
    .update({
      is_deleted: true,
      deleted_by: profile.id
    })
    .eq("sale_id", deleteTargetSaleId);

  if (salesError) {
    console.error(salesError);
    alert("削除に失敗しました。");
    return;
  }

  // sale_itemsをcancelledへ更新
  const { error: itemsError } = await mySupabase
    .from("sale_items")
    .update({
      status: "cancelled"
    })
    .eq("sale_id", deleteTargetSaleId)
    .eq("status", "active");

  if (itemsError) {
    console.error(itemsError);
    alert("会計明細の更新に失敗しました。");
    return;
  }

  closeDeleteModal();

  await loadHistory();
}

// 削除モーダルを閉じる処理
function closeDeleteModal() {
  deleteTargetSaleId = null;
  document.getElementById("deleteModal").classList.remove("show");
}

// ==========================
// ユーティリティ
// ==========================
function formatDateTime(isoString) {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
}
