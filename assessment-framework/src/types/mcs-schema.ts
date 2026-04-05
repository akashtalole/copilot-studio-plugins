/**
 * TypeScript interfaces for Microsoft Copilot Studio YAML file schema.
 * Handles both schemas produced by the MCS VS Code extension.
 */

export interface McsBot {
  kind: 'Bot';
  name: string;
  description?: string;
  instructions?: string;
  connectedAgents?: ConnectedAgent[];
}

export interface ConnectedAgent {
  name: string;
  description?: string;
  endpoint?: string;
}

/** kind: AdaptiveDialog — VS Code extension topic format */
export interface McsTopic {
  kind: 'AdaptiveDialog' | 'Topic';
  name?: string;
  id?: string;
  description?: string;
  trigger?: McsTrigger;          // Topic schema
  beginDialog?: McsBeginDialog;  // AdaptiveDialog schema
}

export interface McsBeginDialog {
  kind?: string;       // OnRecognizedIntent | OnConversationStart | OnUnknownIntent | OnRedirect
  id?: string;
  description?: string;
  triggerQueries?: string[];
  actions?: unknown[];
}

export interface McsTrigger {
  type?: string;       // AgentChooses | UserTypesAMessage
  description?: string;
  phrases?: string[];
}

export interface McsAction {
  kind: 'Action' | 'ConnectorAction' | 'FlowAction';
  name: string;
  description?: string;
  inputs?: McsParam[];
  parameters?: McsParam[];  // alternate field name used in some schemas
  outputs?: McsParam[];
}

export interface McsParam {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
}

export type McsResource = McsBot | McsTopic | McsAction;

export interface AgentProject {
  rootPath: string;
  bot?: McsBot;
  topics: Array<{ filePath: string; topic: McsTopic }>;
  actions: Array<{ filePath: string; action: McsAction }>;
  parseErrors: Array<{ filePath: string; message: string }>;
}
