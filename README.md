# Lab Mensageria — Lista de Compras com RabbitMQ + API Gateway + k6

Este lab demonstra a migração de um fluxo síncrono para eventos assíncronos usando **RabbitMQ**.
Ao finalizar uma compra (`/lists/:id/checkout`), o **List Service** publica um evento e responde rapidamente com **202 Accepted**, enquanto **consumidores** processam o resto de forma assíncrona.

O lab inclui:

* **RabbitMQ via Docker**
* **List Service escalável (Producer)**
* **Consumers escaláveis (Notification + Analytics)**
* **API Gateway em Node com balanceamento**
* **Stress test com k6**
* **Tudo orquestrado por docker-compose**

---

## Pré-requisitos

* Docker + Docker Compose
* Node.js 16+ (somente se rodar sem Docker)

---

## Estrutura do Projeto

```
lab-ds-messaging-system/
├─ docker-compose.yml
├─ .env
├─ gateway/
│  ├─ src/index.js
│  ├─ package.json
│  └─ Dockerfile
├─ services/
│  └─ list-service/
│     ├─ src/index.js
│     ├─ package.json
│     └─ Dockerfile
├─ workers/
│  ├─ notification-worker/
│  │  ├─ src/index.js
│  │  ├─ package.json
│  │  └─ Dockerfile
│  └─ analytics-worker/
│     ├─ src/index.js
│     ├─ package.json
│     └─ Dockerfile
└─ scripts/
   └─ stress-test.js
```

---

## Variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
```

Essas variáveis são usadas pelo compose para:

* criar o usuário/senha no broker;
* montar `RABBITMQ_URL` automaticamente nos serviços.

---

## Como executar (com Docker Compose)

### 1) Subir stack completa

```bash
docker compose up --build
```

Isso sobe:

* RabbitMQ (broker + management UI)
* list-service (producer interno)
* notification-worker
* analytics-worker
* api-gateway (porta pública)

### 2) Acessar RabbitMQ Management

* URL: `http://localhost:15672`
* Login: `guest / guest`

---

## API Gateway (porta pública)

O **único serviço acessível via host** é o gateway.

* Host → Gateway (porta 3000)
* Gateway → balanceia para réplicas internas do `list-service`

Porta pública:

```
http://localhost:3000
```

---

## Testar requisição manualmente

```bash
curl -i -X POST http://localhost:3000/lists/123/checkout \
  -H 'Content-Type: application/json' \
  -d '{"email": "aluno@puc.edu", "total": 199.90}'
```

### Resultado esperado

* Resposta rápida com **202 Accepted**
* Log no producer (evento publicado)
* Logs nos dois consumidores (processamento assíncrono)
* Gráficos no RabbitMQ subindo/descendo

---

## Rodar com múltiplas instâncias

Exemplo:

```bash
docker compose up --build \
  --scale list-service=3 \
  --scale notification-worker=2 \
  --scale analytics-worker=2
```

> O gateway descobre os IPs dos produtores via DNS do Docker e distribui as requisições em round-robin.

---

## Stress test com k6

### 1) Script

O script fica em:

```
scripts/stress-test.js
```

Ele faz ramp-up de VUs e valida:

* status 202
* presença do header `X-Transaction-Id`

### 2) Executar stress junto com a stack

```bash
docker compose up --build \
  --scale list-service=3 \
  --scale notification-worker=2 \
  --scale analytics-worker=2 \
  k6
```

Você verá no terminal do k6:

* req/s
* p95 latency
* taxa de erro

E no RabbitMQ Management:

* pico de mensagens entrando/saindo
* múltiplos consumers competindo na fila