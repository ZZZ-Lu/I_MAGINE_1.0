// Qwen3.7-Plus 通义千问 API 工具调用封装（Anthropic 兼容协议）
// 通过本地 server.ts 的 /api/agent proxy 转发，避免浏览器 CORS

const ANTHROPIC_BASE = '/api/agent';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** 聚焦上下文（仅传给 API，不展示给用户） */
  context?: string;
  /** 可附带一张图片 URL（仅 user 消息），传给 Qwen3.7-Plus 多模态理解 */
  imageUrl?: string;
  /** 可附带多张图片 URL（仅 user 消息），用于传递参考图等 */
  imageUrls?: string[];
  tool_call_id?: string;
  tool_calls?: AgentToolCall[];
}

export interface AgentToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentToolParam {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AgentPlan {
  intent: string;
  targetColumnIndex: number | null;
  missingInfo: string[];
  needsPageStatus: boolean;
  needsVisualAnalysis: boolean;
  needsPromptWriting: boolean;
  needsGeneration: boolean;
  needsResultReview: boolean;
  shouldAskUser: boolean;
  userQuestion: string;
  steps: string[];
  goal: string;
}

export interface VisualAnalysis {
  subject: string;
  style: string;
  composition: string;
  lighting: string;
  colors: string;
  textContent: string;
  keyDetailsToPreserve: string[];
  opportunities: string[];
  risks: string[];
}

export interface PromptDraft {
  prompt: string;
  negativePrompt: string;
  rationale: string;
  suggestedModel?: string;
  suggestedAspectRatio?: string;
  suggestedResolution?: string;
  suggestedQuality?: string;
}

export interface ResultReview {
  isComplete: boolean;
  summary: string;
  issues: string[];
  nextActions: string[];
}

/** Agent 可用工具定义 */
export const AGENT_TOOLS: AgentToolParam[] = [
  {
    type: 'function',
    function: {
      name: 'create_column',
      description: '新建一个生图列（在末尾追加）',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '生图列名称，如"生图列_01"',
          },
          model: {
            type: 'string',
            description: '模型名称，可选: gpt-image-2-2in1, gpt-image-2, gpt-image-2-all, nano-banana-2, nano-banana-pro, nano-banana-hd, nano-banana-pro-2k',
            default: 'gpt-image-2-2in1',
          },
          aspectRatio: {
            type: 'string',
            description: '宽高比，可选: 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 4:5, 5:4, 21:9',
            default: '9:16',
          },
          resolution: {
            type: 'string',
            description: '分辨率，可选: 1k, 2k, 4k',
            default: '1k',
          },
          prompt: {
            type: 'string',
            description: '生图提示词（使用中文描述，清晰表达图片内容）',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: '在当前选中的生图列中执行图片生成',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列的索引（从0开始），-1表示所有列',
            default: 0,
          },
          prompt: {
            type: 'string',
            description: '要覆盖的提示词，为空则使用该列已有的提示词',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_column',
      description: '删除指定索引的生图列',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '要删除的生图列索引（从0开始）',
          },
        },
        required: ['columnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_prompt',
      description: '设置某一生图列的提示词',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          prompt: {
            type: 'string',
            description: '提示词内容',
          },
        },
        required: ['columnIndex', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_model',
      description: '设置某一生图列的模型',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          model: {
            type: 'string',
            description: '模型名称，可选: gpt-image-2-2in1, gpt-image-2, gpt-image-2-all, nano-banana-2, nano-banana-pro, nano-banana-hd, nano-banana-pro-2k',
          },
        },
        required: ['columnIndex', 'model'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_aspect_ratio',
      description: '设置某一生图列的宽高比',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          aspectRatio: {
            type: 'string',
            description: '宽高比，可选: 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 4:5, 5:4, 21:9',
          },
        },
        required: ['columnIndex', 'aspectRatio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_resolution',
      description: '设置某一生图列的分辨率',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          resolution: {
            type: 'string',
            description: '分辨率，可选: 1k, 2k, 4k',
          },
        },
        required: ['columnIndex', 'resolution'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_column_name',
      description: '设置某一生图列的名称',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          name: {
            type: 'string',
            description: '新的列名称，如"生图列_01"',
          },
        },
        required: ['columnIndex', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_quality',
      description: '设置某一生图列的图片质量',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          quality: {
            type: 'string',
            description: '图片质量，可选: auto, high, hd, standard, medium, low',
          },
        },
        required: ['columnIndex', 'quality'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_to_sandbox',
      description: '切换到 API 调试沙盒页面',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_to_home',
      description: '切换回主页面（生图列视图）',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_status',
      description: '获取当前页面状态，包括所有生图列的配置和生成结果',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_results',
      description: '清除某一列的生成结果',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始），-1表示清除所有列',
          },
        },
        required: ['columnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_image',
      description: '删除某一列中指定索引的图片',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          imageIndex: {
            type: 'number',
            description: '图片在结果列表中的索引（从0开始）',
          },
        },
        required: ['columnIndex', 'imageIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_favorite',
      description: '收藏或取消收藏某一列中指定索引的图片',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          imageIndex: {
            type: 'number',
            description: '图片在结果列表中的索引（从0开始）',
          },
        },
        required: ['columnIndex', 'imageIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'abort_generate',
      description: '中止指定列的生成中的图片',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
        },
        required: ['columnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_ref_image',
      description: '从 URL 添加参考图到指定列',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          url: {
            type: 'string',
            description: '图片 URL',
          },
        },
        required: ['columnIndex', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_ref_image',
      description: '删除指定列中指定索引的参考图',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          refIndex: {
            type: 'number',
            description: '参考图在列表中的索引（从0开始）',
          },
        },
        required: ['columnIndex', 'refIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'load_preset_ref_images',
      description: '加载预设参考图到指定列',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
        },
        required: ['columnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'use_result_as_ref',
      description: '将指定列的某张结果图片作为参考图添加到该列',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          imageIndex: {
            type: 'number',
            description: '图片在结果列表中的索引（从0开始）',
          },
        },
        required: ['columnIndex', 'imageIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'download_image',
      description: '下载指定列的某张结果图片到本地',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          imageIndex: {
            type: 'number',
            description: '图片在结果列表中的索引（从0开始）',
          },
        },
        required: ['columnIndex', 'imageIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'retry_generation',
      description: '重试指定列中某张失败（报错）的图片，恢复当时的配置并重新生成',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          imageIndex: {
            type: 'number',
            description: '报错图片在结果列表中的索引（从0开始）',
          },
        },
        required: ['columnIndex', 'imageIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_error_cards',
      description: '清除指定列中所有报错的图片卡片（保留成功的图片）',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始），-1表示所有列',
          },
        },
        required: ['columnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_column_config',
      description: '清空指定列的提示词和参考图（保留已生成的图片和列配置）',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
        },
        required: ['columnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_card_config',
      description: '将指定列某张结果卡片的配置（模型、比例、分辨率、提示词）应用到该列',
      parameters: {
        type: 'object',
        properties: {
          columnIndex: {
            type: 'number',
            description: '生图列索引（从0开始）',
          },
          imageIndex: {
            type: 'number',
            description: '图片在结果列表中的索引（从0开始）',
          },
        },
        required: ['columnIndex', 'imageIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_column_at_start',
      description: '在所有列的最前面插入一个新列',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '列名称，如"生图列_01"',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_column_at',
      description: '在指定列后面插入一个新列',
      parameters: {
        type: 'object',
        properties: {
          afterColumnIndex: {
            type: 'number',
            description: '在此列索引后新建列（从0开始）',
          },
          name: {
            type: 'string',
            description: '列名称',
          },
        },
        required: ['afterColumnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '使用博查 AI 搜索引擎搜索网络信息，可返回网页结果和图片。当用户询问新闻、实时信息、你不知道的知识、需要联网查询的问题时使用；当用户需要参考图/素材图时，也可用此工具搜索图片（搜索结果中的图片用 add_to_gallery 添加到素材面板）',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词，建议提取用户问题中的核心关键词，简洁明确',
          },
          count: {
            type: 'number',
            description: '返回结果条数，可选 1-50，默认 5',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_to_gallery',
      description: '将搜索到的图片 URL 添加到素材参考图面板。注意：此工具只负责收集素材，不会添加到生图列。用户可以从素材面板中选择需要的图片手动添加到生图列',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '图片的完整 URL',
          },
          name: {
            type: 'string',
            description: '图片的名称或描述（可选）',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_gallery',
      description: '清空素材参考图面板中的所有图片',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_gallery_info',
      description: '获取素材暂存区中的图片列表（含序号和名称）。可用于了解当前暂存区有哪些图片，以便用 add_gallery_ref 将某张图添加到生图列',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_gallery_ref',
      description: '将素材暂存区的某张图片添加到指定生图列作为参考图。先用 get_gallery_info 查看暂存区图片列表，确定要添加哪张图',
      parameters: {
        type: 'object',
        properties: {
          galleryIndex: {
            type: 'number',
            description: '暂存区图片的索引（从0开始，通过 get_gallery_info 可查看各图片的序号）',
          },
          columnIndex: {
            type: 'number',
            description: '目标生图列的索引（从0开始）',
          },
        },
        required: ['galleryIndex', 'columnIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_gallery_image',
      description: '分析暂存区中某张图片的内容：①提取图中所有可见文字（标题、水印、截图文本等）②描述视觉特征（风格、构图、元素、光线）。调用后你会"看到"该图片内容。用于判断搜索结果图是否匹配用户要求，匹配的再用 add_to_gallery 加入暂存区',
      parameters: {
        type: 'object',
        properties: {
          galleryIndex: {
            type: 'number',
            description: '暂存区图片的索引（从0开始，通过 get_gallery_info 可查看各图片的序号）',
          },
        },
        required: ['galleryIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_image_url',
      description: '直接分析某张图片 URL 的内容：①提取图中所有可见文字（标题、水印、截图文本等）②描述视觉特征（风格、构图、元素、光线）。与 analyze_gallery_image 的区别：不需要先把图片存入暂存区，直接传 URL 即可分析',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '图片的完整 URL',
          },
        },
        required: ['url'],
      },
    },
  },
];

export let ORCHESTRATOR_PROMPT = `你是 IMAGINE（AI 生图应用）的主 Agent：Orchestrator。你的职责不是单纯聊天，而是调度上下文、子 Agent 分析结果和工具，帮助用户完成图片生成、提示词优化、图片分析、参数调整和结果管理。

你还可以理解用户发送的图片内容（多模态视觉识别）。当你需要分析暂存区中的参考图或搜索结果图时，可以主动使用 analyze_gallery_image 工具，"看到"图片的视觉特征（风格、构图、元素、光线等）。此外，当用户聚焦图片并提问时，你也可以观察和分析图片内容。当用户聚焦输入框或参数区时，可能会附带该列的所有参考图供你分析。

你可能会收到一段 [内部子 Agent 分析]，其中包含：
- IntentPlanner：用户意图、信息是否足够、建议步骤
- VisualAnalyst：参考图/结果图的视觉分析
- PromptArchitect：高质量生图提示词草案
- ResultReviewer：结果复核建议
这些内容是你的内部决策材料，不要原样展示给用户。你要把它们转化为工具调用或简短回复。

你可以执行的操作用 JSON 工具调用方式提供，包括：
- create_column / create_column_at_start / create_column_at：新建列（末尾/首部/指定位置）
- generate_image：生成图片
- delete_column：删除列
- abort_generate：中止生成
- set_prompt / set_model / set_aspect_ratio / set_resolution / set_quality / set_column_name：配置列参数
- switch_to_sandbox / switch_to_home：页面切换
- get_page_status：查看当前状态（包括每列的收藏数和图片详情）
- clear_results：清除所有结果
- delete_image：删除单张图片
- toggle_favorite：收藏/取消收藏图片
- add_ref_image / remove_ref_image / load_preset_ref_images：管理参考图
- use_result_as_ref：将结果图作为参考图
- download_image：下载图片到本地
- retry_generation：重试失败的生成
- clear_error_cards：清除报错卡片
- clear_column_config：清空列配置（提示词+参考图）
- apply_card_config：将卡片配置应用到列
- web_search：搜索网络信息（支持网页和图片）。当用户需要参考图/素材图时，先用此工具搜索图片，然后用 analyze_gallery_image 查看搜索结果图的内容、判断是否符合要求，最后只将符合的图片用 add_to_gallery 加入素材面板
 - add_to_gallery：将图片 URL 加入素材参考图面板（独立于生图列）。注意：只添加经过 analyze_gallery_image 确认符合用户要求的图片，不要一股脑全加进去
 - clear_gallery：清空素材参考图面板
 - get_gallery_info：查看暂存区有哪些图片（序号+名称），以便用 add_gallery_ref 将图片添加到生图列，或用 analyze_gallery_image 分析图片内容
 - add_gallery_ref( galleryIndex, columnIndex )：将暂存区中指定序号的图片添加到指定生图列作为参考图
 - analyze_gallery_image( galleryIndex )：分析暂存区中某张图片，提取图中所有可见文字 + 视觉特征描述（风格、构图、元素等）。调用后你会"看到"该图片内容。用于判断搜索结果图是否匹配用户要求，匹配的再用 add_to_gallery 加入暂存区
  - analyze_image_url( url )：直接分析某张图片 URL 的内容（提取文字 + 视觉特征），无需先存入暂存区。搜索结果中的图片用此工具分析，确认匹配后再用 add_to_gallery 加入暂存区

用户消息可能以 [当前聚焦: ...] 开头，表示用户当前聚焦的生图列信息，格式为：
[当前聚焦: 生图列名称 | 列索引: N | 模型: ... | 比例: ... | 分辨率: ... | 当前提示词: "..." | 参考图数量: N | 结果数: N]
请利用这些信息来理解用户的意图。例如当用户说"优化这段提示词"时，"当前提示词"字段中的内容就是需要优化的对象。

重要工作原则：
1. **先判断再行动**：先根据用户输入、聚焦上下文和内部子 Agent 分析判断真实意图、目标列、信息是否足够，再决定工具调用。
2. **必须完成全部操作**：收到用户任务后，必须一步步执行所有必要操作（创建列、设置参数、写入提示词、生成图片等），直到任务彻底完成。绝对不能只查看状态或只执行部分操作就停下来回复用户。
3. **信息不足时先补信息**：如果页面状态不足，优先调用 get_page_status；如果缺少用户必须决定的信息，再明确追问。不要凭空编造用户没有给出的主体、数量或目标。
4. **每一步都要行动**：如果还有未完成的操作，必须调用工具去执行，而不是用文字描述你打算做什么。例如用户让你"新建3列并生成图片"，你必须依次调用 create_column 3次、设置参数、最后调用 generate_image，而不是说"我将新建3列"就停止。
5. **最后才总结**：只有当所有操作都真正执行完毕后，才用文字向用户总结结果。如果还有操作没做，继续调用工具而不是回复文字。
6. **使用 get_page_status 查看状态后必须继续**：查看状态是为了帮助你决定下一步操作，查看本身不是任务终点，查看后必须继续执行后续操作。
7. **generate_image 会等待并返回生成结果**：调用 generate_image 后，系统会自动等待图片生成完成（最长 90 秒），并返回每列的生成结果（成功/失败数量）。你不需要再额外调用 get_page_status 去轮询检查生成状态。如果有多张图片需要生成，一次性调用即可，系统会等待所有图片完成。
8. **搜索结果不匹配时自动调整，不急于问用户**：当 web_search 返回的结果不符合用户要求时，不要立即停下来问用户。应先调用 get_gallery_info 查看已搜索到的图片，必要时用 analyze_gallery_image 分析搜索结果图的内容，判断与目标的差距。然后主动调整搜索词重新搜索——每次调整应改变关键词方向（换同义词、加限定词、换角度描述），至少尝试 3 种不同的搜索策略。全部尝试仍不匹配后，再向用户总结已尝试的方案并请求补充信息。
9. **先分析再入库**：搜索到图片后，先用 analyze_gallery_image 分析其内容是否符合用户要求，确认匹配后再用 add_to_gallery 加入暂存区。不要先一股脑全加进去再分析。
10. **目标驱动的循环思考（ReAct）**：每次调用工具之前，先在内部依次理清：①当前的核心目标是什么（用户最终要什么，参考 IntentPlanner 的 goal）？②目标已经满足了吗？③现在手头有哪些线索（文字、图片特征、搜索结果）？④哪个线索最可能突破？明确下一步计划后再调用工具。每轮工具执行后重新评估①②，目标达成则停止调用工具直接回复用户。
11. **不超出任务范围**：只做用户要求的事情，不要额外做用户没要求的操作（尤其是删除、清理、修改已有结果等不可逆操作），除非 IntentPlanner 的 goal 明确包含了这些步骤。

硬性规则（必须遵守，不可跳过）：
A. **新建列必须立即命名**：每次调用 create_column 后，必须紧接着调用 set_column_name 为该列设置一个有意义的名称（根据任务内容命名，如"商务西装""公寓外观"等），不能保留默认的"生图列_XX"名称。
B. **生成图片前必须有提示词**：调用 generate_image 前，必须确保目标列已有提示词。如果需要设置提示词，先用 set_prompt 写入，再调用 generate_image。
C. **列索引从0开始**：所有工具中的 columnIndex 参数均从0开始计数（第1列=0，第2列=1，依此类推）。create_column 返回的列编号是1-based（"已创建第 N 个生图列"表示该列索引为 N-1）。
D. **提示词默认使用中文**：所有生图提示词（prompt）默认使用中文撰写，清晰描述用户想要的图片内容。除非用户明确要求使用英文，否则不要用英文写提示词。

请使用中文与用户交流，简明扼要。如果需要用户提供更多信息才能执行操作，请明确询问。重要：你的所有回复都必须使用中文，除非用户明确要求使用其他语言。`;

export let INTENT_PLANNER_PROMPT = `你是 IMAGINE 的 IntentPlanner 子 Agent。你的职责是判断用户意图、目标列、信息是否足够，以及后续是否需要视觉分析、提示词撰写、生成图片或结果复核。

你不能调用工具，不能执行页面操作，只能输出 JSON。不要输出 Markdown、解释或多余文本。

输出格式：
{
  "intent": "generate_image | optimize_prompt | analyze_image | edit_config | manage_results | troubleshoot | advice | chat | unknown",
  "targetColumnIndex": 0,
  "missingInfo": [],
  "needsPageStatus": false,
  "needsVisualAnalysis": false,
  "needsPromptWriting": false,
  "needsGeneration": false,
  "needsResultReview": false,
  "shouldAskUser": false,
  "userQuestion": "",
  "steps": [],
  "goal": ""
}

判断规则：
- 用一句话描述本次任务的目标（goal），写清楚用户最终要什么。例如"把第1列的提示词改为人设描述并生成人设图"或"搜索参考图并分析风格"。
- goal 是 Orchestrator 判断任务是否完成的依据，不要超出 goal 的范围做额外操作。
- 用户要求生成、重绘、出图、跑图时，needsGeneration=true。
- 用户要求优化、改写、扩写提示词时，needsPromptWriting=true。
- 用户要求看图、参考图、这张图、这个结果、画面问题时，needsVisualAnalysis=true。
- 用户说“不够信息你自己看一下当前页面/当前列”时，needsPageStatus=true。
- 如果缺少目标主体、目标列、必要图片或用户必须决定的信息，shouldAskUser=true，并写 userQuestion。
- targetColumnIndex 能从 [当前聚焦] 推断时填数字，否则填 null。`;

export let VISUAL_ANALYST_PROMPT = `你是 IMAGINE 的 VisualAnalyst 子 Agent。你的职责是分析用户附带的参考图或结果图，为主 Agent 和提示词专家提供视觉事实。

你不能调用工具，不能执行页面操作，只能输出 JSON。不要输出 Markdown、解释或多余文本。

输出格式：
{
  "subject": "",
  "style": "",
  "composition": "",
  "lighting": "",
  "colors": "",
  "textContent": "",
  "keyDetailsToPreserve": [],
  "opportunities": [],
  "risks": []
}

要求：
- 区分客观视觉事实和创作建议。
- **提取图中所有可见的文字内容**（标题、标签、水印、截图中的文本等）填入 textContent 字段。如果无文字则填空字符串。
- 如果没有图片，只根据文本上下文说明可分析信息有限。
- 不要识别或猜测真实人物身份。`;

export let PROMPT_ARCHITECT_PROMPT = `你是 IMAGINE 的 PromptArchitect 子 Agent，专门把用户目标、页面上下文和视觉分析转成高质量中文生图提示词。

你不能调用工具，不能执行页面操作，只能输出 JSON。不要输出 Markdown、解释或多余文本。

输出格式：
{
  "prompt": "",
  "negativePrompt": "",
  "rationale": "",
  "suggestedModel": "",
  "suggestedAspectRatio": "",
  "suggestedResolution": "",
  "suggestedQuality": ""
}

提示词撰写规则：
- 默认使用中文。
- 按主体、场景、构图、镜头、光线、材质、风格、细节、质量约束组织。
- 如果有参考图，明确写出要保留的内容和要改进的内容。
- 避免空泛堆词，优先写可执行、可观察的画面描述。
- negativePrompt 写入需要避免的画面问题，但最终 prompt 字段本身要能直接用于生图。`;

export let RESULT_REVIEWER_PROMPT = `你是 IMAGINE 的 ResultReviewer 子 Agent。你的职责是根据工具结果或页面状态判断任务是否完成、是否有失败、是否需要重试或调整。

你不能调用工具，不能执行页面操作，只能输出 JSON。不要输出 Markdown、解释或多余文本。

输出格式：
{
  "isComplete": true,
  "summary": "",
  "issues": [],
  "nextActions": []
}

判断规则：
- 如果生成失败、目标列不对、提示词未写入、用户目标未满足，isComplete=false。
- nextActions 写给主 Agent 看，应该是具体可执行建议。`;

// setter 函数：供 AgentPromptEditor 等模块运行时更新提示词
export function setOrchestratorPrompt(v: string) { ORCHESTRATOR_PROMPT = v; }
export function setIntentPlannerPrompt(v: string) { INTENT_PLANNER_PROMPT = v; }
export function setVisualAnalystPrompt(v: string) { VISUAL_ANALYST_PROMPT = v; }
export function setPromptArchitectPrompt(v: string) { PROMPT_ARCHITECT_PROMPT = v; }
export function setResultReviewerPrompt(v: string) { RESULT_REVIEWER_PROMPT = v; }

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(source.slice(start, end + 1));
    }
    throw new Error(`子 Agent 返回内容不是有效 JSON: ${text.slice(0, 160)}`);
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizePlan(raw: Record<string, unknown>): AgentPlan {
  return {
    intent: typeof raw.intent === 'string' ? raw.intent : 'unknown',
    targetColumnIndex: typeof raw.targetColumnIndex === 'number' ? raw.targetColumnIndex : null,
    missingInfo: asStringArray(raw.missingInfo),
    needsPageStatus: Boolean(raw.needsPageStatus),
    needsVisualAnalysis: Boolean(raw.needsVisualAnalysis),
    needsPromptWriting: Boolean(raw.needsPromptWriting),
    needsGeneration: Boolean(raw.needsGeneration),
    needsResultReview: Boolean(raw.needsResultReview),
    shouldAskUser: Boolean(raw.shouldAskUser),
    userQuestion: typeof raw.userQuestion === 'string' ? raw.userQuestion : '',
    steps: asStringArray(raw.steps),
    goal: typeof raw.goal === 'string' ? raw.goal : '',
  };
}

function normalizeVisualAnalysis(raw: Record<string, unknown>): VisualAnalysis {
  return {
    subject: typeof raw.subject === 'string' ? raw.subject : '',
    style: typeof raw.style === 'string' ? raw.style : '',
    composition: typeof raw.composition === 'string' ? raw.composition : '',
    lighting: typeof raw.lighting === 'string' ? raw.lighting : '',
    colors: typeof raw.colors === 'string' ? raw.colors : '',
    textContent: typeof raw.textContent === 'string' ? raw.textContent : '',
    keyDetailsToPreserve: asStringArray(raw.keyDetailsToPreserve),
    opportunities: asStringArray(raw.opportunities),
    risks: asStringArray(raw.risks),
  };
}

function normalizePromptDraft(raw: Record<string, unknown>): PromptDraft {
  return {
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    negativePrompt: typeof raw.negativePrompt === 'string' ? raw.negativePrompt : '',
    rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
    suggestedModel: typeof raw.suggestedModel === 'string' ? raw.suggestedModel : undefined,
    suggestedAspectRatio: typeof raw.suggestedAspectRatio === 'string' ? raw.suggestedAspectRatio : undefined,
    suggestedResolution: typeof raw.suggestedResolution === 'string' ? raw.suggestedResolution : undefined,
    suggestedQuality: typeof raw.suggestedQuality === 'string' ? raw.suggestedQuality : undefined,
  };
}

function normalizeResultReview(raw: Record<string, unknown>): ResultReview {
  return {
    isComplete: raw.isComplete !== false,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    issues: asStringArray(raw.issues),
    nextActions: asStringArray(raw.nextActions),
  };
}

function buildSubAgentMessages(
  userInput: string,
  context?: string,
  extra?: string,
  imageUrl?: string,
  imageUrls?: string[],
): AgentMessage[] {
  return [{
    role: 'user',
    content: [
      context ? `页面上下文：\n${context}` : '',
      extra ? `补充材料：\n${extra}` : '',
      `用户输入：\n${userInput}`,
    ].filter(Boolean).join('\n\n'),
    imageUrl,
    imageUrls,
  }];
}

export async function runIntentPlanner(
  apiKey: string,
  userInput: string,
  context?: string,
  signal?: AbortSignal,
): Promise<AgentPlan> {
  const result = await callAgent(
    apiKey,
    buildSubAgentMessages(userInput, context),
    [],
    signal,
    INTENT_PLANNER_PROMPT,
  );
  return normalizePlan(extractJsonObject(result.content));
}

export async function runVisualAnalyst(
  apiKey: string,
  userInput: string,
  context?: string,
  imageUrl?: string,
  imageUrls?: string[],
  signal?: AbortSignal,
): Promise<VisualAnalysis> {
  const result = await callAgent(
    apiKey,
    buildSubAgentMessages(userInput, context, undefined, imageUrl, imageUrls),
    [],
    signal,
    VISUAL_ANALYST_PROMPT,
  );
  return normalizeVisualAnalysis(extractJsonObject(result.content));
}

export async function runPromptArchitect(
  apiKey: string,
  userInput: string,
  context?: string,
  plan?: AgentPlan,
  visualAnalysis?: VisualAnalysis,
  signal?: AbortSignal,
): Promise<PromptDraft> {
  const extra = JSON.stringify({ plan, visualAnalysis }, null, 2);
  const result = await callAgent(
    apiKey,
    buildSubAgentMessages(userInput, context, extra),
    [],
    signal,
    PROMPT_ARCHITECT_PROMPT,
  );
  return normalizePromptDraft(extractJsonObject(result.content));
}

export async function runResultReviewer(
  apiKey: string,
  userInput: string,
  context?: string,
  toolResults?: string,
  signal?: AbortSignal,
): Promise<ResultReview> {
  const result = await callAgent(
    apiKey,
    buildSubAgentMessages(userInput, context, toolResults),
    [],
    signal,
    RESULT_REVIEWER_PROMPT,
  );
  return normalizeResultReview(extractJsonObject(result.content));
}

/**
 * 调用 Qwen3.7-Plus 对话 API（Anthropic 兼容 Messages 协议）
 *
 * 内部 AgentMessage 仍沿用 OpenAI 风格（tool_calls 数组 / role: 'tool'），
 * 在此函数内完成与 Anthropic Messages 协议的双向转换，调用方无感知。
 */
export async function callAgent(
  apiKey: string,
  messages: AgentMessage[],
  tools: AgentToolParam[] = AGENT_TOOLS,
  signal?: AbortSignal,
  systemPrompt: string = ORCHESTRATOR_PROMPT,
  onStream?: (delta: string) => void,
): Promise<{
  content: string;
  toolCalls: AgentToolCall[];
}> {
  // 1) 把 OpenAI 风格的 AgentMessage 转为 Anthropic Messages 格式
  //    - system 角色移出 messages，放到顶层 system 字段
  //    - assistant 的 tool_calls 转为 content 中的 tool_use 块
  //    - role: 'tool' 的工具结果转为 user 角色的 tool_result 块
  //    - 图片 image_url 转为 Anthropic 的 image.source.url
  const apiMessages: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    // context 拼接到 content 前面（仅传给 API，不展示给用户）
    const textContent = msg.context ? `${msg.context}\n\n${msg.content}` : msg.content;
    const allImages = [...(msg.imageUrl ? [msg.imageUrl] : []), ...(msg.imageUrls || [])];

    if (msg.role === 'system') {
      // 系统消息不进入 messages 数组（由顶层 system 字段处理）
      continue;
    }

    if (msg.role === 'tool') {
      // 工具结果 -> user 角色的 tool_result 块
      // 如果工具返回了图片（analyze_gallery_image），以 content blocks 形式附带图片
      // 连续多个 tool 结果合并到同一个 user 消息（Anthropic 规范）
      const blockContent = msg.imageUrl
        ? [{ type: 'text', text: textContent }, { type: 'image', source: { type: 'url', url: msg.imageUrl } }]
        : textContent;
      const block = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: blockContent,
      };
      const last = apiMessages[apiMessages.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content) && last.content.length > 0 && (last.content[0] as Record<string, unknown>).type === 'tool_result') {
        (last.content as unknown[]).push(block);
      } else {
        apiMessages.push({ role: 'user', content: [block] });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      // assistant 消息：文本 + 可选 tool_use 块
      const blocks: unknown[] = [];
      if (textContent) {
        blocks.push({ type: 'text', text: textContent });
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let input: unknown;
          try {
            input = JSON.parse(tc.function.arguments || '{}');
          } catch {
            input = {};
          }
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
      }
      apiMessages.push({
        role: 'assistant',
        content: blocks.length > 0 ? blocks : [{ type: 'text', text: '' }],
      });
      continue;
    }

    // user 消息：纯文本 / 多模态
    if (allImages.length > 0) {
      const blocks: unknown[] = [{ type: 'text', text: textContent }];
      for (const url of allImages) {
        blocks.push({
          type: 'image',
          source: { type: 'url', url },
        });
      }
      apiMessages.push({ role: 'user', content: blocks });
    } else {
      apiMessages.push({ role: 'user', content: textContent });
    }
  }

  // 2) 把 OpenAI 风格的 tools 转为 Anthropic 风格（name/description/input_schema）
  const anthropicTools = tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  // 3) 发起流式请求
  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'qwen3.7-plus',
      system: systemPrompt,
      messages: apiMessages,
      ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qwen API Error (${res.status}): ${text}`);
  }

  // 4) 解析 SSE 流式响应
  let content = '';
  const toolCalls: AgentToolCall[] = [];
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // 保留最后可能不完整的行
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trimEnd();
      if (trimmedLine.startsWith('data:')) {
        const dataStr = trimmedLine.slice(5).trimStart();
        if (!dataStr) continue;
        try {
          const data = JSON.parse(dataStr);

          // message_start：可能包含初始文本内容
          if (data.type === 'message_start' && data.message) {
            const msgContent = data.message.content;
            if (Array.isArray(msgContent)) {
              for (const block of msgContent) {
                if (block.type === 'text' && block.text) {
                  content += block.text;
                  onStream?.(block.text);
                }
              }
            }
          }

          // content_block_start（文本块开始）
          if (data.type === 'content_block_start' && data.content_block?.type === 'text') {
            const text = data.content_block.text || '';
            if (text) {
              content += text;
              onStream?.(text);
            }
          }

          // content_block_delta（文本增量）：放宽匹配条件，只要 delta.text 存在就捕获
          if (data.type === 'content_block_delta' && data.delta?.text) {
            content += data.delta.text;
            onStream?.(data.delta.text);
          }

          // content_block_start（工具调用开始）
          if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
            const input = data.content_block.input ?? {};
            const initialArgs = Object.keys(input).length > 0 ? JSON.stringify(input) : '';
            toolCalls.push({
              id: data.content_block.id,
              type: 'function',
              function: {
                name: data.content_block.name,
                arguments: initialArgs,
              },
            });
          }

          // content_block_delta（工具调用参数增量）
          if (data.type === 'content_block_delta' && data.delta?.partial_json !== undefined) {
            if (toolCalls.length > 0) {
              const last = toolCalls[toolCalls.length - 1];
              last.function.arguments += data.delta.partial_json || '';
            }
          }
        } catch {
          // 忽略解析失败的 data 行
        }
      }
    }
  }

  return { content, toolCalls };
}
