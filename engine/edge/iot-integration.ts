/**
 * IoT Integration — MQTT + CoAP for resource-constrained edge devices.
 *
 * Production-grade:
 *   - MQTT 5.0 bridge: subscribe to sensor topics → trigger FAI plays → publish results
 *   - CoAP support: for ultra-constrained devices (< 256 KB RAM)
 *   - Manufacturing QA PoC: sensor anomaly → MQTT → FAI Engine → Phi-4 classify → response → actuator
 *   - Topic naming convention: frootai/{tenant}/{device}/{action}
 *   - End-to-end latency target: < 2s from MQTT message → eval result published
 *
 * Tracker: P6.3.004
 */

// ── MQTT Bridge Config ──────────────────────────────────────────────────

export interface MqttBridgeConfig {
  /** MQTT broker connection */
  broker: {
    host: string;
    port: number;
    protocol: "mqtt" | "mqtts" | "ws" | "wss";
    keepAlive: number;                // seconds
    reconnectInterval: number;        // ms
    maxReconnectAttempts: number;
    cleanSession: boolean;
  };
  /** Authentication */
  auth: {
    method: "certificate" | "username_password" | "token";
    clientId: string;
    username?: string;
    /** Password/token fetched from secure keychain at runtime — never stored in config */
    passwordRef?: string;
    /** mTLS certificate paths */
    certPath?: string;
    keyPath?: string;
    caPath?: string;
  };
  /** Topic subscriptions that trigger FAI plays */
  subscriptions: MqttSubscription[];
  /** QoS default for published results */
  publishQos: 0 | 1 | 2;
  /** Max message size (bytes) */
  maxMessageSize: number;
  /** Message retention for offline buffering */
  offlineBuffer: {
    enabled: boolean;
    maxMessages: number;
    maxSizeBytes: number;
    persistToDisk: boolean;
  };
}

export interface MqttSubscription {
  /** MQTT topic filter (supports wildcards: +, #) */
  topicFilter: string;
  /** QoS level for this subscription */
  qos: 0 | 1 | 2;
  /** Which FAI manifest to trigger */
  manifestId: string;
  /** How to map MQTT payload to manifest input */
  payloadMapping: PayloadMapping;
  /** Debounce: ignore duplicate messages within window (ms) */
  deduplicationWindowMs: number;
  /** Max concurrent plays from this subscription */
  maxConcurrent: number;
}

export interface PayloadMapping {
  /** Expected payload format */
  format: "json" | "protobuf" | "cbor" | "raw";
  /** JSON path expressions to extract input fields */
  fieldMappings: Record<string, string>;
  /** Protobuf schema file (if format = protobuf) */
  protoFile?: string;
  /** Message type within proto file */
  protoMessageType?: string;
}

export const DEFAULT_MQTT_CONFIG: MqttBridgeConfig = {
  broker: {
    host: "localhost",
    port: 1883,
    protocol: "mqtts",
    keepAlive: 60,
    reconnectInterval: 5000,
    maxReconnectAttempts: -1,         // infinite
    cleanSession: false,
  },
  auth: {
    method: "certificate",
    clientId: "fai-edge-engine",
  },
  subscriptions: [],
  publishQos: 1,
  maxMessageSize: 256 * 1024,        // 256 KB
  offlineBuffer: {
    enabled: true,
    maxMessages: 10000,
    maxSizeBytes: 50 * 1024 * 1024,  // 50 MB
    persistToDisk: true,
  },
};

// ── MQTT Topic Naming Convention ────────────────────────────────────────

