const { GoogleGenerativeAI } = require("@google/generative-ai");

// Define the ChatBotController class
class ChatBotController {
  // The constructor initializes the Google Generative AI model
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
    });
  }

  // This method will contain all the interview logic
  // It receives all the necessary parameters from the server.js route
  async processInterviewTurn({
    jobTitle,
    history,
    followUpCount,
    interviewStage,
    userAnswers,
  }) {
    let modelResponseText = "";
    let newInterviewStage = interviewStage;
    let newFollowUpCount = followUpCount;

    // --- Prompt 1: Initial Greeting & "Tell Me About Yourself" ---
    if (interviewStage === "initial") {
      const instructionToAI = `You are an AI interviewer for a job titled "${jobTitle}". Your goal is to conduct a mock interview. Begin by asking the user to "Tell me about yourself."  Keep your response concise and professional`;

      const chat = this.model.startChat({ history: [] });
      const apiResponse = await chat.sendMessage(instructionToAI);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "user", text: "Interview session started." }); // Log the start of the session
      history.push({ role: "model", text: modelResponseText });

      newInterviewStage = "awaiting_first_core_question"; // Transition to the stage for the first core question
      newFollowUpCount = 0; // Reset follow-up count
    }
    // --- Prompt 2: Core Interview Question ---
    else if (interviewStage === "awaiting_first_core_question") {
      const instructionToAI = `You are an AI interviewer for a job titled "${jobTitle}".  Based on the previous conversation and the user's last response, Start by saying “Nice to meet you users name” then ask one relevant follow-up question.  Ensure your question is typical for a job interview. Keep your response concise`;

      const chat = this.model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: { maxOutputTokens: 200 },
      });
      const apiResponse = await chat.sendMessage(instructionToAI);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "model", text: modelResponseText });
      newInterviewStage = "asking_follow_ups"; // Transition to the stage for follow-up questions
      newFollowUpCount = 0; // Initialize follow-up count for this new question
    }
    // --- Prompt 3: Follow-Up Question (Handles multiple follow-ups) ---
    else if (interviewStage === "asking_follow_ups") {
      if (newFollowUpCount < 2) {
        // Allows for 2 follow-up questions AFTER the initial core question
        const instructionToAI = `You are an AI interviewer for a job titled "${jobTitle}". The candidate has just responded to your last question. Your task is to ask one relevant follow-up question. Analyze the candidate's previous response to formulate a question that probes deeper into their answer or explores a related area. Ensure your question is typical for a job interview. Keep your response concise.`;

        const chat = this.model.startChat({
          history: history.map((item) => ({
            role: item.role,
            parts: [{ text: item.text }],
          })),
          generationConfig: { maxOutputTokens: 200 },
        });

        const apiResponse = await chat.sendMessage(instructionToAI);
        modelResponseText = apiResponse.response.text();

        history.push({ role: "model", text: modelResponseText });
        newFollowUpCount++;

        // After 2 follow-ups (total 3 questions including core), transition to pre-feedback
        if (newFollowUpCount >= 2) {
          newInterviewStage = "pre_feedback";
        }
      } else {
        // This 'else' handles cases where followUpCount somehow exceeds the limit
        // without proper stage transition (e.g., direct state manipulation)
        newInterviewStage = "pre_feedback";
      }
    }
    // --- Prompt 4: Interview Conclusion Acknowledgment ---
    else if (interviewStage === "pre_feedback") {
      const instructionToAI = `You are a professional AI job interviewer. The candidate has now completed answering all interview questions. Don't ask anymore follow up questions. Your task is to acknowledge the end of the question phase and set the expectation for feedback. Briefly thank the user and inform them you'll now provide feedback after typing yes and clicking the submit button. Keep your response concise.`;


      const chat = this.model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: { maxOutputTokens: 100 },
      });

      const apiResponse = await chat.sendMessage(instructionToAI);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "model", text: modelResponseText });
      newInterviewStage = "generating_feedback"; // Ready to generate feedback
    }
    // --- Prompt 5: Comprehensive Feedback Delivery ---
    else if (interviewStage === "generating_feedback") {
      const instructionToAI = `You are an AI interviewer for a job titled "${jobTitle}". The mock interview is complete. Review the user's answers to the questions. Here are the user's collected answers: ${userAnswers.map((ans, idx) => `Question ${idx + 1} Answer: ${ans}`).join("\n- ")} Provide constructive feedback on their answers and overall interview performance. Keep your feedback concise and professional, keep it under 2 paragraphs.`;

      const chat = this.model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: { maxOutputTokens: 500 },
      });

      const apiResponse = await chat.sendMessage(instructionToAI);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "model", text: modelResponseText });
      newInterviewStage = "interview_complete"; // Interview logic complete, feedback delivered
    }
    // --- Prompt 6: Final Closing Statement ---
    else if (interviewStage === "interview_complete") {
      const instructionToAI = `You are a professional AI job interviewer. The mock interview is now officially complete, and feedback has been provided. Your task is to offer a polite closing statement. Deliver a brief and friendly conclusion to the interview session. Keep your closing concise and professional and under 2 paragraphs.`;

      const chat = this.model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        })),
        generationConfig: { maxOutputTokens: 50 },
      });

      const apiResponse = await chat.sendMessage(instructionToAI);
      modelResponseText = apiResponse.response.text();

      history.push({ role: "model", text: modelResponseText });
      // In a real application, you might have a 'session_ended' stage here
    }

    // Return the updated state variables
    return { modelResponseText, newInterviewStage, newFollowUpCount };
  }
}

// Export the class so it can be imported and instantiated in server.js
module.exports = ChatBotController;
