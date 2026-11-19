const button = document.getElementById('btnConnectPhone');

if (button) {
  let starting = false;
  button.addEventListener('click', async () => {
    const desktop = window.fleetDesktop;
    if (!desktop || typeof desktop.syncOpen !== 'function' || starting) return;

    starting = true;
    try {
      const result = await desktop.dbSettings();
      if (!result || !result.ok) throw new Error(result && result.error || 'Could not read the active database.');
      const databases = Array.isArray(result.databases) ? result.databases : [];
      const settings = result.settings || {};
      const selected = databases.find(db => db.name === settings.lastUsed) ||
        databases.find(db => db.name === settings.startWith) ||
        (databases.length === 1 ? databases[0] : null);
      if (!selected) throw new Error('Open a ledger database before connecting a phone.');

      const opened = await desktop.syncOpen(selected.name);
      if (!opened || !opened.ok) throw new Error(opened && opened.error || 'The phone connection could not start.');
    } catch (error) {
      const note = document.getElementById('fmPhoneNote');
      if (note) {
        note.textContent = 'Phone sync could not start: ' + String(error && error.message || error);
        note.hidden = false;
      }
    } finally {
      starting = false;
    }
  });
}