export const TOPIC_CONVENTION = {
  description: "Standardized MQTT topic hierarchy for FAI IoT integration",

  pattern: "frootai/{tenant_id}/{site_id}/{device_type}/{device_id}/{action}",

  segments: {
    tenant_id:   "Organization/tenant identifier (e.g., 'siemens-plant-42')",
    site_id:     "Physical site or location (e.g., 'munich-factory-3')",
    device_type: "Device category (e.g., 'sensor', 'camera', 'plc', 'gateway')",
    device_id:   "Unique device identifier (e.g., 'temp-sensor-A7')",
    action:      "Message type: 'data' | 'alert' | 'command' | 'status' | 'eval-result'",
  },

  examples: [
    "frootai/siemens-plant-42/munich-factory-3/sensor/temp-A7/data",
    "frootai/siemens-plant-42/munich-factory-3/sensor/temp-A7/alert",
    "frootai/siemens-plant-42/munich-factory-3/gateway/gw-01/eval-result",
    "frootai/+/+/sensor/+/alert          — subscribe to all sensor alerts across all sites",
    "frootai/siemens-plant-42/#           — subscribe to everything from one tenant",
  ],

  reservedTopics: [
    "frootai/{tenant}/+/+/+/eval-result    — engine publishes eval results here",
    "frootai/{tenant}/+/+/+/command        — engine publishes actuator commands here",
    "frootai/{tenant}/_system/status        — engine heartbeat + health",
    "frootai/{tenant}/_system/config        — remote config updates",
    "frootai/{tenant}/_system/ota           — over-the-air model/manifest updates",
  ],
};

// ── CoAP Support ────────────────────────────────────────────────────────

export interface CoapConfig {
  /** CoAP server bind address */
  bindAddress: string;
  /** CoAP server port (default 5683, DTLS 5684) */
  port: number;
  /** DTLS for security */
  dtls: {
    enabled: boolean;
    pskIdentity?: string;
    /** PSK fetched from secure storage at runtime */
    pskRef?: string;
    certPath?: string;
    keyPath?: string;
  };
  /** Resource endpoints */
  resources: CoapResource[];
  /** Max payload size (CoAP typically 1024 bytes) */
  maxPayloadSize: number;
  /** Block-wise transfer for larger payloads */
  blockTransfer: boolean;
  /** Observe support (server push notifications) */
  observe: boolean;
}

export interface CoapResource {
  /** CoAP resource path */
  path: string;
  /** Allowed methods */
  methods: ("GET" | "POST" | "PUT" | "DELETE" | "OBSERVE")[];
  /** Content format */
  contentFormat: "application/json" | "application/cbor" | "text/plain";
  /** Which manifest to trigger on POST */
  manifestId?: string;
  /** Description for .well-known/core discovery */
  description: string;
}

export const DEFAULT_COAP_CONFIG: CoapConfig = {
  bindAddress: "0.0.0.0",
  port: 5684,
  dtls: { enabled: true },
  resources: [],
  maxPayloadSize: 1024,
  blockTransfer: true,
  observe: true,
};

export const COAP_RESOURCE_MAP: CoapResource[] = [
  {
    path: "/fai/eval",
    methods: ["POST"],
    contentFormat: "application/cbor",
    manifestId: "",                   // set per deployment
    description: "Submit data for FAI evaluation. POST sensor reading, get eval result.",
  },
  {
    path: "/fai/status",
    methods: ["GET"],
    contentFormat: "application/json",
    description: "Engine health status. Returns: uptime, loaded models, last eval timestamp.",
  },
  {
    path: "/fai/model",
    methods: ["GET"],
    contentFormat: "application/json",
    description: "Currently loaded model info: ID, size, quantization, last inference.",
  },
  {
    path: "/fai/result",
    methods: ["GET", "OBSERVE"],
    contentFormat: "application/cbor",
    description: "Latest eval result. OBSERVE for push notifications on new results.",
  },
  {
    path: "/.well-known/core",
    methods: ["GET"],
    contentFormat: "text/plain",
    description: "CoAP resource discovery (RFC 6690). Auto-generated from registered resources.",
  },
];

// ── Device Constraints ──────────────────────────────────────────────────

