declare module '*.less' {
  const resource: { [key: string]: any };
  export default resource;
};

/**
 * @param name               中文名
 * @param username           邮箱前缀
 * @param orgDisplayName     部门名称
 * @param thumbnailAvatarUrl 头像缩略图
 */
interface T_At {
  id: string;
  name: string;
  username: string;
  thumbnailAvatarUrl: string;
  orgDisplayName: string;
};
type T_Ats = Array<T_At>;

type T_ChangeType = undefined | 'addComment' | 'updateComment' | 'deleteComment'

interface T_Notes {
  id: string;
  innerText: string;
  innerHTML: string;
  operationTime: number | null;
  operator: {
    username: string;
    name: string;
    thumbnailAvatarUrl: string;
    email: string;
  }
  ats?: T_Ats;
  changeInfo?: T_ChangeInfo;
};

interface T_Operation {
  type: T_ChangeType
}

interface T_Data {
  id: string;
  notesMap: {
    [key: string]: T_Notes | Array<T_Notes>;
  };
  operationMap: {
    [key: string]: {
      [key: string]: T_Operation
    };
  };
};

interface AtEmailData {
  /** 主题 */
  subject: string;
  /** 接收用户邮箱  */
  to: string[];
  /** 评论内容 */
  body: string;
  /** 评论这条艾特消息的用户邮箱 */
  from: string;
  extra: {
    noteId: noteId,
    /** 评论时间 */
    commentTime: number
  }
}
interface T_AppCtx {
  file: {
    name: string;
  };
  user: {
    name: string;
    avatar: string;
    email: string;
    userId: string;
    userName: string;
    id: number;
  };
  onUpload: (file: File) => any;
  onSearchUser: (keyword: string) => any;
  onAtsEmail: ({ subject, to, body, extra, from }) => any
};

type T_BtnClickType = 'submit' | 'cancel' | 'edit' | 'delete' | 'comment';

type T_EventType = T_BtnClickType | 'add' | 'blurSave';
