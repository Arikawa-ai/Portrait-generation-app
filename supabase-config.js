// Supabase設定（公開用）
// 注意: anon keyは公開しても安全（Row Level Securityで保護）
const SUPABASE_URL = 'https://jxiupulycxwkrxdgpztg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aXVwdWx5Y3h3a3J4ZGdwenRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDYzNTgsImV4cCI6MjA3MDcyMjM1OH0.OaryIfcvg8Fj2prudy3MkXhZBtjTl0Wb9SbS1wdL7UY';

// Supabaseクライアントの初期化（CDN版を使用）
let supabase;

// 初期化を再帰的に試行する関数
function initializeSupabase() {
    
    if (typeof window !== 'undefined' && 
        window.supabase && 
        typeof window.supabase.createClient === 'function') {
        
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            window.supabase = supabase; // グローバルに公開
            
            // 初期化完了イベントを発火
            window.dispatchEvent(new CustomEvent('supabaseReady'));
            return true;
        } catch (error) {
            console.error('Supabase初期化エラー:', error);
        }
    }
    
    // 初期化が失敗した場合、100ms後に再試行
    setTimeout(initializeSupabase, 100);
    return false;
}

// すぐに初期化を開始
initializeSupabase();