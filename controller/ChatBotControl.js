// controller/ChatBotControl.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Define the ChatBotController class
class ChatBotController {
  // The constructor initializes the Google Generative AI model
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  }

  // This method will contain all the interview logic
  // It receives all the necessary parameters from the server.js route
  async processInterviewTurn({ jobTitle, userResponse, history, followUpCount, interviewStage, userAnswers }) {
    let modelResponseText = "";
    let newInterviewStage = interviewStage;
    let newFollowUpCount = followUpCount;

    // --- Prompt 1: Initial Interview Greeting & First Question (Tell me about yourself) ---
    if (interviewStage === "initial") {
      const initialInstructionToAI = `You are an AI interviewer for a job titled "${jobTitle}". Your goal is to conduct a mock interview.
                                      Begin by asking the user to "Tell me about yourself."
                                      Keep your response concise and professional.`;

      // Use 'this.model' to access the model initialized in the constructor
      const chat = this.model.startChat({ history: [] });
      const apiResponse = await chat.sendMessage(initialInstructionToAI);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "user", text: "Interview session started." });
      history.push({ role: "model", text: modelResponseText });

      newInterviewStage = "asking_questions";
      newFollowUpCount = 0;
    }
    // --- Prompt 3 (Now handles all follow-up questions) ---
    else if (interviewStage === "asking_questions") {
      if (newFollowUpCount < 3) { // 3 follow-up questions *after* "Tell me about yourself"
        const followUpInstruction = `You are an AI interviewer for a job titled "${jobTitle}".
                                     Based on the previous conversation and the user's last response, ask one relevant follow-up question.
                                     Ensure your question is typical for a job interview.
                                     Keep your response concise.`;

        const chat = this.model.startChat({
          history: history.map((item) => ({
            role: item.role,
            parts: [{ text: item.text }],
          })),
          generationConfig: { maxOutputTokens: 200 },
        });

        const apiResponse = await chat.sendMessage(followUpInstruction);
        modelResponseText = apiResponse.response.text();

        history.push({ role: "model", text: modelResponseText });
        newFollowUpCount++;

        if (newFollowUpCount >= 3) {
          newInterviewStage = "pre_feedback"; // After 3rd follow-up question, transition to pre-feedback
        }
      } else {
        newInterviewStage = "pre_feedback";
      }
    }
    // --- Prompt 4: Pre-Feedback Acknowledgment ---
    else if (interviewStage === "pre_feedback") {
      const preFeedbackInstruction = `You are an AI interviewer. The user has just completed answering all interview questions.
                                      Acknowledge their final response briefly and indicate that you will now provide feedback.
                                      Keep your response concise and professional.`;

      const chat = this.model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: { maxOutputTokens: 100 },
      });

      const apiResponse = await chat.sendMessage(preFeedbackInstruction);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "model", text: modelResponseText });
      newInterviewStage = "generating_feedback"; // Ready to generate feedback
    }
    // --- Prompt 5: Generate Comprehensive Feedback ---
    else if (interviewStage === "generating_feedback") {
      const feedbackInstruction = `You are an AI interviewer for a job titled "${jobTitle}".
                                   The mock interview is complete. Review the user's answers to the questions. Here are the user's collected answers:
                                   ${userAnswers.map((ans, idx) => `Question ${idx + 1} Answer: ${ans}`).join("\n- ")}
                                   Provide constructive feedback on their answers and overall interview performance.
                                   Keep your feedback concise and professional, and less than two paragraphs.`;

      const chat = this.model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: { maxOutputTokens: 500 },
      });

      const apiResponse = await chat.sendMessage(feedbackInstruction);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "model", text: modelResponseText });
      newInterviewStage = "interview_complete"; // Interview logic complete, feedback delivered
    }
    // --- Prompt 6: Interview Conclusion ---
    else if (interviewStage === "interview_complete") {
      const conclusionInstruction = `You are an AI interviewer. The mock interview is now complete and feedback has been provided.
                                     Offer a brief, polite closing statement.`;

      const chat = this.model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: { maxOutputTokens: 50 },
      });

      const apiResponse = await chat.sendMessage(conclusionInstruction);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "model", text: modelResponseText });
    }

    // Return the updated state variables
    return { modelResponseText, newInterviewStage, newFollowUpCount };
  }
}

// Export the class so it can be imported and instantiated in server.js
module.exports = ChatBotController;