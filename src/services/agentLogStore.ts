import { AgentMessage } from './agentService';

export interface SubAgentRecord {
  name: string;
  prompt: string;
  output: string;
}

export interface LogRound {
  id: string;
  timestamp: number;
  userInput: string;
  messages: AgentMessage[];
  subAgentOutputs?: SubAgentRecord[];
}

type Listener = () => void;
const logs: LogRound[] = [];
const listeners = new Set<Listener>();

export function addLogRound(round: Omit<LogRound, 'id' | 'timestamp'>) {
  const entry: LogRound = {
    ...round,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  logs.unshift(entry);
  if (logs.length > 50) logs.length = 50;
  listeners.forEach(fn => fn());
}

export function getLogs(): LogRound[] {
  return logs;
}

export function clearLogs() {
  logs.length = 0;
  listeners.forEach(fn => fn());
}

export function subscribeLogs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
