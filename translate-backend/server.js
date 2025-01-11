import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import cors from "cors";
import TelegramBot from "node-telegram-bot-api";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { GoogleAuth } from "google-auth-library";
import fs from "fs";

const userSessions = {};

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
    // Load secrets
    const secrets = {
      GoogleAPIKey: await getSecret("GoogleAPIKey"),
      TelegramBotToken: await getSecret("TelegramBotToken"),
      ChatGPT: await getSecret("ChatGPT"),
    };

    // Validate secrets
    if (!secrets.GoogleAPIKey || !secrets.TelegramBotToken || !secrets.ChatGPT) {
      throw new Error("Missing required secrets");
    }

    console.log("Secrets loaded successfully");

    // Create Telegram Bot
    const bot = new TelegramBot(secrets.TelegramBotToken, { polling: true });

    // Middleware
    app.use(cors());
    app.use(bodyParser.json());

    // ChatGPT API call function
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
              Authorization: `Bearer ${secrets.ChatGPT}`,
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

    // Bot command listeners
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, "Welcome! Please select a language:", {
        reply_markup: {
          keyboard: [["/English"], ["/Thai"], ["/Russian"]],
          one_time_keyboard: true,
        },
      });
    });

    bot.onText(/\/English|\/Thai|\/Russian/, (msg, match) => {
      const chatId = msg.chat.id;
      const selectedLanguage = match[0].slice(1); // Remove the "/" from the command

      // Save user’s language preference
      userSessions[chatId] = { language: selectedLanguage };

      bot.sendMessage(
        chatId,
        `Language set to ${selectedLanguage}. Available commands:\n/example - Get examples of a word in ${selectedLanguage}\n/listen - Coming soon!\n/change_level - Coming soon!`
      );
    });
    


    bot.onText(/\/example/, (msg) => {
      const chatId = msg.chat.id;

      // Check if the user has selected a language
      if (!userSessions[chatId] || !userSessions[chatId].language) {
        bot.sendMessage(chatId, "Please select a language first using /English, /Thai, or /Russian.");
        return;
      }

      // Save user state as "waiting for word"
      userSessions[chatId].state = "awaiting_word";

      bot.sendMessage(chatId, "Please enter a word or expression in to get examples:");
    });

    // Handle the /listen command
    bot.onText(/\/listen/, (msg) => {
      const chatId = msg.chat.id;

      // Check if the user has selected a language
      if (!userSessions[chatId] || !userSessions[chatId].language) {
        bot.sendMessage(chatId, "Please select a language first using /English, /Thai, or /Russian.");
        return;
      }

      const language = userSessions[chatId].language;

      // Set the user's state to "listening mode"
      userSessions[chatId].state = "listening_mode";

      bot.sendMessage(chatId, `You are now in "listening mode." Enter text in ${language} to hear it spoken. Type /exit to leave this mode.`);
    });

    // Handle the /exit command to exit "listening mode"
    bot.onText(/\/exit/, (msg) => {
      const chatId = msg.chat.id;

      if (userSessions[chatId]?.state === "listening_mode") {
        userSessions[chatId].state = null; // Reset the user's state
        bot.sendMessage(chatId, "You have exited 'listening mode.' Type /listen to start again.");
      } else {
        bot.sendMessage(chatId, "You are not in 'listening mode.' Type /listen to start.");
      }
    });
    
    // Handle any other command to exit "listening mode"
    bot.onText(/\/.+/, (msg) => {
      const chatId = msg.chat.id;

      // Check if the command is not /listen
      if (userSessions[chatId]?.state === "listening_mode" && msg.text !== "/listen") {
        userSessions[chatId].state = null; // Reset the user's state
        bot.sendMessage(chatId, "You have exited 'listening mode.'");
      }
    });

    // Handle messages for "listening mode"
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;

      // Check if the user is in "listening mode"
      if (userSessions[chatId]?.state === "listening_mode") {
        const text = msg.text;
        
        // Ignore commands while in listening mode
        if (text.startsWith("/")) {
          return;
        }

        const language = userSessions[chatId].language;

        try {
          // Send the text to the TTS endpoint
          const response = await axios.post(`http://localhost:${PORT}/tts`, {
            text,
            languageCode: language === "Thai" ? "th-TH" : language === "English" ? "en-US" : language === "Russian" ? "ru-RU" : null,
          });

          if (!response.data) {
            throw new Error("No audio generated.");
          }          

          // Create a temporary audio file
          const audioBuffer = Buffer.from(response.data, "base64");
          const audioFilePath = `./${chatId}_audio.mp3`;
          fs.writeFileSync(audioFilePath, audioBuffer);

          // Send the audio file to the user
          await bot.sendAudio(chatId, audioFilePath);

          // Delete the temporary file after sending
          fs.unlinkSync(audioFilePath);
        } catch (error) {
          console.error("Error generating audio:", error);
          bot.sendMessage(chatId, "Sorry, I couldn't generate the audio. Please try again later.");
        }
      }
    });


    // Handle subsequent messages for the word
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;

      // Check if the user is in the correct state
      if (userSessions[chatId] && userSessions[chatId].state === "awaiting_word") {
        const word = msg.text;
        const language = userSessions[chatId].language;

        // Reset the user's state
        userSessions[chatId].state = null;

        // Generate the prompt for ChatGPT
        const prompt = `
        Please create five natural sounding ${language} sentences that use the following term or expression: ${word}.
        Provide an English translation for the examples.
        Don't say it's a translation. Just provide the English translation, and only that.
        List the translation directly below the sentence it's translated from.
        `;

        try {
          const examples = await getChatGPTResponse(prompt);
          bot.sendMessage(chatId, examples);
        } catch (error) {
          bot.sendMessage(chatId, "Sorry, I couldn't generate examples. Please try again later.");
        }
      }
    });

    // Route to handle translation
    app.post("/translate", async (req, res) => {
      const { text, target } = req.body;

      if (!text || !target) {
        return res.status(400).json({ error: "Missing 'text' or 'target' field" });
      }

      try {
        const response = await axios.post(
          `https://translation.googleapis.com/language/translate/v2?key=${secrets.GoogleAPIKey}`,
          { q: text, target: target }
        );
        res.json({ translatedText: response.data.data.translations[0].translatedText });
      } catch (error) {
        console.error("Translation API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Translation failed" });
      }
    });

    //tts route 
    app.post("/tts", async (req, res) => {
      const { text, languageCode } = req.body;

      if (!text || !languageCode) {
        return res.status(400).json({ error: "Missing 'text' or 'languageCode' field" });
      }

      try {
        const response = await axios.post(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${secrets.GoogleAPIKey}`,
          {
            input: { text },
            voice: { languageCode, ssmlGender: "NEUTRAL" },
            audioConfig: { audioEncoding: "MP3" },
          }
        );

        res.json(response.data.audioContent);
      } catch (error) {
        console.error("Text-to-Speech API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Text-to-Speech generation failed" });
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

