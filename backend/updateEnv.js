const fs = require('fs');
const token = 'database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com:5432/?Action=connect&DBUser=postgres&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIA6GBGJCTKKKPBYN5G%2F20260421%2Fap-southeast-2%2Frds-db%2Faws4_request&X-Amz-Date=20260421T211857Z&X-Amz-Expires=900&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEHUaDmFwLXNvdXRoZWFzdC0yIkcwRQIgM77XIAQewqzN7VHRRCA%2B5%2FfY6bboatQJeLo0pdXW4HECIQC4EUw2%2BpZjDidEtWkkl7Emy4CN3xqQ0K4azpNBjySAryqbAgg%2BEAAaDDk3NTAzNzg2MzEyNCIMyG8astop8VjEkBTgKvgBTV1wn9JYKDQMRED%2FWReNm8KIMXwLZ2zhMOsRksKPE93duWUH8uaZLNUiTystcr5kBNqHe1R6fMkmBy8%2BKnUVCgHLJKE2g8lPia%2FCPeIuwYXtvVzjA0v1xf6SjRoFu%2BJh5yoOwyxfBzoZk3TPROp1eij7hT%2FKWy4bDxuw17aqhIYhAezDWFwKpH3pYzqT5Gcs9RkPW4jimL9J1qCwovfHM%2Byhvm0lJ6gtz7FQ7BWoeGxD0G9Lkyt0qxzuRUBIEelBlgyyN5qGCfK1kTA5k5t0j97NZ8PoFsz8oU0EEqppjnkbunDE4culKiqEuExzJ4GEAKzrtjY3eyow47yfzwY63wGMXfnOERtXzfylrg4o689%2Fmrc0qCnNKgyKFSf4AKl3XJmXHcY9TayALrqPBenobrJqi1R4o8zA0pdy6vjVxuhO5E28KHB%2FjfwvzC9VYmC1nPoIasAjMPAIe5ZMBQHu2RARNEAUJXnAgKhL7OE6sxKVcDLCveX8WbTpIvtz28%2Ft7v8l417RZOumezU4ZzLCIMkVUNtwG0bbIwksHcfrbP7rX71ZzpZTM6qKVp2jPookOdu2uTenDLf2nPCGOExwbuRoA%2FFB%2B1xS7Llm%2B3Na4s9U89s%2Fw052F987daBSbi1M&X-Amz-Signature=d3581751eaba53cff88773b8c5d264ec93e820983ca0418fc17759b63572a5ca&X-Amz-SignedHeaders=host';
const encodedToken = encodeURIComponent(token);
// Format for IAM Token is postgresql://role:url-encoded-token@host:port/database
const dbUrl = 'postgresql://postgres:' + encodedToken + '@database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com:5432/postgres?schema=public';

let env = fs.readFileSync('.env', 'utf-8');
env = env.replace(/DATABASE_URL=".+"/, 'DATABASE_URL="' + dbUrl + '"');
fs.writeFileSync('.env', env);
console.log('Successfully injected IAM token into .env');
