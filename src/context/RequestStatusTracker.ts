import { Events } from "@mybricks/rxai"

type Element = HTMLElement | undefined;

interface RequestStatus {
  state: "pending" | "fulfilled" | "rejected";
  result: any;
}
class RequestStatusTracker {
  private requests = new Map<Element | undefined, RequestStatus>();
  events = new Events<{promise: {
    element: Element;
    status: RequestStatus
  }}>();
  private plans = new Map<Element | undefined, any>
  constructor() {}

  track(element: Element, promise: Promise<any>) {
    const status: RequestStatus = {
      state: "pending",
      result: null,
    }
    this.events.emit("promise", {
      element,
      status,
    })

    promise.then((result) => {
      status.state = "fulfilled";
      status.result = result
    }).catch((error) => {
      status.state = "rejected";
      status.result = error
      console.error(error);
    }).finally(() => {
      this.events.emit("promise", {
        element,
        status,
      })
    })

    this.requests.set(element, status);
  }

  getStatus(ele?: Element) {
    return this.requests.get(ele) || {
      state: "fulfilled",
      result: null
    };
  }

  setPlan(ele: Element, plan: any) {
    this.plans.set(ele, plan)
  }

  getPlan(ele: Element) {
    return this.plans.get(ele)
  }
}

export { RequestStatusTracker };
