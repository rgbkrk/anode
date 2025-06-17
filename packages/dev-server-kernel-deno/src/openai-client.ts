import OpenAI from "openai";

interface OpenAIConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
}

// Using OpenAI's built-in types for messages

interface NotebookTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

interface ToolCallOutput {
  tool_call_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  status: "success" | "error";
  timestamp: string;
  execution_time_ms?: number;
}

// Define available notebook tools
const NOTEBOOK_TOOLS: NotebookTool[] = [
  {
    name: "create_cell",
    description:
      "Create a new cell in the notebook at a specified position. Use this when you want to add new code, markdown, or other content to help the user.",
    parameters: {
      type: "object",
      properties: {
        cellType: {
          type: "string",
          enum: ["code", "markdown", "ai", "sql"],
          description: "The type of cell to create",
        },
        content: {
          type: "string",
          description: "The content/source code for the cell",
        },
        position: {
          type: "string",
          enum: ["after_current", "before_current", "at_end"],
          description:
            'Where to place the new cell. Use "after_current" (default) to place right after the AI cell, "before_current" to place before it, or "at_end" only when specifically requested',
          default: "after_current",
        },
      },
      required: ["cellType", "content"],
    },
  },
];

class OpenAIClient {
  private client: OpenAI | null = null;
  private isConfigured = false;

  constructor(config?: OpenAIConfig) {
    this.configure(config);
  }

