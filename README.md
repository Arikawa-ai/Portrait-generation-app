# Portrait Generation App

似顔絵作成アプリケーション

## セットアップ

### 開発環境

```bash
# リポジトリをクローン
git clone [your-repo-url]
cd Portrait-generation-app

# 依存関係をインストール（開発時のみ）
npm install
```

### 本番環境（GitHub Pages）

GitHub Pagesでホスティングする場合、node_modulesは不要です。
CDNから直接ライブラリを読み込みます。

## ファイル構成

- `index.html` - メインアプリ
- `admin.html` - 管理画面
- `supabase-config.js` - Supabase接続設定
- `.gitignore` - Git除外設定

## デプロイ

1. GitHubにプッシュ
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. GitHub Pages設定
- Settings → Pages
- Source: Deploy from a branch
- Branch: main / root

## 注意事項

- `.env.local`ファイルは共有しない
- `node_modules`はGitにコミットしない
- 管理画面のアクセスには認証が必要
