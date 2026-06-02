import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',       
  password: '2003@Athiban',   //Change this to your password, i just keeping it empty for security reasons
  host: 'localhost',
  port: 5432,
  database: 'Fuji',   // Change this if you created a specific database name, in my case i just used my db name as "fuji"
});

export default pool;