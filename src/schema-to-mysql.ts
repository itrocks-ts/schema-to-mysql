import { Column } from '@itrocks/schema'
import { Index }  from '@itrocks/schema'
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
			+ ((['enum', 'string', 'set'].includes(column.type.name) && column.type.collate)
				? ' COLLATE ' + column.type.collate
				: ''
			)
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

	indexSql(index: Index)
	{
		const keysSql = ' ('
			+ index.keys.map(key => '`' + key.columnName + '`' + (key.length ? '(' + key.length + ')' : '')).join(',')
			+ ')'
		return (index.type === 'primary')
			? ('PRIMARY KEY' + keysSql)
			: (((index.type === 'unique') ? 'UNIQUE ' : '') + 'KEY `' + index.name + '`' + keysSql)
	}

	indexesSql(indexes: Index[])
	{
		return indexes.map(index => this.indexSql(index)).join(',\n')
	}

	sql(table: Table)
	{
		const columnsSql = this.columnsSql(table.columns)
		const indexesSql = this.indexesSql(table.indexes)
		return this.tableSql(table) + ' (\n'
			+ columnsSql
			+ (indexesSql ? ',' + indexesSql : '') + '\n)'
			+ this.tableSqlEnd(table)
	}

	tableSql(table: Table)
	{
		return 'CREATE TABLE `' + table.name + '`'
	}

	tableSqlEnd(table: Table)
	{
		return ' CHARSET ' + table.charset
			+ ' COLLATE ' + table.collation
			+ ' ENGINE ' + table.engine
	}

	typeSql(type: Type)
	{
		const length   = type.length
		const name     = type.name
		let   typeSql: string
		switch (name) {
			case 'decimal':
				typeSql= 'decimal(' + type.length + ',' + type.precision + ')'
				break
			case 'integer':
				const maxValue = type.maxValue as number | undefined
				if (maxValue !== undefined) {
					if (type.signed) {
						typeSql = (maxValue > 2_147_483_647) ? 'bigint'
							: (maxValue > 8_388_607) ? 'int'
							: (maxValue > 32_767) ? 'mediumint'
							: (maxValue > 127) ? 'smallint'
							: 'tinyint'
					}
					else {
						typeSql = (maxValue > 4_294_967_295) ? 'bigint'
							: (maxValue > 16_777_215) ? 'int'
							: (maxValue > 65_535) ? 'mediumint'
							: (maxValue > 255) ? 'smallint'
							: 'tinyint'
					}
				}
				else {
					typeSql = (length === undefined) ? 'bigint'
						: (length > 9) ? 'bigint'
						: (length > 7) ? 'int'
						: (length > 4) ? 'mediumint'
						: (length > 2) ? 'smallint'
						: 'tinyint'
				}
				break
			case 'string':
				typeSql = (length === undefined) ? 'longtext'
					: (length > 16_777_215) ? 'longtext'
					: (length > 65_535) ? 'mediumtext'
					: (length > 255) ? 'text'
					: ((type.variableLength ? 'var' : '') + 'char(' + length + ')')
				break
			default:
				typeSql = name
		}
		return typeSql
			+ ((type.signed === false) ? ' UNSIGNED' : '')
			+ (type.zeroFill ? ' ZEROFILL' : '')
	}

}