export const DEVICE_TIERS = {
  description: "FAI Engine adapts to device capabilities",

  tiers: [
    {
      name: "Tier 1 — Gateway",
      ram: ">= 2 GB",
      cpu: "ARM Cortex-A53+ / x86-64",
      examples: ["Raspberry Pi 4/5", "NVIDIA Jetson Nano", "Intel NUC", "Azure IoT Edge"],
      protocol: "MQTT + CoAP",
      modelSupport: "Full on-device models (Phi-4-mini, Gemma-2B)",
      evalSupport: "Full edge eval suite (groundedness + coherence + safety)",
      storage: "SQLite + local model cache",
    },
    {
      name: "Tier 2 — Capable MCU",
      ram: "256 KB – 2 GB",
      cpu: "ARM Cortex-M7+ / ESP32-S3",
      examples: ["ESP32-S3", "STM32H7", "Nordic nRF5340"],
      protocol: "CoAP only (MQTT too heavy)",
      modelSupport: "No local LLM — forwards to Tier 1 gateway via CoAP",
      evalSupport: "Rule-based safety only (lexicon scan, no neural models)",
      storage: "Flash filesystem (LittleFS)",
    },
    {
      name: "Tier 3 — Constrained Sensor",
      ram: "< 256 KB",
      cpu: "ARM Cortex-M0/M3 / 8-bit AVR",
      examples: ["nRF52832", "STM32L0", "ATmega328P"],
      protocol: "CoAP (confirmable, block-wise transfer)",
      modelSupport: "None — pure data relay to Tier 1/2",
      evalSupport: "None — relay only",
      storage: "EEPROM / minimal flash",
    },
  ],

  architecturePattern: "Hub-and-spoke: Tier 3 sensors → CoAP → Tier 2 MCU → MQTT → Tier 1 gateway (runs FAI Engine)",
};

// ── Manufacturing QA PoC ────────────────────────────────────────────────

export const MANUFACTURING_QA_POC = {
  id: "mfg-qa-anomaly-detection",
  title: "Manufacturing QA: Anomaly Detection → Classification → Actuator Response",
  industry: "Manufacturing (Siemens ecosystem / Industry 4.0)",

  architecture: {
    flow: [
      "1. Temperature/vibration sensor (Tier 3: nRF52832) samples every 100ms",
      "2. Sensor → CoAP POST → Gateway (Tier 1: Raspberry Pi 5)",
      "3. Gateway runs anomaly detection (simple threshold + rolling std-dev)",
      "4. If anomaly detected → MQTT publish to frootai/{tenant}/{site}/sensor/{id}/alert",
      "5. FAI Engine (on gateway) subscribes to alert topic → triggers QA manifest",
      "6. QA manifest: Phi-4-mini classifies anomaly type (bearing_wear | overheating | misalignment | normal)",
      "7. Classification + confidence score → eval suite (safety + groundedness)",
      "8. Result published to frootai/{tenant}/{site}/gateway/{id}/eval-result",
      "9. If confidence > 0.85 AND anomaly_type != normal → MQTT command to PLC",
      "10. PLC reduces motor speed / triggers shutdown / alerts operator",
    ],
    latencyBudget: {
      sensorToGateway: 50,           // ms (CoAP over BLE or 802.15.4)
      anomalyDetection: 10,          // ms (threshold check)
      mqttPublish: 20,               // ms (local broker)
      manifestLoad: 100,             // ms (cached in memory)
      phiInference: 800,             // ms (Phi-4-mini Q4 on RPi 5)
      evalSuite: 400,                // ms (safety + groundedness, no coherence for sensor data)
      resultPublish: 20,             // ms
      total: 1400,                   // ms — well within 2s target
    },
  },

  manifest: {
    id: "mfg-qa-anomaly-v1",
    description: "Manufacturing QA play: classify sensor anomaly and recommend action",
    input: {
      sensor_id: "string — unique sensor identifier",
      reading_type: "'temperature' | 'vibration' | 'pressure' | 'current'",
      value: "number — sensor reading value",
      unit: "string — measurement unit",
      rolling_avg: "number — rolling average (last 100 readings)",
      rolling_stddev: "number — rolling standard deviation",
      anomaly_score: "number — how many std-devs from mean",
      timestamp: "ISO 8601 timestamp",
    },
    output: {
      anomaly_type: "'bearing_wear' | 'overheating' | 'misalignment' | 'calibration_drift' | 'normal'",
      confidence: "number 0.0–1.0",
      recommended_action: "'reduce_speed' | 'shutdown' | 'alert_operator' | 'schedule_maintenance' | 'no_action'",
      urgency: "'critical' | 'high' | 'medium' | 'low'",
      explanation: "string — human-readable explanation for operator display",
    },
    execution_preference: "local_only",
    model_preference: "phi-4-mini-q4",
    eval_config: {
      evaluators: ["safety", "groundedness"],
      streaming: false,               // sensor responses are short
      latencyBudgetMs: 500,
    },
  },

  deploymentTargets: [
    { customer: "Siemens MindSphere integration", vertical: "Manufacturing", location: "Munich plant" },
    { customer: "Bosch Rexroth", vertical: "Manufacturing", location: "Stuttgart factory" },
    { customer: "John Deere (agriculture)", vertical: "Agriculture", location: "Iowa facility" },
    { customer: "Schneider Electric", vertical: "Smart Buildings", location: "Paris HQ" },
  ],
};

