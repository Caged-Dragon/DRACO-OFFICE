/** Last-resort screen. Deliberately independent of app state and context. */
export function AppCrash() {
  return (
    <div className="crash" role="alert">
      <h1>Draco Slides ran into a problem</h1>
      <p>
        Your presentations are stored in this browser and are not affected. Reloading the page usually fixes this.
      </p>
      <div className="crash__actions">
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}
