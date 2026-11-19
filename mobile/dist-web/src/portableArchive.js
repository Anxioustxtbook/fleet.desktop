import { APP_NAME, LISTS } from './config.js';

export const ARCHIVE_KIND = 'fleetpilot-mobile-ledger';
export const ARCHIVE_VERSION = 1;

export function makePortableArchive(data, { device, madeAt }) {
  const records = {};
  for (const list of LISTS) {
    if (!Array.isArray(data[list])) throw new Error(`The phone could not export the ${list} records.`);
    records[list] = data[list];
  }
  return {
    app: APP_NAME,
    kind: ARCHIVE_KIND,
    version: ARCHIVE_VERSION,
    madeAt,
    device,
    data: records
  };
}

export function readPortableArchive(text, device) {
  let archive;
  try { archive = JSON.parse(text); }
  catch (_) { throw new Error('This file is not valid JSON. Nothing was imported.'); }
  if (!archive || archive.kind !== ARCHIVE_KIND || archive.version !== ARCHIVE_VERSION)
    throw new Error('This is not a supported FleetPilot phone archive. Nothing was imported.');
  if (archive.device !== device)
    throw new Error('This archive was created by a different phone. Use Connect & Sync to transfer records between devices.');
  if (!archive.data || typeof archive.data !== 'object' || Array.isArray(archive.data))
    throw new Error('The archive has no valid record data. Nothing was imported.');

  const counts = {};
  let total = 0;
  for (const list of LISTS) {
    const records = archive.data[list];
    if (!Array.isArray(records)) throw new Error(`The archive is missing the ${list} records. Nothing was imported.`);
    const ids = new Set();
    for (const record of records) {
      if (!record || typeof record !== 'object' || Array.isArray(record) || record.id == null)
        throw new Error(`The archive contains an invalid ${list} record. Nothing was imported.`);
      const id = String(record.id);
      if (ids.has(id)) throw new Error(`The archive contains duplicate ${list} record numbers. Nothing was imported.`);
      ids.add(id);
    }
    counts[list] = records.length;
    total += records.length;
  }
  return { archive, counts, total };
}
