/**
 * Types for editor reminder pill display
 */
import type { App } from "obsidian";

export interface TokenSpan {
  from: number;
  to: number;
  row: number;
  text: string;
  reminder: any; // TODO: refine to repository Reminder type
}

export interface PillSpec {
  title: string;
  label: string;
  span: TokenSpan;
}

export interface PillContext {
  app: App;
}
