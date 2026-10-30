import { findConnectorById } from "./registry";
import type { ConnectorInterface } from "./types";

function buildUrl(baseUrl: string, iface: ConnectorInterface, params?: Record<string, unknown>): string {
  const url = new URL(iface.path, baseUrl);
  if (iface.method === "GET" && params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

export const connectorRuntime = {
  async call(
    connectorId: string,
    interfaceId: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const connector = findConnectorById(connectorId);
    if (!connector) {
      throw new Error(`Connector "${connectorId}" not found.`);
    }
    const iface = connector.interfaces.find((i) => i.id === interfaceId);
    if (!iface) {
      throw new Error(`Interface "${interfaceId}" not found in connector "${connectorId}".`);
    }

    const url = buildUrl(connector.baseUrl, iface, params);
    const response = await fetch(url, {
      method: iface.method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(iface.method === "POST" && params ? { body: JSON.stringify(params) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Connector request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
};
