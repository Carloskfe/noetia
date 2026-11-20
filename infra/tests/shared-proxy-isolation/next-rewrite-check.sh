#!/usr/bin/env bash
# NEM-018 — does Noetia's real Next.js rewrite behave as the stand-in assumes?
# LOCAL ONLY. Builds a minimal Next.js app (same version and same rewrites() as
# services/web/next.config.js, same build-time INTERNAL_API_URL as its Dockerfile)
# and sends a credentialed POST through it to a sink named `api`.
# Downloads next/react from npm. Uses only n18x-prefixed local resources.
set -uo pipefail
NEXT_VERSION="${NEXT_VERSION:-14.2.35}"
W="$(mktemp -d)"; NET=n18xnet; IMG=n18x-next
cleanup() { docker rm -f n18x-web n18x-api >/dev/null 2>&1; docker network rm $NET >/dev/null 2>&1; docker rmi -f $IMG >/dev/null 2>&1; rm -rf "$W"; }
trap cleanup EXIT
mkdir -p "$W/app"
cat > "$W/package.json" <<JSON
{"name":"n18x","private":true,"scripts":{"build":"next build"},"dependencies":{"next":"$NEXT_VERSION","react":"18.3.1","react-dom":"18.3.1"}}
JSON
cat > "$W/next.config.js" <<'JS'
module.exports = { output: 'standalone', async rewrites() {
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000';
  return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
} };
JS
echo "export default function L({children}){return <html><body>{children}</body></html>}" > "$W/app/layout.js"
echo "export default function P(){return <p>web</p>}" > "$W/app/page.js"
cat > "$W/Dockerfile" <<'DF'
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm install --no-audit --no-fund
ENV NEXT_TELEMETRY_DISABLED=1
ENV INTERNAL_API_URL=http://api:4000
RUN npm run build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.next/standalone ./
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
CMD ["node","server.js"]
DF
docker build -q -t $IMG "$W" >/dev/null || { echo "build failed"; exit 2; }
docker network create $NET >/dev/null
SINK='let n=[];require("http").createServer((q,r)=>{let b="";q.on("data",c=>b+=c);q.on("end",()=>{if(q.url==="/__seen")return r.end(JSON.stringify(n));n.push({method:q.method,url:q.url,authorization:q.headers.authorization,cookie:q.headers.cookie,body:b});r.statusCode=404;r.end("sink")})}).listen(4000)'
docker run -d --name n18x-api --network $NET --network-alias api node:20-alpine node -e "$SINK" >/dev/null
# Runtime INTERNAL_API_URL deliberately differs: if it were honoured the sink stays empty.
docker run -d --name n18x-web --network $NET -e INTERNAL_API_URL=http://runtime-value-is-ignored:1 $IMG >/dev/null
sleep 4
docker exec n18x-web node -e '
fetch("http://127.0.0.1:3000/api/auth/login",{method:"POST",headers:{authorization:"Bearer n18-canary",cookie:"refresh=n18-canary-cookie","content-type":"application/json"},body:JSON.stringify({email:"canary@example.test",password:"n18-canary-password"})}).then(r=>console.log("client saw HTTP",r.status)).catch(e=>console.log("client error",e.message))'
echo "sink received: $(docker exec n18x-api node -e 'fetch("http://127.0.0.1:4000/__seen").then(r=>r.text()).then(console.log)')"
echo "baked in routes-manifest.json: $(docker exec n18x-web sh -c 'grep -o "http://[a-z-]*:[0-9]*" .next/routes-manifest.json | sort -u | tr "\n" " "')"
