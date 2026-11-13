import React, { useEffect } from "react";

type TodoComponent = (props: { setActive: (active: boolean) => void }) => any;

class Boundary extends React.Component<{ children: React.ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.error("[plugin-ai] todo area render failed", error);
    this.props.onError();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export function TodoArea({ component: Component, setActive }: { component: TodoComponent; setActive: (active: boolean) => void }) {
  useEffect(() => () => setActive(false), [setActive]);
  return <Boundary onError={() => setActive(false)}><Component setActive={setActive} /></Boundary>;
}
