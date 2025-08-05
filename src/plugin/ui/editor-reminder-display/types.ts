/**
 * Types for editor reminder pill display
 */
import type { Reminder } from "model/reminder";
import type { App } from "obsidian";

export interface TokenSpan {
  from: number;
  to: number;
  row: number;
  text: string;
  reminder: Reminder;
}

export interface PillSpec {
  title: string;
  label: string;
  span: TokenSpan;
}

export interface PillContext {
  app: App;
}
