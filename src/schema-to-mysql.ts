import { Column } from '@itrocks/schema'
import { Table }  from '@itrocks/schema'
import { Type }   from '@itrocks/schema'

export class SchemaToMysql
{

	columnSql(column: Column)
	{
		return '`' + column.name + '` '
			+ this.typeSql(column.type)
			+ ((column.canBeNull === false)   ? ' NOT NULL' : '')
			+ ((column.default !== undefined) ? (' DEFAULT ' + this.defaultSql(column.default)) : '')
			+ (column.autoIncrement           ? ' AUTO_INCREMENT' : '')
	}

	columnsSql(columns: Column[])
	{
		return columns.map(column => this.columnSql(column)).join(',\n')
	}

	defaultSql(value: any)
	{
		if (value === null) {
			return 'NULL'
		}
		if (typeof value === 'string') {
			return "'" + value.replaceAll("'", "''") + "'"
		}
		if (value instanceof Date) {
			return "'" + value.toISOString().slice(0, (value.getTime() % 864e5) ? 19 : 10).replace('T', ' ') + "'"
		}
		return '' + value
	}

	sql(table: Table)
	{
		return this.tableSql(table) + ' (\n' + this.columnsSql(table.columns) + '\n)'
	}

	tableSql(table: Table)
	{
		return 'CREATE TABLE `' + table.name + '`'
	}

	typeSql(type: Type)
	{
		return type.name
			+ ((type.signed === false) ? ' UNSIGNED' : '')
			+ (type.zeroFill           ? ' ZEROFILL' : '')
	}

}
