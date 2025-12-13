
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

async function getPayPalAccessToken() {
  
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${process.env.PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errorText = await res.text();
  console.error("PayPal token error:", errorText);
    throw new Error("Failed to get PayPal token");

    // simple retry after 1s
    await new Promise((r) => setTimeout(r, 1000));
    return getPayPalAccessToken();
  }

  const data = await res.json();
  return data.access_token;
}

module.exports = { getPayPalAccessToken };
