import React, { useEffect, useState } from "react";
import { context } from "../../context";
import { i18n } from "../../i18n";
import { Sender } from "../../ui/components/sender";
import { Modal } from "../../ui/components/modal";

const AIDraw = (
  <svg viewBox="0 0 1024 1024" width="16" height="16">
    <path
      d="M340.032 703.488l35.008-103.936h160.768l35.008 103.936h67.2l-146.816-383.36H419.648l-146.816 383.36h67.2z m176.96-155.52H393.856l60.8-168.384h2.112l60.224 168.32z m186.88-197.952a31.808 31.808 0 0 0 22.656-8.704 30.208 30.208 0 0 0 9.472-22.656 30.464 30.464 0 0 0-9.152-22.4 32.832 32.832 0 0 0-23.04-8.576 31.808 31.808 0 0 0-22.72 8.576 28.992 28.992 0 0 0-9.088 22.4c0 8.96 2.944 16.512 9.088 22.656 6.144 5.76 14.336 8.832 22.72 8.64v0.064z m33.536 354.24v-320h-64v320h64zM356.608 65.28a32 32 0 0 1 5.76 63.488l-5.76 0.512H224a96 96 0 0 0-95.552 86.784L128 225.28v130.048a32 32 0 0 1-63.488 5.76L64 355.328V225.28a160 160 0 0 1 149.504-159.68L224 65.28h132.608zM65.28 672a32 32 0 0 1 63.488-5.76l0.512 5.76v132.608a96 96 0 0 0 86.784 95.552l9.216 0.448h130.048a32 32 0 0 1 5.76 63.488l-5.76 0.512H225.28a160 160 0 0 1-159.68-149.504l-0.32-10.496V672z m898.048-315.392a32 32 0 0 1-63.488 5.76l-0.512-5.76V224a96 96 0 0 0-86.784-95.552L803.328 128H673.28a32 32 0 0 1-5.76-63.488L673.28 64h130.048a160 160 0 0 1 159.616 149.504l0.384 10.496v132.608z m-291.328 606.72a32 32 0 0 1-5.76-63.488l5.76-0.512h132.608a96 96 0 0 0 95.552-86.784l0.448-9.216V673.28a32 32 0 0 1 63.488-5.76l0.512 5.76v130.048a160 160 0 0 1-149.504 159.616l-10.496 0.384H672z"
      fill="currentColor"
    />
  </svg>
);

function UnderstandSender({ variant, ...props }: { placeholder: string; disabled?: boolean; variant?: "inline" | "bubble"; onSend: React.ComponentProps<typeof Sender>["onSend"] }) {
  return <Sender {...props} variant={variant === "inline" ? "compact" : "bubble"} showAttachments={variant !== "inline"} onUpload={context.pluginParams.onUpload} />;
}

function getUnderstandAnyUI() {
  const id = context.currentFocus?.comId ?? context.currentFocus?.pageId ?? context.getFallbackAgentComId();
  return id ? context.understandAnyUI.get(context.getAgentKey(id)) : undefined;
}

function HostArea({ bindingTo, setTitle }: { bindingTo?: string; setTitle?: (title: string) => void }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    const offs = [context.events.on("focus", update), context.events.on("agentComId", update), context.events.on("understandAnyUI", update), context.events.on("disabled", update)];
    return () => offs.forEach(off => off());
  }, []);
  const UI = getUnderstandAnyUI();
  return UI ? <UI bindingTo={bindingTo} disabled={context.disabled} Sender={UnderstandSender} Modal={Modal} setTitle={setTitle} /> : null;
}

export function createUnderstandAnyContribute() {
  return {
    title: i18n({ zh: "业务图", en: "Business diagrams" }),
    icon: AIDraw,
    render: (params?: { id?: string; setTitle?: (title: string) => void }) => <HostArea bindingTo={params?.id} setTitle={params?.setTitle} />,
    getInfo: (params: { id?: string }) => getUnderstandAnyUI()?.getInfo?.(params),
  };
}
