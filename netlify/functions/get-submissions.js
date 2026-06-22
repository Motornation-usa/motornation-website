exports.handler = async () => {
  const res = await fetch(
    `https://api.netlify.com/api/v1/forms/6a3469e74658ba00087e093c/submissions?per_page=500`,
    { headers: { Authorization: `Bearer ${process.env.NETLIFY_TOKEN}` } }
  );
  const data = await res.json();
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(data),
  };
};
