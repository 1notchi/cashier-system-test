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
