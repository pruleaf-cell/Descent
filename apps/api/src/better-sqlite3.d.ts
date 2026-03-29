declare module "better-sqlite3" {
  export type StatementResult = {
    changes: number;
    lastInsertRowid: bigint | number;
  };

  export interface Statement<T = unknown> {
    run(...params: unknown[]): StatementResult;
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
  }

  export interface Database<T = unknown> {
    prepare<U = T>(sql: string): Statement<U>;
    exec(sql: string): void;
    pragma(statement: string): void;
    close(): void;
  }

  export default class Database<T = unknown> {
    constructor(filename: string);
    prepare<U = T>(sql: string): Statement<U>;
    exec(sql: string): void;
    pragma(statement: string): void;
    close(): void;
  }
}
