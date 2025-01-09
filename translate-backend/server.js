import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import cors from "cors";
import TelegramBot from "node-telegram-bot-api";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { GoogleAuth } from "google-auth-library";

// Initialize Secret Manager client
const client = new SecretManagerServiceClient();

// Function to retrieve a secret from Google Cloud Secret Manager
async function getSecret(secretName) {
  const [version] = await client.accessSecretVersion({
    name: `projects/translate-446221/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString("utf8");
}

//Function to confirm GPT API key is being passed correctly. 
async function getChatGPTResponse(prompt) {
  try {
    console.log("Sending request to OpenAI API with prompt:", prompt);
    console.log("Using API Key:", OPENAI_API_KEY);

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error with ChatGPT API:", error.response?.data || error.message);
    throw error;
  }
}


const app = express();
const PORT = process.env.PORT || 5000;

// Main async initialization block
(async () => {
  try {
    // Test: Authenticate service account
    const auth = new GoogleAuth();
    const authClient = await auth.getClient();
    
    //console.log("Application is authenticating as:", authClient.email);

    // Load secrets
    //const apiKey = await getSecret("GoogleAPIKey");
    //console.log("Retrieved GoogleAPIKey:", apiKey);

    const TELEGRAM_API_TOKEN = await getSecret("TelegramBotToken");
    const OPENAI_API_KEY = await getSecret("ChatGPT");

    //if (!apiKey) {
    //  console.error("Failed to retrieve Google API key from Secret Manager.");
    //  process.exit(1);
    //}

    //console.log("Google API Key loaded successfully");

    // Create Telegram Bot
    const bot = new TelegramBot(TELEGRAM_API_TOKEN, { polling: true });

    // Middleware
    app.use(cors());
    app.use(bodyParser.json());

    // ChatGPT API call
    async function getChatGPTResponse(prompt) {
      try {
        const response = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
          },
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        return response.data.choices[0].message.content;
      } catch (error) {
        console.error("Error with ChatGPT API:", error.response?.data || error.message);
        return "Sorry, I couldn't process your request.";
      }
    }

    // Telegram bot listener
    bot.on("message", async (msg) => {
      console.log("Received message:", msg.text);
      const chatId = msg.chat.id;
      const userMessage = msg.text;

      bot.sendMessage(chatId, "Processing your request...");
      const chatGPTResponse = await getChatGPTResponse(userMessage);
      bot.sendMessage(chatId, chatGPTResponse);
    });

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
        console.error("Translation API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Translation failed" });
      }
    });

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to load secrets:", error);
    process.exit(1); // Exit the process if secrets cannot be retrieved
  }
})();
