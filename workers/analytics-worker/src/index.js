const amqp = require('amqplib');

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const EXCHANGE = process.env.EXCHANGE_NAME ||  'shopping_events';
const QUEUE = process.env.QUEUE_NAME ||'analytics';
const ROUTING_KEY = process.env.BIND_PATTERN ||'list.checkout.#';


async function start() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
  console.log('[Analytics Consumer] Waiting for messages...');
  channel.consume(QUEUE, (msg) => {
    if (msg !== null) {
      const content = JSON.parse(msg.content.toString());
      console.log(`[Analytics] Lista ${content.listId}: usuário ${content.userEmail}, total gasto: R$${content.totalAmount}`);
      channel.ack(msg);
    }
  });
}

start().catch((err) => {
  console.error('[Analytics Consumer] Error:', err);
  process.exit(1);
});
