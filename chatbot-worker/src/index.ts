import { Env, handleRequest } from "./handler";

export { RateGate } from "./rate-gate";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
