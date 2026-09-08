// MySQL connection pool. Hostinger's managed MySQL wires credentials into
// the app's environment automatically — check the Node.js app panel for the
// exact variable names it injects and add fallbacks here if they differ.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER,
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as JS numbers, not strings
  dateStrings: true, // return DATE/DATETIME as plain "YYYY-MM-DD" strings, not JS Date objects (avoids timezone-shift bugs)
});

module.exports = pool;
