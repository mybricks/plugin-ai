import React, { useEffect, useRef } from "react";
import { context } from "../../context";
import { Sender, type SenderRef } from "../../ui/components/sender";

export function createUnderstandSender(id: string | undefined, register: (id: string, target: SenderRef) => () => void) {
  return function UnderstandSender({ variant, ...props }: { placeholder: string; disabled?: boolean; variant?: "inline" | "bubble"; onSend: React.ComponentProps<typeof Sender>["onSend"] }) {
    const sender = useRef<SenderRef>(null);
    useEffect(() => {
      if (!id || props.disabled || !sender.current) return;
      return register(id, sender.current);
    }, [props.disabled]);
    return <Sender {...props} ref={sender} variant={variant === "inline" ? "compact" : "bubble"} showAttachments={variant !== "inline"} onUpload={context.pluginParams.onUpload} />;
  };
}
