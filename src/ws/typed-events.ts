export interface StateChangedEventData {
  entity_id: string;
  old_state: HassStateLike | null;
  new_state: HassStateLike | null;
}

export interface HassStateLike {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  last_reported?: string;
  context?: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface WebSocketEvents {
  connected: void;
  disconnected: void;
  state_changed: StateChangedEventData;
}

export type WebSocketEventName = keyof WebSocketEvents & string;

export type WebSocketListener<K extends WebSocketEventName> = (
  payload: WebSocketEvents[K],
) => void;
