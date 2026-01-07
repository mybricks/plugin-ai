export class ComponentsManager {
  private static isLoaded = false
  private static aiComponentMap = new Map<string, any>()
  private static namespaceAbbrevMap = new Map<string, string>() // 缩写 -> 完整namespace
  private static abbreviationMap = new Map<string, string>() // 完整namespace -> 缩写

  private static init = () => {
    if (this.isLoaded) {
      return
    }
    if (!window.__comlibs_edit_) {
      return
    }

    const forEachComponent = (com: any, callback: (com: any) => void) => {
      if (com?.namespace) {
        callback?.(com)
      }
      if (Array.isArray(com?.comAray)) {
        com?.comAray.forEach((child: any) => {
          forEachComponent(child, callback)
        })
      }
    }

    window.__comlibs_edit_.forEach((comlib: any) => {
      forEachComponent(comlib, (com) => {
        if (com?.ai) {
          this.aiComponentMap.set(com.namespace, com.ai)
          
          const abbreviation = com.namespace
            .replace('mybricks.normal-pc.antd5.', 'pc.')
            .replace('mybricks.normal-pc.', 'pc.')
            .replace('mybricks.harmony.', 'mb.')
            .replace('mybricks.taro.', 'mb.')
          
          // 收集缩写映射关系
          if (abbreviation !== com.namespace) {
            this.namespaceAbbrevMap.set(abbreviation, com.namespace)
            this.abbreviationMap.set(com.namespace, abbreviation)
          }
        }
      })
    })

    this.isLoaded = true
  }

  static getRequireComponents = (ns: string): any[] => {
    this.init()

    let res: any[] = []
    if (this.aiComponentMap.has(ns)) {
      const ai = this.aiComponentMap.get(ns)
      if (Array.isArray(ai.requires)) {
        res = res.concat(ai.requires)
      }
    }
    return res
  }

  /**
   * 根据完整namespace获取缩写
   * @param namespace 完整的namespace
   * @returns 缩写namespace，如果没有缩写则返回原namespace
   */
  static getAbbreviation = (namespace: string): string => {
    this.init()
    return this.abbreviationMap.get(namespace) || namespace
  }

  /**
   * 根据缩写获取完整namespace
   * @param abbreviation 缩写
   * @returns 完整namespace，如果没有对应的完整namespace则返回原缩写
   */
  static getFullNamespace = (abbreviation: string): string => {
    this.init()
    return this.namespaceAbbrevMap.get(abbreviation) || abbreviation
  }

  /**
   * 重置加载状态（用于测试或重新初始化）
   */
  static reset = () => {
    this.isLoaded = false
    this.aiComponentMap.clear()
    this.namespaceAbbrevMap.clear()
    this.abbreviationMap.clear()
  }

  static getAiComponent(namespace: string) {
    this.init()
    return this.aiComponentMap.get(namespace)
  }
}