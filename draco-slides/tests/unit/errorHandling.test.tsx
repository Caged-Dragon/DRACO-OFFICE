import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import App from "../../src/App";
import { ErrorBoundary } from "../../src/components/common/ErrorBoundary";
import { EditorCrash } from "../../src/features/editor/EditorCrash";

let errorSpy: MockInstance;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("shows the fallback, logs the error, and can reset", () => {
    let fail = true;
    function Flaky() {
      if (fail) throw new Error("kaboom");
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary fallback={(e, reset) => <button onClick={reset}>{`Retry after ${e.message}`}</button>}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: "Retry after kaboom" })).toBeInTheDocument();
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes("[draco-slides] render error"))).toBe(true);
    fail = false;
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("recovered")).toBeInTheDocument();
  });

  it("does nothing when children render fine", () => {
    render(
      <ErrorBoundary fallback={() => <p>fallback</p>}>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });
});

describe("EditorCrash", () => {
  it("offers reload, save a copy and close", () => {
    const [onReload, onSaveCopy, onClose] = [vi.fn(), vi.fn(), vi.fn()];
    render(<EditorCrash onReload={onReload} onSaveCopy={onSaveCopy} onClose={onClose} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/autosaved/);
    fireEvent.click(screen.getByRole("button", { name: "Reload last saved version" }));
    fireEvent.click(screen.getByRole("button", { name: "Save a copy of the last saved version" }));
    fireEvent.click(screen.getByRole("button", { name: "Close presentation" }));
    expect([onReload, onSaveCopy, onClose].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });
});

describe("global error handlers", () => {
  it("shows one message for an uncaught error and throttles repeats", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Your presentations" });
    act(() => {
      window.dispatchEvent(new ErrorEvent("error", { message: "boom", error: new Error("boom") }));
      window.dispatchEvent(new ErrorEvent("error", { message: "boom 2", error: new Error("boom 2") }));
    });
    expect(await screen.findAllByText(/Something unexpected went wrong/)).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("reports unhandled promise rejections", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Your presentations" });
    const ev = new Event("unhandledrejection");
    Object.assign(ev, { reason: new Error("rejected") });
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(await screen.findByText(/Something unexpected went wrong/)).toBeInTheDocument();
  });

  it("ignores the harmless ResizeObserver notice", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Your presentations" });
    act(() => {
      window.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver loop completed with undelivered notifications." }));
    });
    expect(screen.queryByText(/Something unexpected went wrong/)).not.toBeInTheDocument();
  });
});
