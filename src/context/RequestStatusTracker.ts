import { Events } from "@mybricks/rxai"

interface RequestStatus {
  state: "pending" | "fulfilled" | "rejected";
  result: any;
}
class RequestStatusTracker {
  private requests = new Map<string, RequestStatus>();
  events = new Events<{promise: {
    id: string;
    status: RequestStatus
  }}>();
  constructor() {}

  track(id: string, promise: Promise<any>) {
    const status: RequestStatus = {
      state: "pending",
      result: null,
    }
    this.events.emit("promise", {
      id,
      status,
    })

    promise.then((result) => {
      status.state = "fulfilled";
      status.result = result
    }).catch((error) => {
      status.state = "rejected";
      status.result = error
    }).finally(() => {
      this.events.emit("promise", {
        id,
        status,
      })
    })

    this.requests.set(id, status);
  }

  getStatus(id: string) {
    return this.requests.get(id) || {
      state: "fulfilled",
      result: null
    };
  }
}

export { RequestStatusTracker };
