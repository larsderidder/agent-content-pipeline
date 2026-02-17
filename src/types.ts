/**
 * Content Pipeline Types
 * Shared interfaces for core and plugins
 */

export interface PostFrontmatter {
  platform: 'linkedin' | 'x' | 'reddit' | string;
  title?: string;
  status: 'draft' | 'approved' | 'posted';
  approved_by?: string;
  approved_at?: string;
  scheduled_for?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface ParsedPost {
  frontmatter: PostFrontmatter;
  content: string;
  filePath: string;
}

export interface PostOptions {
  execute: boolean;
  dryRun: boolean;
  verbose: boolean;
  config?: ContentKitConfig;
  profileDir?: string;
  password?: string;
}

export interface PostResult {
  success: boolean;
  url?: string;
  error?: string;
  platform: string;
  timestamp: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContentKitConfig {
  contentDir: string;
  plugins: string[];
  dryRun: boolean;
  requireApproval: boolean;
  approvalField: string;
  /** Require approval signatures (set by init --secure) */
  requireSignature?: boolean;
  /** Optional X profile dir (use existing Chrome/Chromium profile) */
  xProfileDir?: string;
  /** Global workspace directory (set in ~/.content-pipeline.json) */
  workspaceDir?: string;
  /** pi model to use for the rewrite step (default: anthropic/claude-opus-4-6) */
  piModel?: string;
  /**
   * pi skill name to activate before rewriting (e.g. "scribe").
   * The skill must exist in your pi skill directory (~/.pi/agent/skills/).
   * If omitted or not found, a built-in default prompt is used instead.
   */
  piSkill?: string;
  /**
   * System prompt to use for the pi rewrite step when no piSkill is configured.
   * Defaults to a built-in prompt if not set.
   */
  piSystemPrompt?: string;
}

/**
 * Plugin interface - what poster plugins must export
 */
export interface PosterPlugin {
  /** Platform identifier (e.g., 'linkedin', 'x') */
  platform: string;
  
  /** Post content to the platform */
  post(content: string, options: PostOptions): Promise<PostResult>;
  
  /** Validate content before posting (optional) */
  validate?(content: string): Promise<ValidationResult>;
  
  /** Platform-specific content limits */
  limits?: {
    maxLength?: number;
    maxImages?: number;
    maxVideos?: number;
  };
}

export const DEFAULT_CONFIG: ContentKitConfig = {
  contentDir: '.',
  plugins: [],
  dryRun: false,
  requireApproval: true,
  approvalField: 'approved_by',
};
