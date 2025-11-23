# 🐇 Lab Mensageria - Lista de Compras com RabbitMQ

## Pré-requisitos
- Node.js 16+
- RabbitMQ rodando localmente (default: amqp://localhost)

## Instalação
```bash
npm install
```

## Estrutura do Projeto
- `producer-list-service/`: API Express (`POST /lists/:id/checkout`) que publica eventos.
- `consumer-log/`: Worker para logs/"notificações"
- `consumer-analytics/`: Worker para "analytics"

## Como executar

1. **Subir o RabbitMQ:**
   - Docker exemplo:
   ```bash
   docker run -d --hostname rabbit --name lab-rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
   # Interface web: http://localhost:15672 login: guest/guest
   ```

2. **Iniciar serviços** (em terminais separados):
   ```bash
   npm run start:producer
   npm run start:consumer-log
   npm run start:consumer-analytics
   ```

3. **Testar requisição:**
   ```bash
   curl -X POST http://localhost:3000/lists/123/checkout \
   -H 'Content-Type: application/json' \
   -d '{"email": "aluno@puc.edu", "total": 199.90}'
   ```
   - O producer responderá rapidamente (202).
   - Veja os logs nos consumidores.
   - Veja as mensagens na interface do RabbitMQ.

## Observação

- Altere `RABBITMQ_URL` nas variáveis de ambiente caso rode fora do localhost.