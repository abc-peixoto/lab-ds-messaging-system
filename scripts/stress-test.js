import http from "k6/http";
import { check, sleep } from "k6";
import { randomIntBetween, randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "http://api-gateway:3000";
const IDS = ["101", "123", "555", "999", "2025"];
const EMAILS = ["aluno@puc.edu", "teste@lab.com", "user@email.com"];

export const options = {
  scenarios: {
    checkout_burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 10 },
        { duration: "10s", target: 50 },
        { duration: "10s", target: 100 },
        { duration: "5s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],      // <1% errors
    http_req_duration: ["p(95)<300"],    // 95% below 300ms
  },
};

export default function () {
  const listId = randomItem(IDS) || String(randomIntBetween(1, 1000));
  const payload = JSON.stringify({
    email: randomItem(EMAILS),
    total: Number((Math.random() * 400 + 20).toFixed(2)),
  });

  const res = http.post(`${BASE_URL}/lists/${listId}/checkout`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "status is 202": (r) => r.status === 202,
    "has transaction id": (r) => !!r.headers["X-Transaction-Id"],
  });

  sleep(0.2);
}
