interface AiServiceAPI {
  global: {
    title: string;
    api: {
      getAllPageInfo: () => {pageAry: any[]}[];
      getAllComDefPrompts: () => string;
      getComEditorPrompts: (...params: any) => string;
    }
  };
  page: {
    title: string;
    params: stirng[];
    api: {
      updatePage: (...params: any) => void;
      getPageDSLPrompts: (...params: any) => string;
      getPageContainerPrompts: (...params: any) => string;
      clearPageContent: (pageId: string) => void
      getOutlineInfo: (...params: any) => any
      createCanvas: () => { id: string; title: string; }
      createPage: (id: string, title: string, config?: any) => { id: string; onProgress: Function; }
      getPageOnProcess: (...params: any) => any;
    }
  };
  uiCom: {
    title: string;
    api: {
      updateCom: (...params: any) => void;
      getComPrompts: (...params: any) => string;
      getComDSLPrompts: (...params: any) => string;
      /** @deprecated 废弃 */
      getComEditorPrompts: (...params: any) => string;
      getOutlineInfo: (...params: any) => any
      getComOnProcess: (...params: any) => any;
    }
  }
  diagram: {
    title: string;
    api: {
      createDiagram: (...args: any) => { id: string; title: string }
      updateDiagram: (...args: any) => void;
    }
  }
}

type AiServiceFocusParams = {
  onProgress: (status: "start" | "ing" | "complete") => void;
  /** 区域才会有 */
  focusArea?: {
    selector: string;
    title: string;
  }
  comId: string;
  pageId: string;
  title: string;
  /** 类型，组件、页面 */
  type: "page" | "uiCom";
}

type AiServiceRequestParams = {
  type: "uiCom";
  message: string;
  comId: string;
  attachments: {
    type: "image";
    content: string;
    title?: string;
    size?: number;
  }[];
  onProgress: (status: string) => void;
} | {
  type: "page";
  message: string;
  pageId: string;
  attachments: {
    type: "image";
    content: string;
    title?: string;
    size?: number;
  }[];
  onProgress: (status: "start" | "ing" | "complete") => void;
}
interface AiViewApi {
  focusPage: (pageId: string) => void;
  focusCom: (comId: string) => void;
}

interface AiStartViewApi {
  onProgress: (state: "start" | "ing") => void;
}