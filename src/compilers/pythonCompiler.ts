import { BaseCompilerClient } from "./compiler";

export class PythonCompilerClient extends BaseCompilerClient {
    getLabelSelector(): string {
        return `app=python-compiler`;
    }

    getCmd(): string {
        return "python";
    }
}
