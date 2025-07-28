import type { AddActionConfig, ModifyActionConfig } from 'plop';

export interface FormatFilesActionConfig {
  type: 'formatFiles';
  files: string[];
}

export interface RunGenerateApisActionConfig {
  type: 'runGenerateApis';
  isEnterprise: boolean;
}

// Union type of all possible action configs
export type ActionConfig = AddActionConfig | ModifyActionConfig | FormatFilesActionConfig | RunGenerateApisActionConfig;

export interface PlopData {
  groupName: string;
  group: string;
  version: string;
  reducerPath: string;
  endpoints: string;
  isEnterprise: boolean;
}

export function isPlopData(data: unknown): data is PlopData {
  return typeof data === 'object' && data !== null;
}
