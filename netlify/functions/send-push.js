const webpush = require("web-push");

webpush.setVapidDetails(
  "mailto:croquet.detwah@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { subscriptions, title, body, tag } = JSON.parse(event.body || "{}");

  if (!subscriptions?.length || !title || !body) {
    return { statusCode: 400, body: "Missing required fields" };
  }

  const payload = JSON.stringify({ title, body, tag: tag || "croquet" });

  const results = await Promise.allSettled(
    subscriptions.map((sub) => webpush.sendNotification(sub, payload))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sent, failed }),
  };
};
