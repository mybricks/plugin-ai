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
    }
  };
  uiCom: {
    title: string;
    api: {
      updateCom: (...params: any) => void;
      getComPrompts: (...params: any) => string;
      getComDSLPrompts: (...params: any) => string;
      getComEditorPrompts: (...params: any) => string;
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
