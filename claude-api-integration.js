// backend/services/claude.js
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Store this securely in environment variables
});

class ClaudeService {
  constructor() {
    this.model = 'claude-3-opus-20240229'; // Using the most capable model for code generation
  }

  async generateAppCode(prompt) {
    try {
      const systemPrompt = `You are an expert React Native developer. Your task is to generate a complete, working React Native application. 
The code must be production-ready and follow best practices. Focus on:
- Clean, efficient code structure
- Proper error handling
- Responsive design
- Performance optimization

Return ONLY a JSON object with this exact structure:
{
  "files": {
    "App.js": "... complete code ...",
    "package.json": "... complete package.json ...",
    ... other necessary files
  },
  "appName": "... suitable app name ...",
  "requirements": ["... array of required dependencies ..."]
}

Do not include any explanations or additional text outside the JSON structure.`;

      const userPrompt = `Generate a React Native app with the following requirements: ${prompt}`;

      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.2, // Lower temperature for more consistent code generation
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      });

      // Parse the response
      try {
        const jsonResponse = JSON.parse(response.content[0].text);
        return this.validateResponse(jsonResponse);
      } catch (error) {
        throw new Error(`Failed to parse Claude's response: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        // Handle specific API errors
        switch (error.type) {
          case 'rate_limit_error':
            throw new Error('Rate limit exceeded. Please try again later.');
          case 'invalid_request_error':
            throw new Error('Invalid request to Claude API.');
          case 'authentication_error':
            throw new Error('Authentication failed with Claude API.');
          default:
            throw new Error(`Claude API error: ${error.message}`);
        }
      }
      throw error;
    }
  }

  async fixBuildErrors(originalPrompt, buildError) {
    const fixPrompt = `The previously generated React Native app failed to build with the following error:
${buildError}

Original app requirements:
${originalPrompt}

Please generate a fixed version of the app that addresses these build errors. Return the complete corrected code in the same JSON format.`;

    return this.generateAppCode(fixPrompt);
  }

  validateResponse(response) {
    // Validate response structure
    if (!response.files || !response.appName || !response.requirements) {
      throw new Error('Invalid response structure from Claude');
    }

    // Validate required files
    if (!response.files['App.js'] || !response.files['package.json']) {
      throw new Error('Missing required files in Claude response');
    }

    // Validate package.json
    try {
      const packageJson = JSON.parse(response.files['package.json']);
      if (!packageJson.dependencies || !packageJson.name) {
        throw new Error('Invalid package.json structure');
      }
    } catch (error) {
      throw new Error(`Invalid package.json: ${error.message}`);
    }

    return response;
  }

  async validateCodeSecurity(appCode) {
    // Add security validation prompt
    const securityPrompt = `Review the following React Native code for security issues:
${JSON.stringify(appCode)}

Identify any:
1. Potential security vulnerabilities
2. Unsafe data handling
3. Insecure dependencies
4. Privacy concerns

Return ONLY "SAFE" if no issues found, or a JSON object describing the issues if any are found.`;

    try {
      const securityCheck = await anthropic.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0,
        messages: [
          { role: 'user', content: securityPrompt }
        ]
      });

      const result = securityCheck.content[0].text.trim();
      if (result !== "SAFE") {
        try {
          const issues = JSON.parse(result);
          throw new Error(`Security issues found: ${JSON.stringify(issues)}`);
        } catch (e) {
          throw new Error('Security validation failed');
        }
      }
    } catch (error) {
      throw new Error(`Security validation error: ${error.message}`);
    }
  }
}

export default new ClaudeService();

// backend/server.js
// Update the relevant parts of your server code
import claudeService from './services/claude.js';

async function generateAppCode(prompt) {
  logger.info('Requesting app generation from Claude...');
  
  try {
    // Get the initial code from Claude
    const appSpec = await claudeService.generateAppCode(prompt);
    
    // Validate code security
    await claudeService.validateCodeSecurity(appSpec.files);
    
    return appSpec.files;
  } catch (error) {
    logger.error('Error generating app code:', error);
    throw error;
  }
}

async function handleBuildError(error, prompt) {
  logger.info('Build failed, requesting fixes from Claude...');
  
  try {
    const fixedAppSpec = await claudeService.fixBuildErrors(prompt, error.message);
    return fixedAppSpec.files;
  } catch (error) {
    throw new Error(`Failed to fix build errors: ${error.message}`);
  }
}
