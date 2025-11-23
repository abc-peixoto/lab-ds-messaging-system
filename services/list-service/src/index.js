const express = require("express");
const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const EXCHANGE = process.env.EXCHANGE_NAME || "shopping_events";
const ROUTING_KEY = "list.checkout.completed";

let rabbitChannel = null;

async function connectWithRetry(url, retries = 12, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await amqp.connect(url, { timeout: 5000 });
      const ch = await conn.createChannel();
      await ch.assertExchange(EXCHANGE, "topic", { durable: true });
      console.log("[Producer] Connected to RabbitMQ");
      return ch;
    } catch (err) {
      console.log(
        `[Producer] RabbitMQ not ready (try ${i}/${retries}) - ${err.code || err.message}`
      );
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function bootRabbit() {
  try {
    rabbitChannel = await connectWithRetry(RABBITMQ_URL);
  } catch (err) {
    console.error("[Producer] Failed to connect to RabbitMQ. Will keep serving HTTP.", err);
  }
}

function startHttp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) =>
    res.json({ ok: true, rabbit: !!rabbitChannel })
  );

  app.post("/lists/:id/checkout", (req, res) => {
    const started = process.hrtime();
    const listId = req.params.id;
    const userEmail = req.body.email || "user@example.com";
    const totalAmount = req.body.total || Math.round(Math.random() * 500 + 30);
    const transactionId = uuidv4();
    const timestamp = Date.now();

    if (!rabbitChannel) {
      return res.status(503).json({ error: "RabbitMQ not ready yet" });
    }

    const payload = { listId, userEmail, totalAmount, transactionId, timestamp };

    try {
      rabbitChannel.publish(
        EXCHANGE,
        ROUTING_KEY,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true, headers: { transactionId } }
      );

      const [sec, nano] = process.hrtime(started);
      const upstreamTime = (sec * 1000 + nano / 1e6).toFixed(2);

      res.setHeader("X-Transaction-Id", transactionId);
      res.setHeader("X-Upstream-Time", upstreamTime);
      res.status(202).json({
        ok: true,
        message: "Checkout accepted",
        transactionId,
        listId,
        upstreamTime,
      });

      console.log(
        `[Producer] Checkout ${listId} by ${userEmail} | Transaction: ${transactionId} | Time: ${upstreamTime}ms`
      );
    } catch (err) {
      console.error("Error publishing to RabbitMQ", err);
      res.status(500).json({ error: "Failed to process checkout", transactionId });
    }
  });

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Producer (List Service) listening on port ${port}`);
  });
}

startHttp();
bootRabbit();
