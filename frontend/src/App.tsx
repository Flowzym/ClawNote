export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>ClawNote</h1>
        <nav className="nav-section">
          <button className="nav-button nav-button--active">Alle</button>
          <button className="nav-button">Inbox</button>
          <button className="nav-button">Heute</button>
          <button className="nav-button">Diese Woche</button>
          <button className="nav-button">Später</button>
          <button className="nav-button">Erledigt</button>
        </nav>

        <section className="sidebar-block">
          <h2>Workspaces</h2>
          <button className="nav-button nav-button--active">Unsortiert</button>
          <button className="nav-button">Arbeit</button>
          <button className="nav-button">Projekte</button>
          <button className="nav-button">Privat</button>
        </section>
      </aside>

      <section className="content">
        <header className="content-header">
          <div>
            <h2>Inbox</h2>
            <p>Kleine lokale Notiz- und Todo-Oberfläche mit KI-Schicht über OpenClaw.</p>
          </div>
        </header>

        <form className="quick-entry" onSubmit={(event) => event.preventDefault()}>
          <input
            type="text"
            placeholder="Aufgabe oder Notiz eingeben …"
            aria-label="Aufgabe oder Notiz"
          />
          <button type="submit">Hinzufügen</button>
        </form>

        <section className="task-list">
          <article className="task-card">
            <label className="task-row">
              <input type="checkbox" />
              <div>
                <strong>Heinz wegen Angebot anrufen</strong>
                <div className="meta-row">
                  <span className="badge badge--workspace">Arbeit</span>
                  <span className="badge">AMS</span>
                  <span className="badge">Kommunikation</span>
                  <span className="badge badge--priority">hoch</span>
                </div>
              </div>
            </label>
          </article>

          <article className="task-card">
            <label className="task-row">
              <input type="checkbox" />
              <div>
                <strong>Seminarideen sortieren</strong>
                <div className="meta-row">
                  <span className="badge badge--workspace">Arbeit</span>
                  <span className="badge">Seminare</span>
                  <span className="badge">Idee</span>
                  <span className="badge">mittel</span>
                </div>
              </div>
            </label>
          </article>
        </section>
      </section>
    </main>
  );
}
