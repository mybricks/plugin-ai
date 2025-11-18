/** 工具execute所需的文件 */
interface RxFile {
  fileName: string;
  name: string;
  extension: string;
  language: string;
  content: string;
  isComplete: boolean;
}

/** 工具execute所需的文件列表 */
type RxFiles = Record<string, RxFile | RxFile[]>;