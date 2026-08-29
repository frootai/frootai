declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

class VSCodeAPI {
  private readonly api = acquireVsCodeApi();

  postMessage(message: unknown): void {
    this.api.postMessage(message);
  }

  getState<T>(): T | undefined {
    return this.api.getState() as T | undefined;
  }

  setState<T>(state: T): void {
    this.api.setState(state);
  }
}

export const vscode = new VSCodeAPI();
