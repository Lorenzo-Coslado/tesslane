import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { validateArchive } from './archives.ts';
import { AvatarPreferences } from './avatar-contracts.ts';
import {
  defaultSettings,
  Settings,
  type Entities,
  type EntityKind,
  type JournalEvent,
} from '../shared/contracts.ts';

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export class Store {
  readonly db: DatabaseSync;
  private changes = new EventEmitter();
  private closed = false;
  constructor(readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(dataDir, 'tesslane.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version.user_version > 2) {
      this.db.close();
      throw new Error('This workspace needs a newer Tesslane version.');
    }
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, entity_id TEXT, feature_id TEXT, payload TEXT NOT NULL, at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS events_feature ON events(feature_id,seq);',
    );
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec(
        "CREATE INDEX IF NOT EXISTS entities_feature ON entities(kind,json_extract(data,'$.featureId')); CREATE INDEX IF NOT EXISTS entities_target ON entities(kind,json_extract(data,'$.targetId')); PRAGMA user_version=2; COMMIT;",
      );
    } catch (error) {
      this.db.exec('ROLLBACK');
      this.db.close();
      throw error;
    }
    if (!this.meta('settings')) this.setMeta('settings', defaultSettings());
  }
  get<K extends EntityKind>(kind: K, entityId: string): Entities[K] | undefined {
    const row = this.db
      .prepare('SELECT data FROM entities WHERE kind=? AND id=?')
      .get(kind, entityId) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  }
  list<K extends EntityKind>(kind: K): Entities[K][] {
    return (
      this.db.prepare('SELECT data FROM entities WHERE kind=? ORDER BY rowid').all(kind) as {
        data: string;
      }[]
    ).map((row) => JSON.parse(row.data));
  }
  page<K extends EntityKind>(
    kind: K,
    options: {
      featureId?: string;
      targetId?: string;
      agentId?: string;
      before?: number;
      limit?: number;
    } = {},
  ) {
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    if (
      !Number.isSafeInteger(limit) ||
      (options.before !== undefined &&
        (!Number.isSafeInteger(options.before) || options.before < 1))
    )
      throw new Error('Invalid history cursor.');
    const where = ['kind=?'];
    const params: (string | number)[] = [kind];
    for (const key of ['featureId', 'targetId', 'agentId'] as const)
      if (options[key]) {
        where.push("json_extract(data,'$." + key + "')=?");
        params.push(options[key]!);
      }
    if (options.before) {
      where.push('rowid<?');
      params.push(options.before);
    }
    const rows = this.db
      .prepare(
        'SELECT rowid,data FROM entities WHERE ' +
          where.join(' AND ') +
          ' ORDER BY rowid DESC LIMIT ?',
      )
      .all(...params, limit + 1) as { rowid: number; data: string }[];
    const more = rows.length > limit;
    const selected = rows.slice(0, limit);
    return {
      items: selected.map((row) => JSON.parse(row.data) as Entities[K]).reverse(),
      before: more ? selected.at(-1)?.rowid : undefined,
      hasMore: more,
    };
  }
  count(kind: EntityKind) {
    return Number(
      (
        this.db.prepare('SELECT count(*) AS count FROM entities WHERE kind=?').get(kind) as {
          count: number;
        }
      ).count,
    );
  }
  forFeature<K extends EntityKind>(kind: K, featureId: string): Entities[K][] {
    return (
      this.db
        .prepare(
          "SELECT data FROM entities WHERE kind=? AND json_extract(data,'$.featureId')=? ORDER BY rowid",
        )
        .all(kind, featureId) as { data: string }[]
    ).map((row) => JSON.parse(row.data));
  }
  recentAndActive<K extends EntityKind>(kind: K, limit = 200): Entities[K][] {
    const field = kind === 'run' || kind === 'approval' ? 'status' : 'state';
    return (
      this.db
        .prepare(
          "SELECT data FROM entities WHERE kind=? AND (json_extract(data,'$." +
            field +
            "') NOT IN ('completed','failed','interrupted','integrated','cancelled','approved','declined','superseded') OR rowid IN (SELECT rowid FROM entities WHERE kind=? ORDER BY rowid DESC LIMIT ?)) ORDER BY rowid",
        )
        .all(kind, kind, limit) as { data: string }[]
    ).map((row) => JSON.parse(row.data));
  }
  journalPage(
    options: { before?: number; limit?: number; featureId?: string; agentId?: string } = {},
  ) {
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    if (
      !Number.isSafeInteger(limit) ||
      (options.before !== undefined &&
        (!Number.isSafeInteger(options.before) || options.before < 1))
    )
      throw new Error('Invalid event cursor.');
    const where = ['seq<?'];
    const params: (string | number)[] = [options.before ?? this.seq() + 1];
    if (options.featureId) {
      where.push('feature_id=?');
      params.push(options.featureId);
    }
    if (options.agentId) {
      where.push("json_extract(payload,'$.agentId')=?");
      params.push(options.agentId);
    }
    const rows = this.db
      .prepare('SELECT * FROM events WHERE ' + where.join(' AND ') + ' ORDER BY seq DESC LIMIT ?')
      .all(...params, limit + 1) as any[];
    const selected = rows.slice(0, limit);
    return {
      items: selected
        .map(
          (row) =>
            ({
              seq: row.seq,
              type: row.type,
              entityId: row.entity_id ?? undefined,
              featureId: row.feature_id ?? undefined,
              payload: JSON.parse(row.payload),
              at: row.at,
            }) as JournalEvent,
        )
        .reverse(),
      before: rows.length > limit ? selected.at(-1)?.seq : undefined,
      hasMore: rows.length > limit,
    };
  }
  batch(changes: { kind: EntityKind; entity: Entities[EntityKind]; type?: string }[]) {
    const events: JournalEvent[] = [];
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const { kind, entity, type } of changes) {
        this.db
          .prepare(
            'INSERT INTO entities(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
          )
          .run(kind, entity.id, JSON.stringify(entity));
        events.push(
          this.insertEvent(
            type ?? kind + '.updated',
            entity,
            entity.id,
            kind === 'feature' ? entity.id : 'featureId' in entity ? entity.featureId : undefined,
          ),
        );
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    for (const event of events) this.changes.emit('event', event);
  }
  save<K extends EntityKind>(kind: K, entity: Entities[K], type = kind + '.updated'): Entities[K] {
    const featureId =
      kind === 'feature' ? entity.id : 'featureId' in entity ? entity.featureId : undefined;
    this.db.exec('BEGIN IMMEDIATE');
    let event: JournalEvent;
    try {
      this.db
        .prepare(
          'INSERT INTO entities(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
        )
        .run(kind, entity.id, JSON.stringify(entity));
      event = this.insertEvent(type, entity, entity.id, featureId);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    this.changes.emit('event', event);
    return entity;
  }
  meta<T = unknown>(key: string): T | undefined {
    const row = this.db.prepare('SELECT data FROM meta WHERE key=?').get(key) as
      { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  }
  setMeta(key: string, value: unknown): void {
    this.db
      .prepare(
        'INSERT INTO meta(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',
      )
      .run(key, JSON.stringify(value));
  }
  settings(): Settings {
    return Settings.parse(this.meta('settings'));
  }
  avatars(): AvatarPreferences {
    return AvatarPreferences.parse(this.meta('avatars') ?? {});
  }
  updateAvatars(value: unknown) {
    const avatars = AvatarPreferences.parse(value);
    this.db.exec('BEGIN IMMEDIATE');
    let event: JournalEvent;
    try {
      this.setMeta('avatars', avatars);
      event = this.insertEvent('avatars.updated', avatars);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    this.changes.emit('event', event);
    return avatars;
  }
  updateSettings(value: unknown) {
    const settings = Settings.parse(value);
    this.db.exec('BEGIN IMMEDIATE');
    let event: JournalEvent;
    try {
      this.setMeta('settings', settings);
      event = this.insertEvent('settings.updated', settings);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    this.changes.emit('event', event);
    return settings;
  }
  event(type: string, payload: unknown, featureId?: string): JournalEvent {
    const event = this.insertEvent(type, payload, undefined, featureId);
    this.changes.emit('event', event);
    return event;
  }
  private insertEvent(
    type: string,
    payload: unknown,
    entityId?: string,
    featureId?: string,
  ): JournalEvent {
    const at = now();
    const result = this.db
      .prepare('INSERT INTO events(type,entity_id,feature_id,payload,at) VALUES(?,?,?,?,?)')
      .run(type, entityId ?? null, featureId ?? null, JSON.stringify(payload), at);
    return { seq: Number(result.lastInsertRowid), type, payload, entityId, featureId, at };
  }
  events(after = 0, limit = 200): JournalEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT ?')
      .all(after, Math.min(limit, 2000)) as {
      seq: number;
      type: string;
      entity_id: string | null;
      feature_id: string | null;
      payload: string;
      at: string;
    }[];
    return rows.map((row) => ({
      seq: row.seq,
      type: row.type,
      entityId: row.entity_id ?? undefined,
      featureId: row.feature_id ?? undefined,
      payload: JSON.parse(row.payload),
      at: row.at,
    }));
  }
  recentEvents(limit = 100): JournalEvent[] {
    return this.events(Math.max(0, this.seq() - limit), limit);
  }
  seq(): number {
    return Number(
      (this.db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM events').get() as { seq: number })
        .seq,
    );
  }
  subscribe(listener: (event: JournalEvent) => void): () => void {
    this.changes.on('event', listener);
    return () => this.changes.off('event', listener);
  }
  export(): unknown {
    this.db.exec('BEGIN');
    try {
      return {
        format: 'tesslane-workspace',
        version: 2,
        projectRoot: this.meta('projectRoot'),
        createdAt: now(),
        settings: this.settings(),
        avatars: this.avatars(),
        entities: this.db.prepare('SELECT * FROM entities').all(),
        events: this.db.prepare('SELECT * FROM events ORDER BY seq').all(),
        configured: this.meta('configured'),
      };
    } finally {
      this.db.exec('COMMIT');
    }
  }
  restore(value: unknown): void {
    const archive = validateArchive(value);
    const settings = Settings.parse(archive.settings);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec('DELETE FROM entities; DELETE FROM events;');
      for (const row of archive.entities)
        this.db
          .prepare('INSERT INTO entities(kind,id,data) VALUES(?,?,?)')
          .run(row.kind, row.id, row.data);
      for (const row of archive.events)
        this.db
          .prepare(
            'INSERT INTO events(seq,type,entity_id,feature_id,payload,at) VALUES(?,?,?,?,?,?)',
          )
          .run(row.seq, row.type, row.entity_id, row.feature_id, row.payload, row.at);
      this.setMeta('settings', settings);
      this.setMeta('avatars', archive.avatars);
      this.setMeta('configured', Boolean(archive.configured));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    this.event('workspace.restored', { at: now() });
  }
  integrity() {
    return { result: this.db.prepare('PRAGMA quick_check').all(), schema: 2, events: this.seq() };
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.changes.removeAllListeners();
    this.db.close();
  }
}
