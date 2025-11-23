const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE = 'shopping_events';
const QUEUE = 'list_checkout_log';
const ROUTING_KEY = 'list.checkout.#';

async function start() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
  console.log('[Log Consumer] Waiting for messages...');
  channel.consume(QUEUE, (msg) => {
    if (msg !== null) {
      const content = JSON.parse(msg.content.toString());
      console.log(`Enviando comprovante da lista ${content.listId} para o usuário ${content.userEmail}`);
      channel.ack(msg);
    }
  });
}

start().catch((err) => {
  console.error('[Log Consumer] Error:', err);
  process.exit(1);
});
