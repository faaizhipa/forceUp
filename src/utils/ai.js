
const AI = {
  session: null,
  capabilities: null,

  async init() {
    try {
      // Check for Gemini Nano availability
      // Note: The API is evolving. It might be window.ai, window.model, or chrome.ai.
      // Current Canary standard is window.ai.
      
      if (!window.ai) {
        console.warn('AI Prompt API not found (window.ai is undefined).');
        return false;
      }

      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available === 'no') {
        console.warn('AI Prompt API available but model is not ready.');
        return false;
      }

      this.capabilities = capabilities;
      // We create a session on demand to save resources, or keep one if frequent?
      // "Create a new session for each distinct task" is usually safer for context.
      return true;
    } catch (e) {
      console.error('Error initializing AI:', e);
      return false;
    }
  },

  async runPrompt(promptText, systemPrompt = '') {
    if (!window.ai) return null;
    
    try {
      // API signature might vary: window.ai.createTextSession or window.ai.languageModel.create
      const session = await window.ai.languageModel.create({
        systemPrompt: systemPrompt
      });
      
      const result = await session.prompt(promptText);
      session.destroy(); // Cleanup
      return result;
    } catch (e) {
      console.error('AI Prompt failed:', e);
      return null;
    }
  },

  // --- Specific Features ---

  async enhanceText(text, mode) {
    let systemPrompt = "You are a helpful writing assistant.";
    let prompt = "";

    switch (mode) {
      case 'clear':
        prompt = `Rewrite the following text to be clearer and easier to understand:\n\n${text}`;
        break;
      case 'concise':
        prompt = `Rewrite the following text to be concise and to the point:\n\n${text}`;
        break;
      case 'simple':
        prompt = `Rewrite the following text using simple language suitable for a general audience:\n\n${text}`;
        break;
      case 'verbose':
        prompt = `Expand on the following text, adding more detail and explanation:\n\n${text}`;
        break;
      default:
        return text;
    }

    return await this.runPrompt(prompt, systemPrompt);
  },

  async generateReview(text) {
    const systemPrompt = "You are a study assistant creating flashcards.";
    const prompt = `Based on the following notes, generate a set of flashcards (Question and Answer) to help review the material. 
    Ensure every key point is covered. Format as "Q: [Question] \nA: [Answer]".
    
    Notes:
    ${text}`;

    return await this.runPrompt(prompt, systemPrompt);
  },

  async generateQuiz(text) {
    const systemPrompt = "You are a teacher creating a quiz.";
    const prompt = `Create a multiple-choice quiz based on the following notes. 
    Provide 3-5 questions. For each question, list 4 options (A, B, C, D) and indicate the correct answer at the end.
    
    Notes:
    ${text}`;

    return await this.runPrompt(prompt, systemPrompt);
  },

  async suggestImprovement(text) {
    // "Suggest as I type" logic
    // We want quick, non-intrusive grammar/clarity checks.
    const systemPrompt = "You are an editor. Check for grammar mistakes or suggest a better phrasing. If the text is fine, reply with 'OK'.";
    const prompt = `Check this text: "${text}". 
    If there are errors or it's awkward, provide a short, single-sentence suggestion. 
    If it is good, just say "OK".`;

    const result = await this.runPrompt(prompt, systemPrompt);
    if (result && (result.trim() === 'OK' || result.trim() === 'Ok')) {
      return null;
    }
    return result;
  }
};
