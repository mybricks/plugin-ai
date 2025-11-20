interface AiServiceAPI {
  global: {
    title: string;
    api: {
      getAllComDefPrompts: () => string;
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
    }
  };
  uiCom: {
    title: string;
    api: {
      updateCom: (...params: any) => void;
      getComPrompts: (...params: any) => string;
      getComDSLPrompts: (...params: any) => string;
      getComEditorPrompts: (...params: any) => string;
      getOutlineInfo: (...params: any) => any
    }
  }
}

type AiServiceFocusParams = {
  type: "uiCom";
  comId: string;
  title: string;
} | {
  type: "page";
  pageId: string;
  title: string;
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
  onProgress: (status: string) => void;
}
