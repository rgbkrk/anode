/**
 * LiveStore-backed implementation of the anywidget AnyModel interface
 *
 * This class bridges the anywidget frontend API with Anode's LiveStore
 * event-sourcing system, enabling real-time collaborative widget state.
 */

import { events } from "@runt/schema";

/**
 * Minimal AnyModel interface compatible with anywidget's AFM specification
 * Based on @anywidget/types but simplified for our implementation
 */
export interface AnyModel {
  get(key: string): any;
  set(key: string, value: any): void;
  save_changes(): void;
  on(eventName: string, callback: Function): void;
  off(eventName?: string, callback?: Function): void;
  send(
    content: any,
    callbacks?: any,
    buffers?: ArrayBuffer[] | ArrayBufferView[]
  ): void;
}

export type EventHandler = (...args: any[]) => void;

/**
 * LiveStore-backed anywidget model that implements the AnyModel interface
 *
 * This class:
 * - Stores widget state in LiveStore for persistence and collaboration
 * - Provides reactive updates when state changes from any source
 * - Handles the anywidget event protocol for frontend-backend communication
 */
export class LiveStoreAnywidgetModel implements AnyModel {
  private listeners: Map<string, Set<Function>> = new Map();
  private state: Record<string, any> = {};
  private dirtyFields = new Set<string>();

  constructor(
    private modelId: string,
    private store: any,
    initialState: Record<string, any> = {}
  ) {
    this.state = { ...initialState };
  }

  /**
   * Get a property value from the model
   */
  get(key: string): any {
    return this.state[key];
  }

  /**
   * Set a property value in the model
   * This marks the field as dirty and emits change events
   */
  set(key: string, value: any): void {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.dirtyFields.add(key);

    // Emit change event for this specific property
    this.emit(`change:${key}`, value, oldValue);

    // Auto-save changes to LiveStore
    this.save_changes();
  }

  /**
   * Commit dirty state changes to LiveStore
   * This triggers real-time sync to all connected clients
   */
  save_changes(): void {
    if (this.dirtyFields.size === 0) {
      return;
    }

    // Build partial state object with only dirty fields
    const partialState: Record<string, any> = {};
    this.dirtyFields.forEach((key) => {
      partialState[key] = this.state[key];
    });

    // Commit to LiveStore - this will sync to all clients
    this.store.commit(
      events.anywidgetModelStateChanged({
        modelId: this.modelId,
        state: partialState,
        changedBy: "frontend",
      })
    );

    // Clear dirty fields after successful commit
    this.dirtyFields.clear();
  }

  /**
   * Add an event listener
   * Supports both property change events and custom messages
   */
  on(eventName: string, callback: Function): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);
  }

  /**
   * Remove event listeners
   */
  off(eventName?: string, callback?: Function): void {
    if (!eventName) {
      // Remove all listeners
      this.listeners.clear();
      return;
    }

    if (!callback) {
      // Remove all listeners for this event
      this.listeners.delete(eventName);
      return;
    }

    // Remove specific listener
    this.listeners.get(eventName)?.delete(callback);
  }

  /**
   * Send a custom message to the backend
   * Currently logs a warning as custom messages aren't fully implemented
   */
  send(
    content: any,
    callbacks?: any,
    buffers?: ArrayBuffer[] | ArrayBufferView[]
  ): void {
    // TODO: Implement custom message handling
    console.warn(
      "Custom messages not yet implemented in Anode anywidget integration",
      {
        content,
        buffers: buffers?.length,
      }
    );

    // Call success callback if provided
    if (callbacks && typeof callbacks === "function") {
      callbacks();
    }
  }

  /**
   * Update the model from external LiveStore changes
   * This is called when other clients or the backend change the state
   */
  updateFromExternal(newState: Record<string, any>): void {
    const oldState = { ...this.state };

    // Update internal state
    Object.assign(this.state, newState);

    // Emit change events for all properties that actually changed
    Object.keys(newState).forEach((key) => {
      const oldValue = oldState[key];
      const newValue = newState[key];

      // Use deep equality check for objects/arrays
      if (!this.deepEqual(oldValue, newValue)) {
        this.emit(`change:${key}`, newValue, oldValue);
      }
    });
  }

  /**
   * Handle custom messages from the backend
   * Used for widget-to-widget communication
   */
  receiveCustomMessage(content: any, buffers?: DataView[]): void {
    this.emit("msg:custom", content, buffers);
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit(eventName: string, ...args: any[]): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;

    listeners.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in ${eventName} event listener:`, error);
      }
    });
  }

  /**
   * Deep equality check for detecting actual changes
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (typeof a !== typeof b) return false;

    if (typeof a !== "object") return a === b;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(a[key], b[key])) return false;
    }

    return true;
  }

  /**
   * Get the current complete state (for debugging)
   */
  getState(): Record<string, any> {
    return { ...this.state };
  }

  /**
   * Get the model ID
   */
  getModelId(): string {
    return this.modelId;
  }
}
