export enum DeviceType {
  Desktop = 'desktop',
  Mobile = 'mobile'
}

export interface ThemeVar {
  propertyName: string;
  value: string;
  title: string;
  type: string;
}

export interface Theme {
  id: string;
  name: string;
  vars: ThemeVar[];
}

export interface AvailableLibrary {
  /**
   * @description npm 包名
   */
  name: string;
  version: string;
  readme: string;
  /** 
   * @deprecated
   */
  urls: string[];
  /** umd 导出名 */
  library: string;
}

export interface CodingConfig {
  themes?: Theme[];
  availableLibraries?: AvailableLibrary[];
}