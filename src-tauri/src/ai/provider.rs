use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AiError {
    #[error("HTTP client error: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("API error response: {0}")]
    Api(String),
    #[error("Keyring error: {0}")]
    Keyring(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiProviderType {
    Openai,
    Gemini,
    Claude,
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: AiProviderType,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DetectedAiServices {
    pub ollama_running: bool,
    pub ollama_models: Vec<String>,
    pub lmstudio_running: bool,
    pub lmstudio_models: Vec<String>,
    pub has_gemini_env: bool,
    pub has_openai_env: bool,
    pub has_claude_env: bool,
    pub gemini_env_key: Option<String>,
    pub openai_env_key: Option<String>,
    pub claude_env_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResponse {
    pub text: String,
    pub critique: Option<String>,
}

pub struct AiProvider {
    client: Client,
}

impl AiProvider {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    /// Primary system prompt for Japanese novel editing and proofreading with GraphRAG alignment
    pub fn novel_editor_system_prompt() -> &'static str {
        "あなたは文芸出版社に所属する伝説的な小説編集者・校閲官です。\n\
        作家の独自の文体・トーン＆マナー・情景描写・キャラクターの息遣いを最優先で尊重しながら、\n\
        以下の観点で原稿の推敲・ブラッシュアップを行ってください：\n\
        1. 視点（POV）のブレや不自然な神の視点の混入の防止\n\
        2. 日本語出版組版規則の徹底（段落頭字下げ、……・――の2倍数則、「」末尾の句点除去、！？直後の空白）\n\
        3. 重複表現や読点の過不足の改善によるリズムとテンポの向上\n\
        4. 五感（視覚・聴覚・触覚・嗅覚・味覚）に訴える具体的な情景描写の強化\n\
        5. 世界観・人物設定・相関図・プロットグラフとの厳密な整合性の維持（登場人物の一人称・二人称・口調のブレの是正、相関図に反する矛盾の解消、物語の時系列上まだ起きていない・知るはずのないプロット知識のフライング言及の抑止）\n\n\
        【出力形式の絶対規則】\n\
        推敲後の本文のみを完全なMarkdown本文として出力してください。挨拶や前置き、解説文は本文の前後に一切付けないでください。\n\
        YAML Frontmatterが存在する場合は、Frontmatterの構造を壊さずそのまま保持してください。"
    }

    /// Dispatch completion request to appropriate LLM endpoint
    pub async fn request_review(
        &self,
        config: &AiConfig,
        user_prompt: &str,
        content: &str,
    ) -> Result<String, AiError> {
        match config.provider {
            AiProviderType::Openai | AiProviderType::Ollama => {
                self.call_openai_compatible(config, user_prompt, content).await
            }
            AiProviderType::Gemini => self.call_gemini(config, user_prompt, content).await,
            AiProviderType::Claude => self.call_claude(config, user_prompt, content).await,
        }
    }

    /// OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio, etc.)
    async fn call_openai_compatible(
        &self,
        config: &AiConfig,
        user_prompt: &str,
        content: &str,
    ) -> Result<String, AiError> {
        let default_url = if config.provider == AiProviderType::Ollama {
            "http://localhost:11434/v1/chat/completions"
        } else {
            "https://api.openai.com/v1/chat/completions"
        };

        let endpoint = config.base_url.as_deref().unwrap_or(default_url);

        let system_msg = serde_json::json!({
            "role": "system",
            "content": Self::novel_editor_system_prompt()
        });

        let user_content = format!("【執筆者からの推敲指示】\n{}\n\n【対象原稿】\n{}", user_prompt, content);
        let user_msg = serde_json::json!({
            "role": "user",
            "content": user_content
        });

        let body = serde_json::json!({
            "model": config.model,
            "messages": [system_msg, user_msg],
            "temperature": 0.4
        });

        let mut req = self.client.post(endpoint).json(&body);
        if let Some(ref key) = config.api_key {
            req = req.bearer_auth(key);
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AiError::Api(format!("OpenAI API error: {}", err_text)));
        }

        let json: serde_json::Value = resp.json().await?;
        let text = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AiError::Api("Invalid OpenAI response structure".to_string()))?;

        Ok(text.to_string())
    }

    /// Google Gemini REST API
    async fn call_gemini(
        &self,
        config: &AiConfig,
        user_prompt: &str,
        content: &str,
    ) -> Result<String, AiError> {
        let key = config.api_key.as_deref().unwrap_or_default();
        let model = if config.model.is_empty() {
            "gemini-1.5-flash"
        } else {
            &config.model
        };

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, key
        );

        let prompt_text = format!(
            "{}\n\n【執筆者からの推敲指示】\n{}\n\n【対象原稿】\n{}",
            Self::novel_editor_system_prompt(),
            user_prompt,
            content
        );

        let body = serde_json::json!({
            "contents": [{
                "parts": [{ "text": prompt_text }]
            }],
            "generationConfig": {
                "temperature": 0.4,
            }
        });

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AiError::Api(format!("Gemini API error: {}", err_text)));
        }

        let json: serde_json::Value = resp.json().await?;
        let text = json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or_else(|| AiError::Api("Invalid Gemini response structure".to_string()))?;

        Ok(text.to_string())
    }

    /// Anthropic Claude API
    async fn call_claude(
        &self,
        config: &AiConfig,
        user_prompt: &str,
        content: &str,
    ) -> Result<String, AiError> {
        let key = config.api_key.as_deref().unwrap_or_default();
        let model = if config.model.is_empty() {
            "claude-3-5-sonnet-20241022"
        } else {
            &config.model
        };

        let url = "https://api.anthropic.com/v1/messages";

        let user_content = format!("【執筆者からの推敲指示】\n{}\n\n【対象原稿】\n{}", user_prompt, content);

        let body = serde_json::json!({
            "model": model,
            "max_tokens": 8192,
            "system": Self::novel_editor_system_prompt(),
            "messages": [{
                "role": "user",
                "content": user_content
            }],
            "temperature": 0.4
        });

        let resp = self
            .client
            .post(url)
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AiError::Api(format!("Claude API error: {}", err_text)));
        }

        let json: serde_json::Value = resp.json().await?;
        let text = json["content"][0]["text"]
            .as_str()
            .ok_or_else(|| AiError::Api("Invalid Claude response structure".to_string()))?;

        Ok(text.to_string())
    }

    /// Automatically detect available local and cloud AI services
    pub async fn detect_ai_services() -> DetectedAiServices {
        let client = Client::builder()
            .timeout(Duration::from_millis(1500))
            .build()
            .unwrap_or_else(|_| Client::new());

        let mut services = DetectedAiServices::default();

        // 1. Check Ollama on http://127.0.0.1:11434/api/tags
        if let Ok(resp) = client.get("http://127.0.0.1:11434/api/tags").send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(models) = json["models"].as_array() {
                        let names: Vec<String> = models
                            .iter()
                            .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                            .collect();
                        services.ollama_running = true;
                        services.ollama_models = names;
                    }
                }
            }
        }

        // 2. Check LM Studio on http://127.0.0.1:1234/v1/models
        if let Ok(resp) = client.get("http://127.0.0.1:1234/v1/models").send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(models) = json["data"].as_array() {
                        let names: Vec<String> = models
                            .iter()
                            .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                            .collect();
                        services.lmstudio_running = true;
                        services.lmstudio_models = names;
                    }
                }
            }
        }

        // 3. Check environment variables
        if let Ok(val) = std::env::var("GEMINI_API_KEY") {
            if !val.trim().is_empty() {
                services.has_gemini_env = true;
                services.gemini_env_key = Some(val);
            }
        }
        if let Ok(val) = std::env::var("OPENAI_API_KEY") {
            if !val.trim().is_empty() {
                services.has_openai_env = true;
                services.openai_env_key = Some(val);
            }
        }
        if let Ok(val) = std::env::var("ANTHROPIC_API_KEY") {
            if !val.trim().is_empty() {
                services.has_claude_env = true;
                services.claude_env_key = Some(val);
            }
        }

        services
    }

    /// Fast test of AI connection
    pub async fn test_connection(&self, config: &AiConfig) -> Result<String, AiError> {
        let test_prompt = "こんにちは。これは接続確認テストです。一言返信してください。";
        let res = self.request_review(config, "テスト", test_prompt).await?;
        let preview = res.lines().next().unwrap_or("OK").chars().take(80).collect::<String>();
        Ok(format!("✅ 接続成功！ AIからの応答: 「{}」", preview))
    }
}
