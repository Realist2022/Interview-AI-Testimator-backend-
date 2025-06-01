const express = require("express");
const cors = require("cors");
// const { GoogleGenerativeAI } = require("@google/generative-ai"); 
require("dotenv").config();
const ChatBotControl = require("./controller/ChatBotControl.js"); 

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// API KEY & ERROR HANDLING
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("Error: GOOGLE_API_KEY is not set in the .env file.");
  process.exit(1);
}

// INITIALIZE CHATBOT CONTROLLER
const chatBotController = new ChatBotControl(API_KEY);

// Map to store chat histories and interview state for each session
const chatSessions = new Map();
/*
  sessionState = {
    history: [],
    followUpCount: 0,
    interviewStage: 'initial' | 'asking_questions' | 'pre_feedback' | 'generating_feedback' | 'interview_complete',
    userAnswers: [],
  };
*/

app.post("/api/testimator", async (req, res) => {
  const { sessionId, jobTitle, userResponse } = req.body; 

  if (!sessionId || !jobTitle) {
    return res.status(400).json({ error: "Missing sessionId or jobTitle." });
  }

  // INITIALIZE SESSION STATE
  let sessionState = chatSessions.get(sessionId);
  if (!sessionState) {
    sessionState = {
      history: [],
      followUpCount: 0,
      interviewStage: "initial",
      userAnswers: [],
    };
    chatSessions.set(sessionId, sessionState);
  }

  let { history, followUpCount, interviewStage, userAnswers } = sessionState;

  try {
    // --- Add user's latest response to history and userAnswers ---
    // This applies to ALL responses AFTER the initial 'START_INTERVIEW' trigger.
    if (userResponse && userResponse !== "START_INTERVIEW") {
      history.push({ role: "user", text: userResponse });
      // Add to userAnswers IF it's an answer to a question (not an instruction)
      if (
        (interviewStage === "asking_questions" && followUpCount <= 3) ||
        (interviewStage === "initial" && history.length === 2 && userResponse !== "Interview session started.")
      ) {
        userAnswers.push(userResponse);
      }
    }

    // Call the controller method to process the turn
    // Pass all necessary state variables by value or reference as required by the method
    const { modelResponseText, newInterviewStage, newFollowUpCount } = await chatBotController.processInterviewTurn({
      jobTitle,
      userResponse, // The user's response will be used by the controller for chat.sendMessage
      history, // Pass history by reference, it will be modified by the controller
      followUpCount,
      interviewStage,
      userAnswers, // Pass userAnswers by reference
    });


    // Update the session state with values returned from the controller
    sessionState.history = history; // History is updated by reference in the controller
    sessionState.followUpCount = newFollowUpCount;
    sessionState.interviewStage = newInterviewStage;
    sessionState.userAnswers = userAnswers; // userAnswers is updated by reference

    res.json({
      response: modelResponseText,
      history: history,
      interviewStage: newInterviewStage,
    });
  } catch (error) {
    console.error("Error calling AI Interviewer:", error); 
    if (error.response) {
      console.error("AI API Response Status:", error.response.status); 
      console.error("AI API Response Data:", error.response.data); 
    }
    res
      .status(500)
      .json({ error: "Failed to get response from AI interviewer." });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});