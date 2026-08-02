// Supabaseクライアント生成
const mySupabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_KEY
);

//ログインしていなかったらログイン画面に戻す
window.addEventListener("pageshow", async () => {
    const { data: { session } } = await mySupabase.auth.getSession();
    if (!session) {
        location.replace("login.html");
    }
});

// ==========================
// 現在のユーザー情報
// ==========================

// プロフィールキャッシュ
let currentProfileCache = null;


// 現在ログイン中ユーザーのprofilesを取得
async function getCurrentProfile() {

    // 既に取得済みならそのまま返す
    if (currentProfileCache) {
        return currentProfileCache;
    }

    // Authユーザー取得
    const { data: { user }, error: authError } = await mySupabase.auth.getUser();


    if (authError || !user) {
        throw new Error(
            "ログインユーザーを取得できません。"
        );
    }

    // profiles取得
    const { data: profile, error } = await mySupabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

    if (error) {
        console.error(error);
        throw new Error(
            "プロフィール情報を取得できません。"
        );
    }

    // キャッシュ保存
    currentProfileCache = profile;

    return currentProfileCache;
}
