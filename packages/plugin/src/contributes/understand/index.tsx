import React, { useEffect, useState } from "react";
import { context } from "../../context";
import { i18n } from "../../i18n";
import { Sender } from "../../ui/components/sender";
import { Modal } from "../../ui/components/modal";

function UnderstandSender(props: { placeholder: string; disabled?: boolean; onSend: React.ComponentProps<typeof Sender>["onSend"] }) {
  return <Sender {...props} variant="bubble" onUpload={context.pluginParams.onUpload} />;
}

function HostArea({ bindingTo }: { bindingTo?: string }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    const offs = [context.events.on("focus", update), context.events.on("agentComId", update), context.events.on("understandAnyUI", update), context.events.on("disabled", update)];
    return () => offs.forEach(off => off());
  }, []);
  const id = context.currentFocus?.comId ?? context.currentFocus?.pageId ?? context.getFallbackAgentComId();
  const UI = id ? context.understandAnyUI.get(context.getAgentKey(id)) : undefined;
  return UI ? <UI bindingTo={bindingTo} disabled={context.disabled} Sender={UnderstandSender} Modal={Modal} /> : null;
}

export function createUnderstandAnyContribute() {
  return {
    title: i18n({ zh: "业务图", en: "Business diagrams" }),
    icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"><path d="M4 5h6v5H4zM14 14h6v5h-6zM7 10v6h7M17 14V8h-7" /></svg>,
    render: (params?: { id?: string }) => <HostArea bindingTo={params?.id} />,
  };
}
