# Product Repo Safe Edit Planner v17.5.0

## 目的
商品repo別に安全な編集計画を生成する。

## 商品別ポリシー

### sales_dx
- editableAreas: src/leads/**, src/components/**, tests/**, docs/**
- deniedAreas: .env*, secrets/**, config/production.*, src/auth/**
- secretBoundary: API keys/OAuth tokens/DB credentials禁止
- customerDataBoundary: リードPII(name/email/phone)禁止

### anesty_board
- editableAreas: src/board/**, src/views/**, tests/**, docs/**
- deniedAreas: .env*, secrets/**, config/production.*, **src/insurance/**, src/health/**
- secretBoundary: API keys/保険証券データ/健診情報禁止
- customerDataBoundary: 被保険者/患者PII/健康診断データ/保険金額禁止

### backoffice_agent
- editableAreas: src/agents/**, src/handlers/**, tests/**, docs/**
- deniedAreas: .env*, secrets/**, config/production.*, src/finance/**
- secretBoundary: API keys/財務データ/従業員記録禁止
- customerDataBoundary: 従業員PII/給与/内部財務データ禁止

### email_reply_bot
- editableAreas: src/bot/**, src/templates/**, tests/**, docs/**
- deniedAreas: .env*, secrets/**, config/production.*, src/credentials/**
- secretBoundary: メール認証情報/SMTPパスワード/API keys禁止
- customerDataBoundary: 実メールアドレス/個人名禁止

### cloud_run_pm_agent
- editableAreas: tools/**, smoke/**, fixtures/**, docs/ai-dev-team/**, README.md
- deniedAreas: .env*, secrets/**, credentials/**, apps/pm-agent/config/production.*
- secretBoundary: GCPサービスアカウントkey/Cloud Run env vars/Secret Manager値禁止
- customerDataBoundary: 顧客データ全禁止
