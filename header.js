// ==========================
// タブ一覧
// ==========================

const tabs = [
    { title: "トップ", href: "top.html" },
    { title: "レジ", href: "register.html" },
    { title: "売上確認", href: "sales.html" }
];

// ==========================
// 初期化
// ==========================

function initializeHeader() {
    createTabs();

    document
        .getElementById("logoutButton")
        .addEventListener("click", logout);
}

// ==========================
// タブ生成
// ==========================

function createTabs() {

    const navTabs = document.getElementById("navTabs");
    const currentPage = location.pathname.split("/").pop();

    tabs.forEach(tab => {

        const li = document.createElement("li");
        const a = document.createElement("a");

        a.href = tab.href;
        a.textContent = tab.title;

        if (currentPage === tab.href) {
            a.classList.add("active");
        }

        li.appendChild(a);
        navTabs.appendChild(li);

    });

}

// ==========================
// ログアウト
// ==========================

function logout() {

    if (confirm("ログアウトしますか？")) {

        // await supabase.auth.signOut();

        location.href = "login.html";

    }

}
