# Настройка GitHub Secrets для CI/CD

## Обзор

Для автоматического развертывания DevOps AI Dashboard необходимо настроить GitHub Secrets и Variables в репозитории. Эта документация описывает все необходимые секреты и пошаговый процесс их настройки.

## Необходимые секреты

### Staging окружение

| Секрет | Описание | Пример |
|--------|----------|--------|
| `STAGING_HOST` | IP-адрес или hostname staging сервера | `staging.example.com` или `192.168.1.100` |
| `STAGING_USER` | SSH пользователь для подключения | `deploy` или `ubuntu` |
| `STAGING_SSH_KEY` | Приватный SSH ключ для аутентификации | Содержимое файла `~/.ssh/id_ed25519` |
| `STAGING_SSH_PORT` | SSH порт (опционально, по умолчанию 22) | `22` |

### Production окружение

| Секрет | Описание | Пример |
|--------|----------|--------|
| `PRODUCTION_HOST` | IP-адрес или hostname production сервера | `prod.example.com` |
| `PRODUCTION_USER` | SSH пользователь для подключения | `deploy` |
| `PRODUCTION_SSH_KEY` | Приватный SSH ключ для аутентификации | Содержимое файла `~/.ssh/id_ed25519` |
| `PRODUCTION_SSH_PORT` | SSH порт (опционально) | `22` |

### Уведомления (опционально)

| Секрет | Описание |
|--------|----------|
| `SLACK_WEBHOOK_URL` | Webhook URL для Slack уведомлений |
| `DISCORD_WEBHOOK_URL` | Webhook URL для Discord уведомлений |

## Необходимые переменные (Variables)

| Переменная | Описание | Пример |
|------------|----------|--------|
| `STAGING_URL` | URL staging окружения | `https://staging.devops-dashboard.example.com` |
| `PRODUCTION_URL` | URL production окружения | `https://devops-dashboard.example.com` |

## Пошаговая настройка

### Шаг 1: Создание SSH ключей

```bash
# Создание нового SSH ключа для деплоя
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github-deploy

# Вывод приватного ключа (для GitHub Secret)
cat ~/.ssh/github-deploy

# Вывод публичного ключа (для сервера)
cat ~/.ssh/github-deploy.pub
```

### Шаг 2: Настройка сервера

```bash
# На целевом сервере (staging/production)

# Создание пользователя для деплоя
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# Настройка SSH доступа
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh

# Добавление публичного ключа
echo "ssh-ed25519 AAAA... github-actions-deploy" | sudo tee -a /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh

# Создание директории проекта
sudo mkdir -p /opt/devops-ai-dashboard
sudo chown deploy:deploy /opt/devops-ai-dashboard

# Клонирование репозитория
sudo -u deploy git clone https://github.com/sileade/devops-ai-dashboard.git /opt/devops-ai-dashboard
```

### Шаг 3: Добавление секретов в GitHub

1. Перейдите в репозиторий на GitHub
2. Откройте **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**
4. Добавьте каждый секрет:

#### STAGING_HOST
```
Name: STAGING_HOST
Value: staging.example.com
```

#### STAGING_USER
```
Name: STAGING_USER
Value: deploy
```

#### STAGING_SSH_KEY
```
Name: STAGING_SSH_KEY
Value: (вставьте содержимое приватного ключа)
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

#### PRODUCTION_HOST
```
Name: PRODUCTION_HOST
Value: prod.example.com
```

#### PRODUCTION_USER
```
Name: PRODUCTION_USER
Value: deploy
```

#### PRODUCTION_SSH_KEY
```
Name: PRODUCTION_SSH_KEY
Value: (вставьте содержимое приватного ключа)
```

### Шаг 4: Добавление переменных

1. В том же разделе **Secrets and variables** → **Actions**
2. Перейдите на вкладку **Variables**
3. Нажмите **New repository variable**

#### STAGING_URL
```
Name: STAGING_URL
Value: https://staging.devops-dashboard.example.com
```

#### PRODUCTION_URL
```
Name: PRODUCTION_URL
Value: https://devops-dashboard.example.com
```

## Настройка окружений (Environments)

Для дополнительной безопасности рекомендуется настроить GitHub Environments:

1. Перейдите в **Settings** → **Environments**
2. Создайте окружение `staging`:
   - Добавьте protection rules (опционально)
   - Добавьте environment secrets если нужны отдельные ключи
3. Создайте окружение `production`:
   - Включите **Required reviewers** для ручного подтверждения деплоя
   - Добавьте **Wait timer** (например, 5 минут) для отмены

## Проверка настройки

### Скрипт проверки SSH подключения

```bash
#!/bin/bash
# scripts/verify-ssh.sh

echo "Проверка SSH подключения к staging..."
ssh -o StrictHostKeyChecking=no -o BatchMode=yes \
    -i ~/.ssh/github-deploy \
    deploy@staging.example.com \
    "echo 'Staging: OK'"

echo "Проверка SSH подключения к production..."
ssh -o StrictHostKeyChecking=no -o BatchMode=yes \
    -i ~/.ssh/github-deploy \
    deploy@prod.example.com \
    "echo 'Production: OK'"
```

### Тестовый workflow

Создайте тестовый workflow для проверки секретов:

```yaml
# .github/workflows/test-secrets.yml
name: Test Secrets

on:
  workflow_dispatch:

jobs:
  test-staging:
    runs-on: ubuntu-latest
    steps:
      - name: Test staging connection
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            echo "Connected to staging!"
            hostname
            docker --version

  test-production:
    runs-on: ubuntu-latest
    steps:
      - name: Test production connection
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            echo "Connected to production!"
            hostname
            docker --version
```

## Безопасность

### Рекомендации

1. **Используйте отдельные ключи** для staging и production
2. **Ограничьте права пользователя** deploy только необходимыми командами
3. **Включите Required reviewers** для production деплоя
4. **Регулярно ротируйте ключи** (каждые 90 дней)
5. **Используйте IP whitelist** на серверах для SSH

### Ограничение команд SSH

Для дополнительной безопасности можно ограничить команды в `authorized_keys`:

```
command="/opt/devops-ai-dashboard/scripts/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA...
```

## Устранение неполадок

### Ошибка: Permission denied (publickey)

1. Проверьте, что публичный ключ добавлен в `authorized_keys`
2. Проверьте права доступа: `chmod 600 ~/.ssh/authorized_keys`
3. Проверьте, что приватный ключ корректно скопирован в GitHub Secret

### Ошибка: Host key verification failed

Добавьте `-o StrictHostKeyChecking=no` в SSH команду или добавьте known_hosts.

### Ошибка: Connection timed out

1. Проверьте, что сервер доступен
2. Проверьте firewall правила
3. Проверьте правильность IP/hostname

## Контакты

При возникновении проблем создайте issue в репозитории:
https://github.com/sileade/devops-ai-dashboard/issues
