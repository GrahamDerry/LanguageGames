const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Load the API key from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

// Log to confirm if the API key is loaded
console.log("Google API Key:", apiKey ? "Loaded" : "Not Set");

// Check if the API key is missing and exit if it is
if (!apiKey) {
  console.error("Google API key is not set. Please set the GOOGLE_API_KEY environment variable.");
  process.exit(1);
}

app.use(cors());
app.use(bodyParser.json());


// Route to handle translation
app.post("/translate", async (req, res) => {
  const { text, target } = req.body;

  if (!text || !target) {
    return res.status(400).json({ error: "Missing 'text' or 'target' field" });
  }

  try {
    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        q: text,
        target: target,
      }
    );

    const translatedText = response.data.data.translations[0].translatedText;
    res.json({ translatedText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Translation failed" });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
