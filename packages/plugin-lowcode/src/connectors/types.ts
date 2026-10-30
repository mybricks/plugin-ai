export interface ConnectorInterface {
  /** Unique interface id within the connector. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Natural-language description used by the model to decide when to use it. */
  description: string;
  /** HTTP method. */
  method: "GET" | "POST";
  /** URL path appended to the connector baseUrl. */
  path: string;
  /** Query/body parameters. */
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  /** Example response body for the model to understand field shape. */
  responseExample: unknown;
}

export interface Connector {
  /** Unique connector id. */
  id: string;
  /** Human-readable connector name. */
  name: string;
  /** Natural-language description of the target system. */
  description: string;
  /** Base URL for all connector interfaces. */
  baseUrl: string;
  /** Interfaces exposed by this connector. */
  interfaces: ConnectorInterface[];
}