// ── Additional PoC Templates ────────────────────────────────────────────

export const IOT_POC_TEMPLATES = [
  {
    id: "agriculture-crop-monitoring",
    title: "Agriculture: Crop Health Monitoring",
    flow: "Soil/weather sensors → CoAP → gateway → Phi-4 classifies stress type → irrigation/fertilizer recommendation → MQTT → controller",
    sensors: ["soil moisture", "ambient temperature", "humidity", "light intensity", "soil pH"],
    model: "gemma-2b-q4",
    latencyTarget: "< 5s (agriculture is less time-critical)",
  },
  {
    id: "smart-building-hvac",
    title: "Smart Buildings: HVAC Optimization",
    flow: "Room sensors (temp/CO2/occupancy) → MQTT → FAI Engine → Phi-4 optimizes setpoints → MQTT → BMS",
    sensors: ["temperature", "CO2 ppm", "occupancy (PIR)", "humidity", "energy meter"],
    model: "phi-4-mini-q4",
    latencyTarget: "< 10s (HVAC changes are gradual)",
  },
  {
    id: "fleet-vehicle-diagnostics",
    title: "Fleet: Vehicle Diagnostic Monitoring",
    flow: "OBD-II sensor → CAN bus → gateway → FAI Engine → classify fault code + severity → MQTT → fleet dashboard",
    sensors: ["engine RPM", "coolant temp", "MAF sensor", "O2 sensor", "DTC codes"],
    model: "llama-3-mini-q4",
    latencyTarget: "< 2s (safety-critical alerts)",
  },
];

// ── Message Formats ─────────────────────────────────────────────────────

export interface MqttSensorMessage {
  /** Message metadata */
  header: {
    messageId: string;
    tenantId: string;
    siteId: string;
    deviceId: string;
    deviceType: string;
    timestamp: string;                // ISO 8601
    protocolVersion: "1.0";
  };
  /** Sensor payload */
  payload: {
    readingType: string;
    value: number;
    unit: string;
    quality: "good" | "uncertain" | "bad";
    metadata?: Record<string, string | number>;
  };
  /** Anomaly detection (pre-computed on sensor/MCU) */
  anomaly?: {
    detected: boolean;
    score: number;                    // std-devs from mean
    rollingAvg: number;
    rollingStdDev: number;
    windowSize: number;
  };
}

export interface MqttEvalResultMessage {
  header: {
    messageId: string;
    correlationId: string;            // links back to the sensor message that triggered this
    tenantId: string;
    siteId: string;
    engineId: string;
    timestamp: string;
  };
  result: {
    manifestId: string;
    classification: string;
    confidence: number;
    recommendedAction: string;
    urgency: string;
    explanation: string;
  };
  eval: {
    overallScore: number;
    overallLabel: "pass" | "warn" | "fail";
    evaluators: {
      name: string;
      score: number;
      label: string;
    }[];
    latencyMs: number;
  };
}

// ── OTA (Over-The-Air) Updates ──────────────────────────────────────────

export interface OtaUpdateConfig {
  /** Check for updates via MQTT system topic */
  checkTopic: string;                // frootai/{tenant}/_system/ota
  /** What can be updated OTA */
  updatableComponents: ("manifest" | "model" | "eval_reference" | "engine_binary")[];
  /** Require signed updates (Ed25519) */
  requireSignature: boolean;
  /** Auto-apply or require approval */
  autoApply: boolean;
  /** Rollback on failure */
  rollbackOnFailure: boolean;
  /** Max download size per update (MB) */
  maxUpdateSizeMb: number;
}

export const DEFAULT_OTA_CONFIG: OtaUpdateConfig = {
  checkTopic: "frootai/+/_system/ota",
  updatableComponents: ["manifest", "model", "eval_reference"],
  requireSignature: true,
  autoApply: false,                  // safety-critical environments require approval
  rollbackOnFailure: true,
  maxUpdateSizeMb: 500,
};
