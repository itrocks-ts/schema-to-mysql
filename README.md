[![npm version](https://img.shields.io/npm/v/@itrocks/schema-to-mysql?logo=npm)](https://www.npmjs.org/package/@itrocks/schema-to-mysql)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/schema-to-mysql)](https://www.npmjs.org/package/@itrocks/schema-to-mysql)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/schema-to-mysql?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/schema-to-mysql)
[![issues](https://img.shields.io/github/issues/itrocks-ts/schema-to-mysql)](https://github.com/itrocks-ts/schema-to-mysql/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# schema-to-mysql

Converts a table schema into MySQL statements for table creation.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/schema-to-mysql @itrocks/schema
```

`@itrocks/schema-to-mysql` has no runtime dependency on MySQL itself. It only needs
the `@itrocks/schema` package, which provides the in-memory representation of
tables, columns, and indexes.

## Usage

`@itrocks/schema-to-mysql` exposes a single class, `SchemaToMysql`. It converts
`Table`, `Column`, `Index`, and `Type` definitions from `@itrocks/schema` into
MySQL `CREATE TABLE` statements.

This package is typically used together with:

- `@itrocks/reflect-to-schema` to generate `Table` objects from TypeScript
  classes.
- `@itrocks/mysql-to-schema` to introspect existing database tables.
- `@itrocks/schema-diff` / `@itrocks/schema-diff-mysql` to generate ALTER
  statements from schema diffs.

### Minimal example: generate a CREATE TABLE statement

```ts
import { SchemaToMysql }      from '@itrocks/schema-to-mysql'
import type { Column, Table } from '@itrocks/schema'

const userTable: Table = {
  name:      'user',
  charset:   'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
  engine:    'InnoDB',
  columns: [
    {
      name:          'id',
      type:          { name: 'integer', signed: false, maxValue: 10_000 },
      canBeNull:     false,
      autoIncrement: true,
    } as Column,
    {
      name:      'email',
      type:      { name: 'string', length: 255, variableLength: true },
      canBeNull: false,
    } as Column,
  ],
  indexes: [
    {
      name: 'PRIMARY',
      type: 'primary',
      keys: [ { columnName: 'id' } ],
    },
    {
      name: 'UNIQ_user_email',
      type: 'unique',
      keys: [ { columnName: 'email' } ],
    },
  ],
}

const schemaToMysql = new SchemaToMysql()
const sql           = schemaToMysql.sql(userTable)

console.log(sql)
// CREATE TABLE `user` (
//   `id` bigint unsigned NOT NULL AUTO_INCREMENT,
//   `email` varchar(255) NOT NULL,
//   PRIMARY KEY (`id`),
//   UNIQUE KEY `UNIQ_user_email` (`email`)
// ) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE InnoDB
```

You can then execute the generated SQL using your preferred MySQL/MariaDB
driver.

### Complete example: keep a table in sync with a TypeScript model

In real applications, you will rarely build `Table` objects by hand. Instead,
you typically:

1. Define your domain model as TypeScript classes.
2. Convert those classes to a `Table` definition using
   `@itrocks/reflect-to-schema`.
3. Convert the `Table` to a `CREATE TABLE` SQL statement using
   `SchemaToMysql`.
4. Optionally combine with `@itrocks/mysql-to-schema` and
   `@itrocks/schema-diff-mysql` to migrate existing databases.

Below is a simplified example showing how `SchemaToMysql` integrates in a
schema-management flow similar to what `@itrocks/mysql-maintainer` does
internally:

```ts
import mariadb                         from 'mariadb'
import type { Connection }             from 'mariadb'
import { ReflectToTable }              from '@itrocks/reflect-to-schema'
import { SchemaToMysql }               from '@itrocks/schema-to-mysql'

class User {
  id!: number
  email!: string
}

async function createUserTableIfMissing(connection: Connection) {
  const reflectToTable = new ReflectToTable()
  const userTable      = reflectToTable.convert(User)

  const schemaToMysql = new SchemaToMysql()
  const sql           = schemaToMysql.sql(userTable)

  // In a real-world scenario you would first check whether the table exists.
  await connection.query(sql)
}

async function main() {
  const pool = mariadb.createPool({
    host:     'localhost',
    user:     'root',
    password: 'secret',
    database: 'my_app',
  })

  const connection = await pool.getConnection()
  try {
    await createUserTableIfMissing(connection)
  }
  finally {
    connection.release()
    await pool.end()
  }
}

main().catch(console.error)
```

## API

### `class SchemaToMysql`

Converts schema objects from `@itrocks/schema` into MySQL SQL strings. All
methods are pure helpers: they do not perform any database I/O.

You will usually only need the high-level `sql(table)` method, but the other
helpers can be useful when you need fine-grained control over the generated
statements.

#### `columnSql(column: Column): string`

Builds the SQL fragment describing a single column, for use inside a
`CREATE TABLE` statement.

- `column`: a `Column` object from `@itrocks/schema`.

The method uses the column's `type`, `canBeNull`, `default`,
`autoIncrement`, and optionally `type.collate` (for `enum`, `string`, and
`set` types) to build a valid MySQL column definition.

#### `columnsSql(columns: Column[]): string`

Builds the comma-separated list of column definitions for a table. Internally
delegates to `columnSql` for each element.

- `columns`: array of `Column` objects.

Returns a multiline string with one column definition per line, separated by
commas, suitable for inclusion inside `CREATE TABLE (...)`.

#### `defaultSql(value: any): string`

Converts a JavaScript value into a SQL literal suitable for use in a
`DEFAULT` clause.

- `value`: the default value to serialize.

Behavior:

- `null` becomes `NULL`.
- `string` values are quoted and single quotes are escaped.
- `Date` values are formatted as `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`.
- Any other value is converted using JavaScript string coercion.

You rarely need to call this directly; it is used by `columnSql` when
`column.default` is defined.

#### `indexSql(index: Index): string`

Builds the SQL fragment describing a single index.

- `index`: an `Index` object from `@itrocks/schema`.

Depending on `index.type`, this produces:

- `PRIMARY KEY (...)` for primary indexes.
- `UNIQUE KEY \\`name\\` (...)` for unique indexes.
- `KEY \\`name\\` (...)` for regular (non-unique) indexes.

Column lengths defined on index keys are respected.

#### `indexesSql(indexes: Index[]): string`

Builds the comma-separated list of index definitions for a table.

- `indexes`: array of `Index` objects.

Returns a multiline string suitable for inclusion after the column
definitions inside `CREATE TABLE (...)`.

#### `sql(table: Table): string`

Generates the full `CREATE TABLE` statement for a given table.

- `table`: a `Table` object from `@itrocks/schema`.

The result combines:

- `tableSql(table)` for the `CREATE TABLE` header,
- `columnsSql(table.columns)` for the column list,
- `indexesSql(table.indexes)` for the index list,
- `tableSqlEnd(table)` for charset, collation, and engine.

#### `tableSql(table: Table): string`

Returns the beginning of a `CREATE TABLE` statement for the given table:
`CREATE TABLE \\`<name>\\``.

You generally do not need to call this directly unless you are assembling your
own custom DDL.

#### `tableSqlEnd(table: Table): string`

Returns the trailing part of the `CREATE TABLE` statement, including:

- `CHARSET <table.charset>`
- `COLLATE <table.collation>`
- `ENGINE <table.engine>`

This method assumes that `charset`, `collation`, and `engine` are set on the
`Table` object.

#### `typeSql(type: Type): string`

Translates a `Type` object into a MySQL column type.

- `type`: a `Type` object from `@itrocks/schema`.

Behavior overview:

- For `decimal`, uses `decimal(length, precision)`.
- For `integer`, chooses between `tinyint`, `smallint`, `mediumint`, `int`,
  and `bigint` based on `length` or `maxValue`, and respects `signed`.
- For `string`, chooses between `char`, `varchar`, `text`, `mediumtext`, and
  `longtext` based on `length` and `variableLength`.
- For other names (including `enum`, `set`, etc.), uses the raw `name`.
- Appends `unsigned` when `signed === false`.
- Appends `ZEROFILL` when `zeroFill` is true.

Again, you generally do not need to call this directly unless you are
constructing your own SQL from low-level pieces.

## Typical use cases

- **Initial schema creation**: Generate `CREATE TABLE` statements from a set of
  `Table` objects and run them on a fresh MySQL/MariaDB database.
- **Code-first development**: Describe your domain model as TypeScript
  classes, convert them with `@itrocks/reflect-to-schema`, then feed the
  resulting `Table` objects to `SchemaToMysql`.
- **Schema migration tooling**: Combine `SchemaToMysql` with
  `@itrocks/mysql-to-schema`, `@itrocks/schema-diff`, and
  `@itrocks/schema-diff-mysql` to compute diffs between an existing database
  and your target model, and generate the SQL needed to migrate.
- **Custom DDL generators**: Reuse the low-level helpers (`columnSql`,
  `indexSql`, `typeSql`, etc.) when you need to generate partial DDL fragments
  or specialized statements beyond a simple `CREATE TABLE`.
