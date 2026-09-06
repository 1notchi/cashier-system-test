document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cancelDeleteButton").addEventListener("click", closeDeleteModal);
  document.getElementById("confirmDeleteButton").addEventListener("click", confirmDelete);
  document.getElementById("cancelRestoreButton").addEventListener("click", closeRestoreModal);
  document.getElementById("confirmRestoreButton").addEventListener("click", confirmRestore);
  document.getElementById("cancelEditButton").addEventListener("click", closeEditModal);
  document.getElementById("saveEditButton").addEventListener("click", saveEditChanges);

  setupHistoryTableEvents();
  await loadHistory();
});

// ==========================
// データ取得・全体の流れ
// ==========================

let deleteTargetSaleId = null;
let restoreTargetSaleId = null;
let editTargetSaleId = null;
let currentFestivalProducts = [];
let currentQuantityMap = {};
let currentOtherProductMap = {};

async function loadHistory() {
  // 1. 現在開催中のfestival_idを取得
  const { data: settingsData, error: settingsError } = await mySupabase
    .from("settings")
    .select("current_festival_id")
    .single();

  if (settingsError) {
    console.error(settingsError);
    Toast.error("開催情報の取得に失敗しました。");
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
    Toast.error("開催日情報の取得に失敗しました。");
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
    price,
    products (
      abbreviation,
      product_name
    )
  `)
    .eq("festival_id", festivalId)
    .order("display_order", { ascending: true });

  if (fpError) {
    console.error(fpError);
    Toast.error("商品情報の取得に失敗しました。");
    return;
  }

  // product_idがnullのレコードは表示対象から除外
  const validFestivalProducts = festivalProductsData.filter(
    fp => fp.product_id !== null
  );

  currentFestivalProducts = validFestivalProducts;

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
    Toast.error("会計履歴の取得に失敗しました。");
    return;
  }

  // 6. 上記salesに対応するsale_itemsを取得(status='active'のみ)
  const saleIds = salesData.map(sale => sale.sale_id);

  let saleItemsData = [];
  if (saleIds.length > 0) {
    const { data: itemsData, error: itemsError } = await mySupabase
      .from("sale_items")
      .select("sale_id, product_id, quantity, unit_price, other_product_name")
      .eq("status", "active")
      .in("sale_id", saleIds);

    if (itemsError) {
      console.error(itemsError);
      Toast.error("会計明細の取得に失敗しました。");
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

function buildOtherProductMap(saleItemsData) {
  const otherProductMap = {};

  saleItemsData.forEach(item => {
    if (Number(item.product_id) !== 0) {
      return;
    }

    otherProductMap[item.sale_id] = {
      productName: item.other_product_name ?? "",
      unitPrice: item.unit_price ?? ""
    };
  });

  return otherProductMap;
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
  const tableWrapper = document.getElementById("historyTableWrapper");
  const emptyMessage = document.getElementById("emptyHistoryMessage");

  tbody.innerHTML = "";

  const quantityMap = buildQuantityMap(saleItemsData);
  currentQuantityMap = quantityMap;
  currentOtherProductMap = buildOtherProductMap(saleItemsData);

  // 会計履歴が存在しない場合
  if (!salesData || salesData.length === 0) {
    tableWrapper.style.display = "none";
    emptyMessage.classList.add("show");
    return;
  }

  // 会計履歴が存在する場合
  tableWrapper.style.display = "";
  emptyMessage.classList.remove("show");

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

  if (sale.is_deleted) {
    rowHtml += `
    <td>
      <div class="action-buttons">
        <button
          type="button"
          class="restore-button"
          data-sale-id="${sale.sale_id}">
          復活
        </button>
      </div>
    </td>
  `;
  } else {
    rowHtml += `
    <td>
      <div class="action-buttons">
        <button
          type="button"
          class="edit-button"
          data-sale-id="${sale.sale_id}">
          編集
        </button>

        <button
          type="button"
          class="delete-button"
          data-sale-id="${sale.sale_id}">
          削除
        </button>
      </div>
    </td>
  `;
  }

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

    const restoreButton = event.target.closest(".restore-button");
    if (restoreButton) {
      onRestoreClick(restoreButton.dataset.saleId);
      return;
    }
  });
}

function createEditProductRow({
  productName,
  max,
  productId = null,
  fieldName = null,
  initialValue = ""
}) {
  const row = document.createElement("label");
  row.className = "edit-product-row";

  const nameElement = document.createElement("span");
  nameElement.className = "edit-product-name";
  nameElement.textContent = productName;

  const input = document.createElement("input");
  input.type = "number";
  input.className = "edit-product-input";
  input.min = "0";
  input.max = String(max);
  input.step = "1";
  input.inputMode = "numeric";
  input.value = initialValue;

  if (productId !== null) {
    input.dataset.productId = productId;
  }

  if (fieldName !== null) {
    input.dataset.field = fieldName;
  }

  input.setAttribute("aria-label", `${productName}の数量`);

  // 小数、負数、指数表記などに使用するキーを受け付けない
  input.addEventListener("keydown", event => {
    if ([".", "-", "+", "e", "E"].includes(event.key)) {
      event.preventDefault();
    }
  });

  // 貼り付けや数値入力ボタンによる範囲外入力にも対応
  input.addEventListener("input", () => {
    if (input.value === "") {
      return;
    }

    const value = Number(input.value);

    if (!Number.isInteger(value) || value < 0) {
      input.value = "";
      return;
    }

    if (value > max) {
      input.value = String(max);
    }
  });

  row.appendChild(nameElement);
  row.appendChild(input);

  return row;
}

function createEditOtherProductRow(
  initialProductName,
  initialUnitPrice
) {
  const row = document.createElement("div");
  row.className = "edit-other-product-row";

  const nameElement = document.createElement("span");
  nameElement.className = "edit-product-name";
  nameElement.textContent = "その他：";

  // その他の商品名
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className =
    "edit-product-input edit-other-product-name-input";
  nameInput.value = initialProductName;
  nameInput.maxLength = 20;
  nameInput.dataset.field = "otherProductName";
  nameInput.setAttribute("aria-label", "その他の商品名");

  // その他の数値
  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.className = "edit-product-input edit-other-product-quantity-input";
  quantityInput.min = "0";
  quantityInput.max = "10000";
  quantityInput.step = "1";
  quantityInput.inputMode = "numeric";
  quantityInput.value = initialUnitPrice;
  quantityInput.dataset.productId = "0";
  quantityInput.dataset.field = "otherUnitPrice";
  quantityInput.setAttribute(
    "aria-label",
    "その他商品の単価"
  );

  quantityInput.addEventListener("keydown", event => {
    if ([".", "-", "+", "e", "E"].includes(event.key)) {
      event.preventDefault();
    }
  });

  quantityInput.addEventListener("input", () => {
    if (quantityInput.value === "") {
      return;
    }

    const value = Number(quantityInput.value);

    if (!Number.isInteger(value) || value < 0) {
      quantityInput.value = "";
      return;
    }

    if (value > 10000) {
      quantityInput.value = "10000";
    }
  });

  row.appendChild(nameElement);
  row.appendChild(nameInput);
  row.appendChild(quantityInput);

  return row;
}

function renderEditProductList(
  festivalProductsData,
  quantityMap,
  otherProductMap,
  saleId
) {
  const productList = document.getElementById("editProductList");
  productList.innerHTML = "";

  const saleQuantities = quantityMap[saleId] || {};

  festivalProductsData.forEach(fp => {
    const productName = fp.products
      ? fp.products.product_name
      : "";

    const quantity = saleQuantities[fp.product_id] ?? 0;

    const row = createEditProductRow({
      productName,
      max: 20,
      productId: fp.product_id,
      initialValue: quantity
    });

    productList.appendChild(row);
  });

  const otherProduct = otherProductMap[saleId] || { productName: "", unitPrice: "" };
  const otherRow = createEditOtherProductRow(otherProduct.productName, otherProduct.unitPrice);
  productList.appendChild(otherRow);
}

// 編集ボタン押下時の処理
function onEditClick(saleId) {
  editTargetSaleId = saleId;
  renderEditProductList(currentFestivalProducts, currentQuantityMap, currentOtherProductMap, saleId);
  document.getElementById("editModal").classList.add("show");
}

// 編集内容の保存
async function saveEditChanges() {
  if (editTargetSaleId === null) {
    return;
  }

  const saveButton = document.getElementById("saveEditButton");
  saveButton.disabled = true;

  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      Toast.error("ログインユーザーを取得できませんでした。");
      return;
    }

    const newSaleItems = [];

    // 通常商品を登録データへ変換する
    const productInputs = document.querySelectorAll(
      "#editProductList .edit-product-row " +
      ".edit-product-input[data-product-id]"
    );

    productInputs.forEach(input => {
      if (input.value === "") {
        return;
      }

      const quantity = Number(input.value);

      // 0または不正な値の商品は登録しない
      if (
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > 20
      ) {
        return;
      }

      const festivalProduct = currentFestivalProducts.find(
        fp => String(fp.product_id) === input.dataset.productId
      );

      if (!festivalProduct) {
        return;
      }

      newSaleItems.push({
        sale_id: editTargetSaleId,
        product_id: festivalProduct.product_id,
        quantity,
        unit_price: festivalProduct.price,
        other_product_name: null,
        status: "active",
        created_by: profile.id
      });
    });

    // 「その他」の入力内容を取得する
    const otherNameInput = document.querySelector(
      '#editProductList [data-field="otherProductName"]'
    );

    const otherUnitPriceInput = document.querySelector(
      '#editProductList [data-field="otherUnitPrice"]'
    );

    const otherProductName =
      otherNameInput?.value.trim() ?? "";

    const otherUnitPrice =
      otherUnitPriceInput?.value === ""
        ? 0
        : Number(otherUnitPriceInput.value);

    // 商品名があり、金額が正の整数の場合のみ登録する
    if (
      otherProductName !== "" &&
      Number.isInteger(otherUnitPrice) &&
      otherUnitPrice > 0 &&
      otherUnitPrice <= 10000
    ) {
      newSaleItems.push({
        sale_id: editTargetSaleId,
        product_id: 0,
        quantity: 1,
        unit_price: otherUnitPrice,
        other_product_name: otherProductName,
        status: "active",
        created_by: profile.id
      });
    }

    // 現在有効な明細をすべて replaced にする
    const { error: replaceError } = await mySupabase
      .from("sale_items")
      .update({
        status: "replaced"
      })
      .eq("sale_id", editTargetSaleId)
      .eq("status", "active");

    if (replaceError) {
      console.error(replaceError);
      Toast.error("変更前の会計明細を更新できませんでした。");
      return;
    }

    // 数量が正の商品が1つもなければ、新規明細は作成しない
    if (newSaleItems.length > 0) {
      const { error: insertError } = await mySupabase
        .from("sale_items")
        .insert(newSaleItems);

      if (insertError) {
        console.error(insertError);
        Toast.error("変更後の会計明細を登録できませんでした。");
        return;
      }
    }

    closeEditModal();
    await loadHistory();

    Toast.success("編集内容を保存しました。");
  } finally {
    saveButton.disabled = false;
  }
}

// 編集モーダルを閉じる処理
function closeEditModal() {
  editTargetSaleId = null;
  document.getElementById("editModal").classList.remove("show");
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
    Toast.error("削除に失敗しました。");
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
    Toast.error("会計明細の更新に失敗しました。");
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

// 復活ボタン押下時の処理
function onRestoreClick(saleId) {
  restoreTargetSaleId = saleId;
  document.getElementById("restoreModal").classList.add("show");
}

// 復活確定時の処理
async function confirmRestore() {
  if (restoreTargetSaleId === null) {
    return;
  }

  const targetSaleId = restoreTargetSaleId;

  // salesを復活済みの状態に更新
  const { error: salesError } = await mySupabase
    .from("sales")
    .update({
      is_deleted: false,
      deleted_by: null
    })
    .eq("sale_id", targetSaleId)
    .eq("is_deleted", true);

  if (salesError) {
    console.error(salesError);
    Toast.error("会計の復活に失敗しました。");
    return;
  }

  // 対象会計に紐づくcancelledの明細だけをactiveへ戻す
  const { error: itemsError } = await mySupabase
    .from("sale_items")
    .update({
      status: "active"
    })
    .eq("sale_id", targetSaleId)
    .eq("status", "cancelled");

  if (itemsError) {
    console.error(itemsError);
    Toast.error("会計明細の復活に失敗しました。");
    return;
  }

  closeRestoreModal();
  await loadHistory();
}

// 復活確認モーダルを閉じる処理
function closeRestoreModal() {
  restoreTargetSaleId = null;
  document.getElementById("restoreModal").classList.remove("show");
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
