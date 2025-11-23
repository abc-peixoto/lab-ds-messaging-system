const express = require('express');
const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE = 'shopping_events';
const ROUTING_KEY = 'list.checkout.completed';

async function createRabbitProducer() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  return channel;
}

async function start() {
  const app = express();
  app.use(express.json());

  const rabbitChannel = await createRabbitProducer();

  app.post('/lists/:id/checkout', async (req, res) => {
    const listId = req.params.id;
    // In a real app you would get this from the DB
    const userEmail = req.body.email || 'user@example.com';
    const totalAmount = req.body.total || Math.round(Math.random() * 500 + 30);
    const payload = { listId, userEmail, totalAmount, timestamp: Date.now() };

    try {
      rabbitChannel.publish(
        EXCHANGE,
        ROUTING_KEY,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
      );
      res.status(202).json({ ok: true, message: 'Checkout accepted', listId });
    } catch (err) {
      console.error('Error publishing to RabbitMQ', err);
      res.status(500).json({ error: 'Failed to process checkout' });
    }
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Producer (List Service) listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error('Producer failed to start', err);
  process.exit(1);
});
