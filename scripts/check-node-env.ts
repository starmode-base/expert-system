const nodeEnv = process.env.NODE_ENV;

console.log("NODE_ENV:", nodeEnv ?? "(undefined)");
console.log('NODE_ENV === "production":', nodeEnv === "production");
