export class ComponentsManager {
  private static isLoaded = false;
  private static aiComponentMap = new Map<string, any>();
  private static namespaceAbbrevMap = new Map<string, string>();
  private static abbreviationMap = new Map<string, string>();

  private static getNamespaceAbbreviation(namespace: string): string {
    return namespace
      .replace("mybricks.normal-pc.antd5.", "pc.")
      .replace("mybricks.normal-pc-lite.", "pc.")
      .replace("mybricks.normal-pc.", "pc.")
      .replace("mybricks.vibe-design.", "vibe.")
      .replace("mybricks.harmony.", "mb.")
      .replace("mybricks.taro.", "mb.");
  }

  private static init(): void {
    if (this.isLoaded) return;

    const comlibs = (globalThis as any).__comlibs_edit_;
    if (!Array.isArray(comlibs)) return;

    const visit = (com: any, callback: (item: any) => void) => {
      if (com?.namespace) {
        callback(com);
      }
      if (Array.isArray(com?.comAray)) {
        com.comAray.forEach((child: any) => visit(child, callback));
      }
    };

    comlibs.forEach((comlib: any) => {
      visit(comlib, (com) => {
        if (!com?.ai) return;

        this.aiComponentMap.set(com.namespace, {
          ...com.ai,
          all: com,
        });

        const abbreviation = this.getNamespaceAbbreviation(com.namespace);

        if (abbreviation !== com.namespace) {
          this.namespaceAbbrevMap.set(abbreviation, com.namespace);
          this.abbreviationMap.set(com.namespace, abbreviation);
        }
      });
    });

    this.isLoaded = true;
  }

  static reset(): void {
    this.isLoaded = false;
    this.aiComponentMap.clear();
    this.namespaceAbbrevMap.clear();
    this.abbreviationMap.clear();
  }

  static getFullNamespace(namespace: string): string {
    this.init();
    return this.namespaceAbbrevMap.get(namespace) || namespace;
  }

  static getAbbreviation(namespace: string): string {
    this.init();
    return this.abbreviationMap.get(namespace) || this.getNamespaceAbbreviation(namespace);
  }

  static getAiComponent(namespace: string): any {
    this.init();
    return this.aiComponentMap.get(this.getFullNamespace(namespace));
  }

  static isLayoutComponent(namespace?: string): boolean {
    if (!namespace) return false;
    this.init();
    const ai = this.aiComponentMap.get(this.getFullNamespace(namespace));
    return !!ai?.asLayout;
  }

  static getLayoutComponentsAbbreviationNs(): string[] {
    this.init();
    const result: string[] = [];
    this.aiComponentMap.forEach((ai, namespace) => {
      if (ai?.asLayout) {
        result.push(this.getAbbreviation(namespace));
      }
    });
    return result;
  }

  static getRequireComponents(namespace: string): string[] {
    this.init();
    const ai = this.aiComponentMap.get(this.getFullNamespace(namespace));
    return Array.isArray(ai?.requires) ? [...ai.requires] : [];
  }

  static getAllAiComponents(): Array<{ namespace: string; abbreviation: string; ai: any; all: any }> {
    this.init();
    const result: Array<{ namespace: string; abbreviation: string; ai: any; all: any }> = [];
    this.aiComponentMap.forEach((ai, namespace) => {
      result.push({
        namespace,
        abbreviation: this.getAbbreviation(namespace),
        ai,
        all: ai?.all,
      });
    });
    return result;
  }

  static replaceKnownNamespaces(value: string): string {
    if (!value) return value;
    this.init();
    let result = value;
    const namespaces = Array.from(this.abbreviationMap.keys()).sort((a, b) => b.length - a.length);
    namespaces.forEach((namespace) => {
      result = result.split(namespace).join(this.getAbbreviation(namespace));
    });
    return result;
  }
}
