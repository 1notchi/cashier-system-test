//タブ一覧
const tabs = [
    { title: "トップ", href: "top.html", roles: ["admin", "staff", "viewer"] },
    { title: "レジ", href: "cashier.html", roles: ["admin", "staff", "viewer"] },
    { title: "売上確認", href: "sales.html", roles: ["admin", "staff", "viewer"] },
    { title: "会計履歴", href: "history.html", roles: ["admin", "staff", "viewer"] },
    { title: "設定", href: "settings.html", roles: ["admin"] }
];

//ページ読み込み後にヘッダーを初期化
document.addEventListener("DOMContentLoaded", async () => {
    loadHeaderStyle();
    loadHeader();
    await initializeHeader();
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
function loadHeader() {

    const container = document.getElementById("header-container");

    if (!container) {
        console.error("header-container が存在しません");
        return;
    }

    container.innerHTML = `

    <header class="app-header">

    <!-- 上段 -->
    <div class="header-top">
        <div class="header-logo">
            <img src="images/logo.png" alt="京都大学作問サークル_ロゴ" class="header-logo-image">
            <span>NFレジシステム</span>
        </div>
        <button id="logoutButton" class="logout-button">ログアウト</button>
    </div>

    <!-- 下段 -->
    <nav class="header-nav">
        <ul id="navTabs"></ul>
    </nav>

</header>

`;
}

//初期化
async function initializeHeader() {
    const profile = await getCurrentProfile();
    createTabs(profile.role);
    document.getElementById("logoutButton").addEventListener("click", logout);
}

// タブ生成
function createTabs(role) {

    const navTabs = document.getElementById("navTabs");
    navTabs.innerHTML = "";

    const currentPage = location.pathname.split("/").pop();

    tabs.filter(tab => tab.roles.includes(role)).forEach(tab => {

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

async function getCurrentUserRole() {

    const {
        data: { user },
        error: authError
    } = await mySupabase.auth.getUser();

    if (authError || !user) {
        throw new Error("ログインユーザーを取得できません。");
    }

    const { data, error } = await mySupabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (error) {
        throw error;
    }

    return data.role;
}

//ログアウト
async function logout() {
    currentProfileCache = null;
    await mySupabase.auth.signOut();
    location.href = "login.html";
}