  configure(config?: OpenAIConfig) {
    const apiKey = config?.apiKey || Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      console.warn(
        "⚠️ OpenAI API key not found. Set OPENAI_API_KEY environment variable or pass apiKey in config.",
      );
      this.isConfigured = false;
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey,
        baseURL: config?.baseURL,
        organization: config?.organization,
      });
      this.isConfigured = true;
      console.log("✅ OpenAI client configured successfully");
    } catch (error) {
      console.error("❌ Failed to configure OpenAI client:", error);
      this.isConfigured = false;
    }
  }

  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  async generateResponse(
    prompt: string,
    options: {
      model?: string;
      provider?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      enableTools?: boolean;
      currentCellId?: string;
      onToolCall?: (toolCall: ToolCall) => Promise<void>;
    } = {},
  ): Promise<any[]> {
    if (!this.isReady()) {
      return this.createErrorOutput(
        "OpenAI client not configured. Please set OPENAI_API_KEY environment variable.",
      );
    }

    const {
      model = "gpt-4o-mini",
      maxTokens = 2000,
      temperature = 0.7,
      systemPrompt = 'You are a helpful AI assistant in a Jupyter-like notebook environment. You have access to tools that let you create new cells in the notebook.\n\nWhen users ask you to:\n- Create code examples\n- Add new content to the notebook\n- Show implementations\n- Create cells with specific content\n\nYou MUST use the create_cell function to actually create the cells. Do not just describe what the code would look like - create it using the tools available to you.\n\nIMPORTANT: Always prefer using tools over just providing text descriptions when the user wants content added to their notebook.\n\nFor positioning: Use "after_current" by default so new cells appear right after the AI cell. Only use "at_end" if specifically requested.',
      enableTools = true,
      currentCellId,
      onToolCall,
    } = options;

    try {
      console.log(`🤖 Calling OpenAI API with model: ${model}`);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      // Prepare tools if enabled
      const tools = enableTools
        ? NOTEBOOK_TOOLS.map((tool) => ({
            type: "function" as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          }))
        : undefined;

      const response = await this.client!.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
        tools,
        tool_choice: enableTools ? "auto" : undefined,
      });

      const message = response.choices[0]?.message;
      const content = message?.content;
      const toolCalls = message?.tool_calls;

      // Handle tool calls if present
      if (toolCalls && toolCalls.length > 0 && onToolCall) {
        console.log(`🔧 Processing ${toolCalls.length} tool calls`);

        const outputs: any[] = [];

        for (const toolCall of toolCalls) {
          if (toolCall.type === "function") {
            let args: Record<string, any> = {};
            let parseError: Error | null = null;

            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch (error) {
              parseError =
                error instanceof Error ? error : new Error(String(error));
              console.error(
                `❌ Error parsing tool arguments for ${toolCall.function.name}:`,
                error,
              );
            }

            if (parseError) {
              const errorToolCallData: ToolCallOutput = {
                tool_call_id: toolCall.id,
                tool_name: toolCall.function.name,
                arguments: { raw_arguments: toolCall.function.arguments },
                status: "error",
                timestamp: new Date().toISOString(),
              };

              outputs.push({
                type: "display_data",
                data: {
                  "application/vnd.anode.aitool+json": errorToolCallData,
                  "text/markdown": `❌ **Tool failed**: \`${toolCall.function.name}\`\n\nError parsing arguments: ${parseError.message}`,
                  "text/plain": `Tool failed: ${toolCall.function.name} - Error parsing arguments: ${parseError.message}`,
                },
                metadata: {
                  "anode/tool_call": true,
                  "anode/tool_name": toolCall.function.name,
                  "anode/tool_error": true,
                },
              });
              continue;
            }

            try {
              console.log(
                `📞 Calling tool: ${toolCall.function.name} with args:`,
                args,
              );

              // Execute the tool call
              await onToolCall({
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: args,
              });

              // Add confirmation output with custom media type
              const toolCallData: ToolCallOutput = {
                tool_call_id: toolCall.id,
                tool_name: toolCall.function.name,
                arguments: args,
                status: "success",
                timestamp: new Date().toISOString(),
              };

              outputs.push({
                type: "display_data",
                data: {
                  "application/vnd.anode.aitool+json": toolCallData,
                  "text/markdown": `🔧 **Tool executed**: \`${toolCall.function.name}\`\n\n${this.formatToolCall(toolCall.function.name, args)}`,
                  "text/plain": `Tool executed: ${toolCall.function.name}`,
                },
                metadata: {
                  "anode/tool_call": true,
                  "anode/tool_name": toolCall.function.name,
                  "anode/tool_args": args,
                },
              });
            } catch (error) {
              console.error(
                `❌ Error executing tool ${toolCall.function.name}:`,
                error,
              );

              const errorToolCallData: ToolCallOutput = {
                tool_call_id: toolCall.id,
                tool_name: toolCall.function.name,
                arguments: args,
                status: "error",
                timestamp: new Date().toISOString(),
              };

              outputs.push({
                type: "display_data",
                data: {
                  "application/vnd.anode.aitool+json": errorToolCallData,
                  "text/markdown": `❌ **Tool failed**: \`${toolCall.function.name}\`\n\nError: ${error instanceof Error ? error.message : String(error)}`,
                  "text/plain": `Tool failed: ${toolCall.function.name} - ${error instanceof Error ? error.message : String(error)}`,
                },
                metadata: {
                  "anode/tool_call": true,
                  "anode/tool_name": toolCall.function.name,
                  "anode/tool_error": true,
                },
              });
            }
          }
        }

        // If there's also text content, add it
        if (content) {
          outputs.push({
            type: "display_data",
            data: {
              "text/markdown": content,
              "text/plain": content,
            },
            metadata: {
              "anode/ai_response": true,
              "anode/ai_provider": "openai",
              "anode/ai_model": model,
              "anode/ai_with_tools": true,
            },
          });
        }

        return outputs;
      }

      // Regular text response
      if (!content) {
        return this.createErrorOutput("No response received from OpenAI API");
      }

      console.log(`✅ Received OpenAI response (${content.length} characters)`);

      // Return the response as markdown output
      return [
        {
          type: "display_data",
          data: {
            "text/markdown": content,
            "text/plain": content,
          },
          metadata: {
            "anode/ai_response": true,
            "anode/ai_provider": "openai",
            "anode/ai_model": model,
            "anode/ai_usage": {
              prompt_tokens: response.usage?.prompt_tokens || 0,
              completion_tokens: response.usage?.completion_tokens || 0,
              total_tokens: response.usage?.total_tokens || 0,
            },
          },
        },
      ];
    } catch (error: any) {
      console.error("❌ OpenAI API error:", error);

      let errorMessage = "Unknown error occurred";
      if (error.status === 401) {
        errorMessage =
          "Invalid API key. Please check your OPENAI_API_KEY environment variable.";
      } else if (error.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (error.status === 500) {
        errorMessage = "OpenAI server error. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      return this.createErrorOutput(`OpenAI API Error: ${errorMessage}`);
    }
  }

  async generateStreamingResponse(
    prompt: string,
    options: {
      model?: string;
      provider?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      onChunk?: (chunk: string) => void;
    } = {},
  ): Promise<any[]> {
    if (!this.isReady()) {
      return this.createErrorOutput(
        "OpenAI client not configured. Please set OPENAI_API_KEY environment variable.",
      );
    }

    const {
      model = "gpt-4o-mini",
      maxTokens = 2000,
      temperature = 0.7,
      systemPrompt = "You are a helpful AI assistant in a Jupyter-like notebook environment. You have access to tools that let you create new cells in the notebook.\n\nWhen users ask you to:\n- Create code examples\n- Add new content to the notebook\n- Show implementations\n- Create cells with specific content\n\nYou MUST use the create_cell function to actually create the cells. Do not just describe what the code would look like - create it using the tools available to you.\n\nIMPORTANT: Always prefer using tools over just providing text descriptions when the user wants content added to their notebook.",
      onChunk,
    } = options;

    try {
      console.log(
        `🤖 Starting streaming call to OpenAI API with model: ${model}`,
      );

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      const stream = await this.client!.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      });

      let fullContent = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullContent += content;
          if (onChunk) {
            onChunk(content);
          }
        }
      }

      console.log(
        `✅ Completed streaming OpenAI response (${fullContent.length} characters)`,
      );

      // Return the complete response as markdown output
      return [
        {
          type: "display_data",
          data: {
            "text/markdown": fullContent,
            "text/plain": fullContent,
          },
          metadata: {
            "anode/ai_response": true,
            "anode/ai_provider": "openai",
            "anode/ai_model": model,
            "anode/ai_streaming": true,
          },
        },
      ];
    } catch (error: any) {
      console.error("❌ OpenAI streaming API error:", error);

      let errorMessage = "Unknown error occurred";
      if (error.status === 401) {
        errorMessage =
          "Invalid API key. Please check your OPENAI_API_KEY environment variable.";
      } else if (error.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (error.status === 500) {
        errorMessage = "OpenAI server error. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      return this.createErrorOutput(
        `OpenAI Streaming API Error: ${errorMessage}`,
      );
    }
  }

  private createErrorOutput(message: string): any[] {
    return [
      {
        type: "error",
        ename: "OpenAIError",
        evalue: message,
        traceback: [message],
      },
    ];
  }

  private formatToolCall(toolName: string, args: Record<string, any>): string {
    switch (toolName) {
      case "create_cell":
        return (
          `Created **${args.cellType}** cell at position **${args.position || "after_current"}**\n\n` +
          `Content preview:\n\`\`\`${args.cellType === "code" ? "python" : args.cellType}\n${args.content.slice(0, 200)}${args.content.length > 200 ? "..." : ""}\n\`\`\``
        );
      default:
        return `Arguments: ${JSON.stringify(args, null, 2)}`;
    }
  }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();

// Export class for testing
export { OpenAIClient };
