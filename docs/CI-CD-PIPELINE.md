# CI/CD Pipeline Documentation

## Обзор

DevOps AI Dashboard использует полностью автоматизированный CI/CD пайплайн на базе GitHub Actions для сборки, тестирования и развертывания приложения.

## Архитектура пайплайна

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GitHub Repository                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Commit    │───▶│   CI Tests  │───▶│ Build Image │───▶│   Staging   │  │
│  │   to main   │    │  (ci.yml)   │    │  (cd.yml)   │    │   Deploy    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                    │        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────▼─────┐  │
│  │  Create Tag │───▶│   Release   │───▶│ Multi-arch  │───▶│ Production  │  │
│  │    v1.x.x   │    │ (release.yml│    │   Build     │    │   Deploy    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. CI Pipeline (ci.yml)

Запускается при каждом push и pull request в main.

**Этапы:**
- Lint (ESLint)
- Type Check (TypeScript)
- Unit Tests (Vitest)
- Security Scan (Trivy, CodeQL)

```yaml
# Триггеры
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

### 2. CD Pipeline (cd.yml)

Запускается при push в main или создании тега.

**Этапы:**
1. Pre-deployment Tests
2. Build & Push Docker Image
3. Deploy to Staging
4. Deploy to Production (только для тегов)
5. Smoke Tests

**Стратегия деплоя:**
- Blue-Green deployment с zero-downtime
- Автоматический rollback при сбое
- Health checks после каждого этапа

### 3. Release Pipeline (release.yml)

Запускается при создании тега версии (v*).

**Этапы:**
1. Create GitHub Release
2. Build Multi-arch Docker Image (amd64, arm64)
3. Push to GitHub Container Registry

## Секреты и переменные

### Repository Secrets

| Секрет | Описание |
|--------|----------|
| `STAGING_HOST` | IP/hostname staging сервера |
| `STAGING_USER` | SSH пользователь для staging |
| `STAGING_SSH_KEY` | SSH ключ для staging |
| `PRODUCTION_HOST` | IP/hostname production сервера |
| `PRODUCTION_USER` | SSH пользователь для production |
| `PRODUCTION_SSH_KEY` | SSH ключ для production |

### Repository Variables

| Переменная | Описание |
|------------|----------|
| `STAGING_URL` | URL staging окружения |
| `PRODUCTION_URL` | URL production окружения |
| `SLACK_WEBHOOK_URL` | Webhook для Slack уведомлений |

## Настройка серверов

### Требования к серверу

- Docker 24.0+
- Docker Compose v2
- Git
- 4GB RAM минимум
- 20GB свободного места

### Установка на сервер

```bash
# Клонирование репозитория
git clone https://github.com/sileade/devops-ai-dashboard.git /opt/devops-ai-dashboard
cd /opt/devops-ai-dashboard

# Установка зависимостей
./scripts/install.sh

# Настройка переменных окружения
cp .env.example .env
nano .env

# Запуск
docker compose up -d
```

### Настройка SSH доступа

```bash
# На локальной машине
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Добавить публичный ключ на сервер
ssh-copy-id -i ~/.ssh/github-actions-deploy.pub user@server

# Добавить приватный ключ в GitHub Secrets
cat ~/.ssh/github-actions-deploy
```

## Ручной деплой

### Использование скрипта deploy.sh

```bash
# Деплой последней версии
./scripts/deploy.sh

# Деплой конкретной версии
./scripts/deploy.sh --version 1.2.0

# Деплой без подтверждения
./scripts/deploy.sh --force

# Откат на предыдущую версию
./scripts/deploy.sh --rollback

# Только проверка здоровья
./scripts/deploy.sh --health-only

# Dry run (показать что будет сделано)
./scripts/deploy.sh --dry-run
```

### Опции скрипта

| Опция | Описание |
|-------|----------|
| `--version VERSION` | Деплой конкретной версии |
| `--rollback` | Откат на предыдущую версию |
| `--force` | Без подтверждения |
| `--dry-run` | Показать без выполнения |
| `--health-only` | Только проверка здоровья |
| `--backup` | Создать бэкап перед деплоем |
| `--no-backup` | Пропустить создание бэкапа |
| `--notify` | Отправить уведомления |

## GitHub Webhook

### Настройка автоматического деплоя через webhook

```bash
# На сервере
./scripts/setup-webhook.sh --secret "your-secret-key" --systemd

# Или вручную
./scripts/setup-webhook.sh --secret "your-secret-key" --port 9000
```

### Настройка в GitHub

1. Перейти в Settings → Webhooks
2. Add webhook
3. Payload URL: `http://YOUR_SERVER_IP:9000`
4. Content type: `application/json`
5. Secret: `your-secret-key`
6. Events: Push events, Releases

## Мониторинг деплоев

### Логи

```bash
# Логи деплоя
tail -f /opt/devops-ai-dashboard/logs/deploy.log

# Логи webhook
tail -f /opt/devops-ai-dashboard/logs/webhook.log

# Логи Docker
docker compose logs -f app
```

### Метрики

- GitHub Actions: Вкладка Actions в репозитории
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

## Rollback процедура

### Автоматический rollback

При сбое health check после деплоя автоматически запускается rollback:
1. Восстановление предыдущей версии кода
2. Перезапуск контейнеров
3. Восстановление базы данных (если есть бэкап)

### Ручной rollback

```bash
# Через скрипт
./scripts/deploy.sh --rollback

# Через Git
cd /opt/devops-ai-dashboard
git checkout v1.0.0
docker compose pull
docker compose up -d

# Через GitHub Actions
# Запустить workflow с environment=production и указать предыдущий тег
```

## Безопасность

### Сканирование уязвимостей

- **Trivy**: Сканирование Docker образов
- **CodeQL**: Статический анализ кода
- **Dependabot**: Обновление зависимостей

### Best Practices

1. Никогда не храните секреты в коде
2. Используйте GitHub Secrets для чувствительных данных
3. Ограничьте SSH доступ по ключам
4. Регулярно обновляйте зависимости
5. Проверяйте логи на подозрительную активность

## Troubleshooting

### CI падает на тестах

```bash
# Локальный запуск тестов
pnpm test

# Проверка типов
pnpm typecheck
```

### Docker build падает

```bash
# Очистка кэша
docker builder prune -f

# Сборка без кэша
docker build --no-cache -t devops-ai-dashboard .
```

### Деплой не проходит

1. Проверить SSH подключение
2. Проверить права на директорию
3. Проверить свободное место
4. Проверить логи: `docker compose logs`

### Health check падает

```bash
# Проверить статус контейнеров
docker compose ps

# Проверить логи приложения
docker compose logs app

# Ручная проверка endpoint
curl http://localhost:3000/api/health
```

## Контакты

- GitHub Issues: https://github.com/sileade/devops-ai-dashboard/issues
- Документация: https://github.com/sileade/devops-ai-dashboard/docs
