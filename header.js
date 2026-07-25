//タブ一覧
const tabs = [
    { title: "トップ", href: "top.html" },
    { title: "レジ", href: "cashier.html" },
    { title: "売上確認", href: "sales.html" }
];

//ページ読み込み後にヘッダーを初期化
document.addEventListener("DOMContentLoaded", async () => {
    loadHeaderStyle();
    await loadHeader();
    initializeHeader();
});

//CSSの読み込み
function loadHeaderStyle() {
    if (document.querySelector('link[href="header.css"]')) {
        return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "header.css";

    document.head.appendChild(link);
}

// ヘッダーHTMLをページ先頭へ挿入
async function loadHeader() {

    const response = await fetch("header.html");

    if (!response.ok) {
        throw new Error("header.html の読み込みに失敗しました。");
    }

    const html = await response.text();
    document.body.insertAdjacentHTML("afterbegin", html);
}

//初期化
function initializeHeader() {
    createTabs();

    document
        .getElementById("logoutButton")
        .addEventListener("click", logout);
}

// タブ生成
function createTabs() {

    const navTabs = document.getElementById("navTabs");
    navTabs.innerHTML = ""; 
    
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

//ログアウト
function logout() {

    if (confirm("ログアウトしますか？")) {

        // await supabase.auth.signOut();

        location.href = "login.html";

    }

}
