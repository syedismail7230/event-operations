const { Signer } = require("@aws-sdk/rds-signer");
const fs = require('fs');

async function refreshToken() {
  const signer = new Signer({
    hostname: "database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com",
    port: 5432,
    region: "ap-southeast-2",
    username: "postgres",
  });
  
  try {
    const token = await signer.getAuthToken();
    const encodedToken = encodeURIComponent(token);
    const dbUrl = 'postgresql://postgres:' + encodedToken + '@database-1-instance-1.cp6yc8yksy1t.ap-southeast-2.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require';
    
    let env = fs.readFileSync('.env', 'utf-8');
    env = env.replace(/DATABASE_URL=".+"/, 'DATABASE_URL="' + dbUrl + '"');
    fs.writeFileSync('.env', env);
    console.log("Token dynamically generated and injected! Expires in 15 minutes.");
  } catch(e) {
    console.error("Failed to generate token", e);
  }
}
refreshToken();
