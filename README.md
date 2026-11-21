# AirlineSim

## Развёртывание через Docker Compose

Корневой [compose.yaml](compose.yaml) запускает веб-интерфейс со всеми микрофронтендами, BFF, шесть Go-сервисов, пять баз PostgreSQL (включая PostGIS), Kafka и справочник API. Все контейнеры подключены к внешней сети `intranet`. Порты хоста не публикуются.

1. Скопируйте `.env.example` в `.env`. Укажите адрес сайта в `AIRLINESIM_PUBLIC_URL` (с протоколом, без пути), email и пароль первого админа, пять паролей БД и `KAFKA_CLUSTER_ID`. Команды генерации указаны в шаблоне. Адрес сайта задаётся при сборке веб-интерфейса.
2. Создайте JWT-ключи один раз перед первым запуском. Закрытый ключ хранится в каталоге с доступом только для владельца. Контейнер авторизации читает его под собственным пользователем.

   ```sh
   mkdir -m 700 .airlinesim-secrets
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out .airlinesim-secrets/private_key.pem
   openssl pkey -in .airlinesim-secrets/private_key.pem -pubout -out .airlinesim-secrets/public_key.pem
   chmod 644 .airlinesim-secrets/*.pem
   ```

3. Подключите обратный прокси к `intranet` и направьте домен сайта на `http://airlinesim-web:80`. Передавайте исходный заголовок `Host` и разрешите WebSocket Upgrade. Справочник API доступен прокси по `http://airlinesim-api-reference:8080`.
4. Запустите из корня репозитория. Если сети ещё нет, предварительно выполните `docker network create intranet`.

   ```sh
   docker compose config --quiet
   docker compose up --build -d --wait
   docker compose ps
   ```

PostGIS использует образ для `linux/amd64`. После первого запуска импортируйте справочники стран, регионов и аэропортов через админку. Импорту нужен доступ к внешним источникам. Из контейнера в `intranet` можно проверить веб-вход и BFF по адресу `http://airlinesim-web/bff/health`. В сети `intranet` должны быть только доверенные контейнеры, поскольку через неё доступны внутренние gRPC-сервисы и Kafka.

Корневой Compose создаёт свои тома для PostgreSQL, Kafka и BFF. При переносе с предыдущего стенда спланируйте перенос данных до переключения прокси. Пароль первого администратора применяется при создании аккаунта.

---

## Architecture diagram

```mermaid
flowchart LR

    %% Клиент и вход
    CLIENT["Client (Frontend)"]
    INGRESS["K8s Ingress / Nginx"]
    GATEWAY["API Gateway<br>сборка ответа для фронтенда"]

    CLIENT --> INGRESS --> GATEWAY

    %% Сервисы (группируем)
    subgraph SERVICES [Сервисы]
        direction TB
        AUTH["Auth Service"]
        AIRLINE["Airline Service<br>самолёты, маршруты, персонал"]
        WORLD["Operations Service<br>аэропорты, география"]
        GAME["Game Service (Simulation Core)<br>tick loop, спрос, экономика"]
        IMPORT["Import Service<br>Импортирует данные из api и wiki и посылает ImportRequested. Потом ждет событие ImportSucceded и отправляет ответ"]
        
    end
    
    %% блоки с комментариями
    AUTH_DESC["Отвечает за аутентификацию:<br>JWT, логин, хранение пользователей"]
    AUTH -.-> AUTH_DESC

    %% Брокер
    subgraph KAFKA [Kafka Cluster]
        direction LR
        TOPIC_COMMANDS["commands"]
        TOPIC_EVENTS["events"]
    end

    %% Хранилища
    subgraph DATA [Базы данных и кэш]
        direction TB
        AUTH_DB["Auth DB"]
        AIRLINE_DB["Airline DB"]
        WORLD_DB["World DB"]
        GAME_DB["Game DB"]
        REDIS["Redis (cache)"]
    end

    %% Связи: API Gateway → сервисы
    GATEWAY --> AUTH
    GATEWAY --> AIRLINE
    GATEWAY --> WORLD
    GATEWAY --> GAME
    GATEWAY --> IMPORT

    %% Сервисы → свои БД
    AUTH --> AUTH_DB
    AIRLINE --> AIRLINE_DB
    WORLD --> WORLD_DB
    GAME --> GAME_DB

    %% Команды (от сервисов в брокер)
    AIRLINE -->|commands| TOPIC_COMMANDS
    GAME -->|commands| TOPIC_COMMANDS

    %% Команды → Game (получение команд)
    TOPIC_COMMANDS --> GAME

    %% События (World, Game, Import → events)
    WORLD <-->|events| TOPIC_EVENTS
    IMPORT <-->|events| TOPIC_EVENTS


    %% Подписка на события
    TOPIC_EVENTS --> AIRLINE

    %% Кэш
    GAME --> REDIS

    %% Стилизация для улучшения читаемости
    style KAFKA fill:stroke:#333,stroke-width:2px
    style SERVICES fill:stroke:#333
    style DATA fill:stroke:#333
```
