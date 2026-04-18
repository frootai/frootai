/**
 * FAI Specialty S-10: FAI Voice — Real-Time Voice Agent Pipeline
 * ===============================================================
 * End-to-end STT→LLM→TTS pipeline contract with latency targets,
 * interruption handling, and multi-language support.
 *
 * @module engine/specialties/voice
 */

const VOICE_SCHEMA = {
  type: 'object',
  properties: {
    stt: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['azure-speech', 'whisper', 'google-stt', 'deepgram'], default: 'azure-speech' },
        language: { type: 'string', default: 'en-US' },
        continuous: { type: 'boolean', default: true },
        profanityFilter: { type: 'string', enum: ['none', 'masked', 'removed'], default: 'masked' },
        diarization: { type: 'boolean', default: false, description: 'Speaker identification for multi-party calls.' }
      },
      additionalProperties: false
    },
    llm: {
      type: 'object',
      properties: {
        provider: { type: 'string', default: 'azure-openai' },
        model: { type: 'string', default: 'gpt-4o' },
        streaming: { type: 'boolean', default: true },
        maxTokens: { type: 'integer', default: 500, description: 'Keep responses concise for voice.' },
        systemPrompt: { type: 'string', description: 'Agent persona and instructions.' }
      },
      additionalProperties: false
    },
    tts: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['azure-speech', 'elevenlabs', 'google-tts', 'openai-tts'], default: 'azure-speech' },
        voice: { type: 'string', default: 'en-US-JennyNeural' },
        speed: { type: 'number', minimum: 0.5, maximum: 2.0, default: 1.0 },
        style: { type: 'string', enum: ['neutral', 'cheerful', 'empathetic', 'professional'], default: 'professional' }
      },
      additionalProperties: false
    },
    latency: {
      type: 'object',
      properties: {
        sttTarget: { type: 'string', default: '< 1s', description: 'STT recognition latency target.' },
        llmTarget: { type: 'string', default: '< 2s', description: 'LLM first-token latency target.' },
        ttsTarget: { type: 'string', default: '< 1s', description: 'TTS synthesis latency target.' },
        endToEnd: { type: 'string', default: '< 3s', description: 'Total pipeline latency target.' }
      },
      additionalProperties: false
    },
    interruption: {
      type: 'object',
      properties: {
        handling: { type: 'string', enum: ['graceful', 'immediate-stop', 'queue', 'ignore'], default: 'graceful' },
        minSpeechMs: { type: 'integer', default: 500, description: 'Minimum speech duration before treating as interruption.' },
        silenceTimeoutMs: { type: 'integer', default: 2000, description: 'Silence duration before considering turn complete.' }
      },
      additionalProperties: false
    },
    recording: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: false },
        format: { type: 'string', enum: ['wav', 'mp3', 'ogg'], default: 'wav' },
        transcriptEnabled: { type: 'boolean', default: true },
        retention: { type: 'string', pattern: '^[0-9]+(d|m|y)$', default: '90d' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Voice Pipeline State Machine ─────────────────────

class VoicePipelineState {
  constructor(config = {}) {
    this.state = 'idle'; // idle|listening|processing|speaking|interrupted
    this.config = config;
    this._turnHistory = [];
    this._metrics = { turns: 0, totalLatencyMs: 0, interruptions: 0, errors: 0 };
  }

  transition(newState) {
    const validTransitions = {
      idle: ['listening'],
      listening: ['processing', 'idle'],
      processing: ['speaking', 'idle'],
      speaking: ['listening', 'interrupted', 'idle'],
      interrupted: ['listening', 'idle']
    };

    if (!validTransitions[this.state]?.includes(newState)) {
      return { success: false, error: `Invalid transition: ${this.state} → ${newState}` };
    }

    const prev = this.state;
    this.state = newState;
    return { success: true, from: prev, to: newState };
  }

  recordTurn(sttText, llmResponse, metrics = {}) {
    this._turnHistory.push({
      turn: this._turnHistory.length + 1,
      sttText,
      llmResponse: llmResponse?.substring(0, 500),
      timestamp: Date.now(),
      ...metrics
    });
    this._metrics.turns++;
    if (metrics.totalLatencyMs) this._metrics.totalLatencyMs += metrics.totalLatencyMs;
  }

  recordInterruption() {
    this._metrics.interruptions++;
  }

  stats() {
    return {
      currentState: this.state,
      ...this._metrics,
      avgLatencyMs: this._metrics.turns > 0 ? this._metrics.totalLatencyMs / this._metrics.turns : 0,
      turnHistory: this._turnHistory.slice(-10)
    };
  }
}

// ─── Public Factory ───────────────────────────────────

function createVoicePipeline(voiceConfig = {}) {
  return {
    pipeline: new VoicePipelineState(voiceConfig),
    schema: VOICE_SCHEMA,

    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validSTT = ['azure-speech', 'whisper', 'google-stt', 'deepgram'];
      if (config.stt?.provider && !validSTT.includes(config.stt.provider)) {
        errors.push(`Invalid STT provider "${config.stt.provider}". Valid: ${validSTT.join(', ')}`);
      }
      const validTTS = ['azure-speech', 'elevenlabs', 'google-tts', 'openai-tts'];
      if (config.tts?.provider && !validTTS.includes(config.tts.provider)) {
        errors.push(`Invalid TTS provider "${config.tts.provider}". Valid: ${validTTS.join(', ')}`);
      }
      const validInterrupt = ['graceful', 'immediate-stop', 'queue', 'ignore'];
      if (config.interruption?.handling && !validInterrupt.includes(config.interruption.handling)) {
        errors.push(`Invalid interruption handling "${config.interruption.handling}". Valid: ${validInterrupt.join(', ')}`);
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

export { createVoicePipeline, VoicePipelineState, VOICE_SCHEMA };
