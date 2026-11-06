# Paymo

支出だけを管理するモバイル向けWebアプリの初版です。

- HOME: 今月の支出合計、支払先別集計、直近4か月グラフ
- GRAPH: 月別支出推移
- ＋: 支出の登録（金額・支払先・日付）
- 保存: ブラウザの localStorage
- 収入管理: なし

静的サイトなので `index.html` をそのままCloudflare Pages/Workers Static Assets等で配信できます。

## 支出額しきい値通知（バックエンドの公開設定が必要）

- 通知設定で月間（利用日ベース）の支出合計に対するしきい値とON/OFFを設定します。初期値は**30,000円・通知ON**です。すでに保存済みの設定は上書きしません。通知の待機時間は**10分固定**で、超過通知は同じ月に1回だけです。
- 超過をサーバーが検知した時刻をD1に保存し、10分経過後に既存のWeb Push機能で送信します。10分より早く送信せず、Cron実行やプッシュ配送の都合により数分遅れる可能性があります。
- 本番環境で`migrations/0008_spending_threshold_notifications.sql`（`app/migrations/`にも同内容）をD1に適用してください。
- 実際の認証付きAPIは`app/worker/account-api-v2.js`です。Pagesの`functions/_middleware.js`は`/api/*`を別Workerに転送しています。GitHub更新だけではAPI Workerには反映されません。既存の認証・D1・VAPID設定を維持したまま、新しいAPI Workerコードを別途デプロイしてください。
- API Worker側のCron Triggerは、既存の通知ジョブを含む`scheduled()`を**毎分**実行する`* * * * *`を設定してください。`app/wrangler.jsonc`の`main`は旧`worker/entry.js`なので、認証付きAPIへのデプロイ時に誤用しないでください。
- iPhoneでWeb Pushを受け取るにはPaymoをホーム画面に追加し、通知を許可しておく必要があります。未許可の場合は配信できません。

## Cloudflare通知サーバーの公開手順（無料枠・既存Workerを更新）

Paymoの表示画面はCloudflare Pagesですが、`/api/*`は別の既存Worker `paymo-api` に転送されています。**GitHubのJSを変更しただけでは通知条件をサーバーに保存できません**。通知の設定額を変更したら即座に適用するには、サーバー側の支出額通知APIを本番Workerへ公開する必要があります。

既存アカウント・会員データを維持したまま反映するため、手動実行のGitHub Actions `Deploy Paymo spending alert API Worker` を用意しています。次の2項目をGitHubリポジトリの **Settings → Secrets and variables → Actions → Repository secrets** に安全に設定してください（チャットに貼り付けないでください）。

- `CLOUDFLARE_API_TOKEN`：既存CloudflareアカウントでWorkers編集とD1操作に必要な権限を持つAPIトークン
- `CLOUDFLARE_ACCOUNT_ID`：同アカウントのID
D1のデータベースIDは、既存の `paymo-api` Workerの `DB` バインディングから自動取得します。新しいデータベースは作りません。

設定したらGitHub → Actions → `Deploy Paymo spending alert API Worker` → Run workflow を実行してください。処理では既存D1のIDを照合し、`0008`/`0009`の通知用SQLだけを適用して既存の`paymo-api` Workerを更新します。最後に本番サイトのAPI応答ヘッダーを検査します。WorkerのVAPID秘密鍵はCloudflare側の既存Secretを利用します。**API公開成功後もiPhoneへの実通知は権限・購読・Cron Triggerを別途確認する必要があります。**

上記2項目が未設定の場合、GitHub側からCloudflareにデプロイする権限がないため、**本番適用はできません**。画面内の端末キャッシュは、実際の通知条件を変更しません。
