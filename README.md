# Paymo

支出だけを管理するモバイル向けWebアプリの初版です。

- HOME: 今月の支出合計、支払先別集計、直近4か月グラフ
- GRAPH: 月別支出推移
- ＋: 支出の登録（金額・支払先・日付）
- 保存: ブラウザの localStorage
- 収入管理: なし

静的サイトなので `index.html` をそのままCloudflare Pages/Workers Static Assets等で配信できます。

## 支出額しきい値通知（バックエンドの公開設定が必要）

- 通知設定で月間（利用日ベース）の支出合計に対するしきい値とON/OFFを設定します。通知の待機時間は**10分固定**で、超過通知は同じ月に1回だけです。
- 超過をサーバーが検知した時刻をD1に保存し、10分経過後に既存のWeb Push機能で送信します。10分より早く送信せず、Cron実行やプッシュ配送の都合により数分遅れる可能性があります。
- 本番環境で`migrations/0008_spending_threshold_notifications.sql`（`app/migrations/`にも同内容）をD1に適用してください。
- 実際の認証付きAPIは`app/worker/account-api-v2.js`です。Pagesの`functions/_middleware.js`は`/api/*`を別Workerに転送しています。GitHub更新だけではAPI Workerには反映されません。既存の認証・D1・VAPID設定を維持したまま、新しいAPI Workerコードを別途デプロイしてください。
- API Worker側のCron Triggerは、既存の通知ジョブを含む`scheduled()`を**毎分**実行する`* * * * *`を設定してください。`app/wrangler.jsonc`の`main`は旧`worker/entry.js`なので、認証付きAPIへのデプロイ時に誤用しないでください。
- iPhoneでWeb Pushを受け取るにはPaymoをホーム画面に追加し、通知を許可しておく必要があります。未許可の場合は配信できません。
